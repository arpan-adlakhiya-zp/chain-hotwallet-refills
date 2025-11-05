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

    // For POST/PUT/PATCH requests: Use raw body as JWT
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
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
    // For GET/DELETE requests: Use request parameters as JWT
    else if (['GET', 'DELETE'].includes(req.method)) {
      if (!req.params) {
        logger.error('Query parameters are missing');
        return res.status(400).json({
          success: false,
          error: 'Query parameters are required',
          code: 'MISSING_QUERY_PARAMETERS'
        });
      }
      
      // Get token from refill_request_id parameter
      if (req.params.refill_request_id && typeof req.params.refill_request_id === 'string' && req.params.refill_request_id.length > 0) {
        token = req.params.refill_request_id;
      }
    } else {
      logger.error(`Unsupported HTTP method: ${req.method}`);
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED'
      });
    }

    // Decode the JWT to log request details
    const decoded = jwt.decode(token);
    logger.debug(`Decoded JWT: ${JSON.stringify(decoded, null, 2)}`);
    logger.info(`Authentication request received for: ${decoded?.refill_request_id || 'unknown'}`);

    // Verify the JWT signature
    const verified = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    
    logger.info(`Request authenticated successfully for: ${verified.refill_request_id || 'unknown'}`);
    
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

