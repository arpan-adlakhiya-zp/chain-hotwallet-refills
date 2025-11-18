const AbstractProvider = require('../abstractProvider');
const WalletFactory = require('./walletFactory');
const Transaction = require('./transaction');
const BigNumber = require('bignumber.js');
const logger = require('../../middleware/logger')('fireblocks');
const { PeerType, FeeLevel } = require("fireblocks-sdk");

/**
 * Fireblocks Provider Implementation
 * Implements the AbstractProvider interface for Fireblocks API integration
 */
class FireblocksProvider extends AbstractProvider {
  constructor(config, secret) {
    super(config, secret);
    this.walletFactory = new WalletFactory();
    this.transaction = null; // Will be initialized in init()
  }

  /**
   * Get the name of the provider
   * @returns {string} The name of the provider
   */
  static getProviderName() {
    return 'fireblocks';
  }

  /**
   * Initialize Fireblocks provider
   * @returns {Promise<Object>} Result object:
   *   - success {boolean}: true if initialization was successful, false otherwise.
   *   - error? {string}: the error message if initialization failed.
   *   - code? {string}: the error code if initialization failed.
   *   - details? {Object}: additional details about the initialization.
   */
  async init() {
    try {
      if (!this.secret.apiKey || !this.secret.privateKey) {
        throw new Error('Fireblocks API credentials not configured properly');
      }

      // Initialize wallet factory
      await this.walletFactory.init(
        this.secret.privateKey,
        this.secret.apiKey,
        this.config.apiBaseUrl || 'https://api.fireblocks.io'
      );

      // Initialize transaction handler
      this.transaction = new Transaction(this.walletFactory.fireblocks);

      logger.info('Fireblocks provider initialized successfully');
      return { success: true };
    } catch (error) {
      logger.error(`Failed to initialize Fireblocks provider: ${error.message}`);
      throw error;
    }
  }

  async getTransactionById(txnId) {
    try {
      logger.info(`Getting transaction by ID from Fireblocks: ${txnId}`);

      const result = await this.transaction.getTransactionById(txnId);
      return result;
    } catch (error) {
      logger.error(`Error getting transaction status from Fireblocks: ${error.message}`);
      throw error;
    }
  }

  async getTokenBalance(token) {
    try {
      logger.info(`Getting token balance for: ${token.symbol}`);

      const assetId = token.walletConfig.fireblocks.assetId;
      const vaultId = token.walletConfig.fireblocks.vaultId;
      const balance = await this.walletFactory.getTokenBalance(vaultId, assetId);
      const balanceInAtomic = new BigNumber(balance).multipliedBy(new BigNumber(10).pow(token.decimalPlaces));
      return balanceInAtomic.toString();

    } catch (error) {
      logger.error(`Error getting token balance from Fireblocks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a transfer request -
   * This method handles the cold wallet to hot wallet refill flow for Fireblocks
   * @param {Object} transferData - Transfer configuration
   * @returns {Promise<Object>} Transfer result
   */
  async createTransferRequest(transferData) {
    try {
      const { coldWalletId, hotWalletId, amount, asset, blockchain, externalTxId, coldWalletConfig } = transferData;
      
      let assetId = null;
      if (coldWalletConfig && coldWalletConfig.fireblocks && coldWalletConfig.fireblocks.assetId) {
        assetId = coldWalletConfig.fireblocks.assetId;
      } else {
        logger.info(`Missing asset ID for asset ${asset} on blockchain ${blockchain} for Fireblocks, continuing with default asset symbol`);
        // Keep default asset symbol
        assetId = asset;
      }

      logger.info(`Creating Fireblocks vault-to-vault transfer request: ${amount} for ${assetId} from vault ${coldWalletId} to vault ${hotWalletId}`);

      // Use provided externalTxId or generate one if not provided
      const txId = `${externalTxId}_${assetId}`;
      
      // Prepare transaction data for vault-to-vault transfer
      const transactionData = {
        externalTxId: txId,
        assetId: assetId,
        amount: amount,
        feeLevel: FeeLevel.MEDIUM,
        source: {
          type: PeerType.VAULT_ACCOUNT,
          id: coldWalletId
        },
        destination: {
          type: PeerType.VAULT_ACCOUNT,
          id: hotWalletId
        },
        note: `Cold to hot wallet refill - ${assetId} transfer`,
      };

      logger.info(`Sending transfer request to Fireblocks:`, transactionData);

      const result = await this.transaction.createTransaction(transactionData);
      
      logger.info(`Transfer request created successfully with Fireblocks`, result);
      
      return {
        status: result.status,
        message: 'Transfer request submitted to Fireblocks',
        externalTxId: txId,
        transactionId: result.id,
        createdAt: new Date().toISOString(),
        result: result
      };
      
    } catch (error) {
      logger.error(`Error creating transfer request: ${error.message}`);
      throw error;
    }
  }
}

module.exports = FireblocksProvider;
