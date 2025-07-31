import axios from 'axios';
import config from '../config';

// Create axios instance with default config
const api = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    // Only add platform param for store-related endpoints
    const platform = localStorage.getItem('platform');
    if (
      platform &&
      config.url &&
      (
        config.url.includes('/stores') ||
        config.url.includes('/stores/connect-store') ||
        config.url.includes('/carts')
      )
    ) {
      config.params = {
        ...config.params,
        platform
      };
    }
    // Attach JWT token if available (check both sessionStorage and localStorage)
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API Error Request:', {
        request: error.request,
        message: error.message
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export const fetchAbandonedCartCustomers = async () => {
  const platform = localStorage.getItem('platform') || 'woocommerce';
  const res = await api.get('/customers/abandoned', { params: { platform } });
  return res.data;
};

export default api; 