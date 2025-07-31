import React, { useState } from 'react';
import api from '../../utils/api';

const TestSubscription = () => {
  const [planKey, setPlanKey] = useState('starter');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleUpdateSubscription = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await api.post('/api/subscribe/manual-update', { planKey });
      setResult(response.data);
      console.log('Subscription updated:', response.data);
    } catch (error) {
      setResult({ error: error.response?.data?.error || error.message });
      console.error('Error updating subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Test Subscription Update</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Plan Key
          </label>
          <select
            value={planKey}
            onChange={(e) => setPlanKey(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        
        <button
          onClick={handleUpdateSubscription}
          disabled={loading}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update Subscription'}
        </button>
        
        {result && (
          <div className="mt-4 p-3 rounded-md bg-gray-100">
            <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestSubscription; 