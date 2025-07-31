const AbandonedCart = require('../models/AbandonedCart');
const Customer = require('../models/Customer');
const StoreConnection = require('../models/StoreConnection');
const axios = require('axios');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const Cart = require('../models/Cart');
const Campaign = require('../models/Campaign');
const Email = require('../models/Email');

// Helper function to calculate percentage change
const calculatePercentageChange = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
};

// Helper function to get date range for different periods
const getDateRange = (period) => {
  const now = new Date();
  const currentStart = new Date(now);
  const previousStart = new Date(now);
  
  switch (period) {
    case 'week':
      currentStart.setDate(now.getDate() - 7);
      previousStart.setDate(now.getDate() - 14);
      break;
    case 'month':
      currentStart.setMonth(now.getMonth() - 1);
      previousStart.setMonth(now.getMonth() - 2);
      break;
    default:
      currentStart.setDate(now.getDate() - 7);
      previousStart.setDate(now.getDate() - 14);
  }
  
  return { currentStart, previousStart, now };
};

exports.getStats = async (req, res) => {
  try {
    const { platform } = req.query;
    console.log('Getting stats for platform:', platform);

    const storeConnection = await StoreConnection.findOne({ platform });
    if (!storeConnection) {
      return res.status(404).json({ error: 'Store connection not found' });
    }

    // Get date ranges for current and previous periods
    const { currentStart, previousStart, now } = getDateRange('week');

    // Current period stats (last 7 days)
    const currentAbandonedCarts = await AbandonedCart.countDocuments({ 
      platform, 
      status: 'abandoned',
      last_activity: { $gte: currentStart, $lte: now }
    });

    const currentRecoveredCarts = await AbandonedCart.find({ 
      platform, 
      status: 'recovered',
      last_activity: { $gte: currentStart, $lte: now }
    });

    const currentRevenue = currentRecoveredCarts.reduce((sum, cart) => {
      const cartTotal = parseFloat(cart.total) || 0;
      return sum + cartTotal;
    }, 0);

    // Count active customers (customers who have cart activity in the current period)
    const currentActiveCustomers = await AbandonedCart.distinct('customer_id', {
      platform,
      last_activity: { $gte: currentStart, $lte: now }
    }).then(customerIds => customerIds.length);

    // Previous period stats (7 days before current period)
    const previousAbandonedCarts = await AbandonedCart.countDocuments({ 
      platform, 
      status: 'abandoned',
      last_activity: { $gte: previousStart, $lt: currentStart }
    });

    const previousRecoveredCarts = await AbandonedCart.find({ 
      platform, 
      status: 'recovered',
      last_activity: { $gte: previousStart, $lt: currentStart }
    });

    const previousRevenue = previousRecoveredCarts.reduce((sum, cart) => {
      const cartTotal = parseFloat(cart.total) || 0;
      return sum + cartTotal;
    }, 0);

    // Count active customers for previous period
    const previousActiveCustomers = await AbandonedCart.distinct('customer_id', {
      platform,
      last_activity: { $gte: previousStart, $lt: currentStart }
    }).then(customerIds => customerIds.length);

    // Calculate recovery rate for current period (based on all carts, not just current period)
    const allCurrentCarts = await AbandonedCart.countDocuments({ 
      platform,
      last_activity: { $gte: currentStart, $lte: now }
    });
    const currentRecoveryRate = allCurrentCarts > 0 
      ? (currentRecoveredCarts.length / allCurrentCarts) * 100 
      : 0;

    // Calculate recovery rate for previous period
    const allPreviousCarts = await AbandonedCart.countDocuments({ 
      platform,
      last_activity: { $gte: previousStart, $lt: currentStart }
    });
    const previousRecoveryRate = allPreviousCarts > 0 
      ? (previousRecoveredCarts.length / allPreviousCarts) * 100 
      : 0;

    // Calculate trend percentages
    const abandonedCartsTrend = calculatePercentageChange(currentAbandonedCarts, previousAbandonedCarts);
    const recoveredCartsTrend = calculatePercentageChange(currentRecoveredCarts.length, previousRecoveredCarts.length);
    const recoveryRateTrend = calculatePercentageChange(currentRecoveryRate, previousRecoveryRate);
    const revenueTrend = calculatePercentageChange(currentRevenue, previousRevenue);
    const activeCustomersTrend = calculatePercentageChange(currentActiveCustomers, previousActiveCustomers);

    // Get monthly stats for revenue trend
    const { currentStart: monthStart, previousStart: monthPreviousStart } = getDateRange('month');
    
    const monthlyRevenue = await AbandonedCart.aggregate([
      {
        $match: {
          platform,
          status: 'recovered',
          last_activity: { $gte: monthStart, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$total" } }
        }
      }
    ]);

    const previousMonthlyRevenue = await AbandonedCart.aggregate([
      {
        $match: {
          platform,
          status: 'recovered',
          last_activity: { $gte: monthPreviousStart, $lt: monthStart }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$total" } }
        }
      }
    ]);

    const monthlyRevenueValue = monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0;
    const previousMonthlyRevenueValue = previousMonthlyRevenue.length > 0 ? previousMonthlyRevenue[0].total : 0;
    const monthlyRevenueTrend = calculatePercentageChange(monthlyRevenueValue, previousMonthlyRevenueValue);

    // Debug logging
    console.log('Dashboard Stats Debug:', {
      platform,
      currentPeriod: { start: currentStart, end: now },
      previousPeriod: { start: previousStart, end: currentStart },
      currentAbandonedCarts,
      currentRecoveredCarts: currentRecoveredCarts.length,
      currentActiveCustomers,
      currentRevenue,
      currentRecoveryRate,
      previousAbandonedCarts,
      previousRecoveredCarts: previousRecoveredCarts.length,
      previousActiveCustomers,
      previousRevenue,
      previousRecoveryRate,
      trends: {
        abandonedCarts: abandonedCartsTrend.toFixed(2),
        recoveredCarts: recoveredCartsTrend.toFixed(2),
        recoveryRate: recoveryRateTrend.toFixed(2),
        revenue: revenueTrend.toFixed(2),
        activeCustomers: activeCustomersTrend.toFixed(2)
      }
    });

    res.json({
      abandonedCarts: currentAbandonedCarts,
      recoveredCarts: currentRecoveredCarts.length,
      totalRevenue: currentRevenue.toFixed(2),
      monthlyRevenue: monthlyRevenueValue.toFixed(2),
      recoveryRate: currentRecoveryRate.toFixed(2),
      activeCustomers: currentActiveCustomers,
      trends: {
        abandonedCarts: abandonedCartsTrend.toFixed(2),
        recoveredCarts: recoveredCartsTrend.toFixed(2),
        recoveryRate: recoveryRateTrend.toFixed(2),
        revenue: revenueTrend.toFixed(2),
        monthlyRevenue: monthlyRevenueTrend.toFixed(2),
        activeCustomers: activeCustomersTrend.toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};

exports.getChartData = async (req, res) => {
  try {
    const { platform, period = 'week' } = req.query;
    console.log('Getting chart data for platform:', platform, 'period:', period);

    const storeConnection = await StoreConnection.findOne({ platform });
    if (!storeConnection) {
      return res.status(404).json({ error: 'Store connection not found' });
    }

    const now = new Date();
    let startDate;

    switch (period) {
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default: // week
        startDate = new Date(now.setDate(now.getDate() - 7));
    }

    // Get abandoned carts data
    const abandonedCarts = await AbandonedCart.aggregate([
      {
        $match: {
          platform,
          status: 'abandoned',
          last_activity: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$last_activity" } },
          count: { $sum: 1 },
          total: { $sum: { $toDouble: "$total" } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get recovered carts data
    const recoveredCarts = await AbandonedCart.aggregate([
      {
        $match: {
          platform,
          status: 'recovered',
          last_activity: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$last_activity" } },
          count: { $sum: 1 },
          revenue: { $sum: { $toDouble: "$total" } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format data for chart
    const chartData = {
      labels: [...new Set([
        ...abandonedCarts.map(d => d._id),
        ...recoveredCarts.map(d => d._id)
      ])].sort(),
      datasets: [
        {
          label: 'Abandoned Carts',
          data: abandonedCarts.map(d => d.count),
          borderColor: '#FF6384',
          fill: false
        },
        {
          label: 'Recovered Carts',
          data: recoveredCarts.map(d => d.count),
          borderColor: '#36A2EB',
          fill: false
        }
      ]
    };

    res.json(chartData);
  } catch (error) {
    console.error('Error getting chart data:', error);
    res.status(500).json({ error: 'Failed to get chart data' });
  }
}; 