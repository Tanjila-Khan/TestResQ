const twilio = require('twilio');
const AbandonedCart = require('../models/AbandonedCart');
const StoreConnection = require('../models/StoreConnection');
const Cart = require('../models/Cart');
const path = require('path');
const fs = require('fs');

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Set up logging
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logFile = path.join(logsDir, 'whatsapp-controller.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  logStream.write(logMessage);
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
}

// Check if enough time has passed since last WhatsApp message
const canSendWhatsApp = async (cart) => {
  if (cart.whatsapp_opt_out) {
    throw new Error('Customer has opted out of WhatsApp notifications');
  }

  if (cart.whatsapp_attempts >= 3) { // Maximum 3 attempts
    throw new Error('Maximum WhatsApp attempts reached for this cart');
  }

  if (cart.whatsapp_sent_at) {
    const hoursSinceLastMessage = (new Date() - new Date(cart.whatsapp_sent_at)) / (1000 * 60 * 60);
    if (hoursSinceLastMessage < 24) { // 24-hour cooldown
      throw new Error(`Please wait ${Math.ceil(24 - hoursSinceLastMessage)} hours before sending another WhatsApp message`);
    }
  }

  return true;
};

// Note: With approved message templates, we don't need to check the 24-hour window
// Templates can be sent at any time without customer interaction

// Send WhatsApp reminder for abandoned cart
exports.sendWhatsAppReminder = async (req, res) => {
  try {
    const { cartId, storeUrl } = req.body;

    if (!cartId || !storeUrl) {
      return res.status(400).json({ error: 'Missing required fields: cartId and storeUrl' });
    }
    
    // Check if user has WhatsApp feature enabled
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Get user's subscription to check WhatsApp limits
    const User = require('../models/User');
    const Subscription = require('../models/Subscription');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Also check Subscription collection as fallback
    let subscription = await Subscription.findOne({ user: userId });
    
    // Check if user has WhatsApp feature in their plan
    const { plans } = require('../config/stripe');
    
    // Determine user's plan - try User model first, then Subscription collection
    let userPlanKey = user.subscriptionPlan;
    if (!userPlanKey && subscription) {
      userPlanKey = subscription.plan;
    }
    if (!userPlanKey) {
      userPlanKey = 'free';
    }
    
    const userPlan = plans[userPlanKey];
    
    if (!userPlan.limits.maxWhatsappPerMonth || userPlan.limits.maxWhatsappPerMonth <= 0) {
      return res.status(403).json({ 
        error: 'WhatsApp feature not available in your plan',
        message: 'Upgrade to Starter plan or higher to send WhatsApp messages',
        upgradeUrl: '/pricing'
      });
    }

    // Get store connection - user-specific
    const storeConnection = await StoreConnection.findOne({ 
      userId,
      store_url: storeUrl 
    });
    if (!storeConnection) {
      return res.status(404).json({ error: 'Store connection not found' });
    }

    // Get cart data
    let cart = await Cart.findOne({ cart_id: cartId }) || 
               await AbandonedCart.findOne({ cart_id: cartId });

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Check if customer has WhatsApp number
    let whatsappNumber = cart.customer_data?.whatsapp || cart.customer_data?.phone;
    if (!whatsappNumber) {
      return res.status(400).json({ error: 'No WhatsApp number found for customer' });
    }
    
    // Try to detect country from cart data
    let detectedCountry = 'US'; // Default fallback
    
    // Priority order for country detection
    if (cart.customer_data?.address?.country) {
      detectedCountry = cart.customer_data.address.country.toUpperCase();
    } else if (cart.customer_data?.country) {
      detectedCountry = cart.customer_data.country.toUpperCase();
    } else if (cart.customer_data?.country_code) {
      detectedCountry = cart.customer_data.country_code.toUpperCase();
    } else if (cart.shipping_address?.country) {
      detectedCountry = cart.shipping_address.country.toUpperCase();
    }
    
    console.log('WhatsApp - Detected country:', detectedCountry);
    
    // Format phone number for international WhatsApp
    const { formatPhoneNumberForSMS } = require('./smsController');
    whatsappNumber = formatPhoneNumberForSMS(whatsappNumber, detectedCountry);
    
    if (!whatsappNumber) {
      return res.status(400).json({ 
        error: 'Invalid phone number format for WhatsApp',
        detectedCountry,
        originalNumber: cart.customer_data?.whatsapp || cart.customer_data?.phone
      });
    }
    
    console.log('WhatsApp - Formatted number:', whatsappNumber);

    // Format cart items
    const cartItems = cart.items || cart.cart || [];
    const itemsText = cartItems.map(item => {
      const productName = item.product_name || item.name || item.title || 'Product';
      const quantity = item.quantity || 1;
      const price = item.price || 0;
      return `• ${productName} (${quantity}x) - $${(price * quantity).toFixed(2)}`;
    }).join('\n');

    // Calculate cart summary
    const cartSummary = {
      subtotal: cart.subtotal || cartItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0),
      shipping: cart.shipping || 0,
      tax: cart.tax || 0,
      total: cart.total || 0
    };

    // Generate checkout URL
    let checkoutUrl = storeUrl;
    if (cart.cart_id) {
      if (storeConnection.platform === 'woocommerce') {
        const cartItems = cart.items.map(item => {
          const productId = item.product_id || item.id;
          const variationId = item.variation_id;
          const quantity = item.quantity || 1;
          let addToCartParam = `add-to-cart=${productId}`;
          if (variationId) {
            addToCartParam += `&variation_id=${variationId}`;
          }
          addToCartParam += `&quantity=${quantity}`;
          return addToCartParam;
        }).join('&');
        checkoutUrl = `${storeUrl.replace(/\/$/, '')}/cart/?${cartItems}`;
      } else if (storeConnection.platform === 'shopify') {
        checkoutUrl = `${storeUrl.replace(/\/$/, '')}/checkout/${cart.cart_id}`;
      }
    }

    // Create WhatsApp message
    const messageBody = [
      '🛒 *Complete Your Purchase!*',
      '',
      '*Items in your cart:*',
      itemsText,
      '',
      `*Subtotal:* $${cartSummary.subtotal.toFixed(2)}`,
      parseFloat(cartSummary.shipping) > 0 ? `*Shipping:* $${cartSummary.shipping.toFixed(2)}` : null,
      parseFloat(cartSummary.tax) > 0 ? `*Tax:* $${cartSummary.tax.toFixed(2)}` : null,
      `*Total:* $${cartSummary.total.toFixed(2)}`,
      '',
      'Continue your checkout:',
      checkoutUrl,
      '',
      'Reply STOP to unsubscribe'
    ].filter(Boolean).join('\n');

    // Use approved message template for WhatsApp Business API
    // This allows sending messages without the 24-hour window limitation
    const templateName = process.env.TWILIO_WHATSAPP_TEMPLATE_NAME || "cart_reminder";
    const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID;
    
    let messagePayload;
    
    if (templateSid) {
      // Use Content Template (recommended approach)
      messagePayload = {
        contentSid: templateSid,
        contentVariables: {
          "1": storeConnection.store_name || "our store",
          "2": cartItems.length.toString(),
          "3": `$${cartSummary.total.toFixed(2)}`,
          "4": checkoutUrl || `${storeUrl}/cart`
        }
      };
    } else {
      // Use Message Template (fallback approach)
      messagePayload = {
        body: templateName,
        contentVariables: {
          "1": storeConnection.store_name || "our store",
          "2": cartItems.length.toString(),
          "3": `$${cartSummary.total.toFixed(2)}`,
          "4": checkoutUrl || `${storeUrl}/cart`
        }
      };
    }

    // (Update cart status (e.g. "sending") and increment attempts.)
    await AbandonedCart.findOneAndUpdate({ cart_id: cartId }, { $set: { whatsapp_status: "sending" }, $inc: { whatsapp_attempts: 1 } });

    // Get Twilio WhatsApp number (with "whatsapp:" prefix) and format recipient (with "whatsapp:" prefix)
    let twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    if (!twilioWhatsAppNumber) { 
      return res.status(500).json({ 
        error: 'WhatsApp service not configured',
        message: 'Twilio WhatsApp number not configured. Please contact support.'
      });
    }
    if (!twilioWhatsAppNumber.startsWith("whatsapp:")) { 
      twilioWhatsAppNumber = "whatsapp:" + twilioWhatsAppNumber.replace(/[^0-9]/g, ""); 
    }
    
    // Format the recipient number for WhatsApp
    const formattedNumber = whatsappNumber.startsWith("whatsapp:") ? 
      whatsappNumber : 
      "whatsapp:" + whatsappNumber;
    
    console.log('WhatsApp - Sending message:', {
      from: twilioWhatsAppNumber,
      to: formattedNumber,
      messagePayload
    });

    // (Send the WhatsApp message (using twilioClient.messages.create) with the payload (free–form or template) and "from" (twilioWhatsAppNumber) and "to" (formattedNumber).)
    const message = await twilioClient.messages.create({ ...messagePayload, from: twilioWhatsAppNumber, to: formattedNumber });

    // (Update cart (e.g. "sent" status, "whatsapp_sent_at" (new Date), "last_whatsapp_sid" (message.sid)) and return success.)
    await AbandonedCart.findOneAndUpdate({ cart_id: cartId }, { $set: { whatsapp_status: message.status, whatsapp_sent_at: new Date(), last_whatsapp_sid: message.sid } });
    res.json({ message: "WhatsApp message sent (or template used) successfully", sid: message.sid, status: message.status });

  } catch (error) {
    log(`Error sending WhatsApp message: ${error.message}`, true);
    console.error('Error sending WhatsApp message:', error);
    
    // Update cart status to failed
    try {
      await AbandonedCart.findOneAndUpdate({ cart_id: cartId }, {
        $set: {
          whatsapp_status: 'failed',
          last_whatsapp_error: error.message
        }
      });
      console.log(`Updated cart ${cartId} with WhatsApp failed status`);
    } catch (updateError) {
      console.error('Error updating cart with WhatsApp failed status:', updateError);
    }
    
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
};

// Handle WhatsApp status callbacks
exports.handleWhatsAppStatus = async (req, res) => {
  try {
    const { MessageSid, MessageStatus } = req.body;

    // Find cart by message SID
    const cart = await AbandonedCart.findOne({ last_whatsapp_sid: MessageSid });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found for message SID' });
    }

    // Update cart status
    const updateData = {
      whatsapp_status: MessageStatus
    };

    // If delivered, update delivery timestamp
    if (MessageStatus === 'delivered') {
      updateData.whatsapp_delivered_at = new Date();
    }

    await AbandonedCart.findByIdAndUpdate(cart._id, {
      $set: updateData
    });

    res.sendStatus(200);
  } catch (error) {
    log(`Error handling WhatsApp status callback: ${error.message}`, true);
    console.error('Error handling WhatsApp status callback:', error);
    res.status(500).json({ error: 'Failed to process WhatsApp status update' });
  }
};

// Send bulk WhatsApp messages
exports.sendBulkWhatsApp = async (req, res) => {
  try {
    const { cartIds, storeUrl } = req.body;

    if (!Array.isArray(cartIds) || cartIds.length === 0 || !storeUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields: cartIds (array) and storeUrl' 
      });
    }

    const results = {
      successful: [],
      failed: []
    };

    // Process each cart
    for (const cartId of cartIds) {
      try {
        // Send WhatsApp reminder for each cart
        const response = await exports.sendWhatsAppReminder(
          { body: { cartId, storeUrl } },
          { 
            status: () => ({ json: (data) => data }),
            json: (data) => data
          }
        );

        if (response.error) {
          results.failed.push({ cartId, error: response.error });
        } else {
          results.successful.push({ cartId, sid: response.sid });
        }
      } catch (error) {
        results.failed.push({ cartId, error: error.message });
      }
    }

    res.json({
      message: 'Bulk WhatsApp sending completed',
      results
    });

  } catch (error) {
    log(`Error sending bulk WhatsApp messages: ${error.message}`, true);
    console.error('Error sending bulk WhatsApp messages:', error);
    res.status(500).json({ error: 'Failed to send bulk WhatsApp messages' });
  }
}; 