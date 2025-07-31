const mongoose = require('mongoose');

const storeConnectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['woocommerce', 'shopify']
  },
  store_url: {
    type: String,
    required: true
  },
  consumer_key: {
    type: String,
    required: function() {
      return this.platform === 'woocommerce';
    }
  },
  consumer_secret: {
    type: String,
    required: function() {
      return this.platform === 'woocommerce';
    }
  },
  access_token: {
    type: String,
    required: function() {
      return this.platform === 'shopify';
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for userId, platform and store_url
storeConnectionSchema.index({ userId: 1, platform: 1, store_url: 1 }, { unique: true });
// Create index for userId for quick user-specific queries
storeConnectionSchema.index({ userId: 1 });
// Create index for store_url
storeConnectionSchema.index({ store_url: 1 });

// Update the updatedAt timestamp before saving
storeConnectionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('StoreConnection', storeConnectionSchema); 