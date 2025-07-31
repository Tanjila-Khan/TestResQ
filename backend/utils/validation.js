const mongoose = require('mongoose');

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid ObjectId, false otherwise
 */
const validateObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validates if a string is a valid email address
 * @param {string} email - The email to validate
 * @returns {boolean} - True if valid email, false otherwise
 */
const validateEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates if a string is a valid URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid URL, false otherwise
 */
const validateUrl = (url) => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Validates if a string is a valid coupon code
 * @param {string} code - The coupon code to validate
 * @returns {boolean} - True if valid coupon code, false otherwise
 */
const validateCouponCode = (code) => {
  if (!code) return false;
  const couponCodeRegex = /^[A-Z0-9-]+$/;
  return couponCodeRegex.test(code);
};

/**
 * Validates if a number is within a specified range
 * @param {number} value - The number to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {boolean} - True if within range, false otherwise
 */
const validateNumberRange = (value, min, max) => {
  if (typeof value !== 'number') return false;
  return value >= min && value <= max;
};

/**
 * Validates if a date is in the future
 * @param {Date|string} date - The date to validate
 * @returns {boolean} - True if date is in the future, false otherwise
 */
const validateFutureDate = (date) => {
  if (!date) return false;
  const dateObj = new Date(date);
  return dateObj > new Date();
};

/**
 * Validates if a date range is valid (start date before end date)
 * @param {Date|string} startDate - The start date
 * @param {Date|string} endDate - The end date
 * @returns {boolean} - True if valid date range, false otherwise
 */
const validateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start < end;
};

module.exports = {
  validateObjectId,
  validateEmail,
  validateUrl,
  validateCouponCode,
  validateNumberRange,
  validateFutureDate,
  validateDateRange
}; 