# Email Scheduling System Setup Guide

## Overview

CartResQ now includes a robust email scheduling system that automatically sends abandoned cart reminders even when your server is inactive. The system uses:

- **Agenda.js** for persistent job scheduling (stored in MongoDB)
- **Node-cron** for automated cart detection and scheduling
- **Standalone worker** for production deployments

## Features

### 🕐 Automatic Email Sequence
1. **First Reminder** - Sent 1-2 hours after cart abandonment
2. **Second Reminder** - Sent 24 hours after first reminder
3. **Final Reminder** - Sent 48 hours after first reminder
4. **Discount Offer** - Sent 72 hours after abandonment with 10% off code

### 🔄 Persistent Scheduling
- Jobs are stored in MongoDB and survive server restarts
- Multiple server instances can share the same job queue
- Failed jobs are automatically retried

### 🚀 Production Ready
- Standalone worker process for dedicated email handling
- Graceful shutdown handling
- Comprehensive logging and monitoring

## Setup Instructions

### 1. Environment Variables

Add these to your `.env` file:

```env
# Email Configuration (Zoho Mail)
ZOHO_EMAIL_USER=your-email@yourdomain.com
ZOHO_EMAIL_PASSWORD=your-zoho-mail-password-or-app-password
ZOHO_EMAIL=your-email@yourdomain.com

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=your-mongodb-connection-string

# JWT Secret
JWT_SECRET=your-jwt-secret-key
```

### 2. Development Setup

#### Option A: Integrated Mode (Recommended for Development)
The scheduler runs as part of your main server:

```bash
cd backend
npm run dev
```

#### Option B: Separate Worker Mode
Run the scheduler in a separate process:

```bash
# Terminal 1 - Main server
cd backend
npm run dev

# Terminal 2 - Email worker
cd backend
npm run worker
```

### 3. Production Setup

#### Option A: Single Server with Integrated Scheduler
```bash
cd backend
npm start
```

#### Option B: Dedicated Worker (Recommended for Production)
Deploy the worker separately for better reliability:

```bash
# Main application server
cd backend
npm start

# Email worker (separate process/container)
cd backend
npm run worker
```

## API Endpoints

### Scheduler Status
```bash
GET /api/scheduler/status
```
Returns the status of both cron and email schedulers.

### Manual Triggers (for testing)
```bash
POST /api/scheduler/trigger-first-reminders
POST /api/scheduler/trigger-second-reminders
POST /api/scheduler/trigger-final-reminders
POST /api/scheduler/trigger-discount-offers
```

### Email Queue Management
```bash
GET /api/email/queue-status
POST /api/email/schedule-reminder
DELETE /api/email/cancel-cart-jobs/:cartId
```

## Deployment Options

### 1. Render.com
Update your `render.yaml`:

```yaml
services:
  - type: web
    name: cartresq-backend
    env: node
    buildCommand: cd backend && npm install
    startCommand: cd backend && npm start
    envVars:
      - key: MONGODB_URI
        sync: false
      - key: ZOHO_EMAIL_USER
        sync: false
      - key: ZOHO_EMAIL_PASSWORD
        sync: false
      - key: ZOHO_EMAIL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: FRONTEND_URL
        sync: false

  - type: worker
    name: cartresq-email-worker
    env: node
    buildCommand: cd backend && npm install
    startCommand: cd backend && npm run worker
    envVars:
      - key: MONGODB_URI
        sync: false
      - key: ZOHO_EMAIL_USER
        sync: false
      - key: ZOHO_EMAIL_PASSWORD
        sync: false
      - key: ZOHO_EMAIL
        sync: false
```

### 2. Heroku
Create a `Procfile`:

```
web: cd backend && npm start
worker: cd backend && npm run worker
```

### 3. Docker
Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3003:3003"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/cartresq
      - ZOHO_EMAIL_USER=${ZOHO_EMAIL_USER}
      - ZOHO_EMAIL_PASSWORD=${ZOHO_EMAIL_PASSWORD}
      - ZOHO_EMAIL=${ZOHO_EMAIL}
      - JWT_SECRET=${JWT_SECRET}
      - FRONTEND_URL=${FRONTEND_URL}
    depends_on:
      - mongo

  worker:
    build: .
    command: npm run worker
    environment:
      - MONGODB_URI=mongodb://mongo:27017/cartresq
      - ZOHO_EMAIL_USER=${ZOHO_EMAIL_USER}
      - ZOHO_EMAIL_PASSWORD=${ZOHO_EMAIL_PASSWORD}
      - ZOHO_EMAIL=${ZOHO_EMAIL}
    depends_on:
      - mongo

  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

## Monitoring and Troubleshooting

### Check Scheduler Status
```bash
curl http://localhost:3003/api/scheduler/status
```

### View Email Queue Status
```bash
curl http://localhost:3003/api/email/queue-status
```

### Manual Testing
```bash
# Trigger first reminders manually
curl -X POST http://localhost:3003/api/scheduler/trigger-first-reminders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Schedule a specific reminder
curl -X POST http://localhost:3003/api/email/schedule-reminder \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cartId": "cart_123",
    "platform": "woocommerce",
    "storeUrl": "https://yourstore.com",
    "delayHours": 1,
    "reminderType": "first"
  }'
```

### Logs to Monitor
- `📧 Processing abandoned cart reminder for cart: [cart_id]`
- `✅ Abandoned cart reminder sent successfully to [email]`
- `📅 Scheduled [reminder_type] reminder for cart [cart_id]`
- `🔍 Found [count] carts ready for [reminder_type] reminder`

## Customization

### Modify Email Timing
Edit `backend/services/cronScheduler.js`:

```javascript
// Change reminder intervals
const delayHours = 2; // Instead of 1 hour
const twentyFourHoursAgo = new Date(Date.now() - (48 * 60 * 60 * 1000)); // 48 hours instead of 24
```

### Custom Email Templates
Edit `backend/services/emailScheduler.js`:

```javascript
async generateReminderEmail(cart, reminderType, storeUrl) {
  // Customize email content here
  const customSubject = `Your custom subject for ${reminderType} reminder`;
  const customHtml = `<div>Your custom email template</div>`;
  
  return {
    subject: customSubject,
    html: customHtml
  };
}
```

### Adjust Cron Schedules
Edit the cron expressions in `backend/services/cronScheduler.js`:

```javascript
// Check every 5 minutes instead of 15
this.jobs.set('check-abandoned-carts', cron.schedule('*/5 * * * *', async () => {
  // ...
}));

// Run cleanup daily at 3 AM instead of 2 AM
this.jobs.set('cleanup-old-carts', cron.schedule('0 3 * * *', async () => {
  // ...
}));
```

## Troubleshooting

### Common Issues

1. **Emails not being sent**
   - Check Zoho Mail credentials in `.env`
   - Verify MongoDB connection
   - Check scheduler status: `/api/scheduler/status`

2. **Jobs not being scheduled**
   - Ensure cron scheduler is initialized
   - Check for abandoned carts in database
   - Verify cart email addresses exist

3. **Worker not starting**
   - Check MongoDB connection string
   - Verify all environment variables are set
   - Check for port conflicts

4. **Duplicate emails**
   - Check email status tracking in database
   - Verify job cancellation is working
   - Check for multiple worker instances

### Debug Commands

```bash
# Check if scheduler is running
curl http://localhost:3003/api/scheduler/status

# View pending jobs
curl http://localhost:3003/api/email/queue-status

# Test email sending
curl -X POST http://localhost:3003/api/email/send-email \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<p>Test content</p>"
  }'
```

## Performance Optimization

### For High Volume
1. **Increase concurrency** in `emailScheduler.js`:
   ```javascript
   maxConcurrency: 10, // Instead of 5
   defaultConcurrency: 5 // Instead of 3
   ```

2. **Batch processing** in `cronScheduler.js`:
   ```javascript
   .limit(100) // Instead of 50
   ```

3. **Faster cron intervals**:
   ```javascript
   '*/5 * * * *' // Every 5 minutes instead of 15
   ```

### For Low Volume
1. **Reduce concurrency** to save resources
2. **Increase cron intervals** to reduce database queries
3. **Use integrated mode** instead of separate worker

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **JWT Tokens**: Use strong, unique secrets
3. **Email Authentication**: Use app-specific passwords for Zoho Mail
4. **Database Access**: Restrict MongoDB access to application only
5. **API Endpoints**: All scheduler endpoints require authentication

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify environment variables are set correctly
3. Test email sending manually
4. Check scheduler status endpoints
5. Review this documentation for configuration options 