const express = require('express');
const router = express.Router();
const { connectStore, getCustomers, getRecentCustomers, checkUserStoreConnection, disconnectStore } = require('../controllers/storeController');
const requireSubscription = require('../middleware/subscription');
const { authenticate } = require('../middleware/auth');

// Store connection - require authentication and active/trialing subscription
router.post('/connect-store', authenticate, requireSubscription, connectStore);
router.post('/connect', authenticate, requireSubscription, connectStore);

// Check if user has a connected store - require authentication
router.get('/check-connection', authenticate, checkUserStoreConnection);

// Disconnect store - require authentication
router.delete('/disconnect', authenticate, disconnectStore);

// Get customers - require active/trialing subscription
router.get('/customers', authenticate, requireSubscription, getCustomers);
router.get('/recent-customers', authenticate, requireSubscription, getRecentCustomers);
router.get('/customers/recent', authenticate, requireSubscription, getRecentCustomers);

module.exports = router; 