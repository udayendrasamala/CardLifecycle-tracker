// services/cardService.js - Business Logic Layer
const CardJourney = require('../models/CardJourney');
const { encrypt, decrypt } = require('../utils/encryption');
const { broadcast } = require('../config/websocket');
const { sendSMSToUser } = require('../services/smsService'); // Add this import

class CardService {
  
  async createCard(cardData) {
    try {
      const {
        cardId, customerId, customerName, mobileNumber,
        panMasked, applicationId, priority = 'STANDARD', address,message
      } = cardData;

      // Validation
      if (!cardId || !customerId || !mobileNumber || !panMasked) {
        throw new Error('Missing required fields: cardId, customerId, mobileNumber, panMasked');
      }

      // Calculate estimated delivery
      const estimatedDelivery = this.calculateEstimatedDelivery(priority, address);

      // Create card journey with initial event
      const cardJourney = new CardJourney({
        cardId,
        customerId,
        customerName,
        mobileNumber: encrypt(mobileNumber),
        panMasked,
        applicationId,
        currentStatus: 'USER_CREATED',
        priority,
        address: address ? encrypt(address) : null,
        estimatedDelivery,
        journey: [{
          stage: 'USER_CREATED',
          source: 'card_management_service',
          location: 'System',
          operatorId: 'AUTO_APPROVAL',
          eventData: { applicationId, priority , message }
        }],
        metadata: {
          region: this.extractRegionFromAddress(address),
          createdBy: 'system'
        }
      });

      await cardJourney.save();

      // Broadcast real-time update
      broadcast('card_created', {
        cardId: cardJourney.cardId,
        status: cardJourney.currentStatus,
        priority: cardJourney.priority,
        customerName: cardJourney.customerName
      });

      // Send SMS to customer about card approval
      try {
        await sendSMSToUser(customerId, 'CARD_APPROVED', {
          cardId: cardId,
          customerName: customerName,
          estimatedDelivery: estimatedDelivery.toDateString()
        });
      } catch (smsError) {
        console.error('SMS sending failed:', smsError);
        // Don't throw error for SMS failure, just log it
      }

      return this.sanitizeCardData(cardJourney);

    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Card ID already exists');
      }
      throw error;
    }
  }

  async updateCardStatus(cardId, statusData) {
    try {
      const {
        status, source, location, operatorId, batchId,
        trackingId, failureReason, eventData
      } = statusData;

      // Validation
      if (!status || !source) {
        throw new Error('Missing required fields: status, source');
      }

      const cardJourney = await CardJourney.findOne({ cardId });
      if (!cardJourney) {
        throw new Error('Card not found');
      }

      const previousStatus = cardJourney.currentStatus;

      // Calculate duration from last event
      const lastEvent = cardJourney.journey[cardJourney.journey.length - 1];
      let durationMinutes = null;
      if (lastEvent) {
        const duration = Date.now() - lastEvent.timestamp.getTime();
        durationMinutes = Math.round(duration / (1000 * 60));
      }

      // Create new journey event
      const newEvent = {
        stage: status,
        source,
        location,
        operatorId,
        batchId,
        trackingId,
        previousStage: previousStatus,
        failureReason,
        durationMinutes,
        eventData: eventData || {}
      };

      // Update card journey
      const updateData = {
        currentStatus: status,
        $push: { journey: newEvent }
      };

      if (failureReason) {
        updateData.failureReason = failureReason;
        updateData.$inc = { retryCount: 1 };
      }

      if (status === 'DELIVERED') {
        updateData.actualDelivery = new Date();
      }

      const updatedCard = await CardJourney.findOneAndUpdate(
        { cardId },
        updateData,
        { new: true }
      );

      // Broadcast real-time update
      broadcast('status_updated', {
        cardId,
        previousStatus,
        newStatus: status,
        timestamp: new Date().toISOString(),
        location,
        failureReason
      });

      // Send SMS to customer about status update
      try {
        await sendSMSToUser(cardJourney.customerId, 'CARD_STATUS_UPDATE', {
          cardId: cardId,
          newStatus: status,
          location: location || 'Processing Center'
        });
      } catch (smsError) {
        console.error('SMS sending failed:', smsError);
        // Don't throw error for SMS failure, just log it
      }

      // Trigger AI analysis for failures or delays
      if (status.includes('FAILED') || durationMinutes > 480) { // 8 hours
        setImmediate(() => this.triggerBottleneckAnalysis());
      }

      return this.sanitizeCardData(updatedCard);

    } catch (error) {
      throw error;
    }
  }

  async searchCards(query) {
    try {
      if (!query || query.length < 3) {
        throw new Error('Search query must be at least 3 characters');
      }

      let searchCriteria = {};

      // Determine search type
      if (query.toUpperCase().startsWith('CRD')) {
        // Card ID search
        searchCriteria.cardId = new RegExp(query, 'i');
      } else if (query.includes('*') && query.length >= 8) {
        // PAN search (masked)
        searchCriteria.panMasked = query;
      } else if (/^\d+$/.test(query) && query.length >= 4) {
        // Might be mobile number (last 4 digits or more)
        // Search in customer name or ID as we can't search encrypted mobile directly
        searchCriteria.$or = [
          { customerName: new RegExp(query, 'i') },
          { customerId: new RegExp(query, 'i') }
        ];
      } else {
        // General text search
        searchCriteria.$or = [
          { customerName: new RegExp(query, 'i') },
          { customerId: new RegExp(query, 'i') },
          { applicationId: new RegExp(query, 'i') }
        ];
      }

      const cards = await CardJourney.find(searchCriteria)
        .sort({ createdAt: -1 })
        .limit(10);

      return cards.map(card => this.sanitizeCardData(card));

    } catch (error) {
      throw error;
    }
  }

  async getCardById(cardId) {
    try {
      const card = await CardJourney.findOne({ cardId });
      if (!card) {
        throw new Error('Card not found');
      }
      return this.sanitizeCardData(card);
    } catch (error) {
      throw error;
    }
  }

  async getDashboardAnalytics(timeRange = '24h') {
    try {
      const timeCondition = this.getTimeRangeCondition(timeRange);

      // Aggregation pipeline for comprehensive analytics
      const pipeline = [
        { $match: { createdAt: { $gte: timeCondition } } },
        {
          $facet: {
            // Total count
            totalCards: [{ $count: "count" }],
            
            // Status breakdown
            statusBreakdown: [
              { $group: { _id: "$currentStatus", count: { $sum: 1 } } }
            ],
            
            // Average delivery time for delivered cards
            avgDeliveryTime: [
              { $match: { actualDelivery: { $exists: true } } },
              {
                $project: {
                  deliveryDays: {
                    $divide: [
                      { $subtract: ["$actualDelivery", "$createdAt"] },
                      1000 * 60 * 60 * 24
                    ]
                  }
                }
              },
              { $group: { _id: null, avgDays: { $avg: "$deliveryDays" } } }
            ],
            
            // Hourly processing data
            hourlyProcessing: [
              {
                $project: {
                  hour: { $hour: "$createdAt" },
                  date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                }
              },
              { $group: { _id: { hour: "$hour", date: "$date" }, processed: { $sum: 1 } } },
              { $group: { _id: "$_id.hour", avgProcessed: { $avg: "$processed" } } },
              { $sort: { _id: 1 } }
            ],
            
            // Geographic data from metadata
            geographicData: [
              {
                $group: {
                  _id: { $ifNull: ["$metadata.region", "Unknown"] },
                  total: { $sum: 1 },
                  delivered: {
                    $sum: { $cond: [{ $eq: ["$currentStatus", "DELIVERED"] }, 1, 0] }
                  },
                  failed: {
                    $sum: { $cond: [{ $in: ["$currentStatus", ["DELIVERY_FAILED", "EMBOSSING_FAILED"]] }, 1, 0] }
                  }
                }
              },
              {
                $project: {
                  region: "$_id",
                  total: 1,
                  delivered: 1,
                  failed: 1,
                  successRate: {
                    $round: [{ $multiply: [{ $divide: ["$delivered", "$total"] }, 100] }, 1]
                  },
                  processing: { $subtract: ["$total", { $add: ["$delivered", "$failed"] }] }
                }
              },
              { $sort: { total: -1 } }
            ],

            // Priority breakdown
            priorityBreakdown: [
              { $group: { _id: "$priority", count: { $sum: 1 } } }
            ],

            // Today's stats
            todayStats: [
              {
                $match: {
                  createdAt: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0))
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  processed: { $sum: 1 },
                  delivered: {
                    $sum: { $cond: [{ $eq: ["$currentStatus", "DELIVERED"] }, 1, 0] }
                  },
                  dispatched: {
                    $sum: { $cond: [{ $eq: ["$currentStatus", "DISPATCHED"] }, 1, 0] }
                  },
                  failed: {
                    $sum: { $cond: [{ $in: ["$currentStatus", ["DELIVERY_FAILED", "EMBOSSING_FAILED"]] }, 1, 0] }
                  }
                }
              }
            ]
          }
        }
      ];

      const [result] = await CardJourney.aggregate(pipeline);

      // Get current bottlenecks
      const bottlenecks = await this.getCurrentBottlenecks();

      return {
        totalCards: result.totalCards[0]?.count || 0,
        statusBreakdown: result.statusBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        avgDeliveryTime: parseFloat((result.avgDeliveryTime[0]?.avgDays || 0).toFixed(1)),
        hourlyProcessing: result.hourlyProcessing.map(item => ({
          hour: String(item._id).padStart(2, '0') + ':00',
          processed: Math.round(item.avgProcessed)
        })),
        geographicData: result.geographicData,
        priorityBreakdown: result.priorityBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        todayStats: result.todayStats[0] || {
          processed: 0, delivered: 0, dispatched: 0, failed: 0
        },
        bottlenecks,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      throw error;
    }
  }

  async getCurrentBottlenecks() {
    const BottleneckAnalysis = require('../models/BottleneckAnalysis');
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return await BottleneckAnalysis.find({
      analysisDate: { $gte: sevenDaysAgo }
    })
    .sort({ severity: -1, delayPercentage: -1 })
    .limit(5);
  }

  calculateEstimatedDelivery(priority, address) {
    const baseHours = priority === 'EXPRESS' ? 72 : priority === 'URGENT' ? 48 : 96;
    const region = this.extractRegionFromAddress(address);
    const locationMultiplier = this.getLocationMultiplier(region);
    
    const estimatedDate = new Date();
    estimatedDate.setHours(estimatedDate.getHours() + (baseHours * locationMultiplier));
    
    return estimatedDate;
  }

  extractRegionFromAddress(address) {
    if (!address) return 'Unknown';
    
    const majorCities = {
      'mumbai': 'Mumbai',
      'delhi': 'Delhi', 
      'bangalore': 'Bangalore',
      'chennai': 'Chennai',
      'hyderabad': 'Hyderabad',
      'pune': 'Pune',
      'kolkata': 'Kolkata'
    };

    const addressLower = address.toLowerCase();
    for (const [key, value] of Object.entries(majorCities)) {
      if (addressLower.includes(key)) {
        return value;
      }
    }
    
    return 'Other';
  }

  getLocationMultiplier(region) {
    const tierMultipliers = {
      'Mumbai': 1.0,
      'Delhi': 1.0,
      'Bangalore': 1.1,
      'Chennai': 1.1,
      'Hyderabad': 1.1,
      'Pune': 1.2,
      'Kolkata': 1.2
    };
    
    return tierMultipliers[region] || 1.5;
  }

  getTimeRangeCondition(timeRange) {
    const now = new Date();
    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  sanitizeCardData(cardJourney) {
    const sanitized = cardJourney.toObject();
    
    // Remove encrypted fields from response
    delete sanitized.mobileNumber;
    delete sanitized.address;
    
    // Decrypt for display (masked format)
    if (cardJourney.mobileNumber) {
      try {
        const decrypted = decrypt(cardJourney.mobileNumber);
        sanitized.mobileDisplay = `+91-****-**${decrypted.slice(-4)}`;
      } catch (error) {
        sanitized.mobileDisplay = '+91-****-****';
      }
    }

    if (cardJourney.address) {
      try {
        const decrypted = decrypt(cardJourney.address);
        // Only show city/state for privacy
        const parts = decrypted.split(',');
        sanitized.addressDisplay = parts.length > 1 ? 
          parts.slice(-2).join(',').trim() : 'Address on file';
      } catch (error) {
        sanitized.addressDisplay = 'Address on file';
      }
    }

    return sanitized;
  }

  async triggerBottleneckAnalysis() {
    try {
      const analyticsService = require('./analyticsService');
      await analyticsService.analyzeBottlenecks();
      console.log('🔍 Bottleneck analysis triggered successfully');
    } catch (error) {
      console.error('❌ Failed to trigger bottleneck analysis:', error);
    }
  }

  // Utility methods for reporting
  async getCardsByStatus(status, limit = 50) {
    return await CardJourney.findByStatus(status).limit(limit);
  }

  async getCardsInDateRange(startDate, endDate) {
    return await CardJourney.findInDateRange(startDate, endDate);
  }

  async getDelayedCards(thresholdHours = 96) {
    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - thresholdHours);

    return await CardJourney.find({
      createdAt: { $lt: thresholdDate },
      currentStatus: { $nin: ['DELIVERED', 'DESTROYED', 'RETURNED'] }
    }).sort({ createdAt: 1 });
  }

  async getPerformanceStats(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            status: "$currentStatus"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.date": 1 } }
    ];

    return await CardJourney.aggregate(pipeline);
  }
}

module.exports = new CardService();