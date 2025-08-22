require('dotenv').config();
const twilio = require('twilio');

// SMS Service class
class SMSService {
  constructor() {
    this.client = null;
    this.isEnabled = false;
    this.fromNumber = null;
    this.initialized = false;
    
    this.initializeService();
  }

  initializeService() {
    try {
      console.log('🔍 Initializing SMS Service...');
      
      // Debug Twilio configuration
      this.debugTwilioConfig();
      
      // Validate configuration
      if (!this.validateSMSConfig()) {
        console.warn('⚠️ SMS service disabled due to missing configuration');
        this.isEnabled = false;
        this.initialized = true;
        return;
      }

      // Initialize Twilio client
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER;

      this.client = twilio(accountSid, authToken);
      this.isEnabled = true;
      this.initialized = true;
      
      console.log('✅ SMS service initialized successfully', {
        fromNumber: this.maskPhoneNumber(this.fromNumber),
        enabled: this.isEnabled
      });

    } catch (error) {
      console.error('❌ Failed to initialize SMS service:', error);
      this.isEnabled = false;
      this.initialized = true;
    }
  }

  debugTwilioConfig() {
    console.log('🔍 Checking Twilio configuration:');
    console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Missing');
    console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✅ Set' : '❌ Missing');
    console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER ? '✅ Set' : '❌ Missing');
  }

  validateSMSConfig() {
    const requiredEnvVars = [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_PHONE_NUMBER'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
      return false;
    }
    
    return true;
  }

  async getUserById(userId) {
    try {
      // Import CardJourney model dynamically to avoid circular dependencies
      const CardJourney = require('../models/CardJourney');
      const mongoose = require('mongoose');
      
      console.log(`🔍 Searching for user: ${userId}`);
      
      // Build search criteria - exclude _id if it's not a valid ObjectId
      const searchCriteria = [];
      
      // Always search by customerId and cardId (your main identifiers)
      searchCriteria.push(
        { customerId: userId },
        { cardId: userId }
      );
      
      // Only search by _id if userId is a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(userId)) {
        searchCriteria.push({ _id: userId });
      }
      
      const cardJourney = await CardJourney.findOne({ 
        $or: searchCriteria
      });

      if (!cardJourney) {
        console.warn(`⚠️ User not found: ${userId}`);
        return null;
      }

      console.log(`✅ User found: ${cardJourney.customerName} (${cardJourney.customerId})`);

      // Check if we have a mobile number
      if (!cardJourney.mobileNumber) {
        console.warn(`⚠️ No mobile number in database for user: ${userId}`);
        return null;
      }

      console.log(`📱 Mobile number found: ${this.isEncrypted(cardJourney.mobileNumber) ? 'Encrypted' : 'Plain'} - ${cardJourney.mobileNumber.substring(0, 10)}...`);

      // Handle encrypted mobile number
      let mobileNumber = cardJourney.mobileNumber;
      
      // If mobile number is encrypted, try to decrypt it
      if (this.isEncrypted(mobileNumber)) {
        try {
          const { decrypt } = require('../utils/encryption');
          mobileNumber = decrypt(mobileNumber);
          console.log(`🔓 Successfully decrypted mobile number`);
        } catch (decryptError) {
          console.error('❌ Failed to decrypt mobile number:', decryptError.message);
          return null;
        }
      }

      const formattedMobile = this.formatMobileNumber(mobileNumber);
      
      if (!formattedMobile) {
        console.warn(`⚠️ Could not format mobile number for user: ${userId}`);
        return null;
      }

      console.log(`✅ Successfully retrieved user details: ${cardJourney.customerName}, Mobile: ${this.maskPhoneNumber(formattedMobile)}`);

      return {
        id: cardJourney.customerId,
        cardId: cardJourney.cardId,
        name: cardJourney.customerName,
        mobileNumber: formattedMobile,
        currentStatus: cardJourney.currentStatus
      };

    } catch (error) {
      console.error('❌ Database error getting user:', error.message);
      return null;
    }
  }

  isEncrypted(value) {
    // Your encryption format: "32256849ba8ef104d90796cabb31103d:c8bf3f9d37338fc2e15ca97f03bc5b3f"
    // Pattern: 32 hex chars : 32 hex chars
    return value && typeof value === 'string' && /^[a-f0-9]{32}:[a-f0-9]{32}$/.test(value);
  }

  formatMobileNumber(mobile) {
    if (!mobile) return null;
    
    // Remove any spaces, dashes, or special characters except +
    const cleanNumber = mobile.replace(/[^\d+]/g, '');
    
    // Handle different Indian mobile number formats
    if (cleanNumber.startsWith('+91')) {
      return cleanNumber;
    } else if (cleanNumber.startsWith('91') && cleanNumber.length === 12) {
      return '+' + cleanNumber;
    } else if (cleanNumber.startsWith('0') && cleanNumber.length === 11) {
      return '+91' + cleanNumber.substring(1);
    } else if (cleanNumber.length === 10) {
      return '+91' + cleanNumber;
    }
    
    // For international numbers or unusual formats
    console.warn(`⚠️ Unusual mobile number format: ${this.maskPhoneNumber(mobile)}`);
    return cleanNumber.startsWith('+') ? cleanNumber : '+' + cleanNumber;
  }

  async sendSMSToUser(userId, type, data) {
    console.log(`📱 Attempting to send SMS - Service enabled: ${this.isEnabled}, Initialized: ${this.initialized}`);
    
    if (!this.initialized) {
      console.warn('⚠️ SMS service not initialized yet, attempting to initialize...');
      this.initializeService();
    }

    if (!this.isEnabled) {
      console.log('ℹ️ SMS service disabled, skipping SMS send', { userId, type });
      return { success: false, reason: 'SMS service disabled' };
    }

    try {
      // Get user's mobile number from database
      const user = await this.getUserById(userId);
      if (!user || !user.mobileNumber) {
        console.warn(`⚠️ No mobile number found for user: ${userId}`);
        return { success: false, error: 'No mobile number found' };
      }

      // Create SMS message content
      const smsMessage = this.createSMSMessage(type, data);
      
      // Send SMS using Twilio
      const result = await this.sendSMS(user.mobileNumber, smsMessage);
      
      console.log('✅ SMS sent successfully', {
        userId,
        mobile: this.maskPhoneNumber(user.mobileNumber),
        type,
        messageSid: result.sid
      });
      
      return { success: true, result };
      
    } catch (error) {
      console.error('❌ SMS sending failed:', error, { userId, type });
      return { success: false, error: error.message };
    }
  }

  createSMSMessage(type, data) {
    const templates = {
      'CARD_STATUS_UPDATE': (data) => 
        `🏦 Card Update: Your card ${data.cardId} status changed to ${data.newStatus}${data.location ? `. Location: ${data.location}` : ''}`,
      
      'CARD_APPROVED': (data) =>
        `🎉 Hello ${data.customerName}, your card ${data.cardId} has been approved!${data.estimatedDelivery ? ` Expected delivery: ${data.estimatedDelivery}` : ''}`,
      
      'APPROVED': (data) =>
        `🎉 Great news ${data.customerName}! Your card ${data.cardId} application has been approved and is being processed.`,
      
      'EMBOSSING_QUEUED': (data) =>
        `⏳ Your card ${data.cardId} is queued for embossing. We'll update you once it's ready.`,
        
      'EMBOSSING_COMPLETE': (data) =>
        `✅ Your card ${data.cardId} embossing is complete and ready for dispatch.`,
      
      'CARD_DISPATCHED': (data) =>
        `📮 Your card ${data.cardId} has been dispatched${data.location ? ` from ${data.location}` : ''}. Expected delivery in 2-3 business days.`,

      'DISPATCHED': (data) =>
        `📮 Your card ${data.cardId} has been dispatched${data.location ? ` from ${data.location}` : ''}. Track your delivery for updates.`,

      'IN_TRANSIT': (data) =>
        `🚚 Your card ${data.cardId} is in transit${data.location ? ` at ${data.location}` : ''}. Expected delivery soon.`,

      'OUT_FOR_DELIVERY': (data) =>
        `🚛 Your card ${data.cardId} is out for delivery today. Please be available to receive it.`,

      'DELIVERED': (data) =>
        `✅ Great news! Your card ${data.cardId} has been delivered successfully. Enjoy your new card!`,

      'CARD_DELIVERED': (data) =>
        `✅ Great news! Your card ${data.cardId} has been delivered successfully. Enjoy your new card!`,

      'DELIVERY_FAILED': (data) =>
        `❌ Delivery attempt failed for card ${data.cardId}${data.failureReason ? `. Reason: ${data.failureReason}` : ''}. We'll retry delivery tomorrow.`,

      'FAILED': (data) =>
        `❌ There was an issue with your card ${data.cardId}. Our customer service team will contact you shortly.`,

      'PAYMENT_SUCCESS': (data) => 
        `💳 Payment Success: ₹${data.amount} paid successfully. Transaction ID: ${data.transactionId}`,
      
      'OTP_VERIFICATION': (data) => 
        `🔑 Your OTP is ${data.otp}. Valid for 5 minutes. Do not share with anyone.`
    };
    
    const template = templates[type];
    if (!template) {
      console.warn(`⚠️ No template found for SMS type: ${type}, using default`);
      return `📋 Card Update: Your card ${data.cardId || 'N/A'} status has been updated to ${data.newStatus || type}.`;
    }
    
    const message = template(data);
    
    // Ensure message length is within SMS limits
    if (message.length > 160) {
      console.warn(`⚠️ SMS message is ${message.length} characters (over 160 limit)`);
      // Truncate if too long
      return message.substring(0, 157) + '...';
    }
    
    return message;
  }

  async sendSMS(mobileNumber, message) {
    if (!this.client) {
      throw new Error('SMS service not initialized - missing Twilio credentials');
    }

    // Validate inputs
    if (!mobileNumber) {
      throw new Error('Mobile number is required');
    }
    
    if (!message) {
      throw new Error('Message content is required');
    }

    if (!this.fromNumber) {
      throw new Error('Twilio phone number not configured');
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: mobileNumber
      });
      
      return result;
      
    } catch (error) {
      // Enhanced error handling for Twilio-specific errors
      if (error.code) {
        switch (error.code) {
          case 21211:
            throw new Error('Invalid phone number format');
          case 21408:
            throw new Error('Permission denied for this phone number');
          case 21610:
            throw new Error('Phone number is blacklisted');
          case 21614:
            throw new Error('Invalid mobile number');
          case 30001:
            throw new Error('Queue overflow - message not sent');
          default:
            throw new Error(`Twilio error ${error.code}: ${error.message}`);
        }
      }
      throw new Error(`SMS sending failed: ${error.message}`);
    }
  }

  // Utility function to mask phone numbers for logging
  maskPhoneNumber(phone) {
    if (!phone || phone.length < 4) return '****';
    return `****${phone.slice(-4)}`;
  }

  // Health check method
  async testConnection() {
    if (!this.isEnabled) {
      return { status: 'disabled', message: 'SMS service is disabled' };
    }

    try {
      // Test Twilio connection by validating phone number
      const lookup = await this.client.lookups.phoneNumbers(this.fromNumber).fetch();
      return { 
        status: 'healthy', 
        message: 'SMS service is working',
        phoneNumber: this.maskPhoneNumber(lookup.phoneNumber)
      };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  // Method to send card status update SMS (commonly used)
  async sendCardStatusUpdateSMS(cardId, newStatus, location = null, customerDetails = null) {
    try {
      let userDetails = customerDetails;
      
      if (!userDetails) {
        // Try to get customer details from cardId first, then customerId
        userDetails = await this.getUserById(cardId);
      }

      if (!userDetails) {
        console.warn(`⚠️ Could not find customer details for: ${cardId}`);
        return { success: false, error: 'Customer details not found' };
      }

      const smsData = {
        cardId: userDetails.cardId || cardId,
        newStatus,
        location,
        customerName: userDetails.name
      };

      // Use the status as the SMS type if it matches our templates, otherwise use generic update
      const smsType = this.hasTemplate(newStatus) ? newStatus : 'CARD_STATUS_UPDATE';

      console.log(`📱 Sending ${smsType} SMS for card: ${cardId} to ${userDetails.name}`);

      return await this.sendSMSToUser(userDetails.id, smsType, smsData);
      
    } catch (error) {
      console.error('❌ Error sending card status SMS:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Check if we have a template for this status
  hasTemplate(status) {
    const templates = [
      'APPROVED', 'EMBOSSING_QUEUED', 'EMBOSSING_COMPLETE', 
      'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 
      'DELIVERED', 'FAILED', 'DELIVERY_FAILED'
    ];
    return templates.includes(status);
  }

  // Debug method to check what's in the database
  async debugUserSearch(userId) {
    try {
      const CardJourney = require('../models/CardJourney');
      
      console.log(`🔍 DEBUG: Searching for user: ${userId}`);
      
      // Search by different fields individually
      const byCustomerId = await CardJourney.findOne({ customerId: userId });
      const byCardId = await CardJourney.findOne({ cardId: userId });
      
      console.log(`🔍 DEBUG Results:`);
      console.log(`  - Found by customerId: ${byCustomerId ? '✅' : '❌'}`);
      console.log(`  - Found by cardId: ${byCardId ? '✅' : '❌'}`);
      
      if (byCustomerId) {
        console.log(`  - Customer Name: ${byCustomerId.customerName}`);
        console.log(`  - Mobile Number: ${byCustomerId.mobileNumber ? this.maskPhoneNumber(byCustomerId.mobileNumber) : 'Not found'}`);
      }
      
      if (byCardId) {
        console.log(`  - Customer Name: ${byCardId.customerName}`);
        console.log(`  - Mobile Number: ${byCardId.mobileNumber ? this.maskPhoneNumber(byCardId.mobileNumber) : 'Not found'}`);
      }
      
      // Also show a sample of what records exist
      const sampleRecords = await CardJourney.find({}).limit(3).select('customerId cardId customerName mobileNumber');
      console.log(`🔍 DEBUG: Sample records in database:`, sampleRecords.map(r => ({
        customerId: r.customerId,
        cardId: r.cardId,
        customerName: r.customerName,
        hasMobile: !!r.mobileNumber
      })));
      
    } catch (error) {
      console.error('❌ Debug search failed:', error.message);
    }
  }

  // Get service status
  getStatus() {
    return {
      enabled: this.isEnabled,
      initialized: this.initialized,
      fromNumber: this.fromNumber ? this.maskPhoneNumber(this.fromNumber) : null,
      hasClient: !!this.client,
      configValid: this.validateSMSConfig()
    };
  }
}

// Create singleton instance
const smsService = new SMSService();

// Legacy function exports for backward compatibility
const sendSMSToUser = async (userId, type, data) => {
  return await smsService.sendSMSToUser(userId, type, data);
};

const sendSMS = async (mobileNumber, message) => {
  return await smsService.sendSMS(mobileNumber, message);
};

const createSMSMessage = (type, data) => {
  return smsService.createSMSMessage(type, data);
};

const getUserById = async (userId) => {
  return await smsService.getUserById(userId);
};

const formatMobileNumber = (mobile) => {
  return smsService.formatMobileNumber(mobile);
};

const validateSMSConfig = () => {
  return smsService.validateSMSConfig();
};

const initSMSService = () => {
  return smsService.isEnabled;
};

// Export both the instance and individual functions for flexibility
module.exports = {
  // Main service instance
  smsService,
  
  // Individual functions for backward compatibility
  sendSMSToUser,
  sendSMS,
  createSMSMessage,
  getUserById,
  formatMobileNumber,
  validateSMSConfig,
  initSMSService,
  
  // Class export
  SMSService
};

// Also export the instance as default for simple imports
module.exports.default = smsService;