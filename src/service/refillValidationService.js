const BigNumber = require('bignumber.js');
const logger = require('../middleware/logger')('refillValidationService');
const databaseService = require('./chainDb');
const refillUtils = require('./utils/utils');

/**
 * Refill Request Validation Service
 */
class RefillValidationService {
  constructor() {
    this.logger = logger;
  }

  /**
   * Validates a hot wallet refill request, checking field presence, asset configuration,
   * blockchain support, sweep wallet configuration, and balance-related rules.
   *
   * @param {Object} refillData - The refill request data.
   * @returns {Object} The validation result object.
   *   - success {boolean}: true if the refill request is valid, false otherwise.
   *   - error {string}: the error message if the refill request is not valid.
   *   - code {string}: the error code if the refill request is not valid.
   *   - data {Object}: the validated data if the refill request is valid.
   */
  async validateRefillRequest(refillData) {
    try {
      logger.info(`Validating refill request for wallet: ${refillData.wallet_address}`);

      // Validate required fields
      const fieldValidation = this.validateRequiredFields(refillData);
      if (!fieldValidation.success) {
        return {
          success: false,
          error: fieldValidation.error,
          code: fieldValidation.code,
          data: fieldValidation.data
        };
      }

      // Validate blockchain exists and is active
      const blockchain = await databaseService.getBlockchainByName(refillData.chain_name.toLowerCase());
      if (!blockchain) {
        return {
          success: false,
          error: 'Blockchain not found',
          code: 'BLOCKCHAIN_NOT_FOUND',
          data: {
            chainName: refillData.chain_name
          }
        };
      }

      // Validate asset exists and is active
      const assetValidation = await this.validateAsset(refillData.asset_symbol.toUpperCase(), blockchain.id);
      if (!assetValidation.success) {
        return assetValidation;
      }

      // Check if asset already has a pending refill (prevent duplicate in-flight refills)
      const pendingRefillCheck = await this.validateNoPendingRefill(assetValidation.data.asset.id);
      if (!pendingRefillCheck.success) {
        return pendingRefillCheck;
      }

  // Validate and determine the correct hot wallet address based on token type
  const hotWalletAddress = this.validateHotWalletAddress(refillData, assetValidation.data.asset);

      // Validate refill_sweep_wallet matches the asset's configured sweep wallet
      const sweepWalletValidation = await this.validateRefillSweepWallet(
        refillData.refill_sweep_wallet,
        assetValidation.data.asset
      );
      if (!sweepWalletValidation.success) {
        return sweepWalletValidation;
      }

      // Get provider instance
      const provider = refillData.provider;
      if (!provider) {
        return {
          success: false,
          error: 'Provider instance not available for balance validation',
          code: 'PROVIDER_NOT_AVAILABLE',
          data: null
        };
      }

      // Validate cold wallet has sufficient balance
      const coldWalletValidation = await this.validateColdWalletBalance(
        assetValidation.data.asset,
        refillData.refill_amount,
        provider
      );
      if (!coldWalletValidation.success) {
        return coldWalletValidation;
      }

      // Check if hot wallet needs refill
      const hotWalletValidation = await this.validateHotWalletNeedsRefill(
        hotWalletAddress,
        refillData.refill_amount,
        provider,
        assetValidation.data.asset
      );
      if (!hotWalletValidation.success) {
        return hotWalletValidation;
      }

      logger.info(`Refill request validation successful for wallet: ${refillData.wallet_address}`);

      return {
        success: true,
        error: null,
        code: null,
        data: {
          wallet: {
            id: hotWalletValidation.data.wallet.id,
            address: hotWalletValidation.data.wallet.address,
            name: hotWalletValidation.data.wallet.name,
            walletType: hotWalletValidation.data.wallet.walletType,
            hotWalletConfig: hotWalletValidation.data.wallet.hotWalletConfig
          },
          asset: {
            id: assetValidation.data.asset.id,
            symbol: assetValidation.data.asset.symbol,
            name: assetValidation.data.asset.name,
            contractAddress: assetValidation.data.asset.contractAddress,
            decimals: assetValidation.data.asset.decimals,
            refillSweepWallet: assetValidation.data.asset.refillSweepWallet,
            sweepWalletConfig: assetValidation.data.asset.sweepWalletConfig,
            hotWalletConfig: assetValidation.data.asset.hotWalletConfig,
            refillTargetBalanceAtomic: assetValidation.data.asset.refillTargetBalanceAtomic,
            refillTriggerThresholdAtomic: assetValidation.data.asset.refillTriggerThresholdAtomic
          },
          blockchain: {
            id: blockchain.id,
            name: blockchain.name,
            symbol: blockchain.symbol,
            chainId: blockchain.chainId,
            nativeAssetSymbol: blockchain.nativeAssetSymbol
          },
          coldWallet: coldWalletValidation.data,
          hotWalletBalance: hotWalletValidation.data.currentBalance,
          hotWalletTargetBalance: hotWalletValidation.data.targetBalance,
          hotWalletTriggerThreshold: hotWalletValidation.data.triggerThreshold,
          refillAmountAtomic: hotWalletValidation.data.refillAmountAtomic
        }
      };
    } catch (error) {
      logger.error(`Error validating refill request: ${error.message}`);
      return {
        success: false,
        error: 'Internal validation error',
        code: 'VALIDATION_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Validate required fields are present in the refill request data.
   * @param {Object} refillData - The refill request data to validate.
   * @returns {Object} The validation result object.
   *   - success {boolean}: true if all required fields are present, false otherwise.
   *   - error {string}: the error message if the required fields are not present.
   *   - code {string}: the error code if the required fields are not present.
   *   - data {Object}: the data if the required fields are present.
   */
  validateRequiredFields(refillData) {
    const requiredFields = [
      'refill_request_id',
      'wallet_address',
      'asset_symbol',
      'asset_address',
      'chain_name',
      'refill_amount',
      'refill_sweep_wallet'
    ];

    const missingFields = requiredFields.filter(field => !refillData[field]);

    return {
      success: missingFields.length === 0,
      error: missingFields.length > 0 ? `Missing required fields: ${missingFields.join(', ')}` : null,
      code: missingFields.length > 0 ? 'MISSING_FIELDS' : null,
      data: {
        missingFields
      }
    };
  }

  /**
   * Validate the hot wallet address and asset address
   * @param {Object} refillData - The refill request data.
   * @param {Object} asset - The asset data.
   * @returns {string} The correct hot wallet address.
   */
  validateHotWalletAddress(refillData, asset) {
    const inputWallet = (refillData.wallet_address || '').toString();
    const inputAssetAddress = (refillData.asset_address || '').toString();
    const dbWallet = asset && asset.Wallet && asset.Wallet.address ? asset.Wallet.address.toString() : null;
    const dbAssetAddress = asset && asset.contractAddress ? asset.contractAddress.toString() : null;

    if (!dbWallet) {
      throw new Error(`Hot wallet not configured for asset: ${asset.symbol}`);
    }

    // Ensure incoming wallet matches DB hot wallet address
    if (inputWallet.toLowerCase() !== dbWallet.toLowerCase()) {
      throw new Error(`Hot wallet address mismatch. Expected: ${dbWallet}, Got: ${inputWallet}`);
    }

    // Verify asset address for contract based token
    if (inputAssetAddress.toLowerCase() !== 'native' || dbAssetAddress.toLowerCase() !== 'native') {
      if (!dbAssetAddress) {
        throw new Error(`Contract address not configured for asset: ${asset.symbol}`);
      }

      // If an input asset address was provided, ensure it matches the DB (case-insensitive)
      if (inputAssetAddress.toLowerCase() !== dbAssetAddress.toLowerCase()) {
        throw new Error(`Contract address mismatch. Expected: ${dbAssetAddress}, Got: ${inputAssetAddress}`);
      }
    }

    return dbWallet;
  }

  /**
   * Check if asset already has a pending or processing refill
   * @param {number} assetId - Asset ID
   * @returns {Object} Validation result
   */
  async validateNoPendingRefill(assetId) {
    try {
      const pendingTx = await databaseService.getPendingTransactionByAssetId(assetId);
      
      if (pendingTx) {
        return {
          success: false,
          error: 'A refill for this asset is already in progress. Please wait for it to complete.',
          code: 'REFILL_IN_PROGRESS',
          data: {
            existingRefillRequestId: pendingTx.refillRequestId,
            existingStatus: pendingTx.status,
            existingProviderTxId: pendingTx.providerTxId,
            createdAt: pendingTx.createdAt
          }
        };
      }
      
      return {
        success: true,
        error: null,
        code: null,
        data: null
      };
    } catch (error) {
      logger.error(`Error checking pending refills: ${error.message}`);
      return {
        success: false,
        error: 'Error checking for pending refills',
        code: 'PENDING_REFILL_CHECK_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Validate asset exists and is active
   * @param {string} assetSymbol - The symbol of the asset to validate.
   * @param {number} blockchainId - The ID of the blockchain to validate the asset on.
   * @returns {Object} The validation result object.
   *   - success {boolean}: true if the asset exists and is active, false otherwise.
   *   - error {string}: the error message if the asset does not exist or is inactive.
   *   - code {string}: the error code if the asset does not exist or is inactive.
   *   - data {Object}: the data if the asset exists and is active.
   */
  async validateAsset(assetSymbol, blockchainId) {
    try {
      const asset = await databaseService.getAssetBySymbolAndBlockchain(assetSymbol, blockchainId);

      if (!asset) {
        return {
          success: false,
          error: 'Asset not found or inactive',
          code: 'ASSET_NOT_FOUND',
          data: {
            assetSymbol,
            blockchainId
          }
        };
      }

      return {
        success: true,
        error: null,
        code: null,
        data: {
          asset
        }
      };
    } catch (error) {
      logger.error(`Error validating asset: ${error.message}`);
      return {
        success: false,
        error: 'Database error while validating asset',
        code: 'ASSET_VALIDATION_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Validate refill_sweep_wallet matches the asset's configured sweep wallet
   * @param {string} refillSweepWallet - The address of the refill sweep wallet to validate.
   * @param {Object} asset - The asset data.
   * @returns {Object} The validation result object.
   *   - success {boolean}: true if the refill sweep wallet matches the asset's configured sweep wallet, false otherwise.
   *   - error {string}: the error message if the refill sweep wallet does not match the asset's configured sweep wallet.
   *   - code {string}: the error code if the refill sweep wallet does not match the asset's configured sweep wallet.
   *   - data {Object}: the data if the refill sweep wallet matches the asset's configured sweep wallet.
   */
  async validateRefillSweepWallet(refillSweepWallet, asset) {
    try {
      if (!asset.refillSweepWallet) {
        return {
          success: false,
          error: 'No sweep wallet configured for this asset',
          code: 'NO_SWEEP_WALLET_CONFIGURED',
          data: {
            assetSymbol: asset.symbol,
            refillSweepWallet
          }
        };
      }

      if (refillSweepWallet !== asset.refillSweepWallet) {
        return {
          success: false,
          error: `Refill sweep wallet mismatch. Expected: ${asset.refillSweepWallet}, Got: ${refillSweepWallet}`,
          code: 'SWEEP_WALLET_MISMATCH',
          data: {
            expected: asset.refillSweepWallet,
            received: refillSweepWallet
          }
        };
      }

      return {
        success: true,
        error: null,
        code: null,
        data: null
      };
    } catch (error) {
      logger.error(`Error validating refill sweep wallet: ${error.message}`);
      return {
        success: false,
        error: 'Error validating refill sweep wallet',
        code: 'SWEEP_WALLET_VALIDATION_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Validate cold wallet has sufficient balance (real-time)
   * @param {Object} asset - The asset data.
   * @param {number} refillAmount - The amount to refill.
   * @param {Object} provider - The provider instance.
   * @returns {Object} The validation result object.
   *   - success {boolean}: true if the cold wallet has sufficient balance, false otherwise.
   *   - error {string}: the error message if the cold wallet does not have sufficient balance.
   *   - code {string}: the error code if the cold wallet does not have sufficient balance.
   *   - data {Object}: the data if the cold wallet has sufficient balance.
   */
  async validateColdWalletBalance(asset, refillAmount, provider) {
    try {
      // Get cold wallet configuration from asset
      const sweepWalletConfig = asset.sweepWalletConfig;

      if (!sweepWalletConfig || !sweepWalletConfig.provider) {
        return {
          success: false,
          error: 'No cold wallet configuration found for this asset',
          code: 'NO_COLD_WALLET_CONFIGURED',
          data: {
            assetSymbol: asset.symbol
          }
        };
      }

      const providerName = sweepWalletConfig.provider;
      let coldWalletId = null;
      let walletConfig = null;

      // Configure token info based on provider using utility function
      const walletConfigResult = refillUtils.getWalletConfig(providerName, sweepWalletConfig);
      if (!walletConfigResult.success) {
        return walletConfigResult;
      }

      walletConfig = walletConfigResult.data.walletConfig;

      // Extract cold wallet ID from the wallet config
      if (providerName === 'liminal') {
        coldWalletId = walletConfig.liminal.walletId;
      } else if (providerName === 'fireblocks') {
        coldWalletId = walletConfig.fireblocks.vaultId;
      }

      const tokenInfo = {
        symbol: asset.symbol,
        blockchainSymbol: asset.Blockchain.symbol,
        contractAddress: asset.contractAddress === 'native' ? null : asset.contractAddress,
        decimalPlaces: asset.decimals,
        walletConfig: walletConfig
      };

      // Get real-time balance from provider
      const onChainBalance = await provider.getTokenBalance(tokenInfo);
      const availableBalance = new BigNumber(onChainBalance);
      const refillAmountBigNumber = new BigNumber(refillAmount);
      const requiredAmount = refillAmountBigNumber.multipliedBy(new BigNumber(10).pow(asset.decimals));

      if (availableBalance.lt(requiredAmount)) {
        return {
          success: false,
          error: `Insufficient cold wallet balance. Available: ${availableBalance.toString()}, Required: ${requiredAmount.toString()}`,
          code: 'INSUFFICIENT_BALANCE',
          data: {
            availableBalance: availableBalance.toString(),
            requiredAmount: requiredAmount.toString(),
            coldWalletId: coldWalletId,
            provider: providerName,
            checkedAt: new Date().toISOString()
          }
        };
      }

      return {
        success: true,
        error: null,
        code: null,
        data: {
          coldWalletId,
          availableBalance: availableBalance.toString(),
          provider: providerName,
          message: 'Cold wallet has sufficient balance'
        }
      };
    } catch (error) {
      logger.error(`Error validating cold wallet balance: ${error.message}`);
      return {
        success: false,
        error: 'Error fetching cold wallet balance from blockchain',
        code: 'BALANCE_VALIDATION_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Validate hot wallet needs refill (includes amount validation and real-time balance check)
   * @param {string} walletAddress - The address of the wallet to validate.
   * @param {number} refillAmount - The amount to refill.
   * @param {Object} provider - The provider instance.
   * @param {Object} asset - The asset data.
   * @returns {Object} The validation result object.
   *   - success {boolean}: true if the hot wallet needs refill, false otherwise.
   *   - error {string}: the error message if the hot wallet does not need refill.
   *   - code {string}: the error code if the hot wallet does not need refill.
   *   - data {Object}: the data if the hot wallet needs refill.
   */
  async validateHotWalletNeedsRefill(walletAddress, refillAmount, provider, asset) {
    try {
      // Get wallet details to validate it exists and get wallet info
      const wallet = await databaseService.getWalletByAddress(walletAddress);
      if (!wallet) {
        return {
          success: false,
          error: 'Hot wallet not found',
          code: 'HOT_WALLET_NOT_FOUND',
          data: {
            walletAddress
          }
        };
      }

      // Validate wallet type
      if (wallet.walletType !== 'hot') {
        return {
          success: false,
          error: 'Wallet is not a hot wallet',
          code: 'INVALID_WALLET_TYPE',
          data: {
            walletAddress,
            walletType: wallet.walletType
          }
        };
      }

      // Validate refill amount
      const refillAmountBigNumber = new BigNumber(refillAmount);
      if (refillAmountBigNumber.lte(0)) {
        return {
          success: false,
          error: 'Refill amount must be positive',
          code: 'INVALID_AMOUNT',
          data: {
            refillAmount
          }
        };
      }

      // Convert refill amount to atomic units
      const decimals = asset.decimals;
      const refillAmountAtomic = refillAmountBigNumber.multipliedBy(new BigNumber(10).pow(decimals));

      // Get real-time balance from on-chain using the provider SDK
      const hotWalletConfig = asset.hotWalletConfig;
      const providerName = hotWalletConfig.provider;

      let walletConfig = null;

      // Configure token info based on provider using utility function
      const walletConfigResult = refillUtils.getWalletConfig(providerName, hotWalletConfig);
      if (!walletConfigResult.success) {
        return walletConfigResult;
      }

      walletConfig = walletConfigResult.data.walletConfig;

      const tokenInfo = {
        symbol: asset.symbol,
        blockchainSymbol: asset.Blockchain.symbol,
        contractAddress: asset.contractAddress === 'native' ? null : asset.contractAddress,
        decimalPlaces: asset.decimals,
        walletConfig: walletConfig
      };

      const onChainBalance = await provider.getTokenBalance(tokenInfo);
      const currentBalance = new BigNumber(onChainBalance);
      const targetBalance = new BigNumber(asset.refillTargetBalanceAtomic || 0);
      const triggerThreshold = new BigNumber(asset.refillTriggerThresholdAtomic || 0);

      // Check if hot wallet already has sufficient balance
      if (currentBalance.gte(targetBalance) && targetBalance.gt(0)) {
        return {
          success: false,
          error: 'Hot wallet already has sufficient balance',
          code: 'SUFFICIENT_BALANCE',
          data: {
            current: currentBalance.toString(),
            target: targetBalance.toString(),
            checkedAt: new Date().toISOString()
          }
        };
      }

      // Check if current balance is above trigger threshold
      if (currentBalance.gte(triggerThreshold) && triggerThreshold.gt(0)) {
        return {
          success: false,
          error: 'Hot wallet balance is above trigger threshold',
          code: 'ABOVE_TRIGGER_THRESHOLD',
          data: {
            current: currentBalance.toString(),
            threshold: triggerThreshold.toString(),
            checkedAt: new Date().toISOString()
          }
        };
      }

      // Check if refill would cause balance to exceed the target
      // (prevent overfilling when currentBalance + refillAmountAtomic > targetBalance)
      if (refillAmountAtomic && targetBalance.gt(0)) {
        const projectedBalance = currentBalance.plus(refillAmountAtomic);
        if (projectedBalance.gt(targetBalance)) {
          return {
            success: false,
            error: 'Refill would overfill hot wallet target balance',
            code: 'WILL_OVERFILL_TARGET',
            data: {
              current: currentBalance.toString(),
              refillAmount: refillAmountAtomic.toString(),
              projected: projectedBalance.toString(),
              target: targetBalance.toString(),
              checkedAt: new Date().toISOString()
            }
          };
        }
      }

      return {
        success: true,
        error: null,
        code: null,
        data: {
          wallet: wallet,
          currentBalance: currentBalance.toString(),
          targetBalance: targetBalance.toString(),
          triggerThreshold: triggerThreshold.toString(),
          refillAmountAtomic: refillAmountAtomic.toString(),
          message: 'Hot wallet needs refill'
        }
      };
    } catch (error) {
      logger.error(`Error validating hot wallet refill need: ${error.message}`);
      return {
        success: false,
        error: 'Error fetching hot wallet balance from blockchain',
        code: 'HOT_WALLET_VALIDATION_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }
}

module.exports = new RefillValidationService();