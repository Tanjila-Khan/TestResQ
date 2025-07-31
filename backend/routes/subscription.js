const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

// Create Stripe Checkout session
router.post('/create-checkout-session', subscriptionController.createCheckoutSession);

// Stripe webhook endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), subscriptionController.handleStripeWebhook);

// Get current user's subscription status
router.get('/status', subscriptionController.getSubscriptionStatus);

// Get all available subscription plans
router.get('/plans', subscriptionController.getPlans);

// Sync subscription from Stripe
router.post('/sync', subscriptionController.syncSubscription);

// Manual subscription update (for testing)
router.post('/manual-update', subscriptionController.manualUpdateSubscription);

// Check Stripe session
router.get('/check-session', subscriptionController.checkSession);

module.exports = router; 