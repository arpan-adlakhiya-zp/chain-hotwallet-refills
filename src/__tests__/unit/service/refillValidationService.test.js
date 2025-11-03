const refillValidationService = require('../../../service/refillValidationService');
const databaseService = require('../../../service/chainDb');
const BigNumber = require('bignumber.js');

jest.mock('../../../service/chainDb');
jest.mock('../../../middleware/logger');

describe('RefillValidationService', () => {
  let mockProvider;

  beforeEach(() => {
    mockProvider = createMockProvider('fireblocks');
    jest.clearAllMocks();
  });

  describe('validateRequiredFields', () => {
    it('should pass when all required fields are present', () => {
      const refillData = {
        refill_request_id: 'REQ001',
        wallet_address: '0x123',
        asset_symbol: 'BTC',
        asset_address: 'native',
        chain_name: 'Bitcoin',
        refill_amount: '1.0',
        refill_sweep_wallet: '0xabc'
      };

      const result = refillValidationService.validateRequiredFields(refillData);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data.missingFields).toHaveLength(0);
    });

    it('should fail when required fields are missing', () => {
      const refillData = {
        wallet_address: '0x123'
      };
      
      const result = refillValidationService.validateRequiredFields(refillData);
      
      expect(result.success).toBe(false);
      expect(result.code).toBe('MISSING_FIELDS');
      expect(result.error).toContain('Missing required fields');
      expect(result.data.missingFields.length).toBeGreaterThan(0);
    });

    it('should identify all missing fields', () => {
      const refillData = {}; // All fields missing
      
      const result = refillValidationService.validateRequiredFields(refillData);
      
      expect(result.data.missingFields).toContain('refill_request_id');
      expect(result.data.missingFields).toContain('wallet_address');
      expect(result.data.missingFields).toContain('asset_symbol');
      expect(result.data.missingFields).toContain('chain_name');
    });
  });

  describe('determineHotWalletAddress', () => {
    it('should return wallet_address for native tokens', () => {
      const refillData = {
        wallet_address: '0x123abc',
        asset_address: 'native'
      };
      const asset = {};

      const result = refillValidationService.determineHotWalletAddress(refillData, asset);
      
      expect(result).toBe('0x123abc');
    });

    it('should return asset wallet address for contract tokens', () => {
      const refillData = {
        wallet_address: '0x123',
        asset_address: '0xcontract'
      };
      const asset = {
        Wallet: {
          address: '0xwalletaddress'
        }
      };

      const result = refillValidationService.determineHotWalletAddress(refillData, asset);
      
      expect(result).toBe('0xwalletaddress');
    });

    it('should throw error for contract token without wallet', () => {
      const refillData = {
        asset_address: '0xcontract'
      };
      const asset = {};

      expect(() => {
        refillValidationService.determineHotWalletAddress(refillData, asset);
      }).toThrow('Contract token asset must have an associated wallet');
    });

    it('should throw error when asset.Wallet is null', () => {
      const refillData = {
        asset_address: '0xcontract'
      };
      const asset = {
        Wallet: null
      };

      expect(() => {
        refillValidationService.determineHotWalletAddress(refillData, asset);
      }).toThrow('Contract token asset must have an associated wallet');
    });
  });

  describe('validateAsset', () => {
    it('should return success when asset exists and is active', async () => {
      const mockAsset = createMockAsset();
      databaseService.getAssetBySymbolAndBlockchain.mockResolvedValue(mockAsset);

      const result = await refillValidationService.validateAsset('BTC', 1);

      expect(result.success).toBe(true);
      expect(result.data.asset).toEqual(mockAsset);
      expect(databaseService.getAssetBySymbolAndBlockchain).toHaveBeenCalledWith('BTC', 1);
    });

    it('should return error when asset not found', async () => {
      databaseService.getAssetBySymbolAndBlockchain.mockResolvedValue(null);

      const result = await refillValidationService.validateAsset('UNKNOWN', 1);

      expect(result.success).toBe(false);
      expect(result.code).toBe('ASSET_NOT_FOUND');
      expect(result.error).toContain('Asset not found or inactive');
    });

    it('should handle database errors', async () => {
      databaseService.getAssetBySymbolAndBlockchain.mockRejectedValue(
        new Error('DB error')
      );

      const result = await refillValidationService.validateAsset('BTC', 1);

      expect(result.success).toBe(false);
      expect(result.code).toBe('ASSET_VALIDATION_ERROR');
    });
  });

  describe('validateRefillSweepWallet', () => {
    it('should pass when sweep wallet matches', async () => {
      const asset = {
        symbol: 'BTC',
        refillSweepWallet: '0xcoldwallet'
      };

      const result = await refillValidationService.validateRefillSweepWallet('0xcoldwallet', asset);

      expect(result.success).toBe(true);
    });

    it('should fail when sweep wallet does not match', async () => {
      const asset = {
        symbol: 'BTC',
        refillSweepWallet: '0xcoldwallet'
      };

      const result = await refillValidationService.validateRefillSweepWallet('0xwrongwallet', asset);

      expect(result.success).toBe(false);
      expect(result.code).toBe('SWEEP_WALLET_MISMATCH');
      expect(result.data.expected).toBe('0xcoldwallet');
      expect(result.data.received).toBe('0xwrongwallet');
    });

    it('should fail when asset has no sweep wallet configured', async () => {
      const asset = {
        symbol: 'BTC',
        refillSweepWallet: null
      };

      const result = await refillValidationService.validateRefillSweepWallet('0xwallet', asset);

      expect(result.success).toBe(false);
      expect(result.code).toBe('NO_SWEEP_WALLET_CONFIGURED');
    });
  });

  describe('validateColdWalletBalance', () => {
    it('should pass when cold wallet has sufficient balance', async () => {
      const asset = createMockAsset();
      
      mockProvider.getTokenBalance.mockResolvedValue('200000000'); // 2 BTC in satoshi

      const result = await refillValidationService.validateColdWalletBalance(
        asset,
        1.0, // Requesting 1 BTC
        mockProvider
      );

      expect(result.success).toBe(true);
      expect(result.data.message).toContain('sufficient balance');
      expect(mockProvider.getTokenBalance).toHaveBeenCalled();
    });

    it('should fail when cold wallet has insufficient balance', async () => {
      const asset = createMockAsset();
      
      mockProvider.getTokenBalance.mockResolvedValue('50000000'); // 0.5 BTC

      const result = await refillValidationService.validateColdWalletBalance(
        asset,
        1.0, // Requesting 1 BTC - more than available
        mockProvider
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('INSUFFICIENT_BALANCE');
      expect(result.data.availableBalance).toBe('50000000');
    });

    it('should fail when asset has no sweep wallet config', async () => {
      const asset = {
        ...createMockAsset(),
        sweepWalletConfig: null
      };

      const result = await refillValidationService.validateColdWalletBalance(asset, 1.0, mockProvider);

      expect(result.success).toBe(false);
      expect(result.code).toBe('NO_COLD_WALLET_CONFIGURED');
    });

    it('should handle provider errors', async () => {
      const asset = createMockAsset();
      
      mockProvider.getTokenBalance.mockRejectedValue(new Error('API error'));

      const result = await refillValidationService.validateColdWalletBalance(asset, 1.0, mockProvider);

      expect(result.success).toBe(false);
      expect(result.code).toBe('BALANCE_VALIDATION_ERROR');
    });
  });

  describe('validateHotWalletNeedsRefill', () => {
    it('should pass when hot wallet needs refill', async () => {
      const asset = createMockAsset({
        refillTargetBalanceAtomic: '100000000', // 1 BTC target
        refillTriggerThresholdAtomic: '50000000' // 0.5 BTC trigger
      });
      const mockWallet = createMockWallet();

      databaseService.getWalletByAddress.mockResolvedValue(mockWallet);
      mockProvider.getTokenBalance.mockResolvedValue('30000000'); // 0.3 BTC - below trigger

      const result = await refillValidationService.validateHotWalletNeedsRefill(
        '0x123',
        1.0,
        mockProvider,
        asset
      );

      expect(result.success).toBe(true);
      expect(result.data.wallet).toEqual(mockWallet);
    });

    it('should fail when hot wallet not found', async () => {
      databaseService.getWalletByAddress.mockResolvedValue(null);

      const result = await refillValidationService.validateHotWalletNeedsRefill(
        '0xnonexistent',
        1.0,
        mockProvider,
        createMockAsset()
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('HOT_WALLET_NOT_FOUND');
    });

    it('should fail when wallet is not a hot wallet', async () => {
      const coldWallet = createMockWallet({ walletType: 'cold' });
      databaseService.getWalletByAddress.mockResolvedValue(coldWallet);

      const result = await refillValidationService.validateHotWalletNeedsRefill(
        '0x123',
        1.0,
        mockProvider,
        createMockAsset()
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_WALLET_TYPE');
    });

    it('should fail when refill amount is zero', async () => {
      databaseService.getWalletByAddress.mockResolvedValue(createMockWallet());

      const result = await refillValidationService.validateHotWalletNeedsRefill(
        '0x123',
        0,
        mockProvider,
        createMockAsset()
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_AMOUNT');
    });

    it('should fail when refill amount is negative', async () => {
      databaseService.getWalletByAddress.mockResolvedValue(createMockWallet());

      const result = await refillValidationService.validateHotWalletNeedsRefill(
        '0x123',
        -1.0,
        mockProvider,
        createMockAsset()
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_AMOUNT');
    });

    it('should fail when hot wallet already has sufficient balance', async () => {
      const asset = createMockAsset({
        refillTargetBalanceAtomic: '100000000' // 1 BTC target
      });
      databaseService.getWalletByAddress.mockResolvedValue(createMockWallet());
      mockProvider.getTokenBalance.mockResolvedValue('150000000'); // 1.5 BTC - above target

      const result = await refillValidationService.validateHotWalletNeedsRefill(
        '0x123',
        1.0,
        mockProvider,
        asset
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('SUFFICIENT_BALANCE');
    });

    it('should fail when balance is above trigger threshold', async () => {
      const asset = createMockAsset({
        refillTargetBalanceAtomic: '100000000', // 1 BTC target
        refillTriggerThresholdAtomic: '50000000' // 0.5 BTC trigger
      });
      databaseService.getWalletByAddress.mockResolvedValue(createMockWallet());
      mockProvider.getTokenBalance.mockResolvedValue('60000000'); // 0.6 BTC - above trigger

      const result = await refillValidationService.validateHotWalletNeedsRefill(
        '0x123',
        1.0,
        mockProvider,
        asset
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('ABOVE_TRIGGER_THRESHOLD');
    });
  });

  describe('validateNoPendingRefill', () => {
    it('should pass when no pending refill exists for asset', async () => {
      databaseService.getPendingTransactionByAssetId.mockResolvedValue(null);

      const result = await refillValidationService.validateNoPendingRefill(1);

      expect(result.success).toBe(true);
      expect(databaseService.getPendingTransactionByAssetId).toHaveBeenCalledWith(1);
    });

    it('should fail when asset has pending refill', async () => {
      const pendingTx = {
        refillRequestId: 'REQ_PENDING',
        status: 'PENDING',
        providerTxId: 'fb-123',
        createdAt: '2025-10-31T10:00:00Z'
      };

      databaseService.getPendingTransactionByAssetId.mockResolvedValue(pendingTx);

      const result = await refillValidationService.validateNoPendingRefill(1);

      expect(result.success).toBe(false);
      expect(result.code).toBe('REFILL_IN_PROGRESS');
      expect(result.data.existingRefillRequestId).toBe('REQ_PENDING');
      expect(result.data.existingStatus).toBe('PENDING');
    });

    it('should fail when asset has processing refill', async () => {
      const processingTx = {
        refillRequestId: 'REQ_PROCESSING',
        status: 'PROCESSING',
        providerTxId: 'fb-456',
        createdAt: '2025-10-31T10:30:00Z'
      };

      databaseService.getPendingTransactionByAssetId.mockResolvedValue(processingTx);

      const result = await refillValidationService.validateNoPendingRefill(1);

      expect(result.success).toBe(false);
      expect(result.code).toBe('REFILL_IN_PROGRESS');
      expect(result.data.existingStatus).toBe('PROCESSING');
    });

    it('should handle database errors gracefully', async () => {
      databaseService.getPendingTransactionByAssetId.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await refillValidationService.validateNoPendingRefill(1);

      expect(result.success).toBe(false);
      expect(result.code).toBe('PENDING_REFILL_CHECK_ERROR');
      expect(result.data.details).toContain('Database connection failed');
    });
  });
});

