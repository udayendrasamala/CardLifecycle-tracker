// middleware/index.js - Custom middleware
const { v4: uuidv4 } = require('uuid');

const requestLogger = (req, res, next) => {
  const requestId = uuidv4();
  req.requestId = requestId;
  
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log request
  console.log(`📝 [${timestamp}] ${req.method} ${req.path} - ${requestId} - IP: ${req.ip}`);
  
  // Log request body for POST/PUT (excluding sensitive data)
  if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
    const sanitizedBody = { ...req.body };
    // Remove sensitive fields from logs
    delete sanitizedBody.mobileNumber;
    delete sanitizedBody.address;
    delete sanitizedBody.password;
    
    if (Object.keys(sanitizedBody).length > 0) {
      console.log(`📄 Request body: ${JSON.stringify(sanitizedBody)}`);
    }
  }
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';
    
    console.log(`${statusEmoji} [${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${requestId}`);
    
    // Log slow requests
    if (duration > 5000) { // 5 seconds
      console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.path} took ${duration}ms - ${requestId}`);
    }
  });
  
  next();
};

/**
 * Error handling middleware
 * Centralized error handling for the application
 */
const errorHandler = (err, req, res, next) => {
  const requestId = req.requestId || 'unknown';
  
  console.error(`❌ Error ${requestId}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      value: e.value
    }));
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
      requestId
    });
  }
  
  // Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      error: `Duplicate ${field}`,
      message: `A record with this ${field} already exists`,
      requestId
    });
  }
  
  // Mongoose cast errors (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid data format',
      message: `Invalid ${err.path}: ${err.value}`,
      requestId
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      requestId
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      requestId
    });
  }
  
  // Custom application errors
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      error: err.message,
      requestId
    });
  }
  
  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(statusCode).json({
    success: false,
    error: message,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Async error handler wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Request validation middleware
 * Validates request body against schema
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        error: 'Request validation failed',
        details,
        requestId: req.requestId
      });
    }
    
    next();
  };
};

/**
 * CORS preflight handler
 * Handles OPTIONS requests for CORS
 */
const corsHandler = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
  } else {
    next();
  }
};

/**
 * Security headers middleware
 * Adds security-related headers
 */
const securityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CSP for API (adjust as needed)
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  next();
};

/**
 * Request timeout middleware
 * Adds timeout to requests
 */
const requestTimeout = (timeout = 30000) => {
  return (req, res, next) => {
    res.setTimeout(timeout, () => {
      res.status(408).json({
        success: false,
        error: 'Request timeout',
        requestId: req.requestId
      });
    });
    next();
  };
};

/**
 * Request size limiter
 * Limits request payload size
 */
const limitRequestSize = (limit = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      const limitInMB = parseInt(limit);
      
      if (sizeInMB > limitInMB) {
        return res.status(413).json({
          success: false,
          error: `Request entity too large. Maximum size: ${limit}`,
          requestId: req.requestId
        });
      }
    }
    
    next();
  };
};

/**
 * API key validation middleware
 * Validates API key for webhook endpoints
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key') || req.query.apiKey;
  const validApiKey = process.env.API_KEY || 'commonmannotrequired';
  
  if (!validApiKey) {
    console.warn('⚠️ API_KEY not configured - skipping validation');
    return next();
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing API key',
      requestId: req.requestId
    });
  }
  
  next();
};

/**
 * Health check middleware
 * Provides basic health information
 */
const healthCheck = async (req, res) => {
  const mongoose = require('mongoose');
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    requestId: req.requestId
  };
  
  // Check database connection
  try {
    if (mongoose.connection.readyState === 1) {
      health.database = 'connected';
    } else {
      health.database = 'disconnected';
      health.status = 'unhealthy';
    }
  } catch (error) {
    health.database = 'error';
    health.status = 'unhealthy';
  }
  
  // Check memory usage
  const memUsage = process.memoryUsage();
  health.memory = {
    used: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
    total: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
  };
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
};

module.exports = {
  requestLogger,
  errorHandler,
  asyncHandler,
  validateRequest,
  corsHandler,
  securityHeaders,
  requestTimeout,
  limitRequestSize,
  validateApiKey,
  healthCheck
};