#!/usr/bin/env node

/**
 * Authentication Test Script
 * 
 * This script helps test authentication and subscription status.
 */

const axios = require('axios');

const testAuth = async () => {
  console.log('🔐 Testing Authentication Status\n');
  
  try {
    // Test 1: Check subscription status without auth
    console.log('1. Testing subscription status without authentication...');
    const response = await axios.get('http://localhost:3003/api/subscribe/status');
    console.log('Response:', response.data);
    
    if (response.data.authenticated === false) {
      console.log('❌ No user is currently authenticated');
      console.log('\n💡 To fix this, you need to:');
      console.log('1. Go to http://localhost:3000/login');
      console.log('2. Register a new account or login');
      console.log('3. The token will be stored automatically');
      console.log('4. Then test the payment methods again');
    } else {
      console.log('✅ User is authenticated');
    }
    
    // Test 2: Check if there are any users in the database
    console.log('\n2. Testing payment methods endpoint...');
    const paymentMethodsResponse = await axios.get('http://localhost:3003/api/subscribe/payment-methods');
    console.log('✅ Payment methods endpoint working');
    console.log('Available methods:', paymentMethodsResponse.data.paymentMethods.length);
    
    // Test 3: Check test cards
    console.log('\n3. Testing test cards endpoint...');
    const testCardsResponse = await axios.get('http://localhost:3003/api/subscribe/payment-methods/test-cards');
    console.log('✅ Test cards endpoint working');
    console.log('Test cards available:', Object.keys(testCardsResponse.data.testCards).length);
    
  } catch (error) {
    console.log('❌ Test failed:');
    console.log('Error:', error.message);
    
    if (error.response?.status === 500) {
      console.log('\n💡 Backend error detected. Check the backend logs for more details.');
    }
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. Open http://localhost:3000 in your browser');
  console.log('2. Register a new account or login');
  console.log('3. Navigate to /payment-test to test payment methods');
  console.log('4. Check browser console for any errors');
};

testAuth(); 