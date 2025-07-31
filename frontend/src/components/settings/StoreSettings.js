import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import config from '../../config';

const StoreSettings = () => {
  const [selectedPlatform, setSelectedPlatform] = useState('woocommerce');
  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load saved connection on component mount
    const savedConnection = localStorage.getItem(`${selectedPlatform}_connection`);
    if (savedConnection) {
      const connectionData = JSON.parse(savedConnection);
      setStoreUrl(connectionData.storeUrl || '');
      setConsumerKey(connectionData.consumerKey || '');
      setConsumerSecret(connectionData.consumerSecret || '');
      setAccessToken(connectionData.accessToken || '');
      setIsConnected(true);
    } else {
      // Reset form when platform changes
      setStoreUrl('');
      setConsumerKey('');
      setConsumerSecret('');
      setAccessToken('');
      setIsConnected(false);
    }
  }, [selectedPlatform]);

  const connectStore = async () => {
    try {
      setError(null);
      let response;
      let connectionData;

      if (selectedPlatform === 'shopify') {
        response = await api.post('/api/stores/connect-store', {
          platform: selectedPlatform,
          store_url: storeUrl,
          access_token: accessToken
        });
        connectionData = { storeUrl, accessToken };
      } else {
        // WooCommerce connection
        response = await api.post('/api/stores/connect-store', {
          platform: selectedPlatform,
          store_url: storeUrl,
          consumer_key: consumerKey,
          consumer_secret: consumerSecret
        });
        connectionData = { storeUrl, consumerKey, consumerSecret };
      }

      if (response.data.success) {
        setIsConnected(true);
        // Save connection details to local storage
        localStorage.setItem(`${selectedPlatform}_connection`, JSON.stringify(connectionData));
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to connect to ${selectedPlatform}`);
      setIsConnected(false);
    }
  };

  const disconnectStore = async () => {
    try {
      // Call backend to disconnect store
      await api.delete('/api/stores/disconnect', {
        params: { platform: selectedPlatform }
      });
      
      // Clear localStorage
    localStorage.removeItem(`${selectedPlatform}_connection`);
      localStorage.removeItem('isConnected');
      localStorage.removeItem('platform');
      localStorage.removeItem('storeUrl');
      localStorage.removeItem('store_connection');
      
      // Reset form
    setStoreUrl('');
    setConsumerKey('');
    setConsumerSecret('');
    setAccessToken('');
    setIsConnected(false);
      
      alert('Store disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting store:', error);
      alert('Failed to disconnect store. Please try again.');
    }
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Store Connection Settings</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Platform
          </label>
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="woocommerce">WooCommerce</option>
            <option value="shopify">Shopify</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Store URL
          </label>
          <input
            type="text"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            placeholder="https://your-store.com"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {selectedPlatform === 'woocommerce' ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Consumer Key
              </label>
              <input
                type="text"
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                placeholder="ck_..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Consumer Secret
              </label>
              <input
                type="password"
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                placeholder="cs_..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        ) : (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Token
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="shpat_..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-4">
          {isConnected ? (
            <button
              onClick={disconnectStore}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={connectStore}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Connect
            </button>
          )}
        </div>

        <div className="mt-6 text-sm text-gray-500">
          {selectedPlatform === 'shopify' ? (
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
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreSettings; 