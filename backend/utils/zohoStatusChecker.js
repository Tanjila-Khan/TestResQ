const transporter = require('../config/email');

/**
 * Check Zoho Mail account status and provide recommendations
 */
async function checkZohoStatus() {
  try {
    console.log('🔍 Checking Zoho Mail account status...');
    
    // Test connection
    await transporter.verify();
    console.log('✅ Zoho Mail connection successful');
    
    return {
      status: 'healthy',
      message: 'Zoho Mail account is working properly',
      recommendations: [
        'Monitor email sending rates',
        'Keep sending volume under 100 emails per hour',
        'Add delays between bulk sends'
      ]
    };
  } catch (error) {
    console.error('❌ Zoho Mail connection failed:', error.message);
    
    let status = 'error';
    let message = 'Zoho Mail connection failed';
    let recommendations = [];
    
    if (error.responseCode === 550 && error.response.includes('Unusual sending activity')) {
      status = 'blocked';
      message = 'Zoho account blocked due to unusual sending activity';
      recommendations = [
        'Visit https://mail.zoho.com/UnblockMe to unblock your account',
        'Wait 24 hours before sending more emails',
        'Reduce sending frequency',
        'Implement longer delays between emails'
      ];
    } else if (error.responseCode === 421 || error.responseCode === 450) {
      status = 'rate_limited';
      message = 'Zoho account rate limited';
      recommendations = [
        'Reduce email sending frequency',
        'Wait before sending more emails',
        'Implement exponential backoff'
      ];
    } else if (error.code === 'EAUTH') {
      status = 'auth_error';
      message = 'Zoho authentication failed';
      recommendations = [
        'Check ZOHO_EMAIL_USER and ZOHO_EMAIL_PASSWORD environment variables',
        'Verify account credentials',
        'Enable 2FA app passwords if using 2FA'
      ];
    } else {
      recommendations = [
        'Check Zoho Mail service status',
        'Verify network connectivity',
        'Contact Zoho support if issue persists'
      ];
    }
    
    return {
      status,
      message,
      error: error.message,
      recommendations
    };
  }
}

/**
 * Get Zoho sending limits and best practices
 */
function getZohoLimits() {
  return {
    dailyLimit: 1000,
    hourlyLimit: 100,
    perMinuteLimit: 10,
    recommendedDelays: {
      betweenEmails: 6000, // 6 seconds
      betweenBulkSends: 300000, // 5 minutes
      afterBlock: 86400000 // 24 hours
    },
    bestPractices: [
      'Send emails in small batches',
      'Add delays between sends',
      'Use proper authentication',
      'Include unsubscribe headers',
      'Monitor bounce rates',
      'Warm up new accounts gradually'
    ]
  };
}

/**
 * Test sending a single email (for diagnostics)
 */
async function testZohoEmail(to = 'test@example.com') {
  try {
    const testEmail = {
      to,
      subject: 'Zoho Test Email',
      html: '<h1>Test Email</h1><p>This is a test email to verify Zoho Mail configuration.</p>',
      fromEmail: process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL,
      fromName: 'CartResQ Test'
    };
    
    const { sendZohoEmail } = require('./mailer');
    const result = await sendZohoEmail(testEmail);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Test email sent successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Test email failed'
    };
  }
}

module.exports = {
  checkZohoStatus,
  getZohoLimits,
  testZohoEmail
}; 