require('dotenv').config();
const app = require('./app');
const http = require('http');
const { initializeSocket } = require('./socket');

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket
initializeSocket(server);

// Handle server shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal. Shutting down server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT signal. Shutting down server...');
  process.exit(0);
});

const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('WebSocket server initialized');
});

