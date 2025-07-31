import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';
import SubscriptionSlider from '../billing/SubscriptionSlider';
import oneLineLogo from '../../assets/One-line-logo.png';
import { getCurrentPlatform } from '../../utils/platformUtils';
import api from '../../utils/api';

const Header = ({ activeTab }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState({ plan: null, status: null });
  const [isSubscriptionSliderOpen, setIsSubscriptionSliderOpen] = useState(false);
  
  const platform = getCurrentPlatform(location.search);

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

  const getTitle = () => {
    const titles = {
      dashboard: 'Dashboard',
      carts: 'Abandoned Carts',
      campaigns: 'Email Campaigns',
      customers: 'Customers',
      notifications: 'Notifications',
      coupons: 'Coupons',
      analytics: 'Analytics',
      settings: 'Settings'
    };
    return titles[activeTab] || 'Dashboard';
  };

  const isAuthenticated = !!(sessionStorage.getItem('token') || localStorage.getItem('token'));

  const handleLogout = () => {
    // Clear all authentication and store connection data
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    localStorage.removeItem('isConnected');
    localStorage.removeItem('platform');
    localStorage.removeItem('storeUrl');
    localStorage.removeItem('store_connection');
    localStorage.removeItem('woocommerce_connection');
    localStorage.removeItem('shopify_connection');
    window.location.href = '/login';
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          {getTitle() === 'Dashboard' && (
            <img src={oneLineLogo} alt="CartResQ Logo" className="w-36 h-auto mr-3" style={{background: 'transparent'}} />
          )}
          <h2 className="text-xl font-semibold text-gray-900">{getTitle()}</h2>
        </div>
        <div className="flex items-center space-x-4">
          <NotificationBell platform={platform} />
          
          {/* Subscription Status Icon */}
          {subscription.plan && subscription.plan !== 'free' && (
            <button
              onClick={() => setIsSubscriptionSliderOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
              title="View Subscription Status"
            >
              <Crown className="h-5 w-5 text-blue-600 group-hover:text-blue-700" />
            </button>
          )}
          
          <a href="/pricing" className="text-blue-600 hover:underline font-medium">Pricing</a>
          {!isAuthenticated ? (
            <>
              <a href="/login" className="text-gray-700 hover:underline font-medium">Login</a>
              <a href="/register" className="text-gray-700 hover:underline font-medium">Register</a>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 font-medium transition"
            >
              Logout
            </button>
          )}
        </div>
      </div>
      
      {/* Subscription Slider */}
      <SubscriptionSlider 
        isOpen={isSubscriptionSliderOpen}
        onClose={() => setIsSubscriptionSliderOpen(false)}
      />
    </header>
  );
};

export default Header; 