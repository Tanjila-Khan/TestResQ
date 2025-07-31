const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  stripePaymentIntentId: {
    type: String,
    required: true
  },
  stripeInvoiceId: {
    type: String
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd'
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'canceled', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: mongoose.Schema.Types.Mixed
  },
  billingDetails: {
    name: String,
    email: String,
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postal_code: String,
      country: String
    }
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  failureReason: {
    type: String
  },
  refundedAt: {
    type: Date
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  refundReason: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
paymentSchema.index({ user: 1 });
paymentSchema.index({ subscription: 1 });
paymentSchema.index({ stripePaymentIntentId: 1 });
paymentSchema.index({ stripeInvoiceId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency.toUpperCase()
  }).format(this.amount / 100);
});

// Method to check if payment is successful
paymentSchema.methods.isSuccessful = function() {
  return this.status === 'succeeded';
};

// Method to check if payment is refunded
paymentSchema.methods.isRefunded = function() {
  return this.status === 'refunded';
};

// Method to get refund amount in formatted currency
paymentSchema.methods.getFormattedRefundAmount = function() {
  if (this.refundAmount > 0) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency.toUpperCase()
    }).format(this.refundAmount / 100);
  }
  return null;
};

module.exports = mongoose.model('Payment', paymentSchema); 