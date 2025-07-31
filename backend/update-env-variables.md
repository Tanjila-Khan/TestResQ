# Environment Variables Update Guide

## Current vs New Plan Structure

### Old Structure (what you have):
```
STRIPE_STARTER_PRICE_ID=pr_...
STRIPE_PROFESSIONAL_PRICE_ID=pr_...
STRIPE_ENTERPRISE_PRICE_ID=pr_...
```

### New Structure (what you need):
```
STRIPE_STARTER_PRICE_ID=pr_... (keep this one)
STRIPE_GROWTH_PRICE_ID=pr_... (new - replace ENTERPRISE)
```

## What to Change:

1. **Keep these as they are:**
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whse_...
   STRIPE_STARTER_PRICE_ID=pr_... (this is correct)
   ```

2. **Replace this:**
   ```
   STRIPE_ENTERPRISE_PRICE_ID=pr_...
   ```
   
   **With this:**
   ```
   STRIPE_GROWTH_PRICE_ID=pr_...
   ```

3. **Remove this (no longer needed):**
   ```
   STRIPE_PROFESSIONAL_PRICE_ID=pr_...
   ```

## Updated .env file should look like:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whse_...
STRIPE_STARTER_PRICE_ID=pr_...
STRIPE_GROWTH_PRICE_ID=pr_... (use the value from ENTERPRISE_PRICE_ID)
```

## Why this change?

- **Starter plan** ($19/month) - stays the same
- **Growth plan** ($49/month) - replaces the old Enterprise plan
- **Free plan** - no Stripe price ID needed

The Growth plan includes all the features that were previously in the Enterprise plan:
- Unlimited emails
- Automated SMS/WhatsApp
- Multi-store dashboard
- ROI tracking
- Export analytics
- Premium support

## After updating:

1. Restart your backend server
2. Run the test script again: `node test-subscription-tiers.js`
3. All environment variables should show ✅ 