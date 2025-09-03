// Auto-detect environment and set appropriate URLs
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('192.168.');

const config = {
  // API URL - auto-detect based on environment
  apiBaseUrl: process.env.REACT_APP_API_URL || 
               (isDevelopment ? 'http://localhost:3003' : 'https://api.cartresq.com'),
  
  // WebSocket URL - auto-detect based on environment
  wsUrl: process.env.REACT_APP_WS_URL || 
         (isDevelopment ? 'ws://localhost:3003' : 'wss://api.cartresq.com')
};

// Log the detected configuration for debugging
if (isDevelopment) {
  console.log('🌱 Development mode detected');
  console.log('📍 API Base URL:', config.apiBaseUrl);
  console.log('🔌 WebSocket URL:', config.wsUrl);
} else {
  console.log('🚀 Production mode detected');
  console.log('📍 API Base URL:', config.apiBaseUrl);
  console.log('🔌 WebSocket URL:', config.wsUrl);
}

export default config; 