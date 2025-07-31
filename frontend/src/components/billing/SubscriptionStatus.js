import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const SubscriptionStatus = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/subscribe/status');
      setSubscription(response.data);
    } catch (err) {
      console.error('Error fetching subscription status:', err);
      setError('Failed to load subscription status');
    } finally {
      setLoading(false);
    }
  };

  const getPlanDisplayName = (plan) => {
    const planNames = {
      'free': 'CartResQ Lite',
      'starter': 'CartResQ Starter',
      'growth': 'CartResQ Growth'
    };
    return planNames[plan] || plan;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'trialing':
        return 'text-blue-600 bg-blue-100';
      case 'past_due':
        return 'text-yellow-600 bg-yellow-100';
      case 'canceled':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPlanLimits = (plan) => {
    const limits = {
      'free': {
        stores: 1,
        emails: 500,
        sms: 0,
        whatsapp: 0,
        features: ['Basic Analytics', 'Email Support']
      },
      'starter': {
        stores: 2,
        emails: 5000,
        sms: 100,
        whatsapp: 100,
        features: ['Advanced Analytics', 'Priority Support', 'Customer Segmentation', 'Scheduled Campaigns']
      },
      'growth': {
        stores: 3,
        emails: 'Unlimited',
        sms: 1000,
        whatsapp: 1000,
        features: ['Multi-store Dashboard', 'ROI Tracking', 'Automated SMS/WhatsApp', 'Export Analytics', 'Premium Support']
      }
    };
    return limits[plan] || limits.free;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="text-red-600 mb-2">⚠️</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={fetchSubscriptionStatus}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="text-gray-600 mb-2">📊</div>
          <p className="text-gray-600">No subscription information available</p>
        </div>
      </div>
    );
  }

  const planLimits = getPlanLimits(subscription.plan);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Subscription Status</h2>
      
      {/* Current Plan */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Current Plan</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
            {subscription.status === 'active' ? 'Active' : 
             subscription.status === 'trialing' ? 'Trial' : 
             subscription.status === 'past_due' ? 'Past Due' : 
             subscription.status === 'canceled' ? 'Canceled' : subscription.status}
          </span>
        </div>
        
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
          <h4 className="text-xl font-bold text-gray-900 mb-2">
            {getPlanDisplayName(subscription.plan)}
          </h4>
          <p className="text-gray-600 mb-4">
            {subscription.plan === 'free' ? 'Free plan' : 
             subscription.plan === 'starter' ? '$19/month' : 
             subscription.plan === 'growth' ? '$49/month' : 'Custom pricing'}
          </p>
          
          {subscription.plan !== 'free' && (
            <div className="text-sm text-gray-500">
              <p>Next billing: {subscription.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString() : 'N/A'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Plan Limits */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Limits</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {planLimits.stores === 'Unlimited' ? '∞' : planLimits.stores}
            </div>
            <div className="text-sm text-gray-600">Store Connections</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {planLimits.emails === 'Unlimited' ? '∞' : planLimits.emails}
            </div>
            <div className="text-sm text-gray-600">Emails/Month</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {planLimits.sms === 'Unlimited' ? '∞' : planLimits.sms}
            </div>
            <div className="text-sm text-gray-600">SMS/Month</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 mb-1">
              {planLimits.whatsapp === 'Unlimited' ? '∞' : planLimits.whatsapp}
            </div>
            <div className="text-sm text-gray-600">WhatsApp/Month</div>
          </div>
        </div>
      </div>

      {/* Plan Features */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Features</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {planLimits.features.map((feature, index) => (
            <div key={index} className="flex items-center">
              <div className="text-green-500 mr-3">✅</div>
              <span className="text-gray-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade CTA */}
      {subscription.plan !== 'growth' && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Ready to Scale?</h3>
          <p className="text-blue-100 mb-4">
            {subscription.plan === 'free' 
              ? 'Upgrade to unlock more features and higher limits'
              : 'Upgrade to Growth plan for unlimited emails and automated messaging'
            }
          </p>
          <a
            href="/pricing"
            className="inline-block bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            View Plans
          </a>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatus; 