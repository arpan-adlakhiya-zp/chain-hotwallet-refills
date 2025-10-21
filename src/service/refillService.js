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
      // Get all blockchain configurations to find which providers are needed
      const supportedBlockchains = tokenProviderConfig.getSupportedBlockchains();
      const activeProviders = new Set();
      
      // Collect all unique providers that are actually used
      for (const blockchainName of supportedBlockchains) {
        const providerName = tokenProviderConfig.getActiveProvider(blockchainName);
        if (providerName) {
          activeProviders.add(providerName);
        }
      }

      // Initialize each provider only once
      for (const providerName of activeProviders) {
        if (providerName === 'liminal' && !this.providers.has('liminal')) {
          const liminalSecret = config.getSecret('liminal') || {};
          if (liminalSecret.clientId && liminalSecret.clientSecret && liminalSecret.AuthAudience) {
            // Extract environment from any blockchain config that uses Liminal
            const liminalEnv = this.getLiminalEnvironmentFromConfig();
            const liminalConfig = { env: liminalEnv };
            const liminalProvider = new LiminalProvider(liminalConfig, liminalSecret);
            await liminalProvider.init();
            this.providers.set('liminal', liminalProvider);
            logger.info(`Liminal provider initialized with environment: ${liminalEnv}`);
          } else {
            logger.warn('Liminal credentials not found or incomplete');
          }
        }

        if (providerName === 'fireblocks' && !this.providers.has('fireblocks')) {
          const fireblocksSecret = config.getSecret('fireblocks') || {};
          if (fireblocksSecret.apiKey && fireblocksSecret.privateKey) {
            // Extract API base URL from any blockchain config that uses Fireblocks
            const fireblocksApiUrl = this.getFireblocksApiUrlFromConfig();
            const fireblocksConfig = { apiBaseUrl: fireblocksApiUrl };
            const fireblocksProvider = new FireblocksProvider(fireblocksConfig, fireblocksSecret);
            await fireblocksProvider.init();
            this.providers.set('fireblocks', fireblocksProvider);
            logger.info(`Fireblocks provider initialized with API URL: ${fireblocksApiUrl}`);
          } else {
            logger.warn('Fireblocks credentials not found or incomplete');
          }
        }
      }
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
        logger.warn(`Refill request validation failed: ${validationResult.error}`);
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

      // Step 3: Create refill request record in database
      const refillRequestData = {
        walletId: validatedData.wallet.id,
        assetId: validatedData.asset.id,
        requestAmountAtomic: validatedData.refillAmountAtomic,
        requestAmountUsdEquivalent: null,
        requestStatus: 'pending',
        provider: provider.constructor.getProviderName(),
        createdBy: 'refill-service'
      };

      // Step 4: Initiate transaction with selected provider
      const transactionResult = await this.initiateRefill(validatedData, refillRequest.id, provider);

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
      logger.info(`Initiating refill transaction with provider: ${provider.constructor.getProviderName()}`);

      // Prepare transaction data for the provider (following infra pattern)
      const txns = [{
        sendAddress: validatedData.wallet.address,
        amount: validatedData.refillAmountAtomic,
      }];

      // Get token provider configuration using blockchain symbol from DB
      const tokenConfig = tokenProviderConfig.getTokenProviderConfig(
        validatedData.blockchain.symbol,
        validatedData.asset.symbol
      );

      if (!tokenConfig) {
        throw new Error(`No provider configuration found for ${validatedData.asset.symbol} on blockchain ${refillData.chain_name}`);
      }

      // Prepare token object for the provider
      const token = {
        symbol: validatedData.asset.symbol,
        blockchainId: validatedData.blockchain.id,
        decimalPlaces: validatedData.asset.decimals,
        contractAddress: validatedData.asset.contract_address,
        nativeCoin: validatedData.blockchain.native_asset_symbol,
        hotWalletConfig: {
          liminalHotWalletId: tokenConfig.walletId || validatedData.wallet.wallet_id,
          fireblocksConfig: {
            vaultId: tokenConfig.vaultId || 'default_vault',
            assetId: validatedData.asset.symbol
          }
        }
      };

      // Initiate transaction with the selected provider
      const providerResult = await provider.createTransaction(txns, token);

      logger.info(`Transaction initiated successfully with ${provider.constructor.getProviderName()}`);

      return {
        success: true,
        transactionHash: providerResult.rawTx?.txHash || providerResult.rawTx?.hash || null,
        providerTransactionId: providerResult.txId || providerResult.rawTx?.sequenceId || providerResult.rawTx?.id || null
      };

    } catch (error) {
      logger.error(`Error initiating refill transaction: ${error.message}`);
      return {
        success: false,
        error: `Failed to initiate transaction with ${provider.constructor.getProviderName()}`,
        code: 'TRANSACTION_INITIATION_ERROR',
        details: error.message
      };
    }
  }

  async getRefillStatus(refillRequestId) {
    try {
      // This would typically query the database for the current status
      // and potentially check with the provider for the latest transaction status
      logger.info(`Getting refill status for request ID: ${refillRequestId}`);

      // TODO: Implement status checking logic
      return {
        success: true,
        refillRequestId,
        status: 'pending',
        message: 'Status check not yet implemented'
      };
    } catch (error) {
      logger.error(`Error getting refill status: ${error.message}`);
      return {
        success: false,
        error: 'Failed to get refill status',
        code: 'STATUS_CHECK_ERROR'
      };
    }
  }

  async getTokenProvider(chainName, assetSymbol) {
    try {
      // Get blockchain details from database to get the symbol
      const blockchain = await databaseService.getBlockchainByName(chainName);
      if (!blockchain) {
        logger.warn(`Blockchain not found for chain name: ${chainName}`);
        return null;
      }

      // Get the provider for this specific token using the symbol from DB
      const providerName = tokenProviderConfig.getTokenProvider(blockchain.symbol, assetSymbol);
      
      if (!providerName) {
        logger.warn(`No provider configuration found for blockchain ${chainName} (${blockchain.symbol}), asset ${assetSymbol}`);
        return null;
      }

      // Get the provider instance
      const provider = this.providers.get(providerName);
      if (!provider) {
        logger.error(`Provider ${providerName} not initialized for blockchain ${chainName} (${blockchain.symbol}), asset ${assetSymbol}`);
        return null;
      }

      logger.info(`Using provider ${providerName} for blockchain ${chainName} (${blockchain.symbol}), asset ${assetSymbol}`);
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
