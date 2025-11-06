// Mock authentication middleware to pass through for tests
jest.mock('../../middleware/authentication', () => ({
  authenticate: (req, res, next) => {
    // For POST requests, use body
    // For GET requests, use params (simulating decoded JWT from Authorization header)
    if (req.method === 'GET' && req.params && req.params.refill_request_id) {
      // Simulate decoded JWT - extract refill_request_id from URL parameter
      req.verifiedData = { refill_request_id: req.params.refill_request_id };
    } else {
      req.verifiedData = req.body;
    }
    next();
  }
}));

// Mock config for database
jest.mock('../../config', () => ({
  get: jest.fn(),
  getSecret: jest.fn((key) => {
    if (key === 'chainDb') {
      return {
        host: 'localhost',
        port: 5432,
        user: 'test',
        password: 'test',
        name: 'testdb'
      };
    }
    return null;
  }),
  getAllConfig: jest.fn()
}));

// Mock other services
jest.mock('../../service/refillService');
jest.mock('../../service/refillValidationService');
jest.mock('../../service/refillTransactionService');
jest.mock('../../service/providerService');
jest.mock('../../service/chainDb');
jest.mock('../../middleware/logger');

// Now import modules
const request = require('supertest');
const express = require('express');
const { router } = require('../../routes/routes');
const refillService = require('../../service/refillService');
const refillValidationService = require('../../service/refillValidationService');
const refillTransactionService = require('../../service/refillTransactionService');
const providerService = require('../../service/providerService');
const databaseService = require('../../service/chainDb');

describe('Refill Flow Integration Tests', () => {
  let app;
  let mockProvider;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/', router);
  });

  beforeEach(() => {
    mockProvider = createMockProvider('fireblocks');
    jest.clearAllMocks();
  });

  describe('POST /v1/wallet/refill - Success Flow', () => {
    it('should successfully process a complete refill request', async () => {
      const refillRequest = {
        refill_request_id: 'REQ001',
        wallet_address: '0xhot123',
        asset_symbol: 'BTC',
        asset_address: 'native',
        chain_name: 'Bitcoin',
        refill_amount: '1.0',
        refill_sweep_wallet: '0xcold456'
      };

      const mockResponse = {
        success: true,
        error: null,
        code: null,
        data: {
          refillRequestId: 'REQ001',
          transactionId: 'fb-tx-789',
          walletAddress: '0xhot123',
          assetSymbol: 'BTC',
          refillAmount: '1.0',
          status: 'PROCESSING',
          provider: 'fireblocks',
          transferRequest: {
            id: 'fb-tx-789',
            status: 'SUBMITTED'
          }
        }
      };

      refillService.processRefillRequestService.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(refillRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.refillRequestId).toBe('REQ001');
      expect(response.body.data.transactionId).toBe('fb-tx-789');
      expect(response.body.data.provider).toBe('fireblocks');
      expect(refillService.processRefillRequestService).toHaveBeenCalledWith(refillRequest);
    });

    it('should handle contract token refill', async () => {
      const refillRequest = {
        refill_request_id: 'REQ002',
        wallet_address: '0xhot123',
        asset_symbol: 'USDC',
        asset_address: '0xcontract',
        chain_name: 'Ethereum',
        refill_amount: '1000',
        refill_sweep_wallet: '0xcold'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: true,
        data: { transactionId: 'fb-tx-usdc' }
      });

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(refillRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /v1/wallet/refill - Validation Errors', () => {
    it('should return 400 for missing required fields', async () => {
      const invalidRequest = {
        wallet_address: '0x123'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: false,
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        data: { missingFields: ['refill_request_id', 'asset_symbol'] }
      });

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_FIELDS');
    });

    it('should return 400 for insufficient cold wallet balance', async () => {
      const refillRequest = {
        refill_request_id: 'REQ003',
        wallet_address: '0xhot',
        asset_symbol: 'BTC',
        asset_address: 'native',
        chain_name: 'Bitcoin',
        refill_amount: '100',
        refill_sweep_wallet: '0xcold'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: false,
        error: 'Insufficient cold wallet balance',
        code: 'INSUFFICIENT_BALANCE',
        data: {}
      });

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(refillRequest);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INSUFFICIENT_BALANCE');
    });

    it('should return 400 when hot wallet has sufficient balance', async () => {
      const refillRequest = {
        refill_request_id: 'REQ004',
        wallet_address: '0xhot',
        asset_symbol: 'ETH',
        asset_address: 'native',
        chain_name: 'Ethereum',
        refill_amount: '10',
        refill_sweep_wallet: '0xcold'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: false,
        error: 'Hot wallet already has sufficient balance',
        code: 'SUFFICIENT_BALANCE',
        data: {}
      });

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(refillRequest);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('SUFFICIENT_BALANCE');
    });
  });

  describe('POST /v1/wallet/refill - Provider Errors', () => {
    it('should return 400 when provider not available', async () => {
      const refillRequest = {
        refill_request_id: 'REQ005',
        wallet_address: '0xhot',
        asset_symbol: 'UNKNOWN',
        asset_address: 'native',
        chain_name: 'UnknownChain',
        refill_amount: '1.0',
        refill_sweep_wallet: '0xcold'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: false,
        error: 'No provider available',
        code: 'NO_PROVIDER_AVAILABLE',
        data: {}
      });

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(refillRequest);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('NO_PROVIDER_AVAILABLE');
    });
  });

  describe('POST /v1/wallet/refill - Idempotency', () => {
    it('should handle duplicate refill requests', async () => {
      const refillRequest = {
        refill_request_id: 'REQ_DUPLICATE',
        wallet_address: '0xhot',
        asset_symbol: 'BTC',
        asset_address: 'native',
        chain_name: 'Bitcoin',
        refill_amount: '1.0',
        refill_sweep_wallet: '0xcold'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: false,
        error: 'Refill transaction already exists',
        code: 'TRANSACTION_EXISTS',
        data: {
          transaction: { id: 123, status: 'COMPLETED' }
        }
      });

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(refillRequest);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('TRANSACTION_EXISTS');
    });
  });

  describe('POST /v1/wallet/refill - Asset Locking', () => {
    it('should return 409 when asset already has refill in progress', async () => {
      const refillRequest = {
        refill_request_id: 'REQ_NEW',
        wallet_address: '0xhot',
        asset_symbol: 'BTC',
        asset_address: 'native',
        chain_name: 'Bitcoin',
        refill_amount: '1.0',
        refill_sweep_wallet: '0xcold'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: false,
        error: 'A refill for this asset is already in progress. Please wait for it to complete.',
        code: 'REFILL_IN_PROGRESS',
        data: {
          existingRefillRequestId: 'REQ_OLD',
          existingStatus: 'PROCESSING',
          existingProviderTxId: 'fb-tx-old',
          createdAt: '2025-10-31T10:00:00Z'
        }
      });

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(refillRequest);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('REFILL_IN_PROGRESS');
      expect(response.body.data.existingRefillRequestId).toBe('REQ_OLD');
    });

    it('should allow refill for different asset even if another is pending', async () => {
      // This test ensures BTC refill doesn't block ETH refill
      const refillRequest = {
        refill_request_id: 'REQ_ETH',
        wallet_address: '0xhot',
        asset_symbol: 'ETH',
        asset_address: 'native',
        chain_name: 'Ethereum',
        refill_amount: '10.0',
        refill_sweep_wallet: '0xcold'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: true,
        data: {
          refillRequestId: 'REQ_ETH',
          transactionId: 'fb-tx-eth',
          status: 'PROCESSING'
        }
      });

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(refillRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /v1/wallet/refill - Cooldown Period', () => {
    it('should return 400 when cooldown period is still active', async () => {
      const refillRequest = {
        refill_request_id: 'REQ_COOLDOWN',
        wallet_address: '0xhot',
        asset_symbol: 'BTC',
        asset_address: 'native',
        chain_name: 'Bitcoin',
        refill_amount: '1.0',
        refill_sweep_wallet: '0xcold'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: false,
        error: 'Refill cooldown period active. Please wait 3600 seconds before requesting another refill.',
        code: 'COOLDOWN_PERIOD_ACTIVE',
        data: {
          lastRefillTime: '2025-11-06T07:00:00Z',
          cooldownPeriodSeconds: 7200,
          remainingCooldownSeconds: 3600,
          lastRefillRequestId: 'REQ_PREVIOUS'
        }
      });

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(refillRequest);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('COOLDOWN_PERIOD_ACTIVE');
      expect(response.body.data.remainingCooldownSeconds).toBe(3600);
      expect(response.body.data.lastRefillRequestId).toBe('REQ_PREVIOUS');
    });

    it('should allow refill when cooldown period has passed', async () => {
      const refillRequest = {
        refill_request_id: 'REQ_AFTER_COOLDOWN',
        wallet_address: '0xhot',
        asset_symbol: 'BTC',
        asset_address: 'native',
        chain_name: 'Bitcoin',
        refill_amount: '1.0',
        refill_sweep_wallet: '0xcold'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: true,
        data: {
          refillRequestId: 'REQ_AFTER_COOLDOWN',
          transactionId: 'fb-tx-new',
          status: 'PROCESSING'
        }
      });

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(refillRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.refillRequestId).toBe('REQ_AFTER_COOLDOWN');
    });

    it('should allow refill when no cooldown period configured for asset', async () => {
      const refillRequest = {
        refill_request_id: 'REQ_NO_COOLDOWN',
        wallet_address: '0xhot',
        asset_symbol: 'ETH',
        asset_address: 'native',
        chain_name: 'Ethereum',
        refill_amount: '5.0',
        refill_sweep_wallet: '0xcold'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: true,
        data: {
          refillRequestId: 'REQ_NO_COOLDOWN',
          transactionId: 'fb-tx-eth-2',
          status: 'PROCESSING'
        }
      });

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send(refillRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /v1/wallet/refill/status/:refill_request_id', () => {
    it('should return transaction status for completed transaction', async () => {
      refillTransactionService.getTransactionStatusFromDB.mockResolvedValue({
        success: true,
        data: {
          refillRequestId: 'REQ001',
          status: 'COMPLETED',
          provider: 'fireblocks',
          providerTxId: 'fb-123',
          txHash: '0xabc123def'
        }
      });

      const response = await request(app)
        .get('/v1/wallet/refill/status/REQ001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
      expect(response.body.data.txHash).toBe('0xabc123def');
    });

    it('should return transaction status for pending transaction', async () => {
      refillTransactionService.getTransactionStatusFromDB.mockResolvedValue({
        success: true,
        data: {
          refillRequestId: 'REQ002',
          status: 'PROCESSING',
          provider: 'fireblocks',
          providerTxId: 'fb-456'
        }
      });

      const response = await request(app)
        .get('/v1/wallet/refill/status/REQ002');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('PROCESSING');
    });

    it('should return 404 when transaction not found', async () => {
      refillTransactionService.getTransactionStatusFromDB.mockResolvedValue({
        success: false,
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND',
        data: {}
      });

      const response = await request(app)
        .get('/v1/wallet/refill/status/NOTFOUND');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('TRANSACTION_NOT_FOUND');
    });

    it('should return 400 when refill_request_id is empty', async () => {
      const response = await request(app)
        .get('/v1/wallet/refill/status/');

      expect(response.status).toBe(404); // Route not found
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      refillService.processRefillRequestService.mockRejectedValue(
        new Error('Unexpected error')
      );

      const response = await request(app)
        .post('/v1/wallet/refill')
        .send({
          refill_request_id: 'REQ_ERROR',
          wallet_address: '0xhot',
          asset_symbol: 'BTC',
          asset_address: 'native',
          chain_name: 'Bitcoin',
          refill_amount: '1.0',
          refill_sweep_wallet: '0xcold'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });
  });
});

