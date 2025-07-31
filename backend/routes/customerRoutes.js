const express = require('express');
const router = express.Router();
const { getAbandonedCartCustomers } = require('../controllers/customerController');

router.get('/abandoned', getAbandonedCartCustomers);
 
module.exports = router; 