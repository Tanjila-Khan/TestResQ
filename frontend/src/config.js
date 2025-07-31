const config = {
  apiBaseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3003',
  wsUrl: process.env.REACT_APP_WS_URL || 'ws://localhost:3003'
};

export default config; 