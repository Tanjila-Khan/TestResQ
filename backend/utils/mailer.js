const nodemailer = require('nodemailer');
require('dotenv').config();

// Import the Zoho Mail transporter
const transporter = require('../config/email');

// Rate limiting configuration
const RATE_LIMIT = {
  maxEmailsPerMinute: 10, // Zoho recommended limit
  maxEmailsPerHour: 100,
  delayBetweenEmails: 6000 // 6 seconds between emails
};

// Track email sending
let emailQueue = [];
let lastEmailTime = 0;

/**
 * Rate limiting function
 */
function canSendEmail() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  const oneHourAgo = now - 3600000;
  
  // Clean old entries
  emailQueue = emailQueue.filter(time => time > oneHourAgo);
  
  const emailsLastMinute = emailQueue.filter(time => time > oneMinuteAgo).length;
  const emailsLastHour = emailQueue.length;
  
  return emailsLastMinute < RATE_LIMIT.maxEmailsPerMinute && 
         emailsLastHour < RATE_LIMIT.maxEmailsPerHour;
}

/**
 * Add delay between emails
 */
function addDelay() {
  const now = Date.now();
  const timeSinceLastEmail = now - lastEmailTime;
  
  if (timeSinceLastEmail < RATE_LIMIT.delayBetweenEmails) {
    const delay = RATE_LIMIT.delayBetweenEmails - timeSinceLastEmail;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  
  return Promise.resolve();
}

/**
 * Send transactional email using Zoho Mail SMTP with rate limiting
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.scheduledAt] - ISO8601 scheduled time (optional)
 * @param {string} [options.fromEmail] - Sender email (optional)
 * @param {string} [options.fromName] - Sender name (optional)
 * @param {Object} [options.headers] - Custom email headers (optional)
 * @param {number} [options.retryCount] - Number of retries attempted (internal)
 */
async function sendZohoEmail({ to, subject, html, scheduledAt, fromEmail, fromName, headers = {}, retryCount = 0 }) {
  console.log('[Mailer] sendZohoEmail called:', { to, subject, retryCount });
  
  try {
    // Check rate limits
    if (!canSendEmail()) {
      console.log('[Mailer] Rate limit exceeded, queuing email for later');
      // Queue the email to be sent later
      setTimeout(() => {
        sendZohoEmail({ to, subject, html, scheduledAt, fromEmail, fromName });
      }, 60000); // Retry in 1 minute
      return { queued: true, message: 'Email queued due to rate limit' };
    }

    // Add delay between emails
    await addDelay();
    
    console.log('Email configuration:', {
      ZOHO_EMAIL_USER: process.env.ZOHO_EMAIL_USER,
      ZOHO_EMAIL: process.env.ZOHO_EMAIL,
      ZOHO_EMAIL_PASSWORD: process.env.ZOHO_EMAIL_PASSWORD ? 'SET' : 'NOT SET'
    });
    
    const mailOptions = {
      from: `"${fromName || 'CartResQ'}" <${fromEmail || process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL}>`,
      to: to,
      subject: subject,
      html: html,
      // Add headers to improve deliverability and reduce spam
      headers: {
        'List-Unsubscribe': `<mailto:${fromEmail || process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'Precedence': 'bulk',
        'X-Mailer': 'CartResQ Email System',
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Importance': 'Normal',
        'X-Report-Abuse': `Please report abuse here: ${fromEmail || process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL}`,
        // Merge custom headers
        ...headers
      },
      // Add text version for better deliverability
      text: html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    };

    console.log('Sending email via Zoho Mail SMTP:', {
      to,
      subject,
      scheduledAt: scheduledAt || 'immediate',
      fromEmail: fromEmail || process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL
    });

    const result = await transporter.sendMail(mailOptions);
    
    // Update tracking
    lastEmailTime = Date.now();
    emailQueue.push(lastEmailTime);
    
    console.log('Zoho Mail SMTP response:', result);
    
    return {
      messageId: result.messageId,
      id: result.messageId
    };
  } catch (error) {
    console.error('Zoho Mail SMTP error:', error);
    
    // Handle specific Zoho errors
    if (error.responseCode === 550 && error.response.includes('Unusual sending activity')) {
      console.log('[Mailer] Zoho blocked due to unusual activity, implementing longer delay');
      
      if (retryCount < 3) {
        // Wait longer before retry (5 minutes)
        setTimeout(() => {
          sendZohoEmail({ to, subject, html, scheduledAt, fromEmail, fromName, retryCount: retryCount + 1 });
        }, 300000); // 5 minutes
        return { queued: true, message: 'Email queued due to Zoho block, retrying in 5 minutes' };
      } else {
        throw new Error('Zoho account blocked after 3 retries. Please unblock at https://mail.zoho.com/UnblockMe');
      }
    }
    
    // Handle other rate limiting errors
    if (error.responseCode === 421 || error.responseCode === 450) {
      console.log('[Mailer] Rate limit error, implementing exponential backoff');
      
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 60000; // Exponential backoff: 1min, 2min, 4min
        setTimeout(() => {
          sendZohoEmail({ to, subject, html, scheduledAt, fromEmail, fromName, retryCount: retryCount + 1 });
        }, delay);
        return { queued: true, message: `Email queued due to rate limit, retrying in ${delay/1000} seconds` };
      }
    }
    
    throw error;
  }
}

// Keep the old function name for backward compatibility
const sendBrevoEmail = sendZohoEmail;

module.exports = { sendZohoEmail, sendBrevoEmail };