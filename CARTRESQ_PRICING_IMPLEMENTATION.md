# CartResQ Pricing Implementation

## Overview
This document outlines the implementation of the new CartResQ pricing structure with three tiers: Lite (Free), Starter ($19/month), and Growth ($49/month).

## Pricing Tiers

### 1. CartResQ Lite (Free)
**Ideal for:** Small stores testing cart recovery automation
**Price:** $0/month

**Features:**
- 1 connected store (WooCommerce or Shopify)
- Detect and view abandoned carts
- 1 automated email recovery workflow
- Send up to 500 recovery emails/month
- Basic cart analytics (total carts, recovery rate)
- Manual coupon creation
- Responsive dashboard
- Email support

**Limits:**
- Max Stores: 1
- Max Emails/Month: 500
- Max SMS/Month: 0
- Max WhatsApp/Month: 0
- Advanced Analytics: No
- Priority Support: No
- Automated SMS: No
- Automated WhatsApp: No
- Multi-store Dashboard: No
- ROI Tracking: No
- Export Analytics: No

### 2. CartResQ Starter ($19/month)
**Ideal for:** Growing stores focused on email-based recovery
**Price:** $19/month (or $15/month with yearly billing - 20% savings)

**Features:**
- Everything in Free, plus:
- Up to 2 connected stores
- Up to 5,000 recovery emails/month
- Unlimited automated email workflows
- Pre-built cart recovery email templates
- Manual SMS & WhatsApp sending
- Custom discount coupons with auto-sync
- Advanced cart and coupon analytics
- Scheduled email campaigns
- Customer segmentation
- Real-time notifications
- Priority email/chat support

**Limits:**
- Max Stores: 2
- Max Emails/Month: 5000
- Max SMS/Month: 100
- Max WhatsApp/Month: 100
- Advanced Analytics: Yes
- Priority Support: Yes
- Automated SMS: No
- Automated WhatsApp: No
- Multi-store Dashboard: No
- ROI Tracking: No
- Export Analytics: No

### 3. CartResQ Growth ($49/month)
**Ideal for:** Multi-store businesses scaling cart recovery with automation
**Price:** $49/month (or $39/month with yearly billing - 20% savings)

**Features:**
- Everything in Starter, plus:
- Up to 3 connected stores
- Unlimited email recovery sends
- Automated SMS & WhatsApp recovery messages
- Full communication history tracking
- Advanced segmentation: behavior + cart value
- Multi-store dashboard with cross-store comparison
- Real-time analytics (conversion rates, top products, CLV)
- ROI tracking dashboard
- Notification preferences management
- Export analytics/chart data
- Premium support (email, chat, onboarding help)

**Limits:**
- Max Stores: 3
- Max Emails/Month: Unlimited
- Max SMS/Month: 1000
- Max WhatsApp/Month: 1000
- Advanced Analytics: Yes
- Priority Support: Yes
- Automated SMS: Yes
- Automated WhatsApp: Yes
- Multi-store Dashboard: Yes
- ROI Tracking: Yes
- Export Analytics: Yes

## Optional Add-ons

### For Starter & Growth Plans:
- **Additional Store:** $10/store/month
- **Additional SMS/WhatsApp Credits:** Pay-per-use (when usage exceeds free tier)
- **White-label Branding:** Custom pricing (for agencies and resellers)

## Implementation Details

### Frontend Changes
1. **Updated Pricing Component** (`frontend/src/components/pricing/Pricing.js`):
   - Replaced dynamic plan loading with static CartResQ plans
   - Added plan descriptions and ideal use cases
   - Implemented yearly billing with 20% discount
   - Added optional add-ons section
   - Updated styling and layout for 3-column grid

### Backend Changes
1. **Updated Stripe Configuration** (`backend/config/stripe.js`):
   - Replaced old plans with new CartResQ structure
   - Added comprehensive feature lists and limits
   - Updated pricing to match new tiers
   - Added new limit fields for advanced features

2. **Subscription Controller** (`backend/controllers/subscriptionController.js`):
   - Already supports the new plan structure
   - Handles free plan activation
   - Manages Stripe checkout for paid plans
   - Processes webhooks for subscription updates

### Environment Variables Required
```
STRIPE_STARTER_PRICE_ID - for CartResQ Starter plan
STRIPE_GROWTH_PRICE_ID - for CartResQ Growth plan
STRIPE_SECRET_KEY - Stripe secret key
STRIPE_WEBHOOK_SECRET - Stripe webhook secret
JWT_SECRET - for authentication
FRONTEND_URL - frontend URL for redirects
```

## Key Features by Plan

### Email Recovery
- **Lite:** 500 emails/month, 1 workflow
- **Starter:** 5,000 emails/month, unlimited workflows
- **Growth:** Unlimited emails, unlimited workflows

### Store Connections
- **Lite:** 1 store
- **Starter:** 2 stores
- **Growth:** 3 stores
- **Add-on:** $10/store/month for additional stores

### SMS & WhatsApp
- **Lite:** Not available
- **Starter:** Manual sending (100/month each)
- **Growth:** Automated messages (1,000/month each)
- **Add-on:** Pay-per-use credits

### Analytics & Reporting
- **Lite:** Basic analytics (total carts, recovery rate)
- **Starter:** Advanced cart and coupon analytics
- **Growth:** Real-time analytics, ROI tracking, export capabilities

### Support
- **Lite:** Email support
- **Starter:** Priority email/chat support
- **Growth:** Premium support (email, chat, onboarding help)

## Next Steps

1. **Set up Stripe Products and Prices:**
   - Create products in Stripe dashboard
   - Set up monthly and yearly pricing
   - Update environment variables with price IDs

2. **Test Payment Flow:**
   - Test free plan activation
   - Test Stripe checkout for paid plans
   - Verify webhook handling

3. **Implement Feature Gating:**
   - Add middleware to check plan limits
   - Implement feature restrictions based on plan
   - Add upgrade prompts for limit exceeded

4. **Add Usage Tracking:**
   - Track email/SMS/WhatsApp usage
   - Implement usage limits enforcement
   - Add usage analytics dashboard

5. **Marketing Integration:**
   - Update landing page with new pricing
   - Add pricing comparison table
   - Implement trial period for paid plans 