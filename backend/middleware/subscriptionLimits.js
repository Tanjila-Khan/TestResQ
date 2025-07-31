const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { plans } = require('../config/stripe');

// Get user's subscription details
const getUserSubscription = async (userId) => {
  try {
    // First check User model
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Then check Subscription collection
    let subscription = await Subscription.findOne({ user: userId });
    
    // If no subscription in Subscription collection, create one based on User model
    if (!subscription && user.subscriptionPlan) {
      subscription = new Subscription({
        user: userId,
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus || 'active',
        stripeCustomerId: user.stripeCustomerId || `free_${userId}`,
        stripeSubscriptionId: `free_${userId}`,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        amount: 0,
        features: plans[user.subscriptionPlan]?.limits || plans.free.limits
      });
      await subscription.save();
    }

    // If still no subscription, create free plan
    if (!subscription) {
      subscription = new Subscription({
        user: userId,
        plan: 'free',
        status: 'active',
        stripeCustomerId: `free_${userId}`,
        stripeSubscriptionId: `free_${userId}`,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        amount: 0,
        features: plans.free.limits
      });
      await subscription.save();
    }

    return subscription;
  } catch (error) {
    console.error('Error getting user subscription:', error);
    throw error;
  }
};

// Check if user can perform action based on plan limits
const canPerformAction = (subscription, action, currentUsage = 0) => {
  const plan = plans[subscription.plan];
  if (!plan) {
    console.error('Plan not found:', subscription.plan);
    return false;
  }

  const limits = plan.limits;
  
  switch(action) {
    case 'addStore':
      return limits.maxStores === -1 || currentUsage < limits.maxStores;
    case 'sendEmail':
      return limits.maxEmailsPerMonth === -1 || currentUsage < limits.maxEmailsPerMonth;
    case 'sendSms':
      return limits.maxSmsPerMonth > 0 && (limits.maxSmsPerMonth === -1 || currentUsage < limits.maxSmsPerMonth);
    case 'sendWhatsapp':
      return limits.maxWhatsappPerMonth > 0 && (limits.maxWhatsappPerMonth === -1 || currentUsage < limits.maxWhatsappPerMonth);
    case 'useAdvancedAnalytics':
      return limits.advancedAnalytics;
    case 'useAutomatedSms':
      return limits.automatedSms;
    case 'useAutomatedWhatsapp':
      return limits.automatedWhatsapp;
    case 'useMultiStoreDashboard':
      return limits.multiStoreDashboard;
    case 'useRoiTracking':
      return limits.roiTracking;
    case 'useExportAnalytics':
      return limits.exportAnalytics;
    case 'useCustomerSegmentation':
      return limits.customerSegmentation;
    case 'useScheduledCampaigns':
      return limits.scheduledCampaigns;
    case 'useRealTimeNotifications':
      return limits.realTimeNotifications;
    default:
      return false;
  }
};

// Middleware to check subscription status
const requireActiveSubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const subscription = await getUserSubscription(userId);
    
    if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
      return res.status(403).json({ 
        error: 'Active subscription required',
        message: 'Please upgrade your plan to access this feature',
        upgradeUrl: '/pricing'
      });
    }
    
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('Subscription middleware error:', error);
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
};

// Middleware to check specific feature access
const requireFeature = (feature) => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;
      const subscription = await getUserSubscription(userId);
      
      if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
        return res.status(403).json({ 
          error: 'Active subscription required',
          message: 'Please upgrade your plan to access this feature',
          upgradeUrl: '/pricing'
        });
      }
      
      if (!canPerformAction(subscription, feature)) {
        const plan = plans[subscription.plan];
        const nextPlan = getNextPlan(subscription.plan);
        
        return res.status(403).json({ 
          error: 'Feature not available in current plan',
          message: `This feature is available in the ${nextPlan.name} plan and above`,
          currentPlan: plan.name,
          nextPlan: nextPlan.name,
          upgradeUrl: '/pricing'
        });
      }
      
      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('Feature middleware error:', error);
      res.status(500).json({ error: 'Failed to verify feature access' });
    }
  };
};

// Middleware to check usage limits
const checkUsageLimit = (action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;
      const subscription = await getUserSubscription(userId);
      
      if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
        return res.status(403).json({ 
          error: 'Active subscription required',
          message: 'Please upgrade your plan to access this feature',
          upgradeUrl: '/pricing'
        });
      }
      
      // Get current usage (this would need to be implemented based on your usage tracking)
      const currentUsage = await getCurrentUsage(userId, action);
      
      if (!canPerformAction(subscription, action, currentUsage)) {
        const plan = plans[subscription.plan];
        const nextPlan = getNextPlan(subscription.plan);
        
        return res.status(403).json({ 
          error: 'Usage limit exceeded',
          message: `You've reached your ${action} limit for this plan. Upgrade to ${nextPlan.name} for higher limits.`,
          currentUsage,
          limit: plan.limits[`max${action.charAt(0).toUpperCase() + action.slice(1)}PerMonth`],
          currentPlan: plan.name,
          nextPlan: nextPlan.name,
          upgradeUrl: '/pricing'
        });
      }
      
      req.subscription = subscription;
      req.currentUsage = currentUsage;
      next();
    } catch (error) {
      console.error('Usage limit middleware error:', error);
      res.status(500).json({ error: 'Failed to check usage limits' });
    }
  };
};

// Helper function to get next plan
const getNextPlan = (currentPlan) => {
  const planOrder = ['free', 'starter', 'growth'];
  const currentIndex = planOrder.indexOf(currentPlan);
  
  if (currentIndex === -1 || currentIndex === planOrder.length - 1) {
    return plans.growth; // Already at highest plan
  }
  
  const nextPlanKey = planOrder[currentIndex + 1];
  return plans[nextPlanKey];
};

// Helper function to get current usage (placeholder - implement based on your usage tracking)
const getCurrentUsage = async (userId, action) => {
  // This is a placeholder. You would implement this based on your usage tracking system
  // For example, count emails sent this month, SMS sent this month, etc.
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  switch(action) {
    case 'sendEmail':
      // Count emails sent this month
      // return await SentEmail.countDocuments({ userId, sentAt: { $gte: startOfMonth } });
      return 0; // Placeholder
    case 'sendSms':
      // Count SMS sent this month
      // return await SmsLog.countDocuments({ userId, sentAt: { $gte: startOfMonth } });
      return 0; // Placeholder
    case 'sendWhatsapp':
      // Count WhatsApp messages sent this month
      // return await WhatsAppLog.countDocuments({ userId, sentAt: { $gte: startOfMonth } });
      return 0; // Placeholder
    case 'addStore':
      // Count active store connections
      // return await StoreConnection.countDocuments({ userId, isActive: true });
      return 0; // Placeholder
    default:
      return 0;
  }
};

// Export middleware functions
module.exports = {
  requireActiveSubscription,
  requireFeature,
  checkUsageLimit,
  getUserSubscription,
  canPerformAction,
  getNextPlan
}; 