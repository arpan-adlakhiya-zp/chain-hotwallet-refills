const logger = require('../middleware/logger')('providerService');
const databaseService = require('./chainDb');
const LiminalProvider = require('../providers/liminal');
const FireblocksProvider = require('../providers/fireblocks');
const config = require('../config');
const refillUtils = require('./utils/utils');

class ProviderService {
  constructor() {
    this.initialized = false;
    this.providers = new Map();
  }

  /**
   * Initialize the provider service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.initializeProviders(this.providers);
      this.initialized = true;
      logger.info('Provider service initialized with providers');
    } catch (error) {
      logger.error(`Failed to initialize provider service: ${error.message}`);
      throw error;
    }
  }

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
          const liminalEnv = refillUtils.getLiminalConfig();
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
          const fireblocksApiUrl = refillUtils.getFireblocksConfig();
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
   * Get the providers map
   * @returns {Map} Map of initialized providers
   */
  getProviders() {
    return this.providers;
  }

  /**
   * Get a specific provider by name
   * @param {string} providerName - Name of the provider
   * @returns {Object|null} Provider instance or null
   */
  getProvider(providerName) {
    return this.providers.get(providerName.toLowerCase());
  }

  /**
   * Get token provider for a specific blockchain and asset
   * @param {string} chainName - Blockchain name
   * @param {string} assetSymbol - Asset symbol
   * @returns {Object|null} Provider instance or null
   */
  async getTokenProvider(chainName, assetSymbol) {
    try {
      // Ensure providers are initialized
      await this.initialize();

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
}

module.exports = new ProviderService();
