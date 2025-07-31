# Email Deliverability Guide for CartResQ

## Why Emails Go to Spam

Emails can be marked as spam for several reasons:

1. **Poor Email Authentication** - Missing or incorrect SPF, DKIM, DMARC records
2. **Spam Trigger Words** - Using words like "FREE", "URGENT", "LIMITED TIME", "ACT NOW"
3. **Poor Sender Reputation** - New domain, low sending volume, high bounce rates
4. **Technical Issues** - Missing headers, poor formatting, no unsubscribe links
5. **Content Issues** - Too many images, excessive emojis, aggressive language

## ✅ Improvements Made

### 1. Email Headers
- Added proper unsubscribe headers
- Added text version of emails
- Added proper email priority headers

### 2. Content Improvements
- Removed excessive emojis and urgency language
- Used more natural, conversational tone
- Improved subject lines
- Added proper unsubscribe links

### 3. Technical Improvements
- Better email formatting
- Proper HTML structure
- Added text alternatives

## 🔧 Additional Steps to Improve Deliverability

### 1. Set Up Email Authentication

#### SPF Record
Add this TXT record to your domain's DNS:
```
v=spf1 include:zoho.com ~all
```

#### DKIM Setup
1. In Zoho Mail, go to Settings → Domains
2. Add your domain if not already added
3. Follow the DKIM setup instructions
4. Add the DKIM record to your domain's DNS

#### DMARC Record
Add this TXT record to your domain's DNS:
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

### 2. Warm Up Your Email Domain

For new domains, gradually increase sending volume:
- Week 1: 10-20 emails per day
- Week 2: 50-100 emails per day
- Week 3: 200-500 emails per day
- Week 4+: Full volume

### 3. Monitor Your Sending

Track these metrics:
- **Bounce Rate**: Keep below 5%
- **Spam Complaints**: Keep below 0.1%
- **Open Rate**: Aim for 20%+
- **Click Rate**: Aim for 2%+

### 4. Best Practices

#### Subject Lines
✅ Good:
- "Your order is ready"
- "Special discount on your items"
- "Complete your purchase"

❌ Avoid:
- "FREE OFFER!!!"
- "URGENT: LIMITED TIME"
- "ACT NOW OR MISS OUT"

#### Content
✅ Good:
- Personal greeting with customer name
- Natural, conversational tone
- Clear value proposition
- Easy unsubscribe option

❌ Avoid:
- Excessive CAPS
- Too many emojis
- Aggressive urgency
- Hidden unsubscribe links

### 5. Test Your Emails

Use these tools to test deliverability:
- **Mail Tester**: mail-tester.com
- **GlockApps**: glockapps.com
- **250ok**: 250ok.com

### 6. Monitor Blacklists

Check if your domain/IP is blacklisted:
- **MXToolbox**: mxtoolbox.com/blacklists.aspx
- **Spamhaus**: spamhaus.org/lookup
- **Barracuda**: barracudacentral.org/lookups

## 🚀 Quick Wins

1. **Set up SPF record** (immediate improvement)
2. **Use consistent "From" address**
3. **Include unsubscribe links**
4. **Avoid spam trigger words**
5. **Send at consistent times**
6. **Clean your email list regularly**

## 📊 Monitoring Tools

### Zoho Mail Analytics
- Check delivery rates in Zoho Mail dashboard
- Monitor bounce rates
- Track open rates

### CartResQ Analytics
- Monitor email success rates in the application
- Track conversion rates from emails
- Analyze which emails perform best

## 🔄 Continuous Improvement

1. **A/B test subject lines**
2. **Test different send times**
3. **Segment your email list**
4. **Personalize content**
5. **Monitor and adjust based on results**

## 📞 Support

If you continue to have deliverability issues:
1. Check Zoho Mail support documentation
2. Contact Zoho Mail support
3. Review your domain's reputation
4. Consider using a dedicated IP address

## 🎯 Expected Results

With these improvements, you should see:
- **Reduced spam marking** (aim for <1%)
- **Higher open rates** (aim for 20%+)
- **Better engagement** (higher click rates)
- **Improved conversions** (more completed purchases)

Remember: Email deliverability is a long-term process. It takes time to build a good sender reputation, but the improvements above will help accelerate this process. 