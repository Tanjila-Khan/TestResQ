const twilio = require('twilio');
const AbandonedCart = require('../models/AbandonedCart');
const StoreConnection = require('../models/StoreConnection');
const twilioConfig = require('../config/twilio');
const Cart = require('../models/Cart');
const path = require('path');
const fs = require('fs');

// Initialize Twilio client
const twilioClient = twilio(
  twilioConfig.accountSid,
  twilioConfig.authToken
);

// Set up logging
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logFile = path.join(logsDir, 'sms-controller.log');
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

// Format currency
const formatCurrency = (amount) => {
  return parseFloat(amount).toFixed(2);
};

// Get cart items from the actual data
const getCartItems = (cart) => {
  return Array.isArray(cart.items) && cart.items.length > 0
    ? cart.items
    : (Array.isArray(cart.cart) ? cart.cart : []);
};

// Get store URL
const getStoreUrl = async (cart, userId) => {
  try {
    // Get the most recent store connection for the user
    const connection = await StoreConnection.findOne({ 
      userId,
      platform: cart.platform 
    }).sort({ updatedAt: -1 });
    
    if (!connection) {
      console.error('No store connection found for platform:', cart.platform);
      return process.env.STORE_URL;
    }

    console.log('Found store connection:', {
      platform: connection.platform,
      store_url: connection.store_url,
      updatedAt: connection.updatedAt
    });

    return connection.store_url;
  } catch (error) {
    console.error('Error getting store URL:', error);
    return process.env.STORE_URL;
  }
};

// Get abandoned cart URL
const getAbandonedUrl = async (cart, userId) => {
  const storeUrl = await getStoreUrl(cart, userId);
  return `${storeUrl}/cart`;
};

// Generate cart summary
const generateCartSummary = (cart) => {
  return {
    subtotal: formatCurrency(cart.subtotal || 0),
    shipping: formatCurrency(cart.shipping || 0),
    tax: formatCurrency(cart.tax || 0),
    total: formatCurrency(cart.total || 0)
  };
};

// Check if enough time has passed since last SMS
const canSendSms = async (cart) => {
  if (cart.sms_opt_out) {
    throw new Error('Customer has opted out of SMS notifications');
  }

  if (cart.sms_attempts >= twilioConfig.maxSmsAttempts) {
    throw new Error(`Maximum SMS attempts (${twilioConfig.maxSmsAttempts}) reached for this cart`);
  }

  if (cart.sms_sent_at) {
    const hoursSinceLastSms = (new Date() - new Date(cart.sms_sent_at)) / (1000 * 60 * 60);
    if (hoursSinceLastSms < twilioConfig.smsCooldownPeriod) {
      throw new Error(`Please wait ${Math.ceil(twilioConfig.smsCooldownPeriod - hoursSinceLastSms)} hours before sending another SMS`);
    }
  }

  return true;
};

// Send SMS reminder
const sendSmsReminder = async (req, res) => {
  console.log('=== SMS SENDING DEBUG ===');
  try {
    const { cartId } = req.body;
    
    // Check if user has SMS feature enabled
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Get user's subscription to check SMS limits
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user has SMS feature in their plan
    const { plans } = require('../config/stripe');
    const userPlan = plans[user.subscriptionPlan || 'free'];
    if (!userPlan.limits.maxSmsPerMonth || userPlan.limits.maxSmsPerMonth === 0) {
      return res.status(403).json({ 
        error: 'SMS feature not available in your plan',
        message: 'Upgrade to Starter or Growth plan to send SMS messages',
        upgradeUrl: '/pricing'
      });
    }
    
    // Get cart data by cart_id
    const cart = await AbandonedCart.findOne({ cart_id: cartId });
    console.log('1. Raw cart data from database:', JSON.stringify(cart, null, 2));
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Get phone number from customer data
    const phoneNumber = cart.customer_data?.phone || cart.customer_phone;
    console.log('2. Phone number:', {
      fromCustomerData: cart.customer_data?.phone,
      fromCart: cart.customer_phone,
      selected: phoneNumber,
      formatted: phoneNumber
    });
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number not found. SMS not sent.' });
    }

    // Use helper function to get cart items
    const cartItems = getCartItems(cart);
    console.log('3. Cart items after getCartItems:', JSON.stringify(cartItems, null, 2));
    
    if (!cartItems.length) {
      return res.status(400).json({ error: 'No items found in cart. SMS not sent.' });
    }

    // Format cart items for SMS
    const itemsText = cartItems.map(item => {
      console.log('4. Processing individual item:', JSON.stringify(item, null, 2));
      
      // Extract product details with detailed logging
      const name = item.product_name || 
                  item.name || 
                  item.product?.name || 
                  item.title || 
                  '[Product]';
      
      const quantity = parseInt(item.quantity) || 
                      parseInt(item.qty) || 
                      parseInt(item.quantity_in_cart) || 
                      1;
      
      const price = parseFloat(item.price) || 
                   parseFloat(item.unit_price) || 
                   parseFloat(item.product?.price) || 
                   0;
      
      const lineTotal = parseFloat(item.line_total) || 
                       parseFloat(item.total) || 
                       (price * quantity);
      
      console.log('5. Extracted item details:', {
        rawItem: item,
        extracted: {
          name,
          quantity,
          price,
          lineTotal,
          calculatedTotal: price * quantity
        }
      });
      
      const itemText = `${name} (${quantity}x) - $${lineTotal.toFixed(2)}`;
      console.log('6. Formatted item text:', itemText);
      return itemText;
    }).join('\n');

    // Use helper function to get store URL
    const storeUrl = await getStoreUrl(cart, userId);
    console.log('7. Store URL:', {
      fromHelper: storeUrl,
      fallback: process.env.STORE_URL,
      final: storeUrl || process.env.STORE_URL
    });
    
    if (!storeUrl && !process.env.STORE_URL) {
      return res.status(400).json({ error: 'Store URL not found. SMS not sent.' });
    }

    // Use helper function to get checkout URL
    const checkoutUrl = await getAbandonedUrl(cart, userId) || `${storeUrl || process.env.STORE_URL}/cart`;
    console.log('8. Checkout URL:', checkoutUrl);

    // Get cart summary using helper function
    const cartSummary = generateCartSummary(cart);
    console.log('9. Cart summary:', cartSummary);

    // Create SMS message
    const messageBody = [
      '🛒 Complete Your Purchase!',
      '',
      'Items in your cart:',
      itemsText,
      '',
      `Subtotal: $${cartSummary.subtotal}`,
      parseFloat(cartSummary.shipping) > 0 ? `Shipping: $${cartSummary.shipping}` : null,
      parseFloat(cartSummary.tax) > 0 ? `Tax: $${cartSummary.tax}` : null,
      `Total: $${cartSummary.total}`,
      '',
      'Continue your checkout:',
      checkoutUrl,
      '',
      'Reply STOP to unsubscribe'
    ].filter(Boolean).join('\n');

    console.log('10. Final SMS message:', messageBody);
    console.log('11. Message length:', messageBody.length);

    // Check message length
    if (messageBody.length > 1600) {
      return res.status(400).json({ 
        error: 'Message too long. Please reduce cart items or contact support.',
        length: messageBody.length
      });
    }

    // Check if we can send SMS
    try {
      await canSendSms(cart);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    // Update cart status before sending
    await AbandonedCart.findOneAndUpdate({ cart_id: cartId }, {
      $set: { sms_status: 'sending' },
      $inc: { sms_attempts: 1 }
    });

    // Get Twilio phone number from environment
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!twilioPhoneNumber) {
      return res.status(500).json({ 
        error: 'SMS service not configured',
        message: 'Twilio phone number not configured. Please contact support.'
      });
    }

    // Send SMS using Twilio
    console.log('12. Sending SMS:', {
      to: phoneNumber,
      from: twilioPhoneNumber,
      messageLength: messageBody.length
    });
    
    const message = await twilioClient.messages.create({
      body: messageBody,
      from: twilioPhoneNumber,
      to: phoneNumber
    });

    console.log('13. Twilio response:', {
      sid: message.sid,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage
    });

    // Update cart status after successful send
    await AbandonedCart.findOneAndUpdate({ cart_id: cartId }, {
      $set: {
        sms_status: 'sent',
        sms_sent_at: new Date(),
        last_sms_sid: message.sid
      }
    });

    console.log('=== SMS SENDING COMPLETE ===');
    res.json({
      success: true,
      message: 'SMS reminder sent successfully',
      status: 'sent',
      messageId: message.sid
    });

  } catch (error) {
    console.error('=== SMS SENDING ERROR ===');
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
      stack: error.stack
    });
    
    // Update cart status to failed
    if (req.body.cartId) {
      await AbandonedCart.findOneAndUpdate({ cart_id: req.body.cartId }, {
        $set: {
          sms_status: 'failed',
          last_sms_error: error.message
        }
      });
    }

    // Provide user-friendly error messages
    let userMessage = 'Failed to send SMS reminder';
    let errorDetails = error.message;

    if (error.code === 21608) {
      userMessage = 'Phone number not verified';
      errorDetails = 'This phone number needs to be verified in your Twilio account. Please verify the number at twilio.com/user/account/phone-numbers/verified or upgrade to a paid Twilio account.';
    } else if (error.code === 21211) {
      userMessage = 'Invalid phone number';
      errorDetails = 'The phone number format is invalid. Please check the number and try again.';
    } else if (error.code === 21614) {
      userMessage = 'Phone number not reachable';
      errorDetails = 'This phone number cannot receive SMS messages. Please check the number and try again.';
    } else if (error.code === 21610) {
      userMessage = 'Message body required';
      errorDetails = 'The SMS message content is missing. Please try again.';
    } else if (error.code === 21612) {
      userMessage = 'Message too long';
      errorDetails = 'The SMS message is too long. Please reduce the content and try again.';
    }

    res.status(500).json({
      error: userMessage,
      details: errorDetails,
      code: error.code
    });
  }
};

// Handle Twilio status callbacks
const handleSmsStatus = async (req, res) => {
  try {
    const { MessageSid, MessageStatus } = req.body;

    // Find cart by message SID
    const cart = await AbandonedCart.findOne({ last_sms_sid: MessageSid });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found for message SID' });
    }

    // Update cart status
    const updateData = {
      sms_status: MessageStatus
    };

    // If delivered, update delivery timestamp
    if (MessageStatus === 'delivered') {
      updateData.sms_delivered_at = new Date();
    }

    await AbandonedCart.findByIdAndUpdate(cart._id, {
      $set: updateData
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling SMS status callback:', error);
    res.status(500).json({ error: 'Failed to process SMS status update' });
  }
};

// Check SMS status
const checkSmsStatus = async (req, res) => {
  try {
    const { cartId } = req.params;
    // Get cart data by cart_id
    const cart = await AbandonedCart.findOne({ cart_id: cartId });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    res.json({
      status: cart.sms_status,
      lastSent: cart.sms_sent_at,
      delivered: cart.sms_delivered_at,
      attempts: cart.sms_attempts,
      error: cart.last_sms_error
    });
  } catch (error) {
    console.error('Error checking SMS status:', error);
    res.status(500).json({ error: 'Failed to check SMS status' });
  }
};

// Send SMS function definition
const sendSMS = async (req, res) => {
  try {
    const { to, message, cart_id } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Missing required fields: to and message are required' });
    }

    log(`Attempting to send SMS to ${to} for cart ${cart_id || 'N/A'}`);

    // Get cart data if cart_id is provided
    let cart = null;
    if (cart_id) {
      cart = await Cart.findById(cart_id) || await AbandonedCart.findById(cart_id);
      if (!cart) {
        log(`Cart not found for ID: ${cart_id}`, true);
        return res.status(404).json({ error: 'Cart not found' });
      }
    }

    // Send SMS using Twilio
    const result = await twilioClient.messages.create({
      body: message,
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    log(`SMS sent successfully to ${to} (SID: ${result.sid})`);

    res.json({
      message: 'SMS sent successfully',
      sid: result.sid,
      status: result.status
    });

  } catch (error) {
    log(`Error sending SMS: ${error.message}`, true);
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
};

// Export all functions
module.exports = {
  sendSmsReminder,
  handleSmsStatus,
  checkSmsStatus,
  sendSMS
}; 