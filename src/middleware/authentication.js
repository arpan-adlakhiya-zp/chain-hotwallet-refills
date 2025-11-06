const jwt = require('jsonwebtoken');
const logger = require('./logger')('authentication');
const config = require('../config');

/**
 * Middleware to authenticate incoming requests using JWT
 * Verifies the JWT signature using the configured public key
 * 
 * For POST requests: JWT is the entire request body (raw body)
 * For GET requests: JWT is passed as URL parameter (:refill_request_id)
 */
function authenticate(req, res, next) {
  try {
    // Check if authentication is enabled
    const authEnabled = config.get('authEnabled');
  
  if (authEnabled === false) {
    logger.info('Authentication is DISABLED - skipping verification');
    // Use the first non-empty object (check if object has keys)
    // Only use req.body if it's an object (not a string from text parser)
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && Object.keys(req.body).length > 0) {
      req.verifiedData = req.body;
    } else if (req.params && Object.keys(req.params).length > 0) {
      req.verifiedData = req.params;
    } else if (req.query && Object.keys(req.query).length > 0) {
      req.verifiedData = req.query;
    } else {
      req.verifiedData = {};
    }
    return next();
  }

    // Get the public key for verification from config
    const publicKey = config.get('authPublicKey');
    
    if (!publicKey) {
      logger.error('Authentication public key not configured');
      return res.status(500).json({
        success: false,
        error: 'Authentication not properly configured',
        code: 'AUTH_CONFIG_ERROR'
      });
    }

    let token = null;

    // For POST requests: Use raw body as JWT
    if (req.method === 'POST') {
      // Check both req.body (from express.text) and req.rawBody (from express.json verify)
      // Use the first one that's a non-empty string
      if (typeof req.body === 'string' && req.body.length > 0) {
        token = req.body;
      } else if (typeof req.rawBody === 'string' && req.rawBody.length > 0) {
        token = req.rawBody;
      }
      
      if (!token) {
        logger.error('Raw body not available for JWT verification');
        return res.status(401).json({
          success: false,
          error: 'Invalid request format - JWT body required',
          code: 'INVALID_REQUEST_FORMAT'
        });
      }
    }
    // For GET requests: Use Authorization header with Bearer token
    else if (req.method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        logger.error('Authorization header is missing');
        return res.status(401).json({
          success: false,
          error: 'Authorization header is required',
          code: 'MISSING_AUTHORIZATION_HEADER'
        });
      }
      
      // Extract token from "Bearer <token>"
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        logger.error('Invalid Authorization header format');
        return res.status(401).json({
          success: false,
          error: 'Invalid Authorization header format. Expected: Bearer <token>',
          code: 'INVALID_AUTHORIZATION_FORMAT'
        });
      }
      
      token = parts[1];
      
      if (!token || token.length === 0) {
        logger.error('Bearer token is empty');
        return res.status(401).json({
          success: false,
          error: 'Bearer token is required',
          code: 'MISSING_BEARER_TOKEN'
        });
      }
    } else {
      // Only POST and GET methods are supported
      logger.error(`Unsupported HTTP method: ${req.method}`);
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Only POST and GET are supported.',
        code: 'METHOD_NOT_ALLOWED'
      });
    }

    // Decode the JWT to log request details
    const decoded = jwt.decode(token);
    logger.debug(`Decoded JWT: ${JSON.stringify(decoded, null, 2)}`);
    logger.info(`Authentication request received for: ${decoded?.refill_request_id}`);

    // Get configuration for JWT validation
    const maxLifetime = config.get('jwtMaxLifetime') || 300; // 5 minutes default
    logger.debug(`Configured JWT max lifetime: ${maxLifetime} seconds`);

    // Validate JWT lifetime BEFORE verification
    // This ensures we reject tokens with excessive expiration times
    if (decoded && decoded.exp && decoded.iat) {
      logger.debug(`JWT expiration time: ${new Date(decoded.exp * 1000).toISOString()}`);
      logger.debug(`JWT issued at time: ${new Date(decoded.iat * 1000).toISOString()}`);
      const jwtLifetime = decoded.exp - decoded.iat;
      
      if (jwtLifetime > maxLifetime) {
        logger.error(`JWT lifetime exceeds maximum allowed: ${jwtLifetime}s > ${maxLifetime}s`);
        return res.status(401).json({
          success: false,
          error: `JWT lifetime exceeds maximum allowed duration of ${maxLifetime} seconds`,
          code: 'JWT_LIFETIME_EXCEEDED',
          data: {
            expirationTime: new Date(decoded.exp * 1000).toISOString(),
            issuedAtTime: new Date(decoded.iat * 1000).toISOString(),
            jwtLifetime: jwtLifetime,
            maxAllowedLifetime: maxLifetime,
            details: `Token was created with ${jwtLifetime}s validity, but maximum allowed is ${maxLifetime}s`
          }
        });
      }
      
      logger.debug(`JWT lifetime validation passed: ${jwtLifetime}s <= ${maxLifetime}s`);
    } else if (decoded && (!decoded.exp || !decoded.iat)) {
      // JWT has no exp or no iat - we can't validate lifetime
      logger.warn('JWT has exp but missing iat claim - cannot validate lifetime');
    }

    // Verify the JWT signature and expiration
    const verified = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    
    logger.info(`Request authenticated successfully for: ${verified.refill_request_id}`);
    
    // Attach verified data to request for use in controllers
    req.verifiedData = verified;
    
    next();
  } catch (error) {
    logger.error(`Authentication failed: ${error.message}`);
    
    // Determine specific error type
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid JWT token',
        code: 'INVALID_TOKEN'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'JWT token has expired',
        code: 'TOKEN_EXPIRED'
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_FAILED'
      });
    }
  }
}

module.exports = {
  authenticate
};

