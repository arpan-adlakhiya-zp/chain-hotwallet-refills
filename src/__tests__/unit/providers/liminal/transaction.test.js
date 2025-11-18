const Transaction = require('../../../../providers/liminal/transaction');
const { Result } = require('neverthrow');

jest.mock('../../../../middleware/logger');
jest.mock('../../../../config');

describe('Liminal Transaction', () => {
  let transaction;
  let mockWalletFactory;
  let mockWallet;
  let mockWalletV2;

  beforeEach(() => {
    // Mock WalletV2
    mockWalletV2 = {
      CreateSendManyTransactionRequestAsync: jest.fn()
    };

    // Mock Wallet
    mockWallet = {
      WalletAddress: '0x1234567890abcdef',
      WalletV2: jest.fn().mockReturnValue(mockWalletV2),
      GetPendingTransaction: jest.fn(),
      GetTransfer: jest.fn()
    };

    // Mock WalletFactory
    mockWalletFactory = {
      getWallet: jest.fn().mockResolvedValue(mockWallet)
    };

    transaction = new Transaction(mockWalletFactory);
    jest.clearAllMocks();
  });

  describe('createTransferRequest', () => {
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

      const mockResponse = {
        success: true,
        message: 'Transaction created',
        data: {
          txnReqId: 12345,
          sequenceId: 'refill-001_BTC',
          status: 1,
          comment: 'Cold to hot wallet refill: 1.5 BTC',
          timestamp: Date.now()
        }
      };

      const mockResult = {
        isErr: () => false,
        value: mockResponse
      };

      mockWalletV2.CreateSendManyTransactionRequestAsync.mockResolvedValue(mockResult);

      const result = await transaction.createTransferRequest(transferData);

      expect(mockWalletFactory.getWallet).toHaveBeenCalledWith({
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        contractAddress: null,
        walletConfig: transferData.coldWalletConfig
      });
      expect(mockWallet.WalletV2).toHaveBeenCalled();
      expect(mockWalletV2.CreateSendManyTransactionRequestAsync).toHaveBeenCalledWith({
        sendManyOptions: {
          recipients: [{
            address: '0xhot123',
            amount: '1.5'
          }],
          sequenceId: 'refill-001_BTC',
          isInternal: true,
          comment: 'Cold to hot wallet refill: 1.5 BTC'
        }
      });
      expect(result.transactionId).toBe('12345');
      expect(result.externalTxId).toBe('refill-001_BTC');
      expect(result.status).toBe(1);
    });

    it('should use default asset symbol when tokenSymbol not provided', async () => {
      const transferData = {
        coldWalletId: 'wallet-123',
        hotWalletAddress: '0xhot123',
        amount: '1.0',
        asset: 'ETH',
        blockchain: 'ethereum',
        externalTxId: 'refill-002',
        coldWalletConfig: {
          liminal: {
            walletId: 'wallet-123'
            // tokenSymbol missing
          }
        }
      };

      const mockResponse = {
        success: true,
        data: {
          txnReqId: 67890,
          sequenceId: 'refill-002_ETH'
        }
      };

      const mockResult = {
        isErr: () => false,
        value: mockResponse
      };

      mockWalletV2.CreateSendManyTransactionRequestAsync.mockResolvedValue(mockResult);

      await transaction.createTransferRequest(transferData);

      expect(mockWalletV2.CreateSendManyTransactionRequestAsync).toHaveBeenCalledWith({
        sendManyOptions: expect.objectContaining({
          sequenceId: 'refill-002_ETH'
        })
      });
    });

    it('should handle contract token transfer', async () => {
      const transferData = {
        coldWalletId: 'wallet-123',
        hotWalletAddress: '0xhot123',
        amount: '1000',
        asset: 'USDC',
        blockchain: 'ethereum',
        contractAddress: '0xusdc123',
        externalTxId: 'refill-003',
        coldWalletConfig: {
          liminal: {
            walletId: 'wallet-123',
            tokenSymbol: 'USDC',
            version: 'v1'
          }
        }
      };

      const mockResponse = {
        success: true,
        data: {
          txnReqId: 11111,
          sequenceId: 'refill-003_USDC'
        }
      };

      const mockResult = {
        isErr: () => false,
        value: mockResponse
      };

      mockWalletV2.CreateSendManyTransactionRequestAsync.mockResolvedValue(mockResult);

      await transaction.createTransferRequest(transferData);

      expect(mockWalletFactory.getWallet).toHaveBeenCalledWith({
        symbol: 'USDC',
        blockchainSymbol: 'ethereum',
        contractAddress: '0xusdc123',
        walletConfig: transferData.coldWalletConfig
      });
    });

    it('should throw error when CreateSendManyTransactionRequestAsync fails', async () => {
      const transferData = {
        coldWalletId: 'wallet-123',
        hotWalletAddress: '0xhot123',
        amount: '1.0',
        asset: 'BTC',
        blockchain: 'bitcoin',
        externalTxId: 'refill-004',
        coldWalletConfig: {
          liminal: {
            walletId: 'wallet-123',
            tokenSymbol: 'BTC',
            version: 'v1'
          }
        }
      };

      const mockError = {
        isErr: () => true,
        error: {
          message: 'Insufficient balance'
        }
      };

      mockWalletV2.CreateSendManyTransactionRequestAsync.mockResolvedValue(mockError);

      await expect(
        transaction.createTransferRequest(transferData)
      ).rejects.toThrow('Insufficient balance');
    });

    it('should throw error when response.success is false', async () => {
      const transferData = {
        coldWalletId: 'wallet-123',
        hotWalletAddress: '0xhot123',
        amount: '1.0',
        asset: 'BTC',
        blockchain: 'bitcoin',
        externalTxId: 'refill-005',
        coldWalletConfig: {
          liminal: {
            walletId: 'wallet-123',
            tokenSymbol: 'BTC',
            version: 'v1'
          }
        }
      };

      const mockResponse = {
        success: false,
        message: 'Transaction failed'
      };

      const mockResult = {
        isErr: () => false,
        value: mockResponse
      };

      mockWalletV2.CreateSendManyTransactionRequestAsync.mockResolvedValue(mockResult);

      await expect(
        transaction.createTransferRequest(transferData)
      ).rejects.toThrow('Transaction failed');
    });

    it('should throw error when wallet not found', async () => {
      const transferData = {
        coldWalletId: 'wallet-123',
        hotWalletAddress: '0xhot123',
        amount: '1.0',
        asset: 'BTC',
        blockchain: 'bitcoin',
        externalTxId: 'refill-006',
        coldWalletConfig: {
          liminal: {
            walletId: 'wallet-123',
            tokenSymbol: 'BTC',
            version: 'v1'
          }
        }
      };

      mockWalletFactory.getWallet.mockResolvedValue(null);

      await expect(
        transaction.createTransferRequest(transferData)
      ).rejects.toThrow('Unable to get cold wallet instance');
    });

    it('should throw error when WalletV2 not available', async () => {
      const transferData = {
        coldWalletId: 'wallet-123',
        hotWalletAddress: '0xhot123',
        amount: '1.0',
        asset: 'BTC',
        blockchain: 'bitcoin',
        externalTxId: 'refill-007',
        coldWalletConfig: {
          liminal: {
            walletId: 'wallet-123',
            tokenSymbol: 'BTC',
            version: 'v1'
          }
        }
      };

      mockWallet.WalletV2.mockReturnValue(null);

      await expect(
        transaction.createTransferRequest(transferData)
      ).rejects.toThrow('Unable to get WalletV2 instance');
    });
  });

  describe('getTransactionById', () => {
    it('should get transaction by sequenceId successfully', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      const mockPendingResult = {
        success: true,
        data: {
          transaction: {
            identifier: 'txn-123',
            status: 1,
            comment: 'Transfer pending'
          }
        }
      };

      mockWallet.GetPendingTransaction.mockResolvedValue(mockPendingResult);

      const result = await transaction.getTransactionById('txn-123', 'seq-123', token);

      expect(mockWalletFactory.getWallet).toHaveBeenCalledWith(token);
      expect(mockWallet.GetPendingTransaction).toHaveBeenCalledWith({
        sequenceId: 'seq-123'
      });
      expect(result).toEqual(mockPendingResult.data.transaction);
    });

    it('should fallback to GetTransfer when pending transaction not found', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      const mockPendingResult = {
        success: false,
        message: 'Pending transaction is not found'
      };

      const mockTransferResult = {
        success: true,
        data: {
          transaction: {
            identifier: 'txn-456',
            status: 4,
            txid: '0xabc123'
          }
        }
      };

      mockWallet.GetPendingTransaction.mockResolvedValue(mockPendingResult);
      mockWallet.GetTransfer.mockResolvedValue(mockTransferResult);

      const result = await transaction.getTransactionById('txn-456', 'seq-456', token);

      expect(mockWallet.GetPendingTransaction).toHaveBeenCalledWith({
        sequenceId: 'seq-456'
      });
      expect(mockWallet.GetTransfer).toHaveBeenCalledWith({
        txId: 'txn-456',
        sequenceId: 'seq-456'
      });
      expect(result).toEqual(mockTransferResult.data.transaction);
    });

    it('should throw error when token not provided', async () => {
      await expect(
        transaction.getTransactionById('txn-123', 'seq-123', null)
      ).rejects.toThrow('Token configuration is required to get transaction by ID');
    });

    it('should throw error when wallet not found', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      mockWalletFactory.getWallet.mockResolvedValue(null);

      await expect(
        transaction.getTransactionById('txn-123', 'seq-123', token)
      ).rejects.toThrow('Unable to get wallet instance');
    });

    it('should throw error when both pending and transfer lookups fail', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      const mockPendingResult = {
        success: false,
        message: 'Pending transaction is not found'
      };

      const mockTransferResult = {
        success: false,
        message: 'Transaction not found'
      };

      mockWallet.GetPendingTransaction.mockResolvedValue(mockPendingResult);
      mockWallet.GetTransfer.mockResolvedValue(mockTransferResult);

      await expect(
        transaction.getTransactionById('txn-123', 'seq-123', token)
      ).rejects.toThrow('error:');
    });

    it('should throw error when pending lookup fails with non-not-found error', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      const mockPendingResult = {
        success: false,
        message: 'API error occurred'
      };

      mockWallet.GetPendingTransaction.mockResolvedValue(mockPendingResult);

      await expect(
        transaction.getTransactionById('txn-123', 'seq-123', token)
      ).rejects.toThrow('error:');
    });
  });
});

