const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { emailScheduler } = require('../services/emailScheduler');

// Get email scheduler status only (no automatic cron scheduler)
router.get('/status', authenticate, async (req, res) => {
  try {
    const emailStatus = await emailScheduler.getQueueStatus();
    
    res.json({
      email: emailStatus,
      automaticScheduler: 'disabled',
      manualScheduling: 'enabled',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual email scheduling endpoint (for testing)
router.post('/schedule-test-email', authenticate, async (req, res) => {
  try {
    const { cartId, platform, storeUrl, delayHours = 0, reminderType = 'manual' } = req.body;
    
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
      message: `Manual email scheduled for cart ${cartId} in ${delayHours} hours` 
    });
  } catch (error) {
    console.error('Error scheduling manual email:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 