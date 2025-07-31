const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['woocommerce', 'shopify']
  },
  customer_id: {
    type: String,
    required: true
  },
  customer_email: {
    type: String,
    required: true
  },
  first_name: String,
  last_name: String,
  phone: String,
  address: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  company: String,
  is_registered: {
    type: Boolean,
    default: false
  },
  last_login: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for platform and customer_id
customerSchema.index({ platform: 1, customer_id: 1 }, { unique: true });
// Create index for customer_email
customerSchema.index({ customer_email: 1 });

module.exports = mongoose.model('Customer', customerSchema); 