const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['woocommerce', 'shopify']
  },
  type: {
    type: String,
    required: true,
    enum: [
      'cart_abandoned',
      'cart_recovered',
      'sms_sent',
      'email_sent',
      'whatsapp_sent',
      'campaign_created',
      'campaign_completed',
      'test',
      'connection_test'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Zone/Location information
  zone: {
    country: String,
    region: String,
    city: String,
    timezone: String,
    ip: String
  },
  read: {
    type: Boolean,
    default: false
  },
  deleted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient querying
notificationSchema.index({ platform: 1, createdAt: -1 });
notificationSchema.index({ read: 1 });
notificationSchema.index({ deleted: 1 });

module.exports = mongoose.model('Notification', notificationSchema); 