/**
 * Get the current platform from URL params, localStorage, or store connection
 * @param {string} locationSearch - The location.search string from useLocation()
 * @returns {string} The platform ('shopify' or 'woocommerce')
 */
export const getCurrentPlatform = (locationSearch = '') => {
  // First try URL params
  const urlPlatform = new URLSearchParams(locationSearch).get('platform');
  if (urlPlatform) return urlPlatform;
  
  // Then try localStorage
  const storedPlatform = localStorage.getItem('platform');
  if (storedPlatform) return storedPlatform;
  
  // Finally try store connection
  const storeConnection = localStorage.getItem('store_connection');
  if (storeConnection) {
    try {
      const connection = JSON.parse(storeConnection);
      return connection.platform;
    } catch (err) {
      console.error('Error parsing store connection:', err);
    }
  }
  
  // Default fallback
  return 'woocommerce';
};

/**
 * Get the store connection data
 * @returns {Object|null} The store connection object or null
 */
export const getStoreConnection = () => {
  const storeConnection = localStorage.getItem('store_connection');
  if (storeConnection) {
    try {
      return JSON.parse(storeConnection);
    } catch (err) {
      console.error('Error parsing store connection:', err);
      return null;
    }
  }
  return null;
};

/**
 * Check if a store is connected
 * @returns {boolean} True if a store is connected
 */
export const isStoreConnected = () => {
  return localStorage.getItem('isConnected') === 'true';
}; 