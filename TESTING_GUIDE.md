# Email Scheduling System Testing Guide

## 🧪 Testing Overview

This guide will help you verify that your email scheduling system is working correctly. The system has been designed to send abandoned cart reminders automatically, even when your server is inactive.

## 📋 Prerequisites

Before testing, ensure you have:

1. ✅ **Environment Variables Set** (run `npm run check-env`)
2. ✅ **MongoDB Connected** 
3. ✅ **Zoho Mail Configured**
4. ✅ **Dependencies Installed** (`npm install`)

## 🚀 Quick Test Sequence

Run these tests in order to verify everything is working:

### 1. Environment Check
```bash
cd backend
npm run check-env
```
**Expected Result:** All required variables should show ✅

### 2. Scheduler Component Test
```bash
npm run test-scheduler
```
**Expected Result:** All 6 tests should pass ✅

### 3. Email Sending Test
```bash
npm run test-email
```
**Expected Result:** Email should be sent successfully ✅

### 4. Full System Test (with server)
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Run full test
npm run test-scheduler-full
```
**Expected Result:** All API endpoints should work ✅

## 📊 Test Results Interpretation

### ✅ All Tests Pass
Your email scheduling system is working perfectly! The system will:
- Automatically detect abandoned carts
- Schedule email reminders at optimal intervals
- Send emails even when server is inactive
- Track delivery status and prevent duplicates

### ⚠️ Some Tests Fail
Check the specific failures:

| Test | What it checks | Common Issues |
|------|----------------|---------------|
| `schedulerInit` | Cron scheduler initialization | MongoDB connection, environment variables |
| `emailInit` | Email scheduler initialization | Agenda.js setup, database permissions |
| `manualScheduling` | Job scheduling | Email configuration, database write access |
| `cronTriggers` | Automated triggers | Database queries, cart data |
| `emailGeneration` | Email template generation | Template syntax, cart data structure |
| `jobCancellation` | Job management | Database permissions, job cleanup |

## 🔧 Manual Testing Steps

### Test 1: Manual Email Scheduling
```bash
# Start the server
npm run dev

# In another terminal, test manual scheduling
curl -X POST http://localhost:3003/api/email/schedule-reminder \
  -H "Content-Type: application/json" \
  -d '{
    "cartId": "test_cart_123",
    "platform": "woocommerce",
    "storeUrl": "https://yourstore.com",
    "delayHours": 0,
    "reminderType": "first"
  }'
```

### Test 2: Check Scheduler Status
```bash
curl http://localhost:3003/api/scheduler/status
```

### Test 3: Trigger Manual Reminders
```bash
curl -X POST http://localhost:3003/api/scheduler/trigger-first-reminders
```

## 📧 Email Testing

### Test Email Delivery
1. **Modify the test email address** in `test-email-sending.js`:
   ```javascript
   to: 'your-email@example.com', // Change this to your email
   ```

2. **Run the email test**:
   ```bash
   npm run test-email
   ```

3. **Check your email** for the test message

### Test Email Templates
The system generates different email types:
- **First Reminder**: Sent 1-2 hours after abandonment
- **Second Reminder**: Sent 24 hours after first
- **Final Reminder**: Sent 48 hours after first
- **Discount Offer**: Sent 72 hours after abandonment

## 🔍 Monitoring and Debugging

### Check Logs
Look for these log messages:
```
✅ Email Scheduler initialized successfully
📅 Scheduled first reminder for cart [cart_id]
📧 Processing abandoned cart reminder for cart: [cart_id]
✅ Abandoned cart reminder sent successfully to [email]
```

### Common Error Messages
```
❌ MongoDB connection failed
   → Check MONGODB_URI in .env file

❌ Email authentication failed
   → Check ZOHO_EMAIL_USER and ZOHO_EMAIL_PASSWORD

❌ Agenda initialization failed
   → Check database permissions and connection

❌ Email sending failed
   → Check Zoho Mail SMTP settings
```

## 🎯 Production Testing

### Test with Real Data
1. **Create a test abandoned cart** in your database
2. **Set the abandonment time** to 1-2 hours ago
3. **Run the cron trigger**:
   ```bash
   curl -X POST http://localhost:3003/api/scheduler/trigger-first-reminders
   ```
4. **Check if email was sent** to the cart's customer email

### Test Persistence
1. **Schedule a reminder** for 1 hour from now
2. **Restart the server**
3. **Wait for the scheduled time**
4. **Check if email was sent** (should work even after restart)

## 🚨 Troubleshooting

### Email Not Sending
1. **Check Zoho Mail settings**:
   - SMTP enabled in Zoho Mail
   - App-specific password used
   - Correct email credentials

2. **Check environment variables**:
   ```bash
   npm run check-env
   ```

3. **Test email sending directly**:
   ```bash
   npm run test-email
   ```

### Scheduler Not Working
1. **Check MongoDB connection**:
   ```bash
   npm run check-env
   ```

2. **Check scheduler status**:
   ```bash
   curl http://localhost:3003/api/scheduler/status
   ```

3. **Check for errors in logs**:
   - Look for initialization errors
   - Check for database permission issues

### Jobs Not Being Scheduled
1. **Check cron scheduler**:
   ```bash
   npm run test-scheduler
   ```

2. **Verify abandoned carts exist**:
   - Check database for carts with status 'abandoned'
   - Ensure carts have customer_email field

3. **Test manual triggers**:
   ```bash
   curl -X POST http://localhost:3003/api/scheduler/trigger-first-reminders
   ```

## 📈 Performance Testing

### Load Testing
For high-volume testing:
1. **Create multiple test carts** (100+)
2. **Run the scheduler** and monitor performance
3. **Check email delivery rates**
4. **Monitor database performance**

### Concurrency Testing
The system is configured for:
- **Max concurrency**: 5 jobs simultaneously
- **Default concurrency**: 3 jobs
- **Process interval**: 30 seconds

Adjust these in `emailScheduler.js` if needed.

## ✅ Success Criteria

Your email scheduling system is working correctly when:

1. ✅ **Environment check passes** - All variables set
2. ✅ **Scheduler test passes** - All 6 components work
3. ✅ **Email test passes** - Emails are delivered
4. ✅ **API endpoints work** - Server responds correctly
5. ✅ **Jobs persist** - Survive server restarts
6. ✅ **Automated triggers work** - Cron jobs execute
7. ✅ **Email templates render** - HTML emails look good
8. ✅ **No duplicate emails** - Each cart gets one reminder per type

## 🎉 Next Steps

Once testing is complete:

1. **Deploy to production** using the deployment guide
2. **Monitor the system** for the first few days
3. **Check email delivery rates** and open rates
4. **Adjust timing** if needed based on your business
5. **Scale up** as your business grows

## 📞 Support

If you encounter issues:

1. **Check the logs** for specific error messages
2. **Run the diagnostic tests** in this guide
3. **Verify environment variables** are set correctly
4. **Test each component** individually
5. **Check the troubleshooting section** above

The email scheduling system is designed to be robust and reliable. With proper testing and monitoring, it will automatically recover abandoned carts and increase your sales! 