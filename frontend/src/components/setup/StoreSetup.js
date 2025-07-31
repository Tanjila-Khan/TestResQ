import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import config from '../../config';

const StoreSetup = ({ onConnected }) => {
  const [platform, setPlatform] = useState('woocommerce');
  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [subscription, setSubscription] = useState({ plan: null, status: null });

  useEffect(() => {
    // Fetch subscription status on mount
    const fetchSubscription = async () => {
      try {
        const response = await api.get('/api/subscribe/status');
        setSubscription(response.data);
      } catch (err) {
        console.error('Error fetching subscription:', err);
        setSubscription({ plan: null, status: null });
      }
    };
    fetchSubscription();
  }, []);

  // Show subscription required message if not subscribed
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Subscription Required</h2>
          <p className="text-gray-600 mb-6">
            You need an active subscription to connect your store and access CartResQ features.
          </p>
          <a
            href="/pricing"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Choose a Plan
          </a>
        </div>
      </div>
    );
  }

  const handleConnect = async (e) => {
    e.preventDefault();
    setIsConnecting(true);
    setError(null);

    try {
      // Clean up the store URL
      let cleanUrl = storeUrl.trim();
      
      if (platform === 'shopify') {
        // For Shopify, ensure we're using HTTPS
        if (!cleanUrl.startsWith('http')) {
          cleanUrl = `https://${cleanUrl}`;
        }
        cleanUrl = cleanUrl.replace('http://', 'https://');
      } else {
        // For WooCommerce, handle localhost with HTTP
        if (cleanUrl.includes('localhost')) {
          cleanUrl = cleanUrl.replace('https://', 'http://');
        } else if (!cleanUrl.startsWith('http')) {
          cleanUrl = `http://${cleanUrl}`;
        }
      }
      
      cleanUrl = cleanUrl.replace(/\/$/, ''); // Remove trailing slash

      console.log('Connecting to store:', cleanUrl);
      
      // Validate required fields
      if (!cleanUrl) {
        throw new Error('Store URL is required');
      }

      if (platform === 'woocommerce' && (!consumerKey || !consumerSecret)) {
        throw new Error('Consumer key and secret are required for WooCommerce');
      }

      if (platform === 'shopify' && !accessToken) {
        throw new Error('Access token is required for Shopify');
      }

      const response = await api.post('/api/stores/connect-store', {
        platform,
        store_url: cleanUrl,
        ...(platform === 'woocommerce' ? {
          consumer_key: consumerKey.trim(),
          consumer_secret: consumerSecret.trim()
        } : {
          access_token: accessToken.trim()
        })
      });

      console.log('Store connection response:', response.data);

      if (response.data.status === 'success' || response.data.success) {
        console.log('Successfully connected to store');
        // Save store connection details
        const storeConnection = {
          platform,
          store_url: cleanUrl,
          ...(platform === 'woocommerce' ? {
            consumer_key: consumerKey,
            consumer_secret: consumerSecret
          } : {
            access_token: accessToken
          })
        };
        localStorage.setItem('store_connection', JSON.stringify(storeConnection));
        localStorage.setItem('platform', platform);
        localStorage.setItem('storeUrl', cleanUrl);
        localStorage.setItem('isConnected', 'true');
        
        // Call onConnected if provided, otherwise redirect directly
        if (onConnected && typeof onConnected === 'function') {
        onConnected(cleanUrl);
        } else {
          // Redirect to dashboard after successful connection
          window.location.href = '/dashboard';
        }
      } else {
        throw new Error(response.data.message || 'Failed to connect to store');
      }
    } catch (err) {
      console.error('Connection error:', err.response?.data || err.message);
      let errorMessage = 'Failed to connect to store. Please check your credentials and try again.';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Add helpful message for SSL errors
      if (err.response?.data?.details?.message?.includes('certificate')) {
        errorMessage += ' For local development, try using http:// instead of https://.';
      }
      
      setError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connect Your Store
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your store details to get started
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleConnect}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="woocommerce">WooCommerce</option>
                <option value="shopify">Shopify</option>
              </select>
            </div>

            <div>
              <label htmlFor="storeUrl" className="block text-sm font-medium text-gray-700">
                Store URL
              </label>
              <div className="mt-1">
                <input
                  id="storeUrl"
                  name="storeUrl"
                  type="text"
                  required
                  placeholder={platform === 'woocommerce' ? "https://your-store.com or http://localhost/wordpress" : "your-store.myshopify.com"}
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {platform === 'woocommerce' 
                  ? 'Enter your WooCommerce store URL (e.g., https://your-store.com or http://localhost/wordpress)'
                  : 'Enter your Shopify store URL (e.g., your-store.myshopify.com)'}
              </p>
            </div>

            {platform === 'woocommerce' ? (
              <>
                <div>
                  <label htmlFor="consumerKey" className="block text-sm font-medium text-gray-700">
                    Consumer Key
                  </label>
                  <div className="mt-1">
                    <input
                      id="consumerKey"
                      name="consumerKey"
                      type="text"
                      required
                      placeholder="ck_..."
                      value={consumerKey}
                      onChange={(e) => setConsumerKey(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="consumerSecret" className="block text-sm font-medium text-gray-700">
                    Consumer Secret
                  </label>
                  <div className="mt-1">
                    <input
                      id="consumerSecret"
                      name="consumerSecret"
                      type="password"
                      required
                      placeholder="cs_..."
                      value={consumerSecret}
                      onChange={(e) => setConsumerSecret(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700">
                  Access Token
                </label>
                <div className="mt-1">
                  <input
                    id="accessToken"
                    name="accessToken"
                    type="password"
                    required
                    placeholder="shpat_..."
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="text-sm text-gray-500">
              {platform === 'woocommerce' ? (
                <>
                  <p>To get your WooCommerce API keys:</p>
                  <ol className="list-decimal pl-4 mt-2 space-y-1">
                    <li>Go to your WordPress admin panel</li>
                    <li>Navigate to WooCommerce {'>'} Settings {'>'} Advanced {'>'} REST API</li>
                    <li>Click "Add Key"</li>
                    <li>Set Description (e.g., "Cart Recovery")</li>
                    <li>Set User to an admin account</li>
                    <li>Set Permissions to "Read/Write"</li>
                    <li>Click "Generate API Key"</li>
                    <li>Copy the Consumer Key and Consumer Secret</li>
                  </ol>
                </>
              ) : (
                <>
                  <p>To get your Shopify access token:</p>
                  <ol className="list-decimal pl-4 mt-2 space-y-1">
                    <li>Go to your Shopify admin panel</li>
                    <li>Navigate to Settings {'>'} Apps and sales channels</li>
                    <li>Click "Develop apps"</li>
                    <li>Create a new app or select an existing one</li>
                    <li>Under "API credentials", generate an access token</li>
                    <li>Make sure the app has access to "Read abandoned checkouts"</li>
                  </ol>
                </>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Connection failed
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isConnecting}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  isConnecting
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                }`}
              >
                {isConnecting ? 'Connecting...' : 'Connect Store'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StoreSetup; 