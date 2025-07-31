import React, { useState, useEffect } from 'react';
import CampaignsTable from './CampaignsTable';
import api from '../../utils/api';

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPlatform, setCurrentPlatform] = useState(null);

  useEffect(() => {
    // Get platform from localStorage and store connection
    const storedPlatform = localStorage.getItem('platform');
    const storeConnection = localStorage.getItem('store_connection');
    
    if (storeConnection) {
      try {
        const connection = JSON.parse(storeConnection);
        setCurrentPlatform(connection.platform);
      } catch (err) {
        console.error('Error parsing store connection:', err);
        setCurrentPlatform(storedPlatform || 'woocommerce');
      }
    } else {
      setCurrentPlatform(storedPlatform || 'woocommerce');
    }
  }, []);

  useEffect(() => {
    if (!currentPlatform) {
      return;
    }

    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const storeId = localStorage.getItem('storeUrl') || 'default';
        const campaignsResponse = await api.get('/api/campaigns', {
          params: { limit: 50, platform: currentPlatform, storeId }
        });
        
        const campaignsData = campaignsResponse.data?.campaigns || campaignsResponse.data || [];
        setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);

      } catch (err) {
        console.error('Error fetching campaigns:', err);
        setError('Failed to fetch campaigns. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [currentPlatform]);

  const handleEditCampaign = (campaign) => {
    window.location.href = `/campaigns/${campaign.id}`;
  };

  const handleCampaignCreated = async (updatedCampaign) => {
    if (updatedCampaign.deleted) {
      // Remove the campaign from the list
      setCampaigns(prev => prev.filter(c => c._id !== updatedCampaign._id));
    } else {
      // Refresh campaigns from server to ensure we have the latest data
      try {
        const storeId = localStorage.getItem('storeUrl') || 'default';
        const campaignsResponse = await api.get('/api/campaigns', {
          params: { limit: 50, platform: currentPlatform, storeId }
        });
        const campaignsData = campaignsResponse.data?.campaigns || campaignsResponse.data || [];
        setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
      } catch (err) {
        console.error('Error refreshing campaigns after creation:', err);
        // Fallback: try to add the new campaign to the existing list
        if (updatedCampaign._id) {
          setCampaigns(prev => {
            const existingIndex = prev.findIndex(c => c._id === updatedCampaign._id);
            if (existingIndex >= 0) {
              // Update existing campaign
              const newList = [...prev];
              newList[existingIndex] = updatedCampaign;
              return newList;
            } else {
              // Add new campaign
              return [updatedCampaign, ...prev];
            }
          });
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Email Campaigns</h1>
        <p className="text-gray-600 mt-2">Manage your email campaigns and track their performance.</p>
      </div>
      
      <CampaignsTable 
        campaigns={campaigns} 
        onEdit={handleEditCampaign}
        onCampaignCreated={handleCampaignCreated}
      />
    </div>
  );
};

export default Campaigns; 