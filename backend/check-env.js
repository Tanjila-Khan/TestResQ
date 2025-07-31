require('dotenv').config();

console.log('🔍 Checking Environment Variables for Email Scheduler...\n');

const requiredVars = {
  'MONGODB_URI': 'MongoDB connection string',
  'ZOHO_EMAIL_USER': 'Zoho Mail username',
  'ZOHO_EMAIL_PASSWORD': 'Zoho Mail password',
  'ZOHO_EMAIL': 'Zoho Mail email address',
  'JWT_SECRET': 'JWT secret key',
  'FRONTEND_URL': 'Frontend URL for email links'
};

const optionalVars = {
  'NODE_ENV': 'Node environment (development/production)',
  'PORT': 'Server port (default: 3003)'
};

let allRequiredSet = true;

console.log('📋 Required Environment Variables:');
console.log('='.repeat(50));

Object.entries(requiredVars).forEach(([varName, description]) => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${description}`);
    if (varName.includes('PASSWORD') || varName.includes('SECRET')) {
      console.log(`   Value: ${'*'.repeat(Math.min(value.length, 8))}`);
    } else {
      console.log(`   Value: ${value}`);
    }
  } else {
    console.log(`❌ ${varName}: ${description} - NOT SET`);
    allRequiredSet = false;
  }
  console.log('');
});

console.log('📋 Optional Environment Variables:');
console.log('='.repeat(50));

Object.entries(optionalVars).forEach(([varName, description]) => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${description}`);
    console.log(`   Value: ${value}`);
  } else {
    console.log(`⚠️  ${varName}: ${description} - NOT SET (using default)`);
  }
  console.log('');
});

console.log('📋 Email Configuration Test:');
console.log('='.repeat(50));

// Test email configuration
const emailConfig = {
  ZOHO_EMAIL_USER: process.env.ZOHO_EMAIL_USER,
  ZOHO_EMAIL: process.env.ZOHO_EMAIL,
  ZOHO_EMAIL_PASSWORD: process.env.ZOHO_EMAIL_PASSWORD ? 'SET' : 'NOT SET'
};

console.log('Email Configuration:', emailConfig);

// Test MongoDB connection string format
if (process.env.MONGODB_URI) {
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://')) {
    console.log('✅ MongoDB URI format looks correct');
  } else {
    console.log('⚠️  MongoDB URI format may be incorrect');
  }
}

console.log('\n' + '='.repeat(50));
if (allRequiredSet) {
  console.log('🎉 All required environment variables are set!');
  console.log('✅ Email scheduler should work correctly.');
} else {
  console.log('⚠️  Some required environment variables are missing.');
  console.log('❌ Email scheduler may not work properly.');
  console.log('\nPlease set the missing variables in your .env file.');
}
console.log('='.repeat(50));

// Provide setup instructions
if (!allRequiredSet) {
  console.log('\n📝 Setup Instructions:');
  console.log('1. Create a .env file in the backend directory');
  console.log('2. Add the missing environment variables:');
  console.log('');
  
  Object.entries(requiredVars).forEach(([varName, description]) => {
    if (!process.env[varName]) {
      console.log(`${varName}=your_value_here  # ${description}`);
    }
  });
  
  console.log('\n3. Restart your server after adding the variables');
} 