const AbandonedCart = require('../models/AbandonedCart');
const Customer = require('../models/Customer');
const StoreConnection = require('../models/StoreConnection');
const axios = require('axios');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const { getIO } = require('../socket');
const notificationController = require('./notificationController');
const Notification = require('../models/Notification');

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const cartCache = new Map();

// Cache helper functions
const getCacheKey = (platform, page, limit) => `${platform}_${page}_${limit}`;
const getCachedData = (key) => {
  const cached = cartCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};
const setCachedData = (key, data) => {
  cartCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// Helper function to check if notification should be created
const shouldCreateNotification = async (cart, existingCart) => {
  // Check if a notification already exists for this cart in the last 24 hours
  const existingNotification = await Notification.findOne({
    'data.cartId': cart._id,
    type: 'cart_abandoned',
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });

  if (existingNotification) {
    console.log('Notification already exists for cart in last 24 hours:', cart.cart_id);
    return false;
  }

  return !existingCart || 
    (existingCart && existingCart.status !== 'abandoned') ||
    (existingCart && existingCart.last_activity < new Date(Date.now() - 24 * 60 * 60 * 1000));
};

// Helper function to create communication status notification
const createCommunicationNotification = async (cart, type, status, error = null) => {
  const notificationType = `${type}_${status}`;
  const title = `${type.toUpperCase()} ${status === 'sent' ? 'Sent Successfully' : 'Failed'}`;
  const message = status === 'sent' 
    ? `${type.toUpperCase()} reminder sent to customer for cart #${cart.cart_id}`
    : `Failed to send ${type.toUpperCase()} reminder for cart #${cart.cart_id}${error ? `: ${error}` : ''}`;

  await notificationController.createNotification({
    platform: cart.platform,
    type: notificationType,
    title,
    message,
    data: {
      cartId: cart._id,
      customerName: cart.customer_data?.first_name 
        ? `${cart.customer_data.first_name} ${cart.customer_data.last_name || ''}`
        : 'Guest',
      total: cart.total,
      itemCount: cart.items?.length || 0,
      timestamp: cart.timestamp,
      error: error || null
    }
  });
};

// Get all carts
const getCarts = async (req, res) => {
  try {
    const { platform, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('Fetching carts with params:', { platform, page, limit, skip });

    const query = platform ? { platform } : {};
    const [carts, total] = await Promise.all([
      AbandonedCart.find(query)
        .sort({ last_activity: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AbandonedCart.countDocuments(query)
    ]);

    console.log('Query results:', { 
      rowsCount: carts.length, 
      totalCount: total 
    });

    // Format the response to match what the frontend expects
    const formattedCarts = carts.map(cart => {
      // Format cart items to ensure proper data structure
      const formattedItems = cart.items.map(item => ({
        product_id: item.product_id,
        name: item.product_name || item.name,
        product_name: item.product_name || item.name,
        image_url: item.image_url,
        variant_title: item.variant_title,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        properties: item.properties || {}
      }));

      return {
      id: cart._id,
      cart_id: cart.cart_id,
      customer_id: cart.customer_id,
      customer_email: cart.customer_email,
      customer_name: cart.customer_data ? 
        `${cart.customer_data.first_name || ''} ${cart.customer_data.last_name || ''}`.trim() || 'Guest' : 
        'Guest',
      last_login: cart.last_activity,
      timestamp: cart.timestamp,
      status: cart.status,
        cart: formattedItems,
      source: 'database',
      total: cart.total,
      subtotal: cart.subtotal,
      tax: cart.tax,
      shipping: cart.shipping,
      customer_data: cart.customer_data
      };
    });

    res.json({
      carts: formattedCarts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching carts:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get cart by ID
const getCartById = async (req, res) => {
  try {
    const cart = await AbandonedCart.findById(req.params.id);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    res.json(cart);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update cart status
const updateCartStatus = async (req, res) => {
  const { status } = req.body;
  if (!['active', 'abandoned', 'converted'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const cart = await AbandonedCart.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    invalidateCartCache(); // Invalidate cache when cart status changes
    res.json({ message: 'Cart status updated successfully' });
  } catch (error) {
    console.error('Error updating cart status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get abandoned carts
const getAbandonedCarts = async (req, res) => {
  try {
    const { platform, page = 1, limit = 10, search, status } = req.query;
    
    console.log('=== Processing Abandoned Carts ===');
    console.log('Request params:', { platform, page, limit, search, status });
    
    if (!platform) {
      return res.status(400).json({ 
        error: 'Platform parameter is required'
      });
    }

    // Force cache invalidation for debugging
    cartCache.clear();
    console.log('Cache cleared for fresh data fetch');

    // Check cache first (include search and status in cache key)
    const cacheKey = `${platform}_${page}_${limit}_${search || 'all'}_${status || 'all'}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Get store connection details from MongoDB - user-specific
    const userId = req.user._id;
    const connection = await StoreConnection.findOne({ userId, platform })
      .sort({ createdAt: -1 });

    if (!connection) {
      console.log('No store connection found for platform:', platform);
      return res.status(404).json({
        error: 'No store connection found',
        message: `Please connect your ${platform} store first`
      });
    }

    console.log('Found store connection:', {
      platform: connection.platform,
      store_url: connection.store_url,
      last_sync: connection.last_sync
    });

    const skip = (page - 1) * limit;

    if (platform === 'woocommerce') {
      const api = new WooCommerceRestApi({
        url: connection.store_url,
        consumerKey: connection.consumer_key,
        consumerSecret: connection.consumer_secret,
        version: 'wc/v3'
      });

      try {
        // Get cart data from WooCommerce Cart Tracker plugin
        const cartTrackerResponse = await api.get('cart-tracker');
        const trackedCarts = cartTrackerResponse.data || [];

        // Process carts in batches to avoid overwhelming the API
        const BATCH_SIZE = 5;
        for (let i = 0; i < trackedCarts.length; i += BATCH_SIZE) {
          const batch = trackedCarts.slice(i, i + BATCH_SIZE);
          console.log(`Processing batch ${i/BATCH_SIZE + 1} of ${Math.ceil(trackedCarts.length/BATCH_SIZE)}`);
          
          await Promise.all(batch.map(async (cart) => {
            try {
              // Ensure cart has platform set
              cart.platform = platform;

              console.log('Processing cart:', {
                cart_id: cart.cart_id,
                platform: cart.platform,
                customer: cart.customer_data?.first_name || 'Guest',
                items: cart.items?.length || 0,
                total: cart.total
              });

              // Check if cart already exists
              const existingCart = await AbandonedCart.findOne({
                platform: cart.platform,
                cart_id: String(cart.cart_id)
              });

              console.log('Cart exists in database:', !!existingCart);

              // Fetch product images for all items
              let itemsWithImages = [];
              if (cart.items && cart.items.length > 0) {
                itemsWithImages = await Promise.all(cart.items.map(async (item) => {
                  try {
                    // Only fetch product data if we don't have the image or if it's a new cart
                    if (!existingCart?.items?.find(i => i.product_id === item.product_id)?.image_url || !existingCart) {
                      console.log('Fetching product data for:', item.product_id);
                      const productResponse = await api.get(`products/${item.product_id}`);
                      const product = productResponse.data;
                      
                      // Get the best available image
                      let imageUrl = null;
                      if (product.images && product.images.length > 0) {
                        // Try to get the main product image first
                        imageUrl = product.images[0].src;
                        // If no main image, try to get any other image
                        if (!imageUrl && product.images.length > 1) {
                          imageUrl = product.images[1].src;
                        }
                      }
                      
                      console.log('Product image found:', {
                        product_id: item.product_id,
                        has_image: !!imageUrl
                      });
                      
                      return { 
                        ...item, 
                        image_url: imageUrl,
                        product_name: product.name,
                        product_sku: product.sku,
                        product_type: product.type
                      };
                    } else {
                      // Use existing item data if we already have it
                      const existingItem = existingCart.items.find(i => i.product_id === item.product_id);
                      return existingItem || item;
                    }
                  } catch (error) {
                    console.error(`Error fetching product ${item.product_id}:`, error);
                    return item;
                  }
                }));
              }

              // Upsert customer data with more fields
              if (cart.customer_data) {
                console.log('Updating customer data:', {
                  customer_id: cart.customer_id,
                  name: cart.customer_data.first_name || 'Guest',
                  email: cart.customer_email
                });

                await Customer.findOneAndUpdate(
                  { 
                    platform,
                    $or: [
                      { customer_id: cart.customer_id },
                      { customer_email: cart.customer_email }
                    ]
                  },
                  {
                    platform,
                    customer_id: cart.customer_id,
                    customer_email: cart.customer_email,
                    first_name: cart.customer_data.first_name,
                    last_name: cart.customer_data.last_name,
                    phone: cart.customer_data.phone,
                    address: cart.customer_data.address,
                    company: cart.customer_data.company,
                    is_registered: cart.customer_data.is_registered,
                    last_login: cart.last_activity ? new Date(cart.last_activity) : new Date(),
                    last_cart_activity: new Date(),
                    total_orders: cart.customer_data.total_orders || 0,
                    total_spent: cart.customer_data.total_spent || 0,
                    billing_address: cart.customer_data.billing_address,
                    shipping_address: cart.customer_data.shipping_address,
                    meta_data: cart.customer_data.meta_data || {}
                  },
                  { 
                    upsert: true, 
                    new: true,
                    setDefaultsOnInsert: true
                  }
                );
              }

              // Update cart data while preserving existing SMS fields
              const savedCart = await AbandonedCart.findOneAndUpdate(
                { platform, cart_id: cart.cart_id },
                {
                  platform,
                  cart_id: cart.cart_id,
                  customer_id: cart.customer_id,
                  customer_email: cart.customer_email,
                  customer_data: {
                    ...cart.customer_data,
                    total_orders: cart.customer_data?.total_orders || 0,
                    total_spent: cart.customer_data?.total_spent || 0,
                    billing_address: cart.customer_data?.billing_address,
                    shipping_address: cart.customer_data?.shipping_address,
                    meta_data: cart.customer_data?.meta_data || {}
                  },
                  items: itemsWithImages,
                  total: cart.total,
                  subtotal: cart.subtotal,
                  tax: cart.tax,
                  shipping: cart.shipping,
                  status: 'abandoned',
                  source: cart.source,
                  device_type: cart.device_type,
                  browser_info: cart.browser_info,
                  timestamp: cart.timestamp,
                  last_activity: cart.last_activity ? new Date(cart.last_activity) : new Date(),
                  sms_status: existingCart?.sms_status,
                  sms_attempts: existingCart?.sms_attempts,
                  sms_sent_at: existingCart?.sms_sent_at,
                  sms_delivered_at: existingCart?.sms_delivered_at,
                  last_sms_error: existingCart?.last_sms_error
                },
                { upsert: true, new: true }
              );

              // Create notification if cart is new OR if status changed to abandoned
              const shouldNotify = await shouldCreateNotification(savedCart, existingCart);

              if (shouldNotify) {
                console.log('=== Creating notification for abandoned cart ===');
                console.log('Cart details:', {
                  platform: cart.platform,
                  cart_id: cart.cart_id,
                  customer: cart.customer_data?.first_name || 'Guest',
                  items: cart.items?.length || 0,
                  total: cart.total,
                  timestamp: cart.timestamp,
                  isNew: !existingCart,
                  previousStatus: existingCart?.status,
                  lastActivity: existingCart?.last_activity
                });
                
                try {
                  const notification = await notificationController.createNotification({
                    platform,
                    type: 'cart_abandoned',
                    title: 'Abandoned Cart',
                    message: `Customer ${cart.customer_data?.first_name || 'Guest'} abandoned cart with ${cart.items?.length || 0} items worth $${cart.total}`,
                    data: {
                      cartId: savedCart._id,
                      customerName: cart.customer_data?.first_name 
                        ? `${cart.customer_data.first_name} ${cart.customer_data.last_name || ''}`
                        : 'Guest',
                      total: cart.total,
                      itemCount: cart.items?.length || 0,
                      timestamp: new Date(cart.timestamp * 1000).toISOString(),
                      isNew: !existingCart,
                      previousStatus: existingCart?.status,
                      lastActivity: existingCart?.last_activity
                    }
                  }, req);
                  console.log('Notification created successfully:', {
                    notification_id: notification._id,
                    cart_id: cart.cart_id,
                    isNew: !existingCart,
                    previousStatus: existingCart?.status
                  });
                } catch (error) {
                  console.error('Error creating notification:', {
                    cart_id: cart.cart_id,
                    error: error.message,
                    stack: error.stack
                  });
                }
              }
            } catch (error) {
              console.error('Error processing cart:', {
                cart_id: cart.cart_id,
                error: error.message,
                stack: error.stack
              });
            }
          }));
        }

        // Build query filters
        let queryFilter = {
          platform,
          status: { $in: ['abandoned', 'active'] }
        };

        // Add status filter if specified
        if (status && status !== 'All') {
          queryFilter.status = status.toLowerCase();
        }

        // Add search filter if specified
        if (search) {
          queryFilter.$or = [
            { 'customer_data.first_name': { $regex: search, $options: 'i' } },
            { 'customer_data.last_name': { $regex: search, $options: 'i' } },
            { customer_email: { $regex: search, $options: 'i' } }
          ];
        }

        // Get carts from MongoDB with pagination
        const [carts, total] = await Promise.all([
          AbandonedCart.find(queryFilter)
            .sort({ last_activity: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
          AbandonedCart.countDocuments(queryFilter)
        ]);

        console.log('MongoDB query results:', {
          cartsFound: carts.length,
          totalCount: total,
          skip: skip,
          limit: parseInt(limit),
          queryFilter: queryFilter
        });

        // Format cart data
        const formattedCarts = carts.map(cart => ({
          id: cart._id,
          cart_id: cart.cart_id,
          customer_name: cart.customer_data?.first_name 
            ? `${cart.customer_data.first_name} ${cart.customer_data.last_name || ''}`
            : 'Guest',
          customer_email: cart.customer_email,
          timestamp: cart.timestamp,
          status: cart.status,
          cart: cart.items.map(item => ({
            ...item,
            name: item.product_name || item.name,
            product_name: item.product_name || item.name,
            image_url: item.image_url,
            variant_title: item.variant_title,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            properties: item.properties || {}
          })),
          total: cart.total,
          subtotal: cart.subtotal,
          tax: cart.tax,
          shipping: cart.shipping,
          sms_status: cart.sms_status,
          sms_attempts: cart.sms_attempts,
          sms_sent_at: cart.sms_sent_at,
          sms_delivered_at: cart.sms_delivered_at,
          last_sms_error: cart.last_sms_error,
          customer_data: cart.customer_data
        }));

        // Calculate pagination info
        const pages = Math.ceil(total / parseInt(limit));
        const currentPage = parseInt(page);
        const hasNextPage = currentPage < pages;
        const hasPrevPage = currentPage > 1;

        // Cache the response
        const responseData = {
          carts: formattedCarts,
          pagination: {
            page: currentPage,
            limit: parseInt(limit),
            total,
            pages,
            hasNextPage,
            hasPrevPage
          }
        };

        // Cache the response
        cartCache.set(cacheKey, {
          data: responseData,
          timestamp: Date.now()
        });

        console.log('Sending response to frontend:', {
          cartsCount: formattedCarts.length,
          pagination: responseData.pagination,
          sampleCart: formattedCarts[0] ? {
            id: formattedCarts[0].id,
            customer_name: formattedCarts[0].customer_name,
            items: formattedCarts[0].cart?.length || 0
          } : null
        });

        res.json(responseData);

      } catch (error) {
        console.error('Error fetching cart data:', error);
        res.status(500).json({
          error: 'Failed to fetch abandoned carts',
          message: error.message
        });
      }
    } else if (platform === 'shopify') {
      const shopifyUrl = connection.store_url;
      const headers = {
        'X-Shopify-Access-Token': connection.access_token,
        'Content-Type': 'application/json'
      };

      try {
        // Fetch abandoned checkouts
        const checkoutsResponse = await axios.get(`${shopifyUrl}/admin/api/2024-01/checkouts.json`, {
          headers,
          params: { status: 'open', limit: 250 }
        });
        const checkouts = checkoutsResponse.data.checkouts || [];

        // Save/update each checkout in MongoDB
        for (const checkout of checkouts) {
          // Process line items to get product details
          const processedItems = await Promise.all((checkout.line_items || []).map(async (item) => {
            try {
              // Fetch product details from Shopify
              const productResponse = await axios.get(
                `${shopifyUrl}/admin/api/2024-01/products/${item.product_id}.json`,
                { headers }
              );
              const product = productResponse.data.product;
              
              // Find the matching variant if it exists
              const variant = product.variants.find(v => v.id === item.variant_id);
              
              // Get the image URL
              let imageUrl = null;
              if (item.image_url) {
                imageUrl = item.image_url;
              } else if (variant && variant.image_id) {
                const variantImage = product.images.find(img => img.id === variant.image_id);
                imageUrl = variantImage ? variantImage.src : null;
              } else if (product.images && product.images.length > 0) {
                imageUrl = product.images[0].src;
              }

              return {
                product_id: String(item.product_id),
                variant_id: item.variant_id ? String(item.variant_id) : null,
                name: item.title,
                product_name: product.title,
                image_url: imageUrl,
                variant_title: item.variant_title || null,
                quantity: item.quantity,
                price: item.price,
                total: (parseFloat(item.price) * item.quantity).toFixed(2),
                sku: item.sku || variant?.sku || product.variants[0]?.sku,
                properties: item.properties || {}
              };
            } catch (error) {
              console.error(`Error fetching product details for item ${item.product_id}:`, error);
              // Return basic item data if product fetch fails
              return {
                product_id: String(item.product_id),
                variant_id: item.variant_id ? String(item.variant_id) : null,
                name: item.title,
                product_name: item.title,
                quantity: item.quantity,
                price: item.price,
                total: (parseFloat(item.price) * item.quantity).toFixed(2),
                properties: item.properties || {}
              };
          }
          }));

          // Preserve existing SMS fields
          const existing = await AbandonedCart.findOne({ platform, cart_id: String(checkout.id) });
          await AbandonedCart.findOneAndUpdate(
            { platform, cart_id: String(checkout.id) },
            {
              platform,
              cart_id: String(checkout.id),
              customer_id: checkout.customer?.id || null,
              customer_email: checkout.email,
              customer_data: checkout.customer,
              items: processedItems,
              total: checkout.total_price,
              subtotal: checkout.subtotal_price,
              tax: checkout.total_tax,
              shipping: checkout.shipping_price,
              status: 'abandoned',
              source: 'shopify',
              timestamp: new Date(checkout.created_at).getTime() / 1000,
              last_activity: new Date(checkout.updated_at),
              sms_status: existing?.sms_status,
              sms_attempts: existing?.sms_attempts,
              sms_sent_at: existing?.sms_sent_at,
              sms_delivered_at: existing?.sms_delivered_at,
              last_sms_error: existing?.last_sms_error
            },
            { upsert: true, new: true }
          );
        }

        // Build query filters for Shopify
        let queryFilter = {
          platform,
          status: { $in: ['abandoned', 'active'] }
        };

        // Add status filter if specified
        if (status && status !== 'All') {
          queryFilter.status = status.toLowerCase();
        }

        // Add search filter if specified
        if (search) {
          queryFilter.$or = [
            { 'customer_data.first_name': { $regex: search, $options: 'i' } },
            { 'customer_data.last_name': { $regex: search, $options: 'i' } },
            { customer_email: { $regex: search, $options: 'i' } }
          ];
        }

        // Get carts from MongoDB with pagination
        const [carts, total] = await Promise.all([
          AbandonedCart.find(queryFilter)
            .sort({ last_activity: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
          AbandonedCart.countDocuments(queryFilter)
        ]);

        console.log('MongoDB query results:', {
          cartsFound: carts.length,
          totalCount: total,
          skip: skip,
          limit: parseInt(limit),
          queryFilter: queryFilter
        });

        // Format cart data
        const formattedCarts = carts.map(cart => ({
          id: cart._id,
          cart_id: cart.cart_id,
          customer_name: cart.customer_data?.first_name 
            ? `${cart.customer_data.first_name} ${cart.customer_data.last_name || ''}`
            : 'Guest',
          customer_email: cart.customer_email,
          timestamp: cart.timestamp,
          status: cart.status,
          cart: cart.items.map(item => ({
            ...item,
            name: item.product_name || item.name,
            product_name: item.product_name || item.name,
            image_url: item.image_url,
            variant_title: item.variant_title,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            properties: item.properties || {}
          })),
          total: cart.total,
          subtotal: cart.subtotal,
          tax: cart.tax,
          shipping: cart.shipping,
          sms_status: cart.sms_status,
          sms_attempts: cart.sms_attempts,
          sms_sent_at: cart.sms_sent_at,
          sms_delivered_at: cart.sms_delivered_at,
          last_sms_error: cart.last_sms_error,
          customer_data: cart.customer_data
        }));

        res.json({
          carts: formattedCarts,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        });
      } catch (error) {
        console.error('Error fetching Shopify checkouts:', error);
        res.status(500).json({
          error: 'Failed to fetch abandoned carts',
          message: error.message
        });
      }
    } else {
      res.status(400).json({
        error: 'Invalid platform',
        message: 'Platform must be either "woocommerce" or "shopify"'
      });
    }
  } catch (error) {
    console.error('Error fetching abandoned carts:', error);
    res.status(500).json({
      error: 'Failed to fetch abandoned carts',
      message: error.message
    });
  }
};

// Get active carts
const getActiveCarts = async (req, res) => {
  try {
    const carts = await AbandonedCart.find({ status: 'active' })
      .sort({ last_activity: -1 });
    res.json(carts);
  } catch (error) {
    console.error('Error fetching active carts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Save cart data
const saveCart = async (req, res) => {
  const {
    platform,
    cart_id,
    customer_id,
    customer_email,
    customer_data,
    items,
    total,
    subtotal,
    tax,
    shipping,
    source,
    device_type,
    browser_info,
    timestamp
  } = req.body;

  console.log('=== Saving Cart ===');
  console.log('Cart details:', {
    platform,
    cart_id,
    customer: customer_data?.first_name || 'Guest',
    items: items?.length || 0,
    total,
    timestamp
  });

  try {
    // Check if cart already exists
    const existingCart = await AbandonedCart.findOne({ platform, cart_id });
    console.log('Cart exists in database:', !!existingCart);

    // First, update or insert customer data
    if (customer_data) {
      console.log('Updating customer data for:', customer_data.first_name || 'Guest');
      await Customer.findOneAndUpdate(
        { platform, customer_id },
        {
          platform,
          customer_id,
          customer_email,
          first_name: customer_data.first_name,
          last_name: customer_data.last_name,
          phone: customer_data.phone,
          address: customer_data.address,
          company: customer_data.company,
          is_registered: customer_data.is_registered
        },
        { upsert: true, new: true }
      );
    }

    // Then, update or insert cart data
    const savedCart = await AbandonedCart.findOneAndUpdate(
      { platform, cart_id },
      {
        platform,
        cart_id,
        customer_id,
        customer_email,
        customer_data,
        items,
        total,
        subtotal,
        tax,
        shipping,
        source,
        device_type,
        browser_info,
        timestamp,
        last_activity: new Date(timestamp * 1000),
        status: 'abandoned'  // Explicitly set status to abandoned
      },
      { upsert: true, new: true }
    );

    console.log('Cart saved successfully:', {
      cart_id: savedCart.cart_id,
      status: savedCart.status
    });

    // Create notification if cart is new OR if status changed to abandoned
    const shouldNotify = await shouldCreateNotification(savedCart, existingCart);

    if (shouldNotify) {
      console.log('=== Creating notification for abandoned cart ===');
              try {
          const notification = await notificationController.createNotification({
            platform,
            type: 'cart_abandoned',
            title: 'Abandoned Cart',
            message: `Customer ${customer_data?.first_name || 'Guest'} abandoned cart with ${items?.length || 0} items worth $${total}`,
            data: {
              cartId: savedCart._id,
              customerName: customer_data?.first_name 
                ? `${customer_data.first_name} ${customer_data.last_name || ''}`
                : 'Guest',
              total,
              itemCount: items?.length || 0,
              timestamp: new Date(timestamp * 1000).toISOString(),
              isNew: !existingCart,
              previousStatus: existingCart?.status,
              lastActivity: existingCart?.last_activity
            }
          }, req);
        console.log('Notification created successfully:', {
          notification_id: notification._id,
          cart_id,
          isNew: !existingCart,
          previousStatus: existingCart?.status
        });
      } catch (error) {
        console.error('Error creating notification:', {
          cart_id,
          error: error.message,
          stack: error.stack
        });
      }
    }

    res.json({ message: 'Cart data saved successfully' });
  } catch (error) {
    console.error('Error saving cart data:', {
      cart_id,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mark cart as recovered
const markCartRecovered = async (req, res) => {
  try {
    const { platform, cart_id, customer_email } = req.body;
    if (!platform || (!cart_id && !customer_email)) {
      return res.status(400).json({ error: 'platform and cart_id or customer_email are required' });
    }
    const query = { platform };
    if (cart_id) query.cart_id = cart_id;
    if (customer_email) query.customer_email = customer_email;
    const cart = await AbandonedCart.findOneAndUpdate(
      query,
      { status: 'recovered' },
      { new: true }
    );
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    res.json({ message: 'Cart marked as recovered', cart });
  } catch (error) {
    console.error('Error marking cart as recovered:', error);
    res.status(500).json({ error: 'Failed to mark cart as recovered' });
  }
};

// Add cache invalidation when cart status changes
const invalidateCartCache = () => {
  cartCache.clear();
};

// Update the sendReminder function to create notifications
const sendReminder = async (req, res) => {
  try {
    const { cartId, type } = req.body;
    const cart = await AbandonedCart.findOne({ cart_id: cartId });
    
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    let status = 'sent';
    let error = null;

    try {
      switch (type) {
        case 'sms':
          // Existing SMS sending logic
          await sendSmsReminder(cart);
          break;
        case 'email':
          // Existing email sending logic
          await sendEmailReminder(cart);
          break;
        case 'whatsapp':
          // Existing WhatsApp sending logic
          await sendWhatsAppReminder(cart);
          break;
        default:
          throw new Error('Invalid reminder type');
      }
    } catch (err) {
      status = 'failed';
      error = err.message;
      throw err;
    } finally {
      // Create notification regardless of success/failure
      await createCommunicationNotification(cart, type, status, error);
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCarts,
  getCartById,
  updateCartStatus,
  getAbandonedCarts,
  getActiveCarts,
  saveCart,
  markCartRecovered,
  sendReminder
};
