const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email address'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  stores: [{
    storeId: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      enum: ['woocommerce', 'shopify', 'magento'],
      required: true
    },
    storeUrl: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    credentials: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    connectedAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastLogin: {
    type: Date
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  stripeCustomerId: {
    type: String,
    default: null
  },
  subscriptionPlan: {
    type: String,
    enum: ['free', 'starter', 'professional', 'enterprise', null],
    default: null
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'trialing', 'past_due', 'canceled', 'unpaid', null],
    default: null
  },
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (err) {
    throw err;
  }
};

// Method to get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;
  return userObject;
};

// Static method to find user by credentials
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email });
  if (!user) {
    throw new Error('Invalid login credentials');
  }
  
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid login credentials');
  }
  
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User; 