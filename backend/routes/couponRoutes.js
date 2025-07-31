const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authenticate } = require('../middleware/auth');

// GET all coupons - require authentication
router.get('/', authenticate, couponController.getCoupons);
// GET a single coupon by ID - require authentication
router.get('/:id', authenticate, couponController.getCouponById);
// POST create a new coupon - require authentication
router.post('/', authenticate, couponController.createCoupon);
// PUT update a coupon - require authentication
router.put('/:id', authenticate, couponController.updateCoupon);
// DELETE a coupon - require authentication
router.delete('/:id', authenticate, couponController.deleteCoupon);
// POST validate a coupon - require authentication
router.post('/validate', authenticate, couponController.validateCoupon);
// POST apply a coupon to a cart - require authentication
router.post('/apply', authenticate, couponController.applyCouponToCart);
// POST send reminder to abandoned cart customers - require authentication
router.post('/sendReminder', authenticate, couponController.sendReminder);

module.exports = router; 