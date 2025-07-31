const mongoose = require('mongoose');
const Notification = require('./models/Notification');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const cleanupDeletedNotifications = async (daysOld = 30) => {
  try {
    console.log(`Starting cleanup of deleted notifications older than ${daysOld} days...`);
    
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const result = await Notification.deleteMany({
      deleted: true,
      createdAt: { $lt: cutoffDate }
    });

    console.log(`Successfully cleaned up ${result.deletedCount} old deleted notifications`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up deleted notifications:', error);
    throw error;
  }
};

// If this script is run directly
if (require.main === module) {
  const daysOld = process.argv[2] ? parseInt(process.argv[2]) : 30;
  
  cleanupDeletedNotifications(daysOld)
    .then((deletedCount) => {
      console.log(`Cleanup completed. Deleted ${deletedCount} notifications.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupDeletedNotifications }; 