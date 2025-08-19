// models/BottleneckAnalysis.js - AI Analysis Model
const mongoose = require('mongoose');

const bottleneckAnalysisSchema = new mongoose.Schema({
  stage: { 
    type: String, 
    required: true,
    enum: [
      'APPROVED', 'QUEUED_FOR_EMBOSSING', 'IN_EMBOSSING', 'EMBOSSING_COMPLETE',
      'EMBOSSING_FAILED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
      'DELIVERED', 'DELIVERY_FAILED', 'RETURNED', 'DESTROYED'
    ]
  },
  analysisDate: { 
    type: Date, 
    required: true,
    default: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
  },
  avgDurationMinutes: {
    type: Number,
    min: 0
  },
  p95DurationMinutes: {
    type: Number,
    min: 0
  },
  delayPercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  affectedCount: {
    type: Number,
    min: 0,
    default: 0
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  recommendations: [{
    type: String,
    maxlength: 500
  }],
  metadata: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  },
  // Additional metrics
  totalSampleSize: {
    type: Number,
    default: 0
  },
  medianDurationMinutes: Number,
  stdDeviationMinutes: Number,
  bottleneckCause: String,
  impactScore: {
    type: Number,
    min: 0,
    max: 100
  }
}, {
  timestamps: true,
  collection: 'bottleneck_analysis'
});

// Compound index for efficient queries
bottleneckAnalysisSchema.index({ stage: 1, analysisDate: -1 }, { unique: true });
bottleneckAnalysisSchema.index({ severity: -1, delayPercentage: -1 });
bottleneckAnalysisSchema.index({ analysisDate: -1 });
bottleneckAnalysisSchema.index({ impactScore: -1 });

// Virtual for human-readable severity
bottleneckAnalysisSchema.virtual('severityDescription').get(function() {
  const descriptions = {
    low: 'Minor delays, monitoring recommended',
    medium: 'Moderate impact, attention needed',
    high: 'Significant delays, action required',
    critical: 'Critical bottleneck, immediate intervention needed'
  };
  return descriptions[this.severity] || 'Unknown severity';
});

// Virtual for improvement opportunity
bottleneckAnalysisSchema.virtual('improvementOpportunity').get(function() {
  if (this.delayPercentage > 50) return 'High';
  if (this.delayPercentage > 25) return 'Medium';
  if (this.delayPercentage > 10) return 'Low';
  return 'Minimal';
});

// Static method to get current bottlenecks
bottleneckAnalysisSchema.statics.getCurrentBottlenecks = function(limit = 10) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return this.find({
    analysisDate: { $gte: sevenDaysAgo }
  })
  .sort({ severity: -1, delayPercentage: -1 })
  .limit(limit);
};

// Static method to get trends
bottleneckAnalysisSchema.statics.getTrends = function(stage, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    stage,
    analysisDate: { $gte: startDate }
  })
  .sort({ analysisDate: 1 });
};

// Static method to get severity distribution
bottleneckAnalysisSchema.statics.getSeverityDistribution = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { $match: { analysisDate: { $gte: startDate } } },
    { $group: { _id: '$severity', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
};

// Instance method to calculate impact score
bottleneckAnalysisSchema.methods.calculateImpactScore = function() {
  let score = 0;
  
  // Base score from delay percentage (0-40 points)
  score += Math.min(this.delayPercentage || 0, 40);
  
  // Affected count weight (0-30 points)
  if (this.affectedCount > 100) score += 30;
  else if (this.affectedCount > 50) score += 20;
  else if (this.affectedCount > 10) score += 10;
  
  // Severity weight (0-30 points)
  const severityScores = { low: 5, medium: 15, high: 25, critical: 30 };
  score += severityScores[this.severity] || 0;
  
  this.impactScore = Math.min(score, 100);
  return this.impactScore;
};

// Pre-save middleware to calculate impact score
bottleneckAnalysisSchema.pre('save', function(next) {
  this.calculateImpactScore();
  next();
});

module.exports = mongoose.model('BottleneckAnalysis', bottleneckAnalysisSchema);