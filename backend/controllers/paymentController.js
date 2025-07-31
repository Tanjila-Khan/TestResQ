const { stripe, plans } = require('../config/stripe');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const User = require('../models/User');

// Create a customer portal session
exports.createCustomerPortalSession = async (req, res) => {
  try {
    const user = req.user;
    
    // Get user's subscription
    const subscription = await Subscription.findOne({ user: user._id });
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard/billing`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    res.status(500).json({ error: 'Failed to create customer portal session' });
  }
};

// Create a checkout session for subscription
exports.createCheckoutSession = async (req, res) => {
  try {
    const { plan, billingCycle = 'monthly' } = req.body;
    const user = req.user;

    if (!plans[plan]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    if (plan === 'free') {
      return res.status(400).json({ error: 'Free plan does not require payment' });
    }

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.findOne({ 
      user: user._id, 
      status: { $in: ['active', 'trialing'] } 
    });

    if (existingSubscription && existingSubscription.plan !== 'free') {
      return res.status(400).json({ error: 'User already has an active subscription' });
    }

    // Create or get Stripe customer
    let stripeCustomerId;
    if (existingSubscription && existingSubscription.stripeCustomerId) {
      stripeCustomerId = existingSubscription.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user._id.toString()
        }
      });
      stripeCustomerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plans[plan].stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      metadata: {
        userId: user._id.toString(),
        plan: plan,
        billingCycle: billingCycle
      },
      subscription_data: {
        metadata: {
          userId: user._id.toString(),
          plan: plan
        }
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

// Get user's subscription details
exports.getSubscription = async (req, res) => {
  try {
    const user = req.user;
    
    let subscription = await Subscription.findOne({ user: user._id });
    
    if (!subscription) {
      // Create free subscription for new users
      subscription = new Subscription({
        user: user._id,
        plan: 'free',
        status: 'active',
        stripeCustomerId: `free_${user._id}`,
        stripeSubscriptionId: `free_${user._id}`,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        amount: 0,
        features: plans.free.limits
      });
      await subscription.save();
    }

    const planDetails = plans[subscription.plan];
    
    res.json({
      subscription: {
        ...subscription.toObject(),
        planDetails,
        isActive: subscription.isActive,
        isTrial: subscription.isTrial
      }
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
};

// Get all available plans
exports.getPlans = async (req, res) => {
  try {
    res.json({ plans });
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const user = req.user;
    
    const subscription = await Subscription.findOne({ user: user._id });
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    if (subscription.plan === 'free') {
      return res.status(400).json({ error: 'Free plan cannot be canceled' });
    }

    // Cancel at period end
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    subscription.cancelAtPeriodEnd = true;
    subscription.canceledAt = new Date();
    await subscription.save();

    res.json({ message: 'Subscription will be canceled at the end of the current period' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

// Reactivate subscription
exports.reactivateSubscription = async (req, res) => {
  try {
    const user = req.user;
    
    const subscription = await Subscription.findOne({ user: user._id });
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    if (subscription.plan === 'free') {
      return res.status(400).json({ error: 'Free plan cannot be reactivated' });
    }

    // Reactivate subscription
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    subscription.cancelAtPeriodEnd = false;
    subscription.canceledAt = null;
    await subscription.save();

    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
};

// Get payment history
exports.getPaymentHistory = async (req, res) => {
  try {
    const user = req.user;
    const { page = 1, limit = 10 } = req.query;
    
    const payments = await Payment.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('subscription', 'plan status');

    const total = await Payment.countDocuments({ user: user._id });

    res.json({
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting payment history:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
};

// Handle Stripe webhooks
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
};

// Webhook handlers
async function handleSubscriptionCreated(subscription) {
  try {
    const userId = subscription.metadata.userId;
    const plan = subscription.metadata.plan;
    
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found for subscription:', subscription.id);
      return;
    }

    // Update or create subscription
    await Subscription.findOneAndUpdate(
      { user: userId },
      {
        user: userId,
        plan: plan,
        status: subscription.status,
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        amount: subscription.items.data[0].price.unit_amount,
        currency: subscription.currency,
        features: plans[plan].limits
      },
      { upsert: true, new: true }
    );

    console.log(`Subscription created for user ${userId}: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    const userId = subscription.metadata.userId;
    
    await Subscription.findOneAndUpdate(
      { user: userId },
      {
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null
      }
    );

    console.log(`Subscription updated for user ${userId}: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    const userId = subscription.metadata.userId;
    
    await Subscription.findOneAndUpdate(
      { user: userId },
      {
        status: 'canceled',
        canceledAt: new Date()
      }
    );

    console.log(`Subscription deleted for user ${userId}: ${subscription.id}`);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  try {
    const subscription = await Subscription.findOne({ 
      stripeSubscriptionId: invoice.subscription 
    });
    
    if (!subscription) {
      console.error('Subscription not found for invoice:', invoice.id);
      return;
    }

    // Create payment record
    await Payment.create({
      user: subscription.user,
      subscription: subscription._id,
      stripePaymentIntentId: invoice.payment_intent,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'succeeded',
      description: `Payment for ${invoice.lines.data[0].description}`,
      metadata: {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription
      }
    });

    // Update subscription
    subscription.lastPaymentDate = new Date();
    subscription.nextBillingDate = new Date(invoice.next_payment_attempt * 1000);
    await subscription.save();

    console.log(`Payment succeeded for subscription: ${invoice.subscription}`);
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(invoice) {
  try {
    const subscription = await Subscription.findOne({ 
      stripeSubscriptionId: invoice.subscription 
    });
    
    if (!subscription) {
      console.error('Subscription not found for invoice:', invoice.id);
      return;
    }

    // Create payment record
    await Payment.create({
      user: subscription.user,
      subscription: subscription._id,
      stripePaymentIntentId: invoice.payment_intent,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
      description: `Failed payment for ${invoice.lines.data[0].description}`,
      failureReason: invoice.last_finalization_error?.message || 'Payment failed',
      metadata: {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription
      }
    });

    console.log(`Payment failed for subscription: ${invoice.subscription}`);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
} 