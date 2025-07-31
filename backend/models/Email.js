const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['woocommerce', 'shopify']
  },
  to: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  html: {
    type: String,
    required: true
  },
  messageId: String,
  status: {
    type: String,
    enum: ['sent', 'delivered', 'opened', 'clicked', 'failed'],
    default: 'sent'
  },
  sentAt: {
    type: Date,
    required: false
  },
  campaign_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  cart_id: {
    type: String,
    required: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Create indexes for common queries
emailSchema.index({ platform: 1, createdAt: -1 });
emailSchema.index({ to: 1 });
emailSchema.index({ status: 1 });

emailSchema.index({ campaign_id: 1 });
emailSchema.index({ cart_id: 1 });

module.exports = mongoose.model('Email', emailSchema); 