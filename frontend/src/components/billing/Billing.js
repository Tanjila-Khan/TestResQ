import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import PaymentHistory from './PaymentHistory';
import SubscriptionStatus from './SubscriptionStatus';

const Billing = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await api.get('/api/payments/subscription');
      setSubscription(response.data.subscription);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setError('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const response = await api.post('/api/payments/create-portal-session');
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Error creating portal session:', error);
      setError('Failed to open billing portal');
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access at the end of your current billing period.')) {
      return;
    }

    try {
      await api.post('/api/payments/cancel-subscription');
      fetchSubscription();
      alert('Your subscription has been canceled and will end at the conclusion of your current billing period.');
    } catch (error) {
      console.error('Error canceling subscription:', error);
      setError('Failed to cancel subscription');
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      await api.post('/api/payments/reactivate-subscription');
      fetchSubscription();
      alert('Your subscription has been reactivated!');
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      setError('Failed to reactivate subscription');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error}</div>
          <button
            onClick={fetchSubscription}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 text-xl mb-4">No subscription found</div>
          <a
            href="/pricing"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            View Plans
          </a>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'trialing':
        return 'text-blue-600 bg-blue-100';
      case 'canceled':
        return 'text-red-600 bg-red-100';
      case 'past_due':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Subscription</h1>
          <p className="text-gray-600">Manage your subscription and billing information</p>
        </div>

        {/* Subscription Status Component */}
        <div className="mb-8">
          <SubscriptionStatus />
        </div>

        {/* Current Plan Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Current Plan</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {subscription.planDetails?.name || subscription.plan}
              </h3>
              <p className="text-gray-600 mb-4">
                ${subscription.amount / 100}/month
              </p>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Billing Cycle:</span>
                  <span className="font-medium">{subscription.billingCycle || 'Monthly'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Next Billing:</span>
                  <span className="font-medium">
                    {subscription.nextBillingDate ? formatDate(subscription.nextBillingDate) : formatDate(subscription.currentPeriodEnd)}
                  </span>
                </div>
                {subscription.lastPaymentDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Payment:</span>
                    <span className="font-medium">{formatDate(subscription.lastPaymentDate)}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Plan Features</h4>
              <ul className="space-y-2">
                {subscription.planDetails?.features?.slice(0, 5).map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <svg
                      className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-4">
            <button
              onClick={handleManageBilling}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Manage Billing
            </button>
            
            {subscription.cancelAtPeriodEnd ? (
              <button
                onClick={handleReactivateSubscription}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                Reactivate Subscription
              </button>
            ) : subscription.plan !== 'free' ? (
              <button
                onClick={handleCancelSubscription}
                className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                Cancel Subscription
              </button>
            ) : null}
            
            <button
              onClick={() => setShowPaymentHistory(!showPaymentHistory)}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200 transition-colors"
            >
              {showPaymentHistory ? 'Hide' : 'View'} Payment History
            </button>
          </div>
        </div>

        {/* Payment History */}
        {showPaymentHistory && (
          <PaymentHistory />
        )}

        {/* Plan Limits */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Plan Limits & Usage</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {subscription.features?.maxStores === -1 ? '∞' : subscription.features?.maxStores || 1}
              </div>
              <div className="text-gray-600">Store Connections</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {subscription.features?.maxEmailsPerMonth === -1 ? '∞' : subscription.features?.maxEmailsPerMonth || 100}
              </div>
              <div className="text-gray-600">Emails per Month</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {subscription.features?.maxSmsPerMonth === -1 ? '∞' : subscription.features?.maxSmsPerMonth || 50}
              </div>
              <div className="text-gray-600">SMS per Month</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {subscription.features?.maxWhatsappPerMonth === -1 ? '∞' : subscription.features?.maxWhatsappPerMonth || 50}
              </div>
              <div className="text-gray-600">WhatsApp per Month</div>
            </div>
          </div>

          {/* Premium Features */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Premium Features</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-3 ${subscription.features?.advancedAnalytics ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-gray-700">Advanced Analytics</span>
              </div>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-3 ${subscription.features?.customBranding ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-gray-700">Custom Branding</span>
              </div>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-3 ${subscription.features?.apiAccess ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-gray-700">API Access</span>
              </div>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full mr-3 ${subscription.features?.prioritySupport ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-gray-700">Priority Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upgrade CTA */}
        {subscription.plan !== 'enterprise' && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-4">Need More Features?</h2>
            <p className="text-blue-100 mb-6">
              Upgrade your plan to unlock more features and higher limits
            </p>
            <a
              href="/pricing"
              className="bg-white text-blue-600 px-8 py-3 rounded-md font-semibold hover:bg-gray-100 transition-colors"
            >
              View Plans
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Billing; 