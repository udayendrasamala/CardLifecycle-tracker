// src/context/WebSocketContext.js - Real-time WebSocket connection
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import toast from 'react-hot-toast';

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (socket?.connected) return;

    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8080';
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    
    setConnectionStatus('connecting');

    // For this implementation, we'll use native WebSocket since the backend uses ws library
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      setReconnectAttempts(0);
      
      toast.success('Real-time updates connected', {
        id: 'websocket-connected',
        duration: 2000,
      });
    };

    newSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 WebSocket message:', message);
        
        setLastMessage(message);
        handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    newSocket.onclose = (event) => {
      console.log('🔌 WebSocket disconnected:', event.code, event.reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      // Attempt reconnection if it wasn't a manual close
      if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
        setConnectionStatus('reconnecting');
        setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect();
        }, reconnectDelay);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        toast.error('Unable to connect to real-time updates', {
          id: 'websocket-failed',
        });
      }
    };

    newSocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setConnectionStatus('error');
    };

    setSocket(newSocket);
  }, [reconnectAttempts]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socket) {
      socket.close(1000, 'Manual disconnect');
      setSocket(null);
    }
  }, [socket]);

  // Handle incoming messages
  const handleMessage = useCallback((message) => {
    const { type, data, timestamp } = message;
    
    // Add to notifications list
    const notification = {
      id: Date.now(),
      type,
      data,
      timestamp: new Date(timestamp),
      read: false,
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50

    // Handle specific message types
    switch (type) {
      case 'connection_established':
        console.log('🤝 WebSocket connection established');
        break;
        
      case 'card_created':
        toast.success(`New card created: ${data.cardId}`, {
          id: `card-created-${data.cardId}`,
        });
        break;
        
      case 'status_updated':
        toast(`Card ${data.cardId}: ${data.previousStatus} → ${data.newStatus}`, {
          id: `status-${data.cardId}`,
          icon: '🔄',
        });
        break;
        
      case 'bottleneck_analysis_complete':
        toast.success(`Analysis complete: ${data.stagesAnalyzed} stages analyzed`, {
          id: 'analysis-complete',
        });
        break;
        
      case 'new_insights':
        toast(`${data.count} new insights available`, {
          id: 'new-insights',
          icon: '💡',
        });
        break;
        
      default:
        console.log('Unknown message type:', type);
    }
  }, []);

  // Send message to server
  const sendMessage = useCallback((message) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }, [socket]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Get unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  // Connection status indicator
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'green';
      case 'connecting': return 'yellow';
      case 'reconnecting': return 'orange';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const value = {
    // Connection state
    socket,
    isConnected,
    connectionStatus,
    reconnectAttempts,
    
    // Connection methods
    connect,
    disconnect,
    sendMessage,
    
    // Messages and notifications
    lastMessage,
    notifications,
    unreadCount,
    markAsRead,
    clearNotifications,
    
    // Utilities
    getStatusColor,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};