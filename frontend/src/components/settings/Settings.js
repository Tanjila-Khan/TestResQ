import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

// Add this script to the document head to prevent flash
const preventThemeFlash = () => {
  const script = document.createElement('script');
  script.innerHTML = `
    (function() {
      const savedTheme = localStorage.getItem('theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.classList.add(savedTheme);
      document.documentElement.classList.add('theme-loaded');
    })();
  `;
  document.head.appendChild(script);
};

// Run the script immediately
preventThemeFlash();

const Settings = () => {
  const navigate = useNavigate();
  const [storeUrl, setStoreUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  // Apply theme on initial load and when theme changes
  useEffect(() => {
    // Remove all theme classes first
    document.documentElement.classList.remove('light', 'dark', 'blue');
    // Add the current theme class
    document.documentElement.classList.add(theme);
    // Save to localStorage
    localStorage.setItem('theme', theme);
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff');
    }
    // Ensure theme is visible
    document.documentElement.classList.add('theme-loaded');
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const connected = localStorage.getItem('isConnected') === 'true';
    const url = localStorage.getItem('storeUrl');
    setIsConnected(connected);
    setStoreUrl(url || '');
  }, []);

  const handleDisconnect = async () => {
    if (window.confirm('Are you sure you want to disconnect from this store?')) {
      try {
        // Get current platform
        const platform = localStorage.getItem('platform');
        
        // Call backend to disconnect store
        await api.delete('/api/stores/disconnect', {
          params: { platform }
        });
        
        // Clear localStorage
        localStorage.removeItem('isConnected');
        localStorage.removeItem('storeUrl');
        localStorage.removeItem('platform');
        localStorage.removeItem('store_connection');
        localStorage.removeItem('woocommerce_connection');
        localStorage.removeItem('shopify_connection');
        
        // Force reload to ensure App.js re-checks connection status
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        console.error('Error disconnecting store:', error);
        alert('Failed to disconnect store. Please try again.');
      }
    }
  };

  const handleConnectNew = async () => {
    try {
      // Get current platform
      const platform = localStorage.getItem('platform');
      
      // Call backend to disconnect current store first
      if (platform) {
        await api.delete('/api/stores/disconnect', {
          params: { platform }
        });
      }
      
      // Clear localStorage
      localStorage.removeItem('isConnected');
      localStorage.removeItem('storeUrl');
      localStorage.removeItem('platform');
      localStorage.removeItem('store_connection');
      localStorage.removeItem('woocommerce_connection');
      localStorage.removeItem('shopify_connection');
      
      // Force reload to ensure App.js re-checks connection status
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error disconnecting store:', error);
      // Even if disconnect fails, still reload to re-check status
      localStorage.removeItem('isConnected');
      localStorage.removeItem('storeUrl');
      localStorage.removeItem('platform');
      localStorage.removeItem('store_connection');
      localStorage.removeItem('woocommerce_connection');
      localStorage.removeItem('shopify_connection');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
  };

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const toggleFaqSection = () => {
    setIsFaqOpen(!isFaqOpen);
    if (isFaqOpen) {
      setOpenFaq(null); // Close any open FAQ when closing the section
    }
  };

  const faqs = [
    {
      question: "How do I connect my store?",
      answer: `To connect your store to CartResQ, follow these steps:

1. Click the "Connect Store" button in the settings
2. Select your platform (WooCommerce or Shopify)
3. Enter your store URL (e.g., https://your-store.com)
4. Provide the required API credentials:
   - For WooCommerce: Consumer Key and Consumer Secret
   - For Shopify: Access Token
5. Click "Connect" to establish the connection

After connecting, CartResQ will verify your credentials and start syncing your store data. You'll see a green checkmark when the connection is successful.`
    },
    {
      question: "How do I get API keys for my store?",
      answer: `Getting API keys depends on your platform:

For WooCommerce:
1. Log in to your WordPress admin panel
2. Go to WooCommerce → Settings → Advanced → REST API
3. Click "Add Key"
4. Set the following:
   - Description: "CartResQ Integration"
   - User: Select an admin account
   - Permissions: Set to "Read/Write"
   - Check these specific permissions:
     • Read/Write orders
     • Read/Write customers
     • Read/Write products
     • Read/Write coupons
5. Click "Generate API Key"
6. Copy both the Consumer Key and Consumer Secret

For Shopify:
1. Log in to your Shopify admin panel
2. Go to Settings → Apps and sales channels
3. Click "Develop apps" (or create a new app)
4. Under "API credentials", click "Configure Admin API scopes"
5. Enable these required scopes:
   • read_orders
   • read_customers
   • read_products
   • read_price_rules
   • read_checkouts
   • read_abandoned_checkouts
6. Click "Save"
7. Generate an Admin API access token
8. Copy the access token (starts with "shpat_")`
    },
    {
      question: "What settings need to be enabled to receive cart data?",
      answer: `To ensure CartResQ receives all necessary cart data, verify these settings:

For WooCommerce:
1. Enable Guest Checkout:
   - Go to WooCommerce → Settings → Accounts & Privacy
   - Check "Allow customers to place orders without an account"
   - Check "Allow customers to create an account during checkout"

2. Cart Session Settings:
   - Go to WooCommerce → Settings → Products
   - Set "Cart page" to your cart page
   - Enable "Redirect to the cart page after successful addition"

3. Checkout Settings:
   - Go to WooCommerce → Settings → Checkout
   - Enable "Enable guest checkout"
   - Set "Checkout process" to "Redirect to checkout page"

4. API Access:
   - Ensure your API keys have "Read/Write" permissions
   - Verify the API is not restricted by IP address
   - Check that the API endpoint is accessible

For Shopify:
1. Checkout Settings:
   - Go to Settings → Checkout
   - Enable "Customer accounts"
   - Set "Accounts are optional" or "Accounts are required"
   - Enable "Abandoned checkout recovery"

2. App Permissions:
   - Verify the app has all required scopes enabled
   - Check "read_abandoned_checkouts" is enabled
   - Ensure "read_orders" permission is active

3. Store Access:
   - Confirm your store's password protection is disabled
   - Verify the store is not in maintenance mode
   - Check that the store's domain is properly configured

After enabling these settings, CartResQ will be able to:
- Track abandoned carts in real-time
- Monitor checkout attempts
- Access customer information
- Send recovery emails
- Track conversion rates`
    },
    {
      question: "What happens to my data when I disconnect?",
      answer: "When you disconnect your store, CartResQ will stop collecting new data. Your existing data will be stored for 30 days before being automatically deleted. You can reconnect at any time to resume service. All your campaign settings and templates will be preserved during this period."
    },
    {
      question: "How often is abandoned cart data updated?",
      answer: "CartResQ automatically syncs with your store every 15 minutes to update abandoned cart data. You can also manually trigger a sync from the dashboard if needed. The system tracks cart abandonment in real-time and updates the dashboard accordingly."
    },
    {
      question: "What is considered an abandoned cart?",
      answer: "A cart is considered abandoned when a customer adds items to their cart but doesn't complete the purchase within 24 hours. You can customize this time threshold in the settings. The system also tracks partial checkouts and failed payment attempts."
    },
    {
      question: "Can I customize the recovery emails?",
      answer: "Yes! You can customize your recovery emails in the Campaigns section. We provide templates that you can modify, or you can create your own from scratch. You can also set up automated email sequences with multiple follow-ups, A/B testing, and personalized content based on cart items."
    },
    {
      question: "What email templates are available?",
      answer: "CartResQ offers various pre-built templates including gentle reminders, urgency-based messages, discount offers, and personalized recommendations. Each template can be customized with your brand colors, logo, and messaging. You can also create and save your own templates for future use."
    },
    {
      question: "What analytics are available?",
      answer: "CartResQ provides comprehensive analytics including recovery rates, revenue recovered, email open rates, click-through rates, and conversion tracking. You can view daily, weekly, and monthly reports, export data for further analysis, and track the performance of individual campaigns."
    },
    {
      question: "How do coupons work in recovery campaigns?",
      answer: "You can create and manage discount coupons directly in CartResQ. Set expiration dates, usage limits, and discount amounts. Coupons can be automatically applied in recovery emails or used as incentives in follow-up campaigns. The system tracks coupon usage and redemption rates."
    },
    {
      question: "How is customer data handled?",
      answer: "CartResQ securely stores customer information including email addresses, cart contents, and interaction history. All data is encrypted and compliant with privacy regulations. You can export customer data, manage customer segments, and create targeted recovery campaigns based on customer behavior."
    },
    {
      question: "What notifications are available?",
      answer: "CartResQ provides real-time notifications for important events such as successful recoveries, high-value abandoned carts, and campaign performance milestones. You can configure email notifications, in-app alerts, and integrate with your preferred notification system."
    },
    {
      question: "What are the system requirements?",
      answer: "CartResQ works with WooCommerce 5.0+ and Shopify stores. Your store should have SSL enabled, and the API credentials should have appropriate permissions. The system is optimized for modern browsers and provides a responsive interface for both desktop and mobile devices."
    },
    {
      question: "How is my data secured?",
      answer: "CartResQ implements industry-standard security measures including SSL encryption, secure API connections, and regular security audits. All data is backed up daily, and we maintain strict access controls. We comply with GDPR and other relevant data protection regulations."
    },
    {
      question: "How can I get support?",
      answer: "Support is available through multiple channels including in-app chat, email support, and comprehensive documentation. Our support team is available during business hours, and we provide priority support for enterprise customers. You can also access our knowledge base for self-service support."
    }
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
      
      <div className="mt-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Store Connection
            </h3>
            
            <div className="mt-5">
              <div className="rounded-md bg-gray-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    {isConnected ? (
                      <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3 flex-1 md:flex md:justify-between">
                    <p className="text-sm text-gray-700">
                      {isConnected ? (
                        <>
                          Connected to <span className="font-medium">{storeUrl}</span>
                        </>
                      ) : (
                        'Not connected to any store'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              {isConnected ? (
                <div className="space-x-3">
                  <button
                    type="button"
                    onClick={handleConnectNew}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Connect to Different Store
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Disconnect Store
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectNew}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Connect Store
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Other Settings
          </h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  theme === 'light'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="h-20 bg-white rounded shadow-sm mb-2"></div>
                <div className="text-sm font-medium text-center">Light</div>
              </button>
              
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="h-20 bg-gray-800 rounded shadow-sm mb-2"></div>
                <div className="text-sm font-medium text-center">Dark</div>
              </button>
              
              <button
                onClick={() => handleThemeChange('blue')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  theme === 'blue'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="h-20 bg-blue-50 rounded shadow-sm mb-2"></div>
                <div className="text-sm font-medium text-center">Blue</div>
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Choose a theme that best suits your preference. The theme will be applied immediately and saved for your next visit.
            </p>
          </div>
        </div>

        {/* FAQ Section as a single collapsible option */}
        <div className="mt-8">
          <button
            onClick={toggleFaqSection}
            className="w-full bg-white shadow rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
          >
            <div className="px-4 py-3 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Frequently Asked Questions
              </h3>
              <svg
                className={`h-5 w-5 text-gray-500 transform transition-transform ${
                  isFaqOpen ? 'rotate-180' : ''
                }`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </button>

          {isFaqOpen && (
            <div className="mt-2 space-y-2">
              {faqs.map((faq, index) => (
                <div key={index} className="bg-white shadow rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="text-md font-medium text-gray-900">
                        {faq.question}
                      </h4>
                      <svg
                        className={`h-5 w-5 text-gray-500 transform transition-transform ${
                          openFaq === index ? 'rotate-180' : ''
                        }`}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </button>
                  {openFaq === index && (
                    <div className="px-4 pb-4">
                      <p className="text-gray-600">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings; 