const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    enum: ['free', 'starter', 'professional', 'enterprise'],
    default: 'free'
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'unpaid', 'trialing'],
    default: 'active'
  },
  stripeCustomerId: {
    type: String,
    required: true
  },
  stripeSubscriptionId: {
    type: String,
    required: true
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  canceledAt: {
    type: Date
  },
  trialStart: {
    type: Date
  },
  trialEnd: {
    type: Date
  },
  features: {
    maxStores: {
      type: Number,
      default: 1
    },
    maxEmailsPerMonth: {
      type: Number,
      default: 100
    },
    maxSmsPerMonth: {
      type: Number,
      default: 50
    },
    maxWhatsappPerMonth: {
      type: Number,
      default: 50
    },
    advancedAnalytics: {
      type: Boolean,
      default: false
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    customBranding: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: false
    }
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd'
  },
  nextBillingDate: {
    type: Date
  },
  lastPaymentDate: {
    type: Date
  },
  paymentMethod: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better query performance
subscriptionSchema.index({ user: 1 });
subscriptionSchema.index({ stripeCustomerId: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });

// Virtual for checking if subscription is active
subscriptionSchema.virtual('isActive').get(function() {
  return this.status === 'active' || this.status === 'trialing';
});

// Virtual for checking if subscription is in trial
subscriptionSchema.virtual('isTrial').get(function() {
  return this.status === 'trialing';
});

// Method to get plan limits
subscriptionSchema.methods.getPlanLimits = function() {
  const planLimits = {
    free: {
      maxStores: 1,
      maxEmailsPerMonth: 100,
      maxSmsPerMonth: 50,
      maxWhatsappPerMonth: 50,
      advancedAnalytics: false,
      prioritySupport: false,
      customBranding: false,
      apiAccess: false
    },
    starter: {
      maxStores: 3,
      maxEmailsPerMonth: 1000,
      maxSmsPerMonth: 500,
      maxWhatsappPerMonth: 500,
      advancedAnalytics: false,
      prioritySupport: false,
      customBranding: false,
      apiAccess: false
    },
    professional: {
      maxStores: 10,
      maxEmailsPerMonth: 10000,
      maxSmsPerMonth: 5000,
      maxWhatsappPerMonth: 5000,
      advancedAnalytics: true,
      prioritySupport: false,
      customBranding: true,
      apiAccess: true
    },
    enterprise: {
      maxStores: -1, // unlimited
      maxEmailsPerMonth: -1, // unlimited
      maxSmsPerMonth: -1, // unlimited
      maxWhatsappPerMonth: -1, // unlimited
      advancedAnalytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: true
    }
  };
  
  return planLimits[this.plan] || planLimits.free;
};

// Method to check if user can perform action based on limits
subscriptionSchema.methods.canPerformAction = function(action, currentUsage = 0) {
  const limits = this.getPlanLimits();
  
  switch(action) {
    case 'addStore':
      return limits.maxStores === -1 || currentUsage < limits.maxStores;
    case 'sendEmail':
      return limits.maxEmailsPerMonth === -1 || currentUsage < limits.maxEmailsPerMonth;
    case 'sendSms':
      return limits.maxSmsPerMonth === -1 || currentUsage < limits.maxSmsPerMonth;
    case 'sendWhatsapp':
      return limits.maxWhatsappPerMonth === -1 || currentUsage < limits.maxWhatsappPerMonth;
    case 'useAdvancedAnalytics':
      return limits.advancedAnalytics;
    case 'useCustomBranding':
      return limits.customBranding;
    case 'useApiAccess':
      return limits.apiAccess;
    default:
      return false;
  }
};

module.exports = mongoose.model('Subscription', subscriptionSchema); 