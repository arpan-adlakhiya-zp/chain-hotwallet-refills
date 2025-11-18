const LiminalProvider = require('../../../../providers/liminal');
const WalletFactory = require('../../../../providers/liminal/walletFactory');
const Transaction = require('../../../../providers/liminal/transaction');

jest.mock('../../../../providers/liminal/walletFactory');
jest.mock('../../../../providers/liminal/transaction');
jest.mock('../../../../middleware/logger');

describe('LiminalProvider', () => {
  let provider;
  let mockWalletFactory;
  let mockTransaction;

  beforeEach(() => {
    mockWalletFactory = {
      init: jest.fn().mockResolvedValue(true),
      getTokenBalance: jest.fn(),
      getWallet: jest.fn()
    };

    mockTransaction = {
      createTransferRequest: jest.fn(),
      getTransactionById: jest.fn()
    };

    WalletFactory.mockImplementation(() => mockWalletFactory);
    Transaction.mockImplementation(() => mockTransaction);

    const config = { env: 'dev', walletId: 'wallet-123' };
    const secret = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      AuthAudience: 'test-audience'
    };
    
    provider = new LiminalProvider(config, secret);
    jest.clearAllMocks();
  });

  describe('getProviderName', () => {
    it('should return liminal as provider name', () => {
      expect(LiminalProvider.getProviderName()).toBe('liminal');
    });
  });

  describe('init', () => {
    it('should initialize wallet factory and transaction handler', async () => {
      const result = await provider.init();

      expect(mockWalletFactory.init).toHaveBeenCalledWith({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        AuthAudience: 'test-audience'
      });
      expect(Transaction).toHaveBeenCalledWith(mockWalletFactory);
      expect(result.success).toBe(true);
    });

    it('should throw error when clientId missing', async () => {
      provider.secret.clientId = null;

      await expect(provider.init()).rejects.toThrow(
        'Liminal API credentials not configured properly'
      );
    });

    it('should throw error when clientSecret missing', async () => {
      provider.secret.clientSecret = null;

      await expect(provider.init()).rejects.toThrow(
        'Liminal API credentials not configured properly'
      );
    });

    it('should throw error when AuthAudience missing', async () => {
      provider.secret.AuthAudience = null;

      await expect(provider.init()).rejects.toThrow(
        'Liminal API credentials not configured properly'
      );
    });

    it('should propagate wallet factory initialization errors', async () => {
      mockWalletFactory.init.mockRejectedValue(new Error('Init failed'));

      await expect(provider.init()).rejects.toThrow('Init failed');
    });
  });

  describe('getTokenBalance', () => {
    beforeEach(async () => {
      await provider.init();
    });

    it('should return balance in atomic units', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      mockWalletFactory.getTokenBalance.mockResolvedValue('150000000');

      const result = await provider.getTokenBalance(token);

      expect(mockWalletFactory.getTokenBalance).toHaveBeenCalledWith(token);
      expect(result).toBe('150000000');
    });

    it('should handle zero balance', async () => {
      const token = {
        symbol: 'ETH',
        blockchainSymbol: 'ethereum',
        walletConfig: {
          liminal: {
            walletId: 'wallet-456'
          }
        }
      };

      mockWalletFactory.getTokenBalance.mockResolvedValue('0');

      const result = await provider.getTokenBalance(token);

      expect(result).toBe('0');
    });

    it('should throw error on API failure', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
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

    it('should create transfer request successfully', async () => {
      const transferData = {
        coldWalletId: 'wallet-123',
        hotWalletAddress: '0xhot123',
        amount: '1.5',
        asset: 'BTC',
        blockchain: 'bitcoin',
        externalTxId: 'refill-001',
        coldWalletConfig: {
          liminal: {
            walletId: 'wallet-123',
            tokenSymbol: 'BTC',
            version: 'v1'
          }
        }
      };

      const mockTransferResult = {
        status: 1,
        message: 'Transfer request created',
        externalTxId: 'refill-001_BTC',
        transactionId: '12345'
      };

      mockTransaction.createTransferRequest.mockResolvedValue(mockTransferResult);

      const result = await provider.createTransferRequest(transferData);

      expect(mockTransaction.createTransferRequest).toHaveBeenCalledWith(transferData);
      expect(result).toEqual(mockTransferResult);
    });

    it('should throw error when transfer request fails', async () => {
      const transferData = {
        coldWalletId: 'wallet-123',
        hotWalletAddress: '0xhot123',
        amount: '1.0',
        asset: 'BTC',
        blockchain: 'bitcoin',
        externalTxId: 'refill-002',
        coldWalletConfig: {
          liminal: {
            walletId: 'wallet-123',
            tokenSymbol: 'BTC',
            version: 'v1'
          }
        }
      };

      mockTransaction.createTransferRequest.mockRejectedValue(
        new Error('Transfer failed')
      );

      await expect(
        provider.createTransferRequest(transferData)
      ).rejects.toThrow('Transfer failed');
    });
  });

  describe('getTransactionById', () => {
    beforeEach(async () => {
      await provider.init();
    });

    it('should fetch transaction successfully', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      const mockTx = {
        identifier: 'txn-123',
        status: 4,
        comment: 'Transfer completed'
      };

      mockTransaction.getTransactionById.mockResolvedValue(mockTx);

      const result = await provider.getTransactionById('txn-123', 'seq-123', token);

      expect(mockTransaction.getTransactionById).toHaveBeenCalledWith('txn-123', 'seq-123', token);
      expect(result).toEqual(mockTx);
    });

    it('should throw error when token not provided', async () => {
      await expect(
        provider.getTransactionById('txn-123', 'seq-123', null)
      ).rejects.toThrow('Token configuration is required for Liminal getTransactionById');
    });

    it('should throw error when transaction not found', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      mockTransaction.getTransactionById.mockRejectedValue(
        new Error('Transaction not found')
      );

      await expect(
        provider.getTransactionById('invalid', 'invalid-seq', token)
      ).rejects.toThrow('Transaction not found');
    });
  });
});

