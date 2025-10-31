const refillService = require('../../../service/refillService');
const refillValidationService = require('../../../service/refillValidationService');
const refillTransactionService = require('../../../service/refillTransactionService');
const providerService = require('../../../service/providerService');
const BigNumber = require('bignumber.js');

jest.mock('../../../service/refillValidationService');
jest.mock('../../../service/refillTransactionService');
jest.mock('../../../service/providerService');
jest.mock('../../../middleware/logger');

describe('RefillService', () => {
  let mockProvider;

  beforeEach(() => {
    mockProvider = createMockProvider('fireblocks');
    refillService.initialized = false; // Reset singleton state
    
    // Mock providerService
    providerService.initialize = jest.fn().mockResolvedValue();
    providerService.getProviders = jest.fn().mockReturnValue(
      new Map([['fireblocks', mockProvider]])
    );
    providerService.getTokenProvider = jest.fn().mockResolvedValue(mockProvider);
    
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize provider service', async () => {
      await refillService.initialize();

      expect(providerService.initialize).toHaveBeenCalled();
      expect(refillService.initialized).toBe(true);
    });

    it('should only initialize once', async () => {
      await refillService.initialize();
      await refillService.initialize();

      expect(providerService.initialize).toHaveBeenCalledTimes(1);
    });

    it('should throw error on initialization failure', async () => {
      providerService.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(refillService.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('processRefillRequestService', () => {
    const mockRefillData = {
      refill_request_id: 'REQ001',
      wallet_address: '0x123',
      asset_symbol: 'BTC',
      chain_name: 'Bitcoin',
      refill_amount: '1.0',
      refill_sweep_wallet: '0xcold',
      asset_address: 'native'
    };

    it('should process valid refill request successfully', async () => {
      const validatedData = {
        wallet: { id: 1, address: '0x123' },
        asset: { id: 1, symbol: 'BTC', decimals: 8, sweepWalletConfig: { fireblocks: { vaultId: '0', assetId: 'BTC' } }, hotWalletConfig: { fireblocks: { vaultId: '1' } } },
        blockchain: { id: 1, symbol: 'BTC' },
        refillAmountAtomic: '100000000'
      };

      refillValidationService.validateRefillRequest.mockResolvedValue({
        success: true,
        data: validatedData
      });

      refillTransactionService.createRefillTransaction.mockResolvedValue({
        success: true,
        data: { transaction: { id: 123 } }
      });

      mockProvider.createTransferRequest.mockResolvedValue({
        id: 'fb-tx-123',
        transactionId: 'fb-tx-123',
        status: 'SUBMITTED',
        message: 'Transfer created'
      });

      refillTransactionService.mapProviderStatusToInternal.mockReturnValue('PROCESSING');
      refillTransactionService.updateRefillTransaction.mockResolvedValue({
        success: true
      });

      const result = await refillService.processRefillRequestService(mockRefillData);

      expect(result.success).toBe(true);
      expect(result.data.refillRequestId).toBe('REQ001');
      expect(result.data.provider).toBe('fireblocks');
    });

    it('should return error when provider not available', async () => {
      providerService.getTokenProvider.mockResolvedValue(null);

      const result = await refillService.processRefillRequestService(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('NO_PROVIDER_AVAILABLE');
    });

    it('should return error when validation fails', async () => {
      refillValidationService.validateRefillRequest.mockResolvedValue({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      });

      const result = await refillService.processRefillRequestService(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('VALIDATION_ERROR');
    });

    it('should return error when transaction creation fails', async () => {
      refillValidationService.validateRefillRequest.mockResolvedValue({
        success: true,
        data: {
          wallet: { id: 1 },
          asset: { id: 1, symbol: 'BTC' },
          blockchain: { id: 1 },
          refillAmountAtomic: '100000000'
        }
      });

      refillTransactionService.createRefillTransaction.mockResolvedValue({
        success: false,
        error: 'Transaction exists',
        code: 'TRANSACTION_EXISTS'
      });

      const result = await refillService.processRefillRequestService(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('TRANSACTION_CREATION_ERROR');
    });

    it('should handle transfer request failure', async () => {
      refillValidationService.validateRefillRequest.mockResolvedValue({
        success: true,
        data: {
          wallet: { id: 1, address: '0x123' },
          asset: { id: 1, symbol: 'BTC', decimals: 8, sweepWalletConfig: { fireblocks: { vaultId: '0', assetId: 'BTC' } }, hotWalletConfig: { fireblocks: { vaultId: '1' } } },
          blockchain: { id: 1, symbol: 'BTC' },
          refillAmountAtomic: '100000000'
        }
      });

      refillTransactionService.createRefillTransaction.mockResolvedValue({
        success: true,
        data: { transaction: { id: 123 } }
      });

      mockProvider.createTransferRequest.mockRejectedValue(
        new Error('Insufficient balance')
      );

      refillTransactionService.updateRefillTransaction.mockResolvedValue({
        success: true
      });

      const result = await refillService.processRefillRequestService(mockRefillData);

      expect(result.success).toBe(false);
      expect(refillTransactionService.updateRefillTransaction).toHaveBeenCalledWith(
        'REQ001',
        expect.objectContaining({ status: 'FAILED' })
      );
    });
  });

  describe('initiateRefill', () => {
    const validatedData = {
      wallet: { id: 1, address: '0xhot' },
      asset: {
        id: 1,
        symbol: 'BTC',
        decimals: 8,
        refillSweepWallet: '0xcold',
        sweepWalletConfig: { fireblocks: { vaultId: '0', assetId: 'BTC' } },
        hotWalletConfig: { fireblocks: { vaultId: '1', assetId: 'BTC' } },
        contractAddress: 'native'
      },
      blockchain: { id: 1, symbol: 'BTC' },
      refillAmountAtomic: '100000000'
    };

    it('should convert atomic amount to decimal correctly', async () => {
      mockProvider.createTransferRequest.mockResolvedValue({
        id: 'fb-123',
        transactionId: 'fb-123',
        status: 'SUBMITTED'
      });

      await refillService.initiateRefill(validatedData, mockProvider, 'REQ001');

      const callArgs = mockProvider.createTransferRequest.mock.calls[0][0];
      expect(callArgs.amount).toBe('1'); // 100000000 / 10^8 = 1.0
    });

    it('should include externalTxId for idempotency', async () => {
      mockProvider.createTransferRequest.mockResolvedValue({
        id: 'fb-123',
        transactionId: 'fb-123',
        status: 'SUBMITTED'
      });

      await refillService.initiateRefill(validatedData, mockProvider, 'REQ999');

      const callArgs = mockProvider.createTransferRequest.mock.calls[0][0];
      expect(callArgs.externalTxId).toBe('REQ999');
    });

    it('should return success with transfer details', async () => {
      mockProvider.createTransferRequest.mockResolvedValue({
        id: 'fb-tx-123',
        transactionId: 'fb-tx-123',
        status: 'SUBMITTED',
        message: 'Transfer created'
      });

      const result = await refillService.initiateRefill(validatedData, mockProvider, 'REQ001');

      expect(result.success).toBe(true);
      expect(result.data.refillRequestId).toBe('REQ001');
      expect(result.data.transferId).toBe('fb-tx-123');
      expect(result.data.status).toBe('SUBMITTED');
    });

    it('should handle transfer request failure', async () => {
      mockProvider.createTransferRequest.mockRejectedValue(
        new Error('API timeout')
      );

      const result = await refillService.initiateRefill(validatedData, mockProvider, 'REQ001');

      expect(result.success).toBe(false);
      expect(result.code).toBe('REFILL_INITIATION_ERROR');
      expect(result.data.details).toContain('API timeout');
    });
  });
});

