// scripts/seedData.js - Generate sample data for development and testing
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const cardService = require('../services/cardService');
const { generateToken } = require('../utils/encryption');

// Sample data configuration
const SEED_CONFIG = {
  totalCards: 100,
  batchSize: 10,
  statusDistribution: {
    'DELIVERED': 60,      // 60% delivered
    'IN_TRANSIT': 15,     // 15% in transit
    'IN_EMBOSSING': 10,   // 10% in embossing
    'OUT_FOR_DELIVERY': 8, // 8% out for delivery
    'DISPATCHED': 4,      // 4% dispatched
    'DELIVERY_FAILED': 2, // 2% failed
    'APPROVED': 1         // 1% just approved
  },
  priorityDistribution: {
    'STANDARD': 70,       // 70% standard
    'EXPRESS': 25,        // 25% express
    'URGENT': 5           // 5% urgent
  },
  regions: [
    'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 
    'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad'
  ]
};

// Sample customer names
const CUSTOMER_NAMES = [
  'Arjun Kumar', 'Priya Sharma', 'Rahul Patel', 'Sneha Gupta',
  'Vikram Singh', 'Anita Rao', 'Sanjay Mehta', 'Kavita Joshi',
  'Amit Verma', 'Sunita Nair', 'Rajesh Reddy', 'Meera Iyer',
  'Kiran Shah', 'Pooja Agarwal', 'Ravi Kulkarni', 'Deepa Soni',
  'Harsh Pandey', 'Shweta Desai', 'Nikhil Jain', 'Ritu Malhotra'
];

// Generate random card data
function generateCardData(index) {
  const randomName = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
  const region = SEED_CONFIG.regions[Math.floor(Math.random() * SEED_CONFIG.regions.length)];
  const priority = getRandomByDistribution(SEED_CONFIG.priorityDistribution);
  
  // Generate realistic mobile number
  const mobileNumber = '9' + Math.floor(Math.random() * 900000000 + 100000000).toString();
  
  // Generate PAN (masked)
  const panLast4 = Math.floor(Math.random() * 9000 + 1000);
  const panMasked = `****-****-****-${panLast4}`;
  
  return {
    cardId: `CRD${String(index + 1).padStart(6, '0')}`,
    customerId: `CUST${String(index + 1000).padStart(6, '0')}`,
    customerName: randomName,
    mobileNumber: mobileNumber,
    panMasked: panMasked,
    applicationId: `APP${generateToken(8).toUpperCase()}`,
    priority: priority,
    address: `${region}, India`
  };
}

// Generate journey events based on final status
function generateJourneyEvents(cardData, finalStatus) {
  const events = [];
  const baseTime = new Date();
  baseTime.setDate(baseTime.getDate() - Math.floor(Math.random() * 30)); // Last 30 days
  
  let currentTime = new Date(baseTime);
  
  // Common stages for all cards
  const stages = ['APPROVED'];
  
  // Add stages based on final status
  switch (finalStatus) {
    case 'DELIVERED':
      stages.push('QUEUED_FOR_EMBOSSING', 'IN_EMBOSSING', 'EMBOSSING_COMPLETE', 
                 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED');
      break;
    case 'IN_TRANSIT':
      stages.push('QUEUED_FOR_EMBOSSING', 'IN_EMBOSSING', 'EMBOSSING_COMPLETE', 
                 'DISPATCHED', 'IN_TRANSIT');
      break;
    case 'IN_EMBOSSING':
      stages.push('QUEUED_FOR_EMBOSSING', 'IN_EMBOSSING');
      break;
    case 'OUT_FOR_DELIVERY':
      stages.push('QUEUED_FOR_EMBOSSING', 'IN_EMBOSSING', 'EMBOSSING_COMPLETE', 
                 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY');
      break;
    case 'DISPATCHED':
      stages.push('QUEUED_FOR_EMBOSSING', 'IN_EMBOSSING', 'EMBOSSING_COMPLETE', 'DISPATCHED');
      break;
    case 'DELIVERY_FAILED':
      stages.push('QUEUED_FOR_EMBOSSING', 'IN_EMBOSSING', 'EMBOSSING_COMPLETE', 
                 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED');
      break;
    default:
      // For APPROVED, just keep the initial stage
      break;
  }
  
  // Generate events for each stage
  stages.forEach((stage, index) => {
    const event = {
      stage: stage,
      timestamp: new Date(currentTime),
      source: getSourceForStage(stage),
      location: getLocationForStage(stage, cardData.address),
      operatorId: generateOperatorId(),
      eventData: {}
    };
    
    // Add stage-specific data
    switch (stage) {
      case 'IN_EMBOSSING':
        event.batchId = `BATCH${generateToken(6).toUpperCase()}`;
        break;
      case 'DISPATCHED':
      case 'IN_TRANSIT':
        event.trackingId = `TRK${generateToken(10).toUpperCase()}`;
        break;
      case 'DELIVERY_FAILED':
        event.failureReason = getRandomFailureReason();
        break;
    }
    
    // Calculate duration for previous stage
    if (index > 0) {
      const prevEvent = events[index - 1];
      const duration = (currentTime - prevEvent.timestamp) / (1000 * 60); // minutes
      prevEvent.durationMinutes = Math.round(duration);
    }
    
    events.push(event);
    
    // Advance time for next stage
    currentTime = new Date(currentTime.getTime() + getStageDelay(stage));
  });
  
  return events;
}

// Helper functions
function getRandomByDistribution(distribution) {
  const rand = Math.random() * 100;
  let cumulative = 0;
  
  for (const [key, value] of Object.entries(distribution)) {
    cumulative += value;
    if (rand <= cumulative) {
      return key;
    }
  }
  
  return Object.keys(distribution)[0]; // fallback
}

function getSourceForStage(stage) {
  const sources = {
    'APPROVED': 'card_management_service',
    'QUEUED_FOR_EMBOSSING': 'embossing_queue_service',
    'IN_EMBOSSING': 'embossing_service',
    'EMBOSSING_COMPLETE': 'embossing_service',
    'DISPATCHED': 'dispatch_service',
    'IN_TRANSIT': 'logistics_partner',
    'OUT_FOR_DELIVERY': 'delivery_partner',
    'DELIVERED': 'delivery_partner',
    'DELIVERY_FAILED': 'delivery_partner'
  };
  
  return sources[stage] || 'system';
}

function getLocationForStage(stage, address) {
  const region = address.split(',')[0];
  
  const locations = {
    'APPROVED': 'System',
    'QUEUED_FOR_EMBOSSING': 'Mumbai Facility',
    'IN_EMBOSSING': 'Mumbai Facility',
    'EMBOSSING_COMPLETE': 'Mumbai Facility',
    'DISPATCHED': 'Mumbai Hub',
    'IN_TRANSIT': `${region} Hub`,
    'OUT_FOR_DELIVERY': `${region} Delivery Center`,
    'DELIVERED': 'Customer Address',
    'DELIVERY_FAILED': `${region} Delivery Center`
  };
  
  return locations[stage] || region;
}

function generateOperatorId() {
  const operators = ['OP001', 'OP002', 'OP003', 'SYS001', 'AUTO001'];
  return operators[Math.floor(Math.random() * operators.length)];
}

function getRandomFailureReason() {
  const reasons = [
    'Customer not available',
    'Incorrect address',
    'Customer refused delivery',
    'Building access denied',
    'Phone number not reachable',
    'Address incomplete'
  ];
  
  return reasons[Math.floor(Math.random() * reasons.length)];
}

function getStageDelay(stage) {
  // Return delay in milliseconds for realistic timing
  const delays = {
    'APPROVED': 1000 * 60 * 15,           // 15 minutes
    'QUEUED_FOR_EMBOSSING': 1000 * 60 * 60 * 2,  // 2 hours
    'IN_EMBOSSING': 1000 * 60 * 60 * 4,   // 4 hours
    'EMBOSSING_COMPLETE': 1000 * 60 * 60 * 12, // 12 hours
    'DISPATCHED': 1000 * 60 * 60 * 6,     // 6 hours
    'IN_TRANSIT': 1000 * 60 * 60 * 24,    // 24 hours
    'OUT_FOR_DELIVERY': 1000 * 60 * 60 * 4,   // 4 hours
    'DELIVERED': 0,
    'DELIVERY_FAILED': 1000 * 60 * 60 * 2 // 2 hours
  };
  
  const baseDelay = delays[stage] || 1000 * 60 * 30; // 30 minutes default
  const variation = baseDelay * 0.3; // ±30% variation
  
  return baseDelay + (Math.random() - 0.5) * 2 * variation;
}

// Main seeding function
async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Connect to database
    await connectDB();
    
    // Clear existing data (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('🗑️ Clearing existing data...');
      await mongoose.connection.db.collection('card_journeys').deleteMany({});
      await mongoose.connection.db.collection('bottleneck_analysis').deleteMany({});
    }
    
    const totalCards = SEED_CONFIG.totalCards;
    let createdCount = 0;
    
    console.log(`📦 Creating ${totalCards} sample cards...`);
    
    // Create cards in batches
    for (let i = 0; i < totalCards; i += SEED_CONFIG.batchSize) {
      const batch = [];
      
      for (let j = 0; j < SEED_CONFIG.batchSize && (i + j) < totalCards; j++) {
        const cardIndex = i + j;
        const cardData = generateCardData(cardIndex);
        const finalStatus = getRandomByDistribution(SEED_CONFIG.statusDistribution);
        
        // Create card with initial status
        try {
          const card = await cardService.createCard(cardData);
          
          // If final status is not APPROVED, simulate journey
          if (finalStatus !== 'APPROVED') {
            const events = generateJourneyEvents(cardData, finalStatus);
            
            // Apply each event to update the card status
            for (let k = 1; k < events.length; k++) { // Skip first APPROVED event
              const event = events[k];
              await cardService.updateCardStatus(cardData.cardId, {
                status: event.stage,
                source: event.source,
                location: event.location,
                operatorId: event.operatorId,
                batchId: event.batchId,
                trackingId: event.trackingId,
                failureReason: event.failureReason,
                eventData: event.eventData
              });
            }
          }
          
          createdCount++;
          
          if (createdCount % 10 === 0) {
            console.log(`✅ Created ${createdCount}/${totalCards} cards`);
          }
          
        } catch (error) {
          console.error(`❌ Failed to create card ${cardData.cardId}:`, error.message);
        }
      }
      
      // Small delay between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`🎉 Seeding completed! Created ${createdCount} cards`);
    
    // Generate summary
    await generateSeedSummary();
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
  }
}

// Generate and display summary of seeded data
async function generateSeedSummary() {
  try {
    const CardJourney = require('../models/CardJourney');
    
    const summary = await CardJourney.aggregate([
      {
        $group: {
          _id: '$currentStatus',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📊 Seeding Summary:');
    console.log('==================');
    
    summary.forEach(item => {
      console.log(`${item._id}: ${item.count} cards`);
    });
    
    const totalCards = summary.reduce((sum, item) => sum + item.count, 0);
    console.log(`\nTotal: ${totalCards} cards created`);
    
  } catch (error) {
    console.error('Failed to generate summary:', error);
  }
}

// Command line execution
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, generateCardData };