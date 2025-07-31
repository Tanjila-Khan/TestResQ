const Agenda = require('agenda');
const mongoose = require('mongoose');
const { sendZohoEmail } = require('../utils/mailer');
const AbandonedCart = require('../models/AbandonedCart');
const Email = require('../models/Email');
const Campaign = require('../models/Campaign');
const fs = require('fs');
const path = require('path');
const campaignLogFile = path.join(__dirname, '..', 'logs', 'campaign-debug.log');
function logCampaignDebug(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(campaignLogFile, logMessage);
  console.log(message);
}

// Helper function to replace variables in campaign email
function fillCampaignTemplate(template, cart, storeUrl) {
  let customerName = '';
  let customerEmail = '';
  
  if (cart) {
    if (cart.customer_data && cart.customer_data.first_name) {
      customerName = cart.customer_data.first_name;
    } else if (cart.customer_name) {
      customerName = cart.customer_name;
    } else if (cart.customer_email) {
      customerName = cart.customer_email.split('@')[0];
    }
    customerEmail = cart.customer_email || '';
  }

  // Format cart items as HTML table rows with proper styling
  let cartItemsHtml = '';
  const cartItems = (cart && cart.items) ? cart.items : [];
  if (Array.isArray(cartItems) && cartItems.length > 0) {
    cartItemsHtml = cartItems.map(item => {
      const productName = item.product_name || item.name || item.title || 'Product';
      const price = parseFloat(item.price || 0);
      const quantity = parseInt(item.quantity || 1);
      const total = (price * quantity).toFixed(2);
      return `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; text-align: left;">${productName}</td>
          <td style="padding: 12px; text-align: center;">${quantity}</td>
          <td style="padding: 12px; text-align: right;">$${price.toFixed(2)}</td>
          <td style="padding: 12px; text-align: right; font-weight: bold;">$${total}</td>
        </tr>
      `;
    }).join('');
    
    cartItemsHtml = `
      <div style="margin: 25px 0;">
        <h3 style="color: #333; margin-bottom: 15px; font-size: 18px;">Your Cart Items:</h3>
        <table style="width: 100%; border-collapse: collapse; background: #f9f9f9; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: bold;">Product</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e0e0e0; font-weight: bold;">Quantity</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0; font-weight: bold;">Price</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0; font-weight: bold;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${cartItemsHtml}
          </tbody>
        </table>
      </div>
    `;
  } else {
    cartItemsHtml = '<p style="color: #666; font-style: italic;">No items found in your cart.</p>';
  }

  // Generate recovery link
  let recoveryLink = storeUrl || '';
  if (cart && cart.cart_id && cart.platform) {
    if (cart.platform === 'woocommerce') {
      const cartItemsParams = cart.items.map(item => {
        const productId = item.product_id || item.id;
        const variationId = item.variation_id;
        const quantity = item.quantity || 1;
        let addToCartParam = `add-to-cart=${productId}`;
        if (variationId) {
          addToCartParam += `&variation_id=${variationId}`;
        }
        addToCartParam += `&quantity=${quantity}`;
        return addToCartParam;
      }).join('&');
      const timestamp = new Date().getTime();
      recoveryLink = `${storeUrl.replace(/\/$/, '')}/cart/?${cartItemsParams}&_t=${timestamp}`;
    } else if (cart.platform === 'shopify') {
      recoveryLink = `${storeUrl.replace(/\/$/, '')}/checkout/${cart.cart_id}`;
    }
  }

  // Create a complete HTML email template with spam prevention
  const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Complete Your Purchase</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 20px auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333333; font-size: 28px; margin: 0;">Complete Your Purchase! 🛒</h1>
        </div>
        
        <div style="margin-bottom: 25px; color: #333333; font-size: 16px; line-height: 1.6;">
          ${template.replace(/\n/g, '<br>')}
        </div>

        ${cartItemsHtml}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryLink}" style="display: inline-block; padding: 15px 30px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Complete Your Order</a>
        </div>

        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 6px;">
          <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your cart will be saved for a limited time.</p>
          <p style="margin: 0; color: #666; font-size: 14px;">
            Don't want to receive these reminders? <a href="${storeUrl.replace(/\/$/, '')}/unsubscribe?email=${encodeURIComponent(customerEmail)}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
          <p style="margin: 0;">This email was sent to ${customerEmail}</p>
          <p style="margin: 5px 0 0 0;">© 2024 CartResQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Replace variables in template
  let result = htmlTemplate;
  result = result.replace(/\{customer_name\}/g, customerName);
  result = result.replace(/\{cart_items\}/g, cartItemsHtml);
  result = result.replace(/\{checkout_link\}/g, recoveryLink);
  result = result.replace(/\[Checkout Now\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  result = result.replace(/\[Complete My Purchase\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  
  return result;
}

// Helper function specifically for formatting campaign emails
function formatCampaignEmail(campaignContent, cart, storeUrl) {
  let customerName = '';
  let customerEmail = '';
  
  if (cart) {
    if (cart.customer_data && cart.customer_data.first_name) {
      customerName = cart.customer_data.first_name;
    } else if (cart.customer_name) {
      customerName = cart.customer_name;
    } else if (cart.customer_email) {
      customerName = cart.customer_email.split('@')[0];
    }
    customerEmail = cart.customer_email || '';
  }

  // Generate recovery link
  let recoveryLink = storeUrl || '';
  if (cart && cart.cart_id && cart.platform) {
    if (cart.platform === 'woocommerce') {
      const cartItemsParams = cart.items.map(item => {
        const productId = item.product_id || item.id;
        const variationId = item.variation_id;
        const quantity = item.quantity || 1;
        let addToCartParam = `add-to-cart=${productId}`;
        if (variationId) {
          addToCartParam += `&variation_id=${variationId}`;
        }
        addToCartParam += `&quantity=${quantity}`;
        return addToCartParam;
      }).join('&');
      const timestamp = new Date().getTime();
      recoveryLink = `${storeUrl.replace(/\/$/, '')}/cart/?${cartItemsParams}&_t=${timestamp}`;
    } else if (cart.platform === 'shopify') {
      recoveryLink = `${storeUrl.replace(/\/$/, '')}/checkout/${cart.cart_id}`;
    }
  }
  
  // Debug: Log cart and recovery link generation
  console.log('Cart data for recovery link:', {
    cartId: cart?.cart_id,
    platform: cart?.platform,
    storeUrl,
    itemsCount: cart?.items?.length,
    recoveryLink
  });

  // Format cart items as HTML table rows with proper styling
  let cartItemsHtml = '';
  const cartItems = (cart && cart.items) ? cart.items : [];
  if (Array.isArray(cartItems) && cartItems.length > 0) {
    cartItemsHtml = cartItems.map(item => {
      const productName = item.product_name || item.name || item.title || 'Product';
      const price = parseFloat(item.price || 0);
      const quantity = parseInt(item.quantity || 1);
      const total = (price * quantity).toFixed(2);
      return `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; text-align: left;">${productName}</td>
          <td style="padding: 12px; text-align: center;">${quantity}</td>
          <td style="padding: 12px; text-align: right;">$${price.toFixed(2)}</td>
          <td style="padding: 12px; text-align: right; font-weight: bold;">$${total}</td>
        </tr>
      `;
    }).join('');
    
    cartItemsHtml = `
      <div style="margin: 25px 0;">
        <h3 style="color: #333; margin-bottom: 15px; font-size: 18px;">Your Cart Items:</h3>
        <table style="width: 100%; border-collapse: collapse; background: #f9f9f9; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: bold;">Product</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e0e0e0; font-weight: bold;">Quantity</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0; font-weight: bold;">Price</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0; font-weight: bold;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${cartItemsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // Process campaign content first - replace variables and links
  let processedContent = campaignContent;
  processedContent = processedContent.replace(/\{customer_name\}/g, customerName);
  processedContent = processedContent.replace(/\{cart_items\}/g, cartItemsHtml);
  processedContent = processedContent.replace(/\{checkout_link\}/g, recoveryLink);
  
  // Replace all possible link placeholders with clickable links
  processedContent = processedContent.replace(/\[Checkout Now\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[Complete My Purchase\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[Complete Purchase\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[Complete Order\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[Shop Now\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[Buy Now\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[View Cart\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[Continue Shopping\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[Return to My Cart\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[Return to Cart\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[Go to Cart\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[View My Cart\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[Finish Order\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  processedContent = processedContent.replace(/\[Complete My Order\]/g, `<a href="${recoveryLink}" style="color: #4CAF50; text-decoration: underline;">Complete Your Order</a>`);
  
  // Debug: Log the processed content to see if links are being replaced
  console.log('Campaign content processing:');
  console.log('Original:', campaignContent);
  console.log('Processed:', processedContent);
  console.log('Recovery link:', recoveryLink);

  // Create a complete HTML email template for campaigns
  const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Complete Your Purchase</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 20px auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="margin-bottom: 25px; color: #333333; font-size: 16px; line-height: 1.6;">
          ${processedContent.replace(/\n/g, '<br>')}
        </div>

        ${campaignContent.includes('{cart_items}') ? '' : cartItemsHtml}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryLink}" style="display: inline-block; padding: 15px 30px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Complete Your Order</a>
        </div>

        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 6px;">
          <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your cart will be saved for a limited time.</p>
          <p style="margin: 0; color: #666; font-size: 14px;">
            Don't want to receive these reminders? <a href="${storeUrl.replace(/\/$/, '')}/unsubscribe?email=${encodeURIComponent(customerEmail)}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
          <p style="margin: 0;">This email was sent to ${customerEmail}</p>
          <p style="margin: 5px 0 0 0;">© 2024 CartResQ. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

    return htmlTemplate;
}

class EmailScheduler {
  constructor() {
    this.agenda = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Initialize Agenda with MongoDB connection
      this.agenda = new Agenda({
        db: {
          address: process.env.MONGODB_URI || 'mongodb://localhost:27017/cartresq',
          collection: 'email_jobs'
        },
        processEvery: '5 seconds', // Check for jobs every 5 seconds (was 30 seconds)
        maxConcurrency: 5, // Process up to 5 jobs simultaneously
        defaultConcurrency: 3
      });

      // Define job types
      this.defineJobs();

      // Start the agenda
      await this.agenda.start();
      
      console.log('✅ Email Scheduler initialized successfully');
      this.isInitialized = true;

      // Graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());

    } catch (error) {
      console.error('❌ Failed to initialize Email Scheduler:', error);
      throw error;
    }
  }

  defineJobs() {
    // Job: Send abandoned cart reminder
    this.agenda.define('send-abandoned-cart-reminder', async (job) => {
      try {
        const { cartId, platform, storeUrl, reminderType = 'first' } = job.attrs.data;
        
        console.log(`📧 Processing abandoned cart reminder for cart: ${cartId}`);
        
        const cart = await AbandonedCart.findOne({ 
          cart_id: cartId,
          platform 
        });

        if (!cart || !cart.customer_email) {
          console.log(`❌ Cart not found or no email: ${cartId}`);
          return;
        }

        // For manual scheduling, allow sending even if cart status has changed
        // Only skip if cart is explicitly completed or purchased
        if (cart.status === 'completed' || cart.status === 'purchased') {
          console.log(`ℹ️ Cart ${cartId} is completed/purchased, skipping reminder`);
          return;
        }

        // Generate email content based on reminder type
        const emailContent = await this.generateReminderEmail(cart, reminderType, storeUrl);
        
        // Send email
        const emailResult = await sendZohoEmail({
          to: cart.customer_email,
          subject: emailContent.subject,
          html: emailContent.html,
          fromEmail: process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL,
          fromName: 'CartResQ'
        });

        // Save email record
        const email = new Email({
          platform,
          to: cart.customer_email,
          subject: emailContent.subject,
          html: emailContent.html,
          messageId: emailResult.messageId,
          status: 'sent',
          cart_id: cart._id,
          metadata: {
            type: 'abandoned_cart_reminder',
            reminderType,
            storeUrl,
            cartTotal: cart.total,
            cartId: cart.cart_id
          }
        });
        await email.save();

        // Update cart status
        await AbandonedCart.findByIdAndUpdate(cart._id, {
          $set: {
            email_status: `${reminderType}_reminder_sent`,
            [`${reminderType}_reminder_sent_at`]: new Date(),
            last_reminder_id: email._id
          },
          $inc: { reminder_attempts: 1 }
        });

        console.log(`✅ Abandoned cart reminder sent successfully to ${cart.customer_email}`);

      } catch (error) {
        console.error(`❌ Error sending abandoned cart reminder:`, error);
        throw error;
      }
    });

    // Job: Send campaign email
    this.agenda.define('send-campaign-email', async (job) => {
      try {
        const { campaignId, recipientEmail, cartId, platform } = job.attrs.data;
        logCampaignDebug(`[Agenda] Processing campaign email for campaign: ${campaignId}, recipient: ${recipientEmail}`);
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
          console.log(`❌ Campaign not found: ${campaignId}`);
          return;
        }
        
        let html = campaign.content.body;
        let subject = campaign.content.subject;
        let storeUrl = process.env.STORE_URL || '';
        let cart = null;
        
        if (cartId) {
          // Fetch the abandoned cart for this recipient
          const AbandonedCart = require('../models/AbandonedCart');
          cart = await AbandonedCart.findOne({ cart_id: cartId, platform });
          // Try to get storeUrl from cart if available
          if (cart && cart.store_url) {
            storeUrl = cart.store_url;
          } else if (cart && cart.storeId) {
            storeUrl = cart.storeId;
          }
        }
        
        // If still no storeUrl, try to get it from the campaign
        if (!storeUrl && campaign.storeId) {
          storeUrl = campaign.storeId;
        }
        
        // Debug: Log storeUrl resolution
        console.log('StoreUrl resolution:', {
          envStoreUrl: process.env.STORE_URL,
          cartStoreUrl: cart?.store_url,
          cartStoreId: cart?.storeId,
          campaignStoreId: campaign.storeId,
          finalStoreUrl: storeUrl
        });
        
        // Use formatCampaignEmail to properly format campaign content with HTML
        html = formatCampaignEmail(html, cart, storeUrl);
        
        // Replace variables in subject line
        let customerName = '';
        let recoveryLink = storeUrl || '';
        if (cart) {
          if (cart.customer_data && cart.customer_data.first_name) {
            customerName = cart.customer_data.first_name;
          } else if (cart.customer_name) {
            customerName = cart.customer_name;
          } else if (cart.customer_email) {
            customerName = cart.customer_email.split('@')[0];
          }
          
          // Generate recovery link for subject
          if (cart.cart_id && cart.platform) {
            if (cart.platform === 'woocommerce') {
              const cartItemsParams = cart.items.map(item => {
                const productId = item.product_id || item.id;
                const variationId = item.variation_id;
                const quantity = item.quantity || 1;
                let addToCartParam = `add-to-cart=${productId}`;
                if (variationId) {
                  addToCartParam += `&variation_id=${variationId}`;
                }
                addToCartParam += `&quantity=${quantity}`;
                return addToCartParam;
              }).join('&');
              const timestamp = new Date().getTime();
              recoveryLink = `${storeUrl.replace(/\/$/, '')}/cart/?${cartItemsParams}&_t=${timestamp}`;
            } else if (cart.platform === 'shopify') {
              recoveryLink = `${storeUrl.replace(/\/$/, '')}/checkout/${cart.cart_id}`;
            }
          }
        }
        
        subject = subject.replace(/\{customer_name\}/g, customerName);
        subject = subject.replace(/\{checkout_link\}/g, recoveryLink);
        
        // Improve subject line to reduce spam detection
        if (subject.toLowerCase().includes('last chance') || subject.toLowerCase().includes('recover')) {
          subject = subject.replace(/last chance/i, 'Complete Your Order');
          subject = subject.replace(/recover/i, 'Complete');
        }
        
        // Add a small delay to prevent rate limiting (1 second)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Send email with spam prevention headers
        const emailResult = await sendZohoEmail({
          to: recipientEmail,
          subject,
          html,
          fromEmail: process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL,
          fromName: 'CartResQ',
          headers: {
            'List-Unsubscribe': `<mailto:${process.env.ZOHO_EMAIL_USER}?subject=unsubscribe>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
            'Precedence': 'bulk',
            'X-Mailer': 'CartResQ Email System'
          }
        });
        
        // Update campaign recipients
        campaign.recipients.push({
          email: recipientEmail,
          cartId: cartId,
          sentAt: new Date(),
          messageId: emailResult.messageId,
          status: 'sent'
        });
        await campaign.save();
        logCampaignDebug(`[Agenda] Campaign email sent successfully to ${recipientEmail}`);
      } catch (error) {
        logCampaignDebug(`[Agenda] Error sending campaign email to ${recipientEmail}: ${error && error.stack ? error.stack : error}`);
        throw error;
      }
    });

    // Job: Process scheduled campaign (looks up carts at runtime)
    this.agenda.define('process-scheduled-campaign', async (job) => {
      try {
        const { campaignId } = job.attrs.data;
        logCampaignDebug(`[Agenda] Processing scheduled campaign: ${campaignId}`);
        
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
          console.log(`❌ Campaign not found: ${campaignId}`);
          return;
        }

        // Check if campaign is still active
        if (campaign.status !== 'scheduled' && campaign.status !== 'active') {
          console.log(`❌ Campaign ${campaignId} is not active (status: ${campaign.status})`);
          return;
        }

        if (campaign.targetAudience && campaign.targetAudience.type === 'abandoned_carts') {
          const filter = { status: { $in: ['active', 'abandoned'] }, platform: campaign.platform };

          if (campaign.targetAudience.filters) {
            const { minCartValue, maxCartValue } = campaign.targetAudience.filters;
            if (minCartValue !== '' && !isNaN(minCartValue)) {
              filter.total = { $gte: Number(minCartValue) };
            }
            if (maxCartValue !== '' && !isNaN(maxCartValue)) {
              filter.total = {
                ...(filter.total || {}),
                $lte: Number(maxCartValue)
              };
            }
          }

          logCampaignDebug(`[process-scheduled-campaign] Filter: ${JSON.stringify(filter)}`);
          const carts = await AbandonedCart.find(filter);
          logCampaignDebug(`[process-scheduled-campaign] Found ${carts.length} carts in database`);
          
          // Import the filterCartsByCustomerEmails function
          const { filterCartsByCustomerEmails } = require('../controllers/campaignController');
          const filteredCarts = filterCartsByCustomerEmails(carts, campaign.targetAudience.filters?.customerEmails || []);
          logCampaignDebug(`[process-scheduled-campaign] Filtered to ${filteredCarts.length} carts`);
          
          // Schedule emails for each filtered cart with proper delays
          for (let i = 0; i < filteredCarts.length; i++) {
            const cart = filteredCarts[i];
            if (!cart.customer_email) continue;
            
            // Add longer delay between campaign emails to prevent rate limiting
            const delayMinutes = Math.floor(i / 10) * 5; // 5 minute delay every 10 emails
            const scheduledTime = new Date(Date.now() + (delayMinutes * 60 * 1000));
            
            await this.scheduleCampaignEmail(
              campaign._id,
              cart.customer_email,
              cart.cart_id,
              campaign.platform,
              scheduledTime
            );
            
            // Small delay between scheduling (not sending)
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          logCampaignDebug(`[process-scheduled-campaign] Scheduled ${filteredCarts.length} campaign emails`);
        }

        // Handle recurring campaigns - schedule next run if frequency is not 'once'
        if (campaign.schedule && campaign.schedule.frequency && campaign.schedule.frequency !== 'once') {
          await this.scheduleNextRecurringCampaign(campaign);
        }
      } catch (error) {
        logCampaignDebug(`[process-scheduled-campaign] Error: ${error && error.stack ? error.stack : error}`);
        throw error;
      }
    });

    // Job: Send discount offer
    this.agenda.define('send-discount-offer', async (job) => {
      try {
        const { cartId, platform, storeUrl, couponCode, couponAmount, couponType } = job.attrs.data;
        
        console.log(`📧 Processing discount offer for cart: ${cartId}`);
        
        const cart = await AbandonedCart.findOne({ 
          cart_id: cartId,
          platform 
        });

        if (!cart || !cart.customer_email) {
          console.log(`❌ Cart not found or no email: ${cartId}`);
          return;
        }

        // Generate discount email content
        const emailContent = await this.generateDiscountEmail(cart, couponCode, couponAmount, couponType, storeUrl);
        
        // Send email
        const emailResult = await sendZohoEmail({
          to: cart.customer_email,
          subject: emailContent.subject,
          html: emailContent.html,
          fromEmail: process.env.ZOHO_EMAIL_USER || process.env.ZOHO_EMAIL,
          fromName: 'CartResQ'
        });

        // Save email record
        const email = new Email({
          platform,
          to: cart.customer_email,
          subject: emailContent.subject,
          html: emailContent.html,
          messageId: emailResult.messageId,
          status: 'sent',
          cart_id: cart._id,
          metadata: {
            type: 'discount_offer',
            couponCode,
            couponAmount,
            couponType,
            storeUrl,
            cartTotal: cart.total,
            cartId: cart.cart_id
          }
        });
        await email.save();

        console.log(`✅ Discount offer sent successfully to ${cart.customer_email}`);

      } catch (error) {
        console.error(`❌ Error sending discount offer:`, error);
        throw error;
      }
    });
  }

  async generateReminderEmail(cart, reminderType, storeUrl) {
    const cartItems = cart.items || [];
    let cartItemsHtml = '';
    
    if (cartItems.length > 0) {
      cartItemsHtml = cartItems.map(item => {
        const productName = item.product_name || item.name || item.title || 'Product';
        const price = parseFloat(item.price || 0);
        const quantity = parseInt(item.quantity || 1);
        const total = (price * quantity).toFixed(2);
        return `
          <tr>
            <td style="padding:8px;border:1px solid #eee;">${productName}</td>
            <td style="padding:8px;border:1px solid #eee;">${quantity}</td>
            <td style="padding:8px;border:1px solid #eee;">$${price.toFixed(2)}</td>
            <td style="padding:8px;border:1px solid #eee;">$${total}</td>
          </tr>
        `;
      }).join('');
    }

    // Generate recovery link
    let recoveryLink = storeUrl;
    if (cart.cart_id) {
      if (cart.platform === 'woocommerce') {
        const cartItems = cart.items.map(item => {
          const productId = item.product_id || item.id;
          const variationId = item.variation_id;
          const quantity = item.quantity || 1;
          let addToCartParam = `add-to-cart=${productId}`;
          if (variationId) {
            addToCartParam += `&variation_id=${variationId}`;
          }
          addToCartParam += `&quantity=${quantity}`;
          return addToCartParam;
        }).join('&');
        const timestamp = new Date().getTime();
        recoveryLink = `${storeUrl.replace(/\/$/, '')}/cart/?${cartItems}&_t=${timestamp}`;
      } else if (cart.platform === 'shopify') {
        recoveryLink = `${storeUrl.replace(/\/$/, '')}/checkout/${cart.cart_id}`;
      }
    }

    const unsubscribeLink = `${storeUrl.replace(/\/$/, '')}/unsubscribe?email=${encodeURIComponent(cart.customer_email)}`;

    const subjects = {
      first: '🛒 Complete Your Purchase - Your Cart is Waiting!',
      second: '⏰ Don\'t Miss Out - Your Cart is Still Available!',
      final: '🔥 Last Chance - Complete Your Order Now!',
      manual: '🛒 Complete Your Purchase - Your Cart is Waiting!'
    };

    const messages = {
      first: 'We noticed you left some items in your cart. Don\'t miss out on these great products!',
      second: 'Your cart is still waiting for you! Complete your purchase before items sell out.',
      final: 'This is your final reminder! Complete your order now before your cart expires.',
      manual: 'We noticed you left some items in your cart. Don\'t miss out on these great products!'
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333333; font-size: 28px; margin: 0;">Complete Your Purchase! 🛒</h1>
        </div>
        
        <div style="margin-bottom: 25px; color: #333333; font-size: 16px; line-height: 1.5;">
          <p>${messages[reminderType]}</p>
          <p>Your cart is waiting for you to complete your purchase.</p>
        </div>

        ${cartItems.length > 0 ? `
          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Your Cart Items:</h3>
            <table style="width: 100%; border-collapse: collapse; background: #f9f9f9; border-radius: 6px;">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Product</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Quantity</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Price</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${cartItemsHtml}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryLink}" style="display: inline-block; padding: 15px 30px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Complete Your Order</a>
        </div>

        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 6px;">
          <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your cart will be saved for a limited time.</p>
          <p style="margin: 0; color: #666; font-size: 14px;">
            Don't want to receive these reminders? <a href="${unsubscribeLink}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>
      </div>
    `;

    return {
      subject: subjects[reminderType] || subjects.manual || 'Complete Your Purchase',
      html
    };
  }

  async generateDiscountEmail(cart, couponCode, couponAmount, couponType, storeUrl) {
    const cartItems = cart.items || [];
    let cartItemsHtml = '';
    
    if (cartItems.length > 0) {
      cartItemsHtml = cartItems.map(item => {
        const productName = item.product_name || item.name || item.title || 'Product';
        const price = parseFloat(item.price || 0);
        const quantity = parseInt(item.quantity || 1);
        const total = (price * quantity).toFixed(2);
        return `
          <tr>
            <td style="padding:8px;border:1px solid #eee;">${productName}</td>
            <td style="padding:8px;border:1px solid #eee;">${quantity}</td>
            <td style="padding:8px;border:1px solid #eee;">$${price.toFixed(2)}</td>
            <td style="padding:8px;border:1px solid #eee;">$${total}</td>
          </tr>
        `;
      }).join('');
    }

    // Generate recovery link
    let recoveryLink = storeUrl;
    if (cart.cart_id) {
      if (cart.platform === 'woocommerce') {
        const cartItems = cart.items.map(item => {
          const productId = item.product_id || item.id;
          const variationId = item.variation_id;
          const quantity = item.quantity || 1;
          let addToCartParam = `add-to-cart=${productId}`;
          if (variationId) {
            addToCartParam += `&variation_id=${variationId}`;
          }
          addToCartParam += `&quantity=${quantity}`;
          return addToCartParam;
        }).join('&');
        const timestamp = new Date().getTime();
        recoveryLink = `${storeUrl.replace(/\/$/, '')}/cart/?${cartItems}&_t=${timestamp}`;
      } else if (cart.platform === 'shopify') {
        recoveryLink = `${storeUrl.replace(/\/$/, '')}/checkout/${cart.cart_id}`;
      }
    }

    const unsubscribeLink = `${storeUrl.replace(/\/$/, '')}/unsubscribe?email=${encodeURIComponent(cart.customer_email)}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333333; font-size: 28px; margin: 0;">Special Offer Just For You! 🎁</h1>
        </div>
        
        <div style="margin-bottom: 25px; color: #333333; font-size: 16px; line-height: 1.5;">
          <p>We noticed you left some amazing items in your cart, and we want to make sure you don't miss out!</p>
          <p>As a special gesture, we're offering you an exclusive discount:</p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <p style="font-size: 18px; margin-bottom: 10px;">Use Code: <strong style="background: #f8f9fa; padding: 5px 10px; border-radius: 4px;">${couponCode}</strong></p>
          <p style="font-size: 20px; color: #e63946; margin: 10px 0;">
            Get ${couponType === 'percentage' ? `${couponAmount}%` : `$${couponAmount}`} OFF your purchase!
          </p>
          <p style="color: #666; font-style: italic; margin-top: 10px;">Limited time offer - Don't miss out!</p>
        </div>

        ${cartItems.length > 0 ? `
          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Your Cart Items:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Product</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Quantity</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Price</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Total</th>
              </tr>
              ${cartItemsHtml}
            </table>
          </div>
        ` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryLink}" style="display: inline-block; padding: 15px 30px; background-color: #e63946; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">Complete Your Purchase Now</a>
        </div>

        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 5px;">
          <p style="margin: 0 0 10px 0; color: #666;">This offer is exclusively for you and expires soon!</p>
          <p style="margin: 0; color: #666;">
            Don't want to receive these offers? <a href="${unsubscribeLink}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>
      </div>
    `;

    return {
      subject: 'Special Offer Just For You! 🎁',
      html
    };
  }

  // Schedule abandoned cart reminders
  async scheduleAbandonedCartReminder(cartId, platform, storeUrl, delayHours = 1, reminderType = 'first') {
    if (!this.isInitialized) {
      throw new Error('Email Scheduler not initialized');
    }

    const scheduledTime = new Date(Date.now() + (delayHours * 60 * 60 * 1000));
    
    await this.agenda.schedule(scheduledTime, 'send-abandoned-cart-reminder', {
      cartId,
      platform,
      storeUrl,
      reminderType
    });

    console.log(`📅 Scheduled ${reminderType} reminder for cart ${cartId} at ${scheduledTime.toISOString()}`);
  }

  // Schedule campaign email
  async scheduleCampaignEmail(campaignId, recipientEmail, cartId, platform, scheduledTime) {
    if (!this.isInitialized) {
      throw new Error('Email Scheduler not initialized');
    }

    await this.agenda.schedule(scheduledTime, 'send-campaign-email', {
      campaignId,
      recipientEmail,
      cartId,
      platform
    });

    logCampaignDebug(`Agenda: Scheduled campaign email for ${recipientEmail} at ${scheduledTime.toISOString()} (campaignId: ${campaignId})`);
  }

  // Schedule discount offer
  async scheduleDiscountOffer(cartId, platform, storeUrl, couponCode, couponAmount, couponType, delayHours = 24) {
    if (!this.isInitialized) {
      throw new Error('Email Scheduler not initialized');
    }

    const scheduledTime = new Date(Date.now() + (delayHours * 60 * 60 * 1000));
    
    await this.agenda.schedule(scheduledTime, 'send-discount-offer', {
      cartId,
      platform,
      storeUrl,
      couponCode,
      couponAmount,
      couponType
    });

    console.log(`📅 Scheduled discount offer for cart ${cartId} at ${scheduledTime.toISOString()}`);
  }

  // Get queue status
  async getQueueStatus() {
    if (!this.isInitialized) {
      return { error: 'Email Scheduler not initialized' };
    }

    try {
      const jobCounts = await this.agenda.jobs({});
      const runningJobs = await this.agenda.jobs({ lastRunAt: { $exists: true } });
      const failedJobs = await this.agenda.jobs({ 'lastRunAt': { $exists: true }, 'lastRunAt.failedAt': { $exists: true } });

      return {
        totalJobs: jobCounts.length,
        runningJobs: runningJobs.length,
        failedJobs: failedJobs.length,
        isInitialized: this.isInitialized,
        nextRunTime: jobCounts.length > 0 ? jobCounts[0].nextRunAt : null
      };
    } catch (error) {
      console.error('Error getting queue status:', error);
      return { error: error.message };
    }
  }

  // Cancel all jobs for a specific cart
  async cancelCartJobs(cartId) {
    if (!this.isInitialized) {
      throw new Error('Email Scheduler not initialized');
    }

    const jobs = await this.agenda.jobs({ 'data.cartId': cartId });
    for (const job of jobs) {
      await job.remove();
    }

    console.log(`🗑️ Cancelled ${jobs.length} jobs for cart ${cartId}`);
  }

  // Schedule next recurring campaign run
  async scheduleNextRecurringCampaign(campaign) {
    try {
      if (!campaign.schedule || !campaign.schedule.frequency || campaign.schedule.frequency === 'once') {
        return;
      }

      // Calculate next run time based on frequency
      let nextRunTime = new Date();
      
      switch (campaign.schedule.frequency) {
        case 'daily':
          nextRunTime.setDate(nextRunTime.getDate() + 1);
          break;
        case 'weekly':
          nextRunTime.setDate(nextRunTime.getDate() + 7);
          break;
        case 'monthly':
          nextRunTime.setMonth(nextRunTime.getMonth() + 1);
          break;
        default:
          console.log(`❌ Unknown frequency: ${campaign.schedule.frequency}`);
          return;
      }

      // Set the time of day if specified
      if (campaign.schedule.timeOfDay) {
        const [hours, minutes] = campaign.schedule.timeOfDay.split(':');
        nextRunTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      // Check if campaign has an end date
      if (campaign.schedule.endDate && nextRunTime > new Date(campaign.schedule.endDate)) {
        console.log(`📅 Campaign ${campaign._id} has reached its end date`);
        return;
      }

      // Schedule the next run
      await this.agenda.schedule(nextRunTime, 'process-scheduled-campaign', {
        campaignId: campaign._id
      });

      console.log(`📅 Scheduled next ${campaign.schedule.frequency} run for campaign ${campaign._id} at ${nextRunTime.toISOString()}`);
      
    } catch (error) {
      console.error(`❌ Error scheduling next recurring campaign: ${error.message}`);
    }
  }

  // Graceful shutdown
  async gracefulShutdown() {
    if (this.agenda) {
      console.log('🔄 Shutting down Email Scheduler gracefully...');
      await this.agenda.stop();
      console.log('✅ Email Scheduler stopped');
    }
    process.exit(0);
  }
}

// Create singleton instance
const emailScheduler = new EmailScheduler();
  
module.exports = { emailScheduler, fillCampaignTemplate }; 