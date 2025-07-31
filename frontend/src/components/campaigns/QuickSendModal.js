import React, { useState, useEffect } from 'react';
import { X, Send, Users, AlertCircle } from 'lucide-react';
import api from '../../utils/api';

const QuickSendModal = ({ isOpen, onClose, onSent }) => {
  const [template, setTemplate] = useState('default');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [abandonedCartsCount, setAbandonedCartsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const platform = localStorage.getItem('platform') || 'woocommerce';

  useEffect(() => {
    if (isOpen) {
      fetchAbandonedCartsCount();
    }
  }, [isOpen]);

  const fetchAbandonedCartsCount = async () => {
    try {
      const response = await api.get('/api/carts/abandoned', {
        params: { platform, limit: 1000 }
      });
      setAbandonedCartsCount(response.data.carts?.length || 0);
    } catch (err) {
      console.error('Error fetching abandoned carts count:', err);
    }
  };

  const templates = [
    {
      id: 'default',
      name: 'Default Reminder',
      subject: 'Complete your purchase - {customer_name}',
      message: `Hi {customer_name},

We noticed you left some items in your cart. Don't miss out on these great products!

{cart_items}

Total: {cart_total}

Complete your purchase now: {checkout_link}

Best regards,
{store_name}`
    },
    {
      id: 'discount',
      name: 'Discount Offer',
      subject: 'Special 10% discount on your cart!',
      message: `Hi {customer_name},

We'd love to see you complete your purchase! Here's a special 10% discount on your cart.

{cart_items}

Original Total: {cart_total}
Discount: 10% off
Final Total: {discounted_total}

Use code: SAVE10

Complete your purchase: {checkout_link}

This offer expires in 24 hours!

Best regards,
{store_name}`
    },
    {
      id: 'urgency',
      name: 'Urgency Campaign',
      subject: 'Your cart is waiting - Limited time offer!',
      message: `Hi {customer_name},

Your cart items are in high demand and may sell out soon!

{cart_items}

Total: {cart_total}

⏰ Limited time offer: Complete your purchase within 2 hours and get FREE shipping!

{checkout_link}

Don't miss out!

Best regards,
{store_name}`
    }
  ];

  const handleTemplateSelect = (selectedTemplate) => {
    setTemplate(selectedTemplate.id);
    setSubject(selectedTemplate.subject);
    setMessage(selectedTemplate.message);
  };

  const handleSendToAll = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both subject and message');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create a campaign for all abandoned carts
      const campaignData = {
        name: `Quick Send - ${new Date().toLocaleDateString()}`,
        type: 'email',
        description: 'Quick send to all abandoned cart users',
        targetAudience: {
          type: 'abandoned_carts',
          filters: {}
        },
        content: {
          subject,
          body: message,
          template: 'quick_send'
        },
        schedule: {
          startDate: new Date().toISOString().split('T')[0],
          timeOfDay: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          frequency: 'once'
        },
        platform,
        storeId: localStorage.getItem('storeUrl') || 'default'
      };

      console.log('Sending campaign data:', campaignData);
      
      const response = await api.post('/api/campaigns', campaignData);
      
      console.log('Campaign sent successfully:', response.data);
      
      if (onSent) {
        onSent(response.data);
      }
      
      onClose();
    } catch (err) {
      console.error('Error sending to all abandoned carts:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to send campaign. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <Send className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Send to All Abandoned Carts</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {/* Audience Info */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium text-blue-900">Target Audience</h3>
              </div>
              <p className="text-blue-700">
                This campaign will be sent to <strong>{abandonedCartsCount} customers</strong> with abandoned carts.
              </p>
            </div>

            {/* Template Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Choose Template</h3>
              <div className="grid grid-cols-1 gap-3">
                {templates.map((templateOption) => (
                  <div
                    key={templateOption.id}
                    onClick={() => handleTemplateSelect(templateOption)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      template === templateOption.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <h4 className="font-medium text-gray-900 mb-2">{templateOption.name}</h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {templateOption.subject}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Content */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject Line *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email subject"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="8"
                  placeholder="Enter your message"
                />
              </div>

              {/* Variable Help */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Available Variables:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div><code className="bg-white px-1 rounded">{'{customer_name}'}</code> - Customer's name</div>
                  <div><code className="bg-white px-1 rounded">{'{cart_items}'}</code> - List of cart items</div>
                  <div><code className="bg-white px-1 rounded">{'{cart_total}'}</code> - Cart total amount</div>
                  <div><code className="bg-white px-1 rounded">{'{checkout_link}'}</code> - Checkout URL</div>
                  <div><code className="bg-white px-1 rounded">{'{store_name}'}</code> - Store name</div>
                  <div><code className="bg-white px-1 rounded">{'{discounted_total}'}</code> - Total after discount</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSendToAll}
              disabled={loading || !subject.trim() || !message.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send to {abandonedCartsCount} Customers</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickSendModal; 