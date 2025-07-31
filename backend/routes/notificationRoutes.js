const express = require('express');
const router = express.Router();
const { getIO } = require('../socket');
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// Get notifications - require authentication
router.get('/', authenticate, notificationController.getNotifications);

// Get unread count - require authentication
router.get('/unread-count', authenticate, notificationController.getUnreadCount);

// Mark notifications as read - require authentication
router.post('/mark-read', authenticate, notificationController.markAsRead);

// Delete notifications - require authentication
router.delete('/', authenticate, notificationController.deleteNotifications);

// Get only new cart abandonment notifications - require authentication
router.get('/new-cart-notifications', authenticate, notificationController.getNewCartNotifications);

// Cleanup old deleted notifications - require authentication
router.delete('/cleanup', authenticate, notificationController.cleanupDeletedNotifications);

// Cleanup old deleted notifications - no authentication (for cron jobs)
router.delete('/cleanup-cron', notificationController.cleanupDeletedNotifications);

// Debug endpoint
router.get('/debug', (req, res) => {
  try {
    const io = getIO();
    if (!io) {
      return res.status(500).json({ error: 'Socket.io server not initialized' });
    }

    const connectedClients = Array.from(io.sockets.sockets.values()).map(socket => ({
      id: socket.id,
      rooms: Array.from(socket.rooms)
    }));

    res.json({
      status: 'ok',
      socketServer: 'initialized',
      totalConnections: connectedClients.length,
      connectedClients
    });
  } catch (error) {
    console.error('Error getting socket status:', error);
    res.status(500).json({ error: 'Failed to get socket status' });
  }
});

module.exports = router; 