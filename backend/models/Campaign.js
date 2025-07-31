const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['email', 'sms', 'push', 'coupon'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled', 'sent'],
    default: 'draft'
  },
  platform: {
    type: String,
    enum: ['woocommerce', 'shopify', 'magento'],
    required: true
  },
  storeId: {
    type: String,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  targetAudience: {
    type: {
      type: String,
      enum: ['all', 'abandoned_carts', 'specific_customers', 'customer_groups'],
      required: true
    },
    filters: {
      minCartValue: Number,
      maxCartValue: Number,
      minAbandonTime: Number, // in hours
      maxAbandonTime: Number, // in hours
      lastPurchaseDays: Number,
      customerGroups: [String],
      customerEmails: [String]
    }
    },
  schedule: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: Date,
    timezone: {
      type: String,
      default: 'UTC'
    },
    frequency: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'monthly'],
      default: 'once'
    },
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6
    }],
    timeOfDay: {
      type: String,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    }
  },
  content: {
    subject: String,
    body: String,
    template: String,
    couponCode: String,
    couponType: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    couponAmount: Number,
    couponMinSpend: Number,
    couponMaxDiscount: Number,
    couponExpiryDays: Number
  },
  recipients: [{
    customerId: String,
    email: String,
    name: String,
    sentAt: Date,
    opened: {
      type: Boolean,
      default: false
    },
    openedAt: Date,
    clicked: {
      type: Boolean,
      default: false
    },
    clickedAt: Date,
    converted: {
      type: Boolean,
      default: false
    },
    convertedAt: Date,
    conversionValue: Number,
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'bounced', 'unsubscribed'],
      default: 'pending'
    },
    error: String
  }],
  stats: {
    totalRecipients: {
      type: Number,
      default: 0
    },
    totalSent: {
      type: Number,
      default: 0
    },
    totalOpens: {
      type: Number,
      default: 0
    },
    totalClicks: {
      type: Number,
      default: 0
    },
    totalConversions: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Additional fields for compatibility
  sentAt: Date,
  totalRecipients: {
    type: Number,
    default: 0
  },
  sentCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
campaignSchema.index({ platform: 1, storeId: 1, status: 1 });
campaignSchema.index({ 'schedule.startDate': 1, status: 1 });
campaignSchema.index({ createdBy: 1, status: 1 });

// Method to check if campaign is active
campaignSchema.methods.isActiveCampaign = function() {
  const now = new Date();
  return (
    this.status === 'active' &&
    this.isActive &&
    this.schedule.startDate <= now &&
    (!this.schedule.endDate || this.schedule.endDate >= now)
  );
};

// Method to get campaign performance
campaignSchema.methods.getPerformance = function(period = '7d') {
  const now = new Date();
  let startDate;
  switch (period) {
    case '24h':
      startDate = new Date(now - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
  }

  return this.recipients
    .filter(r => r.sentAt >= startDate)
    .reduce((acc, recipient) => {
      const date = recipient.sentAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          sent: 0,
          opens: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0
        };
      }
      acc[date].sent++;
      if (recipient.opened) acc[date].opens++;
      if (recipient.clicked) acc[date].clicks++;
      if (recipient.converted) {
        acc[date].conversions++;
        acc[date].revenue += recipient.conversionValue || 0;
      }
      return acc;
    }, {});
};

// Method to update campaign stats
campaignSchema.methods.updateStats = function() {
  this.stats = {
    totalRecipients: this.recipients.length,
    totalSent: this.recipients.filter(r => r.status === 'sent').length,
    totalOpens: this.recipients.filter(r => r.opened).length,
    totalClicks: this.recipients.filter(r => r.clicked).length,
    totalConversions: this.recipients.filter(r => r.converted).length,
    totalRevenue: this.recipients.reduce((sum, r) => sum + (r.conversionValue || 0), 0)
  };
  return this.save();
};

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign; 