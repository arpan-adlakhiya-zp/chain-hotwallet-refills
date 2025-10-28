const AbstractProvider = require('../abstractProvider');
const WalletFactory = require('./walletFactory');
const Transaction = require('./transaction');
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
  }

  static getProviderName() {
    return 'liminal';
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


  // Note: For Liminal multi-sig wallets, we don't use createSignAndSubmit
  // Instead, we create transfer requests that trigger manual approval
  // The createSignAndSubmit method is removed as it's not needed for multi-sig workflow

  // Note: For Liminal multi-sig wallets, we use getTransferStatus instead of getTransactionStatus
  // This method is removed as it's not needed for multi-sig workflow

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
      logger.info(`Creating transfer request: ${transferData.amount} ${transferData.asset} from cold wallet to hot wallet`);

      const transferRequest = await this.walletFactory.createTransferRequest(transferData);
      return transferRequest;

    } catch (error) {
      logger.error(`Error creating transfer request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get transfer status for monitoring multi-sig approval progress
   * @param {string} transferId - Transfer request ID
   * @param {Object} token - Token configuration object
   * @returns {Promise<Object>} Transfer status
   */
  async getTransferStatus(transferId, token) {
    try {
      logger.info(`Getting transfer status for: ${transferId}`);

      const status = await this.walletFactory.getTransferStatus(transferId, token);
      return status;

    } catch (error) {
      logger.error(`Error getting transfer status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pending transfers for monitoring
   * @param {Object} token - Token configuration object
   * @returns {Promise<Array>} List of pending transfers
   */
  async getPendingTransfers(token) {
    try {
      logger.info(`Getting pending transfers for: ${token.symbol}`);

      const transfers = await this.walletFactory.getPendingTransfers(token);
      return transfers;

    } catch (error) {
      logger.error(`Error getting pending transfers: ${error.message}`);
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
