# Notification System Documentation

## Overview

The notification system has been improved to prevent duplicate notifications and persist the "cleared" state even after server refresh. Notifications are now marked as "deleted" instead of being permanently removed from the database.

## Key Features

### 1. Duplicate Prevention
- Notifications are tracked by ID to prevent duplicates
- Test notifications are only sent once per session
- Socket connections are properly managed to prevent multiple listeners

### 2. Persistent Deletion
- Notifications are marked as `deleted: true` instead of being permanently removed
- Deleted notifications won't appear again even after server refresh
- Old deleted notifications can be cleaned up periodically

### 3. New Cart Notifications Filter
- Toggle to show only new cart abandonment notifications
- Filters out read and deleted notifications
- Perfect for focusing on new customer activity

## Database Schema

The Notification model now includes a `deleted` field:

```javascript
{
  platform: String,
  type: String,
  title: String,
  message: String,
  data: Object,
  read: Boolean,
  deleted: Boolean,  // NEW: tracks if notification was cleared
  createdAt: Date
}
```

## API Endpoints

### Get All Notifications
```
GET /api/notifications?platform=woocommerce&page=1&limit=10
```

### Get Only New Cart Notifications
```
GET /api/notifications/new-cart-notifications?platform=woocommerce
```

### Mark Notifications as Read
```
POST /api/notifications/mark-read
Body: { notificationIds: ["id1", "id2"] }
Query: platform=woocommerce
```

### Delete Notifications (Mark as Deleted)
```
DELETE /api/notifications
Body: { notificationIds: ["id1", "id2"] }
Query: platform=woocommerce
```

### Get Unread Count
```
GET /api/notifications/unread-count?platform=woocommerce
```

### Cleanup Old Deleted Notifications
```
DELETE /api/notifications/cleanup?platform=woocommerce&days=30
```

## Frontend Features

### Notification Bell Component
- **Toggle Button**: Switch between "Show All" and "New Carts Only"
- **Manual Refresh**: Refresh button to fetch latest notifications
- **Persistent State**: Cleared notifications stay cleared
- **Real-time Updates**: Socket.io integration for live notifications

### Usage
1. Click the notification bell to open the panel
2. Use "New Carts Only" toggle to focus on new cart abandonments
3. Click "Clear all" to mark notifications as deleted (they won't return)
4. Use "Mark all as read" to mark notifications as read

## Maintenance

### Cleanup Script
Run the cleanup script to permanently remove old deleted notifications:

```bash
# Clean up notifications deleted more than 30 days ago (default)
npm run cleanup-notifications

# Clean up notifications deleted more than 7 days ago
npm run cleanup-notifications 7

# Clean up notifications deleted more than 90 days ago
npm run cleanup-notifications 90
```

### Cron Job Setup
Add to your crontab to run cleanup weekly:

```bash
# Run cleanup every Sunday at 2 AM
0 2 * * 0 cd /path/to/backend && npm run cleanup-notifications
```

## Migration Notes

If you have existing notifications in your database, they will continue to work normally. The `deleted` field will default to `false` for existing records.

## Troubleshooting

### Duplicate Notifications Still Appearing
1. Check if socket connections are being recreated unnecessarily
2. Verify that notification IDs are being tracked properly
3. Ensure the `deleted` field is being set correctly

### Notifications Not Persisting After Clear
1. Verify the `deleted` field is being set to `true` in the database
2. Check that API queries include `deleted: false` filter
3. Ensure the frontend is not refetching all notifications

### Performance Issues
1. Run the cleanup script regularly to remove old deleted notifications
2. Consider adding database indexes for frequently queried fields
3. Monitor socket connection count to prevent memory leaks 