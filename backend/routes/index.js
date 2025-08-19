// routes/index.js - Main router
const express = require('express');
const cardRoutes = require('./cards');
const analyticsRoutes = require('./analytics');
const { healthCheck } = require('../middleware');

const router = express.Router();

// API version 1 routes
router.use('/v1/cards', cardRoutes);
router.use('/v1/analytics', analyticsRoutes);

// Health check endpoint
router.get('/health', healthCheck);

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    name: 'Card Journey Tracker API',
    version: '1.0.0',
    description: 'Complete card lifecycle tracking and analytics API',
    endpoints: {
      cards: {
        'POST /api/v1/cards': 'Create new card journey',
        'POST /api/v1/cards/:cardId/status': 'Update card status (webhook)',
        'GET /api/v1/cards/search?q=': 'Search cards by identifier',
        'GET /api/v1/cards/:cardId': 'Get specific card details'
      },
      analytics: {
        'GET /api/v1/analytics/dashboard': 'Get dashboard metrics',
        'GET /api/v1/analytics/bottlenecks': 'Get current bottlenecks',
        'GET /api/v1/analytics/trends': 'Get performance trends',
        'POST /api/v1/analytics/analyze': 'Trigger manual analysis',
        'GET /api/v1/analytics/insights': 'Get AI-generated insights'
      },
      system: {
        'GET /api/health': 'System health check',
        'GET /api/docs': 'API documentation'
      }
    },
    websocket: {
      url: `ws://localhost:${process.env.WS_PORT || 8080}`,
      events: [
        'connection_established',
        'card_created',
        'status_updated', 
        'bottleneck_analysis_complete',
        'new_insights'
      ]
    },
    authentication: {
      webhook_endpoints: 'Require X-API-Key header',
      rate_limiting: '100 requests per 15 minutes per IP'
    }
  });
});

// Metrics endpoint (for monitoring tools)
router.get('/metrics', async (req, res) => {
  const CardJourney = require('../models/CardJourney');
  
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const metrics = await CardJourney.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          last24h: [
            { $match: { createdAt: { $gte: last24h } } },
            { $count: "count" }
          ],
          statusBreakdown: [
            { $group: { _id: "$currentStatus", count: { $sum: 1 } } }
          ],
          priorityBreakdown: [
            { $group: { _id: "$priority", count: { $sum: 1 } } }
          ]
        }
      }
    ]);
    
    res.json({
      timestamp: now.toISOString(),
      cards: {
        total: metrics[0].total[0]?.count || 0,
        last24h: metrics[0].last24h[0]?.count || 0,
        byStatus: metrics[0].statusBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byPriority: metrics[0].priorityBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate metrics',
      requestId: req.requestId
    });
  }
});

// Status endpoint for load balancers
router.get('/status', (req, res) => {
  res.status(200).send('OK');
});

// Catch-all for undefined API routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    requestId: req.requestId
  });
});

module.exports = router;