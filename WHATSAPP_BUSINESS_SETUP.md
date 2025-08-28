# WhatsApp Business API Setup Guide

## Overview
This guide will help you set up WhatsApp Business API with your Twilio account to send messages without the 24-hour window limitation using approved message templates.

## Prerequisites
- ✅ Upgraded Twilio account (not trial)
- ✅ Purchased Twilio phone number
- ✅ WhatsApp Business API access (requested through Twilio)

## Step 1: Request WhatsApp Business API Access

1. **Go to Twilio Console**: https://console.twilio.com/
2. **Navigate to Messaging**: https://console.twilio.com/us1/develop/sms
3. **Click on WhatsApp**: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
4. **Request WhatsApp Business API Access**:
   - Click "Get Started with WhatsApp Business API"
   - Fill out the business verification form
   - Wait for approval (can take 1-7 days)

## Step 2: Create Message Templates

### Option A: Using Twilio Console (Recommended)

1. **Go to Content Editor**: https://console.twilio.com/us1/develop/content
2. **Create New Template**:
   - Click "Create Template"
   - Choose "WhatsApp" as the channel
   - Select your WhatsApp number

3. **Template Configuration**:
   ```
   Template Name: cart_reminder
   Category: UTILITY
   Language: English (US)
   ```

4. **Template Content**:
   ```
   Hi! You have items waiting in your cart at {{1}}.

   🛒 Cart Summary:
   • {{2}} items
   • Total: {{3}}

   Complete your purchase: {{4}}

   Reply STOP to unsubscribe.
   ```

5. **Submit for Approval**:
   - Review your template
   - Submit to WhatsApp for approval
   - Wait for approval (usually 24-48 hours)

### Option B: Using WhatsApp Business Manager

1. **Go to WhatsApp Business Manager**: https://business.whatsapp.com/
2. **Navigate to Message Templates**
3. **Create New Template** with the same content as above

## Step 3: Get Your Template SID

After your template is approved:

1. **Go to Content Editor**: https://console.twilio.com/us1/develop/content
2. **Find your approved template**
3. **Copy the Content SID** (starts with `HX...`)

## Step 4: Update Your Environment Variables

Add these to your `.env` file:

```env
# WhatsApp Template Configuration
TWILIO_WHATSAPP_TEMPLATE_NAME=cart_reminder
TWILIO_WHATSAPP_TEMPLATE_SID=HX1234567890abcdef1234567890abcdef
```

## Step 5: Template Variables Explained

Your template uses these variables:
- `{{1}}` = Store name
- `{{2}}` = Number of items in cart
- `{{3}}` = Cart total amount
- `{{4}}` = Checkout URL

## Step 6: Alternative Template Examples

### Simple Cart Reminder:
```
Template Name: simple_cart_reminder
Content: You have items in your cart at {{1}}. Total: {{2}}. Complete purchase: {{3}}
```

### Detailed Cart Reminder:
```
Template Name: detailed_cart_reminder
Content: Hi! Your cart at {{1}} has {{2}} items worth {{3}}. Don't miss out - complete your purchase: {{4}}
```

### Urgent Reminder:
```
Template Name: urgent_cart_reminder
Content: ⚠️ Your cart at {{1}} will expire soon! {{2}} items worth {{3}}. Complete now: {{4}}
```

## Step 7: Testing Your Setup

1. **Update your `.env` file** with the template SID
2. **Restart your backend server**
3. **Test sending a WhatsApp message** through your application
4. **Check Twilio Console** for message status

## Important Notes

### ✅ Benefits of Using Templates:
- **No 24-hour window limitation** - Send anytime
- **No customer interaction required** - Initiate conversations
- **Professional appearance** - Pre-approved by WhatsApp
- **Higher delivery rates** - Templates are prioritized

### ⚠️ Template Requirements:
- **Must be approved by WhatsApp** before use
- **Cannot be modified** after approval
- **Must follow WhatsApp guidelines** for content
- **Limited to approved categories** (UTILITY, MARKETING, AUTHENTICATION)

### 📋 Template Categories:
- **UTILITY**: Transactional messages (cart reminders, order updates)
- **MARKETING**: Promotional messages (sales, new products)
- **AUTHENTICATION**: Security messages (OTP, verification codes)

## Troubleshooting

### Common Issues:

1. **"Template not found" error**:
   - Ensure template is approved by WhatsApp
   - Check template name and SID are correct
   - Verify template is associated with your WhatsApp number

2. **"Template variables mismatch" error**:
   - Ensure you're providing the correct number of variables
   - Check variable format (must be strings)

3. **"WhatsApp Business API not enabled" error**:
   - Request WhatsApp Business API access through Twilio
   - Wait for approval from WhatsApp

### Template Approval Tips:
- Use clear, professional language
- Avoid promotional language in UTILITY templates
- Keep messages concise and relevant
- Include unsubscribe instructions
- Don't use excessive emojis or special characters

## Next Steps

1. **Request WhatsApp Business API access**
2. **Create and submit your message template**
3. **Wait for template approval**
4. **Update your environment variables**
5. **Test your WhatsApp messaging**

With approved templates, you can now send WhatsApp messages at any time without the 24-hour window limitation!
