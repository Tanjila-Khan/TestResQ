import React, { useState } from 'react';
import { Plus, Edit, Play, Pause, Trash2, Send } from 'lucide-react';
import CampaignCreator from './CampaignCreator';
import QuickSendModal from './QuickSendModal';
import api from '../../utils/api';

const CampaignsTable = ({ campaigns = [], onEdit, onCampaignCreated }) => {
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [isQuickSendOpen, setIsQuickSendOpen] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [pausingId, setPausingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingCampaign, setEditingCampaign] = useState(null);

  // Open the campaign creator modal
  const handleOpenCreator = () => {
    setIsCreatorOpen(true);
    setError(null);
    setSuccess(null);
  };

  // Send campaign to abandoned carts
  const handleSend = async (campaign) => {
    setSendingId(campaign._id);
    setError(null);
    setSuccess(null);
    try {
      // For now, only support abandoned cart campaigns
      if (campaign.targetAudience?.type !== 'abandoned_carts') {
        setError('Only abandoned cart campaigns can be sent automatically.');
        setSendingId(null);
        return;
      }
      const res = await api.post('/api/campaigns/send-to-abandoned-carts', {
        campaignId: campaign._id,
        platform: campaign.platform,
        storeId: campaign.storeId,
        subject: campaign.content.subject,
        htmlContent: campaign.content.body,
        filters: campaign.targetAudience.filters || {}
      });
      setSuccess('Campaign sent successfully!');
      if (onCampaignCreated) onCampaignCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to send campaign.');
    } finally {
      setSendingId(null);
    }
  };

  // Play/resume campaign
  const handlePlay = async (campaign) => {
    setPausingId(campaign._id);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.patch(`/api/campaigns/${campaign._id}/play`);
      setSuccess('Campaign resumed.');
      if (onCampaignCreated) {
        onCampaignCreated({ ...campaign, status: 'scheduled' });
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to resume campaign.');
    } finally {
      setPausingId(null);
    }
  };

  // Pause campaign
  const handlePause = async (campaign) => {
    setPausingId(campaign._id);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.patch(`/api/campaigns/${campaign._id}/pause`);
      setSuccess('Campaign paused.');
      if (onCampaignCreated) {
        onCampaignCreated({ ...campaign, status: 'paused' });
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to pause campaign.');
    } finally {
      setPausingId(null);
    }
  };

  // Send now
  const handleSendNow = async (campaign) => {
    setSendingId(campaign._id);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post(`/api/campaigns/${campaign._id}/send-now`);
      setSuccess('Campaign sent immediately.');
      if (onCampaignCreated) {
        onCampaignCreated({ ...campaign, status: 'sent' });
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to send campaign now.');
    } finally {
      setSendingId(null);
    }
  };

  // Delete campaign
  const handleDelete = async (campaign) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    setDeletingId(campaign._id);
    setError(null);
    setSuccess(null);
    try {
      console.log('Deleting campaign:', campaign._id);
      await api.delete(`/api/campaigns/${campaign._id}`);
      console.log('Campaign deleted successfully');
      setSuccess('Campaign deleted.');
      // Remove the campaign from the list
      if (onCampaignCreated) {
        onCampaignCreated({ ...campaign, deleted: true });
      }
    } catch (err) {
      console.error('Error deleting campaign:', err);
      setError(err.response?.data?.error || err.message || 'Failed to delete campaign.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancel = async (campaign) => {
    setPausingId(campaign._id);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.put(`/api/campaigns/${campaign._id}`, { status: 'cancelled' });
      setSuccess('Campaign cancelled.');
      if (onCampaignCreated) {
        onCampaignCreated({ ...campaign, status: 'cancelled' });
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to cancel campaign.');
    } finally {
      setPausingId(null);
    }
  };

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Active Campaigns</h3>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsQuickSendOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>Send to All Abandoned Carts</span>
            </button>
            <button 
              onClick={handleOpenCreator}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create Campaign</span>
            </button>
          </div>
        </div>
        <div className="p-8 text-center text-gray-500">
          <p className="mb-4">No active campaigns found. Create a new campaign to get started.</p>
        </div>
        <CampaignCreator
          isOpen={isCreatorOpen}
          onClose={() => setIsCreatorOpen(false)}
          onCampaignCreated={onCampaignCreated}
        />
        <QuickSendModal
          isOpen={isQuickSendOpen}
          onClose={() => setIsQuickSendOpen(false)}
          onSent={onCampaignCreated}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="text-lg font-semibold">Active Campaigns</h3>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setIsQuickSendOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center space-x-2"
          >
            <Send className="h-4 w-4" />
            <span>Send to All</span>
          </button>
          <button 
            onClick={handleOpenCreator}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>
      {error && <div className="p-4 bg-red-50 text-red-700">{error}</div>}
      {success && <div className="p-4 bg-green-50 text-green-700">{success}</div>}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-4 font-medium text-gray-500">Campaign</th>
              <th className="text-left p-4 font-medium text-gray-500">Status</th>
              <th className="text-left p-4 font-medium text-gray-500">Created</th>
              <th className="text-left p-4 font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(campaign => (
              <tr key={campaign._id || campaign.id} className="border-t">
                <td className="p-4 font-medium">{campaign.name}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                    campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                    campaign.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    campaign.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {campaign.status?.charAt(0).toUpperCase() + campaign.status?.slice(1)}
                  </span>
                </td>
                <td className="p-4">{campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : ''}</td>
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    {campaign.status === 'scheduled' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingCampaign(campaign)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center space-x-1"
                        >
                          <Edit className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePause(campaign)}
                          disabled={pausingId === campaign._id}
                          className="text-yellow-600 hover:text-yellow-800 font-medium text-sm flex items-center space-x-1 disabled:opacity-50"
                        >
                          {pausingId === campaign._id ? <span>Pausing...</span> : <><Pause className="h-3 w-3" /><span>Pause</span></>}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendNow(campaign)}
                          disabled={sendingId === campaign._id}
                          className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center space-x-1 disabled:opacity-50"
                        >
                          {sendingId === campaign._id ? <span>Sending...</span> : <><Send className="h-3 w-3" /><span>Send Now</span></>}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(campaign)}
                          disabled={pausingId === campaign._id}
                          className="text-red-600 hover:text-red-800 font-medium text-sm flex items-center space-x-1 disabled:opacity-50"
                        >
                          {pausingId === campaign._id ? <span>Cancelling...</span> : <><Trash2 className="h-3 w-3" /><span>Cancel</span></>}
                        </button>
                      </>
                    ) : campaign.status === 'paused' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePlay(campaign)}
                          disabled={pausingId === campaign._id}
                          className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center space-x-1 disabled:opacity-50"
                        >
                          {pausingId === campaign._id ? <span>Resuming...</span> : <><Play className="h-3 w-3" /><span>Play</span></>}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendNow(campaign)}
                          disabled={sendingId === campaign._id}
                          className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center space-x-1 disabled:opacity-50"
                        >
                          {sendingId === campaign._id ? <span>Sending...</span> : <><Send className="h-3 w-3" /><span>Send Now</span></>}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(campaign)}
                          disabled={pausingId === campaign._id}
                          className="text-red-600 hover:text-red-800 font-medium text-sm flex items-center space-x-1 disabled:opacity-50"
                        >
                          {pausingId === campaign._id ? <span>Cancelling...</span> : <><Trash2 className="h-3 w-3" /><span>Cancel</span></>}
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          type="button"
                          onClick={() => onEdit && onEdit(campaign)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center space-x-1"
                        >
                          <Edit className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        {campaign.status === 'active' ? (
                          <button 
                            type="button"
                            onClick={() => handlePause(campaign)}
                            disabled={pausingId === campaign._id}
                            className="text-yellow-600 hover:text-yellow-800 font-medium text-sm flex items-center space-x-1 disabled:opacity-50"
                          >
                            {pausingId === campaign._id ? <span>Pausing...</span> : <><Pause className="h-3 w-3" /><span>Pause</span></>}
                          </button>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => handlePlay(campaign)}
                            disabled={pausingId === campaign._id}
                            className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center space-x-1 disabled:opacity-50"
                          >
                            {pausingId === campaign._id ? <span>Starting...</span> : <><Play className="h-3 w-3" /><span>Play</span></>}
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => handleDelete(campaign)}
                          disabled={deletingId === campaign._id}
                          className="text-red-600 hover:text-red-800 font-medium text-sm flex items-center space-x-1 disabled:opacity-50"
                        >
                          {deletingId === campaign._id ? <span>Deleting...</span> : <><Trash2 className="h-3 w-3" /><span>Delete</span></>}
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleSend(campaign)}
                          disabled={sendingId === campaign._id}
                          className="text-green-600 hover:text-green-800 font-medium text-sm flex items-center space-x-1 disabled:opacity-50"
                        >
                          {sendingId === campaign._id ? <span>Sending...</span> : <><Send className="h-3 w-3" /><span>Send</span></>}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CampaignCreator
        isOpen={!!editingCampaign || isCreatorOpen}
        onClose={() => { setEditingCampaign(null); setIsCreatorOpen(false); }}
        onCampaignCreated={onCampaignCreated}
        {...(editingCampaign ? { campaign: editingCampaign } : {})}
      />
      <QuickSendModal
        isOpen={isQuickSendOpen}
        onClose={() => setIsQuickSendOpen(false)}
        onSent={onCampaignCreated}
      />
    </div>
  );
};

export default CampaignsTable; 