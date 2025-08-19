// routes/cards.js - Card management routes
const express = require('express');
const cardService = require('../services/cardService');
const { asyncHandler, validateApiKey } = require('../middleware');

const router = express.Router();

/**
 * POST /api/v1/cards
 * Create new card journey
 */
router.post('/', asyncHandler(async (req, res) => {
  const card = await cardService.createCard(req.body);
  
  res.status(201).json({
    success: true,
    message: 'Card journey created successfully',
    data: card
  });
}));

/**
 * POST /api/v1/cards/:cardId/status
 * Update card status (webhook endpoint for external services)
 */
router.post('/:cardId/status', validateApiKey, asyncHandler(async (req, res) => {
  const { cardId } = req.params;
  
  if (!cardId) {
    return res.status(400).json({
      success: false,
      error: 'Card ID is required',
      requestId: req.requestId
    });
  }
  
  const card = await cardService.updateCardStatus(cardId, req.body);
  
  res.json({
    success: true,
    message: 'Card status updated successfully',
    data: card
  });
}));

/**
 * GET /api/v1/cards/search
 * Search cards by identifier (Card ID, PAN, Customer name, etc.)
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;
  console.log(`reached backend for till /search endpointSearch query: ${q}, Limit: ${limit}`);
  if (!q || q.length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Search query must be at least 3 characters',
      requestId: req.requestId
    });
  }
  
  const cards = await cardService.searchCards(q);
  
  if (cards.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'No cards found matching the search criteria',
      query: q,
      requestId: req.requestId
    });
  }
  
  // Apply limit
  const limitedCards = cards.slice(0, parseInt(limit));
  
  res.json({
    success: true,
    message: `Found ${cards.length} card(s)`,
    data: limitedCards.length === 1 ? limitedCards[0] : limitedCards,
    count: limitedCards.length,
    total: cards.length,
    query: q
  });
}));

/**
 * GET /api/v1/cards/:cardId
 * Get specific card details by Card ID
 */
router.get('/:cardId', asyncHandler(async (req, res) => {
  const { cardId } = req.params;
  
  if (!cardId) {
    return res.status(400).json({
      success: false,
      error: 'Card ID is required',
      requestId: req.requestId
    });
  }
  
  try {
    const card = await cardService.getCardById(cardId);
    
    res.json({
      success: true,
      data: card
    });
  } catch (error) {
    if (error.message === 'Card not found') {
      return res.status(404).json({
        success: false,
        error: 'Card not found',
        cardId,
        requestId: req.requestId
      });
    }
    throw error;
  }
}));

/**
 * GET /api/v1/cards/status/:status
 * Get cards by specific status
 */
router.get('/status/:status', asyncHandler(async (req, res) => {
  const { status } = req.params;
  const { limit = 50, page = 1 } = req.query;
  
  const validStatuses = [
    'APPROVED', 'QUEUED_FOR_EMBOSSING', 'IN_EMBOSSING', 'EMBOSSING_COMPLETE',
    'EMBOSSING_FAILED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
    'DELIVERED', 'DELIVERY_FAILED', 'RETURNED', 'DESTROYED'
  ];
  
  if (!validStatuses.includes(status.toUpperCase())) {
    return res.status(400).json({
      success: false,
      error: 'Invalid status',
      validStatuses,
      requestId: req.requestId
    });
  }
  
  const cards = await cardService.getCardsByStatus(status.toUpperCase(), parseInt(limit));
  
  res.json({
    success: true,
    data: cards,
    count: cards.length,
    status: status.toUpperCase(),
    page: parseInt(page),
    limit: parseInt(limit)
  });
}));

/**
 * GET /api/v1/cards/delayed
 * Get cards that are delayed beyond threshold
 */
router.get('/delayed', asyncHandler(async (req, res) => {
  const { hours = 96 } = req.query; // Default 96 hours (4 days)
  
  const delayedCards = await cardService.getDelayedCards(parseInt(hours));
  
  res.json({
    success: true,
    message: `Found ${delayedCards.length} delayed card(s)`,
    data: delayedCards,
    count: delayedCards.length,
    thresholdHours: parseInt(hours)
  });
}));

/**
 * PUT /api/v1/cards/:cardId/retry
 * Retry failed card processing
 */
router.put('/:cardId/retry', validateApiKey, asyncHandler(async (req, res) => {
  const { cardId } = req.params;
  const { reason = 'Manual retry' } = req.body;
  
  // Get current card
  const card = await cardService.getCardById(cardId);
  
  if (!card.currentStatus.includes('FAILED')) {
    return res.status(400).json({
      success: false,
      error: 'Card is not in a failed state',
      currentStatus: card.currentStatus,
      requestId: req.requestId
    });
  }
  
  // Determine retry status based on current failed status
  let retryStatus;
  if (card.currentStatus === 'EMBOSSING_FAILED') {
    retryStatus = 'QUEUED_FOR_EMBOSSING';
  } else if (card.currentStatus === 'DELIVERY_FAILED') {
    retryStatus = 'OUT_FOR_DELIVERY';
  } else {
    return res.status(400).json({
      success: false,
      error: 'Cannot determine retry status for current state',
      currentStatus: card.currentStatus,
      requestId: req.requestId
    });
  }
  
  // Update status
  const updatedCard = await cardService.updateCardStatus(cardId, {
    status: retryStatus,
    source: 'manual_retry',
    operatorId: req.body.operatorId || 'system',
    eventData: { reason, retryAttempt: card.retryCount + 1 }
  });
  
  res.json({
    success: true,
    message: 'Card retry initiated successfully',
    data: updatedCard
  });
}));

/**
 * GET /api/v1/cards/export
 * Export cards data (CSV format)
 */
router.get('/export', asyncHandler(async (req, res) => {
  const { 
    status, 
    startDate, 
    endDate, 
    format = 'json' 
  } = req.query;
  
  let query = {};
  
  // Add status filter
  if (status) {
    query.currentStatus = status.toUpperCase();
  }
  
  // Add date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  const CardJourney = require('../models/CardJourney');
  const cards = await CardJourney.find(query)
    .select('-mobileNumber -address') // Exclude encrypted fields
    .limit(1000) // Limit for safety
    .sort({ createdAt: -1 });
  
  if (format === 'csv') {
    // Convert to CSV format
    const csvHeader = 'Card ID,Customer ID,Customer Name,PAN,Status,Priority,Created,Updated\n';
    const csvData = cards.map(card => 
      `${card.cardId},${card.customerId},${card.customerName || ''},${card.panMasked},${card.currentStatus},${card.priority},${card.createdAt.toISOString()},${card.updatedAt.toISOString()}`
    ).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="cards-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvHeader + csvData);
  } else {
    res.json({
      success: true,
      data: cards,
      count: cards.length,
      filters: { status, startDate, endDate },
      exportedAt: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/v1/cards/summary
 * Get summary statistics for cards
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));
  
  const CardJourney = require('../models/CardJourney');
  
  const summary = await CardJourney.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: null,
        totalCards: { $sum: 1 },
        deliveredCards: {
          $sum: { $cond: [{ $eq: ["$currentStatus", "DELIVERED"] }, 1, 0] }
        },
        failedCards: {
          $sum: { 
            $cond: [
              { $in: ["$currentStatus", ["DELIVERY_FAILED", "EMBOSSING_FAILED"]] }, 
              1, 0
            ] 
          }
        },
        expressCards: {
          $sum: { $cond: [{ $eq: ["$priority", "EXPRESS"] }, 1, 0] }
        },
        avgDeliveryTime: {
          $avg: {
            $cond: [
              { $ne: ["$actualDelivery", null] },
              { $divide: [{ $subtract: ["$actualDelivery", "$createdAt"] }, 1000 * 60 * 60] },
              null
            ]
          }
        }
      }
    }
  ]);
  
  const result = summary[0] || {
    totalCards: 0,
    deliveredCards: 0,
    failedCards: 0,
    expressCards: 0,
    avgDeliveryTime: 0
  };
  
  result.successRate = result.totalCards > 0 
    ? ((result.deliveredCards / result.totalCards) * 100).toFixed(1)
    : 0;
  
  result.avgDeliveryTimeHours = result.avgDeliveryTime 
    ? result.avgDeliveryTime.toFixed(1)
    : 0;
  
  res.json({
    success: true,
    data: result,
    period: `Last ${days} days`,
    generatedAt: new Date().toISOString()
  });
}));

module.exports = router;