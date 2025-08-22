// routes/analytics.js - Analytics routes
const express = require('express');
const cardService = require('../services/cardService');
const analyticsService = require('../services/analyticsService');
const { asyncHandler } = require('../middleware');

const router = express.Router();

/**
 * GET /api/v1/analytics/dashboard
 * Get comprehensive dashboard analytics
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { timeRange = '24h' } = req.query;
  
  const validTimeRanges = ['1h', '24h', '7d', '30d'];
  if (!validTimeRanges.includes(timeRange)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid time range',
      validRanges: validTimeRanges,
      requestId: req.requestId
    });
  }
  
  const analytics = await cardService.getDashboardAnalytics(timeRange);
  
  res.json({
    success: true,
    data: analytics,
    timeRange,
    generatedAt: new Date().toISOString()
  });
}));

/**
 * GET /api/v1/analytics/bottlenecks
 * Get current bottleneck analysis
 */
router.get('/bottlenecks', asyncHandler(async (req, res) => {
  const { limit = 10, severity } = req.query;
  
  let bottlenecks = await cardService.getCurrentBottlenecks();
  
  // Filter by severity if specified
  if (severity) {
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid severity level',
        validSeverities,
        requestId: req.requestId
      });
    }
    
    bottlenecks = bottlenecks.filter(b => b.severity === severity);
  }
  
  // Apply limit
  bottlenecks = bottlenecks.slice(0, parseInt(limit));
  
  res.json({
    success: true,
    data: bottlenecks,
    count: bottlenecks.length,
    filters: { severity, limit },
    lastAnalyzed: bottlenecks.length > 0 ? bottlenecks[0].createdAt : null
  });
}));

/**
 * GET /api/v1/analytics/trends
 * Get performance trends over time
 */
router.get('/trends', asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  if (parseInt(days) > 365) {
    return res.status(400).json({
      success: false,
      error: 'Maximum period is 365 days',
      requestId: req.requestId
    });
  }
  
  const trends = await analyticsService.getPerformanceTrends(parseInt(days));
  
  res.json({
    success: true,
    data: trends,
    period: `${days} days`,
    generatedAt: new Date().toISOString()
  });
}));

/**
 * POST /api/v1/analytics/analyze
 * Trigger manual bottleneck analysis
 */
router.post('/analyze', asyncHandler(async (req, res) => {
  const analysis = await analyticsService.analyzeBottlenecks();
  
  res.json({
    success: true,
    message: 'Bottleneck analysis completed successfully',
    data: analysis,
    analyzedStages: analysis.length,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /api/v1/analytics/insights
 * Get AI-generated insights and recommendations
 */
router.get('/insights', asyncHandler(async (req, res) => {
  const { timeRange = '7d', limit = 10 } = req.query;
  
  const insights = await analyticsService.generateInsights(timeRange);
  
  res.json({
    success: true,
    data: insights.slice(0, parseInt(limit)),
    count: insights.length,
    timeRange,
    generatedAt: new Date().toISOString()
  });
}));

/**
 * GET /api/v1/analytics/performance/:stage
 * Get detailed performance metrics for a specific stage
 */
router.get('/performance/:stage', asyncHandler(async (req, res) => {
  const { stage } = req.params;
  const { days = 7 } = req.query;
  
  const validStages = [
    'USER_CREATED','UNDER_REVIEW','APPROVED', 'QUEUED_FOR_EMBOSSING', 'IN_EMBOSSING', 'EMBOSSING_COMPLETE',
    'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'
  ];
  
  if (!validStages.includes(stage.toUpperCase())) {
    return res.status(400).json({
      success: false,
      error: 'Invalid stage',
      validStages,
      requestId: req.requestId
    });
  }
  
  const metrics = await analyticsService.getStagePerformanceMetrics(
    stage.toUpperCase(), 
    parseInt(days)
  );
  
  res.json({
    success: true,
    data: metrics,
    stage: stage.toUpperCase(),
    period: `${days} days`,
    generatedAt: new Date().toISOString()
  });
}));

/**
 * GET /api/v1/analytics/regional
 * Get regional performance analysis
 */
router.get('/regional', asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  
  const regionalPerformance = await analyticsService.getRegionalPerformance(parseInt(days));
  
  res.json({
    success: true,
    data: regionalPerformance,
    period: `${days} days`,
    generatedAt: new Date().toISOString()
  });
}));

/**
 * GET /api/v1/analytics/sla
 * Get SLA compliance metrics
 */
router.get('/sla', asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  const CardJourney = require('../models/CardJourney');
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));
  
  const slaMetrics = await CardJourney.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $project: {
        cardId: 1,
        priority: 1,
        currentStatus: 1,
        createdAt: 1,
        actualDelivery: 1,
        estimatedDelivery: 1,
        deliveryTime: {
          $cond: [
            { $ne: ["$actualDelivery", null] },
            { $divide: [{ $subtract: ["$actualDelivery", "$createdAt"] }, 1000 * 60 * 60] },
            null
          ]
        },
        slaTarget: {
          $switch: {
            branches: [
              { case: { $eq: ["$priority", "URGENT"] }, then: 48 },
              { case: { $eq: ["$priority", "EXPRESS"] }, then: 72 },
              { case: { $eq: ["$priority", "STANDARD"] }, then: 96 }
            ],
            default: 96
          }
        }
      }
    },
    {
      $project: {
        cardId: 1,
        priority: 1,
        currentStatus: 1,
        deliveryTime: 1,
        slaTarget: 1,
        slaCompliant: {
          $cond: [
            { $ne: ["$deliveryTime", null] },
            { $lte: ["$deliveryTime", "$slaTarget"] },
            null
          ]
        }
      }
    },
    {
      $group: {
        _id: "$priority",
        totalCards: { $sum: 1 },
        deliveredCards: {
          $sum: { $cond: [{ $ne: ["$deliveryTime", null] }, 1, 0] }
        },
        slaCompliantCards: {
          $sum: { $cond: [{ $eq: ["$slaCompliant", true] }, 1, 0] }
        },
        avgDeliveryTime: { $avg: "$deliveryTime" },
        slaTarget: { $first: "$slaTarget" }
      }
    },
    {
      $project: {
        priority: "$_id",
        totalCards: 1,
        deliveredCards: 1,
        slaCompliantCards: 1,
        slaTarget: 1,
        avgDeliveryTime: { $round: ["$avgDeliveryTime", 1] },
        slaComplianceRate: {
          $round: [
            { $multiply: [{ $divide: ["$slaCompliantCards", "$deliveredCards"] }, 100] },
            1
          ]
        }
      }
    }
  ]);
  
  // Overall SLA compliance
  const overall = slaMetrics.reduce((acc, item) => {
    acc.totalCards += item.totalCards;
    acc.deliveredCards += item.deliveredCards;
    acc.slaCompliantCards += item.slaCompliantCards;
    return acc;
  }, { totalCards: 0, deliveredCards: 0, slaCompliantCards: 0 });
  
  overall.overallComplianceRate = overall.deliveredCards > 0 
    ? ((overall.slaCompliantCards / overall.deliveredCards) * 100).toFixed(1)
    : 0;
  
  res.json({
    success: true,
    data: {
      byPriority: slaMetrics,
      overall
    },
    period: `${days} days`,
    generatedAt: new Date().toISOString()
  });
}));

/**
 * GET /api/v1/analytics/capacity
 * Get capacity utilization metrics
 */
router.get('/capacity', asyncHandler(async (req, res) => {
  const { date } = req.query;
  
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
  
  const CardJourney = require('../models/CardJourney');
  
  const capacityMetrics = await CardJourney.aggregate([
    { $match: { createdAt: { $gte: startOfDay, $lte: endOfDay } } },
    { $unwind: "$journey" },
    {
      $match: {
        "journey.timestamp": { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: {
          stage: "$journey.stage",
          hour: { $hour: "$journey.timestamp" }
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: "$_id.stage",
        hourlyData: {
          $push: {
            hour: "$_id.hour",
            count: "$count"
          }
        },
        totalProcessed: { $sum: "$count" }
      }
    }
  ]);
  
  // Define theoretical capacity limits (configurable)
  const capacityLimits = {
    'IN_EMBOSSING': 200,
    'DISPATCHED': 500,
    'OUT_FOR_DELIVERY': 1000
  };
  
  const capacityAnalysis = capacityMetrics.map(stage => {
    const limit = capacityLimits[stage._id] || 100;
    const utilization = (stage.totalProcessed / limit) * 100;
    
    return {
      stage: stage._id,
      totalProcessed: stage.totalProcessed,
      capacityLimit: limit,
      utilizationPercentage: Math.round(utilization),
      status: utilization > 90 ? 'critical' : utilization > 75 ? 'high' : 'normal',
      hourlyData: stage.hourlyData.sort((a, b) => a.hour - b.hour)
    };
  });
  
  res.json({
    success: true,
    data: capacityAnalysis,
    date: startOfDay.toISOString().split('T')[0],
    generatedAt: new Date().toISOString()
  });
}));

/**
 * GET /api/v1/analytics/forecast
 * Get volume forecast based on historical data
 */
router.get('/forecast', asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  
  const CardJourney = require('../models/CardJourney');
  
  // Get historical data for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const historicalData = await CardJourney.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          dayOfWeek: { $dayOfWeek: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: "$_id.dayOfWeek",
        avgVolume: { $avg: "$count" },
        minVolume: { $min: "$count" },
        maxVolume: { $max: "$count" }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Generate forecast for next N days
  const forecast = [];
  const today = new Date();
  
  for (let i = 1; i <= parseInt(days); i++) {
    const forecastDate = new Date(today);
    forecastDate.setDate(today.getDate() + i);
    
    const dayOfWeek = forecastDate.getDay() + 1; // MongoDB uses 1-7 for Sunday-Saturday
    const dayData = historicalData.find(d => d._id === dayOfWeek);
    
    if (dayData) {
      forecast.push({
        date: forecastDate.toISOString().split('T')[0],
        dayOfWeek: forecastDate.toLocaleDateString('en-US', { weekday: 'long' }),
        predictedVolume: Math.round(dayData.avgVolume),
        minExpected: Math.round(dayData.minVolume),
        maxExpected: Math.round(dayData.maxVolume),
        confidence: 'medium' // Simple confidence level
      });
    }
  }
  
  res.json({
    success: true,
    data: forecast,
    forecastPeriod: `${days} days`,
    basedOnData: '30 days historical average',
    generatedAt: new Date().toISOString()
  });
}));

/**
 * POST /api/v1/analytics/alert
 * Create custom analytics alert
 */
router.post('/alert', asyncHandler(async (req, res) => {
  const { 
    name, 
    condition, 
    threshold, 
    stage, 
    severity = 'medium',
    enabled = true 
  } = req.body;
  
  // Simple alert configuration (in production, store in database)
  const alert = {
    id: Date.now().toString(),
    name,
    condition, // 'delay_percentage', 'volume_spike', 'failure_rate'
    threshold,
    stage,
    severity,
    enabled,
    createdAt: new Date().toISOString()
  };
  
  // In production, save to database and implement alert checking logic
  console.log('Alert created:', alert);
  
  res.status(201).json({
    success: true,
    message: 'Alert created successfully',
    data: alert
  });
}));

/**
 * GET /api/v1/analytics/export
 * Export analytics data
 */
router.get('/export', asyncHandler(async (req, res) => {
  const { 
    type = 'bottlenecks', 
    format = 'json',
    days = 30 
  } = req.query;
  
  let data;
  let filename;
  
  switch (type) {
    case 'bottlenecks':
      data = await cardService.getCurrentBottlenecks();
      filename = 'bottlenecks-analysis';
      break;
      
    case 'trends':
      data = await analyticsService.getPerformanceTrends(parseInt(days));
      filename = 'performance-trends';
      break;
      
    case 'regional':
      data = await analyticsService.getRegionalPerformance(parseInt(days));
      filename = 'regional-performance';
      break;
      
    default:
      return res.status(400).json({
        success: false,
        error: 'Invalid export type',
        validTypes: ['bottlenecks', 'trends', 'regional'],
        requestId: req.requestId
      });
  }
  
  const timestamp = new Date().toISOString().split('T')[0];
  
  if (format === 'csv') {
    // Simple CSV conversion (enhance as needed)
    const csv = convertToCSV(data);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}-${timestamp}.csv"`);
    res.send(csv);
  } else {
    res.json({
      success: true,
      data,
      exportType: type,
      exportedAt: new Date().toISOString(),
      count: data.length
    });
  }
}));

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(item => 
    Object.values(item).map(value => 
      typeof value === 'string' ? `"${value}"` : value
    ).join(',')
  );
  
  return [headers, ...rows].join('\n');
}

module.exports = router;