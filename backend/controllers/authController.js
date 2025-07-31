const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendZohoEmail } = require('../utils/mailer');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isMatch = await user.comparePassword(password);
    console.log('Password match result:', isMatch);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ error: 'User account is inactive' });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Sync subscription status if user has Stripe customer ID
    if (user.stripeCustomerId) {
      try {
        const { stripe } = require('../config/stripe');
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'active',
          limit: 1
        });
        
        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];
          const priceId = subscription.items.data[0]?.price?.id;
          
          // Map price ID to plan key
          const { plans } = require('../config/stripe');
          let planKey = null;
          for (const [key, plan] of Object.entries(plans)) {
            if (plan.stripePriceId === priceId) {
              planKey = key;
              break;
            }
          }
          
          if (planKey && (user.subscriptionPlan !== planKey || user.subscriptionStatus !== subscription.status)) {
            console.log('Syncing subscription on login:', {
              userId: user._id,
              email: user.email,
              oldPlan: user.subscriptionPlan,
              oldStatus: user.subscriptionStatus,
              newPlan: planKey,
              newStatus: subscription.status
            });
            
            user.subscriptionPlan = planKey;
            user.subscriptionStatus = subscription.status;
            await user.save();
          }
        }
      } catch (syncError) {
        console.error('Error syncing subscription on login:', syncError);
      }
    }
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: user.getPublicProfile() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    const user = new User({ name, email, password });
    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: user.getPublicProfile() });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    
    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    console.log('Attempting to send password reset email to:', user.email);
    console.log('Reset URL:', resetUrl);
    
    try {
      const emailResult = await sendZohoEmail({
        to: user.email,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333333; margin-bottom: 20px;">Password Reset Request</h2>
            <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">You requested a password reset for your CartResQ account.</p>
            <p style="color: #666666; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #3B82F6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Reset Password</a>
            </div>
            
            <p style="color: #666666; font-size: 14px; margin-bottom: 15px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #3B82F6; font-size: 14px; word-break: break-all; margin-bottom: 20px;">${resetUrl}</p>
            
            <p style="color: #666666; font-size: 14px; margin-bottom: 10px;">This link will expire in 1 hour.</p>
            <p style="color: #666666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
        `
      });
      
      console.log('Password reset email sent successfully:', emailResult);
      res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
}; 