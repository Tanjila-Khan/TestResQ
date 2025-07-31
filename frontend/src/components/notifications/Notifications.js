import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { format } from 'date-fns';
import config from '../../config';
import { getCurrentPlatform } from '../../utils/platformUtils';

const Notifications = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const platform = getCurrentPlatform(location.search);
  const notificationId = new URLSearchParams(location.search).get('notificationId');

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/notifications', {
          params: { platform }
        });
        setNotifications(response.data.notifications);
        
        // If notificationId is provided, find and select that notification
        if (notificationId) {
          const notification = response.data.notifications.find(n => n._id === notificationId);
          if (notification) {
            setSelectedNotification(notification);
            // Mark as read if not already read
            if (!notification.read) {
              await api.post(
                '/api/notifications/mark-read',
                { notificationIds: [notificationId] },
                { params: { platform } }
              );
            }
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [platform, notificationId]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'cart_abandoned':
        return '🛒';
      case 'sms_sent':
      case 'sms_failed':
        return '📱';
      case 'email_sent':
      case 'email_failed':
        return '📧';
      case 'whatsapp_sent':
      case 'whatsapp_failed':
        return '💬';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type) => {
    if (type.includes('failed')) return 'bg-red-50 border-red-200';
    if (type.includes('sent')) return 'bg-green-50 border-green-200';
    return 'bg-blue-50 border-blue-200';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading notifications: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Notifications List */}
        <div className="md:col-span-1 space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification._id}
              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                selectedNotification?._id === notification._id
                  ? 'ring-2 ring-blue-500'
                  : 'hover:bg-gray-50'
              } ${getNotificationColor(notification.type)}`}
              onClick={() => setSelectedNotification(notification)}
            >
              <div className="flex items-start space-x-3">
                <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {notification.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                  </p>
                  {notification.zone && notification.zone.country && notification.zone.country !== 'Unknown' && (
                    <div className="mt-1 flex items-center space-x-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {notification.zone.city}, {notification.zone.country}
                      </span>
                    </div>
                  )}
                </div>
                {!notification.read && (
                  <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Notification Details */}
        <div className="md:col-span-2">
          {selectedNotification ? (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center space-x-3 mb-4">
                <span className="text-3xl">{getNotificationIcon(selectedNotification.type)}</span>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedNotification.title}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {format(new Date(selectedNotification.createdAt), 'MMMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
              <div className="prose max-w-none">
                <p className="text-gray-700">{selectedNotification.message}</p>
                {selectedNotification.data && (
                  <div className="mt-4 space-y-2">
                                    {Object.entries(selectedNotification.data).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="font-medium text-gray-700 w-32">{key}:</span>
                    <span className="text-gray-600">
                      {key === 'timestamp' && typeof value === 'string' 
                        ? format(new Date(value), 'MMM d, yyyy h:mm a')
                        : JSON.stringify(value)
                      }
                    </span>
                  </div>
                ))}
                {selectedNotification.zone && selectedNotification.zone.country && selectedNotification.zone.country !== 'Unknown' && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <h3 className="font-medium text-green-800 mb-2">Customer Location</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex">
                        <span className="font-medium text-green-700 w-20">City:</span>
                        <span className="text-green-600">{selectedNotification.zone.city}</span>
                      </div>
                      <div className="flex">
                        <span className="font-medium text-green-700 w-20">Region:</span>
                        <span className="text-green-600">{selectedNotification.zone.region}</span>
                      </div>
                      <div className="flex">
                        <span className="font-medium text-green-700 w-20">Country:</span>
                        <span className="text-green-600">{selectedNotification.zone.country}</span>
                      </div>
                      <div className="flex">
                        <span className="font-medium text-green-700 w-20">Timezone:</span>
                        <span className="text-green-600">{selectedNotification.zone.timezone}</span>
                      </div>
                    </div>
                  </div>
                )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border p-6 text-center text-gray-500">
              Select a notification to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications; 