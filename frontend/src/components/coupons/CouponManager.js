import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { PlusIcon, TrashIcon, ClockIcon, UserGroupIcon, TagIcon, CheckIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';

const CouponManager = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSendReminderModal, setShowSendReminderModal] = useState(false);
  const [reminderCartId, setReminderCartId] = useState("");
  const [reminderCartUrl, setReminderCartUrl] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [abandonedCustomers, setAbandonedCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  // New coupon form state
  const [newCoupon, setNewCoupon] = useState({ code: '', type: 'percentage', amount: '', minSpend: '', maxDiscount: '', startDate: '', endDate: '', usageLimit: '', isActive: true });

  // Validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Helper to get platform and storeId from localStorage (use real store_url from MongoDB/Atlas)
  const getStoreParams = () => {
    // Try to get store_url from store_connection, fallback to storeUrl
    let storeId = '';
    let platform = localStorage.getItem('platform') || 'woocommerce';
    const storeConnection = localStorage.getItem('store_connection');
    if (storeConnection) {
      try {
        const conn = JSON.parse(storeConnection);
        if (conn.store_url) { storeId = conn.store_url; }
        if (conn.platform) { platform = conn.platform; }
      } catch (e) { console.error("Error parsing store connection:", e); }
    }
    // Fallback to storeUrl if store_connection is missing
    if (!storeId) {
      storeId = localStorage.getItem('storeUrl') || '';
    }
    return { platform, storeId };
  };

  // Fetch coupons on component mount
  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const { platform, storeId } = getStoreParams();
      if (!storeId) {
        setError("No store connected. Please connect your store to manage coupons.");
        setCoupons([]);
        return;
      }
      const response = await api.get('/api/coupons', { params: { platform, storeId } });
      setCoupons(response.data.coupons);
    } catch (err) {
      console.error("Error fetching coupons (using fallback):", err);
      setError(err.response?.data?.error || "Failed to fetch coupons (using fallback)");
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  // Generate a random coupon code
  const generateCouponCode = () => {
    const prefix = 'CART';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${random}`;
  };

  // Validate coupon form
  const validateCoupon = (coupon) => {
    const errors = {};
    
    if (!coupon.code) {
      errors.code = 'Coupon code is required';
    } else if (!/^[A-Z0-9-]+$/.test(coupon.code)) {
      errors.code = 'Coupon code can only contain uppercase letters, numbers, and hyphens';
    }

    if (!coupon.amount) {
      errors.amount = 'Amount is required';
    } else if (coupon.type === 'percentage' && (coupon.amount < 1 || coupon.amount > 100)) {
      errors.amount = 'Percentage must be between 1 and 100';
    } else if (coupon.type === 'fixed' && coupon.amount <= 0) {
      errors.amount = 'Fixed amount must be greater than 0';
    }

    if (coupon.minSpend && coupon.minSpend <= 0) {
      errors.minSpend = 'Minimum spend must be greater than 0';
    }

    if (coupon.maxDiscount && coupon.maxDiscount <= 0) {
      errors.maxDiscount = 'Maximum discount must be greater than 0';
    }

    if (!coupon.startDate) {
      errors.startDate = 'Start date is required';
    }

    if (!coupon.endDate) {
      errors.endDate = 'End date is required';
    } else if (new Date(coupon.endDate) <= new Date(coupon.startDate)) {
      errors.endDate = 'End date must be after start date';
    }

    if (coupon.usageLimit && coupon.usageLimit <= 0) {
      errors.usageLimit = 'Usage limit must be greater than 0';
    }

    return errors;
  };

  // Handle coupon creation
  const handleCreateCoupon = async () => {
    const { platform, storeId } = getStoreParams();
    if (!storeId) {
      setError("No store connected. Please connect your store to create coupons.");
      return;
    }
    const errors = validateCoupon(newCoupon);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    try {
      setLoading(true);
      // Convert numeric fields to numbers and prevent empty strings
      const payload = {
        ...newCoupon,
        amount: Number(newCoupon.amount),
        minSpend: newCoupon.minSpend ? Number(newCoupon.minSpend) : undefined,
        maxDiscount: newCoupon.maxDiscount ? Number(newCoupon.maxDiscount) : undefined,
        usageLimit: newCoupon.usageLimit ? Number(newCoupon.usageLimit) : undefined,
        platform,
        storeId,
      };
      await api.post('/api/coupons', payload);
      setShowCreateModal(false);
      setNewCoupon({ code: '', type: 'percentage', amount: '', minSpend: '', maxDiscount: '', startDate: '', endDate: '', usageLimit: '', isActive: true });
      fetchCoupons();
    } catch (err) {
      console.error("Error creating coupon:", err);
      setError(err.response?.data?.error || 'Failed to create coupon');
    } finally {
      setLoading(false);
    }
  };

  // Handle coupon update
  const handleUpdateCoupon = async () => {
    const errors = validateCoupon(selectedCoupon);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    if (!selectedCoupon._id) {
      setError('Invalid coupon ID');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const { platform, storeId } = getStoreParams();
      
      if (!storeId) {
        setError("No store connected. Please connect your store to update coupons.");
        return;
      }
      
      // Convert numeric fields to numbers and prevent empty strings
      const payload = {
        ...selectedCoupon,
        amount: Number(selectedCoupon.amount),
        minSpend: selectedCoupon.minSpend ? Number(selectedCoupon.minSpend) : undefined,
        maxDiscount: selectedCoupon.maxDiscount ? Number(selectedCoupon.maxDiscount) : undefined,
        usageLimit: selectedCoupon.usageLimit ? Number(selectedCoupon.usageLimit) : undefined,
        platform,
        storeId,
      };
      
      await api.put(`/api/coupons/${selectedCoupon._id}`, payload);
      setShowEditModal(false);
      setValidationErrors({});
      await fetchCoupons();
    } catch (err) {
      console.error("Error updating coupon:", err);
      setError(err.response?.data?.error || 'Failed to update coupon');
    } finally {
      setLoading(false);
    }
  };

  // Handle coupon deletion
  const handleDeleteCoupon = async () => {
    if (!selectedCoupon._id) {
      setError('Invalid coupon ID');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const { platform, storeId } = getStoreParams();
      
      if (!storeId) {
        setError("No store connected. Please connect your store to delete coupons.");
        return;
      }
      
      await api.delete(`/api/coupons/${selectedCoupon._id}`, {
        params: { platform, storeId }
      });
      setShowDeleteModal(false);
      await fetchCoupons();
    } catch (err) {
      console.error("Error deleting coupon:", err);
      setError(err.response?.data?.error || 'Failed to delete coupon');
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate remaining time
  const getRemainingTime = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  // Rename function to better reflect its purpose
  async function sendDiscountEmail(customerEmail, cartUrl, couponId) {
    const { platform, storeId } = getStoreParams();
    const payload = { 
      to: customerEmail, // This will be the customer email
      storeUrl: cartUrl || storeId, // Use provided cart URL or fallback to store URL
      platform,
      storeId,
      discountCode: selectedCoupon.code,
      discountAmount: selectedCoupon.amount,
      discountType: selectedCoupon.type
    };
    
    // Use the correct endpoint for sending discount emails
    const res = await api.post('/api/email/send-discount-offer', payload);
    return res.data;
  }

  // Fetch abandoned customers when modal opens
  useEffect(() => {
    if (showSendReminderModal) {
      const fetchAbandonedCustomers = async () => {
        try {
          setCustomersLoading(true);
          const { platform, storeId } = getStoreParams();
          const res = await api.get('/api/carts/abandoned', { params: { platform, limit: 100 } });
          setAbandonedCustomers(res.data.carts || []);
          setSelectedCustomers([]);
        } catch (error) {
          console.error('Error fetching abandoned customers:', error);
        } finally {
          setCustomersLoading(false);
        }
      };
      fetchAbandonedCustomers();
    }
  }, [showSendReminderModal]);

  // Helper functions for customer selection
  const handleCustomerSelection = (customerEmail) => {
    setSelectedCustomers(prev => {
      if (prev.includes(customerEmail)) {
        return prev.filter(email => email !== customerEmail);
      } else {
        return [...prev, customerEmail];
      }
    });
  };

  const handleSelectAllCustomers = () => {
    if (selectedCustomers.length === customersToDisplay.length && customersToDisplay.length > 0) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customersToDisplay.map(c => c.customer_email));
    }
  };

  // Filter customers based on search
  const filteredCustomers = abandonedCustomers.filter(customer => {
    const searchTerm = customerSearch.toLowerCase();
    const email = customer.customer_email?.toLowerCase() || '';
    const name = `${customer.customer_data?.first_name || ''} ${customer.customer_data?.last_name || ''}`.toLowerCase();
    return email.includes(searchTerm) || name.includes(searchTerm);
  });

  // Use filtered customers or all customers if no search term
  const customersToDisplay = customerSearch ? filteredCustomers : abandonedCustomers;





  const handleSendReminder = async () => {
    if (selectedCustomers.length === 0) {
      alert("Please select at least one customer.");
      return;
    }
    try {
      console.log('Sending discount emails to customers:', selectedCustomers);
      for (const customerEmail of selectedCustomers) {
        console.log('Sending discount email to:', customerEmail);
        await sendDiscountEmail(customerEmail, reminderCartUrl, selectedCoupon._id);
      }
      alert("Discount emails sent successfully!");
      setShowSendReminderModal(false);
      setSelectedCustomers([]);
      setReminderCartUrl("");
      setCustomerSearch("");
    } catch (err) {
      console.error('Error sending discount email:', err);
      alert(err.message || "Failed to send discount email.");
    }
  };

  if (loading && !coupons.length) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => setError(null)}
                    className="text-sm font-medium text-red-800 hover:text-red-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Coupon Management
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Create and manage time-limited coupons for your customers
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => { const now = new Date(); const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); setNewCoupon({ code: generateCouponCode(), type: 'percentage', amount: '', minSpend: '', maxDiscount: '', startDate: now.toISOString().slice(0, 16), endDate: end.toISOString().slice(0, 16), usageLimit: '', isActive: true }); setShowCreateModal(true); }}
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Quick Create
            </button>
          </div>
        </div>

        {/* Coupons List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {coupons.map((coupon) => (
              <li key={coupon._id || coupon.code}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <TagIcon className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-blue-600 truncate">
                            {coupon.code}
                          </p>
                          <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            coupon.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {coupon.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="mt-1">
                          <p className="text-sm text-gray-500">
                            {coupon.type === 'percentage' ? `${coupon.amount}% off` : `$${coupon.amount} off`}
                            {coupon.minSpend && ` (min spend: $${coupon.minSpend})`}
                            {coupon.maxDiscount && ` (max discount: $${coupon.maxDiscount})`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <ClockIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                        <p>{getRemainingTime(coupon.endDate)}</p>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <UserGroupIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                        <p>{coupon.usageCount || 0} / {coupon.usageLimit || '∞'}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedCoupon(coupon);
                            setShowEditModal(true);
                          }}
                          disabled={loading}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCoupon(coupon);
                            setShowDeleteModal(true);
                          }}
                          disabled={loading}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => { setSelectedCoupon(coupon); setShowSendReminderModal(true); }}
                          disabled={loading}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Send Discount Mail
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Create Coupon Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Create New Coupon
                  </h3>
                  <div className="space-y-4">
                    {/* Coupon Code */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Coupon Code</label>
                      <div className="mt-1 flex rounded-md shadow-sm">
                        <input
                          type="text"
                          value={newCoupon.code}
                          onChange={(e) => setNewCoupon(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                          className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Enter coupon code"
                        />
                        <button
                          onClick={() => setNewCoupon(prev => ({ ...prev, code: generateCouponCode() }))}
                          className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Generate
                        </button>
                      </div>
                      {validationErrors.code && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.code}</p>
                      )}
                    </div>

                    {/* Discount Type and Amount */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Discount Type</label>
                        <select
                          value={newCoupon.type}
                          onChange={(e) => setNewCoupon(prev => ({ ...prev, type: e.target.value }))}
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed Amount</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          {newCoupon.type === 'percentage' ? 'Percentage' : 'Amount'}
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <input
                            type="number"
                            value={newCoupon.amount}
                            onChange={(e) => setNewCoupon(prev => ({ ...prev, amount: e.target.value }))}
                            className="block w-full pr-12 border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            placeholder={newCoupon.type === 'percentage' ? 'Enter percentage' : 'Enter amount'}
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">
                              {newCoupon.type === 'percentage' ? '%' : '$'}
                            </span>
                          </div>
                        </div>
                        {validationErrors.amount && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.amount}</p>
                        )}
                      </div>
                    </div>

                    {/* Minimum Spend and Maximum Discount */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Minimum Spend</label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <input
                            type="number"
                            value={newCoupon.minSpend}
                            onChange={(e) => setNewCoupon(prev => ({ ...prev, minSpend: e.target.value }))}
                            className="block w-full pr-12 border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            placeholder="Enter minimum spend"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                        </div>
                        {validationErrors.minSpend && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.minSpend}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Maximum Discount</label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <input
                            type="number"
                            value={newCoupon.maxDiscount}
                            onChange={(e) => setNewCoupon(prev => ({ ...prev, maxDiscount: e.target.value }))}
                            className="block w-full pr-12 border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            placeholder="Enter maximum discount"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                        </div>
                        {validationErrors.maxDiscount && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.maxDiscount}</p>
                        )}
                      </div>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Start Date</label>
                        <input
                          type="datetime-local"
                          value={newCoupon.startDate}
                          onChange={(e) => setNewCoupon(prev => ({ ...prev, startDate: e.target.value }))}
                          className="mt-1 block w-full border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        />
                        {validationErrors.startDate && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.startDate}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">End Date</label>
                        <input
                          type="datetime-local"
                          value={newCoupon.endDate}
                          onChange={(e) => setNewCoupon(prev => ({ ...prev, endDate: e.target.value }))}
                          className="mt-1 block w-full border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        />
                        {validationErrors.endDate && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.endDate}</p>
                        )}
                      </div>
                    </div>

                    {/* Usage Limit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Usage Limit</label>
                      <input
                        type="number"
                        value={newCoupon.usageLimit}
                        onChange={(e) => setNewCoupon(prev => ({ ...prev, usageLimit: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        placeholder="Enter usage limit (leave empty for unlimited)"
                      />
                      {validationErrors.usageLimit && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.usageLimit}</p>
                      )}
                    </div>

                    {/* Active Status */}
                    <div>
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={newCoupon.isActive}
                          onChange={(e) => setNewCoupon(prev => ({ ...prev, isActive: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Active</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="button"
                    onClick={handleCreateCoupon}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
                  >
                    Create Coupon
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Coupon Modal */}
        {showEditModal && selectedCoupon && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Edit Coupon: {selectedCoupon.code}
                  </h3>
                  <div className="space-y-4">
                    {/* Coupon Code */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Coupon Code</label>
                      <div className="mt-1 flex rounded-md shadow-sm">
                        <input
                          type="text"
                          value={selectedCoupon.code}
                          onChange={(e) => setSelectedCoupon(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                          className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Enter coupon code"
                        />
                      </div>
                      {validationErrors.code && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.code}</p>
                      )}
                    </div>

                    {/* Discount Type and Amount */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Discount Type</label>
                        <select
                          value={selectedCoupon.type}
                          onChange={(e) => setSelectedCoupon(prev => ({ ...prev, type: e.target.value }))}
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed Amount</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          {selectedCoupon.type === 'percentage' ? 'Percentage' : 'Amount'}
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <input
                            type="number"
                            value={selectedCoupon.amount}
                            onChange={(e) => setSelectedCoupon(prev => ({ ...prev, amount: e.target.value }))}
                            className="block w-full pr-12 border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            placeholder={selectedCoupon.type === 'percentage' ? 'Enter percentage' : 'Enter amount'}
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">
                              {selectedCoupon.type === 'percentage' ? '%' : '$'}
                            </span>
                          </div>
                        </div>
                        {validationErrors.amount && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.amount}</p>
                        )}
                      </div>
                    </div>

                    {/* Minimum Spend and Maximum Discount */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Minimum Spend</label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <input
                            type="number"
                            value={selectedCoupon.minSpend || ''}
                            onChange={(e) => setSelectedCoupon(prev => ({ ...prev, minSpend: e.target.value }))}
                            className="block w-full pr-12 border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            placeholder="Enter minimum spend"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                        </div>
                        {validationErrors.minSpend && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.minSpend}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Maximum Discount</label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <input
                            type="number"
                            value={selectedCoupon.maxDiscount || ''}
                            onChange={(e) => setSelectedCoupon(prev => ({ ...prev, maxDiscount: e.target.value }))}
                            className="block w-full pr-12 border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            placeholder="Enter maximum discount"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                        </div>
                        {validationErrors.maxDiscount && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.maxDiscount}</p>
                        )}
                      </div>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Start Date</label>
                        <input
                          type="datetime-local"
                          value={selectedCoupon.startDate ? new Date(selectedCoupon.startDate).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setSelectedCoupon(prev => ({ ...prev, startDate: e.target.value }))}
                          className="mt-1 block w-full border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        />
                        {validationErrors.startDate && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.startDate}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">End Date</label>
                        <input
                          type="datetime-local"
                          value={selectedCoupon.endDate ? new Date(selectedCoupon.endDate).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setSelectedCoupon(prev => ({ ...prev, endDate: e.target.value }))}
                          className="mt-1 block w-full border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        />
                        {validationErrors.endDate && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.endDate}</p>
                        )}
                      </div>
                    </div>

                    {/* Usage Limit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Usage Limit</label>
                      <input
                        type="number"
                        value={selectedCoupon.usageLimit || ''}
                        onChange={(e) => setSelectedCoupon(prev => ({ ...prev, usageLimit: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        placeholder="Enter usage limit (leave empty for unlimited)"
                      />
                      {validationErrors.usageLimit && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.usageLimit}</p>
                      )}
                    </div>

                    {/* Active Status */}
                    <div>
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedCoupon.isActive}
                          onChange={(e) => setSelectedCoupon(prev => ({ ...prev, isActive: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Active</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="button"
                    onClick={handleUpdateCoupon}
                    disabled={loading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Updating...' : 'Update Coupon'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedCoupon && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <TrashIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete Coupon
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete this coupon? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleDeleteCoupon}
                    disabled={loading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Send Reminder Modal */}
        {showSendReminderModal && selectedCoupon && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Send Discount Email (Coupon: {selectedCoupon.code})</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Customers with Abandoned Carts</label>
                    
                    {/* Search Input */}
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="Search customers by email or name..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    {customersLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-600">Loading customers...</p>
                      </div>
                    ) : abandonedCustomers.length > 0 ? (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-blue-900">Customer Selection</h4>
                          <span className="text-sm text-blue-600">
                            {selectedCustomers.length} of {customersToDisplay.length} customers selected
                          </span>
                        </div>

                        <div className="space-y-3">
                          {/* Select All Button */}
                          <div className="flex items-center p-3 bg-white rounded-lg border">
                            <button
                              onClick={handleSelectAllCustomers}
                              className="flex items-center space-x-3 text-left w-full"
                            >
                              {selectedCustomers.length === customersToDisplay.length && customersToDisplay.length > 0 ? (
                                <CheckBadgeIcon className="h-5 w-5 text-blue-600" />
                              ) : (
                                <div className="h-5 w-5 border-2 border-gray-300 rounded"></div>
                              )}
                              <div>
                                <span className="font-medium text-gray-900">
                                  {selectedCustomers.length === customersToDisplay.length && customersToDisplay.length > 0 ? 'Deselect All' : 'Select All'}
                                </span>
                                <p className="text-sm text-gray-500">
                                  {selectedCustomers.length === customersToDisplay.length && customersToDisplay.length > 0 
                                    ? 'Uncheck all customers' 
                                    : `Select all ${customersToDisplay.length} customers`
                                  }
                                </p>
                              </div>
                            </button>
                          </div>

                          {/* Customer List */}
                          <div className="max-h-60 overflow-y-auto space-y-2">
                            {customersToDisplay.map((customer) => (
                              <div key={customer.customer_email} className="flex items-center p-3 bg-white rounded-lg border">
                                <button
                                  onClick={() => handleCustomerSelection(customer.customer_email)}
                                  className="flex items-center space-x-3 text-left w-full"
                                >
                                  {selectedCustomers.includes(customer.customer_email) ? (
                                    <CheckIcon className="h-5 w-5 text-blue-600" />
                                  ) : (
                                    <div className="h-5 w-5 border-2 border-gray-300 rounded"></div>
                                  )}
                                  <div>
                                    <span className="font-medium text-gray-900">
                                      {customer.customer_data?.first_name && customer.customer_data?.last_name 
                                        ? `${customer.customer_data.first_name} ${customer.customer_data.last_name}`
                                        : customer.customer_email
                                      }
                                    </span>
                                    <p className="text-sm text-gray-500">{customer.customer_email}</p>
                                  </div>
                                </button>
                              </div>
                            ))}
                          </div>

                          {customersToDisplay.length === 0 && customerSearch && (
                            <div className="text-center py-4 text-gray-500">
                              No customers found matching "{customerSearch}"
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No abandoned carts found.
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cart URL (optional)</label>
                    <input
                      type="text"
                      value={reminderCartUrl}
                      onChange={(e) => setReminderCartUrl(e.target.value)}
                      className="mt-1 block w-full border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      placeholder="Enter cart URL (e.g. https://yourstore.com/cart)"
                    />
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="button"
                    onClick={handleSendReminder}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm"
                  >
                    Send Discount Email
                  </button>
                  <button
                    type="button"
                    onClick={() => { 
                      setShowSendReminderModal(false); 
                      setSelectedCustomers([]); 
                      setReminderCartUrl(""); 
                      setCustomerSearch(""); 
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CouponManager; 