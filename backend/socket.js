const socketIO = require('socket.io');

let io;

const initializeSocket = (server) => {
  console.log('Initializing socket.io server...');
  
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://www.cartresq.com',
    'https://cartresq.com',
    'https://cartresq-1.onrender.com'
  ];
  
  io = socketIO(server, {
    cors: {
      origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) {
          return callback(null, true);
        }
        
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          console.log('Blocked by Socket.io CORS:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true,
    transports: ['polling', 'websocket'],
    maxHttpBufferSize: 1e6
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle platform room joining
    socket.on('join-platform', (platform) => {
      try {
        console.log(`Client ${socket.id} joining platform room:`, platform);
        socket.join(platform);
        console.log(`Client ${socket.id} successfully joined platform room:`, platform);
        
        // Send a test notification to verify the connection (only if not skipped)
        const skipTestNotification = socket.handshake.query.skipTestNotification === 'true';
        if (!skipTestNotification) {
          socket.emit('notification', {
            type: 'new',
            notification: {
              _id: `test_${socket.id}_${Date.now()}`,
              type: 'connection_test',
              title: 'Connection Test',
              message: 'Successfully connected to notification system',
              platform,
              createdAt: new Date(),
              read: false
            }
          });
        }
      } catch (error) {
        console.error('Error joining platform room:', error);
        socket.emit('error', { message: 'Failed to join platform room' });
      }
    });

    // Handle platform room leaving
    socket.on('leave-platform', (platform) => {
      try {
        console.log(`Client ${socket.id} leaving platform room:`, platform);
        socket.leave(platform);
        console.log(`Client ${socket.id} successfully left platform room:`, platform);
      } catch (error) {
        console.error('Error leaving platform room:', error);
        socket.emit('error', { message: 'Failed to leave platform room' });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Client disconnected:', socket.id, 'Reason:', reason);
    });

    socket.on('error', (error) => {
      console.error('Socket error for client', socket.id, ':', error);
    });
  });

  // Handle server errors with better logging
  io.engine.on('connection_error', (err) => {
    // Don't log the full request object to avoid clutter
    console.error('Socket.IO connection error:', {
      code: err.code,
      message: err.message,
      context: err.context || {}
    });
  });

  console.log('Socket.io server initialized successfully');
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

const emitToPlatform = (platform, event, data) => {
  if (io) {
    io.to(platform).emit(event, data);
  }
};

module.exports = {
  initializeSocket,
  getIO,
  emitToPlatform
}; 