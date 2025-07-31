const { sendZohoEmail } = require('../utils/mailer');
const Email = require('../models/Email');
const Cart = require('../models/Cart');
const AbandonedCart = require('../models/AbandonedCart');
const StoreConnection = require('../models/StoreConnection');
const path = require('path');
const fs = require('fs');
const Coupon = require('../models/Coupon');

// Set up logging
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logFile = path.join(logsDir, 'email-controller.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  logStream.write(logMessage);
  console.log(message);
}

// Send email (immediate, use nodemailer)
exports.sendEmail = async (req, res) => {
  try {
    const { to, subject, html, storeUrl, cart_id } = req.body;
    console.log('Sending email to:', to);

    if (!to || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get store connection - user-specific
    const userId = req.user._id;
    const storeConnection = await StoreConnection.findOne({ 
      userId,
      store_url: storeUrl 
    });
    if (!storeConnection) {
      return res.status(404).json({ error: 'Store connection not found' });
    }

    // Get cart data - prioritize cart_id if provided, otherwise search by email
    let cart = null;
    if (cart_id) {
      // Find cart by cart_id and platform
      cart = await Cart.findOne({ 
        cart_id: cart_id,
        platform: storeConnection.platform,
        status: 'active'
      });
      if (!cart) {
        cart = await AbandonedCart.findOne({ 
          cart_id: cart_id,
          platform: storeConnection.platform,
          status: { $in: ['active', 'abandoned'] }
        });
      }
    }
    
    // If no cart found by cart_id, fall back to email search
    if (!cart) {
      cart = await Cart.findOne({ 
      customer_email: to,
        platform: storeConnection.platform,
      status: 'active'
    }).sort({ last_activity: -1 });
    if (!cart) {
      cart = await AbandonedCart.findOne({ 
        customer_email: to,
          platform: storeConnection.platform,
        status: { $in: ['active', 'abandoned'] }
      }).sort({ last_activity: -1 });
      }
    }

    // Normalize cart items property
    if (cart && cart.cart && !cart.items) {
      cart.items = cart.cart;
    }

    // Debug: Log cart data for troubleshooting product details
    console.log('Cart data for email:', JSON.stringify(cart, null, 2));

    // Format cart items for email
    let cartItemsHtml = '';
    const cartItems = (cart && cart.items) ? cart.items : [];
    if (cartItems.length > 0) {
      cartItemsHtml = cartItems.map(item => {
        const productName = item.product_name && item.product_name !== '' ? item.product_name : (item.name && item.name !== '' ? item.name : (item.title || item.product_title || 'Product'));
        return `
          <tr>
            <td style="padding:8px;border:1px solid #eee;">${productName}</td>
            <td style="padding:8px;border:1px solid #eee;">${item.quantity || 1}</td>
            <td style="padding:8px;border:1px solid #eee;">$${item.price || 0}</td>
            <td style="padding:8px;border:1px solid #eee;">$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
          </tr>
        `;
      }).join('');
    } else {
      cartItemsHtml = '<tr><td colspan="4" style="padding:8px;text-align:center;">No items found in your cart.</td></tr>';
    }

    // Generate cart recovery link
    let recoveryLink = storeUrl;
    if (cart && cart.cart_id) {
      // For WooCommerce
      if (storeConnection.platform === 'woocommerce') {
        // Build the cart recovery URL with all items
        const cartItems = cart.items.map(item => {
          // Get the product ID and variation ID if available
          const productId = item.product_id || item.id || item.product?.id;
          const variationId = item.variation_id || item.variation?.id;
          const quantity = item.quantity || item.qty || 1;
          // Build the add-to-cart parameter
          let addToCartParam = `add-to-cart=${productId}`;
          if (variationId) {
            addToCartParam += `&variation_id=${variationId}`;
          }
          addToCartParam += `&quantity=${quantity}`;
          if (item.variation && item.variation.attributes) {
            Object.entries(item.variation.attributes).forEach(([key, value]) => {
              addToCartParam += `&attribute_${key}=${encodeURIComponent(value)}`;
            });
          }
          if (item.meta_data && Array.isArray(item.meta_data)) {
            item.meta_data.forEach(meta => {
              if (meta.key && meta.value) {
                addToCartParam += `&${meta.key}=${encodeURIComponent(meta.value)}`;
              }
            });
          }
          return addToCartParam;
        }).join('&');
        const timestamp = new Date().getTime();
        recoveryLink = `${storeUrl.replace(/\/$/, '')}/cart/?${cartItems}&_t=${timestamp}`;
        console.log('Cart data for recovery:', {
          cart_id: cart.cart_id,
          items: cart.items,
          recovery_link: recoveryLink,
          cart_items_params: cartItems
        });
      } else if (storeConnection.platform === 'shopify') {
        recoveryLink = `${storeUrl.replace(/\/$/, '')}/checkout/${cart.cart_id}`;
      }
    }
    console.log('Cart recovery link:', recoveryLink);
    console.log('Cart items for recovery:', JSON.stringify(cart?.items, null, 2));
    const unsubscribeLink = `${storeUrl.replace(/\/$/, '')}/unsubscribe?email=${encodeURIComponent(to)}&token=${cart ? cart._id : ''}`;
    const formattedHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="margin-bottom: 20px; color: #666666; font-size: 14px;">
          <p style="margin: 0;">Hi${cart && cart.customer_data && cart.customer_data.first_name ? ' ' + cart.customer_data.first_name : ''},</p>
        </div>
        <div style="margin-bottom: 25px; color: #333333; font-size: 16px; line-height: 1.5;">
          <p>We noticed you were browsing our products and wanted to let you know that your items are still available.</p>
          <p>Here's what you were looking at:</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #f9f9f9; border-radius: 6px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0; color: #333333;">Product</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0; color: #333333;">Qty</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0; color: #333333;">Price</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0; color: #333333;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${cartItemsHtml}
          </tbody>
        </table>
        <div style="margin-bottom: 25px; padding: 20px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #4CAF50;">
          <p style="margin: 0 0 15px 0; color: #333333; font-size: 16px;">Your items are ready when you are!</p>
          <p style="margin: 0; color: #666666; font-size: 14px;">We offer:</p>
          <ul style="margin: 15px 0 0 0; padding-left: 20px; color: #666666; font-size: 14px;">
            <li style="margin-bottom: 8px;">Fast shipping</li>
            <li style="margin-bottom: 8px;">Easy returns</li>
            <li style="margin-bottom: 0;">Secure checkout</li>
          </ul>
        </div>
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${recoveryLink}" style="display: inline-block; padding: 14px 28px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Continue Shopping</a>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666666; font-size: 13px; line-height: 1.5;">
          <p style="margin: 0 0 10px 0;">Questions? Reply to this email - we're here to help.</p>
          <p style="margin: 0;">
            Don't want these updates? <a href="${unsubscribeLink}" style="color: #666666; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>
      </div>
    `;
    // Send email using Zoho Mail SMTP
    const info = await sendZohoEmail({
      to,
      subject,
      html: formattedHtml,
      fromEmail: process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL,
      fromName: 'CartResQ'
    });
    // Save email record
    const email = new Email({
      platform: storeConnection.platform,
      to,
      subject,
      html: formattedHtml,
      messageId: info.messageId,
      status: 'sent',
      cart_id: cart ? cart.cart_id : null,
      metadata: {
        storeUrl,
        cartTotal: cart ? cart.total : null
      }
    });
    await email.save();
    res.json({ 
      message: 'Email sent successfully',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
};

// Get sent emails
exports.getSentEmails = async (req, res) => {
  try {
    const { platform } = req.query;
    console.log('Getting sent emails for platform:', platform);

    const emails = await Email.find({ platform })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('cart_id');

    res.json(emails);
  } catch (error) {
    console.error('Error getting sent emails:', error);
    res.status(500).json({ error: 'Failed to get sent emails' });
  }
};



// Send discount offer email for abandoned cart
exports.sendDiscountOfferEmail = async (req, res) => {
  try {
    const { to, storeUrl, discountCode, discountAmount, discountType, platform, storeId } = req.body;
    
    // Log the request
    log(`Received discount offer email request: ${JSON.stringify({ to, storeUrl, discountCode, discountAmount, discountType })}`);
    
    if (!to || !storeUrl || !discountCode || !discountAmount || !discountType) {
      const error = 'Missing required fields';
      log(`Error: ${error}`);
      return res.status(400).json({ error });
    }

    // Get store connection to validate store - user-specific
    const userId = req.user._id;
    const storeConnection = await StoreConnection.findOne({ 
      userId,
      store_url: storeUrl 
    });
    if (!storeConnection) {
      const error = 'Store connection not found';
      log(`Error: ${error}`);
      return res.status(404).json({ error });
    }

    // Validate platform matches store connection
    if (storeConnection.platform !== platform) {
      const error = 'Platform mismatch';
      log(`Error: ${error} - Store platform: ${storeConnection.platform}, Request platform: ${platform}`);
      return res.status(400).json({ error });
    }

    // Validate coupon exists and matches platform
    const coupon = await Coupon.findOne({
      code: discountCode,
      platform,
      storeId: storeUrl,
      isActive: true
    });

    if (!coupon) {
      return res.status(404).json({ 
        error: 'Coupon not found or not active',
        details: 'Please ensure the coupon exists and is active for this platform and store'
      });
    }

    // Validate coupon is still valid
    if (!coupon.isValid()) {
      return res.status(400).json({
        error: 'Coupon is not valid',
        details: 'Coupon may be expired or reached its usage limit'
      });
    }

    // Validate coupon type and amount match
    if (coupon.type !== discountType || coupon.amount !== discountAmount) {
      return res.status(400).json({
        error: 'Coupon details mismatch',
        details: `Expected ${coupon.type} coupon with amount ${coupon.amount}, got ${discountType} with amount ${discountAmount}`
      });
    }

    // Find cart by cart_id (to is the cart_id in this case)
    let cart = await AbandonedCart.findOne({ 
      cart_id: to,
      platform,
      status: { $in: ['active', 'abandoned'] }
    });

    if (!cart) {
      // If not found by cart_id, try finding by email
      cart = await AbandonedCart.findOne({ 
        customer_email: to,
        platform,
        status: { $in: ['active', 'abandoned'] }
      }).sort({ last_activity: -1 });
    }

    if (!cart) {
      throw new Error(`No active or abandoned cart found for ${to}`);
    }

    // Log cart details for debugging
    console.log('Found cart for email:', {
      cart_id: cart.cart_id,
      platform: cart.platform,
      customer_email: cart.customer_email,
      status: cart.status,
      items: cart.items?.length || 0,
      total: cart.total
    });

    // Format cart items for email
    let cartItemsHtml = '';
    const cartItems = cart.items || [];
    
    if (cartItems.length > 0) {
      cartItemsHtml = cartItems.map(item => {
        const productName = item.product_name || item.name || item.title || item.presentment_title || 'Product';
        const price = parseFloat(item.price || item.variant_price || item.unit_price || 0);
        const quantity = parseInt(item.quantity || item.qty || 1);
        const total = (price * quantity).toFixed(2);
        return `
          <tr>
            <td style="padding:8px;border:1px solid #eee;">${productName}</td>
            <td style="padding:8px;border:1px solid #eee;">${quantity}</td>
            <td style="padding:8px;border:1px solid #eee;">$${price.toFixed(2)}</td>
            <td style="padding:8px;border:1px solid #eee;">$${total}</td>
          </tr>
        `;
      }).join('');
    }

    // Generate cart recovery link based on platform
    let recoveryLink = storeUrl;
    if (cart.cart_id) {
      if (platform === 'woocommerce') {
        const cartItems = cart.items.map(item => {
          const productId = item.product_id || item.id || item.product?.id;
          const variationId = item.variation_id || item.variation?.id;
          const quantity = item.quantity || item.qty || 1;
          let addToCartParam = `add-to-cart=${productId}`;
          if (variationId) {
            addToCartParam += `&variation_id=${variationId}`;
          }
          addToCartParam += `&quantity=${quantity}`;
          if (item.variation && item.variation.attributes) {
            Object.entries(item.variation.attributes).forEach(([key, value]) => {
              addToCartParam += `&attribute_${key}=${encodeURIComponent(value)}`;
            });
          }
          return addToCartParam;
        }).join('&');
        const timestamp = new Date().getTime();
        recoveryLink = `${storeUrl.replace(/\/$/, '')}/cart/?${cartItems}&_t=${timestamp}`;
      } else if (platform === 'shopify') {
        recoveryLink = `${storeUrl.replace(/\/$/, '')}/checkout/${cart.cart_id}`;
      }
    }

    console.log('Generated recovery link:', recoveryLink);

    const unsubscribeLink = `${storeUrl.replace(/\/$/, '')}/unsubscribe?email=${encodeURIComponent(cart.customer_email)}`;

    // Format email content with platform-specific coupon details
    const formattedHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="margin-bottom: 20px; color: #666666; font-size: 14px;">
          <p style="margin: 0;">Hi${cart && cart.customer_data && cart.customer_data.first_name ? ' ' + cart.customer_data.first_name : ''},</p>
        </div>
        
        <div style="margin-bottom: 25px; color: #333333; font-size: 16px; line-height: 1.5;">
          <p>We noticed you were interested in some of our products and wanted to offer you a special discount on your purchase.</p>
        </div>

        <div style="background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
          <h2 style="color: #333; margin: 0 0 15px 0;">Discount Code: <span style="background: #fff; padding: 5px 10px; border-radius: 4px; border: 1px solid #ddd;">${coupon.code}</span></h2>
          <p style="font-size: 18px; margin: 0; color: #333;">
            Save ${coupon.type === 'percentage' ? `${coupon.amount}%` : `$${coupon.amount}`} on your order
          </p>
          ${coupon.minSpend ? `<p style="color: #666; margin: 10px 0 0 0;">Minimum order: $${coupon.minSpend}</p>` : ''}
          ${coupon.maxDiscount ? `<p style="color: #666; margin: 5px 0 0 0;">Maximum savings: $${coupon.maxDiscount}</p>` : ''}
          <p style="color: #666; margin: 10px 0 0 0; font-style: italic;">Valid until: ${new Date(coupon.endDate).toLocaleDateString()}</p>
        </div>

        ${cartItems.length > 0 ? `
          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Your Items:</h3>
            <table style="width: 100%; border-collapse: collapse; background: #f9f9f9; border-radius: 6px;">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Product</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Quantity</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Price</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${cartItemsHtml}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryLink}" style="display: inline-block; padding: 15px 30px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Complete Your Order</a>
        </div>

        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 6px;">
          <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Thank you for your interest in our products.</p>
          <p style="margin: 0; color: #666; font-size: 14px;">
            Don't want these updates? <a href="${unsubscribeLink}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>
      </div>
    `;

    // Send email using Zoho Mail SMTP
    log(`Attempting to send email to ${cart.customer_email} with coupon ${coupon.code}`);
    const info = await sendZohoEmail({
      to: cart.customer_email,
      subject: 'Special Discount on Your Order',
      html: formattedHtml,
      fromEmail: process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL,
      fromName: 'CartResQ'
    });
    log(`Email sent successfully to ${cart.customer_email}. Message ID: ${info.messageId}`);

    // Save email record with coupon details
    const email = new Email({
      platform: cart.platform || platform,
      to: cart.customer_email, // Use the customer's email address
      subject: 'Special Discount Offer - Complete Your Purchase!',
      html: formattedHtml,
      messageId: info.messageId,
      status: 'sent',
      cart_id: cart._id,
      metadata: {
        type: 'discount_offer',
        couponId: coupon._id,
        couponCode: coupon.code,
        couponType: coupon.type,
        couponAmount: coupon.amount,
        storeUrl,
        cartTotal: cart.total,
        cartId: cart.cart_id,
        minSpend: coupon.minSpend,
        maxDiscount: coupon.maxDiscount,
        validUntil: coupon.endDate
      }
    });

    await email.save();

    // Update cart status
    await (cart instanceof AbandonedCart ? AbandonedCart : Cart).findOneAndUpdate(
      { _id: cart._id },
      { 
        $set: { 
          email_status: 'sent',
          email_sent_at: new Date(),
          last_email_id: email._id
        },
        $inc: { email_attempts: 1 }
      }
    );

    res.status(200).json({ 
      success: true, 
      message: 'Discount offer email sent successfully',
      emailId: email._id,
      cartId: cart.cart_id,
      couponId: coupon._id
    });

  } catch (error) {
    log(`Error in sendDiscountOfferEmail: ${error.message}`);
    console.error('Error in sendDiscountOfferEmail:', error);
    res.status(500).json({ 
      error: 'Failed to send discount offer email',
      details: error.message 
    });
  }
};

