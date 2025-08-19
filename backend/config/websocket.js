// config/websocket.js - WebSocket configuration
const WebSocket = require('ws');

let wss;
const connectedClients = new Set();

const initializeWebSocket = () => {
  wss = new WebSocket.Server({ 
    port: process.env.WS_PORT || 8080,
    perMessageDeflate: false 
  });

  wss.on('connection', (ws, req) => {
    connectedClients.add(ws);
    console.log(`📱 Client connected. Total: ${connectedClients.size}`);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection_established',
      timestamp: new Date().toISOString(),
      message: 'Connected to Card Journey Tracker'
    }));

    ws.on('close', () => {
      connectedClients.delete(ws);
      console.log(`📱 Client disconnected. Total: ${connectedClients.size}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      connectedClients.delete(ws);
    });

    // Handle ping/pong for connection health
    ws.on('ping', () => {
      ws.pong();
    });
  });

  // Cleanup disconnected clients periodically
  setInterval(() => {
    connectedClients.forEach(client => {
      if (client.readyState !== WebSocket.OPEN) {
        connectedClients.delete(client);
      }
    });
  }, 30000); // Every 30 seconds

  return wss;
};

const broadcast = (type, data) => {
  const message = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString()
  });

  let sentCount = 0;
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
        sentCount++;
      } catch (error) {
        console.error('Broadcast error:', error);
        connectedClients.delete(client);
      }
    }
  });

  console.log(`📡 Broadcasted ${type} to ${sentCount} clients`);
};

module.exports = { initializeWebSocket, broadcast };