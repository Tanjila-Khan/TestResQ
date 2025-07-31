# Campaign Targeting Fix

## Problem Description

The campaign system was sending emails to all abandoned cart customers instead of only the selected customers. This happened because:

1. **Frontend Logic Issue**: When no customers were explicitly selected, the system defaulted to sending to ALL abandoned cart customers instead of requiring explicit selection.

2. **Backend Logic Issues**: Multiple functions (`playCampaign`, `updateCampaign`) were not properly filtering by selected customer emails.

## Root Cause

### Frontend Issue (CampaignCreator.js)
```javascript
// OLD CODE (Problematic)
campaignData.targetAudience.customerEmails = selectedCustomers.length > 0
  ? selectedCustomers
  : abandonedCarts.map(c => c.customer_email);
```

This logic meant:
- If customers selected → use selected customers ✅
- If no customers selected → use ALL abandoned cart customers ❌

### Backend Issues (campaignController.js)
1. `playCampaign` function was not using `filterCartsByCustomerEmails`
2. `updateCampaign` function was not using `filterCartsByCustomerEmails`
3. No validation to ensure at least one customer is selected

## Solution

### 1. Frontend Fixes

**File**: `frontend/src/components/campaigns/CampaignCreator.js`

**Changes**:
- Modified campaign creation logic to only send to explicitly selected customers
- Added validation to require at least one customer selection
- Updated UI text to make it clear that customers must be selected

```javascript
// NEW CODE (Fixed)
// Only send to explicitly selected customers
campaignData.targetAudience.customerEmails = selectedCustomers;

// Added validation
if (campaign.targetAudience.type === 'abandoned_carts' && selectedCustomers.length === 0) {
  setError('Please select at least one customer to send the campaign to.');
  setLoading(false);
  return;
}
```

### 2. Backend Fixes

**File**: `backend/controllers/campaignController.js`

**Changes**:
- Fixed `playCampaign` function to use `filterCartsByCustomerEmails`
- Fixed `updateCampaign` function to use `filterCartsByCustomerEmails`
- Added validation in both `createCampaign` and `updateCampaign` functions
- Enhanced `filterCartsByCustomerEmails` function with debug logging

```javascript
// Fixed playCampaign and updateCampaign
const filteredCarts = filterCartsByCustomerEmails(carts, campaign.targetAudience.customerEmails);
recipientEmails = filteredCarts.map(c => c.customer_email).filter(Boolean);
recipientCarts = filteredCarts;

// Added validation
if (campaignData.targetAudience && campaignData.targetAudience.type === 'abandoned_carts') {
  const customerEmails = campaignData.targetAudience.customerEmails || [];
  if (!Array.isArray(customerEmails) || customerEmails.length === 0) {
    return res.status(400).json({ 
      error: 'At least one customer must be selected for abandoned cart campaigns' 
    });
  }
}
```

### 3. Enhanced Debugging

Added comprehensive logging to the `filterCartsByCustomerEmails` function to help with troubleshooting:

```javascript
function filterCartsByCustomerEmails(carts, customerEmails) {
  logCampaignDebug(`[filterCartsByCustomerEmails] Input: ${carts.length} carts, ${customerEmails?.length || 0} selected emails`);
  
  if (!Array.isArray(customerEmails) || customerEmails.length === 0) {
    logCampaignDebug('[filterCartsByCustomerEmails] No customer emails provided, returning all carts');
    return carts;
  }
  
  const customerEmailsLower = customerEmails.map(email => email.trim().toLowerCase());
  const filteredCarts = carts.filter(
    cart =>
      cart.customer_email &&
      customerEmailsLower.includes(cart.customer_email.trim().toLowerCase())
  );
  
  logCampaignDebug(`[filterCartsByCustomerEmails] Output: ${filteredCarts.length} filtered carts`);
  return filteredCarts;
}
```

## Testing

Created `backend/test-campaign-targeting.js` to verify the fix works correctly. The test covers:

1. No customer emails selected
2. Specific customer emails selected
3. Non-existent customer email
4. Case insensitive matching
5. Campaign creation validation

## Files Modified

1. `frontend/src/components/campaigns/CampaignCreator.js`
   - Fixed campaign creation logic
   - Added validation
   - Updated UI text

2. `backend/controllers/campaignController.js`
   - Fixed `playCampaign` function
   - Fixed `updateCampaign` function
   - Added validation in `createCampaign` and `updateCampaign`
   - Enhanced `filterCartsByCustomerEmails` function

3. `backend/test-campaign-targeting.js` (new)
   - Comprehensive test suite for campaign targeting

## Result

Now the campaign system will:
- ✅ Only send emails to explicitly selected customers
- ✅ Require at least one customer to be selected before creating campaigns
- ✅ Properly filter customers in all campaign operations (create, update, play, send now)
- ✅ Provide clear error messages when no customers are selected
- ✅ Include comprehensive logging for debugging

## Usage

1. **Creating Campaigns**: Users must now explicitly select customers from the abandoned cart list
2. **Validation**: The system will prevent campaign creation if no customers are selected
3. **Debugging**: Check the campaign debug logs for detailed information about customer filtering 