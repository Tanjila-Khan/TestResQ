const mongoose = require('mongoose');

const sentEmailSchema = new mongoose.Schema({
  to: { type: String, required: true },
  subject: { type: String, required: true },
  html: { type: String },
  sentAt: { type: Date, default: Date.now },
  platform: { type: String, enum: ['woocommerce', 'shopify'], required: true },
  customer_email: { type: String, required: true },
  cart_id: { type: String },
  campaign_id: { type: String },
  status: { type: String, default: 'sent' }
});

module.exports = mongoose.models.SentEmail || mongoose.model('SentEmail', sentEmailSchema); 