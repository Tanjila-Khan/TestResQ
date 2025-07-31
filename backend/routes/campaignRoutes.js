const express = require('express');
const router = express.Router();
const {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  sendBulkCampaignEmails,
  sendCampaignToAbandonedCarts,
  pauseCampaign,
  playCampaign,
  sendNowCampaign
} = require('../controllers/campaignController');

// Campaign routes
router.get('/', getCampaigns);
router.post('/', createCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

// Campaign email routes
// router.post('/send-bulk', sendBulkCampaignEmails);
// router.post('/send-to-abandoned-carts', sendCampaignToAbandonedCarts);

// Pause campaign
router.patch('/:id/pause', pauseCampaign);
// Play/resume campaign
router.patch('/:id/play', playCampaign);
// Send now
router.post('/:id/send-now', sendNowCampaign);

module.exports = router; 