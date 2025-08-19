// src/components/Layout/NotificationPanel.js - Real-time Notifications
import React, { useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { X, Package, RefreshCw, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';

const NotificationPanel = ({ onClose }) => {
  const { notifications, markAsRead, clearNotifications } = useWebSocket();
  const panelRef = useRef(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'card_created':
        return <Package className="w-5 h-5 text-blue-600" />;
      case 'status_updated':
        return <RefreshCw className="w-5 h-5 text-green-600" />;
      case 'bottleneck_analysis_complete':
        return <TrendingUp className="w-5 h-5 text-purple-600" />;
      case 'new_insights':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'connection_established':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationTitle = (type, data) => {
    switch (type) {
      case 'card_created':
        return `New Card Created`;
      case 'status_updated':
        return `Card Status Updated`;
      case 'bottleneck_analysis_complete':
        return `Analysis Complete`;
      case 'new_insights':
        return `New Insights Available`;
      case 'connection_established':
        return `Connected to Live Updates`;
      default:
        return 'Notification';
    }
  };

  const getNotificationMessage = (type, data) => {
    switch (type) {
      case 'card_created':
        return `Card ${data.cardId} created with ${data.priority} priority`;
      case 'status_updated':
        return `${data.cardId}: ${data.previousStatus} → ${data.newStatus}`;
      case 'bottleneck_analysis_complete':
        return `${data.stagesAnalyzed} stages analyzed, ${data.criticalStages} critical issues found`;
      case 'new_insights':
        return `${data.count} new recommendations available`;
      case 'connection_established':
        return 'Real-time updates are now active';
      default:
        return JSON.stringify(data);
    }
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    
    // Navigate to relevant page based on notification type
    switch (notification.type) {
      case 'card_created':
      case 'status_updated':
        // Could navigate to card details or search
        break;
      case 'bottleneck_analysis_complete':
      case 'new_insights':
        // Could navigate to analytics page
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-12 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
        <div className="flex items-center space-x-2">
          {notifications.length > 0 && (
            <button
              onClick={clearNotifications}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No notifications yet</p>
            <p className="text-sm">Live updates will appear here</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                !notification.read ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {getNotificationTitle(notification.type, notification.data)}
                    </p>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {getNotificationMessage(notification.type, notification.data)}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Showing {notifications.length} recent notifications
          </p>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;