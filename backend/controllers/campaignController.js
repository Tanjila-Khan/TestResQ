const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const StoreConnection = require('../models/StoreConnection');
const { validateObjectId } = require('../utils/validation');
const { sendZohoEmail } = require('../utils/mailer');
const AbandonedCart = require('../models/AbandonedCart');
const { emailScheduler } = require('../services/emailScheduler');
const fs = require('fs');
const path = require('path');
const campaignLogFile = path.join(__dirname, '..', 'logs', 'campaign-debug.log');
function logCampaignDebug(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(campaignLogFile, logMessage);
  console.log(message);
}

/**
 * Get all campaigns with optional filters
 */
const getCampaigns = async (req, res) => {
  try {
    const {
      status,
      type,
      platform,
      storeId,
      limit = 10,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (platform) filter.platform = platform;
    if (storeId) filter.storeId = storeId;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get campaigns
    const campaigns = await Campaign.find(filter)
      .sort(sort)
        .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email');

    // Get total count
    const total = await Campaign.countDocuments(filter);

    res.json({
        campaigns,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};

/**
 * Get campaign by ID
 */
const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    const campaign = await Campaign.findById(id)
      .populate('createdBy', 'name email');

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (err) {
    console.error('Error fetching campaign:', err);
    res.status(500).json({ error: 'Failed to fetch campaign' });
    }
};

/**
 * Create new campaign
 */
const createCampaign = async (req, res) => {
  try {
    
    // Get user from request (handle both authenticated and unauthenticated cases)
    let userId = null;
    if (req.user && req.user._id) {
      userId = req.user._id;
    } else {
      // For now, create a default user ID if no user is authenticated
      // In production, you should require authentication
      userId = new mongoose.Types.ObjectId();
    }

    // Determine if campaign should be scheduled
    let status = req.body.status || 'draft';
    let scheduledDateTime = null;
    if (req.body.schedule && req.body.schedule.startDate && req.body.schedule.timeOfDay) {
      const dateStr = req.body.schedule.startDate;
      const timeStr = req.body.schedule.timeOfDay;
      scheduledDateTime = new Date(`${dateStr}T${timeStr}:00Z`);
      // Always set status to 'scheduled' if schedule is provided
      status = 'scheduled';
    }

    // Restructure targetAudience to match the model schema
    let targetAudience = req.body.targetAudience;
    if (targetAudience && targetAudience.type === 'abandoned_carts') {
      // Move customerEmails to filters.customerEmails to match the model schema
      targetAudience = {
        ...targetAudience,
        filters: {
          ...targetAudience.filters,
          customerEmails: targetAudience.customerEmails || []
        }
      };
      // Remove the top-level customerEmails since it's now in filters
      delete targetAudience.customerEmails;
    }

    // Convert schedule.startDate to Date object if it's a string
    if (req.body.schedule && req.body.schedule.startDate) {
      if (typeof req.body.schedule.startDate === 'string') {
        req.body.schedule.startDate = new Date(req.body.schedule.startDate);
      }
    }

    // Remove _id if it exists to prevent duplicate key errors
    const { _id, ...campaignDataWithoutId } = req.body;
    
    const campaignData = {
      ...campaignDataWithoutId,
      targetAudience,
      createdBy: userId,
      status
    };

    // Validate that abandoned cart campaigns have at least one customer selected
    if (campaignData.targetAudience && campaignData.targetAudience.type === 'abandoned_carts') {
      const customerEmails = campaignData.targetAudience.filters?.customerEmails || campaignData.targetAudience.customerEmails || [];
      if (!Array.isArray(customerEmails) || customerEmails.length === 0) {
        return res.status(400).json({ 
          error: 'At least one customer must be selected for abandoned cart campaigns' 
        });
      }
    }

    const campaign = new Campaign(campaignData);
    await campaign.save();

    // For scheduled campaigns, we'll defer cart lookup to when the campaign actually runs
    // This prevents issues with carts not being available during campaign creation
    if (status === 'scheduled' && scheduledDateTime) {
      logCampaignDebug(`[createCampaign] Campaign scheduled for ${scheduledDateTime.toISOString()}`);
      logCampaignDebug(`[createCampaign] Scheduling process-scheduled-campaign job`);
      
      // Schedule the campaign processing job
      await emailScheduler.agenda.schedule(scheduledDateTime, 'process-scheduled-campaign', {
        campaignId: campaign._id
      });
      
      logCampaignDebug(`[createCampaign] Scheduled process-scheduled-campaign job for ${scheduledDateTime.toISOString()}`);
    }

    res.status(201).json(campaign);
  } catch (err) {
    console.error('Error creating campaign:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create campaign' });
  }
};

/**
 * Update campaign
 */
const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Track if schedule or status is being updated
    let scheduleChanged = false;
    let statusChanged = false;
    let newScheduledDateTime = null;
    if (req.body.schedule && req.body.schedule.startDate && req.body.schedule.timeOfDay) {
      const dateStr = req.body.schedule.startDate;
      const timeStr = req.body.schedule.timeOfDay;
      newScheduledDateTime = new Date(`${dateStr}T${timeStr}:00Z`);
      if (
        !campaign.schedule ||
        campaign.schedule.startDate !== req.body.schedule.startDate ||
        campaign.schedule.timeOfDay !== req.body.schedule.timeOfDay
      ) {
        scheduleChanged = true;
      }
    }
    if (req.body.status && req.body.status !== campaign.status) {
      statusChanged = true;
    }

    // Convert schedule.startDate to Date object if it's a string
    if (req.body.schedule && req.body.schedule.startDate) {
      if (typeof req.body.schedule.startDate === 'string') {
        req.body.schedule.startDate = new Date(req.body.schedule.startDate);
      }
    }

    // Update campaign fields
    Object.keys(req.body).forEach(key => {
      if (key !== 'createdBy' && key !== '_id') {
        campaign[key] = req.body[key];
      }
    });

    // Validate that abandoned cart campaigns have at least one customer selected
    if (campaign.targetAudience && campaign.targetAudience.type === 'abandoned_carts') {
      const customerEmails = campaign.targetAudience.filters?.customerEmails || campaign.targetAudience.customerEmails || [];
      if (!Array.isArray(customerEmails) || customerEmails.length === 0) {
        return res.status(400).json({ 
          error: 'At least one customer must be selected for abandoned cart campaigns' 
        });
      }
    }

    await campaign.save();

    // If campaign is cancelled, remove scheduled jobs
    if (campaign.status === 'cancelled') {
      // Remove all scheduled jobs for this campaign
      // (Assumes emailScheduler has a method to cancel by campaignId)
      if (emailScheduler.agenda) {
        const jobs = await emailScheduler.agenda.jobs({ 'data.campaignId': campaign._id });
        for (const job of jobs) {
          await job.remove();
        }
        console.log(`Cancelled ${jobs.length} scheduled jobs for campaign ${campaign._id}`);
      }
    } else if (scheduleChanged && newScheduledDateTime) {
      // Reschedule jobs: remove old jobs, schedule new ones
      if (emailScheduler.agenda) {
        const jobs = await emailScheduler.agenda.jobs({ 'data.campaignId': campaign._id });
        for (const job of jobs) {
          await job.remove();
        }
        console.log(`Rescheduling campaign ${campaign._id} to new time ${newScheduledDateTime}`);
        // Re-schedule for all recipients (same logic as create)
        let recipientEmails = [];
        if (campaign.targetAudience && campaign.targetAudience.type === 'abandoned_carts') {
          const filter = { status: { $in: ['active', 'abandoned'] }, platform: campaign.platform };
          if (campaign.targetAudience.filters) {
            if (campaign.targetAudience.filters.minCartValue) filter.total = { $gte: campaign.targetAudience.filters.minCartValue };
            if (campaign.targetAudience.filters.maxCartValue) filter.total = { ...filter.total, $lte: campaign.targetAudience.filters.maxCartValue };
          }
          const AbandonedCart = require('../models/AbandonedCart');
          const carts = await AbandonedCart.find(filter);
          const filteredCarts = filterCartsByCustomerEmails(carts, campaign.targetAudience.customerEmails);
          recipientEmails = filteredCarts.map(c => c.customer_email).filter(Boolean);
        } else if (campaign.targetAudience && campaign.targetAudience.type === 'specific_customers') {
          recipientEmails = (campaign.targetAudience.customerEmails || []);
        }
        for (const email of recipientEmails) {
          await emailScheduler.scheduleCampaignEmail(
            campaign._id,
            email,
            null,
            campaign.platform,
            newScheduledDateTime
          );
        }
      }
    }
    res.json(campaign);
  } catch (err) {
    console.error('Error updating campaign:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to update campaign' });
  }
};

/**
 * Delete campaign
 */
const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting campaign:', id);

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    await Campaign.findByIdAndDelete(id);
    console.log('Campaign deleted successfully:', id);
    res.json({ message: 'Campaign deleted successfully' });
  } catch (err) {
    console.error('Error deleting campaign:', err);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
};

/**
 * Get campaign stats
 */
const getCampaignStats = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Calculate campaign stats
    const stats = {
      totalRecipients: campaign.recipients.length,
      totalOpens: campaign.recipients.filter(r => r.opened).length,
      totalClicks: campaign.recipients.filter(r => r.clicked).length,
      totalConversions: campaign.recipients.filter(r => r.converted).length,
      openRate: campaign.recipients.length > 0 
        ? (campaign.recipients.filter(r => r.opened).length / campaign.recipients.length) * 100 
        : 0,
      clickRate: campaign.recipients.length > 0
        ? (campaign.recipients.filter(r => r.clicked).length / campaign.recipients.length) * 100
        : 0,
      conversionRate: campaign.recipients.length > 0
        ? (campaign.recipients.filter(r => r.converted).length / campaign.recipients.length) * 100
        : 0
    };

    res.json(stats);
  } catch (err) {
    console.error('Error fetching campaign stats:', err);
    res.status(500).json({ error: 'Failed to fetch campaign stats' });
  }
};

/**
 * Get campaign performance
 */
const getCampaignPerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '7d' } = req.query;

    if (!validateObjectId(id)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate;
    switch (period) {
      case '24h':
        startDate = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    }

    // Get performance data
    const performance = campaign.recipients
      .filter(r => r.sentAt >= startDate)
      .reduce((acc, recipient) => {
        const date = recipient.sentAt.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = {
            sent: 0,
            opens: 0,
            clicks: 0,
            conversions: 0
          };
        }
        acc[date].sent++;
        if (recipient.opened) acc[date].opens++;
        if (recipient.clicked) acc[date].clicks++;
        if (recipient.converted) acc[date].conversions++;
        return acc;
      }, {});

    res.json(performance);
  } catch (err) {
    console.error('Error fetching campaign performance:', err);
    res.status(500).json({ error: 'Failed to fetch campaign performance' });
  }
};

/**
 * Send bulk campaign emails
 */
const sendBulkCampaignEmails = async (req, res) => {
  return res.status(403).json({ error: 'This endpoint is disabled. Use campaign scheduling only.' });
};

/**
 * Send campaign to abandoned carts
 */
const sendCampaignToAbandonedCarts = async (req, res) => {
  return res.status(403).json({ error: 'This endpoint is disabled. Use campaign scheduling only.' });
};

// Pause campaign
const pauseCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    campaign.status = 'paused';
    await campaign.save();
    // Remove all scheduled jobs for this campaign
    if (emailScheduler.agenda) {
      const jobs = await emailScheduler.agenda.jobs({ 'data.campaignId': campaign._id });
      for (const job of jobs) {
        await job.remove();
      }
    }
    res.json({ success: true, status: 'paused', campaign });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
};

// Play/resume campaign
const playCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    campaign.status = 'scheduled';
    await campaign.save();
    // Re-schedule jobs for all recipients who haven't been sent
    let recipientEmails = [];
    let recipientCarts = [];
    if (campaign.targetAudience && campaign.targetAudience.type === 'abandoned_carts') {
      const filter = { status: { $in: ['active', 'abandoned'] }, platform: campaign.platform };
      if (campaign.targetAudience.filters) {
        if (campaign.targetAudience.filters.minCartValue) filter.total = { $gte: campaign.targetAudience.filters.minCartValue };
        if (campaign.targetAudience.filters.maxCartValue) filter.total = { ...filter.total, $lte: campaign.targetAudience.filters.maxCartValue };
      }
      const AbandonedCart = require('../models/AbandonedCart');
      const carts = await AbandonedCart.find(filter);
      const filteredCarts = filterCartsByCustomerEmails(carts, campaign.targetAudience.customerEmails);
      recipientEmails = filteredCarts.map(c => c.customer_email).filter(Boolean);
      recipientCarts = filteredCarts;
    } else if (campaign.targetAudience && campaign.targetAudience.type === 'specific_customers') {
      recipientEmails = (campaign.targetAudience.customerEmails || []);
    }
    const delay = campaign.schedule && campaign.schedule.delay ? Number(campaign.schedule.delay) : 0;
    if (campaign.targetAudience && campaign.targetAudience.type === 'abandoned_carts' && delay > 0) {
      for (const cart of recipientCarts) {
        if (!cart.customer_email) continue;
        const sendTime = new Date(new Date(cart.last_activity).getTime() + delay * 60 * 60 * 1000);
        if (sendTime > new Date()) {
          await emailScheduler.scheduleCampaignEmail(
            campaign._id,
            cart.customer_email,
            cart._id,
            campaign.platform,
            sendTime
          );
        }
      }
    } else {
      for (const email of recipientEmails) {
        await emailScheduler.scheduleCampaignEmail(
          campaign._id,
          email,
          null,
          campaign.platform,
          new Date() // schedule immediately
        );
      }
    }
    res.json({ success: true, status: 'scheduled', campaign });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resume campaign' });
  }
};

// Helper to filter carts by customer emails (case-insensitive)
function filterCartsByCustomerEmails(carts, customerEmails) {
  logCampaignDebug(`[filterCartsByCustomerEmails] Input: ${carts.length} carts, ${customerEmails?.length || 0} selected emails`);
  
  if (!Array.isArray(customerEmails) || customerEmails.length === 0) {
    logCampaignDebug('[filterCartsByCustomerEmails] No customer emails provided, returning empty array');
    return [];
  }
  
  const customerEmailsLower = customerEmails.map(email => email.trim().toLowerCase());
  const filteredCarts = carts.filter(
    cart =>
      cart.customer_email &&
      customerEmailsLower.includes(cart.customer_email.trim().toLowerCase())
  );
  
  logCampaignDebug(`[filterCartsByCustomerEmails] Output: ${filteredCarts.length} filtered carts`);
  return filteredCarts;
}



// Send now (immediate send)
const sendNowCampaign = async (req, res) => {
  try {
    logCampaignDebug('=== sendNowCampaign endpoint called ===');
    const { id } = req.params;
    logCampaignDebug(`[sendNowCampaign] Looking for campaign with ID: ${id}`);
    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    logCampaignDebug(`[sendNowCampaign] Found campaign: ${JSON.stringify(campaign)}`);
    // Send emails to all recipients immediately
    let recipientEmails = [];
    let recipientCarts = [];
    const AbandonedCart = require('../models/AbandonedCart');
    if (campaign.targetAudience && campaign.targetAudience.type === 'abandoned_carts') {
      logCampaignDebug(`[sendNowCampaign] Campaign targetAudience: ${JSON.stringify(campaign.targetAudience)}`);
      logCampaignDebug(`[sendNowCampaign] Customer emails from campaign: ${JSON.stringify(campaign.targetAudience.filters?.customerEmails || [])}`);
      
      const filter = { status: { $in: ['active', 'abandoned'] }, platform: campaign.platform };
      if (campaign.targetAudience.filters) {
        if (campaign.targetAudience.filters.minCartValue) filter.total = { $gte: campaign.targetAudience.filters.minCartValue };
        if (campaign.targetAudience.filters.maxCartValue) filter.total = { ...filter.total, $lte: campaign.targetAudience.filters.maxCartValue };
      }
      const carts = await AbandonedCart.find(filter);
      logCampaignDebug(`[sendNowCampaign] Found ${carts.length} carts in database`);
      const filteredCarts = filterCartsByCustomerEmails(carts, campaign.targetAudience.filters?.customerEmails || []);
      recipientEmails = filteredCarts.map(c => c.customer_email);
      recipientCarts = filteredCarts;
      logCampaignDebug('[DEBUG] Final recipientEmails (sendNow): ' + JSON.stringify(recipientEmails));
    } else if (campaign.targetAudience && campaign.targetAudience.type === 'specific_customers') {
      const emails = (campaign.targetAudience.customerEmails || []);
      for (const email of emails) {
        // Find the most recent abandoned cart for this email
        const cart = await AbandonedCart.findOne({
          customer_email: email,
          status: 'abandoned',
          platform: campaign.platform
        }).sort({ last_activity: -1 });
        if (cart) {
          recipientEmails.push(email);
          recipientCarts.push(cart);
        }
      }
    }
    logCampaignDebug(`[sendNowCampaign] recipientEmails: ${JSON.stringify(recipientEmails)}, recipientCarts: ${JSON.stringify(recipientCarts)}`);
    // Remove all scheduled jobs for this campaign
    if (emailScheduler.agenda) {
      const jobs = await emailScheduler.agenda.jobs({ 'data.campaignId': campaign._id });
      for (const job of jobs) {
        await job.remove();
      }
    }
    // Send immediately with rate limiting (2 second delay between emails to avoid Zoho rate limits)
    for (let i = 0; i < recipientEmails.length; i++) {
      const email = recipientEmails[i];
      const cart = recipientCarts[i];
      try {
        logCampaignDebug(`[sendNowCampaign] Scheduling campaign email for ${email} immediately`);
        
        // Add delay between emails to avoid rate limiting (2 seconds)
        const sendTime = new Date(Date.now() + (i * 2000)); // 2 second delay between each email
        
        await emailScheduler.scheduleCampaignEmail(
          campaign._id,
          email,
          cart ? cart._id : null,
          campaign.platform,
          sendTime
        );
        logCampaignDebug(`[sendNowCampaign] Scheduled campaign email for ${email} at ${sendTime.toISOString()}`);
      } catch (err) {
        logCampaignDebug(`[sendNowCampaign] Error: ${err && err.stack ? err.stack : err}`);
        console.error('Error scheduling campaign email for', email, err);
        return res.status(500).json({ error: 'Failed to send campaign now', details: err.message, stack: err.stack });
      }
    }
    campaign.status = 'sent';
    await campaign.save();
    res.json({ success: true, status: 'sent', campaign });
  } catch (err) {
    console.error('Error in sendNowCampaign:', err);
    res.status(500).json({ error: 'Failed to send campaign now', details: err.message, stack: err.stack });
  }
};

module.exports = {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
  getCampaignPerformance,
  sendBulkCampaignEmails,
  sendCampaignToAbandonedCarts,
  pauseCampaign,
  playCampaign,
  sendNowCampaign,
  filterCartsByCustomerEmails
}; 