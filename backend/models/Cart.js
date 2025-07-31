const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
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
  customer_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  items: [{
    product_id: String,
    name: String,
    product_name: String,
    image_url: String,
    variant_title: String,
    quantity: Number,
    price: Number,
    total: Number,
    properties: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
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
    default: 0
  },
  shipping: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'abandoned', 'recovered'],
    default: 'active'
  },
  source: String,
  device_type: String,
  browser_info: String,
  last_activity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for platform and cart_id
cartSchema.index({ platform: 1, cart_id: 1 }, { unique: true });
// Create indexes for common queries
cartSchema.index({ platform: 1, status: 1 });
cartSchema.index({ customer_email: 1 });
cartSchema.index({ last_activity: -1 });

module.exports = mongoose.model('Cart', cartSchema); 