const express = require('express');
const router = express.Router();
const { sendSMS, sendSmsReminder, checkSmsStatus } = require('../controllers/smsController');

// Send SMS endpoint
router.post('/send', sendSMS);

// Send SMS reminder endpoint
router.post('/send-reminder', sendSmsReminder);

// Check SMS status endpoint
router.get('/status/:cartId', checkSmsStatus);

module.exports = router; 