import React, { useState, useEffect } from 'react';
import { X, Plus, Mail, Users, Calendar, Target, Edit3, Send, Save, Check, CheckSquare } from 'lucide-react';
import api, { fetchAbandonedCartCustomers } from '../../utils/api';

const initialCampaignState = {
  name: '',
  type: 'email',
  description: '',
  targetAudience: {
    type: 'abandoned_carts',
    filters: {
      minCartValue: '',
      maxCartValue: '',
      minAbandonTime: 1,
      maxAbandonTime: 72
    }
  },
  content: {
    subject: '',
    body: '',
    template: 'default'
  },
  schedule: {
    startDate: new Date().toISOString().split('T')[0],
    timeOfDay: '10:00',
    frequency: 'once'
  }
};

const CampaignCreator = ({ isOpen, onClose, onCampaignCreated, campaign: campaignProp }) => {
  const [step, setStep] = useState(1);
  const [campaign, setCampaign] = useState(initialCampaignState);

  const [templates, setTemplates] = useState([]);
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);

  const platform = localStorage.getItem('platform') || 'woocommerce';

  useEffect(() => {
    if (isOpen) {
      if (campaignProp) {
        // Convert date format for frontend compatibility
        const formattedCampaign = { ...campaignProp };
        
        if (formattedCampaign.schedule?.startDate) {
          // Convert Date object to YYYY-MM-DD string format
          const startDate = new Date(formattedCampaign.schedule.startDate);
          formattedCampaign.schedule.startDate = startDate.toISOString().split('T')[0];
        }
        
        setCampaign({ ...initialCampaignState, ...formattedCampaign });
        
        // Set selected customers from existing campaign
        if (campaignProp.targetAudience?.filters?.customerEmails) {
          setSelectedCustomers(campaignProp.targetAudience.filters.customerEmails);
        } else if (campaignProp.targetAudience?.customerEmails) {
          setSelectedCustomers(campaignProp.targetAudience.customerEmails);
        }
      } else {
        setCampaign(initialCampaignState);
        setSelectedCustomers([]);
      }
      setStep(1);
      fetchTemplates();
      fetchAbandonedCarts();
    }
  }, [isOpen, campaignProp]);

  useEffect(() => {
    if (isOpen && campaign.targetAudience.type === 'specific_customers') {
      fetchCustomers();
    }
    // eslint-disable-next-line
  }, [isOpen, campaign.targetAudience.type]);

  const fetchTemplates = async () => {
    try {
      // Use fixed sample templates for reminders and a custom option
      const mockTemplates = [
        {
          id: 'first_reminder',
          name: 'First Reminder',
          subject: 'We saved your cart! Complete your purchase',
          body: `Hi there,

We noticed you left some items in your cart. Don’t miss out on these great products!

Click the link below to complete your purchase:
[Complete My Purchase]

Best regards,
The CartResQ Team`
        },
        {
          id: 'second_reminder',
          name: 'Second Reminder',
          subject: 'Still thinking it over? Your cart is waiting!',
          body: `Hello,

Just a quick reminder that your cart is still waiting for you. These items are popular and may sell out soon!

Finish your order now:
[Return to My Cart]

We’re here if you need any help!
The CartResQ Team`
        },
        {
          id: 'last_reminder',
          name: 'Last Chance Reminder',
          subject: 'Last chance to recover your cart!',
          body: `Hi,

This is your last chance to complete your purchase before your cart expires. Don’t let these items slip away!

Complete your order here:
[Checkout Now]

Thank you for shopping with us!
The CartResQ Team`
        },
        {
          id: 'custom',
          name: 'Custom Template',
          subject: '',
          body: ''
        }
      ];
      setTemplates(mockTemplates);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  const fetchAbandonedCarts = async () => {
    try {
      const response = await api.get('/api/carts/abandoned', {
        params: { platform, limit: 100 }
      });
      setAbandonedCarts(response.data.carts || []);
    } catch (err) {
      console.error('Error fetching abandoned carts:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      setCustomersLoading(true);
      // Only fetch customers with abandoned carts
      const response = await fetchAbandonedCartCustomers();
      setCustomers(response || []);
    } catch (err) {
      console.error('Error fetching customers with abandoned carts:', err);
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleTemplateSelect = (template) => {
    setCampaign(prev => ({
      ...prev,
      content: {
        ...prev.content,
        template: template.id,
        subject: template.subject,
        body: template.body
      }
    }));
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [section, key] = field.split('.');
      setCampaign(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [key]: value
        }
      }));
    } else {
      setCampaign(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // Update handleCustomerSelection to use email
  const handleCustomerSelection = (email) => {
    setSelectedCustomers((prev) => {
      if (prev.includes(email)) {
        return prev.filter(e => e !== email);
      } else {
        return [...prev, email];
      }
    });
  };

  // Update handleSelectAllCustomers to use email
  const handleSelectAllCustomers = () => {
    if (selectedCustomers.length === abandonedCarts.length && abandonedCarts.length > 0) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(abandonedCarts.map(c => c.customer_email));
    }
  };

  // Update handleCreateCampaign to use selectedCustomers directly
  const handleCreateCampaign = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate that at least one customer is selected for abandoned cart campaigns
      if (campaign.targetAudience.type === 'abandoned_carts' && selectedCustomers.length === 0) {
        setError('Please select at least one customer to send the campaign to.');
        setLoading(false);
        return;
      }

      const campaignData = {
        ...campaign,
        platform,
        storeId: localStorage.getItem('storeUrl') || 'default'
      };

      // Add selected customers to the campaign data
      if (campaign.targetAudience.type === 'abandoned_carts') {
        // Only send to explicitly selected customers
        campaignData.targetAudience.customerEmails = selectedCustomers;
      }

      let response;
      if (campaignProp && campaignProp._id) {
        // Update existing campaign
        response = await api.put(`/api/campaigns/${campaignProp._id}`, campaignData);
      } else {
        // Create new campaign
        response = await api.post('/api/campaigns', campaignData);
      }
      
      if (onCampaignCreated) {
        onCampaignCreated(response.data);
      }
      
      onClose();
    } catch (err) {
      console.error('Error creating campaign:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create campaign. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getTargetAudienceCount = () => {
    if (campaign.targetAudience.type === 'abandoned_carts') {
      return abandonedCarts.length;
    } else if (campaign.targetAudience.type === 'specific_customers') {
      return selectedCustomers.length;
    }
    return 'All customers';
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Campaign Details</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign Name *
            </label>
            <input
              type="text"
              value={campaign.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter campaign name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={campaign.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Describe your campaign"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign Type
            </label>
            <select
              value={campaign.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="email">Email Campaign</option>
              <option value="sms">SMS Campaign</option>
              <option value="push">Push Notification</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Target Audience</h3>
        <div className="space-y-4">
          {/* Abandoned Carts Selection */}
          {campaign.targetAudience.type === 'abandoned_carts' && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-blue-900">Abandoned Cart Recipients</h4>
                <span className="text-sm text-blue-600">
                  {selectedCustomers.length > 0 ? `${selectedCustomers.length} selected` : `Please select customers to send campaign to`}
                </span>
              </div>
              {/* Select All Button */}
              <div className="flex items-center p-3 bg-white rounded-lg border mb-4">
                <button
                  onClick={() => {
                    if (selectedCustomers.length === abandonedCarts.length) {
                      setSelectedCustomers([]);
                    } else {
                      setSelectedCustomers(abandonedCarts.map(c => c.customer_email));
                    }
                  }}
                  className="flex items-center space-x-3 text-left w-full"
                >
                  {selectedCustomers.length === abandonedCarts.length && abandonedCarts.length > 0 ? (
                    <CheckSquare className="h-5 w-5 text-blue-600" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-gray-300 rounded"></div>
                  )}
                <div>
                    <span className="font-medium text-gray-900">
                      {selectedCustomers.length === abandonedCarts.length && abandonedCarts.length > 0 ? 'Deselect All' : 'Select All'}
                    </span>
                    <p className="text-sm text-gray-500">
                      {selectedCustomers.length === abandonedCarts.length && abandonedCarts.length > 0
                        ? 'Uncheck all abandoned cart users'
                        : `Select all ${abandonedCarts.length} abandoned cart users`}
                    </p>
                  </div>
                </button>
                </div>
              {/* Abandoned Cart User List */}
              <div className="max-h-60 overflow-y-auto space-y-2">
                {abandonedCarts.map((cart) => (
                  <div key={`${cart.cart_id}-${cart.customer_email}`} className="flex items-center p-3 bg-white rounded-lg border">
                    <button
                      onClick={() => {
                        setSelectedCustomers((prev) => {
                          if (prev.includes(cart.customer_email)) {
                            return prev.filter(e => e !== cart.customer_email);
                          } else {
                            return [...prev, cart.customer_email];
                          }
                        });
                      }}
                      className="flex items-center space-x-3 text-left w-full"
                    >
                      {selectedCustomers.includes(cart.customer_email) ? (
                        <Check className="h-5 w-5 text-blue-600" />
                      ) : (
                        <div className="h-5 w-5 border-2 border-gray-300 rounded"></div>
                      )}
                <div>
                        <span className="font-medium text-gray-900">{cart.customer_name || cart.customer_email}</span>
                        <p className="text-sm text-gray-500">{cart.customer_email}</p>
                </div>
                    </button>
                </div>
                ))}
                {abandonedCarts.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No abandoned carts found.
                </div>
                )}
              </div>
            </div>
          )}
          {/* Existing specific_customers UI remains unchanged */}

          {campaign.targetAudience.type === 'specific_customers' && (
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-green-900">Customer Selection</h4>
                <span className="text-sm text-green-600">
                  {selectedCustomers.length} of {customers.length} customers selected
                </span>
              </div>

              {customersLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading customers...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Select All Button */}
                  <div className="flex items-center p-3 bg-white rounded-lg border">
                    <button
                      onClick={handleSelectAllCustomers}
                      className="flex items-center space-x-3 text-left w-full"
                    >
                      {selectedCustomers.length === abandonedCarts.length && abandonedCarts.length > 0 ? (
                        <CheckSquare className="h-5 w-5 text-green-600" />
                      ) : (
                        <div className="h-5 w-5 border-2 border-gray-300 rounded"></div>
                      )}
                      <div>
                        <span className="font-medium text-gray-900">
                          {selectedCustomers.length === abandonedCarts.length && abandonedCarts.length > 0 ? 'Deselect All' : 'Select All'}
                        </span>
                        <p className="text-sm text-gray-500">
                          {selectedCustomers.length === abandonedCarts.length && abandonedCarts.length > 0 
                            ? 'Uncheck all customers' 
                            : `Select all ${abandonedCarts.length} customers`
                          }
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Customer List */}
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {abandonedCarts.map((customer) => (
                      <div key={`${customer.cart_id}-${customer.customer_email}`} className="flex items-center p-3 bg-white rounded-lg border">
                        <button
                          onClick={() => handleCustomerSelection(customer.customer_email)}
                          className="flex items-center space-x-3 text-left w-full"
                        >
                          {selectedCustomers.includes(customer.customer_email) ? (
                            <Check className="h-5 w-5 text-green-600" />
                          ) : (
                            <div className="h-5 w-5 border-2 border-gray-300 rounded"></div>
                          )}
                          <div>
                            <span className="font-medium text-gray-900">{customer.customer_name || customer.customer_email}</span>
                            <p className="text-sm text-gray-500">{customer.customer_email}</p>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>

                  {abandonedCarts.length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      No customers found. Please check your store connection.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Email Template</h3>
        {/* Template Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Choose Template
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  campaign.content.template === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <h4 className="font-medium text-gray-900 mb-2">{template.name}</h4>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {template.subject || 'Custom template'}
                </p>
                <div className="mt-2 text-xs text-gray-500 whitespace-pre-line">
                  {template.body}
                </div>
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
              value={campaign.content.subject}
              onChange={(e) => handleInputChange('content.subject', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter email subject"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Email Body *
              </label>
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {previewMode ? 'Edit' : 'Preview'}
              </button>
            </div>
            {previewMode ? (
              <div className="border border-gray-300 rounded-md p-4 bg-white">
                <div className="prose max-w-none">
                  <h4 className="font-medium text-gray-900 mb-2">Preview:</h4>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {campaign.content.body}
                  </div>
                </div>
              </div>
            ) : (
              <textarea
                value={campaign.content.body}
                onChange={(e) => handleInputChange('content.body', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="8"
                placeholder="Enter email content"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Schedule & Send</h3>
        <div className="space-y-4">
          {/* Delay Dropdown for Abandoned Cart Campaigns */}
          {campaign.targetAudience.type === 'abandoned_carts' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send Delay
              </label>
              <select
                value={campaign.schedule.delay !== undefined ? campaign.schedule.delay : 0}
                onChange={e => handleInputChange('schedule.delay', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {delayOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date *
            </label>
            <input
              type="date"
              value={campaign.schedule.startDate}
              onChange={(e) => handleInputChange('schedule.startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          {/* Remove Time of Day input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frequency
            </label>
            <select
              value={campaign.schedule.frequency || 'once'}
              onChange={e => handleInputChange('schedule.frequency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      </div>
      {/* Campaign Summary */}
      <div className="bg-gray-50 p-4 rounded-lg mt-6">
        <h4 className="font-medium text-gray-900 mb-2">Campaign Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div><span className="font-semibold">Name:</span> {campaign.name}</div>
          <div><span className="font-semibold">Type:</span> {campaign.type}</div>
          <div>
            <span className="font-semibold">Target:</span> {
              campaign.targetAudience.type === 'abandoned_carts'
                ? (selectedCustomers.length > 0 ? `${selectedCustomers.length} customers` : `${abandonedCarts.length} customers`)
                : campaign.targetAudience.type === 'specific_customers'
                  ? `${selectedCustomers.length} customers`
                  : 'All customers'
            }
          </div>
          <div><span className="font-semibold">Subject:</span> {campaign.content.subject}</div>
          <div><span className="font-semibold">Start Date:</span> {campaign.schedule.startDate ? new Date(campaign.schedule.startDate).toLocaleDateString() : ''}</div>
        </div>
      </div>
    </div>
  );

  const delayOptions = [
    { label: 'Immediately', value: 0 },
    { label: '12 hours after abandonment', value: 12 },
    { label: '24 hours after abandonment', value: 24 },
    { label: '48 hours after abandonment', value: 48 },
    { label: '72 hours after abandonment', value: 72 },
    { label: '5 days after abandonment', value: 120 },
    { label: '1 week after abandonment', value: 168 }
  ];

  const steps = [
    { number: 1, title: 'Campaign Details', icon: Edit3 },
    { number: 2, title: 'Target Audience', icon: Target },
    { number: 3, title: 'Email Template', icon: Mail },
    { number: 4, title: 'Schedule & Send', icon: Calendar }
  ];

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
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <Mail className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Create New Campaign</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              {steps.map((stepItem, index) => (
                <div key={stepItem.number} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    step >= stepItem.number ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step > stepItem.number ? (
                      <span>✓</span>
                    ) : (
                      stepItem.number
                    )}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    step >= stepItem.number ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {stepItem.title}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-4 ${
                      step > stepItem.number ? 'bg-blue-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <button
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              
              {step < 4 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!campaign.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleCreateCampaign}
                  disabled={loading || !campaign.name || !campaign.content.subject || !campaign.content.body}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Create Campaign</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignCreator; 