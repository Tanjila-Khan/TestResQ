const express = require('express');
const router = express.Router();
const { 
  sendWhatsAppReminder, 
  handleWhatsAppStatus,
  sendBulkWhatsApp 
} = require('../controllers/whatsappController');

// Send WhatsApp reminder for a single cart
router.post('/send-reminder', sendWhatsAppReminder);

// Send WhatsApp messages to multiple carts
router.post('/send-bulk', sendBulkWhatsApp);

// Handle WhatsApp status callbacks from Twilio
router.post('/status', handleWhatsAppStatus);

module.exports = router; 