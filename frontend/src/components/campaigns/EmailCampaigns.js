import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import config from '../../config';

const EmailCampaigns = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const platform = localStorage.getItem('platform') || 'woocommerce';

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/api/email/sent-emails', {
          params: { platform }
        });
        setEmails(response.data);
      } catch (err) {
        console.error('Error fetching emails:', err);
        setError('Failed to fetch sent emails. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchEmails();
  }, [platform]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Sent Emails</h1>
      <div className="mt-4">
        {loading ? (
          <p className="text-gray-600">Loading sent emails...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : emails.length === 0 ? (
          <p className="text-gray-600">No sent emails found for this platform.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded shadow">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Recipient</th>
                  <th className="px-4 py-2 text-left">Subject</th>
                  <th className="px-4 py-2 text-left">Sent At</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Campaign</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email) => (
                  <tr key={email._id} className="border-t">
                    <td className="px-4 py-2">{email.to}</td>
                    <td className="px-4 py-2">{email.subject}</td>
                    <td className="px-4 py-2">{new Date(email.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        email.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                        email.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        email.status === 'opened' ? 'bg-purple-100 text-purple-800' :
                        email.status === 'clicked' ? 'bg-indigo-100 text-indigo-800' :
                        email.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {email.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {email.campaign_id ? (
                        <span className="text-blue-600">Campaign #{email.campaign_id}</span>
                      ) : (
                        <span className="text-gray-400">Manual</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailCampaigns; 