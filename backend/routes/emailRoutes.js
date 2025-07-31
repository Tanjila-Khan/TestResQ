const express = require('express');
const router = express.Router();
const { sendEmail, getSentEmails, sendDiscountOfferEmail } = require('../controllers/emailController');
const { authenticate } = require('../middleware/auth');
const { emailScheduler } = require('../services/emailScheduler');

// Send email endpoint - require authentication
router.post('/send-email', authenticate, sendEmail);

// Get sent emails endpoint - require authentication
router.get('/sent-emails', authenticate, getSentEmails);

// Send discount offer email endpoint - require authentication
router.post('/send-discount-offer', authenticate, sendDiscountOfferEmail);

// Debug endpoint to check queue status
router.get('/queue-status', async (req, res) => {
  try {
    const status = await emailScheduler.getQueueStatus();
    res.json({
      queueStatus: status,
      environment: process.env.NODE_ENV,
      mongoUri: process.env.MONGODB_URI ? 'URI is set' : 'URI is not set',
      schedulerStatus: emailScheduler.isInitialized ? 'Initialized' : 'Not initialized'
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Schedule email reminder endpoint
router.post('/schedule-reminder', authenticate, async (req, res) => {
  try {
    const { cartId, platform, storeUrl, delayHours = 1, reminderType = 'first' } = req.body;
    
    if (!cartId || !platform) {
      return res.status(400).json({ error: 'Cart ID and platform are required' });
    }

    await emailScheduler.scheduleAbandonedCartReminder(
      cartId,
      platform,
      storeUrl || '',
      delayHours,
      reminderType
    );

    res.json({ 
      success: true, 
      message: `${reminderType} reminder scheduled for cart ${cartId}` 
    });
  } catch (error) {
    console.error('Error scheduling reminder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel scheduled jobs for a cart
router.delete('/cancel-cart-jobs/:cartId', authenticate, async (req, res) => {
  try {
    const { cartId } = req.params;
    
    await emailScheduler.cancelCartJobs(cartId);
    
    res.json({ 
      success: true, 
      message: `Cancelled all scheduled jobs for cart ${cartId}` 
    });
  } catch (error) {
    console.error('Error cancelling cart jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;