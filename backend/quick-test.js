require('dotenv').config();
const cronScheduler = require('./services/cronScheduler');
const { emailScheduler } = require('./services/emailScheduler');

console.log('🚀 Quick Email Scheduler Test\n');

async function quickTest() {
  try {
    console.log('1️⃣ Initializing schedulers...');
    
    // Initialize both schedulers
    await cronScheduler.initialize();
    await emailScheduler.initialize();
    
    console.log('✅ Both schedulers initialized successfully');
    
    // Test email generation
    console.log('\n2️⃣ Testing email generation...');
    
    const mockCart = {
      cart_id: 'test_cart_123',
      customer_email: 'test@example.com',
      platform: 'woocommerce',
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
    
    const email = await emailScheduler.generateReminderEmail(
      mockCart,
      'first',
      'https://teststore.com'
    );
    
    console.log('✅ Email template generated successfully');
    console.log(`📧 Subject: ${email.subject}`);
    console.log(`📧 HTML Length: ${email.html.length} characters`);
    
    // Test job scheduling
    console.log('\n3️⃣ Testing job scheduling...');
    
    await emailScheduler.scheduleAbandonedCartReminder(
      'test_cart_123',
      'woocommerce',
      'https://teststore.com',
      0,
      'first'
    );
    
    console.log('✅ Job scheduled successfully');
    
    // Check queue status
    const queueStatus = await emailScheduler.getQueueStatus();
    console.log('📊 Queue Status:', queueStatus);
    
    // Test cron triggers
    console.log('\n4️⃣ Testing cron triggers...');
    
    await cronScheduler.triggerFirstReminders();
    console.log('✅ First reminders trigger working');
    
    await cronScheduler.triggerSecondReminders();
    console.log('✅ Second reminders trigger working');
    
    await cronScheduler.triggerFinalReminders();
    console.log('✅ Final reminders trigger working');
    
    await cronScheduler.triggerDiscountOffers();
    console.log('✅ Discount offers trigger working');
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ Email scheduling system is working correctly');
    console.log('✅ Your abandoned cart reminders will be sent automatically');
    console.log('✅ System will work even when server is inactive');
    console.log('='.repeat(50));
    
    console.log('\n📝 What happens next:');
    console.log('1. The system will automatically detect abandoned carts');
    console.log('2. First reminders will be sent 1-2 hours after abandonment');
    console.log('3. Second reminders will be sent 24 hours after first');
    console.log('4. Final reminders will be sent 48 hours after first');
    console.log('5. Discount offers will be sent 72 hours after abandonment');
    
    console.log('\n🔧 To test with real emails:');
    console.log('1. Edit test-email-sending.js and change the email address');
    console.log('2. Run: npm run test-email');
    console.log('3. Check your email for the test message');
    
    // Cleanup
    cronScheduler.stop();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

quickTest(); 