require('dotenv').config();
console.log('Loaded ENV:', {
  ZOHO_EMAIL_USER: process.env.ZOHO_EMAIL_USER,
  ZOHO_EMAIL_PASSWORD: process.env.ZOHO_EMAIL_PASSWORD ? 'SET' : 'NOT SET',
  ZOHO_EMAIL: process.env.ZOHO_EMAIL,
  MONGODB_URI: process.env.MONGODB_URI
});
const cronScheduler = require('./services/cronScheduler');
const { connectDB } = require('./db');

console.log('🚀 Starting CartResQ Email Worker...');

// Connect to MongoDB and start scheduler
async function startWorker() {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');

    // Initialize cron scheduler
    await cronScheduler.initialize();
    console.log('✅ Email Worker started successfully');

    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log('🛑 Shutting down Email Worker...');
      cronScheduler.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('🛑 Shutting down Email Worker...');
      cronScheduler.stop();
      process.exit(0);
    });

    // Log status every hour
    setInterval(() => {
      const status = cronScheduler.getStatus();
      console.log('📊 Worker Status:', status);
    }, 60 * 60 * 1000); // Every hour

  } catch (error) {
    console.error('❌ Failed to start Email Worker:', error);
    process.exit(1);
  }
}

// Start the worker
startWorker(); 