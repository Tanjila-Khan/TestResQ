const express = require('express');
const router = express.Router();
const { getStats, getChartData } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.get('/stats', authenticate, getStats);
router.get('/chart', authenticate, getChartData);

module.exports = router; 