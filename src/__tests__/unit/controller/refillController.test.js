const { processRefillRequestController, checkTransactionStatusController } = require('../../../controller/refillController');
const refillService = require('../../../service/refillService');
const refillTransactionService = require('../../../service/refillTransactionService');

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
      mockReq.body = {
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
      mockReq.body = { wallet_address: '0x123' };

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
      mockReq.body = { wallet_address: '0x123' };

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

    it('should log wallet address from request', async () => {
      mockReq.body = { wallet_address: '0xtest123' };

      refillService.processRefillRequestService.mockResolvedValue({
        success: true,
        data: {}
      });

      await processRefillRequestController(mockReq, mockRes, mockNext);

      expect(refillService.processRefillRequestService).toHaveBeenCalledWith(mockReq.body);
    });
  });

  describe('checkTransactionStatusController', () => {
    it('should return 200 when transaction found', async () => {
      mockReq.params = { refill_request_id: 'REQ001' };

      const mockResult = {
        success: true,
        data: {
          refillRequestId: 'REQ001',
          status: 'COMPLETED',
          txHash: '0xabc'
        }
      };

      refillTransactionService.checkTransactionStatus.mockResolvedValue(mockResult);

      await checkTransactionStatusController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 404 when transaction not found', async () => {
      mockReq.params = { refill_request_id: 'NOTFOUND' };

      const mockResult = {
        success: false,
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND'
      };

      refillTransactionService.checkTransactionStatus.mockResolvedValue(mockResult);

      await checkTransactionStatusController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 400 when refill_request_id missing', async () => {
      mockReq.params = {};

      await checkTransactionStatusController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'MISSING_PARAMETER',
          error: 'refill_request_id is required'
        })
      );
      expect(refillTransactionService.checkTransactionStatus).not.toHaveBeenCalled();
    });

    it('should return 500 on internal server error', async () => {
      mockReq.params = { refill_request_id: 'REQ001' };

      refillTransactionService.checkTransactionStatus.mockRejectedValue(
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
  });
});

