import React, { useState, useEffect } from 'react';
import { ShoppingCart, Users, DollarSign, Calendar } from 'lucide-react';
import StatsCard from './StatsCard';
import AbandonedCartsTable from '../carts/AbandonedCartsTable';
import CampaignsTable from '../campaigns/CampaignsTable';
import RecoveryChart from './RecoveryChart';
import api from '../../utils/api';
import cartresqLogo from '../../assets/cartresq-logo.jpg';
import { useLocation } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState({
    abandonedCarts: 0,
    recoveredCarts: 0,
    recoveryRate: 0,
    revenue: 0,
    monthlyRevenue: 0,
    activeCustomers: 0,
    trends: {
      abandonedCarts: 0,
      recoveredCarts: 0,
      recoveryRate: 0,
      revenue: 0,
      monthlyRevenue: 0,
      activeCustomers: 0
    }
  });
  
  const [chartType, setChartType] = useState('bar');
  const [timePeriod, setTimePeriod] = useState('week');
  const [chartData, setChartData] = useState([]);
  const [recentCarts, setRecentCarts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPlatform, setCurrentPlatform] = useState(null);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [subscription, setSubscription] = useState({ plan: null, status: null });
  const location = useLocation();

  useEffect(() => {
    // Get platform from localStorage and store connection
    const storedPlatform = localStorage.getItem('platform');
    const storeConnection = localStorage.getItem('store_connection');
    
    console.log('Dashboard platform detection:', {
      storedPlatform,
      storeConnection,
      isConnected: localStorage.getItem('isConnected')
    });
    
    if (storeConnection) {
      try {
        const connection = JSON.parse(storeConnection);
        console.log('Parsed store connection:', connection);
        setCurrentPlatform(connection.platform);
      } catch (err) {
        console.error('Error parsing store connection:', err);
        setCurrentPlatform(storedPlatform || 'woocommerce');
      }
    } else {
      setCurrentPlatform(storedPlatform || 'woocommerce');
    }
    
    // Fallback: if no platform is set but we have a store connection, use that
    if (!storedPlatform && !storeConnection) {
      const isConnected = localStorage.getItem('isConnected');
      if (isConnected === 'true') {
        console.log('No platform found but store is connected, checking for platform in store connection...');
        // Try to get platform from any available source
        const fallbackPlatform = localStorage.getItem('platform') || 'shopify';
        setCurrentPlatform(fallbackPlatform);
      }
    }
  }, []);

  useEffect(() => {
    if (!currentPlatform) {
      console.log('No platform detected, skipping dashboard data fetch');
      return;
    }

    const controller = new AbortController();

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching dashboard data for platform:', currentPlatform);

        // Fetch dashboard stats
        const statsResponse = await api.get('/api/dashboard/stats', {
          params: { platform: currentPlatform },
          signal: controller.signal
        });
        setStats({
          abandonedCarts: statsResponse.data.abandonedCarts || 0,
          recoveredCarts: statsResponse.data.recoveredCarts || 0,
          recoveryRate: statsResponse.data.recoveryRate || 0,
          revenue: statsResponse.data.totalRevenue || 0,
          monthlyRevenue: statsResponse.data.monthlyRevenue || 0,
          activeCustomers: statsResponse.data.activeCustomers || 0,
          trends: statsResponse.data.trends || {
            abandonedCarts: 0,
            recoveredCarts: 0,
            recoveryRate: 0,
            revenue: 0,
            monthlyRevenue: 0,
            activeCustomers: 0
          }
        });

        // Fetch recent customers
        const customersResponse = await api.get('/api/stores/customers/recent', {
          params: { platform: currentPlatform },
          signal: controller.signal
        });
        setRecentCustomers(customersResponse.data || []);

        // Fetch chart data based on time period
        const chartResponse = await api.get('/api/dashboard/chart', {
          params: { period: timePeriod, platform: currentPlatform },
          signal: controller.signal
        });
        setChartData(chartResponse.data || []);

        // Fetch recent abandoned carts
        const cartsResponse = await api.get('/api/carts/abandoned', {
          params: { limit: 4, platform: currentPlatform },
          signal: controller.signal
        });
        setRecentCarts(Array.isArray(cartsResponse.data.carts) ? cartsResponse.data.carts : Array.isArray(cartsResponse.data) ? cartsResponse.data : []);

        // Fetch campaigns
        const storeId = localStorage.getItem('storeUrl') || 'default';
        const campaignsResponse = await api.get('/api/campaigns', {
          params: { limit: 10, platform: currentPlatform, storeId },
          signal: controller.signal
        });
        const campaignsData = campaignsResponse.data?.campaigns || campaignsResponse.data || [];
        setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);

      } catch (err) {
        if (err.name === 'CanceledError' || err.message === 'canceled') {
          // Ignore canceled requests
          return;
        }
        console.error('Error fetching dashboard data:', err);
        
        // Handle specific error types
        if (err.response?.status === 503) {
          const errorData = err.response.data;
          setError(errorData.message || 'Store connection failed. Please check if your store is running and accessible.');
        } else if (err.response?.status === 401) {
          const errorData = err.response.data;
          setError(errorData.message || 'Authentication failed. Please reconnect your store with valid credentials.');
        } else if (err.response?.status === 404) {
          const errorData = err.response.data;
          setError(errorData.message || 'Store not found. Please connect your store first.');
        } else {
          setError('Failed to fetch dashboard data. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    return () => {
      controller.abort();
    };
  }, [currentPlatform, timePeriod]);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        // Check if we have session_id (from Stripe redirect) or plan=free
        const urlParams = new URLSearchParams(location.search);
        const sessionId = urlParams.get('session_id');
        const planParam = urlParams.get('plan');
        
        // If we have session_id, check the session status
        if (sessionId) {
          console.log('Session ID found, checking session status...');
          try {
            const sessionResponse = await api.get(`/api/subscribe/check-session?session_id=${sessionId}`);
            console.log('Session check response:', sessionResponse.data);
            if (sessionResponse.data.success) {
              setSubscription({ 
                plan: sessionResponse.data.plan, 
                status: sessionResponse.data.status 
              });
              return;
            }
          } catch (sessionErr) {
            console.error('Error checking session:', sessionErr);
            // Continue with normal subscription check
          }
        }
        
        // If we have plan=free, set subscription directly
        if (planParam === 'free') {
          setSubscription({ plan: 'free', status: 'active' });
          setLoading(false);
          return;
        }
        
        const response = await api.get('/api/subscribe/status');
        setSubscription(response.data);
      } catch (err) {
        console.error('Error fetching subscription:', err);
        setSubscription({ plan: null, status: null });
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubscription();
  }, [location.search]);

  const handleViewCartDetails = (cart) => {
    window.location.href = `/carts/${cart.id}`;
  };

  const handleEditCampaign = (campaign) => {
    window.location.href = `/campaigns/${campaign.id}`;
  };

  // Show loading while checking subscription
  if (loading) {
    console.log('Dashboard: Showing loading state');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show subscription required message if not subscribed
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    console.log('Dashboard: Showing subscription required state', { subscription });
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Subscription Required</h2>
          <p className="text-gray-600 mb-6">
            You need an active subscription to access the dashboard and connect your store.
          </p>
          <a
            href="/pricing"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Choose a Plan
          </a>
        </div>
      </div>
    );
  }

  // Show store connection error message
  if (error && (error.includes('Store connection failed') || error.includes('Store not found') || error.includes('Authentication failed') || error.includes('connect your store'))) {
    console.log('Dashboard: Showing store connection error state', { error });
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Store Connection Issue</h2>
          <p className="text-gray-600 mb-4">
            {error}
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-left">
            <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Incorrect Store Connection</h3>
            <p className="text-sm text-yellow-800">
              It appears you're connected to a store that you didn't set up for this account. 
              You can disconnect the current store and connect to the correct one.
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-blue-900 mb-2">What you can do:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Check if your store is running and accessible</li>
              <li>• Verify your store API credentials are correct</li>
              <li>• Reconnect your store with updated credentials</li>
            </ul>
          </div>
          <div className="space-y-3">
            <a
              href="/store-setup"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors w-full"
            >
              Reconnect Your Store
            </a>
            <button
              onClick={async () => {
                try {
                  const response = await api.delete(`/api/stores/disconnect?platform=${currentPlatform}`);
                  if (response.data.success) {
                    localStorage.removeItem('isConnected');
                    localStorage.removeItem('platform');
                    localStorage.removeItem('storeUrl');
                    window.location.reload();
                  }
                } catch (err) {
                  console.error('Error disconnecting store:', err);
                  alert('Failed to disconnect store. Please try again.');
                }
              }}
              className="inline-block bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors w-full"
            >
              Disconnect Current Store
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-block bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors w-full"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {console.log('Dashboard: Showing main dashboard content')}
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Abandoned Carts"
          value={stats.abandonedCarts}
          icon={ShoppingCart}
          color="blue"
          trend="This Week"
          trendValue={stats.trends.abandonedCarts}
        />
        <StatsCard
          title="Recovered Carts"
          value={stats.recoveredCarts}
          icon={ShoppingCart}
          color="green"
          trend="Recovery Rate"
          trendValue={stats.trends.recoveryRate}
          showProgress
        />
        <StatsCard
          title="Recovered Revenue"
          value={`$${Number(stats.revenue).toLocaleString()}`}
          icon={DollarSign}
          color="purple"
          trend="This Week"
          trendValue={stats.trends.revenue}
        />
        <StatsCard
          title="Active Customers"
          value={stats.activeCustomers}
          icon={Users}
          color="yellow"
          trend="This Week"
          trendValue={stats.trends.activeCustomers}
        />
      </div>
      
      {/* Recovery Chart */}
      <div className="bg-white rounded-lg shadow p-4 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Cart Recovery Overview</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar size={18} className="text-gray-500" />
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="day">Last 24 Hours</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>
        <RecoveryChart 
          data={chartData} 
          chartType={chartType}
          onChartTypeChange={setChartType}
        />
      </div>
      
      {/* Recent Abandonments */}
      <AbandonedCartsTable 
        carts={recentCarts} 
        onViewDetails={handleViewCartDetails}
      />
      
      {/* Campaigns */}
      <CampaignsTable 
        campaigns={campaigns} 
        onEdit={handleEditCampaign}
        onCampaignCreated={async (updatedCampaign) => {
          if (updatedCampaign.deleted) {
            // Remove the campaign from the list
            setCampaigns(prev => prev.filter(c => c._id !== updatedCampaign._id));
          } else {
            // Refresh campaigns from server to ensure we have the latest data
            try {
              const storeId = localStorage.getItem('storeUrl') || 'default';
              const campaignsResponse = await api.get('/api/campaigns', {
                params: { limit: 10, platform: currentPlatform, storeId }
              });
              const campaignsData = campaignsResponse.data?.campaigns || campaignsResponse.data || [];
              setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
            } catch (err) {
              console.error('Error refreshing campaigns after creation:', err);
              // Fallback: try to add the new campaign to the existing list
              if (updatedCampaign._id) {
                setCampaigns(prev => {
                  const existingIndex = prev.findIndex(c => c._id === updatedCampaign._id);
                  if (existingIndex >= 0) {
                    // Update existing campaign
                    const newList = [...prev];
                    newList[existingIndex] = updatedCampaign;
                    return newList;
                  } else {
                    // Add new campaign
                    return [updatedCampaign, ...prev];
                  }
                });
              }
            }
          }
        }}
      />
    </div>
  );
};

export default Dashboard; 