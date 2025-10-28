const logger = require('../../middleware/logger')('fireblocksTransaction');
const FireblocksSDK = require("fireblocks-sdk").FireblocksSDK;
const { PeerType, TransactionStatus, FeeLevel } = require("fireblocks-sdk");

/**
 * Fireblocks Transaction class for handling transaction operations
 * Separated from wallet factory to follow Liminal pattern
 */
class Transaction {
  constructor(fireblocksSDK) {
    this.fireblocks = fireblocksSDK;
  }

  /**
   * Create a transaction using Fireblocks SDK
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  async createTransaction(transactionData) {
    try {
      const {
        assetId,
        amount,
        source,
        destination,
        note,
        externalTxId,
        feeLevel = FeeLevel.MEDIUM
      } = transactionData;

      const payload = {
        externalTxId,
        assetId,
        amount,
        feeLevel,
        source,
        destination,
        note
      };

      logger.debug('Creating Fireblocks transaction:', payload);
      const result = await this.fireblocks.createTransaction(payload);
      logger.debug('Transaction created:', result);

      return result;
    } catch (error) {
      logger.error("Error creating transaction:", error);
      throw error;
    }
  }

  /**
   * Get transaction status using Fireblocks SDK
   * @param {string} txId - Transaction ID
   * @returns {Promise<Object>} Transaction status
   */
  async getTransactionStatus(txId) {
    try {
      logger.debug(`Getting transaction status for: ${txId}`);
      const status = await this.fireblocks.getTransactionById(txId);
      logger.debug('Transaction status:', status);
      
      return {
        status: status.status || 'unknown',
        transactionId: txId,
        details: status
      };
    } catch (error) {
      logger.error("Error getting transaction status:", error);
      throw error;
    }
  }

  /**
   * Get transaction by external transaction ID
   * @param {string} externalTxId - External transaction ID
   * @returns {Promise<Object>} Transaction details
   */
  async getTransactionByExternalTxId(externalTxId) {
    try {
      logger.debug(`Getting transaction by external ID: ${externalTxId}`);
      const result = await this.fireblocks.getTransactionByExternalTxId(externalTxId);
      logger.debug('Transaction found:', result);
      
      return result;
    } catch (error) {
      logger.error("Error getting transaction by external ID:", error);
      throw error;
    }
  }

}

module.exports = Transaction;
