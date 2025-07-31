const mongoose = require('mongoose');

const abandonedCartSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['woocommerce', 'shopify']
  },
  cart_id: {
    type: String,
    required: true
  },
  customer_id: String,
  customer_email: {
    type: String,
    required: true
  },
  customer_phone: {
    type: String,
    default: null
  },
  customer_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  items: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    required: true
  },
  shipping: {
    type: Number,
    required: true
  },
  // --- SMS Integration Fields ---
  sms_status: {
    type: String,
    enum: ['pending', 'sending', 'sent', 'failed', 'delivered'],
    default: 'pending'
  },
  sms_attempts: {
    type: Number,
    default: 0
  },
  sms_sent_at: {
    type: Date,
    default: null
  },
  last_sms_sid: {
    type: String,
    default: null
  },
  sms_delivered_at: {
    type: Date,
    default: null
  },
  last_sms_error: {
    type: String,
    default: null
  },
  // --- WhatsApp Integration Fields ---
  whatsapp_status: {
    type: String,
    enum: ['pending', 'sending', 'sent', 'failed', 'delivered'],
    default: 'pending'
  },
  whatsapp_attempts: {
    type: Number,
    default: 0
  },
  whatsapp_sent_at: {
    type: Date,
    default: null
  },
  last_whatsapp_sid: {
    type: String,
    default: null
  },
  whatsapp_delivered_at: {
    type: Date,
    default: null
  },
  last_whatsapp_error: {
    type: String,
    default: null
  },
  whatsapp_opt_out: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'abandoned', 'converted'],
    default: 'active'
  },
  source: String,
  device_type: String,
  browser_info: String,
  last_activity: {
    type: Date,
    default: Date.now
  },
  timestamp: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Create compound index for platform and cart_id
abandonedCartSchema.index({ platform: 1, cart_id: 1 }, { unique: true });
// Create indexes for common queries
abandonedCartSchema.index({ platform: 1, status: 1 });
abandonedCartSchema.index({ customer_email: 1 });
abandonedCartSchema.index({ last_activity: -1 });

// Fix: Only define the model if it hasn't been defined already
module.exports = mongoose.models.AbandonedCart || mongoose.model('AbandonedCart', abandonedCartSchema); 