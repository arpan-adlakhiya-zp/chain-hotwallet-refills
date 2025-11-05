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

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
      mockReq.rawBody = token;

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

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

      const token = jwt.sign(payload, wrongPrivateKey, { algorithm: 'RS256' });
      mockReq.rawBody = token;

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

    it('should reject expired JWT token', () => {
      const payload = {
        refill_request_id: 'REQ003',
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      };

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', noTimestamp: true });
      mockReq.rawBody = token;

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

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

    it('should attach verified data to request object', () => {
      const payload = {
        refill_request_id: 'REQ004',
        wallet_address: '0xabc',
        asset_symbol: 'ETH',
        refill_amount: '10.0'
      };

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
      mockReq.rawBody = token;
      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

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

      const payload = { refill_request_id: 'REQ005' };
      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
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
    it('should authenticate GET request with valid JWT token in URL parameter', () => {
      mockReq.method = 'GET';
      const payload = {
        refill_request_id: 'REQ007',
        user: 'test-user'
      };

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
      mockReq.params = { refill_request_id: token };

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.verifiedData).toBeDefined();
      expect(mockReq.verifiedData.refill_request_id).toBe('REQ007');
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject GET request without params', () => {
      mockReq.method = 'GET';
      mockReq.params = undefined;

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Query parameters are required',
          code: 'MISSING_QUERY_PARAMETERS'
        })
      );
    });

    it('should reject GET request with empty params', () => {
      mockReq.method = 'GET';
      mockReq.params = {};

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

    it('should reject GET request with invalid JWT token', () => {
      mockReq.method = 'GET';
      mockReq.params = { refill_request_id: 'invalid.jwt.token' };

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

    it('should authenticate DELETE request with valid JWT token in URL parameter', () => {
      mockReq.method = 'DELETE';
      const payload = { refill_request_id: 'REQ008' };

      const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
      mockReq.params = { refill_request_id: token };

      config.get.mockReturnValueOnce(true); // authEnabled
      config.get.mockReturnValueOnce(publicKey); // authPublicKey

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.verifiedData.refill_request_id).toBe('REQ008');
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

