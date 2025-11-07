const refillValidationService = require('../../../service/refillValidationService');
const databaseService = require('../../../service/chainDb');
const providerService = require('../../../service/providerService');
const BigNumber = require('bignumber.js');

jest.mock('../../../service/chainDb');
jest.mock('../../../service/providerService');
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

  describe('validateHotWalletAddress', () => {
    it('should return db wallet address for native tokens when they match', () => {
      const refillData = {
        wallet_address: '0x123abc',
        asset_address: 'native'
      };
      const asset = {
        symbol: 'BTC',
        contractAddress: 'native',
        Wallet: { address: '0x123abc' }
      };

      const result = refillValidationService.validateHotWalletAddress(refillData, asset);
      
      expect(result.success).toBe(true);
      expect(result.data.walletAddress).toBe('0x123abc');
    });

    it('should throw when wallet address does not match DB', () => {
      const refillData = {
        wallet_address: '0xother',
        asset_address: 'native'
      };
      const asset = {
        symbol: 'BTC',
        contractAddress: 'native',
        Wallet: { address: '0x123abc' }
      };

      const result = refillValidationService.validateHotWalletAddress(refillData, asset);
      
      expect(result.success).toBe(false);
      expect(result.code).toBe('HOT_WALLET_ADDRESS_VALIDATION_ERROR');
      expect(result.error).toContain('Error while validating hot wallet address');
      expect(result.data.details).toContain('Hot wallet address mismatch. Expected: 0x123abc, Got: 0xother');
    });

    it('should return asset wallet address for contract tokens when both addresses match', () => {
      const refillData = {
        wallet_address: '0xwalletaddress',
        asset_address: '0xcontract'
      };
      const asset = {
        symbol: 'USDC',
        contractAddress: '0xcontract',
        Wallet: {
          address: '0xwalletaddress'
        }
      };

      const result = refillValidationService.validateHotWalletAddress(refillData, asset);
      
      expect(result.success).toBe(true);
      expect(result.data.walletAddress).toBe('0xwalletaddress');
    });

    it('should throw when contract address does not match DB', () => {
      const refillData = {
        wallet_address: '0xwalletaddress',
        asset_address: '0xwrongcontract'
      };
      const asset = {
        symbol: 'USDC',
        contractAddress: '0xcontract',
        Wallet: {
          address: '0xwalletaddress'
        }
      };

      const result = refillValidationService.validateHotWalletAddress(refillData, asset);
      
      expect(result.success).toBe(false);
      expect(result.code).toBe('HOT_WALLET_ADDRESS_VALIDATION_ERROR');
      expect(result.error).toContain('Error while validating hot wallet address');
      expect(result.data.details).toContain('Contract address mismatch. Expected: 0xcontract, Got: 0xwrongcontract');
    });

    it('should handle case-insensitive contract address comparison', () => {
      const refillData = {
        wallet_address: '0xwalletaddress',
        asset_address: '0xCONTRACT'
      };
      const asset = {
        symbol: 'USDC',
        contractAddress: '0xcontract',
        Wallet: {
          address: '0xwalletaddress'
        }
      };

      const result = refillValidationService.validateHotWalletAddress(refillData, asset);
      
      expect(result.success).toBe(true);
      expect(result.data.walletAddress).toBe('0xwalletaddress');
    });

    it('should throw error when wallet is not configured', () => {
      const refillData = {
        wallet_address: '0xwallet',
        asset_address: '0xcontract'
      };
      const asset = {
        symbol: 'USDC',
        contractAddress: '0xcontract',
        Wallet: null
      };

      const result = refillValidationService.validateHotWalletAddress(refillData, asset);
      
      expect(result.success).toBe(false);
      expect(result.code).toBe('HOT_WALLET_ADDRESS_VALIDATION_ERROR');
      expect(result.error).toContain('Error while validating hot wallet address');
      expect(result.data.details).toContain('Hot wallet not configured for asset: USDC');
    });

    it('should throw error when asset.Wallet is missing', () => {
      const refillData = {
        wallet_address: '0xwallet',
        asset_address: '0xcontract'
      };
      const asset = {
        symbol: 'USDC',
        contractAddress: '0xcontract'
      };

      const result = refillValidationService.validateHotWalletAddress(refillData, asset);
      
      expect(result.success).toBe(false);
      expect(result.code).toBe('HOT_WALLET_ADDRESS_VALIDATION_ERROR');
      expect(result.error).toContain('Error while validating hot wallet address');
      expect(result.data.details).toContain('Hot wallet not configured for asset: USDC');
    });

    it('should throw error when contract address is not configured in DB', () => {
      const refillData = {
        wallet_address: '0xwalletaddress',
        asset_address: '0xcontract'
      };
      const asset = {
        symbol: 'USDC',
        contractAddress: null,
        Wallet: {
          address: '0xwalletaddress'
        }
      };

      const result = refillValidationService.validateHotWalletAddress(refillData, asset);
      
      expect(result.success).toBe(false);
      expect(result.code).toBe('HOT_WALLET_ADDRESS_VALIDATION_ERROR');
      expect(result.error).toContain('Error while validating hot wallet address');
      expect(result.data.details).toContain('Contract address not configured for asset: USDC');
    });

    it('should handle case-insensitive wallet address comparison', () => {
      const refillData = {
        wallet_address: '0xWALLETADDRESS',
        asset_address: 'native'
      };
      const asset = {
        symbol: 'ETH',
        contractAddress: 'native',
        Wallet: {
          address: '0xwalletaddress'
        }
      };

      const result = refillValidationService.validateHotWalletAddress(refillData, asset);
      
      expect(result.success).toBe(true);
      expect(result.data.walletAddress).toBe('0xwalletaddress');
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
        0.4,
        mockProvider,
        asset
      );

      expect(result.success).toBe(true);
      expect(result.data.wallet).toEqual(mockWallet);
    });

    it('should fail when refill would overfill the target balance', async () => {
      const asset = createMockAsset({
        refillTargetBalanceAtomic: '100000000', // 1 BTC target
        refillTriggerThresholdAtomic: '50000000' // 0.5 BTC trigger
      });
      const mockWallet = createMockWallet();

      databaseService.getWalletByAddress.mockResolvedValue(mockWallet);
      mockProvider.getTokenBalance.mockResolvedValue('30000000'); // 0.3 BTC - below trigger

      const result = await refillValidationService.validateHotWalletNeedsRefill(
        '0x123',
        1.0, // would cause projected 1.3 BTC > 1.0 BTC target
        mockProvider,
        asset
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('WILL_OVERFILL_TARGET');
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

  describe('validateCooldownPeriod', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should allow refill when no cooldown period configured', async () => {
      const asset = {
        id: 1,
        symbol: 'BTC',
        refillCooldownPeriod: null
      };

      const result = await refillValidationService.validateCooldownPeriod(asset);

      expect(result.success).toBe(true);
      expect(databaseService.getLastSuccessfulRefillByAssetId).not.toHaveBeenCalled();
    });

    it('should allow refill when cooldown period is zero', async () => {
      const asset = {
        id: 1,
        symbol: 'BTC',
        refillCooldownPeriod: 0
      };

      const result = await refillValidationService.validateCooldownPeriod(asset);

      expect(result.success).toBe(true);
    });

    it('should allow refill when no previous successful refill exists', async () => {
      const asset = {
        id: 1,
        symbol: 'BTC',
        refillCooldownPeriod: 7200  // 2 hours
      };

      databaseService.getLastSuccessfulRefillByAssetId.mockResolvedValue(null);

      const result = await refillValidationService.validateCooldownPeriod(asset);

      expect(result.success).toBe(true);
      expect(databaseService.getLastSuccessfulRefillByAssetId).toHaveBeenCalledWith(1);
    });

    it('should deny refill when cooldown period is still active', async () => {
      const asset = {
        id: 1,
        symbol: 'BTC',
        refillCooldownPeriod: 7200  // 2 hours
      };

      // Last refill was 1 hour ago
      const oneHourAgo = new Date(Date.now() - 3600 * 1000);
      const lastRefill = {
        refillRequestId: 'REQ_OLD',
        assetId: 1,
        status: 'COMPLETED',
        updatedAt: oneHourAgo.toISOString()
      };

      databaseService.getLastSuccessfulRefillByAssetId.mockResolvedValue(lastRefill);

      const result = await refillValidationService.validateCooldownPeriod(asset);

      expect(result.success).toBe(false);
      expect(result.code).toBe('COOLDOWN_PERIOD_ACTIVE');
      expect(result.data.remainingCooldownSeconds).toBeGreaterThan(3500);  // ~1 hour remaining
      expect(result.data.remainingCooldownSeconds).toBeLessThan(3700);
      expect(result.data.lastRefillRequestId).toBe('REQ_OLD');
      expect(result.data.cooldownPeriodSeconds).toBe(7200);
    });

    it('should allow refill when cooldown period has passed', async () => {
      const asset = {
        id: 1,
        symbol: 'BTC',
        refillCooldownPeriod: 3600  // 1 hour
      };

      // Last refill was 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 7200 * 1000);
      const lastRefill = {
        refillRequestId: 'REQ_OLD',
        assetId: 1,
        status: 'COMPLETED',
        updatedAt: twoHoursAgo.toISOString()
      };

      databaseService.getLastSuccessfulRefillByAssetId.mockResolvedValue(lastRefill);

      const result = await refillValidationService.validateCooldownPeriod(asset);

      expect(result.success).toBe(true);
      expect(result.data.timeSinceLastRefill).toBeGreaterThan(7100);
      expect(result.data.lastRefillTime).toBeDefined();
    });

    it('should allow refill exactly when cooldown period expires', async () => {
      const asset = {
        id: 1,
        symbol: 'BTC',
        refillCooldownPeriod: 3600  // 1 hour
      };

      // Last refill was exactly 1 hour ago
      const exactlyOneHourAgo = new Date(Date.now() - 3600 * 1000);
      const lastRefill = {
        refillRequestId: 'REQ_OLD',
        assetId: 1,
        status: 'COMPLETED',
        updatedAt: exactlyOneHourAgo.toISOString()
      };

      databaseService.getLastSuccessfulRefillByAssetId.mockResolvedValue(lastRefill);

      const result = await refillValidationService.validateCooldownPeriod(asset);

      expect(result.success).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const asset = {
        id: 1,
        symbol: 'BTC',
        refillCooldownPeriod: 3600
      };

      databaseService.getLastSuccessfulRefillByAssetId.mockRejectedValue(
        new Error('Database error')
      );

      const result = await refillValidationService.validateCooldownPeriod(asset);

      expect(result.success).toBe(false);
      expect(result.code).toBe('COOLDOWN_CHECK_ERROR');
      expect(result.data.details).toContain('Database error');
    });

    it('should provide detailed error message with remaining time', async () => {
      const asset = {
        id: 1,
        symbol: 'BTC',
        refillCooldownPeriod: 1800  // 30 minutes
      };

      // Last refill was 10 minutes ago
      const tenMinutesAgo = new Date(Date.now() - 600 * 1000);
      const lastRefill = {
        refillRequestId: 'REQ_OLD',
        assetId: 1,
        status: 'COMPLETED',
        updatedAt: tenMinutesAgo.toISOString()
      };

      databaseService.getLastSuccessfulRefillByAssetId.mockResolvedValue(lastRefill);

      const result = await refillValidationService.validateCooldownPeriod(asset);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Refill cooldown period active');
      expect(result.error).toContain('seconds before requesting another refill');
      expect(result.data.remainingCooldownSeconds).toBeGreaterThan(1100);  // ~20 minutes remaining
      expect(result.data.remainingCooldownSeconds).toBeLessThan(1300);
    });
  });

  describe('validateRefillRequest', () => {
    const mockRefillData = {
      refill_request_id: 'REQ001',
      wallet_address: '0xhot123',
      asset_symbol: 'BTC',
      asset_address: 'native',
      chain_name: 'Bitcoin',
      refill_amount: '1.0',
      refill_sweep_wallet: '0xcold456'
    };

    const mockBlockchain = {
      id: 1,
      name: 'Bitcoin',
      symbol: 'BTC',
      chainId: '0',
      nativeAssetSymbol: 'BTC'
    };

    const mockAsset = createMockAsset({
      id: 1,
      symbol: 'BTC',
      decimals: 8,
      contractAddress: 'native',
      refillSweepWallet: '0xcold456',
      sweepWalletConfig: { fireblocks: { vaultId: '0', assetId: 'BTC' } },
      hotWalletConfig: { fireblocks: { vaultId: '1' } }
    });

    const mockWallet = createMockWallet({
      id: 1,
      address: '0xhot123',
      walletType: 'hot'
    });

    beforeEach(() => {
      jest.clearAllMocks();
      // Mock all individual validation methods to succeed by default
      jest.spyOn(refillValidationService, 'validateAsset').mockResolvedValue({
        success: true,
        data: { asset: mockAsset }
      });
      jest.spyOn(refillValidationService, 'validateNoPendingRefill').mockResolvedValue({
        success: true
      });
      jest.spyOn(refillValidationService, 'validateCooldownPeriod').mockResolvedValue({
        success: true
      });
      jest.spyOn(refillValidationService, 'validateHotWalletAddress').mockReturnValue({
        success: true,
        data: { walletAddress: '0xhot123' }
      });
      jest.spyOn(refillValidationService, 'validateRefillSweepWallet').mockResolvedValue({
        success: true
      });
      jest.spyOn(refillValidationService, 'validateColdWalletBalance').mockResolvedValue({
        success: true,
        data: {}
      });
      jest.spyOn(refillValidationService, 'validateHotWalletNeedsRefill').mockResolvedValue({
        success: true,
        data: {
          wallet: mockWallet,
          currentBalance: '50000000',
          targetBalance: '100000000',
          triggerThreshold: '50000000',
          refillAmountAtomic: '100000000'
        }
      });
    });

    it('should successfully validate a complete refill request', async () => {
      databaseService.getBlockchainByName.mockResolvedValue(mockBlockchain);
      jest.spyOn(providerService, 'getTokenProvider').mockResolvedValue(mockProvider);

      const result = await refillValidationService.validateRefillRequest(mockRefillData);

      expect(result.success).toBe(true);
      expect(result.data.provider).toBe(mockProvider);
      expect(result.data.details.wallet.id).toBe(1);
      expect(result.data.details.asset.id).toBe(1);
      expect(result.data.details.blockchain.id).toBe(1);
    });

    it('should return error when blockchain not found', async () => {
      databaseService.getBlockchainByName.mockResolvedValue(null);

      const result = await refillValidationService.validateRefillRequest(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('BLOCKCHAIN_NOT_FOUND');
      expect(result.data.chainName).toBe('Bitcoin');
    });

    it('should return error when asset validation fails', async () => {
      databaseService.getBlockchainByName.mockResolvedValue(mockBlockchain);
      refillValidationService.validateAsset.mockResolvedValue({
        success: false,
        code: 'ASSET_NOT_FOUND',
        error: 'Asset not found'
      });

      const result = await refillValidationService.validateRefillRequest(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('ASSET_NOT_FOUND');
    });

    it('should return error when pending refill exists', async () => {
      databaseService.getBlockchainByName.mockResolvedValue(mockBlockchain);
      refillValidationService.validateNoPendingRefill.mockResolvedValue({
        success: false,
        code: 'REFILL_IN_PROGRESS',
        error: 'Refill in progress'
      });

      const result = await refillValidationService.validateRefillRequest(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('REFILL_IN_PROGRESS');
    });

    it('should return error when cooldown period is active', async () => {
      databaseService.getBlockchainByName.mockResolvedValue(mockBlockchain);
      refillValidationService.validateCooldownPeriod.mockResolvedValue({
        success: false,
        code: 'COOLDOWN_PERIOD_ACTIVE',
        error: 'Cooldown active'
      });

      const result = await refillValidationService.validateRefillRequest(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('COOLDOWN_PERIOD_ACTIVE');
    });

    it('should return error when hot wallet address validation fails', async () => {
      databaseService.getBlockchainByName.mockResolvedValue(mockBlockchain);
      refillValidationService.validateHotWalletAddress.mockReturnValue({
        success: false,
        code: 'HOT_WALLET_ADDRESS_VALIDATION_ERROR',
        error: 'Wallet address mismatch'
      });

      const result = await refillValidationService.validateRefillRequest(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('HOT_WALLET_ADDRESS_VALIDATION_ERROR');
    });

    it('should return error when sweep wallet validation fails', async () => {
      databaseService.getBlockchainByName.mockResolvedValue(mockBlockchain);
      refillValidationService.validateRefillSweepWallet.mockResolvedValue({
        success: false,
        code: 'SWEEP_WALLET_MISMATCH',
        error: 'Sweep wallet mismatch'
      });

      const result = await refillValidationService.validateRefillRequest(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('SWEEP_WALLET_MISMATCH');
    });

    it('should return error when provider not available', async () => {
      databaseService.getBlockchainByName.mockResolvedValue(mockBlockchain);
      // Ensure all previous validations pass
      refillValidationService.validateAsset.mockResolvedValue({
        success: true,
        data: { asset: mockAsset }
      });
      refillValidationService.validateNoPendingRefill.mockResolvedValue({ success: true });
      refillValidationService.validateCooldownPeriod.mockResolvedValue({ success: true });
      refillValidationService.validateHotWalletAddress.mockReturnValue({
        success: true,
        data: { walletAddress: '0xhot123' }
      });
      refillValidationService.validateRefillSweepWallet.mockResolvedValue({ success: true });
      
      // Mock providerService.getTokenProvider to return null using spyOn
      jest.spyOn(providerService, 'getTokenProvider').mockResolvedValue(null);
      // Mock getProviders to return a Map so availableProviders can be computed
      jest.spyOn(providerService, 'getProviders').mockReturnValue(new Map([['fireblocks', mockProvider]]));

      const result = await refillValidationService.validateRefillRequest(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('NO_PROVIDER_AVAILABLE');
      expect(result.data.chainName).toBe('Bitcoin');
      expect(result.data.assetSymbol).toBe('BTC');
    });

    it('should return error when cold wallet balance validation fails', async () => {
      databaseService.getBlockchainByName.mockResolvedValue(mockBlockchain);
      jest.spyOn(providerService, 'getTokenProvider').mockResolvedValue(mockProvider);
      refillValidationService.validateColdWalletBalance.mockResolvedValue({
        success: false,
        code: 'INSUFFICIENT_BALANCE',
        error: 'Insufficient balance'
      });

      const result = await refillValidationService.validateRefillRequest(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INSUFFICIENT_BALANCE');
    });

    it('should return error when hot wallet needs refill validation fails', async () => {
      databaseService.getBlockchainByName.mockResolvedValue(mockBlockchain);
      jest.spyOn(providerService, 'getTokenProvider').mockResolvedValue(mockProvider);
      refillValidationService.validateHotWalletNeedsRefill.mockResolvedValue({
        success: false,
        code: 'SUFFICIENT_BALANCE',
        error: 'Hot wallet has sufficient balance'
      });

      const result = await refillValidationService.validateRefillRequest(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('SUFFICIENT_BALANCE');
    });

    it('should handle errors during validation', async () => {
      databaseService.getBlockchainByName.mockRejectedValue(new Error('Database error'));

      const result = await refillValidationService.validateRefillRequest(mockRefillData);

      expect(result.success).toBe(false);
      expect(result.code).toBe('VALIDATION_ERROR');
      expect(result.data.details).toContain('Database error');
    });
  });
});

