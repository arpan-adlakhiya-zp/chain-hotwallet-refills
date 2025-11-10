const jwt = require('jsonwebtoken');
const { authenticate } = require('../../../middleware/authentication');
const config = require('../../../config');

jest.mock('../../../config');
jest.mock('../../../middleware/logger');

describe('Authentication Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let publicKey;
  let privateKey;

  beforeEach(() => {
    // Generate test RSA key pair for testing
    const crypto = require('crypto');
    const { publicKey: pubKey, privateKey: privKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    publicKey = pubKey;
    privateKey = privKey;

    mockReq = {
      method: 'POST',
      body: {},
      rawBody: '',
      headers: {}
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    mockNext = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should successfully authenticate valid JWT token when authEnabled is true', () => {
      const payload = {
        refill_request_id: 'REQ001',
        wallet_address: '0x123',
        asset_symbol: 'BTC'
      };

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '5m' });
      mockReq.rawBody = token;

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey
      config.get.mockReturnValueOnce(300); // jwtMaxLifetimeInSeconds

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.verifiedData).toBeDefined();
      expect(mockReq.verifiedData.refill_request_id).toBe('REQ001');
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should skip authentication when authEnabled is false', () => {
      config.get.mockReturnValue(false); // authEnabled = false
      mockReq.body = {
        refill_request_id: 'REQ001',
        wallet_address: '0x123'
      };

      authenticate(mockReq, mockRes, mockNext);

      expect(mockReq.verifiedData).toEqual(mockReq.body);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject invalid JWT token', () => {
      const invalidToken = 'invalid.jwt.token';
      mockReq.rawBody = invalidToken;

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid JWT token',
          code: 'INVALID_TOKEN'
        })
      );
    });

    it('should reject JWT signed with wrong key', () => {
      const payload = { refill_request_id: 'REQ002' };
      
      // Create a different key pair
      const crypto = require('crypto');
      const { privateKey: wrongPrivateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });

      const token = jwt.sign(payload, wrongPrivateKey, { algorithm: 'RS256', expiresIn: '5m' });
      mockReq.rawBody = token;

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey
      config.get.mockReturnValueOnce(300); // jwtMaxLifetimeInSeconds

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid JWT token',
          code: 'INVALID_TOKEN'
        })
      );
    });

    it('should reject expired JWT token', () => {
      const payload = {
        refill_request_id: 'REQ003'
      };

      // Create a token that expires in -1 hour (already expired)
      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '-1h' });
      mockReq.rawBody = token;

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey
      config.get.mockReturnValueOnce(3600); // jwtMaxLifetimeInSeconds - must be >= token lifetime (1 hour)

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'JWT token has expired',
          code: 'TOKEN_EXPIRED'
        })
      );
    });

    it('should return 500 when public key is not configured', () => {
      mockReq.rawBody = 'some.jwt.token';
      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(null); // authPublicKey not set

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Authentication not properly configured',
          code: 'AUTH_CONFIG_ERROR'
        })
      );
    });

    it('should return 401 when rawBody is not available for POST request', () => {
      delete mockReq.rawBody;
      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid request format - JWT body required',
          code: 'INVALID_REQUEST_FORMAT'
        })
      );
    });

    it('should handle malformed JWT gracefully', () => {
      mockReq.rawBody = 'not-a-jwt-token';
      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_TOKEN'
        })
      );
    });

    it('should reject JWT with excessive lifetime (> 5 minutes)', () => {
      const payload = {
        refill_request_id: 'REQ_EXCESSIVE_LIFETIME'
      };

      // Create token with 1 hour expiration (expiresIn will set exp = iat + 3600)
      const token = jwt.sign(payload, privateKey, { 
        algorithm: 'RS256',
        expiresIn: '1h' // 3600 seconds - exceeds 5 minute max
      });
      mockReq.rawBody = token;

      config.get.mockReturnValueOnce(undefined); // authEnabled (not false, so auth is enabled)
      config.get.mockReturnValueOnce(publicKey); // authPublicKey
      config.get.mockReturnValueOnce(300); // jwtMaxLifetimeInSeconds (5 minutes)

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'JWT lifetime exceeds maximum allowed duration of 300 seconds',
          code: 'JWT_LIFETIME_EXCEEDED',
          data: expect.objectContaining({
            expirationTime: expect.any(String),
            issuedAtTime: expect.any(String),
            jwtLifetime: 3600,
            maxAllowedLifetime: 300
          })
        })
      );
    });

    it('should accept JWT with valid lifetime (≤ 5 minutes)', () => {
      const payload = {
        refill_request_id: 'REQ_VALID_LIFETIME',
        wallet_address: '0x123'
      };

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '5m' });
      mockReq.rawBody = token;

      config.get.mockReturnValueOnce(undefined); // authEnabled (not false, so auth is enabled)
      config.get.mockReturnValueOnce(publicKey); // authPublicKey
      config.get.mockReturnValueOnce(300); // jwtMaxLifetimeInSeconds (5 minutes)

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.verifiedData).toBeDefined();
      expect(mockReq.verifiedData.refill_request_id).toBe('REQ_VALID_LIFETIME');
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should accept JWT with lifetime less than maximum', () => {
      const payload = {
        refill_request_id: 'REQ_SHORT_LIFETIME',
        wallet_address: '0x123'
      };

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '1m' });
      mockReq.rawBody = token;

      config.get.mockReturnValueOnce(undefined); // authEnabled (not false, so auth is enabled)
      config.get.mockReturnValueOnce(publicKey); // authPublicKey
      config.get.mockReturnValueOnce(300); // jwtMaxLifetimeInSeconds (5 minutes)

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.verifiedData).toBeDefined();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow custom jwtMaxLifetimeInSeconds configuration', () => {
      const payload = {
        refill_request_id: 'REQ_CUSTOM_LIFETIME',
        wallet_address: '0x123'
      };

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '10m' });
      mockReq.rawBody = token;

      config.get.mockReturnValueOnce(undefined); // authEnabled (not false, so auth is enabled)
      config.get.mockReturnValueOnce(publicKey); // authPublicKey
      config.get.mockReturnValueOnce(600); // jwtMaxLifetimeInSeconds (10 minutes - custom)

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.verifiedData).toBeDefined();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should attach verified data to request object', () => {
      const payload = {
        refill_request_id: 'REQ004',
        wallet_address: '0xabc',
        asset_symbol: 'ETH',
        refill_amount: '10.0'
      };

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '5m' });
      mockReq.rawBody = token;
      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey
      config.get.mockReturnValueOnce(300); // jwtMaxLifetimeInSeconds

      authenticate(mockReq, mockRes, mockNext);

      expect(mockReq.verifiedData).toEqual(
        expect.objectContaining({
          refill_request_id: 'REQ004',
          wallet_address: '0xabc',
          asset_symbol: 'ETH',
          refill_amount: '10.0'
        })
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use authentication when authEnabled is not set (defaults to enabled)', () => {
      config.get.mockReturnValueOnce(undefined); // authEnabled not set (defaults to enabled)
      config.get.mockReturnValueOnce(publicKey); // authPublicKey
      config.get.mockReturnValueOnce(300); // jwtMaxLifetimeInSeconds

      const payload = { refill_request_id: 'REQ005' };
      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '5m' });
      mockReq.rawBody = token;

      authenticate(mockReq, mockRes, mockNext);

      expect(mockReq.verifiedData).toBeDefined();
      expect(mockReq.verifiedData.refill_request_id).toBe('REQ005');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not use body as fallback when rawBody missing and auth enabled', () => {
      delete mockReq.rawBody;
      mockReq.body = { refill_request_id: 'REQ006' };
      
      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockReq.verifiedData).toBeUndefined();
    });
  });

  describe('authenticate - GET requests', () => {
    it('should authenticate GET request with valid JWT token in Authorization header', () => {
      mockReq.method = 'GET';
      const payload = {
        refill_request_id: 'REQ007',
        user: 'test-user'
      };

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '5m' });
      mockReq.headers.authorization = `Bearer ${token}`;
      mockReq.params = { refill_request_id: 'REQ007' };

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey
      config.get.mockReturnValueOnce(300); // jwtMaxLifetimeInSeconds

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.verifiedData).toBeDefined();
      expect(mockReq.verifiedData.refill_request_id).toBe('REQ007');
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject GET request without Authorization header', () => {
      mockReq.method = 'GET';
      mockReq.params = { refill_request_id: 'REQ007' };
      delete mockReq.headers.authorization;

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Authorization header is required',
          code: 'MISSING_AUTHORIZATION_HEADER'
        })
      );
    });

    it('should reject GET request with invalid Authorization header format', () => {
      mockReq.method = 'GET';
      mockReq.headers.authorization = 'InvalidFormat token123';
      mockReq.params = { refill_request_id: 'REQ007' };

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid Authorization header format. Expected: Bearer <token>',
          code: 'INVALID_AUTHORIZATION_FORMAT'
        })
      );
    });

    it('should reject GET request with invalid JWT token', () => {
      mockReq.method = 'GET';
      mockReq.headers.authorization = 'Bearer invalid.jwt.token';
      mockReq.params = { refill_request_id: 'REQ007' };

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid JWT token',
          code: 'INVALID_TOKEN'
        })
      );
    });

    it('should reject GET request with empty Bearer token', () => {
      mockReq.method = 'GET';
      mockReq.headers.authorization = 'Bearer ';
      mockReq.params = { refill_request_id: 'REQ007' };

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Bearer token is required',
          code: 'MISSING_BEARER_TOKEN'
        })
      );
    });

    it('should reject DELETE request (method not allowed)', () => {
      mockReq.method = 'DELETE';
      const payload = { refill_request_id: 'REQ008' };

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
      mockReq.headers.authorization = `Bearer ${token}`;

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(405);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Method not allowed. Only POST and GET are supported.',
          code: 'METHOD_NOT_ALLOWED'
        })
      );
    });

    it('should skip authentication for GET requests when authEnabled is false', () => {
      mockReq.method = 'GET';
      delete mockReq.body;  // GET requests don't have body
      mockReq.params = { refill_request_id: 'REQ009' };
      config.get.mockReturnValue(false); // authEnabled = false

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.verifiedData).toEqual(expect.objectContaining({
        refill_request_id: 'REQ009'
      }));
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});

