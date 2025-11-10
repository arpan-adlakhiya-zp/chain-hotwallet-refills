const refillTransactionHelper = require('../../../../database/helpers/refillTransaction');
const db = require('../../../../database/models');

jest.mock('../../../../database/models');

describe('RefillTransaction Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRefillTransaction', () => {
    it('should create transaction with provided data', async () => {
      const transactionData = {
        refillRequestId: 'REQ001',
        provider: 'fireblocks',
        status: 'PENDING',
        amountAtomic: '1000000',
        tokenSymbol: 'BTC',
        assetId: 1
      };

      const createdTransaction = { ...transactionData };
      db.RefillTransaction.create = jest.fn().mockResolvedValue(createdTransaction);

      const result = await refillTransactionHelper.createRefillTransaction(transactionData);

      expect(db.RefillTransaction.create).toHaveBeenCalledWith(transactionData);
      expect(result).toEqual(createdTransaction);
    });

    it('should handle partial data gracefully', async () => {
      const partialData = {
        refillRequestId: 'REQ002',
        provider: 'fireblocks',
        amountAtomic: '500000'
      };

      db.RefillTransaction.create = jest.fn().mockResolvedValue({ refillRequestId: 'REQ002' });

      await refillTransactionHelper.createRefillTransaction(partialData);

      expect(db.RefillTransaction.create).toHaveBeenCalledWith(partialData);
    });

    it('should store new tracking fields (chain_name, amount, provider_status)', async () => {
      const transactionData = {
        refillRequestId: 'REQ003',
        provider: 'fireblocks',
        status: 'PENDING',
        amountAtomic: '100000000',
        amount: '1.0',                    // Human-readable amount
        tokenSymbol: 'BTC',
        chainName: 'Bitcoin',             // Blockchain name
        assetId: 1,
        providerStatus: null              // Initially null
      };

      db.RefillTransaction.create = jest.fn().mockResolvedValue({ ...transactionData });

      const result = await refillTransactionHelper.createRefillTransaction(transactionData);

      expect(db.RefillTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '1.0',
          chainName: 'Bitcoin',
          providerStatus: null
        })
      );
      expect(result).toBeDefined();
    });
  });

  describe('updateRefillTransaction', () => {
    it('should update transaction by refillRequestId', async () => {
      const updateData = {
        status: 'COMPLETED',
        txHash: '0xabc123',
        providerTxId: 'fb-123'
      };

      db.RefillTransaction.update = jest.fn().mockResolvedValue([1]); // 1 row updated

      const result = await refillTransactionHelper.updateRefillTransaction('REQ001', updateData);

      expect(db.RefillTransaction.update).toHaveBeenCalledWith(updateData, {
        where: { refillRequestId: 'REQ001' }
      });
      expect(result).toEqual([1]);
    });

    it('should return 0 when no rows updated', async () => {
      db.RefillTransaction.update = jest.fn().mockResolvedValue([0]);

      const result = await refillTransactionHelper.updateRefillTransaction('NONEXISTENT', {});

      expect(result).toEqual([0]);
    });

    it('should update with provider_status field', async () => {
      const updateData = {
        status: 'PROCESSING',
        providerStatus: 'SUBMITTED',  // Raw Fireblocks status
        txHash: '0x123'
      };

      db.RefillTransaction.update = jest.fn().mockResolvedValue([1]);

      const result = await refillTransactionHelper.updateRefillTransaction('REQ001', updateData);

      expect(db.RefillTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          providerStatus: 'SUBMITTED'
        }),
        expect.any(Object)
      );
      expect(result).toEqual([1]);
    });
  });

  describe('getRefillTransactionByRequestId', () => {
    it('should fetch transaction by refillRequestId', async () => {
      const mockTransaction = {
        refillRequestId: 'REQ001',
        status: 'COMPLETED'
      };

      db.RefillTransaction.findOne = jest.fn().mockResolvedValue(mockTransaction);

      const result = await refillTransactionHelper.getRefillTransactionByRequestId('REQ001');

      expect(db.RefillTransaction.findOne).toHaveBeenCalledWith({
        where: { refillRequestId: 'REQ001' }
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should return null when transaction not found', async () => {
      db.RefillTransaction.findOne = jest.fn().mockResolvedValue(null);

      const result = await refillTransactionHelper.getRefillTransactionByRequestId('NOTFOUND');

      expect(result).toBeNull();
    });

    it('should query with correct where clause', async () => {
      db.RefillTransaction.findOne = jest.fn().mockResolvedValue({});

      await refillTransactionHelper.getRefillTransactionByRequestId('REQ001');

      const callArgs = db.RefillTransaction.findOne.mock.calls[0][0];
      expect(callArgs.where.refillRequestId).toBe('REQ001');
    });
  });

  describe('getPendingTransactionByAssetId', () => {
    it('should fetch pending transaction for asset', async () => {
      const mockTransaction = {
        refillRequestId: 'REQ001',
        assetId: 1,
        status: 'PENDING'
      };

      db.RefillTransaction.findOne = jest.fn().mockResolvedValue(mockTransaction);

      const result = await refillTransactionHelper.getPendingTransactionByAssetId(1);

      expect(db.RefillTransaction.findOne).toHaveBeenCalledWith({
        where: { 
          assetId: 1,
          status: {
            [db.Sequelize.Op.in]: ['PENDING', 'PROCESSING']
          }
        },
        order: [['createdAt', 'DESC']]
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should fetch processing transaction for asset', async () => {
      const mockTransaction = {
        refillRequestId: 'REQ002',
        assetId: 2,
        status: 'PROCESSING'
      };

      db.RefillTransaction.findOne = jest.fn().mockResolvedValue(mockTransaction);

      const result = await refillTransactionHelper.getPendingTransactionByAssetId(2);

      expect(result).toEqual(mockTransaction);
      expect(result.status).toBe('PROCESSING');
    });

    it('should return null when no pending transactions exist', async () => {
      db.RefillTransaction.findOne = jest.fn().mockResolvedValue(null);

      const result = await refillTransactionHelper.getPendingTransactionByAssetId(1);

      expect(result).toBeNull();
    });

    it('should not return completed transactions', async () => {
      db.RefillTransaction.findOne = jest.fn().mockResolvedValue(null);

      await refillTransactionHelper.getPendingTransactionByAssetId(1);

      const callArgs = db.RefillTransaction.findOne.mock.calls[0][0];
      expect(callArgs.where.status[db.Sequelize.Op.in]).not.toContain('COMPLETED');
      expect(callArgs.where.status[db.Sequelize.Op.in]).not.toContain('FAILED');
    });
  });

  describe('getTransactionsByStatus', () => {
    it('should fetch transactions with specified status', async () => {
      const mockTransactions = [
        { refillRequestId: 'REQ001', status: 'PENDING' },
        { refillRequestId: 'REQ002', status: 'PENDING' }
      ];

      db.RefillTransaction.findAll = jest.fn().mockResolvedValue(mockTransactions);

      const result = await refillTransactionHelper.getTransactionsByStatus('PENDING');

      expect(db.RefillTransaction.findAll).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        order: [['createdAt', 'ASC']]
      });
      expect(result).toEqual(mockTransactions);
      expect(result).toHaveLength(2);
    });

    it('should order by createdAt ASC (oldest first)', async () => {
      db.RefillTransaction.findAll = jest.fn().mockResolvedValue([]);

      await refillTransactionHelper.getTransactionsByStatus('PENDING');

      const callArgs = db.RefillTransaction.findAll.mock.calls[0][0];
      expect(callArgs.order).toEqual([['createdAt', 'ASC']]);
    });

    it('should return empty array when no transactions found', async () => {
      db.RefillTransaction.findAll = jest.fn().mockResolvedValue([]);

      const result = await refillTransactionHelper.getTransactionsByStatus('COMPLETED');

      expect(result).toEqual([]);
    });
  });

  describe('getLastSuccessfulRefillByAssetId', () => {
    it('should fetch last successful refill for asset', async () => {
      const mockTransaction = {
        refillRequestId: 'REQ001',
        assetId: 1,
        status: 'COMPLETED',
        updatedAt: '2025-11-06T08:00:00Z'
      };

      db.RefillTransaction.findOne = jest.fn().mockResolvedValue(mockTransaction);

      const result = await refillTransactionHelper.getLastSuccessfulRefillByAssetId(1);

      expect(db.RefillTransaction.findOne).toHaveBeenCalledWith({
        where: { 
          assetId: 1,
          status: 'COMPLETED'
        },
        order: [['updatedAt', 'DESC']]
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should return null when no successful refills exist', async () => {
      db.RefillTransaction.findOne = jest.fn().mockResolvedValue(null);

      const result = await refillTransactionHelper.getLastSuccessfulRefillByAssetId(1);

      expect(result).toBeNull();
    });

    it('should order by updatedAt DESC to get most recent', async () => {
      db.RefillTransaction.findOne = jest.fn().mockResolvedValue({});

      await refillTransactionHelper.getLastSuccessfulRefillByAssetId(1);

      const callArgs = db.RefillTransaction.findOne.mock.calls[0][0];
      expect(callArgs.order).toEqual([['updatedAt', 'DESC']]);
    });

    it('should only return COMPLETED status transactions', async () => {
      db.RefillTransaction.findOne = jest.fn().mockResolvedValue(null);

      await refillTransactionHelper.getLastSuccessfulRefillByAssetId(1);

      const callArgs = db.RefillTransaction.findOne.mock.calls[0][0];
      expect(callArgs.where.status).toBe('COMPLETED');
    });
  });
});

