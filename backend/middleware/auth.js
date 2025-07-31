const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to authenticate requests using JWT
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'User account is inactive' });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to check if user has required role
 * @param {string[]} roles - Array of allowed roles
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/**
 * Middleware to check if user has access to specific store
 * @param {string} storeIdParam - Name of the parameter containing store ID
 */
const authorizeStore = (storeIdParam = 'storeId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const storeId = req.params[storeIdParam] || req.body[storeIdParam] || req.query[storeIdParam];
      if (!storeId) {
        return res.status(400).json({ error: 'Store ID is required' });
      }

      // Check if user has access to the store
      const hasAccess = req.user.stores.some(store => 
        store.storeId === storeId && store.isActive
      );

      if (!hasAccess) {
        return res.status(403).json({ error: 'No access to this store' });
      }

      next();
    } catch (err) {
      console.error('Store authorization error:', err);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  authorizeStore
}; 