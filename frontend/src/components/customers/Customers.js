import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import config from '../../config';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
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
    if (!currentPlatform) return;

    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/api/stores/customers/recent', {
          params: { platform: currentPlatform }
        });
        setCustomers(response.data || []);
      } catch (err) {
        console.error('Error fetching customers:', err);
        setError('Failed to fetch customers. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [currentPlatform]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading customers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg p-12 text-center">
          <div className="text-red-600 mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Customers</h3>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Customers</h1>
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Phone</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Company</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Registered</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No customers found for this platform.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer._id} className="border-t">
                    <td className="px-4 py-2">
                      {customer.first_name} {customer.last_name}
                    </td>
                    <td className="px-4 py-2">{customer.customer_email}</td>
                    <td className="px-4 py-2">{customer.phone || '-'}</td>
                    <td className="px-4 py-2">{customer.company || '-'}</td>
                    <td className="px-4 py-2">
                      {customer.is_registered ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2">
                      {customer.last_login ? new Date(customer.last_login).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Customers; 