require('dotenv').config();
const { emailScheduler } = require('./services/emailScheduler');
const { connectDB } = require('./db');

const TEST_CONFIG = {
  cartId: 't_e631d81f29a069b1c27917d73483d9',
  platform: 'woocommerce',
  storeUrl: 'http://jexla.net/Shop',
  delayHours: 0 // Send immediately for testing
};

async function testManualEmailScheduling() {
  console.log('🧪 Testing Manual Email Scheduling System');
  console.log('==========================================');
  
  try {
    // Connect to database
    console.log('\n1️⃣ Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');
    
    // Initialize email scheduler
    console.log('\n2️⃣ Initializing email scheduler...');
    await emailScheduler.initialize();
    console.log('✅ Email scheduler initialized');
    
    // Check queue status
    console.log('\n3️⃣ Checking queue status...');
    const queueStatus = await emailScheduler.getQueueStatus();
    console.log('📊 Queue status:', queueStatus);
    
    // Schedule a test email
    console.log('\n4️⃣ Scheduling test email...');
    await emailScheduler.scheduleAbandonedCartReminder(
      TEST_CONFIG.cartId,
      TEST_CONFIG.platform,
      TEST_CONFIG.storeUrl,
      TEST_CONFIG.delayHours,
      'manual'
    );
    console.log('✅ Test email scheduled successfully');
    
    // Check queue status again
    console.log('\n5️⃣ Checking updated queue status...');
    const updatedQueueStatus = await emailScheduler.getQueueStatus();
    console.log('📊 Updated queue status:', updatedQueueStatus);
    
    // Wait a moment for the job to process
    console.log('\n6️⃣ Waiting for job to process...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check final queue status
    console.log('\n7️⃣ Checking final queue status...');
    const finalQueueStatus = await emailScheduler.getQueueStatus();
    console.log('📊 Final queue status:', finalQueueStatus);
    
    console.log('\n✅ Manual email scheduling test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Graceful shutdown
    console.log('\n🔄 Shutting down...');
    await emailScheduler.gracefulShutdown();
    process.exit(0);
  }
}

// Run the test
testManualEmailScheduling(); 