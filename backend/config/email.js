const nodemailer = require('nodemailer');
require('dotenv').config();

// Create reusable transporter for Zoho Mail SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  },
  // Add headers to improve deliverability
  headers: {
    'X-Priority': '3',
    'X-MSMail-Priority': 'Normal',
    'Importance': 'normal'
  }
});

// Verify connection configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP Connection Error:', error.message);
    if (error.code === 'EAUTH') {
      console.error('SMTP Authentication Error: Please check your Zoho Mail credentials');
      console.error('Required environment variables:');
      console.error('- ZOHO_EMAIL_USER: your-email@yourdomain.com');
      console.error('- ZOHO_EMAIL_PASSWORD: [Your Zoho Mail password or app-specific password]');
    }
  } else {
    console.log('Nodemailer is ready to send emails via Zoho Mail SMTP');
  }
});

module.exports = transporter; 