const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

/**
 * Security Middleware Configuration
 */

/**
 * Helmet configuration for security headers
 */
function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
}

/**
 * CORS configuration
 */
function configureCORS() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'];
  
  return cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
}

/**
 * General rate limiter
 */
function configureRateLimit() {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  });
}

/**
 * Strict rate limiter for authentication endpoints
 */
function configureAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Don't count successful logins
  });
}

/**
 * Input sanitization middleware
 */
function sanitizeInput(req, res, next) {
  // Remove any potential XSS from string inputs
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove script tags and other dangerous patterns
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };
  
  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }
  
  next();
}

/**
 * Request ID middleware for correlation
 */
function addRequestId(req, res, next) {
  req.id = require('crypto').randomBytes(16).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  next();
}

module.exports = {
  configureHelmet,
  configureCORS,
  configureRateLimit,
  configureAuthRateLimit,
  sanitizeInput,
  addRequestId
};
