# Payment Gateway Setup Guide for CartResQ SaaS

This guide will help you set up the payment gateway integration for your CartResQ SaaS platform using Stripe.

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. Node.js and npm installed
3. MongoDB database running

## Step 1: Install Dependencies

### Backend Dependencies
```bash
cd backend
npm install stripe
```

### Frontend Dependencies
```bash
cd frontend
npm install @stripe/stripe-js @stripe/react-stripe-js
```

## Step 2: Stripe Configuration

### 1. Get Your Stripe Keys
1. Log in to your Stripe Dashboard
2. Go to Developers > API keys
3. Copy your **Publishable key** and **Secret key**

### 2. Create Product and Price IDs
1. In Stripe Dashboard, go to Products
2. Create three products:
   - **Starter Plan** ($29/month)
   - **Professional Plan** ($99/month)
   - **Enterprise Plan** ($299/month)
3. For each product, create a recurring price (monthly billing)
4. Copy the Price IDs for each plan

### 3. Set Up Webhook
1. In Stripe Dashboard, go to Developers > Webhooks
2. Click "Add endpoint"
3. Set the endpoint URL to: `https://your-domain.com/api/payments/webhook`
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret

## Step 3: Environment Variables

Add these environment variables to your backend `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_STARTER_PRICE_ID=price_your_starter_price_id
STRIPE_PROFESSIONAL_PRICE_ID=price_your_professional_price_id
STRIPE_ENTERPRISE_PRICE_ID=price_your_enterprise_price_id

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:3000
```

Add this to your frontend `.env` file:

```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
```

## Step 4: Database Setup

The payment system will automatically create the necessary collections:
- `subscriptions` - User subscription data
- `payments` - Payment transaction history

## Step 5: Testing the Integration

### 1. Test Cards
Use these Stripe test cards:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Authentication**: `4000 0025 0000 3155`

### 2. Test the Flow
1. Start your backend server: `npm run dev`
2. Start your frontend: `npm start`
3. Register a new account
4. Go to `/pricing` to see the plans
5. Select a plan and complete the checkout
6. Check your Stripe Dashboard for the subscription

## Step 6: Production Deployment

### 1. Update Environment Variables
- Use production Stripe keys (switch from `sk_test_` to `sk_live_`)
- Update webhook endpoint to your production domain
- Update `FRONTEND_URL` to your production frontend URL

### 2. Webhook Configuration
- Update webhook endpoint in Stripe Dashboard
- Ensure your server can receive webhook requests
- Test webhook delivery in Stripe Dashboard

### 3. SSL Certificate
- Ensure your domain has a valid SSL certificate
- Stripe requires HTTPS for webhook endpoints

## Features Included

### Backend Features
- ✅ Subscription management
- ✅ Payment processing
- ✅ Webhook handling
- ✅ Plan limits enforcement
- ✅ Payment history tracking
- ✅ Customer portal integration

### Frontend Features
- ✅ Pricing page with plan comparison
- ✅ Stripe Checkout integration
- ✅ Subscription management dashboard
- ✅ Payment history viewer
- ✅ Billing portal access

### Plan Tiers
- **Free**: 1 store, 100 emails/month, basic features
- **Starter**: 3 stores, 1,000 emails/month, $29/month
- **Professional**: 10 stores, 10,000 emails/month, $99/month
- **Enterprise**: Unlimited, all features, $299/month

## Security Considerations

1. **Never expose secret keys** in frontend code
2. **Always verify webhook signatures** using the webhook secret
3. **Use HTTPS** in production
4. **Implement proper authentication** for all payment endpoints
5. **Validate all input data** before processing payments

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**
   - Check webhook endpoint URL
   - Verify webhook secret
   - Check server logs for errors

2. **Payment fails**
   - Verify Stripe keys are correct
   - Check if using test cards in production
   - Review Stripe Dashboard for error details

3. **Subscription not created**
   - Check webhook events in Stripe Dashboard
   - Verify database connection
   - Review server logs

### Support

For issues related to:
- **Stripe**: Contact Stripe Support
- **CartResQ Integration**: Check the logs and verify configuration

## Next Steps

1. **Customize Plans**: Modify plan features and pricing in `backend/config/stripe.js`
2. **Add Usage Tracking**: Implement usage tracking for emails, SMS, etc.
3. **Add Analytics**: Track subscription metrics and revenue
4. **Implement Dunning**: Handle failed payments and retry logic
5. **Add Coupons**: Implement discount codes and promotional pricing

## Files Modified/Created

### Backend
- `models/Subscription.js` - Subscription data model
- `models/Payment.js` - Payment transaction model
- `config/stripe.js` - Stripe configuration and plans
- `controllers/paymentController.js` - Payment logic
- `routes/paymentRoutes.js` - Payment API routes
- `middleware/subscription.js` - Plan limit enforcement
- `app.js` - Added payment routes

### Frontend
- `components/pricing/Pricing.js` - Pricing page
- `components/pricing/CheckoutForm.js` - Checkout form
- `components/billing/Billing.js` - Subscription management
- `components/billing/PaymentHistory.js` - Payment history

The payment gateway is now fully integrated and ready to monetize your CartResQ platform! 