const Notification = require('../models/Notification');
const { emitToPlatform } = require('../socket');
const { getIO } = require('../socket');
const { getLocationFromRequest } = require('../services/geolocationService');

// Create notification
const createNotification = async (notificationData, req = null) => {
  try {
    const { platform, type, title, message, data } = notificationData;

    // Skip test notifications as they're handled by socket
    if (type === 'connection_test') {
      console.log('Skipping connection test notification creation');
      return null;
    }

    // Check for existing notification based on type and data
    let existingNotification = null;
    
    if (type === 'cart_abandoned') {
      // For cart abandonment, check if a notification exists for this cart in the last 24 hours
      // existingNotification = await Notification.findOne({
      //   platform,
      //   type,
      //   'data.cartId': data.cartId,
      //   createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      // });
    } else if (type.includes('_sent') || type.includes('_failed')) {
      // For communication status, check if a notification exists for this cart and communication type in the last hour
      const communicationType = type.split('_')[0]; // 'sms', 'email', or 'whatsapp'
      existingNotification = await Notification.findOne({
        platform,
        type,
        'data.cartId': data.cartId,
        'data.communicationType': communicationType,
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
      });
    }

    // if (existingNotification) {
    //   console.log('Duplicate notification prevented:', {
    //     type,
    //     cartId: data.cartId,
    //     existingId: existingNotification._id
    //   });
    //   return existingNotification;
    // }

    // Get zone information if request is provided
    let zone = null;
    if (req) {
      try {
        zone = await getLocationFromRequest(req);
      } catch (error) {
        console.error('Error getting zone information:', error);
        zone = {
          country: 'Unknown',
          region: 'Unknown',
          city: 'Unknown',
          timezone: 'UTC',
          ip: 'Unknown'
        };
      }
    }

    // Create new notification
    const notification = new Notification({
      platform,
      type,
      title,
      message,
      data: {
        ...data,
        // Add communication type for status notifications
        ...(type.includes('_sent') || type.includes('_failed') ? {
          communicationType: type.split('_')[0]
        } : {})
      },
      zone
    });

    await notification.save();
    console.log('Notification created:', {
      id: notification._id,
      type,
      cartId: data.cartId
    });

    // Emit socket event for real-time updates
    if (global.io) {
      global.io.to(platform).emit('notification', {
        type: 'new',
        notification
      });
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Get notifications for a platform
const getNotifications = async (req, res) => {
  try {
    const { platform, skipTestNotification } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log('Fetching notifications:', { platform, page, limit, skipTestNotification });

    if (!platform) {
      console.log('Platform parameter missing');
      return res.status(400).json({ error: 'Platform parameter is required' });
    }

    // Build query to exclude test notifications and deleted notifications
    const query = { platform, deleted: false };
    if (skipTestNotification === 'true') {
      query.type = { $ne: 'connection_test' };
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query)
    ]);

    console.log(`Found ${notifications.length} notifications for platform ${platform}`);

    res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Mark notifications as read
const markAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const { platform } = req.query;
    
    if (!Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds must be an array' });
    }

    if (!platform) {
      return res.status(400).json({ error: 'Platform parameter is required' });
    }

    await Notification.updateMany(
      { _id: { $in: notificationIds }, platform, deleted: false },
      { $set: { read: true } }
    );

    // Emit the read status update to the platform-specific room
    emitToPlatform(platform, 'notification', {
      type: 'read',
      notificationIds
    });

    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

// Delete notifications (mark as deleted instead of actually deleting)
const deleteNotifications = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const { platform } = req.query;
    
    if (!Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds must be an array' });
    }

    if (!platform) {
      return res.status(400).json({ error: 'Platform parameter is required' });
    }

    // Mark notifications as deleted instead of actually deleting them
    await Notification.updateMany(
      { _id: { $in: notificationIds }, platform },
      { $set: { deleted: true } }
    );

    // Emit the deletion event to the platform-specific room
    emitToPlatform(platform, 'notification', {
      type: 'delete',
      notificationIds
    });

    res.json({ message: 'Notifications deleted successfully' });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
};

// Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const { platform, skipTestNotification } = req.query;

    if (!platform) {
      return res.status(400).json({ error: 'Platform parameter is required' });
    }

    // Build query to exclude test notifications and deleted notifications
    const query = { platform, read: false, deleted: false };
    if (skipTestNotification === 'true') {
      query.type = { $ne: 'connection_test' };
    }

    const count = await Notification.countDocuments(query);
    res.json({ count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
};

// Get only new cart abandonment notifications (not read or deleted)
const getNewCartNotifications = async (req, res) => {
  try {
    const { platform } = req.query;

    if (!platform) {
      return res.status(400).json({ error: 'Platform parameter is required' });
    }

    const notifications = await Notification.find({
      platform,
      type: 'cart_abandoned',
      read: false,
      deleted: false
    }).sort({ createdAt: -1 });

    res.json({ notifications });
  } catch (error) {
    console.error('Error getting new cart notifications:', error);
    res.status(500).json({ error: 'Failed to get new cart notifications' });
  }
};

// Permanently delete old deleted notifications (cleanup function)
const cleanupDeletedNotifications = async (req, res) => {
  try {
    const { platform } = req.query;
    const daysOld = parseInt(req.query.days) || 30; // Default to 30 days

    if (!platform) {
      return res.status(400).json({ error: 'Platform parameter is required' });
    }

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const result = await Notification.deleteMany({
      platform,
      deleted: true,
      createdAt: { $lt: cutoffDate }
    });

    console.log(`Cleaned up ${result.deletedCount} old deleted notifications for platform ${platform}`);
    res.json({ 
      message: `Cleaned up ${result.deletedCount} old deleted notifications`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error cleaning up deleted notifications:', error);
    res.status(500).json({ error: 'Failed to cleanup deleted notifications' });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  deleteNotifications,
  getUnreadCount,
  getNewCartNotifications,
  cleanupDeletedNotifications
}; 