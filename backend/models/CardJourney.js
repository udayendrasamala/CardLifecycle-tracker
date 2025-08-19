// models/CardJourney.js - MongoDB Card Journey Model
const mongoose = require('mongoose');

const journeyEventSchema = new mongoose.Schema({
  stage: {
    type: String,
    required: true,
    enum: [
      'APPROVED', 'QUEUED_FOR_EMBOSSING', 'IN_EMBOSSING', 'EMBOSSING_COMPLETE',
      'EMBOSSING_FAILED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
      'DELIVERED', 'DELIVERY_FAILED', 'RETURNED', 'DESTROYED'
    ]
  },
  timestamp: { type: Date, default: Date.now },
  source: { type: String, required: true },
  location: String,
  operatorId: String,
  batchId: String,
  trackingId: String,
  previousStage: String,
  failureReason: String,
  durationMinutes: Number,
  eventData: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: true });

const cardJourneySchema = new mongoose.Schema({
  cardId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true, index: true },
  customerName: String,
  mobileNumber: { type: String, required: true }, // Encrypted in service layer
  panMasked: { type: String, required: true },
  applicationId: String,
  currentStatus: {
    type: String,
    required: true,
    default: 'APPROVED',
    enum: [
      'APPROVED', 'QUEUED_FOR_EMBOSSING', 'IN_EMBOSSING', 'EMBOSSING_COMPLETE',
      'EMBOSSING_FAILED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
      'DELIVERED', 'DELIVERY_FAILED', 'RETURNED', 'DESTROYED'
    ]
  },
  priority: {
    type: String,
    enum: ['STANDARD', 'EXPRESS', 'URGENT'],
    default: 'STANDARD'
  },
  address: String, // Encrypted in service layer
  estimatedDelivery: Date,
  actualDelivery: Date,
  failureReason: String,
  retryCount: { type: Number, default: 0 },
  journey: [journeyEventSchema],
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'card_journeys'
});

// Indexes for performance
cardJourneySchema.index({ currentStatus: 1 });
cardJourneySchema.index({ createdAt: -1 });
cardJourneySchema.index({ customerName: 'text', customerId: 'text' });
cardJourneySchema.index({ 'journey.stage': 1 });
cardJourneySchema.index({ 'journey.timestamp': -1 });
cardJourneySchema.index({ priority: 1, currentStatus: 1 });

// Virtual for journey duration
cardJourneySchema.virtual('totalDurationHours').get(function() {
  if (this.actualDelivery && this.createdAt) {
    return Math.round((this.actualDelivery - this.createdAt) / (1000 * 60 * 60));
  }
  return null;
});

// Instance method to add journey event
cardJourneySchema.methods.addJourneyEvent = function(eventData) {
  this.journey.push(eventData);
  this.currentStatus = eventData.stage;
  
  if (eventData.stage === 'DELIVERED') {
    this.actualDelivery = eventData.timestamp || new Date();
  }
  
  if (eventData.failureReason) {
    this.failureReason = eventData.failureReason;
  }
  
  return this.save();
};

// Static method to find cards by status
cardJourneySchema.statics.findByStatus = function(status) {
  return this.find({ currentStatus: status }).sort({ createdAt: -1 });
};

// Static method to get cards in date range
cardJourneySchema.statics.findInDateRange = function(startDate, endDate) {
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ createdAt: -1 });
};

// Pre-save middleware
cardJourneySchema.pre('save', function(next) {
  // Update timestamp when status changes
  if (this.isModified('currentStatus')) {
    this.updatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('CardJourney', cardJourneySchema);