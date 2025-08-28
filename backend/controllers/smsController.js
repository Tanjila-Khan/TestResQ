const twilio = require('twilio');
const AbandonedCart = require('../models/AbandonedCart');
const StoreConnection = require('../models/StoreConnection');
const Cart = require('../models/Cart');
const path = require('path');
const fs = require('fs');

// Initialize Twilio client
let twilioClient;
try {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    console.error('Missing Twilio credentials:', {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken
    });
    throw new Error('Twilio credentials not configured');
  }
  
  twilioClient = twilio(accountSid, authToken);
  console.log('Twilio client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Twilio client:', error);
  throw new Error('Twilio client initialization failed');
}

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

// Format phone number for international SMS using E.164 standards
const formatPhoneNumberForSMS = (phoneNumber, countryCode = 'US') => {
  if (!phoneNumber) return null;
  
  console.log('Formatting phone number:', { phoneNumber, countryCode });
  
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.toString().replace(/[^\d+]/g, '');
  console.log('Cleaned number:', cleaned);
  
  // If number already starts with +, check if it's valid
  if (cleaned.startsWith('+')) {
    // Remove the + and validate the number
    const number = cleaned.substring(1);
    console.log('Number with + removed:', number);
    // If it's a valid international number, return as is
    if (number.length >= 8 && number.length <= 15) {
      console.log('Valid + number, returning:', cleaned);
      return cleaned;
    }
  }
  
  // If it starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    const result = '+' + cleaned.substring(2);
    console.log('00 replaced with +:', result);
    return result;
  }
  
  // Get country calling codes (comprehensive list)
  const countryCallingCodes = {
    'AF': '93', 'AL': '355', 'DZ': '213', 'AD': '376', 'AO': '244', 'AG': '1268', 'AR': '54',
    'AM': '374', 'AU': '61', 'AT': '43', 'AZ': '994', 'BS': '1242', 'BH': '973', 'BD': '880',
    'BB': '1246', 'BY': '375', 'BE': '32', 'BZ': '501', 'BJ': '229', 'BT': '975', 'BO': '591',
    'BA': '387', 'BW': '267', 'BR': '55', 'BN': '673', 'BG': '359', 'BF': '226', 'BI': '257',
    'KH': '855', 'CM': '237', 'CA': '1', 'CV': '238', 'CF': '236', 'TD': '235', 'CL': '56',
    'CN': '86', 'CO': '57', 'KM': '269', 'CG': '242', 'CD': '243', 'CR': '506', 'CI': '225',
    'HR': '385', 'CU': '53', 'CY': '357', 'CZ': '420', 'DK': '45', 'DJ': '253', 'DM': '1767',
    'DO': '1809', 'EC': '593', 'EG': '20', 'SV': '503', 'GQ': '240', 'ER': '291', 'EE': '372',
    'ET': '251', 'FJ': '679', 'FI': '358', 'FR': '33', 'GA': '241', 'GM': '220', 'GE': '995',
    'DE': '49', 'GH': '233', 'GR': '30', 'GD': '1473', 'GT': '502', 'GN': '224', 'GW': '245',
    'GY': '592', 'HT': '509', 'HN': '504', 'HK': '852', 'HU': '36', 'IS': '354', 'IN': '91',
    'ID': '62', 'IR': '98', 'IQ': '964', 'IE': '353', 'IL': '972', 'IT': '39', 'JM': '1876',
    'JP': '81', 'JO': '962', 'KZ': '7', 'KE': '254', 'KI': '686', 'KP': '850', 'KR': '82',
    'KW': '965', 'KG': '996', 'LA': '856', 'LV': '371', 'LB': '961', 'LS': '266', 'LR': '231',
    'LY': '218', 'LI': '423', 'LT': '370', 'LU': '352', 'MO': '853', 'MK': '389', 'MG': '261',
    'MW': '265', 'MY': '60', 'MV': '960', 'ML': '223', 'MT': '356', 'MH': '692', 'MR': '222',
    'MU': '230', 'MX': '52', 'FM': '691', 'MD': '373', 'MC': '377', 'MN': '976', 'ME': '382',
    'MA': '212', 'MZ': '258', 'MM': '95', 'NA': '264', 'NR': '674', 'NP': '977', 'NL': '31',
    'NZ': '64', 'NI': '505', 'NE': '227', 'NG': '234', 'NO': '47', 'OM': '968', 'PK': '92',
    'PW': '680', 'PA': '507', 'PG': '675', 'PY': '595', 'PE': '51', 'PH': '63', 'PL': '48',
    'PT': '351', 'QA': '974', 'RO': '40', 'RU': '7', 'RW': '250', 'KN': '1869', 'LC': '1758',
    'VC': '1784', 'WS': '685', 'SM': '378', 'ST': '239', 'SA': '966', 'SN': '221', 'RS': '381',
    'SC': '248', 'SL': '232', 'SG': '65', 'SK': '421', 'SI': '386', 'SB': '677', 'SO': '252',
    'ZA': '27', 'ES': '34', 'LK': '94', 'SD': '249', 'SR': '597', 'SZ': '268', 'SE': '46',
    'CH': '41', 'SY': '963', 'TW': '886', 'TJ': '992', 'TZ': '255', 'TH': '66', 'TL': '670',
    'TG': '228', 'TO': '676', 'TT': '1868', 'TN': '216', 'TR': '90', 'TM': '993', 'TV': '688',
    'UG': '256', 'UA': '380', 'AE': '971', 'GB': '44', 'US': '1', 'UY': '598', 'UZ': '998',
    'VU': '678', 'VA': '379', 'VE': '58', 'VN': '84', 'YE': '967', 'ZM': '260', 'ZW': '263'
  };
  
  const callingCode = countryCallingCodes[countryCode] || '';
  console.log('Country calling code for', countryCode, ':', callingCode);
  
  if (!callingCode) {
    // If country code not found, try to detect from number pattern
    console.log('No calling code found, trying pattern detection');
    return detectCountryFromNumber(cleaned);
  }
  
  // Remove any existing country code
  const beforeRemoval = cleaned;
  cleaned = cleaned.replace(new RegExp(`^\\+?(${callingCode})`), '');
  console.log('Removed country code:', { before: beforeRemoval, after: cleaned, callingCode });
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  console.log('After removing leading zeros:', cleaned);
  
  // Validate the number length (E.164 allows 8-15 digits total, including country code)
  const numberLength = cleaned.length;
  const maxLength = 15 - callingCode.length;
  
  console.log('Length validation:', { numberLength, maxLength, callingCode, totalLength: callingCode.length + numberLength });
  
  if (numberLength < 8 || numberLength > maxLength) {
    // Try to detect country from number pattern as fallback
    console.log('Length validation failed, trying pattern detection');
    return detectCountryFromNumber(phoneNumber);
  }
  
  // Format according to E.164
  const result = '+' + callingCode + cleaned;
  console.log('Final formatted number:', result);
  return result;
};

// Fallback function to detect country from number pattern
const detectCountryFromNumber = (phoneNumber) => {
  if (!phoneNumber) return null;
  
  let cleaned = phoneNumber.toString().replace(/[^\d+]/g, '');
  
  // If already starts with +, return as is if valid
  if (cleaned.startsWith('+')) {
    const number = cleaned.substring(1);
    if (number.length >= 8 && number.length <= 15) {
      return cleaned;
    }
  }
  
  // Common patterns for major countries
  // US/Canada: 10 or 11 digits
  if (cleaned.length === 10) {
    return '+1' + cleaned;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return '+' + cleaned;
  }
  
  // UK: 07xxx (11 digits) or 7xxx (10 digits)
  if (cleaned.startsWith('07') && cleaned.length === 11) {
    return '+44' + cleaned.substring(1);
  }
  if (cleaned.startsWith('7') && cleaned.length === 10) {
    return '+44' + cleaned;
  }
  
  // Australia: 04xxx (10 digits) or 4xxx (9 digits)
  if (cleaned.startsWith('04') && cleaned.length === 10) {
    return '+61' + cleaned.substring(1);
  }
  if (cleaned.startsWith('4') && cleaned.length === 9) {
    return '+61' + cleaned;
  }
  
  // Germany: 01xxx (11 digits) or 1xxx (10 digits)
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return '+49' + cleaned.substring(1);
  }
  if (cleaned.startsWith('1') && cleaned.length === 10) {
    return '+49' + cleaned;
  }
  
  // France: 06xxx (10 digits) or 6xxx (9 digits)
  if (cleaned.startsWith('06') && cleaned.length === 10) {
    return '+33' + cleaned.substring(1);
  }
  if (cleaned.startsWith('6') && cleaned.length === 9) {
    return '+33' + cleaned;
  }
  
  // India: 9xxxx (10 digits)
  if (cleaned.startsWith('9') && cleaned.length === 10) {
    return '+91' + cleaned;
  }
  
  // Bangladesh: 01xxxx (11 digits) or 1xxxx (10 digits)
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return '+880' + cleaned.substring(1);
  }
  if (cleaned.startsWith('1') && cleaned.length === 10) {
    return '+880' + cleaned;
  }
  
  // Brazil: 11xxxx (11 digits) or 1xxxx (10 digits)
  if (cleaned.startsWith('11') && cleaned.length === 11) {
    return '+55' + cleaned.substring(1);
  }
  if (cleaned.startsWith('1') && cleaned.length === 10) {
    return '+55' + cleaned;
  }
  
  // If we can't determine, assume US format as fallback
  if (cleaned.length >= 10) {
    return '+1' + cleaned.substring(cleaned.length - 10);
  }
  
  return null;
};

// Validate phone number format for Twilio
const validatePhoneNumberForTwilio = (phoneNumber) => {
  if (!phoneNumber) return { isValid: false, error: 'Phone number is required' };
  
  // Must start with +
  if (!phoneNumber.startsWith('+')) {
    return { isValid: false, error: 'Phone number must start with +' };
  }
  
  // Remove + and get digits only
  const digitsOnly = phoneNumber.substring(1).replace(/\D/g, '');
  
  // Check length (E.164: 8-15 digits total)
  if (digitsOnly.length < 8) {
    return { isValid: false, error: 'Phone number too short (minimum 8 digits)' };
  }
  
  if (digitsOnly.length > 15) {
    return { isValid: false, error: 'Phone number too long (maximum 15 digits)' };
  }
  
  // Check if it looks like a valid international number
  if (digitsOnly.length === 8 && !['1', '44', '33', '49', '61', '91', '55'].includes(digitsOnly.substring(0, 2))) {
    return { isValid: false, error: '8-digit numbers must have valid country code' };
  }
  
  return { isValid: true, digitCount: digitsOnly.length };
};

// Check if enough time has passed since last SMS
const canSendSms = async (cart) => {
  if (cart.sms_opt_out) {
    throw new Error('Customer has opted out of SMS notifications');
  }

  const maxSmsAttempts = 3; // Maximum SMS attempts
  const smsCooldownPeriod = 24; // 24 hours cooldown

  if (cart.sms_attempts >= maxSmsAttempts) {
    throw new Error(`Maximum SMS attempts (${maxSmsAttempts}) reached for this cart`);
  }

  if (cart.sms_sent_at) {
    const hoursSinceLastSms = (new Date() - new Date(cart.sms_sent_at)) / (1000 * 60 * 60);
    if (hoursSinceLastSms < smsCooldownPeriod) {
      throw new Error(`Please wait ${Math.ceil(smsCooldownPeriod - hoursSinceLastSms)} hours before sending another SMS`);
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
    let phoneNumber = cart.customer_data?.phone || cart.customer_phone;
    console.log('2. Raw phone number:', {
      fromCustomerData: cart.customer_data?.phone,
      fromCart: cart.customer_phone,
      selected: phoneNumber
    });
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number not found. SMS not sent.' });
    }

    // Try to detect country from cart data
    let detectedCountry = 'US'; // Default fallback
    
    // Priority order for country detection
    if (cart.customer_data?.address?.country) {
      detectedCountry = cart.customer_data.address.country.toUpperCase();
      console.log('2. Country detected from customer_data.address.country:', detectedCountry);
    } else if (cart.customer_data?.country) {
      detectedCountry = cart.customer_data.country.toUpperCase();
      console.log('2. Country detected from customer_data.country:', detectedCountry);
    } else if (cart.customer_data?.country_code) {
      detectedCountry = cart.customer_data.country_code.toUpperCase();
      console.log('2. Country detected from customer_data.country_code:', detectedCountry);
    } else if (cart.shipping_address?.country) {
      detectedCountry = cart.shipping_address.country.toUpperCase();
      console.log('2. Country detected from shipping_address.country:', detectedCountry);
    } else {
      console.log('2. No country detected, using default:', detectedCountry);
    }
    
    console.log('2. Final detected country:', detectedCountry);
    
    // Format phone number for international SMS
    phoneNumber = formatPhoneNumberForSMS(phoneNumber, detectedCountry);
    console.log('2. Formatted phone number:', phoneNumber);
    
    if (!phoneNumber) {
      return res.status(400).json({ 
        error: 'Invalid phone number format. Please ensure the number includes a valid country code.',
        detectedCountry,
        originalNumber: cart.customer_data?.phone || cart.customer_phone
      });
    }
    
    // Validate phone number format for Twilio
    const validation = validatePhoneNumberForTwilio(phoneNumber);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Phone number validation failed',
        details: validation.error,
        formattedNumber: phoneNumber,
        detectedCountry
      });
    }
    
    console.log('2. Phone number validation passed:', {
      formatted: phoneNumber,
      digitCount: validation.digitCount,
      detectedCountry
    });

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

    // Get Twilio phone number or custom sender ID from environment
    let twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const customSenderId = process.env.TWILIO_SENDER_ID || 'CartResQ';
    
    if (!twilioPhoneNumber) {
      console.error('Missing TWILIO_PHONE_NUMBER environment variable');
      return res.status(500).json({ 
        error: 'SMS service not configured',
        message: 'Twilio phone number not configured. Please check your environment variables.'
      });
    }
    
    // Use custom sender ID if available (for US/Canada) or phone number
    // Note: Custom sender ID only works in US/Canada due to carrier restrictions
    const senderId = process.env.USE_CUSTOM_SENDER === 'true' ? customSenderId : twilioPhoneNumber;
    
    console.log('=== SENDER ID CONFIGURATION ===');
    console.log('USE_CUSTOM_SENDER:', process.env.USE_CUSTOM_SENDER);
    console.log('TWILIO_SENDER_ID:', process.env.TWILIO_SENDER_ID);
    console.log('Custom sender ID:', customSenderId);
    console.log('Twilio phone number:', twilioPhoneNumber);
    console.log('Final sender ID:', senderId);
    console.log('================================');

    // Send SMS using Twilio
    console.log('12. Sending SMS:', {
      to: phoneNumber,
      from: senderId,
      messageLength: messageBody.length
    });
    
    if (!twilioClient) {
      throw new Error('Twilio client not initialized');
    }
    
    const message = await twilioClient.messages.create({
      body: messageBody,
      from: senderId,
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
  sendSMS,
  formatPhoneNumberForSMS
}; 