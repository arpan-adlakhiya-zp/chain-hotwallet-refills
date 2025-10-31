const Transaction = require('../../../../providers/fireblocks/transaction');
const { FeeLevel } = require('fireblocks-sdk');

jest.mock('../../../../middleware/logger');

describe('Fireblocks Transaction', () => {
  let transaction;
  let mockFireblocksSDK;

  beforeEach(() => {
    mockFireblocksSDK = {
      createTransaction: jest.fn(),
      getTransactionById: jest.fn(),
      getTransactionByExternalTxId: jest.fn()
    };
    
    transaction = new Transaction(mockFireblocksSDK);
    jest.clearAllMocks();
  });

  describe('createTransaction', () => {
    it('should create transaction with all parameters', async () => {
      const transactionData = {
        externalTxId: 'ext-123',
        assetId: 'BTC',
        amount: '1.5',
        source: { type: 'VAULT_ACCOUNT', id: '0' },
        destination: { type: 'VAULT_ACCOUNT', id: '1' },
        note: 'Test transfer',
        feeLevel: FeeLevel.HIGH
      };

      const mockResponse = {
        id: 'fb-tx-456',
        status: 'SUBMITTED'
      };

      mockFireblocksSDK.createTransaction.mockResolvedValue(mockResponse);

      const result = await transaction.createTransaction(transactionData);

      expect(mockFireblocksSDK.createTransaction).toHaveBeenCalledWith({
        externalTxId: 'ext-123',
        assetId: 'BTC',
        amount: '1.5',
        feeLevel: FeeLevel.HIGH,
        source: { type: 'VAULT_ACCOUNT', id: '0' },
        destination: { type: 'VAULT_ACCOUNT', id: '1' },
        note: 'Test transfer'
      });
      expect(result).toEqual(mockResponse);
    });

    it('should use MEDIUM fee level as default', async () => {
      const transactionData = {
        externalTxId: 'ext-123',
        assetId: 'ETH',
        amount: '0.1',
        source: { type: 'VAULT_ACCOUNT', id: '0' },
        destination: { type: 'VAULT_ACCOUNT', id: '1' },
        note: 'Test'
      };

      mockFireblocksSDK.createTransaction.mockResolvedValue({ id: '123' });

      await transaction.createTransaction(transactionData);

      const callArgs = mockFireblocksSDK.createTransaction.mock.calls[0][0];
      expect(callArgs.feeLevel).toBe(FeeLevel.MEDIUM);
    });

    it('should throw error on API failure', async () => {
      const transactionData = {
        externalTxId: 'ext-123',
        assetId: 'BTC',
        amount: '1.0',
        source: {},
        destination: {}
      };

      mockFireblocksSDK.createTransaction.mockRejectedValue(
        new Error('Insufficient balance')
      );

      await expect(
        transaction.createTransaction(transactionData)
      ).rejects.toThrow('Insufficient balance');
    });

    it('should handle invalid vault account', async () => {
      const transactionData = {
        externalTxId: 'ext-123',
        assetId: 'BTC',
        amount: '1.0',
        source: { type: 'VAULT_ACCOUNT', id: 'nonexistent' },
        destination: { type: 'VAULT_ACCOUNT', id: '1' }
      };

      mockFireblocksSDK.createTransaction.mockRejectedValue(
        new Error('Source vault not found')
      );

      await expect(
        transaction.createTransaction(transactionData)
      ).rejects.toThrow('Source vault not found');
    });
  });

  describe('getTransactionById', () => {
    it('should fetch transaction by ID', async () => {
      const mockTx = {
        id: 'fb-tx-789',
        status: 'COMPLETED',
        txHash: '0xabc'
      };

      mockFireblocksSDK.getTransactionById.mockResolvedValue(mockTx);

      const result = await transaction.getTransactionById('fb-tx-789');

      expect(mockFireblocksSDK.getTransactionById).toHaveBeenCalledWith('fb-tx-789');
      expect(result).toEqual(mockTx);
    });

    it('should throw error when transaction not found', async () => {
      mockFireblocksSDK.getTransactionById.mockRejectedValue(
        new Error('Transaction not found')
      );

      await expect(
        transaction.getTransactionById('nonexistent')
      ).rejects.toThrow('Transaction not found');
    });
  });

  describe('getTransactionByExternalTxId', () => {
    it('should fetch transaction by external ID', async () => {
      const mockTx = {
        id: 'fb-tx-111',
        externalId: 'ext-222',
        status: 'PROCESSING'
      };

      mockFireblocksSDK.getTransactionByExternalTxId.mockResolvedValue(mockTx);

      const result = await transaction.getTransactionByExternalTxId('ext-222');

      expect(mockFireblocksSDK.getTransactionByExternalTxId).toHaveBeenCalledWith('ext-222');
      expect(result).toEqual(mockTx);
    });

    it('should handle duplicate external IDs gracefully', async () => {
      mockFireblocksSDK.getTransactionByExternalTxId.mockResolvedValue({
        id: 'fb-tx-333'
      });

      const result = await transaction.getTransactionByExternalTxId('duplicate-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('fb-tx-333');
    });

    it('should throw error when external ID not found', async () => {
      mockFireblocksSDK.getTransactionByExternalTxId.mockRejectedValue(
        new Error('External transaction ID not found')
      );

      await expect(
        transaction.getTransactionByExternalTxId('notfound')
      ).rejects.toThrow('External transaction ID not found');
    });
  });
});

