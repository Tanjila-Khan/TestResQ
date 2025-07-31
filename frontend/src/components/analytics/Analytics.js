import React, { useState, useEffect } from 'react';
import { 
  CurrencyDollarIcon, 
  ShoppingCartIcon, 
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import api from '../../utils/api';
import TrendChart from './TrendChart';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [platform, setPlatform] = useState('');
  const [dateRange, setDateRange] = useState('30d');
  
  // Chart data states
  const [recoveryRateData, setRecoveryRateData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);

  useEffect(() => {
    const storedPlatform = localStorage.getItem('platform') || 'woocommerce';
    setPlatform(storedPlatform);
    fetchAnalytics(storedPlatform, dateRange);
    fetchTrendData(storedPlatform, dateRange);
  }, [dateRange]);

  const fetchAnalytics = async (platform, range) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/analytics', {
        params: { platform, range }
      });
      
      setAnalytics(response.data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.response?.data?.error || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendData = async (platform, range) => {
    try {
      setChartLoading(true);
      setChartError(null);

      // Fetch recovery rate trend data
      const recoveryResponse = await api.get('/api/analytics/recovery-rate-trend', {
        params: { platform, period: range }
      });
      setRecoveryRateData(recoveryResponse.data);

      // Fetch revenue trend data
      const revenueResponse = await api.get('/api/analytics/revenue-trend', {
        params: { platform, period: range }
      });
      setRevenueData(revenueResponse.data);
    } catch (err) {
      console.error('Error fetching trend data:', err);
      setChartError(err.response?.data?.message || 'Failed to fetch trend data');
    } finally {
      setChartLoading(false);
    }
  };

  const handlePeriodChange = (newRange) => {
    setDateRange(newRange);
  };

  const exportAnalytics = async () => {
    try {
      const response = await api.get('/api/analytics/export', {
        params: { platform, range: dateRange },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics-${platform}-${dateRange}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting analytics:', err);
      setError('Failed to export analytics data');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getPlatformIcon = () => {
    return platform === 'shopify' ? '🛍️' : '🛒';
  };

  const getPlatformName = () => {
    return platform === 'shopify' ? 'Shopify' : 'WooCommerce';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="text-red-400">⚠️</div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Analytics</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Advanced Analytics</h1>
          <p className="text-gray-600 mt-1">
            {getPlatformIcon()} {getPlatformName()} Store Performance
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button
            onClick={exportAnalytics}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ArrowTrendingUpIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Revenue Opportunity</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.revenueOpportunity ? formatCurrency(analytics.revenueOpportunity) : '$0'}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-red-600">
              {analytics?.revenueOpportunityChange ? (analytics.revenueOpportunityChange > 0 ? '+' : '') + formatPercentage(analytics.revenueOpportunityChange) : '0%'}
            </span>
            <span className="text-sm text-gray-500 ml-2">vs previous period</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Average Cart Value</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.averageCartValue ? formatCurrency(analytics.averageCartValue) : '$0'}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-green-600">
              +{analytics?.averageCartValueChange ? formatPercentage(analytics.averageCartValueChange) : '0%'}
            </span>
            <span className="text-sm text-gray-500 ml-2">vs previous period</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ShoppingCartIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Abandonment Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.abandonmentRate ? formatPercentage(analytics.abandonmentRate) : '0%'}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-red-600">
              {analytics?.abandonmentRateChange ? (analytics.abandonmentRateChange > 0 ? '+' : '') + formatPercentage(analytics.abandonmentRateChange) : '0%'}
            </span>
            <span className="text-sm text-gray-500 ml-2">vs previous period</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Customer Lifetime Value</p>
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.customerLifetimeValue ? formatCurrency(analytics.customerLifetimeValue) : '$0'}
              </p>
            </div>
          </div>
      <div className="mt-4">
            <span className="text-sm text-green-600">
              +{analytics?.customerLifetimeValueChange ? formatPercentage(analytics.customerLifetimeValueChange) : '0%'}
            </span>
            <span className="text-sm text-gray-500 ml-2">vs previous period</span>
          </div>
        </div>
      </div>

      {/* Advanced Business Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Conversion Funnel */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Carts Created</span>
              <span className="text-sm font-medium">{analytics?.funnel?.cartsCreated || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Emails Sent</span>
              <span className="text-sm font-medium">{analytics?.funnel?.emailsSent || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Emails Opened</span>
              <span className="text-sm font-medium">{analytics?.funnel?.emailsOpened || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Clicks</span>
              <span className="text-sm font-medium">{analytics?.funnel?.clicks || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Conversions</span>
              <span className="text-sm font-medium text-green-600">{analytics?.funnel?.conversions || 0}</span>
            </div>
          </div>
        </div>

        {/* Email Performance */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Performance</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Open Rate</span>
              <span className="text-sm font-medium">{analytics?.email?.openRate ? formatPercentage(analytics.email.openRate) : '0%'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Click Rate</span>
              <span className="text-sm font-medium">{analytics?.email?.clickRate ? formatPercentage(analytics.email.clickRate) : '0%'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Conversion Rate</span>
              <span className="text-sm font-medium">{analytics?.email?.conversionRate ? formatPercentage(analytics.email.conversionRate) : '0%'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Revenue per Email</span>
              <span className="text-sm font-medium">{analytics?.email?.revenuePerEmail ? formatCurrency(analytics.email.revenuePerEmail) : '$0'}</span>
            </div>
          </div>
        </div>

        {/* Customer Insights */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Insights</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">New Customers</span>
              <span className="text-sm font-medium">{analytics?.customers?.new || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Returning Customers</span>
              <span className="text-sm font-medium">{analytics?.customers?.returning || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Repeat Purchase Rate</span>
              <span className="text-sm font-medium">{analytics?.customers?.repeatPurchaseRate ? formatPercentage(analytics.customers.repeatPurchaseRate) : '0%'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg. Orders per Customer</span>
              <span className="text-sm font-medium">{analytics?.customers?.avgOrdersPerCustomer || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recovery Rate Trend */}
        <TrendChart 
          title="Recovery Rate Trend"
          data={recoveryRateData} 
          loading={chartLoading} 
          error={chartError} 
          period={dateRange} 
          onPeriodChange={handlePeriodChange}
        />

        {/* Revenue Trend */}
        <TrendChart 
          title="Revenue Trend"
          data={revenueData} 
          loading={chartLoading} 
          error={chartError} 
          period={dateRange} 
          onPeriodChange={handlePeriodChange}
        />
      </div>

      {/* Platform-Specific Analytics */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {getPlatformName()} Specific Metrics
        </h3>
        
        {platform === 'shopify' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.shopify?.checkoutAbandonmentRate ? 
                  formatPercentage(analytics.shopify.checkoutAbandonmentRate) : '0%'}
              </p>
              <p className="text-sm text-gray-600">Checkout Abandonment Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.shopify?.averageOrderValue ? 
                  formatCurrency(analytics.shopify.averageOrderValue) : '$0'}
              </p>
              <p className="text-sm text-gray-600">Average Order Value</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.shopify?.customerLifetimeValue ? 
                  formatCurrency(analytics.shopify.customerLifetimeValue) : '$0'}
              </p>
              <p className="text-sm text-gray-600">Customer Lifetime Value</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.woocommerce?.cartAbandonmentRate ? 
                  formatPercentage(analytics.woocommerce.cartAbandonmentRate) : '0%'}
              </p>
              <p className="text-sm text-gray-600">Cart Abandonment Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.woocommerce?.averageCartValue ? 
                  formatCurrency(analytics.woocommerce.averageCartValue) : '$0'}
              </p>
              <p className="text-sm text-gray-600">Average Cart Value</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">
                {analytics?.woocommerce?.conversionRate ? 
                  formatPercentage(analytics.woocommerce.conversionRate) : '0%'}
              </p>
              <p className="text-sm text-gray-600">Conversion Rate</p>
            </div>
          </div>
        )}
      </div>

      {/* Top Products */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Abandoned Products</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Abandoned Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recovery Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue Lost
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics?.topProducts?.map((product, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        <img 
                          className="h-10 w-10 rounded-full object-cover" 
                          src={product.image || 'https://via.placeholder.com/40'} 
                          alt={product.name}
                        />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.abandonedCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatPercentage(product.recoveryRate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(product.revenueLost)}
                  </td>
                </tr>
              )) || (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics; 