const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get available plans
router.get('/plans', paymentController.getPlans);

// Get user's subscription
router.get('/subscription', paymentController.getSubscription);

// Create checkout session
router.post('/create-checkout-session', paymentController.createCheckoutSession);

// Create customer portal session
router.post('/create-portal-session', paymentController.createCustomerPortalSession);

// Cancel subscription
router.post('/cancel-subscription', paymentController.cancelSubscription);

// Reactivate subscription
router.post('/reactivate-subscription', paymentController.reactivateSubscription);

// Get payment history
router.get('/payment-history', paymentController.getPaymentHistory);

// Stripe webhook (no authentication required)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

module.exports = router; 