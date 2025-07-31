import React, { useState } from 'react';
import api from '../../utils/api';

const CheckoutForm = ({ plan, planKey, billingCycle, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Call backend to create Stripe Checkout session
      const response = await api.post('/api/subscribe/create-checkout-session', {
        planKey
      });
      
      if (response.data.isFreePlan) {
        // Handle free plan - redirect directly
        window.location.href = response.data.url;
      } else if (response.data.url) {
        // Handle paid plans - redirect to Stripe Checkout
        window.location.href = response.data.url;
      } else {
        setError('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setError(error.response?.data?.error || 'Failed to process checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Complete Your Purchase
            </h2>
            <p className="text-gray-600">
              You're subscribing to the {plan.name} plan
            </p>
          </div>

          {/* Plan Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium text-gray-900">{plan.name} Plan</span>
              <span className="text-2xl font-bold text-gray-900">
                ${billingCycle === 'yearly' ? Math.round(plan.price * 0.8) : plan.price}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {billingCycle === 'yearly' ? 'Billed annually' : 'Billed monthly'}
              {billingCycle === 'yearly' && plan.price > 0 && (
                <span className="ml-2 text-green-600 font-medium">
                  Save 20%
                </span>
              )}
            </div>
          </div>

          {/* Features List */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              What's included:
            </h3>
            <ul className="space-y-2">
              {plan.features.slice(0, 5).map((feature, index) => (
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

          {/* Action Buttons */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-gray-100 text-gray-900 py-3 px-4 rounded-md font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : `Subscribe for $${billingCycle === 'yearly' ? Math.round(plan.price * 0.8) : plan.price}/month`}
              </button>
            </div>
          </form>

          {/* Terms */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              By subscribing, you agree to our{' '}
              <a href="/terms" className="text-blue-600 hover:text-blue-500">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-blue-600 hover:text-blue-500">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutForm; 