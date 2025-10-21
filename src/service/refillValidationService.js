const BigNumber = require('bignumber.js');
const logger = require('../middleware/logger')('refillValidationService');
const databaseService = require('./chainDb');

/**
 * Refill Validation Service
 * Simplified validation service that focuses on essential checks only
 */
class RefillValidationService {
  constructor() {
    this.logger = logger;
  }

  /**
   * Main validation method - simplified and streamlined
   */
  async validateRefillRequest(refillData) {
    try {
      logger.info(`Validating refill request for wallet: ${refillData.wallet_address}`);

      // Step 1: Validate required fields
      const fieldValidation = this.validateRequiredFields(refillData);
      if (!fieldValidation.isValid) {
        return {
          isValid: false,
          error: `Missing required fields: ${fieldValidation.missingFields.join(', ')}`,
          code: 'MISSING_FIELDS'
        };
      }

      // Step 2: Get blockchain details
      const blockchain = await databaseService.getBlockchainByName(refillData.chain_name);
      if (!blockchain) {
        return {
          isValid: false,
          error: 'Blockchain not found',
          code: 'BLOCKCHAIN_NOT_FOUND'
        };
      }

      // Step 3: Validate asset exists and is active
      const assetValidation = await this.validateAsset(refillData.asset_symbol, blockchain.id);
      if (!assetValidation.isValid) {
        return assetValidation;
      }

      // Step 4: Determine the correct hot wallet address based on token type
      const hotWalletAddress = await this.determineHotWalletAddress(refillData, assetValidation.asset);

      // Step 5: Validate refill_sweep_wallet matches the asset's configured sweep wallet
      const sweepWalletValidation = await this.validateRefillSweepWallet(
        refillData.refill_sweep_wallet,
        assetValidation.asset
      );
      if (!sweepWalletValidation.isValid) {
        return sweepWalletValidation;
      }

      // Step 6: Get provider instance (passed from refillService)
      const provider = refillData.provider;
      if (!provider) {
        return {
          isValid: false,
          error: 'Provider instance not available for balance validation',
          code: 'PROVIDER_NOT_AVAILABLE'
        };
      }

      // Step 7: Check if cold wallet has sufficient balance (real-time)
      const balanceValidation = await this.validateColdWalletBalance(
        assetValidation.asset.id,
        blockchain.id,
        refillData.refill_amount,
        provider
      );
      if (!balanceValidation.isValid) {
        return balanceValidation;
      }

      // Step 8: Check if hot wallet needs refill (includes amount validation and real-time balance check)
      const hotWalletValidation = await this.validateHotWalletNeedsRefill(
        hotWalletAddress,
        assetValidation.asset.id,
        refillData.refill_amount,
        provider,
        assetValidation.asset
      );
      if (!hotWalletValidation.isValid) {
        return hotWalletValidation;
      }

      logger.info(`Refill request validation successful for wallet: ${refillData.wallet_address}`);

      return {
        isValid: true,
        data: {
          wallet: hotWalletValidation.wallet,
          asset: assetValidation.asset,
          blockchain: blockchain,
          coldWallet: balanceValidation.coldWallet,
          refillAmountAtomic: hotWalletValidation.refillAmountAtomic
        }
      };

    } catch (error) {
      logger.error(`Error validating refill request: ${error.message}`);
      return {
        isValid: false,
        error: 'Internal validation error',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Validate required fields are present
   */
  validateRequiredFields(refillData) {
    const requiredFields = [
      'wallet_address',
      'asset_symbol',
      'asset_address',
      'chain_name',
      'refill_amount',
      'refill_sweep_wallet'
    ];

    const missingFields = requiredFields.filter(field => !refillData[field]);

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Determine the correct hot wallet address based on token type
   */
  async determineHotWalletAddress(refillData, asset) {
    // - For native tokens: use the wallet_address from refillData
    // - For contract tokens: use the wallet_id associated with the asset in the assets table
    if (refillData.asset_address === "native") {
      return refillData.wallet_address;
    } else {
      // For contract tokens, get the hot wallet address from the asset's wallet_id
      if (asset && asset.Wallet && asset.Wallet.address) {
        return asset.Wallet.address;
      } else {
        throw new Error('Contract token asset must have an associated wallet');
      }
    }
  }

  /**
   * Validate asset exists and is active
   */
  async validateAsset(assetSymbol, blockchainId) {
    try {
      const asset = await databaseService.getAssetBySymbolAndBlockchain(assetSymbol, blockchainId);

      if (!asset) {
        return {
          isValid: false,
          error: 'Asset not found or inactive',
          code: 'ASSET_NOT_FOUND'
        };
      }

      return {
        isValid: true,
        asset
      };
    } catch (error) {
      logger.error(`Error validating asset: ${error.message}`);
      return {
        isValid: false,
        error: 'Database error while validating asset',
        code: 'ASSET_VALIDATION_ERROR'
      };
    }
  }

  /**
   * Validate refill_sweep_wallet matches the asset's configured sweep wallet
   */
  async validateRefillSweepWallet(refillSweepWallet, asset) {
    try {
      if (!asset.refill_sweep_wallet) {
        return {
          isValid: false,
          error: 'No sweep wallet configured for this asset',
          code: 'NO_SWEEP_WALLET_CONFIGURED'
        };
      }

      if (refillSweepWallet !== asset.refill_sweep_wallet) {
        return {
          isValid: false,
          error: `Refill sweep wallet mismatch. Expected: ${asset.refill_sweep_wallet}, Got: ${refillSweepWallet}`,
          code: 'SWEEP_WALLET_MISMATCH'
        };
      }

      return {
        isValid: true
      };
    } catch (error) {
      logger.error(`Error validating refill sweep wallet: ${error.message}`);
      return {
        isValid: false,
        error: 'Error validating refill sweep wallet',
        code: 'SWEEP_WALLET_VALIDATION_ERROR'
      };
    }
  }

  /**
   * Validate cold wallet has sufficient balance (real-time)
   */
  async validateColdWalletBalance(assetId, blockchainId, refillAmount, provider) {
    try {
      const coldWallet = await databaseService.getColdWalletForAsset(assetId, blockchainId);

      if (!coldWallet) {
        return {
          isValid: false,
          error: 'No cold wallet found for this asset',
          code: 'COLD_WALLET_NOT_FOUND'
        };
      }

      // Get real-time balance from on-chain using the provider SDK
      const tokenInfo = {
        symbol: coldWallet.asset_symbol,
        contractAddress: coldWallet.asset_address === 'native' ? null : coldWallet.asset_address,
        decimalPlaces: coldWallet.asset_decimals || 18,
        hotWalletConfig: {
          liminalHotWalletId: coldWallet.wallet_id
        }
      };

      const onChainBalance = await provider.getTokenBalance(tokenInfo);
      const availableBalance = new BigNumber(onChainBalance);
      
      // Convert refill amount to atomic units for comparison
      const refillAmountBigNumber = new BigNumber(refillAmount);
      const decimals = coldWallet.asset_decimals || 18;
      const requiredAmount = refillAmountBigNumber.multipliedBy(new BigNumber(10).pow(decimals));

      if (availableBalance.lt(requiredAmount)) {
        return {
          isValid: false,
          error: `Insufficient cold wallet balance. Available: ${availableBalance.toString()}, Required: ${requiredAmount.toString()}`,
          code: 'INSUFFICIENT_BALANCE',
          details: {
            availableBalance: availableBalance.toString(),
            requiredAmount: requiredAmount.toString(),
            coldWalletAddress: coldWallet.address,
            checkedAt: new Date().toISOString()
          }
        };
      }

      return {
        isValid: true,
        coldWallet,
        availableBalance: availableBalance.toString()
      };
    } catch (error) {
      logger.error(`Error validating cold wallet balance: ${error.message}`);
      return {
        isValid: false,
        error: 'Error fetching cold wallet balance from blockchain',
        code: 'BALANCE_VALIDATION_ERROR'
      };
    }
  }

  /**
   * Validate hot wallet needs refill (includes amount validation and real-time balance check)
   */
  async validateHotWalletNeedsRefill(walletAddress, assetId, refillAmount, provider, asset) {
    try {
      // Get wallet details to validate it exists and get wallet info
      const wallet = await databaseService.getWalletByAddress(walletAddress);
      if (!wallet) {
        return {
          isValid: false,
          error: 'Hot wallet not found',
          code: 'HOT_WALLET_NOT_FOUND'
        };
      }

      // Validate wallet type
      if (wallet.wallet_type !== 'hot') {
        return {
          isValid: false,
          error: 'Wallet is not a hot wallet',
          code: 'INVALID_WALLET_TYPE'
        };
      }

      // Validate refill amount
      const refillAmountBigNumber = new BigNumber(refillAmount);
      if (refillAmountBigNumber.lte(0)) {
        return {
          isValid: false,
          error: 'Refill amount must be positive',
          code: 'INVALID_AMOUNT'
        };
      }

      // Convert refill amount to atomic units
      const decimals = asset.decimals || 18;
      const refillAmountAtomic = refillAmountBigNumber.multipliedBy(new BigNumber(10).pow(decimals));

      // Get real-time balance from on-chain using the provider SDK
      const tokenInfo = {
        symbol: asset.symbol,
        contractAddress: asset.asset_address === 'native' ? null : asset.asset_address,
        decimalPlaces: asset.decimals || 18,
        hotWalletConfig: {
          liminalHotWalletId: wallet.wallet_id
        }
      };

      const onChainBalance = await provider.getTokenBalance(tokenInfo);
      const currentBalance = new BigNumber(onChainBalance);
      const targetBalance = new BigNumber(asset.refill_target_balance_atomic || 0);
      const triggerThreshold = new BigNumber(asset.refill_trigger_threshold_atomic || 0);

      // Check if hot wallet already has sufficient balance
      if (currentBalance.gte(targetBalance) && targetBalance.gt(0)) {
        return {
          isValid: false,
          error: 'Hot wallet already has sufficient balance',
          code: 'SUFFICIENT_BALANCE',
          details: {
            current: currentBalance.toString(),
            target: targetBalance.toString(),
            checkedAt: new Date().toISOString()
          }
        };
      }

      // Check if current balance is above trigger threshold
      if (currentBalance.gte(triggerThreshold) && triggerThreshold.gt(0)) {
        return {
          isValid: false,
          error: 'Hot wallet balance is above trigger threshold',
          code: 'ABOVE_TRIGGER_THRESHOLD',
          details: {
            current: currentBalance.toString(),
            threshold: triggerThreshold.toString(),
            checkedAt: new Date().toISOString()
          }
        };
      }

      return {
        isValid: true,
        wallet: wallet,
        currentBalance: currentBalance.toString(),
        targetBalance: targetBalance.toString(),
        triggerThreshold: triggerThreshold.toString(),
        refillAmountAtomic: refillAmountAtomic.toString()
      };
    } catch (error) {
      logger.error(`Error validating hot wallet refill need: ${error.message}`);
      return {
        isValid: false,
        error: 'Error fetching hot wallet balance from blockchain',
        code: 'HOT_WALLET_VALIDATION_ERROR'
      };
    }
  }

  /**
   * Check for recent refill requests to avoid duplicates
   */
  async validateNoRecentRefillRequests(walletAddress, assetId, hoursBack = 24) {
    try {
      const recentRequests = await databaseService.getRecentRefillRequests(walletAddress, assetId, hoursBack);

      // Check for pending or unresolved requests
      const activeRequests = recentRequests.filter(req =>
        ['PENDING', 'PROCESSING', 'IN_PROGRESS'].includes(req.status)
      );

      if (activeRequests.length > 0) {
        return {
          isValid: false,
          error: 'There are already pending refill requests for this wallet and asset',
          code: 'PENDING_REQUESTS_EXIST',
          details: {
            pendingRequests: activeRequests.length,
            lastRequestTime: activeRequests[0].created_at
          }
        };
      }

      return {
        isValid: true
      };
    } catch (error) {
      logger.error(`Error checking recent refill requests: ${error.message}`);
      return {
        isValid: false,
        error: 'Database error while checking recent requests',
        code: 'RECENT_REQUESTS_CHECK_ERROR'
      };
    }
  }
}

module.exports = new RefillValidationService();