# Zoho Mail Setup Guide for CartResQ

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Zoho Mail Configuration
ZOHO_EMAIL_USER=your-email@yourdomain.com
ZOHO_EMAIL_PASSWORD=your-zoho-mail-password-or-app-password
ZOHO_EMAIL=your-email@yourdomain.com
```

## Zoho Mail Configuration Steps

### 1. Get Your Zoho Mail Credentials

1. Log in to your Zoho Mail account at https://mail.zoho.com
2. Go to Settings → Mail Accounts
3. Note your email address and password

### 2. Enable SMTP Access

1. In Zoho Mail, go to Settings → Mail Accounts
2. Click on your email account
3. Go to "SMTP/IMAP" tab
4. Enable SMTP access
5. Note the SMTP settings:
   - Host: smtp.zoho.com
   - Port: 587 (TLS) or 465 (SSL)
   - Security: TLS/SSL

### 3. Generate App-Specific Password (Recommended)

For better security, use an app-specific password:

1. Go to Settings → Security
2. Enable 2-Factor Authentication if not already enabled
3. Generate an app-specific password for CartResQ
4. Use this password in your `ZOHO_EMAIL_PASSWORD` environment variable

### 4. Test Your Configuration

After setting up the environment variables, restart your server and check the console logs. You should see:

```
Nodemailer is ready to send emails via Zoho Mail SMTP
```

## Troubleshooting

### Common Issues

1. **Authentication Error**: 
   - Verify your email and password are correct
   - Make sure SMTP is enabled in your Zoho Mail settings
   - Try using an app-specific password instead of your main password

2. **Connection Error**:
   - Check your internet connection
   - Verify the SMTP host and port settings
   - Ensure your firewall isn't blocking the connection

3. **Emails Still Going to Spam**:
   - Set up proper SPF, DKIM, and DMARC records for your domain
   - Use a consistent "From" email address
   - Include proper unsubscribe links in your emails
   - Avoid spam trigger words in subject lines

### SPF Record Example

Add this TXT record to your domain's DNS:

```
v=spf1 include:zoho.com ~all
```

### DKIM Setup

1. In Zoho Mail, go to Settings → Domains
2. Add your domain if not already added
3. Follow the DKIM setup instructions provided by Zoho
4. Add the DKIM record to your domain's DNS

## Benefits of Using Zoho Mail

- ✅ Professional email delivery
- ✅ Better deliverability rates
- ✅ Built-in spam protection
- ✅ Email authentication (SPF, DKIM, DMARC)
- ✅ Reliable SMTP service
- ✅ Cost-effective for business use

## Migration from Brevo

The application has been updated to use Zoho Mail instead of Brevo. All email functionality will now use your Zoho Mail account for sending emails, which should significantly improve deliverability and reduce spam marking. 