const logger = require("../middleware/logger")("refillService");
const refillValidationService = require("./refillValidationService");
const databaseService = require("./chainDb");
const LiminalProvider = require("../providers/liminal");
const FireblocksProvider = require("../providers/fireblocks");
const config = require("../config");
const tokenProviderConfig = require("../config/tokenProviderConfig");
const BigNumber = require('bignumber.js');

class RefillService {
  constructor() {
    this.initialized = false;
    this.providers = new Map();
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize providers directly
      await this.initializeProviders();

      this.initialized = true;
      logger.info('Refill service initialized with providers');
    } catch (error) {
      logger.error(`Failed to initialize refill service: ${error.message}`);
      throw error;
    }
  }

  async initializeProviders() {
    try {
      logger.info('Initializing providers...');
      
      // Initialize Liminal provider
      if (!this.providers.has('liminal')) {
        const liminalSecret = config.getSecret('liminal') || {};
        if (liminalSecret.clientId && liminalSecret.clientSecret && liminalSecret.AuthAudience) {
          const liminalEnv = this.getLiminalEnvironmentFromConfig();
          const liminalConfig = { env: liminalEnv };
          const liminalProvider = new LiminalProvider(liminalConfig, liminalSecret);
          await liminalProvider.init();
          this.providers.set('liminal', liminalProvider);
          logger.info(`Liminal provider initialized with environment: ${liminalEnv}`);
        } else {
          logger.error('Liminal credentials not found or incomplete');
        }
      }

      // Initialize Fireblocks provider
      if (!this.providers.has('fireblocks')) {
        const fireblocksSecret = config.getSecret('fireblocks') || {};
        if (fireblocksSecret.apiKey && fireblocksSecret.privateKey) {
          const fireblocksApiUrl = this.getFireblocksApiUrlFromConfig();
          const fireblocksConfig = { apiBaseUrl: fireblocksApiUrl };
          const fireblocksProvider = new FireblocksProvider(fireblocksConfig, fireblocksSecret);
          await fireblocksProvider.init();
          this.providers.set('fireblocks', fireblocksProvider);
          logger.info(`Fireblocks provider initialized with API URL: ${fireblocksApiUrl}`);
        } else {
          logger.error('Fireblocks credentials not found or incomplete');
        }
      }

      logger.info('Provider initialization completed');
    } catch (error) {
      logger.error(`Failed to initialize providers: ${error.message}`);
      throw error;
    }
  }

  async processRefillRequestService(refillData) {
    try {
      // Ensure service is initialized
      await this.initialize();

      logger.info(`Processing refill request for wallet: ${refillData.wallet_address}`);

      // Step 1: Get the provider for this token first (needed for balance validation)
      const provider = await this.getTokenProvider(
        refillData.chain_name,
        refillData.asset_symbol
      );

      if (!provider) {
        logger.error(`No provider available for blockchain ${refillData.chain_name} and asset ${refillData.asset_symbol}`);
        return {
          success: false,
          error: 'No provider available for this blockchain and asset combination',
          code: 'NO_PROVIDER_AVAILABLE',
          details: {
            chainName: refillData.chain_name,
            assetSymbol: refillData.asset_symbol,
            availableProviders: Array.from(this.providers.keys())
          }
        };
      }

      // Step 2: Validate the refill request (including real-time balance checks)
      refillData.provider = provider; // Pass provider to validation
      const validationResult = await refillValidationService.validateRefillRequest(refillData);
      if (!validationResult.isValid) {
        logger.error(`Refill request validation failed: ${validationResult.error}`);
        return {
          success: false,
          error: validationResult.error,
          code: validationResult.code,
          details: validationResult.details
        };
      }

      const validatedData = validationResult.data;
      logger.info(`Refill request validated successfully for wallet: ${refillData.wallet_address}`);

      logger.info(`Selected provider: ${provider.constructor.getProviderName()}`);

      // Step 3: Initiate transaction with selected provider
      const transactionResult = await this.initiateRefill(validatedData, provider);

      if (!transactionResult.success) {
        return {
          success: false,
          error: transactionResult.error,
          code: transactionResult.code,
          provider: provider.constructor.getProviderName(),
          details: transactionResult.details
        };
      }

      logger.info(`Refill request initiated successfully. Transaction ID: ${transactionResult.transactionId}, Provider: ${provider.constructor.getProviderName()}`);

      return {
        success: true,
        message: 'Refill request processed successfully',
        data: {
          transactionId: transactionResult.transactionId,
          walletAddress: refillData.wallet_address,
          assetSymbol: refillData.asset_symbol,
          refillAmount: refillData.refill_amount,
          status: 'initiated',
          provider: provider.constructor.getProviderName()
        }
      };

    } catch (error) {
      logger.error(`Error processing refill request: ${error.message}`);
      return {
        success: false,
        error: 'Internal server error while processing refill request',
        code: 'PROCESSING_ERROR',
        details: error.message
      };
    }
  }

  async initiateRefill(validatedData, provider) {
    try {
      logger.info(`Initiating refill transfer request with provider: ${provider.constructor.getProviderName()}`);

      // For Liminal, create a transfer request (triggers multi-sig approval process)
      if (provider.constructor.getProviderName() === 'liminal') {
        const transferData = {
          coldWalletId: validatedData.asset.sweepWalletConfig.liminal.walletId,
          hotWalletAddress: validatedData.wallet.address,
          amount: validatedData.refillAmountAtomic,
          asset: validatedData.asset.symbol,
          blockchain: validatedData.blockchain.symbol,
          contractAddress: validatedData.asset.contractAddress
        };

        const transferRequest = await provider.createTransferRequest(transferData);

        logger.info(`Transfer request created successfully with ${provider.constructor.getProviderName()}`);

        return {
          success: true,
          transferId: transferRequest.id || transferRequest.transferId,
          status: 'pending_approval',
          message: 'Refill transfer request created - awaiting multi-sig approval',
          transferRequest: transferRequest
        };
      } else if (provider.constructor.getProviderName() === 'fireblocks') {
        // For Fireblocks, create a cold to hot wallet refill transfer
        const transferData = {
          coldWalletVaultId: validatedData.asset.sweepWalletConfig.fireblocks.vaultId,
          hotWalletAddress: validatedData.wallet.address,
          amount: validatedData.refillAmountAtomic,
          asset: validatedData.asset.symbol,
          blockchain: validatedData.blockchain.symbol,
          contractAddress: validatedData.asset.contractAddress
        };

        const transferRequest = await provider.createColdToHotRefill(transferData);

        logger.info(`Cold to hot wallet refill created successfully with ${provider.constructor.getProviderName()}`);

        return {
          success: true,
          transactionId: transferRequest.transactionId,
          status: 'submitted',
          message: 'Cold to hot wallet refill transaction submitted to Fireblocks',
          transferRequest: transferRequest
        };
      } else {
        // For other providers (like Fireblocks), use the original transaction flow
        const txns = [{
          sendAddress: validatedData.wallet.address,
          amount: validatedData.refillAmountAtomic,
        }];

        const token = {
          symbol: validatedData.asset.symbol,
          blockchainId: validatedData.blockchain.id,
          blockchainSymbol: validatedData.blockchain.symbol,
          decimalPlaces: validatedData.asset.decimals,
          contractAddress: validatedData.asset.contractAddress,
          walletConfig: {
            liminal: {
              walletId: validatedData.wallet.hotWalletConfig.liminal.walletId
            },
            fireblocks: {}
          },
          sweepWalletConfig: validatedData.asset.sweepWalletConfig
        };

        const providerResult = await provider.createSignAndSubmit(txns, token);

        logger.info(`Transaction completed successfully with ${provider.constructor.getProviderName()}`);

        return {
          success: true,
          transactionHash: providerResult.submitResult?.txHash || providerResult.submitResult?.hash || null,
          providerTransactionId: providerResult.transactionId || providerResult.batchId || null,
          batchId: providerResult.batchId,
          createResult: providerResult.createResult,
          signResult: providerResult.signResult,
          submitResult: providerResult.submitResult
        };
      }

    } catch (error) {
      logger.error(`Error initiating refill: ${error.message}`);
      return {
        success: false,
        error: `Failed to initiate refill with ${provider.constructor.getProviderName()}`,
        code: 'REFILL_INITIATION_ERROR',
        details: error.message
      };
    }
  }

  async getRefillStatus(refillRequestId, provider, token) {
    try {
      logger.info(`Getting refill status for request ID: ${refillRequestId}`);

      // For Liminal, check transfer status
      if (provider.constructor.getProviderName() === 'liminal') {
        const transferStatus = await provider.getTransferStatus(refillRequestId, token);
        
        return {
          success: true,
          refillRequestId,
          status: transferStatus.status || 'pending',
          message: `Transfer status: ${transferStatus.status}`,
          transferStatus: transferStatus
        };
      } else if (provider.constructor.getProviderName() === 'fireblocks') {
        // For Fireblocks, check transaction status
        const transactionStatus = await provider.getTransactionStatus(refillRequestId, token);
        
        return {
          success: true,
          refillRequestId,
          status: transactionStatus.status || 'pending',
          message: `Fireblocks transaction status: ${transactionStatus.status}`,
          transactionStatus: transactionStatus,
          fireblocksTransactionId: transactionStatus.id,
          externalTxId: transactionStatus.externalTxId
        };
      } else {
        // For other providers, check transaction status
        const transactionStatus = await provider.getTransactionStatus(refillRequestId, token);
        
        return {
          success: true,
          refillRequestId,
          status: transactionStatus.status || 'pending',
          message: `Transaction status: ${transactionStatus.status}`,
          transactionStatus: transactionStatus
        };
      }
    } catch (error) {
      logger.error(`Error getting refill status: ${error.message}`);
      return {
        success: false,
        error: 'Failed to get refill status',
        code: 'STATUS_CHECK_ERROR',
        details: error.message
      };
    }
  }

  async getTokenProvider(chainName, assetSymbol) {
    try {
      // Get blockchain details from database
      const blockchain = await databaseService.getBlockchainByName(chainName);
      if (!blockchain) {
        logger.error(`Blockchain not found for chain name: ${chainName}`);
        return null;
      }

      // Get asset details from database to get the provider from sweepWalletConfig
      const asset = await databaseService.getAssetBySymbolAndBlockchain(assetSymbol.toUpperCase(), blockchain.id);
      if (!asset) {
        logger.error(`Asset not found for symbol: ${assetSymbol} on blockchain: ${chainName}`);
        return null;
      }

      // Get the provider from the asset's sweepWalletConfig
      const providerName = asset.sweepWalletConfig?.provider;
      if (!providerName) {
        logger.error(`No provider configured in sweepWalletConfig for asset: ${assetSymbol} on blockchain: ${chainName}`);
        return null;
      }

      // Get the provider instance
      const provider = this.providers.get(providerName);
      if (!provider) {
        logger.error(`Provider ${providerName} not initialized for blockchain ${chainName}, asset ${assetSymbol}`);
        return null;
      }

      logger.info(`Using provider ${providerName} for blockchain ${chainName}, asset ${assetSymbol}`);
      return provider;
    } catch (error) {
      logger.error(`Error getting token provider: ${error.message}`);
      return null;
    }
  }

  /**
   * Get Liminal environment from config
   * @returns {string} Environment (dev/prod) or 'dev' as default
   */
  getLiminalEnvironmentFromConfig() {
    try {
      const liminalConfig = config.get('providers.liminal');
      if (liminalConfig && liminalConfig.env) {
        logger.info(`Found Liminal environment from providers config: ${liminalConfig.env}`);
        return liminalConfig.env;
      }
      
      logger.warn('No Liminal environment found in config, using default: dev');
      return 'dev';
    } catch (error) {
      logger.error(`Error getting Liminal environment from config: ${error.message}`);
      return 'dev';
    }
  }

  /**
   * Get Fireblocks API URL from config
   * @returns {string} API URL or default Fireblocks URL
   */
  getFireblocksApiUrlFromConfig() {
    try {
      const fireblocksConfig = config.get('providers.fireblocks');
      if (fireblocksConfig && fireblocksConfig.apiBaseUrl) {
        logger.info(`Found Fireblocks API URL from providers config: ${fireblocksConfig.apiBaseUrl}`);
        return fireblocksConfig.apiBaseUrl;
      }
      
      logger.warn('No Fireblocks API URL found in config, using default: https://api.fireblocks.io');
      return 'https://api.fireblocks.io';
    } catch (error) {
      logger.error(`Error getting Fireblocks API URL from config: ${error.message}`);
      return 'https://api.fireblocks.io';
    }
  }

}

// Export the class for better flexibility
module.exports = new RefillService();
