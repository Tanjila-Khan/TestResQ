const cronScheduler = require('./services/cronScheduler');
const { emailScheduler } = require('./services/emailScheduler');

console.log('🧪 Starting Offline Email Scheduler Tests...\n');

// Test configuration
const TEST_CONFIG = {
  email: 'test@example.com',
  cartId: 'test_cart_123',
  platform: 'woocommerce',
  storeUrl: 'https://teststore.com'
};

async function testSchedulerInitialization() {
  console.log('1️⃣ Testing Scheduler Initialization...');
  
  try {
    await cronScheduler.initialize();
    console.log('✅ Cron Scheduler initialized successfully');
    
    const status = cronScheduler.getStatus();
    console.log('📊 Cron Status:', status);
    
    return true;
  } catch (error) {
    console.error('❌ Cron Scheduler initialization failed:', error.message);
    return false;
  }
}

async function testEmailSchedulerInitialization() {
  console.log('\n2️⃣ Testing Email Scheduler Initialization...');
  
  try {
    await emailScheduler.initialize();
    console.log('✅ Email Scheduler initialized successfully');
    
    const queueStatus = await emailScheduler.getQueueStatus();
    console.log('📊 Email Queue Status:', queueStatus);
    
    return true;
  } catch (error) {
    console.error('❌ Email Scheduler initialization failed:', error.message);
    return false;
  }
}

async function testManualEmailScheduling() {
  console.log('\n3️⃣ Testing Manual Email Scheduling...');
  
  try {
    // Schedule a test reminder
    await emailScheduler.scheduleAbandonedCartReminder(
      TEST_CONFIG.cartId,
      TEST_CONFIG.platform,
      TEST_CONFIG.storeUrl,
      0, // Send immediately
      'first'
    );
    
    console.log('✅ Test email scheduled successfully');
    
    // Check queue status
    const queueStatus = await emailScheduler.getQueueStatus();
    console.log('📊 Updated queue status:', queueStatus);
    
    return true;
  } catch (error) {
    console.error('❌ Manual email scheduling failed:', error.message);
    return false;
  }
}

async function testCronJobTriggers() {
  console.log('\n4️⃣ Testing Cron Job Triggers...');
  
  try {
    // Test first reminders trigger
    await cronScheduler.triggerFirstReminders();
    console.log('✅ First reminders trigger working');
    
    // Test second reminders trigger
    await cronScheduler.triggerSecondReminders();
    console.log('✅ Second reminders trigger working');
    
    // Test final reminders trigger
    await cronScheduler.triggerFinalReminders();
    console.log('✅ Final reminders trigger working');
    
    // Test discount offers trigger
    await cronScheduler.triggerDiscountOffers();
    console.log('✅ Discount offers trigger working');
    
    return true;
  } catch (error) {
    console.error('❌ Cron job triggers failed:', error.message);
    return false;
  }
}

async function testEmailGeneration() {
  console.log('\n5️⃣ Testing Email Generation...');
  
  try {
    // Mock cart data
    const mockCart = {
      cart_id: TEST_CONFIG.cartId,
      customer_email: TEST_CONFIG.email,
      platform: TEST_CONFIG.platform,
      items: [
        {
          product_name: 'Test Product',
          price: 29.99,
          quantity: 2
        }
      ],
      total: 59.98,
      status: 'abandoned'
    };
    
    // Test reminder email generation
    const reminderEmail = await emailScheduler.generateReminderEmail(
      mockCart,
      'first',
      TEST_CONFIG.storeUrl
    );
    
    console.log('✅ Reminder email generated successfully');
    console.log('📧 Subject:', reminderEmail.subject);
    console.log('📧 HTML length:', reminderEmail.html.length);
    
    // Test discount email generation
    const discountEmail = await emailScheduler.generateDiscountEmail(
      mockCart,
      'SAVE10',
      10,
      'percentage',
      TEST_CONFIG.storeUrl
    );
    
    console.log('✅ Discount email generated successfully');
    console.log('📧 Subject:', discountEmail.subject);
    console.log('📧 HTML length:', discountEmail.html.length);
    
    return true;
  } catch (error) {
    console.error('❌ Email generation failed:', error.message);
    return false;
  }
}

async function testJobCancellation() {
  console.log('\n6️⃣ Testing Job Cancellation...');
  
  try {
    await emailScheduler.cancelCartJobs(TEST_CONFIG.cartId);
    console.log('✅ Job cancellation working');
    
    return true;
  } catch (error) {
    console.error('❌ Job cancellation failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  const results = {
    schedulerInit: false,
    emailInit: false,
    manualScheduling: false,
    cronTriggers: false,
    emailGeneration: false,
    jobCancellation: false
  };
  
  try {
    results.schedulerInit = await testSchedulerInitialization();
    results.emailInit = await testEmailSchedulerInitialization();
    results.manualScheduling = await testManualEmailScheduling();
    results.cronTriggers = await testCronJobTriggers();
    results.emailGeneration = await testEmailGeneration();
    results.jobCancellation = await testJobCancellation();
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test}`);
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Email scheduling system is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
  }
  
  console.log('='.repeat(50));
  
  // Cleanup
  try {
    cronScheduler.stop();
    console.log('\n🧹 Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

// Run the tests
runAllTests().catch(console.error); 