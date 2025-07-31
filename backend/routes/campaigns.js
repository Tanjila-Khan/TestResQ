const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');

// Get all campaigns (with optional filters)
router.get('/', campaignController.getCampaigns);

// Get campaign by ID
router.get('/:id', campaignController.getCampaignById);

// Create new campaign
router.post('/', campaignController.createCampaign);

// Update campaign
router.put('/:id', campaignController.updateCampaign);

// Delete campaign
router.delete('/:id', campaignController.deleteCampaign);

// Get campaign stats
router.get('/:id/stats', campaignController.getCampaignStats);

// Get campaign performance
router.get('/:id/performance', campaignController.getCampaignPerformance);

// Pause campaign
router.patch('/:id/pause', campaignController.pauseCampaign);
// Play/resume campaign
router.patch('/:id/play', campaignController.playCampaign);
// Send now
router.post('/:id/send-now', campaignController.sendNowCampaign);

// Test endpoint
router.get('/test/status', (req, res) => {
  res.json({ 
    message: 'Campaigns API is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 