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

      const createdTransaction = { id: 123, ...transactionData };
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

      db.RefillTransaction.create = jest.fn().mockResolvedValue({ id: 124 });

      await refillTransactionHelper.createRefillTransaction(partialData);

      expect(db.RefillTransaction.create).toHaveBeenCalledWith(partialData);
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
  });

  describe('getRefillTransactionByRequestId', () => {
    it('should fetch transaction with asset associations', async () => {
      const mockTransaction = {
        id: 123,
        refillRequestId: 'REQ001',
        Asset: {
          id: 1,
          symbol: 'BTC',
          Blockchain: { symbol: 'BTC' },
          Wallet: { address: '0xhot' }
        }
      };

      db.RefillTransaction.findOne = jest.fn().mockResolvedValue(mockTransaction);

      const result = await refillTransactionHelper.getRefillTransactionByRequestId('REQ001');

      expect(db.RefillTransaction.findOne).toHaveBeenCalledWith({
        where: { refillRequestId: 'REQ001' },
        include: [{
          model: db.Asset,
          as: 'Asset',
          include: [
            { model: db.Blockchain, as: 'Blockchain' },
            { model: db.Wallet, as: 'Wallet' }
          ]
        }]
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should return null when transaction not found', async () => {
      db.RefillTransaction.findOne = jest.fn().mockResolvedValue(null);

      const result = await refillTransactionHelper.getRefillTransactionByRequestId('NOTFOUND');

      expect(result).toBeNull();
    });

    it('should include nested associations', async () => {
      db.RefillTransaction.findOne = jest.fn().mockResolvedValue({});

      await refillTransactionHelper.getRefillTransactionByRequestId('REQ001');

      const callArgs = db.RefillTransaction.findOne.mock.calls[0][0];
      expect(callArgs.include[0].as).toBe('Asset');
      expect(callArgs.include[0].include).toHaveLength(2);
    });
  });

  describe('getPendingTransactionByAssetId', () => {
    it('should fetch pending transaction for asset', async () => {
      const mockTransaction = {
        id: 123,
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
        id: 124,
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
});

