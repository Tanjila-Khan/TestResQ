const express = require('express');
const router = express.Router();
const { sendSMS, sendSmsReminder, checkSmsStatus } = require('../controllers/smsController');
const { authenticate } = require('../middleware/auth');

// Send SMS endpoint - require authentication
router.post('/send', authenticate, sendSMS);

// Send SMS reminder endpoint - require authentication
router.post('/send-reminder', authenticate, sendSmsReminder);

// Check SMS status endpoint
router.get('/status/:cartId', checkSmsStatus);

// Test Twilio configuration endpoint
router.get('/test-config', authenticate, async (req, res) => {
  try {
    const config = {
      hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
      hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
      accountSidPrefix: process.env.TWILIO_ACCOUNT_SID ? process.env.TWILIO_ACCOUNT_SID.substring(0, 5) + '...' : 'Not set'
    };
    
    res.json({
      success: true,
      message: 'Twilio configuration check',
      config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test phone number formatting endpoint
router.post('/test-format', authenticate, async (req, res) => {
  try {
    const { phoneNumber, countryCode = 'US' } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }
    
    // Import the formatting function
    const { formatPhoneNumberForSMS } = require('../controllers/smsController');
    
    const formatted = formatPhoneNumberForSMS(phoneNumber, countryCode);
    
    res.json({
      success: true,
      message: 'Phone number formatting test',
      original: phoneNumber,
      countryCode,
      formatted,
      isValid: !!formatted && formatted.startsWith('+'),
      digitCount: formatted ? formatted.substring(1).replace(/\D/g, '').length : 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 