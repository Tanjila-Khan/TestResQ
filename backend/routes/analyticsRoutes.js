const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

// Get analytics data - require authentication
router.get('/', authenticate, analyticsController.getAnalytics);

// Export analytics data - require authentication
router.get('/export', authenticate, analyticsController.exportAnalytics);

// Get recovery rate trend data - require authentication
router.get('/recovery-rate-trend', authenticate, analyticsController.getRecoveryRateTrend);

// Get revenue trend data - require authentication
router.get('/revenue-trend', authenticate, analyticsController.getRevenueTrend);

module.exports = router; 