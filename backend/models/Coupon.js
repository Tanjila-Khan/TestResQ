const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[A-Z0-9-]+$/.test(v);
      },
      message: 'Coupon code can only contain uppercase letters, numbers, and hyphens'
    }
  },
  type: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  amount: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) {
        if (this.type === 'percentage') {
          return v >= 1 && v <= 100;
        }
        return v > 0;
      },
      message: props => {
        if (props.value === undefined) return 'Amount is required';
        if (this.type === 'percentage') {
          return 'Percentage must be between 1 and 100';
        }
        return 'Fixed amount must be greater than 0';
      }
    }
  },
  minSpend: {
    type: Number,
    default: 0,
    validate: {
      validator: function(v) {
        return v >= 0;
      },
      message: 'Minimum spend must be greater than or equal to 0'
    }
  },
  maxDiscount: {
    type: Number,
    default: null,
    validate: {
      validator: function(v) {
        return v === null || v > 0;
      },
      message: 'Maximum discount must be greater than 0'
    }
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  usageLimit: {
    type: Number,
    default: null,
    validate: {
      validator: function(v) {
        return v === null || v > 0;
      },
      message: 'Usage limit must be greater than 0'
    }
  },
  usageCount: {
    type: Number,
    default: 0,
    validate: {
      validator: function(v) {
        return v >= 0;
      },
      message: 'Usage count cannot be negative'
    }
  },
  customerEmails: [{
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email address'
    }
  }],
  customerGroups: [{
    type: String,
    enum: ['abandoned_cart', 'vip', 'new_customer']
  }],
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['woocommerce', 'shopify', 'magento']
  },
  storeId: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  abandonedCartId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AbandonedCart',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
couponSchema.index({ code: 1, platform: 1, storeId: 1 }, { unique: true });
couponSchema.index({ platform: 1, storeId: 1, isActive: 1 });
couponSchema.index({ customerEmails: 1 });
couponSchema.index({ customerGroups: 1 });
couponSchema.index({ startDate: 1, endDate: 1 });

// Method to check if coupon is valid
couponSchema.methods.isValid = function() {
  const now = new Date();
  return (
    this.isActive &&
    now >= this.startDate &&
    now <= this.endDate &&
    (this.usageLimit === null || this.usageCount < this.usageLimit)
  );
};

// Method to check if coupon is applicable to a customer
couponSchema.methods.isApplicableToCustomer = function(customerEmail, customerGroups = []) {
  if (!this.isValid()) return false;
  
  // If no specific customers or groups are set, coupon is available to all
  if (this.customerEmails.length === 0 && this.customerGroups.length === 0) {
    return true;
  }

  // Check if customer email is in the allowed list
  if (this.customerEmails.length > 0 && customerEmail) {
    if (this.customerEmails.includes(customerEmail.toLowerCase())) {
      return true;
    }
  }

  // Check if customer belongs to any of the allowed groups
  if (this.customerGroups.length > 0 && customerGroups.length > 0) {
    return customerGroups.some(group => this.customerGroups.includes(group));
  }

  return false;
};

// Method to calculate discount amount
couponSchema.methods.calculateDiscount = function(subtotal) {
  if (!this.isValid() || subtotal < this.minSpend) {
    return 0;
  }

  let discount = 0;
  if (this.type === 'percentage') {
    discount = (subtotal * this.amount) / 100;
  } else {
    discount = this.amount;
  }

  // Apply maximum discount limit if set
  if (this.maxDiscount !== null) {
    discount = Math.min(discount, this.maxDiscount);
  }

  return Math.min(discount, subtotal); // Ensure discount doesn't exceed subtotal
};

// Static method to find valid coupons for a customer
couponSchema.statics.findValidCoupons = async function(customerEmail, customerGroups, platform, storeId) {
  const now = new Date();
  return this.find({
    platform,
    storeId,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { customerEmails: customerEmail?.toLowerCase() },
      { customerGroups: { $in: customerGroups } },
      { customerEmails: { $size: 0 }, customerGroups: { $size: 0 } }
    ],
    $or: [
      { usageLimit: null },
      { usageCount: { $lt: '$usageLimit' } }
    ]
  });
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon; 