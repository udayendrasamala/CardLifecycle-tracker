// src/components/Layout/Layout.js - Main Layout Component
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, BarChart3, Search, Activity, Bell, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';
import NotificationPanel from './NotificationPanel';

const Layout = ({ children }) => {
  const location = useLocation();
  const { isConnected, unreadCount, connectionStatus } = useWebSocket();
  const [showNotifications, setShowNotifications] = useState(false);

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: BarChart3,
      current: location.pathname === '/' || location.pathname === '/dashboard'
    },
    {
      name: 'Track Card',
      href: '/search',
      icon: Search,
      current: location.pathname === '/search'
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: Activity,
      current: location.pathname === '/analytics'
    },
    {
      name: 'Operations',
      href: '/operations',
      icon: Package,
      current: location.pathname === '/operations'
    }
  ];

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'reconnecting': return 'text-orange-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo and Title */}
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center mr-3">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Card Journey Tracker</h1>
                <div className="flex items-center text-sm text-gray-500">
                  <span>Live tracking</span>
                  <span className="mx-2">•</span>
                  <span>{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <Wifi className={`w-5 h-5 ${getConnectionStatusColor()}`} />
                ) : (
                  <WifiOff className={`w-5 h-5 ${getConnectionStatusColor()}`} />
                )}
                <span className={`text-sm font-medium ${getConnectionStatusColor()}`}>
                  {connectionStatus === 'connected' && 'Live'}
                  {connectionStatus === 'connecting' && 'Connecting...'}
                  {connectionStatus === 'reconnecting' && 'Reconnecting...'}
                  {connectionStatus === 'error' && 'Disconnected'}
                  {connectionStatus === 'disconnected' && 'Offline'}
                </span>
              </div>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Panel */}
                {showNotifications && (
                  <NotificationPanel
                    onClose={() => setShowNotifications(false)}
                  />
                )}
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => window.location.reload()}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Refresh Dashboard"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-2 py-3">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    item.current
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Connection Banner */}
      {!isConnected && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <WifiOff className="w-4 h-4 text-yellow-600 mr-2" />
                <span className="text-sm text-yellow-800">
                  Real-time updates unavailable. Data may not be current.
                </span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-yellow-700 hover:text-yellow-900 font-medium"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              © 2025 Card Journey Tracker. All rights reserved.
            </div>
            <div className="flex items-center space-x-4">
              <span>API Status: {isConnected ? 'Connected' : 'Disconnected'}</span>
              <span>•</span>
              <span>v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;