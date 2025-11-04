const FireblocksProvider = require('../../../../providers/fireblocks');
const WalletFactory = require('../../../../providers/fireblocks/walletFactory');
const Transaction = require('../../../../providers/fireblocks/transaction');
const BigNumber = require('bignumber.js');

jest.mock('../../../../providers/fireblocks/walletFactory');
jest.mock('../../../../providers/fireblocks/transaction');
jest.mock('../../../../middleware/logger');

describe('FireblocksProvider', () => {
  let provider;
  let mockWalletFactory;
  let mockTransaction;
  let mockFireblocksSDK;

  beforeEach(() => {
    mockFireblocksSDK = {
      getVaultAccountAsset: jest.fn(),
      createTransaction: jest.fn()
    };

    mockWalletFactory = {
      init: jest.fn().mockResolvedValue(true),
      getTokenBalance: jest.fn(),
      validateCredentials: jest.fn(),
      fireblocks: mockFireblocksSDK
    };

    mockTransaction = {
      createTransaction: jest.fn(),
      getTransactionById: jest.fn()
    };

    WalletFactory.mockImplementation(() => mockWalletFactory);
    Transaction.mockImplementation(() => mockTransaction);

    const config = { apiBaseUrl: 'https://api.fireblocks.io' };
    const secret = { apiKey: 'test-key', privateKey: 'test-pk' };
    
    provider = new FireblocksProvider(config, secret);
    jest.clearAllMocks();
  });

  describe('getProviderName', () => {
    it('should return fireblocks as provider name', () => {
      expect(FireblocksProvider.getProviderName()).toBe('fireblocks');
    });
  });

  describe('init', () => {
    it('should initialize wallet factory and transaction handler', async () => {
      const result = await provider.init();

      expect(mockWalletFactory.init).toHaveBeenCalledWith(
        'test-pk',
        'test-key',
        'https://api.fireblocks.io'
      );
      expect(Transaction).toHaveBeenCalledWith(mockFireblocksSDK);
      expect(result.success).toBe(true);
    });

    it('should use default URL when not configured', async () => {
      provider.config.apiBaseUrl = undefined;

      await provider.init();

      expect(mockWalletFactory.init).toHaveBeenCalledWith(
        'test-pk',
        'test-key',
        'https://api.fireblocks.io'
      );
    });

    it('should throw error when API key missing', async () => {
      provider.secret.apiKey = null;

      await expect(provider.init()).rejects.toThrow(
        'Fireblocks API credentials not configured properly'
      );
    });

    it('should throw error when private key missing', async () => {
      provider.secret.privateKey = null;

      await expect(provider.init()).rejects.toThrow(
        'Fireblocks API credentials not configured properly'
      );
    });

    it('should propagate wallet factory initialization errors', async () => {
      mockWalletFactory.init.mockRejectedValue(new Error('Init failed'));

      await expect(provider.init()).rejects.toThrow('Init failed');
    });
  });

  describe('getTransactionById', () => {
    beforeEach(async () => {
      await provider.init();
    });

    it('should fetch transaction from Fireblocks', async () => {
      const mockTx = {
        id: 'fb-123',
        status: 'COMPLETED',
        txHash: '0xabc'
      };

      mockTransaction.getTransactionById.mockResolvedValue(mockTx);

      const result = await provider.getTransactionById('fb-123');

      expect(mockTransaction.getTransactionById).toHaveBeenCalledWith('fb-123');
      expect(result).toEqual(mockTx);
    });

    it('should throw error when transaction not found', async () => {
      mockTransaction.getTransactionById.mockRejectedValue(
        new Error('Transaction not found')
      );

      await expect(
        provider.getTransactionById('invalid')
      ).rejects.toThrow('Transaction not found');
    });
  });

  describe('getTokenBalance', () => {
    beforeEach(async () => {
      await provider.init();
    });

    it('should return balance in atomic units', async () => {
      const token = {
        symbol: 'BTC',
        decimalPlaces: 8,
        walletConfig: {
          fireblocks: {
            vaultId: 'vault1',
            assetId: 'BTC'
          }
        }
      };

      mockWalletFactory.getTokenBalance.mockResolvedValue('1.5'); // 1.5 BTC

      const result = await provider.getTokenBalance(token);

      expect(mockWalletFactory.getTokenBalance).toHaveBeenCalledWith('vault1', 'BTC');
      expect(result).toBe('150000000'); // 1.5 * 10^8
    });

    it('should handle zero balance', async () => {
      const token = {
        symbol: 'ETH',
        decimalPlaces: 18,
        walletConfig: {
          fireblocks: { vaultId: 'vault2', assetId: 'ETH' }
        }
      };

      mockWalletFactory.getTokenBalance.mockResolvedValue('0');

      const result = await provider.getTokenBalance(token);

      expect(result).toBe('0');
    });

    it('should handle large balances correctly', async () => {
      const token = {
        symbol: 'USDC',
        decimalPlaces: 6,
        walletConfig: {
          fireblocks: { vaultId: 'vault3', assetId: 'USDC' }
        }
      };

      mockWalletFactory.getTokenBalance.mockResolvedValue('1000000'); // 1M USDC

      const result = await provider.getTokenBalance(token);

      expect(result).toBe('1000000000000'); // 1M * 10^6
    });

    it('should throw error on API failure', async () => {
      const token = {
        symbol: 'BTC',
        decimalPlaces: 8,
        walletConfig: {
          fireblocks: { vaultId: 'vault1', assetId: 'BTC' }
        }
      };

      mockWalletFactory.getTokenBalance.mockRejectedValue(
        new Error('API error')
      );

      await expect(
        provider.getTokenBalance(token)
      ).rejects.toThrow('API error');
    });
  });

  describe('createTransferRequest', () => {
    beforeEach(async () => {
      await provider.init();
    });

    it('should create vault-to-vault transfer request', async () => {
      const transferData = {
        coldWalletId: 'vault0',
        hotWalletId: 'vault1',
        amount: '1.5',
        asset: 'BTC',
        assetId: 'BTC',
        blockchain: 'Bitcoin',
        externalTxId: 'refill-001',
        coldWalletConfig: { fireblocks: { assetId: 'BTC' } }
      };

      mockTransaction.createTransaction.mockResolvedValue({
        id: 'fb-tx-999',
        status: 'SUBMITTED'
      });

      const result = await provider.createTransferRequest(transferData);

      expect(result.status).toBe('SUBMITTED');
      expect(result.externalTxId).toBe('refill-001_BTC');
      expect(result.transactionId).toBeDefined(); // Transaction ID should exist
      expect(result.message).toContain('Vault-to-vault transfer');
    });

    it('should default assetId to asset symbol when not provided', async () => {
      const transferData = {
        coldWalletId: 'vault0',
        hotWalletId: 'vault1',
        amount: '1.0',
        asset: 'BTC',
        blockchain: 'Bitcoin',
        externalTxId: 'refill-auto',
        coldWalletConfig: { fireblocks: {} }
      };

      mockTransaction.createTransaction.mockResolvedValue({
        id: 'fb-tx',
        status: 'SUBMITTED'
      });

      await provider.createTransferRequest(transferData);

      expect(mockTransaction.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: 'BTC',
          externalTxId: 'refill-auto_BTC'
        })
      );
    });

    it('should append assetId to externalTxId when provided', async () => {
      const transferData = {
        coldWalletId: 'vault0',
        hotWalletId: 'vault1',
        amount: '1.0',
        asset: 'BTC',
        blockchain: 'Bitcoin',
        externalTxId: 'fireblocks_refill_auto',
        coldWalletConfig: { fireblocks: { assetId: 'BTC' } }
      };

      mockTransaction.createTransaction.mockResolvedValue({
        id: 'fb-tx-auto',
        status: 'SUBMITTED'
      });

      const result = await provider.createTransferRequest(transferData);

      expect(result.externalTxId).toBe('fireblocks_refill_auto_BTC');
    });

    it('should include note in transaction', async () => {
      const transferData = {
        coldWalletId: 'vault0',
        hotWalletId: 'vault1',
        amount: '1.0',
        asset: 'ETH',
        assetId: 'ETH',
        blockchain: 'Ethereum',
        externalTxId: 'ext-001',
        coldWalletConfig: { fireblocks: { assetId: 'ETH' } }
      };

      mockTransaction.createTransaction.mockResolvedValue({
        id: 'fb-tx',
        status: 'SUBMITTED'
      });

      const result = await provider.createTransferRequest(transferData);

      // Verify the result contains expected data
      expect(result).toBeDefined();
      expect(result.status).toBe('SUBMITTED');
      expect(result.externalTxId).toBe('ext-001_ETH');
    });
  });

  describe('validateCredentials', () => {
    beforeEach(async () => {
      await provider.init();
    });

    it('should validate credentials successfully', async () => {
      mockWalletFactory.validateCredentials.mockResolvedValue({
        success: true
      });

      const result = await provider.validateCredentials();

      expect(result.success).toBe(true);
      expect(mockWalletFactory.validateCredentials).toHaveBeenCalled();
    });

    it('should return error when credentials invalid', async () => {
      mockWalletFactory.validateCredentials.mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      });

      const result = await provider.validateCredentials();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should handle validation errors', async () => {
      mockWalletFactory.validateCredentials.mockRejectedValue(
        new Error('Network error')
      );

      const result = await provider.validateCredentials();

      expect(result.success).toBe(false);
      expect(result.code).toBe('CREDENTIAL_VALIDATION_ERROR');
      expect(result.details).toContain('Network error');
    });
  });
});

