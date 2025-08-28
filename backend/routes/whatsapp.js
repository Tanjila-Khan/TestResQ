const express = require('express');
const router = express.Router();
const { 
  sendWhatsAppReminder, 
  handleWhatsAppStatus,
  sendBulkWhatsApp 
} = require('../controllers/whatsappController');
const { authenticate } = require('../middleware/auth');

// Send WhatsApp reminder for a single cart - require authentication
router.post('/send-reminder', authenticate, sendWhatsAppReminder);

// Send WhatsApp messages to multiple carts - require authentication
router.post('/send-bulk', authenticate, sendBulkWhatsApp);

// Handle WhatsApp status callbacks from Twilio
router.post('/status', handleWhatsAppStatus);

module.exports = router; 