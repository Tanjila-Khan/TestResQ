const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');
// const campaignRoutes = require('./routes/campaignRoutes'); // Commented out - using campaigns.js instead
const cartRoutes = require('./routes/cartRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const emailRoutes = require('./routes/emailRoutes');
const storeRoutes = require('./routes/storeRoutes');
const smsRoutes = require('./routes/sms');
const whatsappRoutes = require('./routes/whatsapp');

const couponRoutes = require('./routes/couponRoutes');
const campaignsRouter = require('./routes/campaigns');
const authRouter = require('./routes/auth');
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const subscriptionRoutes = require('./routes/subscription');
const schedulerRoutes = require('./routes/schedulerRoutes');
const customerRoutes = require('./routes/customerRoutes');

// Initialize email scheduler only (no automatic cron scheduler)
const { emailScheduler } = require('./services/emailScheduler');

const app = express();

// Connect to MongoDB
connectDB();

// Initialize email scheduler after database connection (for manual scheduling only)
(async () => {
  try {
    await emailScheduler.initialize();
    console.log('✅ Email Scheduler started successfully (manual scheduling only)');
  } catch (error) {
    console.error('❌ Failed to start Email Scheduler:', error);
  }
})();



// CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://192.168.0.106:3000',
    'https://jexla.net',
    'https://cartresq-1.onrender.com',
    'https://cartresq-yiq2.onrender.com'
    ];
    
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Add CORS headers to all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS, PATCH'
  );
  next();
});

// Add CORS error handling
app.use((err, req, res, next) => {
  if (err.message.includes('CORS')) {
    console.error('CORS Error:', {
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
      headers: req.headers
    });
    return res.status(403).json({
      error: 'CORS Error',
      message: err.message,
      origin: req.headers.origin
    });
  }
  next(err);
});

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Request headers:', req.headers);
  next();
});

app.use(express.json());

// Debug middleware to log request body
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Routes
app.use('/api/campaigns', campaignsRouter);
app.use('/api/carts', cartRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/subscribe', subscriptionRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/customers', customerRoutes);

// Remove duplicate route - this is handled by /api/stores/connect-store

// Add /settings route
app.get('/settings', (req, res) => {
  res.json({ message: 'Settings page' });
});

// Debug route to check if routes are registered
app.get('/api/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  res.json(routes);
});

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Something broke!',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app; 