// services/analyticsService.js - AI Analytics Service
const CardJourney = require('../models/CardJourney');
const BottleneckAnalysis = require('../models/BottleneckAnalysis');
const { broadcast } = require('../config/websocket');

class AnalyticsService {

  async analyzeBottlenecks() {
    try {
      console.log('🔍 Starting AI bottleneck analysis...');

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Aggregation pipeline for stage duration analysis
      const pipeline = [
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        { $unwind: "$journey" },
        {
          $match: {
            "journey.durationMinutes": { $exists: true, $ne: null, $gt: 0 }
          }
        },
        {
          $group: {
            _id: "$journey.stage",
            durations: { $push: "$journey.durationMinutes" },
            count: { $sum: 1 },
            avgDuration: { $avg: "$journey.durationMinutes" },
            maxDuration: { $max: "$journey.durationMinutes" },
            minDuration: { $min: "$journey.durationMinutes" }
          }
        },
        { $match: { count: { $gte: 5 } } }, // Minimum sample size
        {
          $project: {
            stage: "$_id",
            count: 1,
            avgDuration: { $round: ["$avgDuration", 0] },
            maxDuration: 1,
            minDuration: 1,
            // Calculate percentiles manually
            p95Duration: {
              $let: {
                vars: {
                  sortedDurations: { $slice: [{ $sortArray: { input: "$durations", sortBy: 1 } }, Math.floor("$count" * 0.95), 1] }
                },
                in: { $arrayElemAt: ["$$sortedDurations", 0] }
              }
            },
            delayedCount: {
              $size: {
                $filter: {
                  input: "$durations",
                  cond: { $gt: ["$$this", 480] } // More than 8 hours
                }
              }
            }
          }
        },
        {
          $project: {
            stage: 1,
            count: 1,
            avgDuration: 1,
            p95Duration: { $round: ["$p95Duration", 0] },
            maxDuration: 1,
            minDuration: 1,
            delayedCount: 1,
            delayPercentage: {
              $round: [{ $multiply: [{ $divide: ["$delayedCount", "$count"] }, 100] }, 1]
            },
            severity: {
              $switch: {
                branches: [
                  { case: { $gt: [{ $divide: ["$delayedCount", "$count"] }, 0.3] }, then: "critical" },
                  { case: { $gt: [{ $divide: ["$delayedCount", "$count"] }, 0.2] }, then: "high" },
                  { case: { $gt: [{ $divide: ["$delayedCount", "$count"] }, 0.1] }, then: "medium" }
                ],
                default: "low"
              }
            }
          }
        },
        { $match: { avgDuration: { $gt: 30 } } }, // Focus on stages > 30 minutes
        { $sort: { delayPercentage: -1 } }
      ];

      const stageAnalysis = await CardJourney.aggregate(pipeline);

      // Save analysis results
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const stage of stageAnalysis) {
        const recommendations = this.generateRecommendations(stage);

        await BottleneckAnalysis.findOneAndUpdate(
          { stage: stage.stage, analysisDate: today },
          {
            avgDurationMinutes: stage.avgDuration,
            p95DurationMinutes: stage.p95Duration,
            delayPercentage: stage.delayPercentage,
            affectedCount: stage.count,
            severity: stage.severity,
            recommendations,
            totalSampleSize: stage.count,
            medianDurationMinutes: this.calculateMedian(stage),
            metadata: {
              maxDuration: stage.maxDuration,
              minDuration: stage.minDuration,
              analysisVersion: '1.0'
            }
          },
          { upsert: true, new: true }
        );
      }

      // Broadcast analysis completion
      broadcast('bottleneck_analysis_complete', {
        analysisDate: today,
        stagesAnalyzed: stageAnalysis.length,
        criticalStages: stageAnalysis.filter(s => s.severity === 'critical').length
      });

      console.log(`✅ Bottleneck analysis completed for ${stageAnalysis.length} stages`);
      return stageAnalysis;

    } catch (error) {
      console.error('❌ Bottleneck analysis failed:', error);
      throw error;
    }
  }

  calculateMedian(stageData) {
    // Simple median calculation - in production, this would be more sophisticated
    return Math.round((stageData.minDuration + stageData.maxDuration) / 2);
  }

  generateRecommendations(stageAnalysis) {
    const recommendations = [];
    
    // Severity-based recommendations
    if (stageAnalysis.severity === 'critical') {
      recommendations.push(`🚨 CRITICAL: ${stageAnalysis.stage} stage requires immediate intervention`);
      recommendations.push('🔧 Deploy emergency capacity or escalate to senior management');
      recommendations.push('📊 Set up real-time monitoring with 15-minute alert intervals');
    } else if (stageAnalysis.severity === 'high') {
      recommendations.push(`⚠️ HIGH PRIORITY: ${stageAnalysis.stage} stage needs urgent attention`);
      recommendations.push('🔄 Review process workflow and resource allocation');
      recommendations.push('📈 Implement capacity planning and load balancing');
    }
    
    // Delay percentage recommendations
    if (stageAnalysis.delayPercentage > 50) {
      recommendations.push('🎯 Over 50% of transactions delayed - process redesign recommended');
      recommendations.push('🤖 Consider automation opportunities to reduce manual bottlenecks');
    } else if (stageAnalysis.delayPercentage > 25) {
      recommendations.push('📋 Review standard operating procedures and training needs');
      recommendations.push('⏱️ Implement process optimization and efficiency measures');
    }
    
    // Duration-based recommendations
    if (stageAnalysis.avgDuration > 1440) { // > 24 hours
      recommendations.push('🕐 Average processing time exceeds 24 hours - urgent process review needed');
    } else if (stageAnalysis.avgDuration > 480) { // > 8 hours
      recommendations.push('⏰ Processing time exceeds 8 hours - consider parallel processing');
    } else if (stageAnalysis.avgDuration > 240) { // > 4 hours
      recommendations.push('🔄 Moderate delays detected - review resource allocation during peak hours');
    }

    // Stage-specific recommendations
    const stageSpecificRecommendations = this.getStageSpecificRecommendations(stageAnalysis.stage, stageAnalysis);
    recommendations.push(...stageSpecificRecommendations);

    // Volume-based recommendations
    if (stageAnalysis.count > 1000) {
      recommendations.push('📊 High volume stage - consider batch processing optimization');
    }
    
    return recommendations.slice(0, 6); // Limit to 6 recommendations
  }

  getStageSpecificRecommendations(stage, analysis) {
    const recommendations = [];

    switch (stage) {
      case 'QUEUED_FOR_EMBOSSING':
        recommendations.push('🏭 Check embossing facility capacity and queue management');
        recommendations.push('📦 Consider increasing batch sizes or adding shifts');
        break;
        
      case 'IN_EMBOSSING':
        recommendations.push('🔧 Review embossing equipment efficiency and maintenance schedule');
        recommendations.push('👥 Evaluate operator training and process standardization');
        if (analysis.avgDuration > 240) {
          recommendations.push('⚙️ Equipment upgrade or additional machines may be needed');
        }
        break;
        
      case 'DISPATCHED':
        recommendations.push('🚚 Review logistics partner SLAs and performance metrics');
        recommendations.push('📍 Analyze dispatch routes and consolidation opportunities');
        break;
        
      case 'IN_TRANSIT':
        recommendations.push('🗺️ Review delivery routes and optimize for efficiency');
        recommendations.push('📱 Implement real-time tracking for better visibility');
        break;
        
      case 'OUT_FOR_DELIVERY':
        recommendations.push('🏠 Analyze delivery attempt success rates and timing');
        recommendations.push('📞 Improve customer communication and delivery scheduling');
        if (analysis.delayPercentage > 20) {
          recommendations.push('🔍 Review address validation accuracy and customer availability');
        }
        break;
        
      case 'DELIVERY_FAILED':
        recommendations.push('📋 Implement address verification and customer confirmation');
        recommendations.push('🔄 Set up automatic retry scheduling with customer preferences');
        break;
        
      default:
        recommendations.push('📈 Monitor stage performance and implement continuous improvement');
    }

    return recommendations;
  }

  async getPerformanceTrends(days = 30) {
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
      { $sort: { "_id.date": 1 } },
      {
        $group: {
          _id: "$_id.date",
          statusCounts: {
            $push: {
              status: "$_id.status",
              count: "$count"
            }
          },
          totalCount: { $sum: "$count" }
        }
      }
    ];

    return await CardJourney.aggregate(pipeline);
  }

  async getStagePerformanceMetrics(stage, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      { $match: { createdAt: { $gte: startDate } } },
      { $unwind: "$journey" },
      { $match: { "journey.stage": stage } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$journey.timestamp" } }
          },
          avgDuration: { $avg: "$journey.durationMinutes" },
          count: { $sum: 1 },
          maxDuration: { $max: "$journey.durationMinutes" },
          minDuration: { $min: "$journey.durationMinutes" }
        }
      },
      { $sort: { "_id.date": 1 } }
    ];

    return await CardJourney.aggregate(pipeline);
  }

  async getRegionalPerformance(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $ifNull: ["$metadata.region", "Unknown"] },
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
      },
      {
        $project: {
          region: "$_id",
          totalCards: 1,
          deliveredCards: 1,
          failedCards: 1,
          successRate: {
            $round: [
              { $multiply: [{ $divide: ["$deliveredCards", "$totalCards"] }, 100] },
              1
            ]
          },
          avgDeliveryTimeHours: { $round: ["$avgDeliveryTime", 1] }
        }
      },
      { $sort: { totalCards: -1 } }
    ];

    return await CardJourney.aggregate(pipeline);
  }

  async generateInsights(timeRange = '7d') {
    try {
      const insights = [];

      // Get bottlenecks
      const bottlenecks = await BottleneckAnalysis.getCurrentBottlenecks(3);
      
      // Generate insights based on bottlenecks
      bottlenecks.forEach(bottleneck => {
        if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
          insights.push({
            type: 'bottleneck',
            severity: bottleneck.severity,
            title: `${bottleneck.stage} Stage Performance Alert`,
            description: `${bottleneck.delayPercentage}% of transactions delayed in ${bottleneck.stage} stage`,
            recommendation: bottleneck.recommendations[0] || 'Review process efficiency',
            impact: 'high',
            affectedCount: bottleneck.affectedCount
          });
        }
      });

      // Get regional performance insights
      const regionalPerf = await this.getRegionalPerformance();
      const worstRegion = regionalPerf.find(r => r.successRate < 90);
      
      if (worstRegion) {
        insights.push({
          type: 'regional',
          severity: 'medium',
          title: `${worstRegion.region} Region Performance`,
          description: `Success rate of ${worstRegion.successRate}% below target`,
          recommendation: 'Review regional logistics partners and processes',
          impact: 'medium',
          affectedCount: worstRegion.totalCards
        });
      }

      // Volume-based insights
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const todayVolume = await CardJourney.countDocuments({
        createdAt: { $gte: new Date(now.setHours(0, 0, 0, 0)) }
      });
      
      const yesterdayVolume = await CardJourney.countDocuments({
        createdAt: { 
          $gte: new Date(yesterday.setHours(0, 0, 0, 0)),
          $lt: new Date(now.setHours(0, 0, 0, 0))
        }
      });

      const volumeChange = ((todayVolume - yesterdayVolume) / yesterdayVolume) * 100;
      
      if (Math.abs(volumeChange) > 20) {
        insights.push({
          type: 'volume',
          severity: volumeChange > 0 ? 'medium' : 'low',
          title: 'Volume Change Alert',
          description: `${volumeChange > 0 ? 'Increase' : 'Decrease'} of ${Math.abs(volumeChange).toFixed(1)}% in daily volume`,
          recommendation: volumeChange > 0 ? 'Prepare for increased capacity needs' : 'Investigate potential issues',
          impact: 'medium',
          affectedCount: Math.abs(todayVolume - yesterdayVolume)
        });
      }

      return insights.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

    } catch (error) {
      console.error('Error generating insights:', error);
      return [];
    }
  }

  // Schedule analysis to run periodically
  scheduleAnalysis() {
    const cron = require('node-cron');
    
    // Run every hour
    cron.schedule('0 * * * *', async () => {
      try {
        console.log('🕐 Running scheduled bottleneck analysis...');
        await this.analyzeBottlenecks();
      } catch (error) {
        console.error('❌ Scheduled analysis failed:', error);
      }
    });

    // Generate insights every 4 hours
    cron.schedule('0 */4 * * *', async () => {
      try {
        console.log('💡 Generating scheduled insights...');
        const insights = await this.generateInsights();
        
        if (insights.length > 0) {
          broadcast('new_insights', {
            count: insights.length,
            insights: insights.slice(0, 3) // Send top 3
          });
        }
      } catch (error) {
        console.error('❌ Insight generation failed:', error);
      }
    });

    console.log('⏰ Analytics scheduler initialized');
  }
}

module.exports = new AnalyticsService();