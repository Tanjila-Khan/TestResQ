import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { io } from 'socket.io-client';
import api from '../../utils/api';
import { format } from 'date-fns';
import config from '../../config';

const NotificationBell = ({ platform }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showOnlyNewCarts, setShowOnlyNewCarts] = useState(false);
  const dropdownRef = useRef(null);
  const socketRef = useRef(null);
  const hasReceivedTestNotification = useRef(false);
  const isInitialized = useRef(false);
  const notificationIds = useRef(new Set());
  const refreshTimeoutRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (isInitialized.current) {
      return; // Prevent multiple initializations
    }
    
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 1000;
    const maxReconnectDelay = 10000;

    const connectSocket = () => {
      try {
        console.log('Initializing socket connection...');
        const socketUrl = config.apiBaseUrl;
        console.log('Connecting to socket server:', socketUrl);
        
        // Clean up existing socket if any
        if (socketRef.current) {
          console.log('Cleaning up existing socket connection...');
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
        }

        socketRef.current = io(socketUrl, {
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: reconnectDelay,
          reconnectionDelayMax: maxReconnectDelay,
          timeout: 20000,
          autoConnect: true,
          transports: ['polling', 'websocket'],
          forceNew: true,
          path: '/socket.io/',
          query: { 
            platform,
            skipTestNotification: hasReceivedTestNotification.current
          }
        });

        // Join platform-specific room
        const joinRoom = () => {
          if (socketRef.current?.connected) {
            console.log('Joining platform room:', platform);
            socketRef.current.emit('join-platform', platform);
          }
        };

        // Listen for new notifications
        socketRef.current.on('notification', (data) => {
          console.log('Received notification event:', data);
          
          if (data.type === 'new') {
            const notification = data.notification;
            
            // Skip test notifications if we've already received one
            if (notification.type === 'connection_test') {
              if (hasReceivedTestNotification.current) {
                console.log('Skipping duplicate test notification');
                return;
              }
              hasReceivedTestNotification.current = true;
            }

            // Check if notification already exists
            if (notificationIds.current.has(notification._id)) {
              console.log('Notification already exists, skipping:', notification._id);
              return;
            }

            console.log('New notification received:', notification);
            setNotifications(prev => {
              const exists = prev.some(n => n._id === notification._id);
              if (exists) {
                console.log('Notification already in state, skipping:', notification._id);
                return prev;
              }
              notificationIds.current.add(notification._id);
              return [notification, ...prev];
            });
            setUnreadCount(prev => prev + 1);
          } else if (data.type === 'read') {
            console.log('Notification marked as read:', data.notificationIds);
            setNotifications(prev =>
              prev.map(notif =>
                data.notificationIds.includes(notif._id) ? { ...notif, read: true } : notif
              )
            );
            setUnreadCount(prev => Math.max(0, prev - data.notificationIds.length));
          } else if (data.type === 'delete') {
            console.log('Notifications deleted:', data.notificationIds);
            setNotifications(prev => {
              const filtered = prev.filter(notif => !data.notificationIds.includes(notif._id));
              // Remove deleted notification IDs from our tracking set
              data.notificationIds.forEach(id => notificationIds.current.delete(id));
              return filtered;
            });
            setUnreadCount(prev =>
              Math.max(0, prev - data.notificationIds.filter(id =>
                notifications.find(n => n._id === id && !n.read)
              ).length)
            );
          }
        });

        socketRef.current.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          reconnectAttempts++;
          
          if (reconnectAttempts >= maxReconnectAttempts) {
            console.error('Max reconnection attempts reached, falling back to polling');
            socketRef.current.io.opts.transports = ['polling'];
          }
        });

        socketRef.current.on('connect', () => {
          console.log('Socket connected successfully');
          reconnectAttempts = 0;
          joinRoom();
        });

        socketRef.current.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          if (reason === 'io server disconnect' || reason === 'transport close') {
            setTimeout(() => {
              if (socketRef.current) {
                console.log('Attempting to reconnect...');
                socketRef.current.connect();
              }
            }, reconnectDelay * Math.min(reconnectAttempts + 1, 5));
          }
        });

        socketRef.current.on('reconnect', (attemptNumber) => {
          console.log('Socket reconnected after', attemptNumber, 'attempts');
          reconnectAttempts = 0;
          joinRoom();
        });

        socketRef.current.on('reconnect_attempt', (attemptNumber) => {
          console.log('Socket reconnection attempt:', attemptNumber);
          const delay = Math.min(reconnectDelay * Math.pow(2, attemptNumber - 1), maxReconnectDelay);
          socketRef.current.io.opts.reconnectionDelay = delay;
        });

        socketRef.current.on('reconnect_error', (error) => {
          console.error('Socket reconnection error:', error);
        });

        socketRef.current.on('reconnect_failed', () => {
          console.error('Socket reconnection failed after all attempts');
          socketRef.current.io.opts.transports = ['polling'];
        });

        socketRef.current.on('error', (error) => {
          console.error('Socket error:', error);
        });

        joinRoom();
        isInitialized.current = true;

      } catch (error) {
        console.error('Error initializing socket:', error);
      }
    };

    connectSocket();

    return () => {
      console.log('Cleaning up socket connection...');
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      isInitialized.current = false;
    };
  }, [platform]);

  // Fetch notifications
  const fetchNotifications = useCallback(async (pageNum = 1, forceRefresh = false, showOnlyNewCarts = false) => {
    try {
      console.log('Fetching notifications, page:', pageNum, 'forceRefresh:', forceRefresh, 'showOnlyNewCarts:', showOnlyNewCarts);
      setIsLoading(true);
      
      const endpoint = showOnlyNewCarts ? '/api/notifications/new-cart-notifications' : '/api/notifications';
      const params = showOnlyNewCarts ? { platform } : {
          platform,
          page: pageNum,
          limit: 10,
          skipTestNotification: hasReceivedTestNotification.current
      };
      
      const response = await api.get(endpoint, { params });
      
      console.log('Notifications fetched:', response.data);
      
      let newNotifications, pagination;
      if (showOnlyNewCarts) {
        newNotifications = response.data.notifications;
        pagination = { page: 1, pages: 1 }; // No pagination for new cart notifications
      } else {
        newNotifications = response.data.notifications;
        pagination = response.data.pagination;
      }
      
      // Filter out test notifications if we've already received one
      const filteredNotifications = hasReceivedTestNotification.current
        ? newNotifications.filter(n => n.type !== 'connection_test')
        : newNotifications;

      if (pageNum === 1) {
        // Clear existing notification IDs and add new ones
        notificationIds.current.clear();
        filteredNotifications.forEach(n => notificationIds.current.add(n._id));
        
        setNotifications(filteredNotifications);
        if (!hasReceivedTestNotification.current) {
          hasReceivedTestNotification.current = newNotifications.some(n => n.type === 'connection_test');
        }
      } else {
        // For pagination, only add notifications that don't already exist
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n._id));
          const newNotificationsToAdd = filteredNotifications.filter(n => !existingIds.has(n._id));
          newNotificationsToAdd.forEach(n => notificationIds.current.add(n._id));
          return [...prev, ...newNotificationsToAdd];
        });
      }
      
      setHasMore(pageNum < pagination.pages);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [platform]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/api/notifications/unread-count', {
        params: { platform }
      });
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [platform]);

  // Debounced refresh function
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      fetchNotifications(1, false, showOnlyNewCarts);
      fetchUnreadCount();
    }, 1000); // 1 second debounce
  }, [fetchNotifications, fetchUnreadCount, showOnlyNewCarts]);

  // Reset tracking when platform changes
  useEffect(() => {
    notificationIds.current.clear();
    hasReceivedTestNotification.current = false;
    isInitialized.current = false;
  }, [platform]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications(1, false, showOnlyNewCarts);
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount, showOnlyNewCarts]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark notifications as read
  const markAsRead = async (notificationIds) => {
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;

    const attemptMarkAsRead = async () => {
      try {
        // Create a new AbortController for this attempt
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await api.post(
          '/api/notifications/mark-read',
          { notificationIds },
          {
            params: { platform },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (response.status === 200) {
          // Update local state
          setNotifications(prev =>
            prev.map(notif =>
              notificationIds.includes(notif._id) ? { ...notif, read: true } : notif
            )
          );
          setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
          
          // Emit socket event to sync with server
          if (socketRef.current?.connected) {
            socketRef.current.emit('mark-notifications-read', { notificationIds, platform });
          }
          
          console.log('Successfully marked notifications as read:', notificationIds);
          return true;
        }
      } catch (error) {
        lastError = error;
        console.error('Error marking notifications as read:', {
          error: error.message,
          code: error.code,
          notificationIds,
          attempt: retryCount + 1
        });

        // Retry logic for network errors or timeouts
        if (
          (error.code === 'ECONNABORTED' || 
           error.code === 'ERR_NETWORK' || 
           error.name === 'AbortError') &&
          retryCount < maxRetries
        ) {
          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000); // Exponential backoff with max 10s
          console.log(`Retrying mark as read (attempt ${retryCount}/${maxRetries}) in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptMarkAsRead();
        }

        // For other errors or if max retries reached, update UI optimistically
        if (error.response?.status !== 401) { // Don't update UI for auth errors
          setNotifications(prev =>
            prev.map(notif =>
              notificationIds.includes(notif._id) ? { ...notif, read: true } : notif
            )
          );
          setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
        }
      }
      return false;
    };

    // Try to mark as read
    const success = await attemptMarkAsRead();
    
    // If all retries failed, show error to user
    if (!success && lastError) {
      console.error('Failed to mark notifications as read after all retries:', lastError);
      // You might want to show a toast/notification to the user here
    }
  };

  // Delete notifications
  const deleteNotifications = async (notificationIds) => {
    try {
      console.log('Deleting notifications:', notificationIds);
      await api.delete('/api/notifications', {
        data: { notificationIds },
        params: { platform }
      });
      
      setNotifications(prev =>
        prev.filter(notif => !notificationIds.includes(notif._id))
      );
      setUnreadCount(prev =>
        Math.max(0, prev - notificationIds.filter(id =>
          notifications.find(n => n._id === id && !n.read)
        ).length)
      );
      console.log('Notifications deleted successfully');
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  };

  // Delete all notifications
  const deleteAllNotifications = async () => {
    try {
      const allNotificationIds = notifications.map(n => n._id);
      console.log('Deleting all notifications');
      await deleteNotifications(allNotificationIds);
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead([notification._id]);
    }
    // Redirect to notifications component with the specific notification ID
    window.location.href = `/notifications?platform=${platform}&notificationId=${notification._id}`;
  };

  // Load more notifications
  const loadMore = () => {
    if (!isLoading && hasMore && !showOnlyNewCarts) {
      fetchNotifications(page + 1, false, showOnlyNewCarts);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => {
            console.log('Opening notification panel...');
            setIsOpen(!isOpen);
            // Only fetch if opening and we don't have notifications yet
            if (!isOpen && notifications.length === 0) {
              debouncedRefresh();
            }
          }}
          className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        >
          <BellIcon className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg overflow-hidden z-50">
          <div className="p-3 border-b flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-gray-900">Notifications</h3>
              <button
                onClick={() => {
                  setShowOnlyNewCarts(!showOnlyNewCarts);
                  setPage(1);
                  setHasMore(true);
                }}
                className={`text-xs px-2 py-1 rounded ${
                  showOnlyNewCarts 
                    ? 'bg-blue-600 text-white' 
                    : 'text-blue-600 hover:text-blue-800 border border-blue-600'
                }`}
                title={showOnlyNewCarts ? 'Show All Notifications' : 'Show Only New Carts'}
              >
                {showOnlyNewCarts ? 'All' : 'New Carts'}
              </button>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => {
                  console.log('Manual refresh requested');
                  debouncedRefresh();
                }}
                disabled={isLoading}
                className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50"
                title="Refresh notifications"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      const unreadIds = notifications
                        .filter(n => !n.read)
                        .map(n => n._id);
                      if (unreadIds.length > 0) {
                        console.log('Marking all as read:', unreadIds);
                        markAsRead(unreadIds);
                      }
                    }}
                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                    title="Mark all as read"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={deleteAllNotifications}
                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                    title="Clear all notifications"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No notifications
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className="p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          console.log('Notification clicked:', notification);
                          handleNotificationClick(notification);
                        }}
                      >
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 break-words">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {format(new Date(notification.createdAt), 'MMM d, h:mm a')}
                        </p>
                        {notification.zone && notification.zone.country !== 'Unknown' && (
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
                        {notification.data?.test && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                            Test
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-2">
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Deleting notification:', notification._id);
                            deleteNotifications([notification._id]);
                          }}
                          className="text-gray-400 hover:text-red-500 focus:outline-none"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasMore && !showOnlyNewCarts && (
              <div className="p-4 text-center">
                <button
                  onClick={() => {
                    console.log('Loading more notifications...');
                    loadMore();
                  }}
                  disabled={isLoading}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell; 