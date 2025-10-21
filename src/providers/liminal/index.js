const AbstractProvider = require('../abstractProvider');
const WalletFactory = require('./walletFactory');
const BigNumber = require('bignumber.js');
const logger = require('../../middleware/logger')('liminal');

/**
 * Liminal Provider Implementation
 * Implements the AbstractProvider interface for Liminal API integration
 */
class LiminalProvider extends AbstractProvider {
  constructor(config, secret) {
    super(config, secret);
    this.walletFactory = new WalletFactory(config.env, config.walletId);
    this.supportedBlockchains = config.supportedBlockchains || [1, 137, 56, 43114]; // Ethereum, Polygon, BSC, Avalanche
    this.supportedAssets = config.supportedAssets || ['ETH', 'USDC', 'USDT', 'MATIC', 'BNB', 'AVAX'];
  }

  static getProviderName() {
    return 'liminal';
  }

  static getConfigSchema() {
    return {
      type: 'object',
      properties: {
        baseURL: {
          type: 'string',
          default: 'https://api.lmnl.app'
        },
        timeout: {
          type: 'number',
          default: 30000
        },
        supportedBlockchains: {
          type: 'array',
          items: { type: 'number' },
          default: [1, 137, 56, 43114]
        },
        supportedAssets: {
          type: 'array',
          items: { type: 'string' },
          default: ['ETH', 'USDC', 'USDT', 'MATIC', 'BNB', 'AVAX']
        }
      },
            required: ['clientId', 'clientSecret', 'AuthAudience']
    };
  }

  async init() {
    try {
      if (!this.secret.clientId || !this.secret.clientSecret || !this.secret.AuthAudience) {
        throw new Error('Liminal API credentials not configured properly');
      }

      // Initialize wallet factory
      await this.walletFactory.init(this.secret);
      
      logger.info('Liminal provider initialized successfully');
      return { success: true };
    } catch (error) {
      logger.error(`Failed to initialize Liminal provider: ${error.message}`);
      throw error;
    }
  }

  supportsBlockchain(blockchainId) {
    return this.supportedBlockchains.includes(blockchainId);
  }

  supportsAsset(assetSymbol, blockchainId) {
    return this.supportedAssets.includes(assetSymbol.toUpperCase()) &&
      this.supportsBlockchain(blockchainId);
  }

  async createTransaction(txns, token) {
    try {
      logger.info(`Creating transaction with Liminal for ${txns.length} transactions`);

      // // Check if provider supports this blockchain and asset
      // if (!this.supportsBlockchain(token.blockchainId)) {
      //   throw new Error(`Liminal does not support blockchain ID: ${token.blockchainId}`);
      // }

      // if (!this.supportsAsset(token.symbol, token.blockchainId)) {
      //   throw new Error(`Liminal does not support asset: ${token.symbol} on blockchain: ${token.blockchainId}`);
      // }

      // Use wallet factory to create transaction
      const result = await this.walletFactory.createTransaction(txns, token);

      logger.info(`Transaction created successfully with Liminal`);
      return result;

    } catch (error) {
      logger.error(`Error creating transaction with Liminal: ${error.message}`);
      throw error;
    }
  }

  async getTransactionStatus(batchId, token) {
    try {
      logger.info(`Getting transaction status from Liminal: ${batchId}`);

      const result = await this.walletFactory.getTransactionStatus(batchId, token);
      return result;

    } catch (error) {
      logger.error(`Error getting transaction status from Liminal: ${error.message}`);
      throw error;
    }
  }

  async getTokenBalance(token) {
    try {
      logger.info(`Getting token balance for: ${token.symbol}`);

      const balance = await this.walletFactory.getTokenBalance(token);
      return balance;

    } catch (error) {
      logger.error(`Error getting token balance from Liminal: ${error.message}`);
      throw error;
    }
  }

  async sendTransaction(txn, token) {
    try {
      logger.info(`Sending transaction with Liminal`);

      const result = await this.walletFactory.sendTransaction(txn, token);
      return result;

    } catch (error) {
      logger.error(`Error sending transaction with Liminal: ${error.message}`);
      throw error;
    }
  }

  async validateCredentials() {
    try {
      logger.info('Validating Liminal API credentials');

      const result = await this.walletFactory.validateCredentials();
      return result;

    } catch (error) {
      logger.error(`Error validating Liminal credentials: ${error.message}`);
      return {
        success: false,
        error: 'Failed to validate credentials',
        code: 'CREDENTIAL_VALIDATION_ERROR',
        details: error.message
      };
    }
  }
}

module.exports = LiminalProvider;
