const cron = require('node-cron');
const AbandonedCart = require('../models/AbandonedCart');
const { emailScheduler } = require('./emailScheduler');

class CronScheduler {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🔄 Initializing Cron Scheduler...');
      
      // Initialize email scheduler first
      await emailScheduler.initialize();
      
      // Schedule cron jobs
      this.scheduleJobs();
      
      this.isInitialized = true;
      console.log('✅ Cron Scheduler initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Cron Scheduler:', error);
      throw error;
    }
  }

  scheduleJobs() {
    // Job 1: Check for abandoned carts every 15 minutes and schedule first reminders
    this.jobs.set('check-abandoned-carts', cron.schedule('*/15 * * * *', async () => {
      try {
        console.log('🔍 Checking for abandoned carts to schedule first reminders...');
        await this.scheduleFirstReminders();
      } catch (error) {
        console.error('❌ Error in check-abandoned-carts job:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    }));

    // Job 2: Schedule second reminders (24 hours after first)
    this.jobs.set('schedule-second-reminders', cron.schedule('0 */2 * * *', async () => {
      try {
        console.log('🔍 Checking for carts ready for second reminders...');
        await this.scheduleSecondReminders();
      } catch (error) {
        console.error('❌ Error in schedule-second-reminders job:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    }));

    // Job 3: Schedule final reminders (48 hours after first)
    this.jobs.set('schedule-final-reminders', cron.schedule('0 */4 * * *', async () => {
      try {
        console.log('🔍 Checking for carts ready for final reminders...');
        await this.scheduleFinalReminders();
      } catch (error) {
        console.error('❌ Error in schedule-final-reminders job:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    }));

    // Job 4: Schedule discount offers (72 hours after abandonment)
    this.jobs.set('schedule-discount-offers', cron.schedule('0 */6 * * *', async () => {
      try {
        console.log('🔍 Checking for carts ready for discount offers...');
        await this.scheduleDiscountOffers();
      } catch (error) {
        console.error('❌ Error in schedule-discount-offers job:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    }));

    // Job 5: Clean up old abandoned carts (7 days old)
    this.jobs.set('cleanup-old-carts', cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🧹 Cleaning up old abandoned carts...');
        await this.cleanupOldCarts();
      } catch (error) {
        console.error('❌ Error in cleanup-old-carts job:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    }));

    console.log(`📅 Scheduled ${this.jobs.size} cron jobs`);
  }

  async scheduleFirstReminders() {
    try {
      // Find carts abandoned 1-2 hours ago that haven't received first reminder
      const oneHourAgo = new Date(Date.now() - (1 * 60 * 60 * 1000));
      const twoHoursAgo = new Date(Date.now() - (2 * 60 * 60 * 1000));
      
      const abandonedCarts = await AbandonedCart.find({
        status: 'abandoned',
        last_activity: { $gte: twoHoursAgo, $lte: oneHourAgo },
        email_status: { $nin: ['first_reminder_sent', 'second_reminder_sent', 'final_reminder_sent'] },
        customer_email: { $exists: true, $ne: null, $ne: '' }
      }).limit(50); // Process in batches

      console.log(`📧 Found ${abandonedCarts.length} carts ready for first reminder`);

      for (const cart of abandonedCarts) {
        try {
          // Get store URL from cart metadata or use default
          const storeUrl = cart.store_url || cart.metadata?.storeUrl || '';
          
          // Schedule first reminder (send immediately)
          await emailScheduler.scheduleAbandonedCartReminder(
            cart.cart_id,
            cart.platform,
            storeUrl,
            0, // Send immediately
            'first'
          );

          // Update cart status
          await AbandonedCart.findByIdAndUpdate(cart._id, {
            $set: {
              email_status: 'first_reminder_scheduled',
              first_reminder_scheduled_at: new Date()
            }
          });

        } catch (error) {
          console.error(`❌ Error scheduling first reminder for cart ${cart.cart_id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error in scheduleFirstReminders:', error);
    }
  }

  async scheduleSecondReminders() {
    try {
      // Find carts that received first reminder 20-24 hours ago
      const twentyHoursAgo = new Date(Date.now() - (20 * 60 * 60 * 1000));
      const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
      
      const abandonedCarts = await AbandonedCart.find({
        status: 'abandoned',
        first_reminder_sent_at: { $gte: twentyFourHoursAgo, $lte: twentyHoursAgo },
        email_status: { $in: ['first_reminder_sent'] },
        customer_email: { $exists: true, $ne: null, $ne: '' }
      }).limit(50);

      console.log(`📧 Found ${abandonedCarts.length} carts ready for second reminder`);

      for (const cart of abandonedCarts) {
        try {
          const storeUrl = cart.store_url || cart.metadata?.storeUrl || '';
          
          // Schedule second reminder (send immediately)
          await emailScheduler.scheduleAbandonedCartReminder(
            cart.cart_id,
            cart.platform,
            storeUrl,
            0, // Send immediately
            'second'
          );

          // Update cart status
          await AbandonedCart.findByIdAndUpdate(cart._id, {
            $set: {
              email_status: 'second_reminder_scheduled',
              second_reminder_scheduled_at: new Date()
            }
          });

        } catch (error) {
          console.error(`❌ Error scheduling second reminder for cart ${cart.cart_id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error in scheduleSecondReminders:', error);
    }
  }

  async scheduleFinalReminders() {
    try {
      // Find carts that received second reminder 20-24 hours ago
      const twentyHoursAgo = new Date(Date.now() - (20 * 60 * 60 * 1000));
      const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
      
      const abandonedCarts = await AbandonedCart.find({
        status: 'abandoned',
        second_reminder_sent_at: { $gte: twentyFourHoursAgo, $lte: twentyHoursAgo },
        email_status: { $in: ['second_reminder_sent'] },
        customer_email: { $exists: true, $ne: null, $ne: '' }
      }).limit(50);

      console.log(`📧 Found ${abandonedCarts.length} carts ready for final reminder`);

      for (const cart of abandonedCarts) {
        try {
          const storeUrl = cart.store_url || cart.metadata?.storeUrl || '';
          
          // Schedule final reminder (send immediately)
          await emailScheduler.scheduleAbandonedCartReminder(
            cart.cart_id,
            cart.platform,
            storeUrl,
            0, // Send immediately
            'final'
          );

          // Update cart status
          await AbandonedCart.findByIdAndUpdate(cart._id, {
            $set: {
              email_status: 'final_reminder_scheduled',
              final_reminder_scheduled_at: new Date()
            }
          });

        } catch (error) {
          console.error(`❌ Error scheduling final reminder for cart ${cart.cart_id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error in scheduleFinalReminders:', error);
    }
  }

  async scheduleDiscountOffers() {
    try {
      // Find carts that received final reminder 20-24 hours ago
      const twentyHoursAgo = new Date(Date.now() - (20 * 60 * 60 * 1000));
      const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
      
      const abandonedCarts = await AbandonedCart.find({
        status: 'abandoned',
        final_reminder_sent_at: { $gte: twentyFourHoursAgo, $lte: twentyHoursAgo },
        email_status: { $in: ['final_reminder_sent'] },
        customer_email: { $exists: true, $ne: null, $ne: '' },
        discount_offer_sent: { $ne: true }
      }).limit(50);

      console.log(`📧 Found ${abandonedCarts.length} carts ready for discount offers`);

      for (const cart of abandonedCarts) {
        try {
          const storeUrl = cart.store_url || cart.metadata?.storeUrl || '';
          
          // Generate a unique discount code
          const couponCode = `SAVE${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
          const couponAmount = 10; // 10% discount
          const couponType = 'percentage';
          
          // Schedule discount offer (send immediately)
          await emailScheduler.scheduleDiscountOffer(
            cart.cart_id,
            cart.platform,
            storeUrl,
            couponCode,
            couponAmount,
            couponType,
            0 // Send immediately
          );

          // Update cart status
          await AbandonedCart.findByIdAndUpdate(cart._id, {
            $set: {
              discount_offer_sent: true,
              discount_offer_sent_at: new Date(),
              discount_code: couponCode
            }
          });

        } catch (error) {
          console.error(`❌ Error scheduling discount offer for cart ${cart.cart_id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error in scheduleDiscountOffers:', error);
    }
  }

  async cleanupOldCarts() {
    try {
      // Find carts older than 7 days
      const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
      
      const result = await AbandonedCart.deleteMany({
        last_activity: { $lt: sevenDaysAgo },
        status: 'abandoned'
      });

      console.log(`🧹 Cleaned up ${result.deletedCount} old abandoned carts`);
    } catch (error) {
      console.error('❌ Error in cleanupOldCarts:', error);
    }
  }

  // Manual trigger methods for testing
  async triggerFirstReminders() {
    console.log('🔧 Manually triggering first reminders...');
    await this.scheduleFirstReminders();
  }

  async triggerSecondReminders() {
    console.log('🔧 Manually triggering second reminders...');
    await this.scheduleSecondReminders();
  }

  async triggerFinalReminders() {
    console.log('🔧 Manually triggering final reminders...');
    await this.scheduleFinalReminders();
  }

  async triggerDiscountOffers() {
    console.log('🔧 Manually triggering discount offers...');
    await this.scheduleDiscountOffers();
  }

  // Get scheduler status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      activeJobs: this.jobs.size,
      jobNames: Array.from(this.jobs.keys())
    };
  }

  // Stop all cron jobs
  stop() {
    console.log('🛑 Stopping all cron jobs...');
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`🛑 Stopped job: ${name}`);
    }
    this.jobs.clear();
    this.isInitialized = false;
  }
}

// Create singleton instance
const cronScheduler = new CronScheduler();

module.exports = cronScheduler; 