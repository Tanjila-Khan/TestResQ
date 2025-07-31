import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import CartResQDashboard from './components/CartResQDashboard';
import StoreSetup from './components/setup/StoreSetup';
import CartRecovery from './components/carts/CartRecovery';
import Pricing from './components/pricing/Pricing';
import Billing from './components/billing/Billing';
import AuthPage from './components/setup/Login';
import ResetPassword from './components/setup/ResetPassword';
import TestSubscription from './components/setup/TestSubscription';
import AbandonedCarts from './components/carts/AbandonedCarts';
import Customers from './components/customers/Customers';
import Campaigns from './components/campaigns/Campaigns';
import Notifications from './components/notifications/Notifications';
import Coupons from './components/coupons/Coupons';
import Analytics from './components/analytics/Analytics';
import Settings from './components/settings/Settings';
import DashboardLayout from './components/layout/DashboardLayout';
import './App.css';
import api from './utils/api';

function useAuthState() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isStoreConnected, setIsStoreConnected] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      setIsAuthenticated(!!token);
      if (!token) {
        setAuthChecked(true);
        return;
      }
      try {
        const res = await api.get('/api/subscribe/status');
        const hasActiveSubscription = res.data.status === 'active' || 
                                   res.data.status === 'trialing' || 
                                   (res.data.plan && res.data.plan !== 'free');
        setIsSubscribed(hasActiveSubscription);
        if (hasActiveSubscription) {
          try {
            const connectionRes = await api.get('/api/stores/check-connection');
            const hasConnection = connectionRes.data.hasConnection;
            setIsStoreConnected(hasConnection);
            if (hasConnection) {
              localStorage.setItem('isConnected', 'true');
              localStorage.setItem('platform', connectionRes.data.platform);
              localStorage.setItem('storeUrl', connectionRes.data.store_url);
            } else {
              localStorage.removeItem('isConnected');
              localStorage.removeItem('platform');
              localStorage.removeItem('storeUrl');
            }
          } catch (connectionErr) {
            setIsStoreConnected(false);
            localStorage.removeItem('isConnected');
            localStorage.removeItem('platform');
            localStorage.removeItem('storeUrl');
          }
        } else {
          setIsStoreConnected(false);
          localStorage.removeItem('isConnected');
          localStorage.removeItem('platform');
          localStorage.removeItem('storeUrl');
        }
      } catch (error) {
        setIsSubscribed(false);
        setIsStoreConnected(false);
        localStorage.removeItem('isConnected');
        localStorage.removeItem('platform');
        localStorage.removeItem('storeUrl');
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, [location.pathname]);

  return { authChecked, isAuthenticated, isSubscribed, isStoreConnected };
}

function SmartRedirect() {
  const { authChecked, isAuthenticated, isSubscribed, isStoreConnected } = useAuthState();
  if (!authChecked) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isSubscribed) return <Navigate to="/pricing" replace />;
  if (!isStoreConnected) return <Navigate to="/store-setup" replace />;
  return <Navigate to="/dashboard" replace />;
}

function ProtectedRoute({ children }) {
  const { authChecked, isAuthenticated, isSubscribed, isStoreConnected } = useAuthState();
  const location = useLocation();
  if (!authChecked) return null;

  // Not authenticated: only allow /login, /register, /reset-password
  if (!isAuthenticated) {
    if (["/login", "/register", "/reset-password"].includes(location.pathname)) {
      return children;
    }
    return <Navigate to="/login" replace />;
  }

  // Authenticated: block /login, /register, /reset-password
  if (isAuthenticated && ["/login", "/register", "/reset-password"].includes(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Authenticated but not subscribed: only allow /pricing
  if (!isSubscribed) {
    if (["/pricing", "/logout"].includes(location.pathname)) {
      return children;
    }
    return <Navigate to="/pricing" replace />;
  }

  // Authenticated and subscribed but not store connected: only allow /store-setup
  if (!isStoreConnected) {
    if (location.pathname === '/store-setup') {
      return children;
    }
    return <Navigate to="/store-setup" replace />;
  }

  // Authenticated, subscribed, and store connected: block /store-setup
  if (isStoreConnected && location.pathname === '/store-setup') {
    return <Navigate to="/dashboard" replace />;
  }

  // All good
  return children;
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/login" element={<ProtectedRoute><AuthPage /></ProtectedRoute>} />
          <Route path="/register" element={<ProtectedRoute><AuthPage /></ProtectedRoute>} />
          <Route path="/reset-password" element={<ProtectedRoute><ResetPassword /></ProtectedRoute>} />
          <Route path="/test-subscription" element={<ProtectedRoute><TestSubscription /></ProtectedRoute>} />
          <Route path="/cart/recover" element={<ProtectedRoute><CartRecovery /></ProtectedRoute>} />
          <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
          <Route path="/store-setup" element={<ProtectedRoute><StoreSetup /></ProtectedRoute>} />

          {/* Main app pages with sidebar/header */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<CartResQDashboard />} />
            <Route path="/carts" element={<AbandonedCarts />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="/" element={<SmartRedirect />} />
          <Route path="*" element={<SmartRedirect />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

