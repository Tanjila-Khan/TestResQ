const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Plan configurations
const plans = {
  free: {
    name: 'CartResQ Lite',
    price: 0,
    features: [
      '1 connected store (WooCommerce or Shopify)',
      'Detect and view abandoned carts',
      '1 automated email recovery workflow',
      'Send up to 500 recovery emails/month',
      'Basic cart analytics (total carts, recovery rate)',
      'Manual coupon creation',
      'Responsive dashboard',
      'Email support'
    ],
    limits: {
      maxStores: 1,
      maxEmailsPerMonth: 500,
      maxSmsPerMonth: 0,
      maxWhatsappPerMonth: 0,
      maxEmailWorkflows: 1,
      advancedAnalytics: false,
      prioritySupport: false,
      customBranding: false,
      apiAccess: false,
      automatedSms: false,
      automatedWhatsapp: false,
      customerSegmentation: false,
      scheduledCampaigns: false,
      realTimeNotifications: false,
      multiStoreDashboard: false,
      roiTracking: false,
      exportAnalytics: false
    }
  },
  starter: {
    name: 'CartResQ Starter',
    price: 19,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID,
    features: [
      'Everything in Free, plus:',
      'Up to 2 connected stores',
      'Up to 5,000 recovery emails/month',
      'Unlimited automated email workflows',
      'Pre-built cart recovery email templates',
      'Manual SMS & WhatsApp sending',
      'Custom discount coupons with auto-sync',
      'Advanced cart and coupon analytics',
      'Scheduled email campaigns',
      'Customer segmentation',
      'Real-time notifications',
      'Priority email/chat support'
    ],
    limits: {
      maxStores: 2,
      maxEmailsPerMonth: 5000,
      maxSmsPerMonth: 100,
      maxWhatsappPerMonth: 100,
      maxEmailWorkflows: -1,
      advancedAnalytics: true,
      prioritySupport: true,
      customBranding: false,
      apiAccess: false,
      automatedSms: false,
      automatedWhatsapp: false,
      customerSegmentation: true,
      scheduledCampaigns: true,
      realTimeNotifications: true,
      multiStoreDashboard: false,
      roiTracking: false,
      exportAnalytics: false
    }
  },
  growth: {
    name: 'CartResQ Growth',
    price: 49,
    stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID,
    features: [
      'Everything in Starter, plus:',
      'Up to 3 connected stores',
      'Unlimited email recovery sends',
      'Automated SMS & WhatsApp recovery messages',
      'Full communication history tracking',
      'Advanced segmentation: behavior + cart value',
      'Multi-store dashboard with cross-store comparison',
      'Real-time analytics (conversion rates, top products, CLV)',
      'ROI tracking dashboard',
      'Notification preferences management',
      'Export analytics/chart data',
      'Premium support (email, chat, onboarding help)'
    ],
    limits: {
      maxStores: 3,
      maxEmailsPerMonth: -1,
      maxSmsPerMonth: 1000,
      maxWhatsappPerMonth: 1000,
      maxEmailWorkflows: -1,
      advancedAnalytics: true,
      prioritySupport: true,
      customBranding: false,
      apiAccess: false,
      automatedSms: true,
      automatedWhatsapp: true,
      customerSegmentation: true,
      scheduledCampaigns: true,
      realTimeNotifications: true,
      multiStoreDashboard: true,
      roiTracking: true,
      exportAnalytics: true
    }
  }
};

// Stripe webhook events to handle
const webhookEvents = {
  'customer.subscription.created': 'handleSubscriptionCreated',
  'customer.subscription.updated': 'handleSubscriptionUpdated',
  'customer.subscription.deleted': 'handleSubscriptionDeleted',
  'invoice.payment_succeeded': 'handlePaymentSucceeded',
  'invoice.payment_failed': 'handlePaymentFailed',
  'payment_intent.succeeded': 'handlePaymentIntentSucceeded',
  'payment_intent.payment_failed': 'handlePaymentIntentFailed'
};

module.exports = {
  stripe,
  plans,
  webhookEvents
}; 