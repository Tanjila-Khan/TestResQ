const { stripe, plans } = require('../config/stripe');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Helper to get user from JWT
const getUserFromRequest = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error('No auth header');
  const token = authHeader.replace('Bearer ', '');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.userId);
  if (!user) throw new Error('User not found');
  return user;
};

// POST /api/subscribe/create-checkout-session
exports.createCheckoutSession = async (req, res) => {
  try {
    const { planKey } = req.body; // e.g., 'starter', 'professional', 'enterprise'
    const user = await getUserFromRequest(req);
    const plan = plans[planKey];
    
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }
    
    // Handle free plan differently (no Stripe checkout needed)
    if (planKey === 'free' || !plan.stripePriceId) {
      // Directly update user subscription for free plan
      user.subscriptionPlan = planKey;
      user.subscriptionStatus = 'active';
      await user.save();
      
      return res.json({ 
        url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?plan=free`,
        isFreePlan: true 
      });
    }
    
    // Debug: Check FRONTEND_URL
    console.log('FRONTEND_URL from env:', process.env.FRONTEND_URL);
    console.log('FRONTEND_URL type:', typeof process.env.FRONTEND_URL);
    
    // Create Stripe customer if not exists
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user._id.toString() }
      });
      stripeCustomerId = customer.id;
      user.stripeCustomerId = stripeCustomerId;
      await user.save();
    }
    
    // Create URLs with fallback
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const successUrl = `${frontendUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/pricing`;
    
    console.log('Success URL:', successUrl);
    console.log('Cancel URL:', cancelUrl);
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: user._id.toString(), plan: planKey },
      subscription_data: {
        metadata: { plan: planKey }
      }
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    if (err.message === 'No auth header') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

// POST /api/stripe/webhook
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  // Handle subscription events
  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;
        const user = await User.findOne({ stripeCustomerId });
        
        console.log('Webhook: Subscription event received:', {
          eventType: event.type,
          stripeCustomerId,
          subscriptionId: subscription.id,
          status: subscription.status,
          priceId: subscription.items.data[0]?.price?.id,
          priceNickname: subscription.items.data[0]?.price?.nickname
        });
        
        if (user) {
          // Map Stripe price ID to plan key
          const priceId = subscription.items.data[0]?.price?.id;
          let planKey = null;
          
          // Check which plan this price ID corresponds to
          for (const [key, plan] of Object.entries(plans)) {
            if (plan.stripePriceId === priceId) {
              planKey = key;
              break;
            }
          }
          
          // If we can't find the plan by price ID, try to get it from metadata
          if (!planKey && subscription.metadata && subscription.metadata.plan) {
            planKey = subscription.metadata.plan;
          }
          
          console.log('Webhook: Updating user subscription:', {
            userId: user._id,
            email: user.email,
            oldPlan: user.subscriptionPlan,
            oldStatus: user.subscriptionStatus,
            newPlan: planKey,
            newStatus: subscription.status,
            priceId: priceId
          });
          
          if (planKey) {
            user.subscriptionPlan = planKey;
            user.subscriptionStatus = subscription.status;
            await user.save();
            
            console.log('Webhook: User subscription updated successfully');
          } else {
            console.log('Webhook: Could not determine plan for price ID:', priceId);
          }
        } else {
          console.log('Webhook: No user found for stripeCustomerId:', stripeCustomerId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const stripeCustomerId = subscription.customer;
        const user = await User.findOne({ stripeCustomerId });
        if (user) {
          user.subscriptionPlan = null;
          user.subscriptionStatus = 'canceled';
          await user.save();
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handling error:', err);
    res.status(500).send('Webhook handler failed');
  }
};

// GET /api/user/subscription
exports.getSubscriptionStatus = async (req, res) => {
  try {
    // Try to get user from auth header, but don't require it
    let user = null;
    try {
      user = await getUserFromRequest(req);
      console.log('User found for subscription status:', {
        userId: user._id,
        email: user.email,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId
      });
      
      // If user has a Stripe customer ID but no subscription status, try to sync from Stripe
      if (user.stripeCustomerId && (!user.subscriptionPlan || !user.subscriptionStatus)) {
        console.log('Attempting to sync subscription from Stripe...');
        try {
          const subscriptions = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            status: 'active',
            limit: 1
          });
          
          if (subscriptions.data.length > 0) {
            const subscription = subscriptions.data[0];
            const priceId = subscription.items.data[0]?.price?.id;
            
            // Map price ID to plan key
            let planKey = null;
            for (const [key, plan] of Object.entries(plans)) {
              if (plan.stripePriceId === priceId) {
                planKey = key;
                break;
              }
            }
            
            if (planKey) {
              console.log('Syncing subscription from Stripe:', {
                oldPlan: user.subscriptionPlan,
                oldStatus: user.subscriptionStatus,
                newPlan: planKey,
                newStatus: subscription.status
              });
              
              user.subscriptionPlan = planKey;
              user.subscriptionStatus = subscription.status;
              await user.save();
              
              console.log('Subscription synced successfully');
            }
          }
        } catch (stripeError) {
          console.error('Error syncing from Stripe:', stripeError);
        }
      }
      
    } catch (err) {
      console.log('No auth header or invalid token for subscription status');
      // If no auth header or invalid token, return null subscription
      return res.json({
        plan: null,
        status: null,
        authenticated: false
      });
    }
    
    const response = {
      plan: user.subscriptionPlan,
      status: user.subscriptionStatus,
      authenticated: true
    };
    
    console.log('Subscription status response:', response);
    res.json(response);
  } catch (err) {
    console.error('Subscription status error:', err);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
};

// GET /api/subscribe/plans
exports.getPlans = (req, res) => {
  const { plans } = require('../config/stripe');
  // Remove sensitive info (like Stripe price IDs if needed)
  const safePlans = {};
  for (const [key, plan] of Object.entries(plans)) {
    safePlans[key] = {
      name: plan.name,
      price: plan.price,
      features: plan.features,
      stripePriceId: plan.stripePriceId || null,
      limits: plan.limits
    };
  }
  res.json({ plans: safePlans });
};

// POST /api/subscribe/sync
exports.syncSubscription = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    
    console.log('Syncing subscription for user:', {
      userId: user._id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId
    });
    
    if (!user.stripeCustomerId) {
      return res.json({ 
        message: 'No Stripe customer ID found',
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus
      });
    }
    
    // Get active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 1
    });
    
    if (subscriptions.data.length === 0) {
      // No active subscription found
      user.subscriptionPlan = null;
      user.subscriptionStatus = 'canceled';
      await user.save();
      
      return res.json({ 
        message: 'No active subscription found',
        plan: null,
        status: 'canceled'
      });
    }
    
    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price?.id;
    
    // Map price ID to plan key
    let planKey = null;
    for (const [key, plan] of Object.entries(plans)) {
      if (plan.stripePriceId === priceId) {
        planKey = key;
        break;
      }
    }
    
    if (planKey) {
      user.subscriptionPlan = planKey;
      user.subscriptionStatus = subscription.status;
      await user.save();
      
      console.log('Subscription synced successfully:', {
        plan: planKey,
        status: subscription.status
      });
      
      res.json({ 
        message: 'Subscription synced successfully',
        plan: planKey,
        status: subscription.status
      });
    } else {
      res.status(400).json({ 
        error: 'Unknown subscription plan',
        priceId: priceId
      });
    }
  } catch (err) {
    console.error('Subscription sync error:', err);
    res.status(500).json({ error: 'Failed to sync subscription' });
  }
};

// POST /api/subscribe/manual-update (for testing)
exports.manualUpdateSubscription = async (req, res) => {
  try {
    const { planKey } = req.body;
    const user = await getUserFromRequest(req);
    
    console.log('Manual subscription update:', {
      userId: user._id,
      email: user.email,
      currentPlan: user.subscriptionPlan,
      currentStatus: user.subscriptionStatus,
      newPlan: planKey
    });
    
    user.subscriptionPlan = planKey;
    user.subscriptionStatus = 'active';
    await user.save();
    
    console.log('Subscription updated successfully');
    res.json({ 
      message: 'Subscription updated manually',
      plan: user.subscriptionPlan,
      status: user.subscriptionStatus
    });
  } catch (err) {
    console.error('Manual subscription update error:', err);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
};

// GET /api/subscribe/check-session
exports.checkSession = async (req, res) => {
  try {
    const { session_id } = req.query;
    const user = await getUserFromRequest(req);
    
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    console.log('Checking Stripe session:', session_id);
    
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    console.log('Stripe session details:', {
      sessionId: session.id,
      customerId: session.customer,
      paymentStatus: session.payment_status,
      subscriptionId: session.subscription
    });
    
    if (session.payment_status === 'paid' && session.subscription) {
      // Get subscription details
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      
      console.log('Subscription details:', {
        subscriptionId: subscription.id,
        status: subscription.status,
        priceId: subscription.items.data[0]?.price?.id
      });
      
      // Map price ID to plan key
      const priceId = subscription.items.data[0]?.price?.id;
      let planKey = null;
      
      for (const [key, plan] of Object.entries(plans)) {
        if (plan.stripePriceId === priceId) {
          planKey = key;
          break;
        }
      }
      
      if (planKey) {
        user.subscriptionPlan = planKey;
        user.subscriptionStatus = subscription.status;
        await user.save();
        
        console.log('User subscription updated from session check:', {
          userId: user._id,
          email: user.email,
          plan: user.subscriptionPlan,
          status: user.subscriptionStatus
        });
        
        res.json({ 
          success: true,
          plan: user.subscriptionPlan,
          status: user.subscriptionStatus
        });
      } else {
        res.status(400).json({ error: 'Unknown subscription plan' });
      }
    } else {
      res.status(400).json({ error: 'Payment not completed' });
    }
  } catch (err) {
    console.error('Session check error:', err);
    res.status(500).json({ error: 'Failed to check session' });
  }
}; 