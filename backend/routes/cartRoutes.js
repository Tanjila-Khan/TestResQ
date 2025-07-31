const express = require('express');
const router = express.Router();
const { 
  getCarts,
  getCartById,
  updateCartStatus,
  getAbandonedCarts,
  getActiveCarts,
  saveCart,
  markCartRecovered
} = require('../controllers/cartController');
const { authenticate } = require('../middleware/auth');

// Get abandoned carts - require authentication
router.get('/abandoned', authenticate, getAbandonedCarts);

// Get active carts - require authentication
router.get('/active', authenticate, getActiveCarts);

// Get cart by ID - require authentication
router.get('/:id', authenticate, getCartById);

// Update cart status - require authentication
router.put('/:id/status', authenticate, updateCartStatus);

// Get all carts - require authentication
router.get('/', authenticate, getCarts);

// Save cart data - require authentication
router.post('/', authenticate, saveCart);

// Mark cart recovered - require authentication
router.post('/mark-recovered', authenticate, markCartRecovered);

module.exports = router;