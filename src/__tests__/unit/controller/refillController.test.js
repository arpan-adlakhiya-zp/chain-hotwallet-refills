// Mock config before any imports to prevent database config errors
jest.mock('../../../config', () => ({
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

const { processRefillRequestController, checkTransactionStatusController } = require('../../../controller/refillController');
const refillService = require('../../../service/refillService');
const refillTransactionService = require('../../../service/refillTransactionService');
const config = require('../../../config');

jest.mock('../../../service/refillService');
jest.mock('../../../service/refillTransactionService');
jest.mock('../../../middleware/logger');

describe('RefillController', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = { body: {}, params: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('processRefillRequestController', () => {
    it('should return 200 when refill request succeeds', async () => {
      mockReq.verifiedData = {
        wallet_address: '0x123',
        refill_request_id: 'REQ001'
      };

      const mockResult = {
        success: true,
        data: {
          refillRequestId: 'REQ001',
          transactionId: 'fb-123',
          status: 'PROCESSING'
        }
      };

      refillService.processRefillRequestService.mockResolvedValue(mockResult);

      await processRefillRequestController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 400 when refill request fails validation', async () => {
      mockReq.verifiedData = { wallet_address: '0x123' };

      const mockResult = {
        success: false,
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR'
      };

      refillService.processRefillRequestService.mockResolvedValue(mockResult);

      await processRefillRequestController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 500 on internal server error', async () => {
      mockReq.verifiedData = { wallet_address: '0x123' };

      refillService.processRefillRequestService.mockRejectedValue(
        new Error('Internal error')
      );

      await processRefillRequestController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        })
      );
    });

    it('should use verifiedData from authentication middleware', async () => {
      mockReq.verifiedData = {
        refill_request_id: 'REQ123',
        wallet_address: '0xtest123'
      };

      refillService.processRefillRequestService.mockResolvedValue({
        success: true,
        data: {}
      });

      await processRefillRequestController(mockReq, mockRes, mockNext);

      expect(refillService.processRefillRequestService).toHaveBeenCalledWith(mockReq.verifiedData);
    });

    it('should return 409 when refill already in progress for asset', async () => {
      mockReq.verifiedData = {
        wallet_address: '0x123',
        asset_symbol: 'BTC'
      };

      const mockResult = {
        success: false,
        error: 'A refill for this asset is already in progress',
        code: 'REFILL_IN_PROGRESS',
        data: {
          existingRefillRequestId: 'REQ_OLD',
          existingStatus: 'PROCESSING'
        }
      };

      refillService.processRefillRequestService.mockResolvedValue(mockResult);

      await processRefillRequestController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('checkTransactionStatusController', () => {
    it('should return 200 when transaction found', async () => {
      mockReq.verifiedData = { refill_request_id: 'REQ001' };
      mockReq.params = { refill_request_id: 'REQ001' };

      const mockResult = {
        success: true,
        data: {
          refillRequestId: 'REQ001',
          status: 'COMPLETED',
          txHash: '0xabc'
        }
      };

      config.get.mockReturnValue(false); // authEnabled = false, skip validation
      refillTransactionService.getTransactionStatusFromDB.mockResolvedValue(mockResult);

      await checkTransactionStatusController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 404 when transaction not found', async () => {
      mockReq.verifiedData = { refill_request_id: 'NOTFOUND' };
      mockReq.params = { refill_request_id: 'NOTFOUND' };

      const mockResult = {
        success: false,
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND'
      };

      config.get.mockReturnValue(false); // authEnabled = false, skip validation
      refillTransactionService.getTransactionStatusFromDB.mockResolvedValue(mockResult);

      await checkTransactionStatusController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 400 when refill_request_id missing', async () => {
      mockReq.verifiedData = {};

      await checkTransactionStatusController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'MISSING_PARAMETER',
          error: 'refill_request_id is required in JWT'
        })
      );
      expect(refillTransactionService.getTransactionStatusFromDB).not.toHaveBeenCalled();
    });

    it('should return 500 on internal server error', async () => {
      mockReq.verifiedData = { refill_request_id: 'REQ001' };
      mockReq.params = { refill_request_id: 'REQ001' };

      config.get.mockReturnValue(false); // authEnabled = false, skip validation
      refillTransactionService.getTransactionStatusFromDB.mockRejectedValue(
        new Error('Database error')
      );

      await checkTransactionStatusController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        })
      );
    });

    it('should use DB-only check (no provider call)', async () => {
      mockReq.verifiedData = { refill_request_id: 'REQ001' };
      mockReq.params = { refill_request_id: 'REQ001' };

      config.get.mockReturnValue(false); // authEnabled = false, skip validation
      refillTransactionService.getTransactionStatusFromDB.mockResolvedValue({
        success: true,
        data: { status: 'PROCESSING' }
      });

      await checkTransactionStatusController(mockReq, mockRes, mockNext);

      // Should call DB method, not provider method
      expect(refillTransactionService.getTransactionStatusFromDB).toHaveBeenCalled();
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).not.toHaveBeenCalled();
    });
  });
});

