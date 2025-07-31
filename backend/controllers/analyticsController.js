const AbandonedCart = require('../models/AbandonedCart');
const Customer = require('../models/Customer');
const SentEmail = require('../models/SentEmail');
const StoreConnection = require('../models/StoreConnection');
const axios = require('axios');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;

// Get analytics data
const getAnalytics = async (req, res) => {
  try {
    const { platform, dateRange = '30d' } = req.query;
    
    // Use user-specific store connection
    const userId = req.user._id;

    // Get date range
    const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange(dateRange);

    // Get store connection - user-specific
    const storeConnection = await StoreConnection.findOne({ 
      userId,
      platform
    });
    
    if (!storeConnection) {
      return res.status(404).json({ message: 'Store connection not found' });
    }

    // Get current period data
    const currentData = await getAnalyticsData(startDate, endDate, platform);
    const previousData = await getAnalyticsData(previousStartDate, previousEndDate, platform);

    // Calculate top products
    const topProducts = await calculateTopProducts(platform, startDate, endDate);

    // Calculate advanced business metrics
    const analytics = {
      // Revenue Opportunity (total value of abandoned carts)
      revenueOpportunity: currentData.totalAbandonedValue,
      revenueOpportunityChange: calculatePercentageChange(
        previousData.totalAbandonedValue,
        currentData.totalAbandonedValue
      ),

      // Average Cart Value
      averageCartValue: currentData.totalCarts > 0 ? currentData.totalCartValue / currentData.totalCarts : 0,
      averageCartValueChange: calculatePercentageChange(
        previousData.totalCarts > 0 ? previousData.totalCartValue / previousData.totalCarts : 0,
        currentData.totalCarts > 0 ? currentData.totalCartValue / currentData.totalCarts : 0
      ),

      // Abandonment Rate
      abandonmentRate: currentData.totalCarts > 0 ? (currentData.abandonedCarts / currentData.totalCarts) * 100 : 0,
      abandonmentRateChange: calculatePercentageChange(
        previousData.totalCarts > 0 ? (previousData.abandonedCarts / previousData.totalCarts) * 100 : 0,
        currentData.totalCarts > 0 ? (currentData.abandonedCarts / currentData.totalCarts) * 100 : 0
      ),

      // Customer Lifetime Value (average revenue per customer)
      customerLifetimeValue: currentData.uniqueCustomers > 0 ? currentData.totalRevenue / currentData.uniqueCustomers : 0,
      customerLifetimeValueChange: calculatePercentageChange(
        previousData.uniqueCustomers > 0 ? previousData.totalRevenue / previousData.uniqueCustomers : 0,
        currentData.uniqueCustomers > 0 ? currentData.totalRevenue / currentData.uniqueCustomers : 0
      ),

      // Conversion Funnel
      funnel: {
        cartsCreated: currentData.totalCarts,
        emailsSent: currentData.emailsSent,
        emailsOpened: currentData.emailsOpened,
        clicks: currentData.emailClicks,
        conversions: currentData.recoveredCarts
      },

      // Email Performance
      email: {
        openRate: currentData.emailsSent > 0 ? (currentData.emailsOpened / currentData.emailsSent) * 100 : 0,
        clickRate: currentData.emailsSent > 0 ? (currentData.emailClicks / currentData.emailsSent) * 100 : 0,
        conversionRate: currentData.emailsSent > 0 ? (currentData.recoveredCarts / currentData.emailsSent) * 100 : 0,
        revenuePerEmail: currentData.emailsSent > 0 ? currentData.totalRevenue / currentData.emailsSent : 0
      },

      // Customer Insights
      customers: {
        new: currentData.newCustomers,
        returning: currentData.returningCustomers,
        repeatPurchaseRate: currentData.uniqueCustomers > 0 ? (currentData.returningCustomers / currentData.uniqueCustomers) * 100 : 0,
        avgOrdersPerCustomer: currentData.uniqueCustomers > 0 ? currentData.totalOrders / currentData.uniqueCustomers : 0
      },

      // Top Products
      topProducts: topProducts,

      // Platform-specific metrics
      [platform]: {
        cartAbandonmentRate: currentData.totalCarts > 0 ? (currentData.abandonedCarts / currentData.totalCarts) * 100 : 0,
        averageCartValue: currentData.totalCarts > 0 ? currentData.totalCartValue / currentData.totalCarts : 0,
        conversionRate: currentData.totalCarts > 0 ? (currentData.recoveredCarts / currentData.totalCarts) * 100 : 0
      }
    };

    console.log('=== Final Analytics Response ===');
    console.log('Analytics data:', JSON.stringify(analytics, null, 2));

    res.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
};

// Get period data
const getPeriodData = async (platform, startDate, endDate) => {
  const query = {
    platform,
    last_activity: { $gte: startDate, $lte: endDate }
  };

  const [carts, customers, emails] = await Promise.all([
    AbandonedCart.find(query),
    Customer.find({ platform, last_login: { $gte: startDate, $lte: endDate } }),
    SentEmail.find({ platform, sent_at: { $gte: startDate, $lte: endDate } })
  ]);

  return { carts, customers, emails };
};

// Calculate analytics
const calculateAnalytics = (currentData, previousData, platform) => {
  const current = currentData;
  const previous = previousData;

  // Basic metrics
  const abandonedCarts = current.carts.length;
  const recoveredCarts = current.carts.filter(cart => cart.status === 'recovered').length;
  const recoveryRate = abandonedCarts > 0 ? recoveredCarts / abandonedCarts : 0;
  
  const previousAbandonedCarts = previous.carts.length;
  const previousRecoveredCarts = previous.carts.filter(cart => cart.status === 'recovered').length;
  const previousRecoveryRate = previousAbandonedCarts > 0 ? previousRecoveredCarts / previousAbandonedCarts : 0;
  
  const recoveryRateChange = previousRecoveryRate > 0 ? (recoveryRate - previousRecoveryRate) / previousRecoveryRate : 0;

  // Revenue calculations
  const revenueRecovered = current.carts
    .filter(cart => cart.status === 'recovered')
    .reduce((sum, cart) => sum + (cart.total || 0), 0);
  
  const previousRevenueRecovered = previous.carts
    .filter(cart => cart.status === 'recovered')
    .reduce((sum, cart) => sum + (cart.total || 0), 0);
  
  const revenueChange = previousRevenueRecovered > 0 ? (revenueRecovered - previousRevenueRecovered) / previousRevenueRecovered : 0;

  // Customer metrics
  const activeCustomers = current.customers.length;
  const previousActiveCustomers = previous.customers.length;
  const customersChange = previousActiveCustomers > 0 ? (activeCustomers - previousActiveCustomers) / previousActiveCustomers : 0;

  // Email metrics
  const emailMetrics = calculateEmailMetrics(current.emails, previous.emails);

  // Platform-specific metrics
  const platformMetrics = calculatePlatformMetrics(current, previous, platform);

  // Top products
  const topProducts = calculateTopProducts(current.carts);

  return {
    recoveryRate,
    recoveryRateChange,
    revenueRecovered,
    revenueChange,
    abandonedCarts,
    cartsChange: abandonedCarts - previousAbandonedCarts,
    activeCustomers,
    customersChange,
    email: emailMetrics,
    [platform]: platformMetrics,
    topProducts
  };
};

// Calculate email metrics
const calculateEmailMetrics = (currentEmails, previousEmails) => {
  const totalSent = currentEmails.length;
  const opened = currentEmails.filter(email => email.opened).length;
  const clicked = currentEmails.filter(email => email.clicked).length;
  const converted = currentEmails.filter(email => email.converted).length;

  const openRate = totalSent > 0 ? opened / totalSent : 0;
  const clickRate = totalSent > 0 ? clicked / totalSent : 0;
  const conversionRate = totalSent > 0 ? converted / totalSent : 0;

  // Calculate revenue per email
  const totalRevenue = currentEmails
    .filter(email => email.converted)
    .reduce((sum, email) => sum + (email.revenue || 0), 0);
  
  const revenuePerEmail = totalSent > 0 ? totalRevenue / totalSent : 0;

  return {
    openRate,
    clickRate,
    conversionRate,
    revenuePerEmail,
    totalSent,
    opened,
    clicked,
    converted
  };
};

// Calculate platform-specific metrics
const calculatePlatformMetrics = (currentData, previousData, platform) => {
  if (platform === 'shopify') {
    return calculateShopifyMetrics(currentData, previousData);
  } else {
    return calculateWooCommerceMetrics(currentData, previousData);
  }
};

// Calculate Shopify-specific metrics
const calculateShopifyMetrics = (currentData, previousData) => {
  const carts = currentData.carts;
  const totalCarts = carts.length;
  const abandonedCarts = carts.filter(cart => cart.status === 'abandoned').length;
  const checkoutAbandonmentRate = totalCarts > 0 ? abandonedCarts / totalCarts : 0;

  // Calculate average order value
  const recoveredCarts = carts.filter(cart => cart.status === 'recovered');
  const totalRevenue = recoveredCarts.reduce((sum, cart) => sum + (cart.total || 0), 0);
  const averageOrderValue = recoveredCarts.length > 0 ? totalRevenue / recoveredCarts.length : 0;

  // Calculate customer lifetime value (simplified)
  const customers = currentData.customers;
  const totalCustomerRevenue = customers.reduce((sum, customer) => sum + (customer.total_spent || 0), 0);
  const customerLifetimeValue = customers.length > 0 ? totalCustomerRevenue / customers.length : 0;

  return {
    checkoutAbandonmentRate,
    averageOrderValue,
    customerLifetimeValue
  };
};

// Calculate WooCommerce-specific metrics
const calculateWooCommerceMetrics = (currentData, previousData) => {
  const carts = currentData.carts;
  const totalCarts = carts.length;
  const abandonedCarts = carts.filter(cart => cart.status === 'abandoned').length;
  const cartAbandonmentRate = totalCarts > 0 ? abandonedCarts / totalCarts : 0;

  // Calculate average cart value
  const totalCartValue = carts.reduce((sum, cart) => sum + (cart.total || 0), 0);
  const averageCartValue = totalCarts > 0 ? totalCartValue / totalCarts : 0;

  // Calculate conversion rate
  const recoveredCarts = carts.filter(cart => cart.status === 'recovered').length;
  const conversionRate = totalCarts > 0 ? recoveredCarts / totalCarts : 0;

  return {
    cartAbandonmentRate,
    averageCartValue,
    conversionRate
  };
};

// Calculate top products based on abandonment frequency
const calculateTopProducts = async (platform, startDate, endDate) => {
  try {
    // Get all abandoned carts in the date range
    const abandonedCarts = await AbandonedCart.find({
      platform,
      status: 'abandoned',
      last_activity: { $gte: startDate, $lte: endDate }
    });

    // Get all recovered carts in the date range
    const recoveredCarts = await AbandonedCart.find({
      platform,
      status: 'recovered',
      last_activity: { $gte: startDate, $lte: endDate }
    });

    const productMap = new Map();

    // Process abandoned carts
    abandonedCarts.forEach(cart => {
      if (cart.items && Array.isArray(cart.items)) {
        cart.items.forEach(item => {
          const productId = item.product_id || item.id || item.name;
          if (!productMap.has(productId)) {
            productMap.set(productId, {
              name: item.name || item.product_name || 'Unknown Product',
              sku: item.sku || 'N/A',
              image: item.image_url || null,
              abandonedCount: 0,
              recoveredCount: 0,
              totalRevenue: 0,
              lostRevenue: 0
            });
          }

          const product = productMap.get(productId);
          product.abandonedCount++;
          product.lostRevenue += (item.price || 0) * (item.quantity || 1);
        });
      }
    });

    // Process recovered carts
    recoveredCarts.forEach(cart => {
      if (cart.items && Array.isArray(cart.items)) {
        cart.items.forEach(item => {
          const productId = item.product_id || item.id || item.name;
          if (productMap.has(productId)) {
            const product = productMap.get(productId);
            product.recoveredCount++;
            product.totalRevenue += (item.price || 0) * (item.quantity || 1);
          }
        });
      }
    });

    // Convert to array and calculate recovery rates
    const topProducts = Array.from(productMap.values())
      .map(product => ({
        ...product,
        recoveryRate: product.abandonedCount > 0 ? (product.recoveredCount / product.abandonedCount) * 100 : 0,
        revenueLost: product.lostRevenue
      }))
      .sort((a, b) => b.abandonedCount - a.abandonedCount)
      .slice(0, 10);

    return topProducts;
  } catch (error) {
    console.error('Error calculating top products:', error);
    return [];
  }
};

// Export analytics data
const exportAnalytics = async (req, res) => {
  try {
    const { platform, range = '30d' } = req.query;
    
    if (!platform) {
      return res.status(400).json({ error: 'Platform parameter is required' });
    }

    // Get analytics data
    const analytics = await getAnalyticsData(platform, range);
    
    // Convert to CSV format
    const csvData = convertToCSV(analytics);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=analytics-${platform}-${range}.csv`);
    res.send(csvData);
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({ error: 'Failed to export analytics data' });
  }
};

// Helper function to get analytics data
const getAnalyticsData = async (startDate, endDate, platform) => {
  console.log('=== Analytics Data Fetch ===');
  console.log('Platform:', platform);
  console.log('Date Range:', { startDate, endDate });

  // Get abandoned carts
  const abandonedCarts = await AbandonedCart.find({
    platform,
    status: 'abandoned',
    last_activity: { $gte: startDate, $lte: endDate }
  });
  console.log('Abandoned carts found:', abandonedCarts.length);

  // Get all carts for total calculation
  const allCarts = await AbandonedCart.find({
    platform,
    last_activity: { $gte: startDate, $lte: endDate }
  });
  console.log('Total carts found:', allCarts.length);

  // Get emails sent
  const emailsSent = await SentEmail.find({
    platform,
    sentAt: { $gte: startDate, $lte: endDate }
  });
  console.log('Emails sent found:', emailsSent.length);

  // Get recovered carts
  const recoveredCarts = await AbandonedCart.find({
    platform,
    status: 'recovered',
    last_activity: { $gte: startDate, $lte: endDate }
  });
  console.log('Recovered carts found:', recoveredCarts.length);

  // Calculate metrics
  const totalAbandonedValue = abandonedCarts.reduce((sum, cart) => sum + (cart.total || 0), 0);
  const totalCartValue = allCarts.reduce((sum, cart) => sum + (cart.total || 0), 0);
  const totalCarts = allCarts.length;
  const abandonedCartsCount = abandonedCarts.length;
  const recoveredCartsCount = recoveredCarts.length;
  const totalRevenue = recoveredCarts.reduce((sum, cart) => sum + (cart.total || 0), 0);

  // Email metrics
  const emailsSentCount = emailsSent.length;
  const emailsOpenedCount = emailsSent.filter(email => email.status === 'opened').length;
  const emailClicksCount = emailsSent.filter(email => email.status === 'clicked').length;

  // Customer metrics
  const uniqueCustomers = new Set(allCarts.map(cart => cart.customer_email)).size;
  const newCustomers = new Set(abandonedCarts.map(cart => cart.customer_email)).size;
  const returningCustomers = uniqueCustomers - newCustomers;
  const totalOrders = allCarts.length;

  const result = {
    totalAbandonedValue,
    totalCartValue,
    totalCarts,
    abandonedCarts: abandonedCartsCount,
    recoveredCarts: recoveredCartsCount,
    totalRevenue,
    emailsSent: emailsSentCount,
    emailsOpened: emailsOpenedCount,
    emailClicks: emailClicksCount,
    uniqueCustomers,
    newCustomers,
    returningCustomers,
    totalOrders
  };

  console.log('Calculated metrics:', result);
  return result;
};

// Helper function to convert data to CSV
const convertToCSV = (data) => {
  // Simple CSV conversion - you might want to use a library like 'csv-writer' for more complex data
  const headers = ['Metric', 'Value', 'Change'];
  const rows = [
    ['Recovery Rate', `${(data.recoveryRate * 100).toFixed(2)}%`, `${(data.recoveryRateChange * 100).toFixed(2)}%`],
    ['Revenue Recovered', `$${data.revenueRecovered.toFixed(2)}`, `${(data.revenueChange * 100).toFixed(2)}%`],
    ['Abandoned Carts', data.abandonedCarts, data.cartsChange],
    ['Active Customers', data.activeCustomers, `${(data.customersChange * 100).toFixed(2)}%`]
  ];

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
};

// Helper function to calculate percentage change
const calculatePercentageChange = (previous, current) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

// Helper function to get date range
const getDateRange = (dateRange) => {
  const endDate = new Date();
  const startDate = new Date();
  const previousStartDate = new Date();
  const previousEndDate = new Date();

  switch (dateRange) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      previousStartDate.setDate(endDate.getDate() - 14);
      previousEndDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      previousStartDate.setDate(endDate.getDate() - 60);
      previousEndDate.setDate(endDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      previousStartDate.setDate(endDate.getDate() - 180);
      previousEndDate.setDate(endDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1);
      previousStartDate.setFullYear(endDate.getFullYear() - 2);
      previousEndDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(endDate.getDate() - 30);
      previousStartDate.setDate(endDate.getDate() - 60);
      previousEndDate.setDate(endDate.getDate() - 30);
  }

  return { startDate, endDate, previousStartDate, previousEndDate };
};

// Get recovery rate trend data
const getRecoveryRateTrend = async (req, res) => {
  try {
    const { platform, period = '30d' } = req.query;
    const userId = req.user._id;

    // Get store connection
    const storeConnection = await StoreConnection.findOne({ 
      userId,
      platform
    });
    
    if (!storeConnection) {
      return res.status(404).json({ message: 'Store connection not found' });
    }

    const { startDate, endDate } = getDateRange(period);

    // Get daily recovery rate data
    const dailyData = await AbandonedCart.aggregate([
      {
        $match: {
          platform,
          last_activity: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$last_activity" } },
          totalCarts: { $sum: 1 },
          recoveredCarts: {
            $sum: {
              $cond: [{ $eq: ["$status", "recovered"] }, 1, 0]
            }
          }
        }
      },
      {
        $addFields: {
          recoveryRate: {
            $cond: [
              { $gt: ["$totalCarts", 0] },
              { $multiply: [{ $divide: ["$recoveredCarts", "$totalCarts"] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format data for chart
    const trendData = {
      labels: dailyData.map(d => d._id),
      datasets: [
        {
          label: 'Recovery Rate (%)',
          data: dailyData.map(d => parseFloat(d.recoveryRate.toFixed(2))),
          borderColor: '#10B981',
          backgroundColor: '#10B98120',
          fill: true,
          tension: 0.4
        }
      ]
    };

    // If no data, return empty structure
    if (dailyData.length === 0) {
      trendData.labels = [];
      trendData.datasets[0].data = [];
    }

    res.json(trendData);
  } catch (error) {
    console.error('Error getting recovery rate trend:', error);
    res.status(500).json({ message: 'Error fetching recovery rate trend data' });
  }
};

// Get revenue trend data
const getRevenueTrend = async (req, res) => {
  try {
    const { platform, period = '30d' } = req.query;
    const userId = req.user._id;

    // Get store connection
    const storeConnection = await StoreConnection.findOne({ 
      userId,
      platform
    });
    
    if (!storeConnection) {
      return res.status(404).json({ message: 'Store connection not found' });
    }

    const { startDate, endDate } = getDateRange(period);

    // Get daily revenue data
    const dailyData = await AbandonedCart.aggregate([
      {
        $match: {
          platform,
          status: 'recovered',
          last_activity: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$last_activity" } },
          revenue: { $sum: { $toDouble: "$total" } },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get abandoned cart value for comparison
    const abandonedData = await AbandonedCart.aggregate([
      {
        $match: {
          platform,
          status: 'abandoned',
          last_activity: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$last_activity" } },
          abandonedValue: { $sum: { $toDouble: "$total" } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Combine data and fill missing dates
    const allDates = [...new Set([
      ...dailyData.map(d => d._id),
      ...abandonedData.map(d => d._id)
    ])].sort();

    const revenueData = allDates.map(date => {
      const revenue = dailyData.find(d => d._id === date);
      const abandoned = abandonedData.find(d => d._id === date);
      
      return {
        date,
        revenue: revenue ? revenue.revenue : 0,
        orderCount: revenue ? revenue.orderCount : 0,
        abandonedValue: abandoned ? abandoned.abandonedValue : 0
      };
    });

    // Format data for chart
    const trendData = {
      labels: revenueData.map(d => d.date),
      datasets: [
        {
          label: 'Recovered Revenue ($)',
          data: revenueData.map(d => parseFloat(d.revenue.toFixed(2))),
          borderColor: '#8B5CF6',
          backgroundColor: '#8B5CF620',
          fill: true,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'Abandoned Value ($)',
          data: revenueData.map(d => parseFloat(d.abandonedValue.toFixed(2))),
          borderColor: '#EF4444',
          backgroundColor: '#EF444420',
          fill: false,
          tension: 0.4,
          yAxisID: 'y'
        }
      ]
    };

    // If no data, return empty structure
    if (revenueData.length === 0) {
      trendData.labels = [];
      trendData.datasets[0].data = [];
      trendData.datasets[1].data = [];
    }

    res.json(trendData);
  } catch (error) {
    console.error('Error getting revenue trend:', error);
    res.status(500).json({ message: 'Error fetching revenue trend data' });
  }
};

module.exports = {
  getAnalytics,
  exportAnalytics,
  getRecoveryRateTrend,
  getRevenueTrend
}; 