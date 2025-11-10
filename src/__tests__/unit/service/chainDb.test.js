const DatabaseService = require('../../../service/chainDb');
const db = require('../../../database/models');
const blockchainHelper = require('../../../database/helpers/blockchain');
const walletHelper = require('../../../database/helpers/wallet');
const assetHelper = require('../../../database/helpers/asset');
const refillTransactionHelper = require('../../../database/helpers/refillTransaction');

jest.mock('../../../database/models');
jest.mock('../../../database/helpers/blockchain');
jest.mock('../../../database/helpers/wallet');
jest.mock('../../../database/helpers/asset');
jest.mock('../../../database/helpers/refillTransaction');
jest.mock('../../../middleware/logger');

// Note: DatabaseService is a singleton, so we test the exported instance
const databaseService = require('../../../service/chainDb');

describe('DatabaseService (chainDb)', () => {
  let mockSequelize;

  beforeEach(() => {
    mockSequelize = {
      authenticate: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([[{ result: 1 }]])
    };
    
    db.sequelize = mockSequelize;
    
    // Replace the singleton's sequelize with our mock
    databaseService.sequelize = mockSequelize;
    databaseService.isConnected = false;
    
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should authenticate and set isConnected flag', async () => {
      await databaseService.connect();

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(databaseService.isConnected).toBe(true);
    });

    it('should not reconnect if already connected', async () => {
      await databaseService.connect();
      await databaseService.connect();

      expect(mockSequelize.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should throw error on connection failure', async () => {
      mockSequelize.authenticate.mockRejectedValue(new Error('Connection refused'));

      await expect(databaseService.connect()).rejects.toThrow('Connection refused');
      expect(databaseService.isConnected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should close connection and reset flag', async () => {
      await databaseService.connect();
      await databaseService.disconnect();

      expect(mockSequelize.close).toHaveBeenCalled();
      expect(databaseService.isConnected).toBe(false);
    });

    it('should not disconnect if not connected', async () => {
      await databaseService.disconnect();

      expect(mockSequelize.close).not.toHaveBeenCalled();
    });

    it('should throw error on disconnect failure', async () => {
      await databaseService.connect();
      mockSequelize.close.mockRejectedValue(new Error('Close failed'));

      await expect(databaseService.disconnect()).rejects.toThrow('Close failed');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when connection works', async () => {
      const result = await databaseService.healthCheck();

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(mockSequelize.query).toHaveBeenCalledWith('SELECT 1');
      expect(result.status).toBe('healthy');
    });

    it('should return unhealthy status on query failure', async () => {
      mockSequelize.query.mockRejectedValue(new Error('Query failed'));

      const result = await databaseService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Query failed');
    });
  });

  describe('getBlockchainByName', () => {
    it('should connect and call blockchain helper', async () => {
      const mockBlockchain = { id: 1, name: 'Bitcoin' };
      blockchainHelper.getBlockchainByName.mockResolvedValue(mockBlockchain);

      const result = await databaseService.getBlockchainByName('Bitcoin');

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(blockchainHelper.getBlockchainByName).toHaveBeenCalledWith('Bitcoin');
      expect(result).toEqual(mockBlockchain);
    });

    it('should throw error when helper fails', async () => {
      blockchainHelper.getBlockchainByName.mockRejectedValue(new Error('DB error'));

      await expect(databaseService.getBlockchainByName('Bitcoin')).rejects.toThrow('DB error');
    });
  });

  describe('getWalletByAddress', () => {
    it('should connect and call wallet helper', async () => {
      const mockWallet = { id: 1, address: '0x123' };
      walletHelper.getWalletByAddress.mockResolvedValue(mockWallet);

      const result = await databaseService.getWalletByAddress('0x123');

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(walletHelper.getWalletByAddress).toHaveBeenCalledWith('0x123');
      expect(result).toEqual(mockWallet);
    });
  });

  describe('getAssetDetails', () => {
    it('should connect and call asset helper', async () => {
      const mockAsset = { id: 1, symbol: 'BTC' };
      assetHelper.getAssetById.mockResolvedValue(mockAsset);

      const result = await databaseService.getAssetDetails(1);

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(assetHelper.getAssetById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockAsset);
    });
  });

  describe('getAssetBySymbolAndBlockchain', () => {
    it('should connect and call asset helper with correct params', async () => {
      const mockAsset = { id: 1, symbol: 'USDC' };
      assetHelper.getAssetBySymbolAndBlockchain.mockResolvedValue(mockAsset);

      const result = await databaseService.getAssetBySymbolAndBlockchain('USDC', 2);

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(assetHelper.getAssetBySymbolAndBlockchain).toHaveBeenCalledWith('USDC', 2);
      expect(result).toEqual(mockAsset);
    });
  });

  describe('createRefillTransaction', () => {
    it('should connect and call transaction helper', async () => {
      const transactionData = {
        refillRequestId: 'REQ001',
        provider: 'fireblocks',
        assetId: 1
      };
      const mockTransaction = { ...transactionData };
      
      refillTransactionHelper.createRefillTransaction.mockResolvedValue(mockTransaction);

      const result = await databaseService.createRefillTransaction(transactionData);

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(refillTransactionHelper.createRefillTransaction).toHaveBeenCalledWith(transactionData);
      expect(result).toEqual(mockTransaction);
    });
  });

  describe('updateRefillTransaction', () => {
    it('should connect and call transaction helper', async () => {
      const updateData = { status: 'COMPLETED' };
      refillTransactionHelper.updateRefillTransaction.mockResolvedValue([1]);

      const result = await databaseService.updateRefillTransaction('REQ001', updateData);

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(refillTransactionHelper.updateRefillTransaction).toHaveBeenCalledWith('REQ001', updateData);
      expect(result).toEqual([1]);
    });
  });

  describe('getRefillTransactionByRequestId', () => {
    it('should connect and call transaction helper', async () => {
      const mockTransaction = { refillRequestId: 'REQ001' };
      refillTransactionHelper.getRefillTransactionByRequestId.mockResolvedValue(mockTransaction);

      const result = await databaseService.getRefillTransactionByRequestId('REQ001');

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(refillTransactionHelper.getRefillTransactionByRequestId).toHaveBeenCalledWith('REQ001');
      expect(result).toEqual(mockTransaction);
    });
  });

  describe('getPendingTransactionByAssetId', () => {
    it('should connect and call transaction helper', async () => {
      const mockTransaction = { refillRequestId: 'REQ001', assetId: 1, status: 'PENDING' };
      refillTransactionHelper.getPendingTransactionByAssetId.mockResolvedValue(mockTransaction);

      const result = await databaseService.getPendingTransactionByAssetId(1);

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(refillTransactionHelper.getPendingTransactionByAssetId).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockTransaction);
    });

    it('should return null when no pending transaction exists', async () => {
      refillTransactionHelper.getPendingTransactionByAssetId.mockResolvedValue(null);

      const result = await databaseService.getPendingTransactionByAssetId(1);

      expect(result).toBeNull();
    });
  });

  describe('getTransactionsByStatus', () => {
    it('should connect and call transaction helper', async () => {
      const mockTransactions = [
        { refillRequestId: 'REQ001', status: 'PENDING' },
        { refillRequestId: 'REQ002', status: 'PENDING' }
      ];
      refillTransactionHelper.getTransactionsByStatus.mockResolvedValue(mockTransactions);

      const result = await databaseService.getTransactionsByStatus('PENDING');

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(refillTransactionHelper.getTransactionsByStatus).toHaveBeenCalledWith('PENDING');
      expect(result).toEqual(mockTransactions);
    });
  });

  describe('getLastSuccessfulRefillByAssetId', () => {
    it('should connect and call transaction helper', async () => {
      const mockTransaction = {
        refillRequestId: 'REQ001',
        assetId: 1,
        status: 'COMPLETED',
        updatedAt: '2025-11-06T08:00:00Z'
      };
      refillTransactionHelper.getLastSuccessfulRefillByAssetId.mockResolvedValue(mockTransaction);

      const result = await databaseService.getLastSuccessfulRefillByAssetId(1);

      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(refillTransactionHelper.getLastSuccessfulRefillByAssetId).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockTransaction);
    });

    it('should return null when no successful refill found', async () => {
      refillTransactionHelper.getLastSuccessfulRefillByAssetId.mockResolvedValue(null);

      const result = await databaseService.getLastSuccessfulRefillByAssetId(1);

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      refillTransactionHelper.getLastSuccessfulRefillByAssetId.mockRejectedValue(
        new Error('Database error')
      );

      await expect(databaseService.getLastSuccessfulRefillByAssetId(1))
        .rejects.toThrow('Database error');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when getWalletByAddress fails', async () => {
      walletHelper.getWalletByAddress.mockRejectedValue(new Error('Wallet fetch failed'));

      await expect(databaseService.getWalletByAddress('0x123'))
        .rejects.toThrow('Wallet fetch failed');
    });

    it('should throw error when getAssetDetails fails', async () => {
      assetHelper.getAssetById.mockRejectedValue(new Error('Asset fetch failed'));

      await expect(databaseService.getAssetDetails(1))
        .rejects.toThrow('Asset fetch failed');
    });

    it('should throw error when getAssetBySymbolAndBlockchain fails', async () => {
      assetHelper.getAssetBySymbolAndBlockchain.mockRejectedValue(new Error('Asset lookup failed'));

      await expect(databaseService.getAssetBySymbolAndBlockchain('BTC', 1))
        .rejects.toThrow('Asset lookup failed');
    });

    it('should throw error when createRefillTransaction fails', async () => {
      refillTransactionHelper.createRefillTransaction.mockRejectedValue(new Error('Transaction creation failed'));

      await expect(databaseService.createRefillTransaction({}))
        .rejects.toThrow('Transaction creation failed');
    });

    it('should throw error when updateRefillTransaction fails', async () => {
      refillTransactionHelper.updateRefillTransaction.mockRejectedValue(new Error('Transaction update failed'));

      await expect(databaseService.updateRefillTransaction('REQ001', {}))
        .rejects.toThrow('Transaction update failed');
    });

    it('should throw error when getRefillTransactionByRequestId fails', async () => {
      refillTransactionHelper.getRefillTransactionByRequestId.mockRejectedValue(new Error('Transaction fetch failed'));

      await expect(databaseService.getRefillTransactionByRequestId('REQ001'))
        .rejects.toThrow('Transaction fetch failed');
    });

    it('should throw error when getPendingTransactionByAssetId fails', async () => {
      refillTransactionHelper.getPendingTransactionByAssetId.mockRejectedValue(new Error('Pending transaction fetch failed'));

      await expect(databaseService.getPendingTransactionByAssetId(1))
        .rejects.toThrow('Pending transaction fetch failed');
    });

    it('should throw error when getTransactionsByStatus fails', async () => {
      refillTransactionHelper.getTransactionsByStatus.mockRejectedValue(new Error('Status query failed'));

      await expect(databaseService.getTransactionsByStatus('PENDING'))
        .rejects.toThrow('Status query failed');
    });
  });
});

