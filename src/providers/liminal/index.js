const AbstractProvider = require('../abstractProvider');
const WalletFactory = require('./walletFactory');
const Transaction = require('./transaction');
const logger = require('../../middleware/logger')('liminal');

/**
 * Liminal Provider Implementation
 * Implements the AbstractProvider interface for Liminal API integration
 */
class LiminalProvider extends AbstractProvider {
  constructor(config, secret) {
    super(config, secret);
    this.walletFactory = new WalletFactory(config.env, config.walletId);
    this.transaction = null; // Will be initialized in init()
  }

  /**
   * Get the name of the provider
   * @returns {string} The name of the provider
   */
  static getProviderName() {
    return 'liminal';
  }

  /**
   * Initialize Liminal provider
   * @returns {Promise<Object>} Success status
   */
  async init() {
    try {
      if (!this.secret.clientId || !this.secret.clientSecret || !this.secret.AuthAudience) {
        throw new Error('Liminal API credentials not configured properly');
      }

      // Initialize wallet factory
      await this.walletFactory.init(this.secret);
      
      // Initialize transaction handler
      this.transaction = new Transaction(this.walletFactory);
      
      logger.info('Liminal provider initialized successfully');
      return { success: true };
    } catch (error) {
      logger.error(`Failed to initialize Liminal provider: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get token balance for a wallet
   * @param {Object} token - Token configuration object
   * @returns {Promise<string>} Balance in atomic units
   */
  async getTokenBalance(token) {
    try {
      logger.debug(`Getting token balance for: ${token.symbol}`);
      
      const balance = await this.walletFactory.getTokenBalance(token);
      return balance;
      
    } catch (error) {
      logger.error(`Error getting token balance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a transfer request from cold wallet to hot wallet
   * This initiates the multi-sig approval process
   * @param {Object} transferData - Transfer configuration
   * @returns {Promise<Object>} Transfer request result
   */
  async createTransferRequest(transferData) {
    try {
      const transferRequest = await this.transaction.createTransferRequest(transferData);
      return transferRequest;
    } catch (error) {
      logger.error(`Error creating transfer request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get transaction by ID
   * @param {string} txnId - Transaction ID
   * @param {string} sequenceId - Sequence ID
   * @param {Object} token - Token configuration object (required for Liminal to get wallet instance)
   * @returns {Promise<Object>} Transaction details
   */
  async getTransactionById(txnId, sequenceId, token) {
    try {
      if (!token) {
        throw new Error("Token configuration is required for Liminal getTransactionById");
      }

      const transaction = await this.transaction.getTransactionById(txnId, sequenceId, token);
      return transaction;
    } catch (error) {
      logger.error(`Error getting transaction by ID: ${error.message}`);
      throw error;
    }
  }
}

module.exports = LiminalProvider;
