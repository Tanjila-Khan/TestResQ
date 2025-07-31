const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const axios = require('axios');
const Customer = require('../models/Customer');
const AbandonedCart = require('../models/AbandonedCart');
const StoreConnection = require('../models/StoreConnection');

const connectStore = async (req, res) => {
  console.log('connectStore function called with body:', req.body);
  try {
    const { platform, store_url, consumer_key, consumer_secret, access_token } = req.body;
    const userId = req.user._id; // Get user ID from authenticated request

    console.log('Connection attempt:', { platform, store_url, userId });

    // Validate required fields
    if (!platform || !store_url) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Platform and store URL are required'
      });
    }

    // Normalize store URL
    let normalizedUrl = store_url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, ''); // Remove trailing slashes

    console.log('Normalized URL:', normalizedUrl);

    if (platform === 'woocommerce') {
      if (!consumer_key || !consumer_secret) {
        return res.status(400).json({ 
          error: 'Missing WooCommerce credentials',
          message: 'Consumer key and secret are required for WooCommerce'
        });
      }

      // Initialize WooCommerce API client with SSL verification disabled
      const api = new WooCommerceRestApi({
        url: normalizedUrl,
        consumerKey: consumer_key.trim(),
        consumerSecret: consumer_secret.trim(),
        version: 'wc/v3',
        queryStringAuth: true,
        verifySsl: false
      });

      console.log('Testing WooCommerce connection...');

      try {
        // Test the connection with a simple endpoint first
        const systemStatus = await api.get('system_status');
        console.log('System status response:', systemStatus.status);

        if (systemStatus.status !== 200) {
          throw new Error(`Failed to connect to WooCommerce. Status: ${systemStatus.status}`);
        }

        // Store connection details in MongoDB - user-specific
        const connection = await StoreConnection.findOneAndUpdate(
          { userId, platform },
          {
            userId,
            platform,
            store_url: normalizedUrl,
            consumer_key,
            consumer_secret,
            access_token: null,
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );

        console.log('Store connection saved:', connection);

        res.json({
          status: 'success',
          message: 'Store connected successfully',
          data: {
            store_url: normalizedUrl,
            platform: platform,
            environment: systemStatus.data.environment
          }
        });
      } catch (err) {
        console.error('WooCommerce connection error:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });

        // Try HTTP if HTTPS fails
        if (normalizedUrl.startsWith('https://')) {
          const httpUrl = normalizedUrl.replace('https://', 'http://');
          console.log('Trying HTTP connection:', httpUrl);

          try {
            const httpApi = new WooCommerceRestApi({
              url: httpUrl,
              consumerKey: consumer_key.trim(),
              consumerSecret: consumer_secret.trim(),
              version: 'wc/v3',
              queryStringAuth: true,
              verifySsl: false
            });

            const response = await httpApi.get('system_status');
            console.log('HTTP connection successful:', response.status);
            
            // Store connection details with HTTP URL in MongoDB - user-specific
            const connection = await StoreConnection.findOneAndUpdate(
              { userId, platform },
              {
                userId,
                platform,
                store_url: httpUrl,
                consumer_key,
                consumer_secret,
                access_token: null,
                updatedAt: new Date()
              },
              { upsert: true, new: true }
            );

            console.log('Store connection saved:', connection);

            res.json({
              status: 'success',
              message: 'Store connected successfully (using HTTP)',
              data: {
                store_url: httpUrl,
                platform: platform,
                environment: response.data.environment
              }
            });
            return;
          } catch (httpErr) {
            console.error('HTTP connection attempt failed:', {
              message: httpErr.message,
              response: httpErr.response?.data,
              status: httpErr.response?.status
            });
          }
        }

        // If we get here, both HTTPS and HTTP attempts failed
        res.status(401).json({
          error: 'Failed to connect to WooCommerce',
          message: err.response?.data?.message || err.message,
          details: {
            status: err.response?.status,
            data: err.response?.data,
            url: err.config?.url
          }
        });
      }
    } else if (platform === 'shopify') {
      if (!access_token) {
        return res.status(400).json({
          error: 'Missing Shopify credentials',
          message: 'Access token is required for Shopify'
        });
      }

      try {
        // Test Shopify connection
        const response = await axios.get(`${normalizedUrl}/admin/api/2024-01/shop.json`, {
          headers: {
            'X-Shopify-Access-Token': access_token,
            'Content-Type': 'application/json'
          }
        });

        if (response.status !== 200) {
          throw new Error(`Failed to connect to Shopify. Status: ${response.status}`);
        }

        // Store connection details in MongoDB - user-specific
        const connection = await StoreConnection.findOneAndUpdate(
          { userId, platform },
          {
            userId,
            platform,
            store_url: normalizedUrl,
            consumer_key: null,
            consumer_secret: null,
            access_token,
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );

        console.log('Store connection saved:', connection);

        res.json({
          status: 'success',
          message: 'Store connected successfully',
          data: {
            store_url: normalizedUrl,
            platform: platform,
            shop: response.data.shop
          }
        });
      } catch (err) {
        console.error('Shopify connection error:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });

        res.status(401).json({
          error: 'Failed to connect to Shopify',
          message: err.response?.data?.message || err.message,
          details: {
            status: err.response?.status,
            data: err.response?.data
          }
        });
      }
    } else {
      res.status(400).json({
        error: 'Invalid platform',
        message: 'Platform must be either "woocommerce" or "shopify"'
      });
    }
  } catch (err) {
    console.error('Store connection error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
};

// Check if user has a connected store
const checkUserStoreConnection = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const connection = await StoreConnection.findOne({ userId })
      .sort({ updatedAt: -1 });
    
    if (connection) {
      res.json({
        hasConnection: true,
        platform: connection.platform,
        store_url: connection.store_url,
        connectedAt: connection.connectedAt
      });
    } else {
      res.json({
        hasConnection: false
      });
    }
  } catch (err) {
    console.error('Error checking user store connection:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
};

const getCustomers = async (req, res) => {
  try {
    const { platform } = req.query;
    const userId = req.user._id;
    console.log('Getting customers for platform:', platform, 'user:', userId);

    const storeConnection = await StoreConnection.findOne({ userId, platform });
    if (!storeConnection) {
      return res.status(404).json({ error: 'Store connection not found' });
    }

    const { limit = 100, page = 1 } = req.query;
    const perPage = Math.min(parseInt(limit), 100); // Max 100 per page
    const offset = (parseInt(page) - 1) * perPage;

    let customers = [];
    if (platform === 'woocommerce') {
      const api = new WooCommerceRestApi({
        url: storeConnection.store_url,
        consumerKey: storeConnection.consumer_key,
        consumerSecret: storeConnection.consumer_secret,
        version: 'wc/v3',
        queryStringAuth: true,
        verifySsl: false
      });

      const response = await api.get('customers', {
        per_page: perPage,
        page: parseInt(page)
      });
      customers = response.data;
    } else if (platform === 'shopify') {
      const response = await axios.get(`${storeConnection.store_url}/admin/api/2024-01/customers.json`, {
        headers: {
          'X-Shopify-Access-Token': storeConnection.access_token,
          'Content-Type': 'application/json'
        },
        params: {
          limit: perPage,
          page_info: page > 1 ? `page_${page}` : undefined
        }
      });
      customers = response.data.customers;
    }

    res.json(customers);
  } catch (error) {
    console.error('Error getting customers:', error);
    res.status(500).json({ error: 'Failed to get customers' });
  }
};

const getRecentCustomers = async (req, res) => {
  try {
    const { platform } = req.query;
    const customers = await Customer.find(platform ? { platform } : {})
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(customers);
  } catch (error) {
    console.error('Error getting recent customers:', error);
    res.status(500).json({ error: 'Failed to get recent customers' });
  }
};

// Disconnect store - delete user's store connection
const disconnectStore = async (req, res) => {
  try {
    const userId = req.user._id;
    const { platform } = req.query;
    
    console.log('Disconnecting store for user:', userId, 'platform:', platform);
    
    // Delete the store connection for this user and platform
    const result = await StoreConnection.deleteMany({ 
      userId,
      ...(platform && { platform }) // Only filter by platform if provided
    });
    
    console.log('Deleted store connections:', result.deletedCount);
    
    res.json({
      success: true,
      message: 'Store disconnected successfully',
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Error disconnecting store:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
};

module.exports = {
  connectStore,
  getCustomers,
  getRecentCustomers,
  checkUserStoreConnection,
  disconnectStore
}; 