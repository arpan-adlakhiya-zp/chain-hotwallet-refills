const logger = require("../../middleware/logger")("refillUtils");
const databaseService = require("../chainDb");
const LiminalProvider = require("../../providers/liminal");
const FireblocksProvider = require("../../providers/fireblocks");
const config = require("../../config");

class RefillUtils {
  /**
   * Initialize providers
   * @param {Map} providers - Providers map to populate
   */
  async initializeProviders(providers) {
    try {
      logger.info('Initializing providers...');
      
      // Initialize Liminal provider
      if (!providers.has('liminal')) {
        const liminalSecret = config.getSecret('liminal') || {};
        if (liminalSecret.clientId && liminalSecret.clientSecret && liminalSecret.AuthAudience) {
          const liminalEnv = this.getLiminalConfig();
          const liminalConfig = { env: liminalEnv };
          const liminalProvider = new LiminalProvider(liminalConfig, liminalSecret);
          await liminalProvider.init();
          providers.set('liminal', liminalProvider);
          logger.info(`Liminal provider initialized with environment: ${liminalEnv}`);
        } else {
          logger.error('Liminal credentials not found or incomplete');
        }
      }

      // Initialize Fireblocks provider
      if (!providers.has('fireblocks')) {
        const fireblocksSecret = config.getSecret('fireblocks') || {};
        if (fireblocksSecret.apiKey && fireblocksSecret.privateKey) {
          const fireblocksApiUrl = this.getFireblocksConfig();
          const fireblocksConfig = { apiBaseUrl: fireblocksApiUrl };
          const fireblocksProvider = new FireblocksProvider(fireblocksConfig, fireblocksSecret);
          await fireblocksProvider.init();
          providers.set('fireblocks', fireblocksProvider);
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

  /**
   * Get token provider for a specific blockchain and asset
   * @param {string} chainName - Blockchain name
   * @param {string} assetSymbol - Asset symbol
   * @param {Map} providers - Providers map
   * @returns {Object|null} Provider instance or null
   */
  async getTokenProvider(chainName, assetSymbol, providers) {
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
      const provider = providers.get(providerName);
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
  getLiminalConfig() {
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
  getFireblocksConfig() {
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

  /**
   * Get cold wallet ID based on provider
   * @param {Object} validatedData - Validated refill data
   * @param {Object} provider - Provider instance
   * @returns {string} Cold wallet ID
   */
  getColdWalletId(validatedData, provider) {
    const providerName = provider.constructor.getProviderName();
    
    if (providerName === 'liminal') {
      return validatedData.asset.sweepWalletConfig.liminal.walletId;
    } else if (providerName === 'fireblocks') {
      return validatedData.asset.sweepWalletConfig.fireblocks.vaultId;
    } else {
      // For other providers, try to get from sweepWalletConfig
      const sweepConfig = validatedData.asset.sweepWalletConfig;
      return sweepConfig[providerName]?.walletId || sweepConfig[providerName]?.vaultId;
    }
  }

  /**
   * Get hot wallet ID based on provider
   * @param {Object} validatedData - Validated refill data
   * @param {Object} provider - Provider instance
   * @returns {string} Hot wallet ID
   */
  getHotWalletId(validatedData, provider) {
    const providerName = provider.constructor.getProviderName();
    
    if (providerName === 'liminal') {
      return validatedData.wallet.address; // Liminal uses wallet address
    } else if (providerName === 'fireblocks') {
      return validatedData.asset.hotWalletConfig.fireblocks.vaultId;
    } else {
      // For other providers, try to get from hotWalletConfig
      const hotWalletConfig = validatedData.asset.hotWalletConfig;
      return hotWalletConfig[providerName]?.vaultId || hotWalletConfig[providerName]?.walletId;
    }
  }

  /**
   * Get wallet configuration object based on provider and wallet configuration
   * @param {string} providerName - Provider name
   * @param {Object} walletConfig - Provider specific wallet configuration
   * @returns {Object}
   *   - success {boolean}: true if the wallet configuration is valid, false otherwise.
   *   - error {string}: the error message if the wallet configuration is not valid.
   *   - code {string}: the error code if the wallet configuration is not valid.
   *   - data {Object}: the wallet configuration object if the wallet configuration is valid.
   */
  getWalletConfig(providerName, walletConfig) {
    if (providerName === 'liminal') {
      if (!walletConfig.liminal || !walletConfig.liminal.walletId) {
        return {
          success: false,
          error: 'No Liminal cold wallet configuration found for this asset',
          code: 'NO_LIMINAL_COLD_WALLET_CONFIGURED',
          data: null
        };
      }
      
      return {
        success: true,
        error: null,
        code: null,
        data: {
          walletConfig: {
            liminal: {
              walletId: walletConfig.liminal.walletId
            }
          }
        }
      };
    } else if (providerName === 'fireblocks') {
      if (!walletConfig.fireblocks || !walletConfig.fireblocks.vaultId || !walletConfig.fireblocks.assetId) {
        return {
          success: false,
          error: 'No Fireblocks cold wallet configuration found for this asset',
          code: 'NO_FIREBLOCKS_COLD_WALLET_CONFIGURED',
          data: null
        };
      }
      
      return {
        success: true,
        error: null,
        code: null,
        data: {
          walletConfig: {
            fireblocks: {
              vaultId: walletConfig.fireblocks.vaultId,
              assetId: walletConfig.fireblocks.assetId
            }
          }
        }
      };
    } else {
      return {
        success: false,
        error: `Unsupported provider: ${providerName}`,
        code: 'UNSUPPORTED_PROVIDER',
        data: null
      };
    }
  }
}

module.exports = new RefillUtils();
