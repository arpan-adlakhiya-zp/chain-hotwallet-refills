const WalletFactory = require('../../../../providers/fireblocks/walletFactory');
const { FireblocksSDK } = require('fireblocks-sdk');

jest.mock('fireblocks-sdk');
jest.mock('../../../../middleware/logger');

describe('Fireblocks WalletFactory', () => {
  let walletFactory;
  let mockFireblocksSDK;

  beforeEach(() => {
    mockFireblocksSDK = {
      getVaultAccountAsset: jest.fn(),
      getVaultAccounts: jest.fn()
    };
    
    FireblocksSDK.mockImplementation(() => mockFireblocksSDK);
    walletFactory = new WalletFactory();
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize Fireblocks SDK successfully', async () => {
      const result = await walletFactory.init(
        'test-private-key',
        'test-api-key',
        'https://api.fireblocks.io'
      );
      
      expect(FireblocksSDK).toHaveBeenCalledWith(
        'test-private-key',
        'test-api-key',
        'https://api.fireblocks.io'
      );
      expect(result).toBe(true);
      expect(walletFactory.fireblocks).toBe(mockFireblocksSDK);
    });

    it('should throw error on initialization failure', async () => {
      FireblocksSDK.mockImplementation(() => {
        throw new Error('Invalid API key');
      });

      await expect(
        walletFactory.init('bad-key', 'bad-api', 'url')
      ).rejects.toThrow('Invalid API key');
    });

    it('should accept custom API base URL', async () => {
      await walletFactory.init('pk', 'ak', 'https://sandbox.fireblocks.io');

      expect(FireblocksSDK).toHaveBeenCalledWith(
        'pk',
        'ak',
        'https://sandbox.fireblocks.io'
      );
    });
  });

  describe('getTokenBalance', () => {
    beforeEach(async () => {
      await walletFactory.init('pk', 'ak', 'url');
    });

    it('should return available balance from vault', async () => {
      mockFireblocksSDK.getVaultAccountAsset.mockResolvedValue({
        id: 'BTC',
        total: '2.5',
        available: '2.0',
        pending: '0.5'
      });

      const balance = await walletFactory.getTokenBalance('vault1', 'BTC');
      
      expect(balance).toBe('2.0');
      expect(mockFireblocksSDK.getVaultAccountAsset).toHaveBeenCalledWith('vault1', 'BTC');
    });

    it('should handle zero balance', async () => {
      mockFireblocksSDK.getVaultAccountAsset.mockResolvedValue({
        available: '0'
      });

      const balance = await walletFactory.getTokenBalance('vault2', 'ETH');
      
      expect(balance).toBe('0');
    });

    it('should throw error when vault not found', async () => {
      mockFireblocksSDK.getVaultAccountAsset.mockRejectedValue(
        new Error('Vault not found')
      );

      await expect(
        walletFactory.getTokenBalance('invalid', 'BTC')
      ).rejects.toThrow('Vault not found');
    });

    it('should throw error when asset not supported', async () => {
      mockFireblocksSDK.getVaultAccountAsset.mockRejectedValue(
        new Error('Asset not supported')
      );

      await expect(
        walletFactory.getTokenBalance('vault1', 'INVALID')
      ).rejects.toThrow('Asset not supported');
    });
  });

});

