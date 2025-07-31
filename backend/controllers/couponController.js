const Coupon = require('../models/Coupon');
const { validateObjectId } = require('../utils/validation');
const AbandonedCart = require('../models/AbandonedCart');
const Email = require('../models/Email');
const StoreConnection = require('../models/StoreConnection');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const { sendZohoEmail } = require('../utils/mailer');

// Get all coupons for a store
exports.getCoupons = async (req, res) => {
  try {
    const { platform, storeId } = req.query;
    if (!platform || !storeId) {
      return res.status(400).json({ error: 'Platform and storeId are required' });
    }

    // Remove createdBy requirement since we're not using auth middleware
    const coupons = await Coupon.find({
      platform,
      storeId
    }).sort({ createdAt: -1 });

    res.json({ coupons });
  } catch (err) {
    console.error('Error fetching coupons:', err);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
};

// Create a new coupon
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      type,
      amount,
      minSpend,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      customerEmails,
      customerGroups,
      description,
      isActive,
      platform,
      storeId,
      abandonedCartId // New field to link coupon to abandoned cart
    } = req.body;

    // Validate required fields
    if (!code || !type || !amount || !startDate || !endDate || !platform || !storeId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({
      code,
      platform,
      storeId
    });

    if (existingCoupon) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    // If abandonedCartId is provided, get the cart and add its customer email
    let cartCustomerEmail = null;
    if (abandonedCartId) {
      const cart = await AbandonedCart.findById(abandonedCartId);
      if (cart) {
        cartCustomerEmail = cart.customer_email;
      }
    }

    // --- WooCommerce Coupon Sync ---
    let wcCouponId = null;
    if (platform === 'woocommerce') {
      // Find store connection for this storeId
      const storeConn = await StoreConnection.findOne({ platform, store_url: storeId });
      if (!storeConn) {
        return res.status(400).json({ error: 'WooCommerce store connection not found' });
      }
      const wcApi = new WooCommerceRestApi({
        url: storeConn.store_url,
        consumerKey: storeConn.consumer_key,
        consumerSecret: storeConn.consumer_secret,
        version: 'wc/v3',
        queryStringAuth: true,
        verifySsl: false
      });
      // Prepare WooCommerce coupon data
      const wcCouponData = {
        code,
        discount_type: type === 'percentage' ? 'percent' : 'fixed_cart',
        amount: String(amount),
        individual_use: true,
        usage_limit: usageLimit || 1,
        date_expires: new Date(endDate).toISOString().split('T')[0],
        description: description || '',
        minimum_amount: minSpend ? String(minSpend) : undefined,
        email_restrictions: cartCustomerEmail ? [cartCustomerEmail] : customerEmails || [],
        usage_limit_per_user: 1,
        // Add more fields as needed
      };
      try {
        const wcRes = await wcApi.post('coupons', wcCouponData);
        wcCouponId = wcRes.data.id;
      } catch (err) {
        console.error('Error creating WooCommerce coupon:', err.response?.data || err.message);
        return res.status(500).json({ error: 'Failed to create coupon in WooCommerce', details: err.response?.data || err.message });
      }
    }

    // --- Shopify Coupon Sync ---
    let shopifyPriceRuleId = null;
    let shopifyDiscountCodeId = null;
    if (platform === 'shopify') {
      // Find store connection for this storeId
      const storeConn = await StoreConnection.findOne({ platform, store_url: storeId });
      if (!storeConn) {
        return res.status(400).json({ error: 'Shopify store connection not found' });
      }
      const shopUrl = storeConn.store_url.replace(/^https?:\/\//, '');
      const accessToken = storeConn.access_token;
      // Prepare Shopify price rule data
      const priceRuleData = {
        price_rule: {
          title: code,
          target_type: 'line_item',
          target_selection: 'all',
          allocation_method: 'across',
          value_type: type === 'percentage' ? 'percentage' : 'fixed_amount',
          value: type === 'percentage' ? `-${amount}` : `-${amount}`,
          customer_selection: 'all',
          starts_at: new Date(startDate).toISOString(),
          ends_at: new Date(endDate).toISOString(),
          usage_limit: usageLimit ? parseInt(usageLimit) : 1,
          once_per_customer: true
        }
      };
      try {
        const priceRuleRes = await require('axios').post(
          `https://${shopUrl}/admin/api/2024-01/price_rules.json`,
          priceRuleData,
          {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json'
            }
          }
        );
        shopifyPriceRuleId = priceRuleRes.data.price_rule.id;
        // Create discount code
        const discountCodeRes = await require('axios').post(
          `https://${shopUrl}/admin/api/2024-01/price_rules/${shopifyPriceRuleId}/discount_codes.json`,
          { discount_code: { code } },
          {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json'
            }
          }
        );
        shopifyDiscountCodeId = discountCodeRes.data.discount_code.id;
      } catch (err) {
        console.error('Error creating Shopify coupon:', err.response?.data || err.message);
        return res.status(500).json({ error: 'Failed to create coupon in Shopify', details: err.response?.data || err.message });
      }
    }

    const coupon = new Coupon({
      code,
      type,
      amount,
      minSpend,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      customerEmails: cartCustomerEmail ? [cartCustomerEmail] : customerEmails || [],
      customerGroups: customerGroups || [],
      description,
      isActive,
      platform,
      storeId,
      wcCouponId,
      shopifyPriceRuleId,
      shopifyDiscountCodeId,
      // Make createdBy optional since we're not using auth middleware
      createdBy: req.user?._id
    });

    await coupon.save();

    // If this is an abandoned cart coupon, send an email to the customer
    if (cartCustomerEmail) {
      const emailContent = {
        to: cartCustomerEmail,
        subject: 'Special Offer: Complete Your Purchase!',
        html: `
          <h2>Don't Miss Out on Your Items!</h2>
          <p>We noticed you left some items in your cart. Use this special coupon to complete your purchase:</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #28a745;">Coupon Code: ${code}</h3>
            <p>${type === 'percentage' ? `${amount}% off` : `$${amount} off`} your purchase</p>
            ${minSpend ? `<p>Minimum spend: $${minSpend}</p>` : ''}
            ${maxDiscount ? `<p>Maximum discount: $${maxDiscount}</p>` : ''}
            <p>Valid until: ${new Date(endDate).toLocaleDateString()}</p>
          </div>
          <p>Click here to return to your cart and complete your purchase!</p>
          <a href="${req.body.cartUrl || '#'}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Return to Cart</a>
        `
      };

      const email = new Email({
        platform,
        to: cartCustomerEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        metadata: {
          couponId: coupon._id,
          cartId: abandonedCartId
        }
      });

      await email.save();
      // Here you would typically trigger your email sending service
      // For example: await sendEmail(emailContent);
    }

    res.status(201).json({ coupon });
  } catch (err) {
    console.error('Error creating coupon:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create coupon' });
  }
};

// Update a coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid coupon ID' });
    }

    const coupon = await Coupon.findOne({
      _id: id,
      createdBy: req.user._id
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    // Prevent updating certain fields
    const allowedUpdates = [
      'type',
      'amount',
      'minSpend',
      'maxDiscount',
      'startDate',
      'endDate',
      'usageLimit',
      'customerEmails',
      'customerGroups',
      'description',
      'isActive'
    ];

    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    Object.assign(coupon, updates);
    await coupon.save();

    res.json({ coupon });
  } catch (err) {
    console.error('Error updating coupon:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to update coupon' });
  }
};

// Delete a coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid coupon ID' });
    }

    const coupon = await Coupon.findOneAndDelete({
      _id: id,
      createdBy: req.user._id
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    res.json({ message: 'Coupon deleted successfully' });
  } catch (err) {
    console.error('Error deleting coupon:', err);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
};

// Validate and apply a coupon
exports.validateCoupon = async (req, res) => {
  try {
    const { code, customerEmail, customerGroups, platform, storeId, subtotal } = req.body;

    if (!code || !platform || !storeId || subtotal === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const coupon = await Coupon.findOne({
      code,
      platform,
      storeId
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Invalid coupon code' });
    }

    // Check if coupon is valid and applicable
    if (!coupon.isValid()) {
      return res.status(400).json({ error: 'Coupon is not valid' });
    }

    if (!coupon.isApplicableToCustomer(customerEmail, customerGroups)) {
      return res.status(400).json({ error: 'Coupon is not applicable to this customer' });
    }

    // Calculate discount
    const discount = coupon.calculateDiscount(subtotal);

    res.json({
      valid: true,
      coupon: {
        id: coupon._id,
        code: coupon.code,
        type: coupon.type,
        amount: coupon.amount,
        discount,
        description: coupon.description
      }
    });
  } catch (err) {
    console.error('Error validating coupon:', err);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
};

// Get available coupons for a customer
exports.getAvailableCoupons = async (req, res) => {
  try {
    const { customerEmail, customerGroups, platform, storeId } = req.query;

    if (!platform || !storeId) {
      return res.status(400).json({ error: 'Platform and storeId are required' });
    }

    const coupons = await Coupon.findValidCoupons(
      customerEmail,
      customerGroups ? customerGroups.split(',') : [],
      platform,
      storeId
    );

    res.json({ coupons });
  } catch (err) {
    console.error('Error fetching available coupons:', err);
    res.status(500).json({ error: 'Failed to fetch available coupons' });
  }
};

// Apply coupon to cart and increment usage count
exports.applyCoupon = async (req, res) => {
  try {
    const { code, cartId, platform, storeId } = req.body;

    if (!code || !cartId || !platform || !storeId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const coupon = await Coupon.findOne({
      code,
      platform,
      storeId
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Invalid coupon code' });
    }

    // Check if coupon is valid
    if (!coupon.isValid()) {
      return res.status(400).json({ error: 'Coupon is not valid' });
    }

    // Increment usage count
    coupon.usageCount += 1;
    await coupon.save();

    // Here you would typically update the cart with the coupon
    // This depends on your cart implementation
    // For example:
    // await Cart.findByIdAndUpdate(cartId, {
    //   $set: { coupon: coupon._id }
    // });

    res.json({
      message: 'Coupon applied successfully',
      coupon: {
        id: coupon._id,
        code: coupon.code,
        type: coupon.type,
        amount: coupon.amount
      }
    });
  } catch (err) {
    console.error('Error applying coupon:', err);
    res.status(500).json({ error: 'Failed to apply coupon' });
  }
};

// Get a single coupon by ID
exports.getCouponById = async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
};

// Apply a coupon to a cart
exports.applyCouponToCart = async (req, res) => {
  res.status(501).json({ error: 'Not implemented' });
};

// --- New endpoint: sendReminder ---
exports.sendReminder = async (req, res) => {
  try {
    const { abandonedCartId, cartUrl, platform, storeId } = req.body;
    
    console.log('=== SEND REMINDER DEBUG ===');
    console.log('Request body:', {
      abandonedCartId,
      cartUrl,
      platform,
      storeId
    });
    
    if (!abandonedCartId || !platform || !storeId) {
      console.log('Missing required fields:', { abandonedCartId, platform, storeId });
      return res.status(400).json({ error: "Missing required fields: abandonedCartId, platform, and storeId" });
    }

    // Find cart using cart_id instead of _id
    console.log('Searching for cart with:', { cart_id: abandonedCartId, platform });
    const cart = await AbandonedCart.findOne({ 
      cart_id: abandonedCartId,
      platform
    });

    console.log('Cart search result:', cart ? 'Found' : 'Not found');
    if (!cart) {
      return res.status(404).json({ error: "Abandoned cart not found" });
    }

    const cartCustomerEmail = cart.customer_email;
    if (!cartCustomerEmail) {
      return res.status(400).json({ error: "Abandoned cart has no customer email" });
    }

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
    let recoveryLink = storeId;
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
          return addToCartParam;
        }).join('&');
        const timestamp = new Date().getTime();
        recoveryLink = `${storeId.replace(/\/$/, '')}/cart/?${cartItems}&_t=${timestamp}`;
      } else if (platform === 'shopify') {
        recoveryLink = `${storeId.replace(/\/$/, '')}/checkout/${cart.cart_id}`;
      }
    }

    const unsubscribeLink = `${storeId.replace(/\/$/, '')}/unsubscribe?email=${encodeURIComponent(cartCustomerEmail)}`;

    // Format email content for reminder
    const formattedHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333333; font-size: 28px; margin: 0;">Complete Your Purchase! 🛒</h1>
        </div>
        
        <div style="margin-bottom: 25px; color: #333333; font-size: 16px; line-height: 1.5;">
          <p>We noticed you left some items in your cart. Don't miss out on these great products!</p>
          <p>Your cart is waiting for you to complete your purchase.</p>
        </div>

        ${cartItems.length > 0 ? `
          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Your Cart Items:</h3>
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
          <a href="${recoveryLink}" style="display: inline-block; padding: 15px 30px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 18px;">Return to Cart</a>
        </div>

        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 6px;">
          <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your cart will be saved for a limited time.</p>
          <p style="margin: 0; color: #666; font-size: 14px;">
            Don't want to receive these reminders? <a href="${unsubscribeLink}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>
      </div>
    `;

    // Send email using Zoho API
    console.log(`Attempting to send reminder email to ${cartCustomerEmail}`);
    const info = await sendZohoEmail({
      to: cartCustomerEmail,
      subject: '🛒 Complete Your Purchase - Your Cart is Waiting!',
      html: formattedHtml,
      fromEmail: process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL,
      fromName: 'CartResQ'
    });
    console.log(`Reminder email sent successfully to ${cartCustomerEmail}. Message ID: ${info.messageId}`);

    // Save email record
    const email = new Email({
      platform,
      to: cartCustomerEmail,
      subject: 'Complete Your Purchase - Your Cart is Waiting!',
      html: formattedHtml,
      messageId: info.messageId,
      status: 'sent',
      cart_id: cart._id,
      metadata: {
        type: 'cart_reminder',
        storeUrl: storeId,
        cartTotal: cart.total,
        cartId: cart.cart_id
      }
    });

    await email.save();

    // Update cart status
    await AbandonedCart.findOneAndUpdate(
      { cart_id: abandonedCartId },
      { 
        $set: { 
          email_status: 'reminder_sent',
          reminder_sent_at: new Date(),
          last_reminder_id: email._id
        },
        $inc: { reminder_attempts: 1 }
      }
    );

    res.status(200).json({ 
      success: true,
      message: "Reminder email sent successfully",
      email
    });

  } catch (err) {
    console.error("Error in sendReminder:", err);
    res.status(500).json({ 
      error: "Failed to send reminder",
      details: err.message 
    });
  }
};

// --- New endpoint: sendDiscountEmail ---
exports.sendDiscountEmail = async (req, res) => {
  try {
    const { couponId, abandonedCartId, platform, storeId } = req.body;
    
    console.log('=== SEND DISCOUNT EMAIL DEBUG ===');
    console.log('Request body:', {
      couponId,
      abandonedCartId,
      platform,
      storeId
    });
    
    if (!couponId || !abandonedCartId || !platform || !storeId) {
      console.log('Missing required fields:', { couponId, abandonedCartId, platform, storeId });
      return res.status(400).json({ error: "Missing required fields: couponId, abandonedCartId, platform, and storeId" });
    }

    // Find cart using cart_id
    console.log('Searching for cart with:', { cart_id: abandonedCartId, platform });
    const cart = await AbandonedCart.findOne({ 
      cart_id: abandonedCartId,
      platform
    });

    console.log('Cart search result:', cart ? 'Found' : 'Not found');
    if (!cart) {
      return res.status(404).json({ error: "Abandoned cart not found" });
    }

    const cartCustomerEmail = cart.customer_email;
    if (!cartCustomerEmail) {
      return res.status(400).json({ error: "Abandoned cart has no customer email" });
    }

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
    let recoveryLink = storeId;
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
          return addToCartParam;
        }).join('&');
        const timestamp = new Date().getTime();
        recoveryLink = `${storeId.replace(/\/$/, '')}/cart/?${cartItems}&_t=${timestamp}`;
      } else if (platform === 'shopify') {
        recoveryLink = `${storeId.replace(/\/$/, '')}/checkout/${cart.cart_id}`;
      }
    }

    const unsubscribeLink = `${storeId.replace(/\/$/, '')}/unsubscribe?email=${encodeURIComponent(cartCustomerEmail)}`;

    // Format email content to match the exact format that was working
    const formattedHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 20px;">
        <h1 style="color: #333; text-align: center; font-size: 24px; margin-bottom: 20px;">Special Offer Just For You! 🎁</h1>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5; margin-bottom: 15px;">
          We noticed you left some amazing items in your cart, and we want to make sure you don't miss out!
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
          As a special gesture, we're offering you an exclusive discount:
        </p>

        <div style="text-align: center; margin: 25px 0;">
          <p style="font-size: 18px; margin-bottom: 10px;">Use Code: <strong style="background: #f8f9fa; padding: 5px 10px; border-radius: 4px;">${coupon.code}</strong></p>
          <p style="font-size: 20px; color: #e63946; margin: 10px 0;">
            Get ${coupon.type === 'percentage' ? `${coupon.amount}%` : `$${coupon.amount}`} OFF your purchase!
          </p>
          <p style="color: #666; font-style: italic; margin-top: 10px;">Limited time offer - Don't miss out!</p>
        </div>

        ${cartItems.length > 0 ? `
          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Your Cart Items:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Product</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Quantity</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Price</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Total</th>
              </tr>
              ${cartItemsHtml}
            </table>
          </div>
        ` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryLink}" style="display: inline-block; padding: 15px 30px; background-color: #e63946; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">Complete Your Purchase Now</a>
        </div>

        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 5px;">
          <p style="margin: 0 0 10px 0; color: #666;">This offer is exclusively for you and expires soon!</p>
          <p style="margin: 0; color: #666;">
            Don't want to receive these offers? <a href="${unsubscribeLink}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>
      </div>
    `;

    // Send email using Zoho API
    console.log(`Attempting to send discount email to ${cartCustomerEmail} with coupon ${coupon.code}`);
    const info = await sendZohoEmail({
      to: cartCustomerEmail,
      subject: 'Special Offer Just For You! 🎁',
      html: formattedHtml,
      fromEmail: process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL,
      fromName: 'CartResQ'
    });
    console.log(`Discount email sent successfully to ${cartCustomerEmail}. Message ID: ${info.messageId}`);

    // Save email record
    const email = new Email({
      platform,
      to: cartCustomerEmail,
      subject: 'Special Offer Just For You! 🎁',
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
        storeUrl: storeId,
        cartTotal: cart.total,
        cartId: cart.cart_id
      }
    });

    await email.save();

    // Update cart status
    await AbandonedCart.findOneAndUpdate(
      { cart_id: abandonedCartId },
      { 
        $set: { 
          email_status: 'discount_sent',
          discount_sent_at: new Date(),
          last_discount_id: email._id,
          last_coupon_id: coupon._id
        },
        $inc: { discount_attempts: 1 }
      }
    );

    res.status(200).json({ 
      success: true,
      message: "Discount email sent successfully",
      email,
      coupon
    });

  } catch (err) {
    console.error("Error in sendDiscountEmail:", err);
    res.status(500).json({ 
      error: "Failed to send discount email",
      details: err.message 
    });
  }
}; 