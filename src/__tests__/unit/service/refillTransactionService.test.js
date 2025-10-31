const refillTransactionService = require('../../../service/refillTransactionService');
const databaseService = require('../../../service/chainDb');
const providerService = require('../../../service/providerService');

jest.mock('../../../service/chainDb');
jest.mock('../../../service/providerService');
jest.mock('../../../middleware/logger');

describe('RefillTransactionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRefillTransaction', () => {
    it('should create transaction successfully when it does not exist', async () => {
      const transactionData = {
        refillRequestId: 'REQ001',
        provider: 'fireblocks',
        status: 'PENDING',
        amountAtomic: '1000000',
        tokenSymbol: 'BTC',
        assetId: 1
      };

      databaseService.getRefillTransactionByRequestId.mockResolvedValue(null);
      databaseService.createRefillTransaction.mockResolvedValue({
        id: 123,
        ...transactionData
      });

      const result = await refillTransactionService.createRefillTransaction(transactionData);

      expect(result.success).toBe(true);
      expect(result.data.transaction.id).toBe(123);
      expect(result.data.transaction.refillRequestId).toBe('REQ001');
      expect(databaseService.createRefillTransaction).toHaveBeenCalledWith(transactionData);
    });

    it('should return error when transaction already exists (idempotency)', async () => {
      const transactionData = {
        refillRequestId: 'REQ001',
        provider: 'fireblocks'
      };
      const existingTxn = {
        id: 123,
        refillRequestId: 'REQ001',
        status: 'COMPLETED'
      };

      databaseService.getRefillTransactionByRequestId.mockResolvedValue(existingTxn);

      const result = await refillTransactionService.createRefillTransaction(transactionData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('TRANSACTION_EXISTS');
      expect(result.data.transaction).toEqual(existingTxn);
      expect(databaseService.createRefillTransaction).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const transactionData = { refillRequestId: 'REQ001' };

      databaseService.getRefillTransactionByRequestId.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await refillTransactionService.createRefillTransaction(transactionData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('TRANSACTION_CREATION_ERROR');
      expect(result.data.details).toContain('Database connection failed');
    });
  });

  describe('updateRefillTransaction', () => {
    it('should update transaction successfully', async () => {
      const updateData = {
        status: 'COMPLETED',
        txHash: '0xabc123'
      };

      databaseService.updateRefillTransaction.mockResolvedValue([1]); // 1 row updated

      const result = await refillTransactionService.updateRefillTransaction('REQ001', updateData);

      expect(result.success).toBe(true);
      expect(databaseService.updateRefillTransaction).toHaveBeenCalledWith('REQ001', updateData);
    });

    it('should return error when transaction not found', async () => {
      databaseService.updateRefillTransaction.mockResolvedValue([0]); // 0 rows updated

      const result = await refillTransactionService.updateRefillTransaction('NONEXISTENT', {});

      expect(result.success).toBe(false);
      expect(result.code).toBe('TRANSACTION_NOT_FOUND');
    });

    it('should handle database errors', async () => {
      databaseService.updateRefillTransaction.mockRejectedValue(
        new Error('Update failed')
      );

      const result = await refillTransactionService.updateRefillTransaction('REQ001', {});

      expect(result.success).toBe(false);
      expect(result.code).toBe('TRANSACTION_UPDATE_ERROR');
    });
  });

  describe('mapProviderStatusToInternal', () => {
    describe('Fireblocks status mapping', () => {
      it('should map COMPLETED to COMPLETED', () => {
        const status = refillTransactionService.mapProviderStatusToInternal('fireblocks', 'COMPLETED');
        expect(status).toBe('COMPLETED');
      });

      it('should map SUBMITTED to PROCESSING', () => {
        const status = refillTransactionService.mapProviderStatusToInternal('fireblocks', 'SUBMITTED');
        expect(status).toBe('PROCESSING');
      });

      it('should map PENDING_SIGNATURE to PROCESSING', () => {
        const status = refillTransactionService.mapProviderStatusToInternal('fireblocks', 'PENDING_SIGNATURE');
        expect(status).toBe('PROCESSING');
      });

      it('should map BROADCASTING to PROCESSING', () => {
        const status = refillTransactionService.mapProviderStatusToInternal('fireblocks', 'BROADCASTING');
        expect(status).toBe('PROCESSING');
      });

      it('should map FAILED to FAILED', () => {
        const status = refillTransactionService.mapProviderStatusToInternal('fireblocks', 'FAILED');
        expect(status).toBe('FAILED');
      });

      it('should map CANCELLED to FAILED', () => {
        const status = refillTransactionService.mapProviderStatusToInternal('fireblocks', 'CANCELLED');
        expect(status).toBe('FAILED');
      });

      it('should map REJECTED to FAILED', () => {
        const status = refillTransactionService.mapProviderStatusToInternal('fireblocks', 'REJECTED');
        expect(status).toBe('FAILED');
      });

      it('should default to PROCESSING for unknown status', () => {
        const status = refillTransactionService.mapProviderStatusToInternal('fireblocks', 'UNKNOWN_STATUS');
        expect(status).toBe('PROCESSING');
      });
    });

    describe('Liminal status mapping', () => {
      it('should map status 1 to PROCESSING', () => {
        const status = refillTransactionService.mapProviderStatusToInternal('liminal', '1');
        expect(status).toBe('PROCESSING');
      });

      it('should map status 4 to COMPLETED', () => {
        const status = refillTransactionService.mapProviderStatusToInternal('liminal', '4');
        expect(status).toBe('COMPLETED');
      });

      it('should map status 5 to FAILED', () => {
        const status = refillTransactionService.mapProviderStatusToInternal('liminal', '5');
        expect(status).toBe('FAILED');
      });
    });

    it('should handle null provider gracefully', () => {
      const status = refillTransactionService.mapProviderStatusToInternal(null, 'SUBMITTED');
      expect(status).toBe('PROCESSING');
    });
  });

  describe('isFinalStatus', () => {
    it('should return true for COMPLETED', () => {
      expect(refillTransactionService.isFinalStatus('COMPLETED')).toBe(true);
    });

    it('should return true for FAILED', () => {
      expect(refillTransactionService.isFinalStatus('FAILED')).toBe(true);
    });

    it('should return true for completed (lowercase)', () => {
      expect(refillTransactionService.isFinalStatus('completed')).toBe(true);
    });

    it('should return false for PROCESSING', () => {
      expect(refillTransactionService.isFinalStatus('PROCESSING')).toBe(false);
    });

    it('should return false for PENDING', () => {
      expect(refillTransactionService.isFinalStatus('PENDING')).toBe(false);
    });

    it('should return false for null', () => {
      expect(refillTransactionService.isFinalStatus(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(refillTransactionService.isFinalStatus(undefined)).toBe(false);
    });
  });

  describe('extractTransactionDetails', () => {
    it('should extract Fireblocks transaction details correctly', () => {
      const fireblocksResponse = {
        id: 'fb-tx-123',
        txHash: '0xabc123def',
        status: 'COMPLETED',
        note: 'Transfer completed successfully'
      };

      const result = refillTransactionService.extractTransactionDetails('fireblocks', fireblocksResponse);

      expect(result.providerTxId).toBe('fb-tx-123');
      expect(result.txHash).toBe('0xabc123def');
      expect(result.status).toBe('COMPLETED');
      expect(result.message).toBe('Transfer completed successfully');
      expect(result.providerData).toEqual(fireblocksResponse);
    });

    it('should handle Fireblocks response without note', () => {
      const fireblocksResponse = {
        id: 'fb-tx-123',
        txHash: '0xabc',
        status: 'SUBMITTED'
      };

      const result = refillTransactionService.extractTransactionDetails('fireblocks', fireblocksResponse);

      expect(result.message).toBeNull();
    });

    it('should extract Liminal transaction details from data property', () => {
      const liminalResponse = {
        data: {
          id: 'lim-456',
          txid: '0xdef456',
          status: '4',
          message: 'Transfer approved'
        }
      };

      const result = refillTransactionService.extractTransactionDetails('liminal', liminalResponse);

      expect(result.providerTxId).toBe('lim-456');
      expect(result.txHash).toBe('0xdef456');
      expect(result.status).toBe('4');
      expect(result.message).toBe('Transfer approved');
    });

    it('should extract Liminal transaction details from root', () => {
      const liminalResponse = {
        id: 'lim-789',
        txHash: '0xghi',
        status: 'pending'
      };

      const result = refillTransactionService.extractTransactionDetails('liminal', liminalResponse);

      expect(result.providerTxId).toBe('lim-789');
      expect(result.txHash).toBe('0xghi');
      expect(result.status).toBe('pending');
    });

    it('should handle extraction errors gracefully', () => {
      const result = refillTransactionService.extractTransactionDetails('unknown', null);

      expect(result.providerTxId).toBeNull();
      expect(result.txHash).toBeNull();
      expect(result.status).toBe('PROCESSING');
    });
  });

  describe('getRefillTransactionByRequestId', () => {
    it('should return transaction when found', async () => {
      const mockTransaction = {
        id: 123,
        refillRequestId: 'REQ001',
        status: 'COMPLETED'
      };

      databaseService.getRefillTransactionByRequestId.mockResolvedValue(mockTransaction);

      const result = await refillTransactionService.getRefillTransactionByRequestId('REQ001');

      expect(result.success).toBe(true);
      expect(result.data.transaction).toEqual(mockTransaction);
    });

    it('should return error when transaction not found', async () => {
      databaseService.getRefillTransactionByRequestId.mockResolvedValue(null);

      const result = await refillTransactionService.getRefillTransactionByRequestId('NONEXISTENT');

      expect(result.success).toBe(false);
      expect(result.code).toBe('TRANSACTION_NOT_FOUND');
    });

    it('should handle database errors', async () => {
      databaseService.getRefillTransactionByRequestId.mockRejectedValue(
        new Error('DB error')
      );

      const result = await refillTransactionService.getRefillTransactionByRequestId('REQ001');

      expect(result.success).toBe(false);
      expect(result.code).toBe('TRANSACTION_GET_ERROR');
    });
  });
});

