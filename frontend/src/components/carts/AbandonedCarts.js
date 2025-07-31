import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import debounce from 'lodash/debounce';
import config from '../../config';
import { ChatBubbleLeftRightIcon, ClockIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';
import { 
  ShoppingCart, 
  Mail, 
  MessageSquare, 
  MoreHorizontal, 
  Search,
  X,
  RefreshCw,
  Clock,
  Phone
} from 'lucide-react';

const AbandonedCarts = () => {
  // Live data state
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [subscription, setSubscription] = useState({ plan: null, status: null });

  // UI state
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCart, setSelectedCart] = useState(null);
  const [bulkAction, setBulkAction] = useState('');
  const [selectedCarts, setSelectedCarts] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  // Email scheduling state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleCart, setScheduleCart] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);


  // Bulk WhatsApp state
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  // Platform and store info
  const platform = localStorage.getItem('platform') || 'woocommerce';
  const storeUrl = localStorage.getItem('storeUrl') || '';
  
  // Refs for request handling
  const abortControllerRef = useRef(null);
  const requestCacheRef = useRef(new Map());
  const lastRequestTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  // Cache invalidation time (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;

  // Email scheduling options
  const [sendOption, setSendOption] = useState('now');
  const [schedulePreset, setSchedulePreset] = useState('1h');
  const [customDateTime, setCustomDateTime] = useState('');


  // Fetch carts from backend
  const fetchCarts = useCallback(async (page = 1) => {
    if (!isMountedRef.current) return;
    
    const cacheKey = `${platform}-${page}-${pagination.limit}-${filterStatus}-${searchTerm}`;
    const now = Date.now();
    const cachedData = requestCacheRef.current.get(cacheKey);
    
    if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      console.log('Using cached data:', cachedData);
      setCarts(cachedData.carts);
      setPagination(cachedData.pagination);
      return;
    }
    
    if (now - lastRequestTimeRef.current < 1000) {
      return;
    }
    lastRequestTimeRef.current = now;
    
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      setLoading(true);
      setError(null);
      
      console.log('Fetching carts with params:', { 
        platform, 
        page, 
        limit: pagination.limit,
        status: filterStatus !== 'All' ? filterStatus.toLowerCase() : undefined,
        search: searchTerm || undefined
      });
      
      const response = await api.get('/api/carts/abandoned', {
        params: { 
          platform, 
          page, 
          limit: pagination.limit,
          status: filterStatus !== 'All' ? filterStatus.toLowerCase() : undefined,
          search: searchTerm || undefined
        },
        signal: abortControllerRef.current.signal
      });
      
      console.log('Backend response:', response.data);
      
      if (!isMountedRef.current) return;
      
      // Cache the response
      requestCacheRef.current.set(cacheKey, {
        carts: response.data.carts,
        pagination: response.data.pagination,
        timestamp: now
      });
      
      setCarts(response.data.carts);
      setPagination(response.data.pagination);
    } catch (err) {
      if (!isMountedRef.current) return;
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        return;
      }
      console.error('Error fetching carts:', err);
      setError(err.response?.data?.error || 'Failed to fetch abandoned carts. Please try again.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [platform, pagination.limit, CACHE_DURATION, filterStatus, searchTerm]);

  // Create debounced refresh function
  const debouncedRefresh = useCallback(
    debounce((page) => {
      if (isMountedRef.current) {
        fetchCarts(page);
      }
    }, 1000),
    [fetchCarts]
  );

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    // Clear cache for current platform
    for (const key of requestCacheRef.current.keys()) {
      if (key.startsWith(platform)) {
        requestCacheRef.current.delete(key);
      }
    }
    debouncedRefresh(1);
  }, [platform, debouncedRefresh]);

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
      fetchCarts(newPage);
    }
  }, [fetchCarts, pagination.pages]);

  // Initialize component
  useEffect(() => {
    isMountedRef.current = true;

    if (platform) {
      debouncedRefresh(1);
    } else {
      setError('No platform selected. Please connect a store first.');
      setLoading(false);
    }

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      debouncedRefresh.cancel();
    };
  }, [debouncedRefresh, platform]);

  // Fetch subscription status
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await api.get('/api/subscribe/status');
        setSubscription(response.data);
      } catch (err) {
        console.error('Error fetching subscription:', err);
      }
    };
    
    fetchSubscription();
  }, []);

  // Handle search and filter changes
  useEffect(() => {
    if (platform) {
      // Reset to page 1 when filters change
      setPagination(prev => ({ ...prev, page: 1 }));
      debouncedRefresh(1);
    }
  }, [filterStatus, searchTerm, debouncedRefresh, platform]);

  // Helper functions for cart data
  const calculateCartValue = (cart) => {
    if (!cart || !Array.isArray(cart)) return '0.00';
    return cart.reduce((sum, item) => {
      let priceStr = item.price || item.unit_price || item.total || '0';
      if (typeof priceStr === 'string') priceStr = priceStr.replace(/\$/g, '').replace(/[^\d.]/g, '');
      const price = parseFloat(priceStr) || 0;
      const qty = parseInt(item.quantity || item.qty || 1);
      return sum + (price * qty);
    }, 0).toFixed(2);
  };

  const getCartItems = (cart) => {
    if (!cart || !Array.isArray(cart)) return [];
    // If cart is an object with items array, return that
    if (cart.items && Array.isArray(cart.items)) return cart.items;
    // Otherwise return the cart array itself
    return cart;
  };

  // Format cart data for display
  const formatCartForDisplay = (cart) => {
    const items = getCartItems(cart.cart || cart.items);
    const value = calculateCartValue(items);
    const abandoned = cart.timestamp ? new Date(cart.timestamp * 1000).toLocaleString() : 'Unknown';
    
    const formattedCart = {
      id: cart.cart_id || cart.id,
      customer: cart.customer_name || 'Guest',
      email: cart.customer_email || 'No email',
      phone: cart.customer_data?.phone || 'No phone',
      items: items.length,
      value: parseFloat(value),
      abandoned: abandoned,
      status: cart.status || 'No Action',
      products: items.map(item => ({
        id: item.product_id || item.id,
        name: item.product_name || item.name,
        price: parseFloat(item.price || 0),
        quantity: parseInt(item.quantity || 1),
        image: item.image_url || item.image || item.product_image || item.featured_image || null
      })),
      // Keep original cart data for API calls
      originalCart: cart
    };
    
    return formattedCart;
  };

  // Format all carts for display
  const displayCarts = carts.map(formatCartForDisplay);
  console.log('Raw carts from backend:', carts);
  console.log('Total carts from backend:', carts.length);
  console.log('Display carts after formatting:', displayCarts.length);

  // Filter and sort carts (only on current page data)
  const filteredCarts = displayCarts
    .filter(cart => {
      // Filter by status
      if (filterStatus !== 'All' && cart.status !== filterStatus) {
        console.log('Filtered out by status:', cart.customer, cart.status, '!==', filterStatus);
        return false;
      }
      
      // Filter by search term
      if (searchTerm && !cart.customer.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !cart.email.toLowerCase().includes(searchTerm.toLowerCase())) {
        console.log('Filtered out by search:', cart.customer, 'search term:', searchTerm);
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by the configured key and direction
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

  console.log('Filtered carts:', filteredCarts.length);
  console.log('Current filter status:', filterStatus);
  console.log('Current search term:', searchTerm);

  // Use filtered carts directly (no additional pagination slicing)
  const currentItems = filteredCarts;
  console.log('Final currentItems:', currentItems.length);

  // UI handlers
  const handleViewCart = (cart) => {
    setSelectedCart(cart);
  };

  const handleCloseDetails = () => {
    setSelectedCart(null);
  };

  const handleCommunication = (type, cart) => {
    // Directly send communication without showing modal
    handleSendCommunicationDirect(type, cart);
  };

  const handleSendCommunicationDirect = async (type, cart) => {
    try {
      const originalCart = cart.originalCart;
      
      if (type === 'email') {
        await api.post('/api/email/send-email', {
          to: originalCart.customer_email,
          subject: 'Complete Your Purchase',
          cart_id: originalCart.cart_id || originalCart.id,
          storeUrl
        });
        alert('Email sent successfully!');
      } else if (type === 'sms') {
        await api.post('/api/sms/send-reminder', {
          cartId: originalCart.cart_id || originalCart.id
        });
        alert('SMS sent successfully!');
      } else if (type === 'whatsapp') {
        await api.post('/api/whatsapp/send-reminder', {
          cartId: originalCart.cart_id || originalCart.id,
          storeUrl
        });
        alert('WhatsApp message sent successfully!');
      }
      
      // Refresh the cart list to show updated status
      handleRefresh();
    } catch (err) {
      console.error('Error sending communication:', err);
      alert(`Failed to send ${type}: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleBulkActionChange = (e) => {
    setBulkAction(e.target.value);
  };

  const handleApplyBulkAction = async () => {
    if (!bulkAction || selectedCarts.length === 0) return;
    
    try {
      if (bulkAction === 'delete') {
        // Handle delete action
        const updatedCarts = carts.filter(cart => !selectedCarts.includes(cart.cart_id || cart.id));
        setCarts(updatedCarts);
      } else if (bulkAction === 'whatsapp') {
        // Show bulk WhatsApp modal
        setShowBulkWhatsAppModal(true);
      } else {
        // Handle communication actions
        const selectedCartData = carts.filter(cart => selectedCarts.includes(cart.cart_id || cart.id));
        
        for (const cart of selectedCartData) {
          if (bulkAction === 'email') {
            await api.post('/api/email/send-email', {
              to: cart.customer_email,
              subject: 'Complete Your Purchase',
              cart_id: cart.cart_id || cart.id,
        storeUrl
            });
          } else if (bulkAction === 'sms') {
              await api.post('/api/sms/send-reminder', {
              cartId: cart.cart_id || cart.id
              });
          }
        }
        
        alert(`Bulk ${bulkAction} sending completed!`);
        // Refresh the cart list
      handleRefresh();
      }
      
      setSelectedCarts([]);
      setBulkAction('');
    } catch (err) {
      console.error('Error applying bulk action:', err);
      alert(`Failed to apply bulk action: ${err.response?.data?.error || err.message}`);
    }
  };

  // Bulk WhatsApp handler
  const handleBulkWhatsApp = async () => {
    if (selectedCarts.length === 0) {
      alert('Please select at least one cart to send WhatsApp reminders.');
      return;
    }

    try {
      setWhatsappLoading(true);
      const cartIds = selectedCarts.map(cartId => {
        const cart = carts.find(c => (c.cart_id || c.id) === cartId);
        return cart?.cart_id || cart?.id;
      }).filter(Boolean);
      
      const response = await api.post('/api/whatsapp/send-bulk', {
        cartIds,
        storeUrl
      });

      const { results } = response.data;
      const successCount = results.successful.length;
      const failCount = results.failed.length;

      alert(`WhatsApp sending completed!\nSuccessful: ${successCount}\nFailed: ${failCount}`);

      setSelectedCarts([]);
      setShowBulkWhatsAppModal(false);
      handleRefresh();
    } catch (err) {
      alert(`Failed to send bulk WhatsApp: ${err.response?.data?.error || err.message}`);
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleSelectCart = (cartId) => {
    setSelectedCarts(prev => 
      prev.includes(cartId) 
        ? prev.filter(id => id !== cartId) 
        : [...prev, cartId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCarts.length === filteredCarts.length) {
      setSelectedCarts([]);
      } else {
      setSelectedCarts(filteredCarts.map(cart => cart.id));
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Recovered': return 'bg-green-100 text-green-800';
      case 'No Response': return 'bg-red-100 text-red-800';
      case 'Email Sent': return 'bg-blue-100 text-blue-800';
      case 'SMS Sent': return 'bg-purple-100 text-purple-800';
      case 'WhatsApp Sent': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper functions for SMS and WhatsApp status
  const hasPhone = (cart) => {
    const phone = cart.customer_data?.phone || cart.phone;
    return typeof phone === 'string' && phone.trim() !== '';
  };

  const hasWhatsApp = (cart) => {
    const whatsapp = cart.customer_data?.whatsapp || cart.customer_data?.phone || cart.phone;
    return typeof whatsapp === 'string' && whatsapp.trim() !== '';
  };

  const getRemainingTime = (smsSentAt) => {
    if (!smsSentAt) return null;
    const now = new Date();
    const sentTime = new Date(smsSentAt);
    const hoursSinceLastSms = (now - sentTime) / (1000 * 60 * 60);
    const cooldownPeriod = 24; // hours
    const remainingHours = Math.max(0, cooldownPeriod - hoursSinceLastSms);
    
    if (remainingHours <= 0) return null;
    
    const hours = Math.floor(remainingHours);
    const minutes = Math.floor((remainingHours - hours) * 60);
    return `${hours}h ${minutes}m`;
  };

  const getWhatsAppRemainingTime = (whatsappSentAt) => {
    if (!whatsappSentAt) return null;
    const now = new Date();
    const sentTime = new Date(whatsappSentAt);
    const hoursSinceLastMessage = (now - sentTime) / (1000 * 60 * 60);
    const cooldownPeriod = 24; // hours
    const remainingHours = Math.max(0, cooldownPeriod - hoursSinceLastMessage);
    
    if (remainingHours <= 0) return null;
    
    const hours = Math.floor(remainingHours);
    const minutes = Math.floor((remainingHours - hours) * 60);
    return `${hours}h ${minutes}m`;
  };

  // SMS status checking
  const handleCheckSmsStatus = async (cart) => {
    try {
      const response = await api.get(`/api/sms/status/${cart.cart_id || cart.id}`);
      
      const status = response.data;
      alert(`SMS Status for ${cart.customer_name || 'Customer'}:\nStatus: ${status.status}\nAttempts: ${status.attempts}\nLast Sent: ${status.lastSent ? new Date(status.lastSent).toLocaleString() : 'Never'}\nDelivered: ${status.delivered ? new Date(status.delivered).toLocaleString() : 'Not delivered'}\nError: ${status.error || 'None'}`);
    } catch (err) {
      console.error('Error checking SMS status:', err);
      alert(`Failed to check SMS status: ${err.response?.data?.error || err.message}`);
    }
  };

  // Email scheduling handlers
  const openScheduleModal = (cart) => {
    setScheduleCart(cart);
    setSendOption('now'); // Reset send option to 'now' when opening modal
    setSchedulePreset('1h'); // Reset schedule preset to '1h'
    setCustomDateTime(''); // Clear custom date/time

    setShowScheduleModal(true);
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setScheduleCart(null);
  };

  const handleSendEmailOption = async () => {
    if (!scheduleCart) return;
    setScheduleLoading(true);
    try {
      if (sendOption === 'now') {
        await api.post('/api/email/send-email', {
          to: scheduleCart.customer_email,
          subject: 'Complete Your Purchase',
          cart_id: scheduleCart.cart_id || scheduleCart.id,
          storeUrl
        });
        alert('Email sent successfully!');
      } else {
        // Calculate delayHours from preset or custom
        let delayHours = 1;
        if (schedulePreset === 'custom') {
          if (!customDateTime) {
            alert('Please select a valid date and time.');
            setScheduleLoading(false);
            return;
          }
          const now = new Date();
          const customDate = new Date(customDateTime);
          delayHours = Math.max(1, Math.round((customDate - now) / (1000 * 60 * 60)));
        } else {
          switch (schedulePreset) {
            case '1h': delayHours = 1; break;
            case '2h': delayHours = 2; break;
            case '6h': delayHours = 6; break;
            case '12h': delayHours = 12; break;
            case '24h': delayHours = 24; break;
            case '3d': delayHours = 72; break;
            case '7d': delayHours = 168; break;
            default: delayHours = 1;
          }
        }
        await api.post('/api/email/schedule-reminder', {
          cartId: scheduleCart.cart_id || scheduleCart.id,
          platform: platform,
          storeUrl: storeUrl,
          delayHours,
          reminderType: 'first'
        });
        alert('Email scheduled successfully!');
      }
      closeScheduleModal();
      handleRefresh();
    } catch (err) {
      alert(`Failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setScheduleLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-white p-4 shadow-sm mb-4 rounded-lg">
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="ml-4 text-gray-500">Loading abandoned carts...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-white p-4 shadow-sm mb-4 rounded-lg">
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
          <div className="text-red-600 mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Carts</h3>
          <p className="text-gray-500">{error}</p>
              <button 
                onClick={handleRefresh}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Controls */}
      <div className="bg-white p-4 shadow-sm mb-4 rounded-lg">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Abandoned Carts</h2>
            {pagination.total > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {pagination.total} total abandoned cart{pagination.total !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={handleRefresh}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium flex items-center"
            >
              <RefreshCw size={16} className="mr-1" /> Refresh
            </button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
              <input
                type="text"
              placeholder="Search by customer name or email..."
              className="w-full pl-16 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            {searchTerm && (
              <button 
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchTerm('')}
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="flex gap-2">
              <select
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="No Action">No Action</option>
              <option value="Email Sent">Email Sent</option>
              <option value="SMS Sent">SMS Sent</option>
              <option value="WhatsApp Sent">WhatsApp Sent</option>
              <option value="No Response">No Response</option>
              <option value="Recovered">Recovered</option>
              </select>
          </div>
        </div>

        {selectedCarts.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
            <span className="text-sm">{selectedCarts.length} carts selected</span>
              <select
              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={bulkAction}
              onChange={handleBulkActionChange}
            >
              <option value="">Bulk Action...</option>
              <option value="email">Send Email</option>
              <option value="sms">Send SMS</option>
              <option value="whatsapp">Send WhatsApp</option>
              <option value="delete">Delete</option>
              </select>
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
              onClick={handleApplyBulkAction}
              disabled={!bulkAction}
            >
              Apply
            </button>
            <button 
              className="text-gray-600 hover:text-gray-800"
              onClick={() => setSelectedCarts([])}
            >
              <X size={16} />
            </button>
      </div>
        )}
        </div>

      {/* Cart Table */}
      <div className="bg-white rounded-lg shadow flex-1">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-4 font-medium text-gray-500 w-12">
                    <input
                      type="checkbox"
                    checked={selectedCarts.length > 0 && selectedCarts.length === currentItems.length}
                    onChange={handleSelectAll}
                    className="rounded w-4 h-4" 
                    />
                  </th>
                  <th 
                  className="text-left p-4 font-medium text-gray-500 cursor-pointer"
                  onClick={() => handleSort('customer')}
                  >
                  Customer {sortConfig.key === 'customer' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                <th className="text-left p-4 font-medium text-gray-500">Contact</th>
                  <th 
                  className="text-left p-4 font-medium text-gray-500 cursor-pointer"
                  onClick={() => handleSort('items')}
                  >
                  Items {sortConfig.key === 'items' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                <th 
                  className="text-left p-4 font-medium text-gray-500 cursor-pointer"
                  onClick={() => handleSort('value')}
                >
                  Value {sortConfig.key === 'value' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="text-left p-4 font-medium text-gray-500 cursor-pointer"
                  onClick={() => handleSort('abandoned')}
                >
                  Abandoned {sortConfig.key === 'abandoned' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="text-left p-4 font-medium text-gray-500 cursor-pointer"
                  onClick={() => handleSort('status')}
                >
                  Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-left p-4 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                <>
                  {console.log(`About to render ${currentItems.length} cart rows`)}
                  {currentItems.map((cart, index) => {
                    console.log(`Rendering cart ${index}:`, cart);
                    return (
                      <tr key={cart.id} className="border-t hover:bg-gray-50">
                        <td className="p-4 w-12">
                          <input 
                            type="checkbox" 
                            checked={selectedCarts.includes(cart.id)}
                            onChange={() => handleSelectCart(cart.id)}
                            className="rounded w-4 h-4" 
                          />
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{cart.customer}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-gray-600">
                            <p>{cart.email}</p>
                            <p>{cart.phone}</p>
                          </div>
                        </td>
                        <td className="p-4">{cart.items}</td>
                        <td className="p-4">${cart.value.toFixed(2)}</td>
                        <td className="p-4 flex items-center">
                          <Clock size={14} className="text-gray-400 mr-1" /> {cart.abandoned}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(cart.status)}`}>
                            {cart.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <button 
                              className="p-1 hover:bg-gray-100 rounded"
                              onClick={() => openScheduleModal(cart.originalCart)}
                              title="Send or Schedule Email"
                            >
                              <Mail size={16} className="text-blue-600" />
                            </button>
                            
                            {/* SMS Button with status */}
                            {hasPhone(cart.originalCart) && (
                              <div className="flex flex-col items-center">
                                {subscription.plan === 'free' ? (
                                  <button 
                                    className="p-1 rounded transition hover:bg-gray-100"
                                    onClick={() => {
                                      alert('SMS feature requires Starter or Growth plan. Please upgrade to send SMS messages.');
                                      window.location.href = '/pricing';
                                    }}
                                    title="Upgrade to Starter or Growth plan to send SMS"
                                  >
                                    <MessageSquare size={16} className="text-gray-400" />
                                  </button>
                                ) : (
                                  <button 
                                    className={`p-1 rounded transition ${
                                      cart.originalCart.sms_status === 'sending'
                                        ? 'bg-gray-100 cursor-not-allowed'
                                        : cart.originalCart.sms_sent_at && getRemainingTime(cart.originalCart.sms_sent_at)
                                          ? 'bg-yellow-100 border border-yellow-300'
                                          : 'hover:bg-gray-100'
                                    }`}
                                    onClick={() => handleCommunication('sms', cart)}
                                    disabled={cart.originalCart.sms_status === 'sending' || 
                                            (cart.originalCart.sms_sent_at && getRemainingTime(cart.originalCart.sms_sent_at))}
                                    title={
                                      cart.originalCart.sms_status === 'sending'
                                        ? 'Sending...'
                                        : cart.originalCart.sms_sent_at && getRemainingTime(cart.originalCart.sms_sent_at)
                                          ? `Wait ${getRemainingTime(cart.originalCart.sms_sent_at)} before sending again`
                                          : 'Send SMS'
                                    }
                                  >
                                    <MessageSquare size={16} className="text-purple-600" />
                                  </button>
                                )}
                                {cart.originalCart.sms_sent_at && getRemainingTime(cart.originalCart.sms_sent_at) && (
                                  <span className="text-xs text-gray-400 mt-1">
                                    {getRemainingTime(cart.originalCart.sms_sent_at)}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* WhatsApp Button with status */}
                            {hasWhatsApp(cart.originalCart) && (
                              <div className="flex flex-col items-center">
                                {subscription.plan === 'free' ? (
                                  <button 
                                    className="p-1 rounded transition hover:bg-gray-100"
                                    onClick={() => {
                                      alert('WhatsApp feature requires Starter plan or higher. Please upgrade to send WhatsApp messages.');
                                      window.location.href = '/pricing';
                                    }}
                                    title="Upgrade to Starter plan or higher to send WhatsApp"
                                  >
                                    <Phone size={16} className="text-gray-400" />
                                  </button>
                                ) : (
                                  <button 
                                    className={`p-1 rounded transition ${
                                      cart.originalCart.whatsapp_status === 'sending'
                                        ? 'bg-gray-100 cursor-not-allowed'
                                        : cart.originalCart.whatsapp_sent_at && getWhatsAppRemainingTime(cart.originalCart.whatsapp_sent_at)
                                          ? 'bg-yellow-100 border border-yellow-300'
                                          : 'hover:bg-gray-100'
                                    }`}
                                    onClick={() => handleCommunication('whatsapp', cart)}
                                    disabled={cart.originalCart.whatsapp_status === 'sending' || 
                                            (cart.originalCart.whatsapp_sent_at && getWhatsAppRemainingTime(cart.originalCart.whatsapp_sent_at))}
                                    title={
                                      cart.originalCart.whatsapp_status === 'sending'
                                        ? 'Sending...'
                                        : cart.originalCart.whatsapp_sent_at && getWhatsAppRemainingTime(cart.originalCart.whatsapp_sent_at)
                                          ? `Wait ${getWhatsAppRemainingTime(cart.originalCart.whatsapp_sent_at)} before sending again`
                                          : 'Send WhatsApp'
                                    }
                                  >
                                    <Phone size={16} className="text-green-600" />
                                  </button>
                                )}
                                {cart.originalCart.whatsapp_sent_at && getWhatsAppRemainingTime(cart.originalCart.whatsapp_sent_at) && (
                                  <span className="text-xs text-gray-400 mt-1">
                                    {getWhatsAppRemainingTime(cart.originalCart.whatsapp_sent_at)}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* SMS Status Check Button */}
                            {hasPhone(cart.originalCart) && (
                              <button 
                                className="p-1 hover:bg-gray-100 rounded"
                                onClick={() => handleCheckSmsStatus(cart.originalCart)}
                                title="Check SMS Status"
                              >
                                <Clock size={16} className="text-gray-600" />
                              </button>
                            )}
                            
                            <button 
                              className="p-1 hover:bg-gray-100 rounded"
                              onClick={() => handleViewCart(cart)}
                              title="View Details"
                            >
                              <MoreHorizontal size={16} className="text-gray-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </>
              ) : (
                <tr>
                  <td colSpan="8" className="p-4 text-center text-gray-500">
                    {searchTerm || filterStatus !== 'All' 
                      ? 'No abandoned carts match your current filters. Try adjusting your search or filter criteria.'
                      : pagination.total === 0 
                        ? 'No abandoned carts found. Your store might not have any abandoned carts yet.'
                        : 'No abandoned carts to display on this page.'
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          
        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-between items-center p-4 border-t">
            <div className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.pages}
              </span>
              <div className="flex gap-2">
                <button 
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                  disabled={pagination.page === 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  Previous
                </button>
                <button 
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                  disabled={pagination.page === pagination.pages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cart Details Slide-over */}
      {selectedCart && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex justify-end z-50">
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Cart Details</h3>
                      <button
                onClick={handleCloseDetails}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
                      </button>
            </div>
            <div className="p-4">
              <div className="mb-6">
                <h4 className="text-lg font-medium mb-2">Customer Information</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-medium text-lg">{selectedCart.customer}</p>
                  <p className="text-gray-600">{selectedCart.email}</p>
                  <p className="text-gray-600">{selectedCart.phone}</p>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="text-lg font-medium mb-2">Cart Summary</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Items:</span>
                    <span>{selectedCart.items}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Total Value:</span>
                    <span className="font-medium">${selectedCart.value.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Abandoned:</span>
                    <span>{selectedCart.abandoned}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(selectedCart.status)}`}>
                      {selectedCart.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="text-lg font-medium mb-2">Products</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {selectedCart.products.map(product => (
                    <div key={product.id} className="mb-3 pb-3 border-b last:border-b-0 last:mb-0 last:pb-0">
                      <div className="flex items-start space-x-3">
                        {/* Product Image */}
                        {product.image && (
                          <div className="flex-shrink-0">
                            <img 
                              src={product.image} 
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded-md border"
                            />
                          </div>
                        )}
                        
                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{product.name}</p>
                      <div className="flex justify-between text-sm text-gray-600 mt-1">
                        <span>Qty: {product.quantity}</span>
                        <span>${product.price.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-medium mb-2">Recovery Actions</h4>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    className="flex flex-col items-center justify-center p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-200"
                    onClick={() => openScheduleModal(selectedCart.originalCart)}
                  >
                    <Mail size={24} className="text-blue-600 mb-2" />
                    <span className="text-sm font-medium">Send Email</span>
                  </button>
                  <button 
                    className="flex flex-col items-center justify-center p-3 border rounded-lg hover:bg-purple-50 hover:border-purple-200"
                    onClick={() => handleCommunication('sms', selectedCart)}
                  >
                    <MessageSquare size={24} className="text-purple-600 mb-2" />
                    <span className="text-sm font-medium">Send SMS</span>
                  </button>
                  <button 
                    className="flex flex-col items-center justify-center p-3 border rounded-lg hover:bg-green-50 hover:border-green-200"
                    onClick={() => handleCommunication('whatsapp', selectedCart)}
                  >
                    <Phone size={24} className="text-green-600 mb-2" />
                    <span className="text-sm font-medium">WhatsApp</span>
                  </button>
            </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Send Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
            <h2 className="text-xl font-bold mb-6 text-center">Send Email Reminder</h2>
            <p className="mb-6 text-gray-600 text-center">
              Send an email reminder to {scheduleCart?.customer_email} to complete their purchase.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Send Option</label>
              <div className="flex space-x-4">
                <button
                  className={`px-4 py-2 rounded font-medium ${sendOption === 'now' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'} hover:bg-blue-700`}
                  onClick={() => setSendOption('now')}
                  disabled={scheduleLoading}
                >
                  Send Now
                </button>
                <button
                  className={`px-4 py-2 rounded font-medium ${sendOption === 'schedule' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'} hover:bg-blue-700`}
                  onClick={() => setSendOption('schedule')}
                  disabled={scheduleLoading}
                >
                  Schedule
                </button>
              </div>
            </div>
            {sendOption === 'schedule' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Send After</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  value={schedulePreset}
                  onChange={e => setSchedulePreset(e.target.value)}
                  disabled={scheduleLoading}
                >
                  <option value="1h">1 hour</option>
                  <option value="2h">2 hours</option>
                  <option value="6h">6 hours</option>
                  <option value="12h">12 hours</option>
                  <option value="24h">24 hours</option>
                  <option value="3d">3 days</option>
                  <option value="7d">7 days</option>
                  <option value="custom">Custom...</option>
                </select>
                {schedulePreset === 'custom' && (
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={customDateTime}
                    onChange={e => setCustomDateTime(e.target.value)}
                    disabled={scheduleLoading}
                  />
                )}
              </div>
            )}
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={closeScheduleModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium"
                disabled={scheduleLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmailOption}
                className="px-4 py-2 rounded font-medium text-white bg-blue-600 hover:bg-blue-700"
                disabled={scheduleLoading}
              >
                {scheduleLoading ? 'Processing...' : sendOption === 'now' ? 'Send Now' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk WhatsApp Modal */}
      {showBulkWhatsAppModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
            <h2 className="text-xl font-bold mb-6 text-center">Send WhatsApp Reminders</h2>
            <p className="mb-4 text-gray-600">
              You are about to send WhatsApp reminders to {selectedCarts.length} customers.
              This will use their WhatsApp number or phone number if available.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowBulkWhatsAppModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={whatsappLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkWhatsApp}
                disabled={whatsappLoading}
                className={`px-4 py-2 rounded-md font-medium shadow-sm transition
                  ${whatsappLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
              >
                {whatsappLoading ? 'Sending...' : 'Send WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbandonedCarts;