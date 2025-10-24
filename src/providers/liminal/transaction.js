const logger = require('../../middleware/logger')('liminalTransaction');
const config = require('../../config');

/**
 * Liminal Transaction class for handling transaction operations
 * Based on hot wallet infra pattern
 */
class Transaction {
  constructor(wallet) {
    this.wallet = wallet;
  }

  /**
   * Create a transaction using Liminal SDK PreBuildTransactionSatoshi
   * @param {Array} txns - Array of transaction objects
   * @param {Object} token - Token configuration object
   * @returns {Promise<Object>} Transaction result
   */
  async createTransaction(txns, token) {
    try {
      // Prepare recipients data for PreBuildTransactionSatoshi
      const recipients = txns.map((txn) => ({
        address: txn.sendAddress,
        amount: txn.amount
      }));

      const transactionParams = {
        recipients: recipients,
        isInternal: true // For cold to hot wallet transactions, this is internal
      };

      logger.debug({ createTransaction: transactionParams });
      
      // Use Liminal SDK PreBuildTransactionSatoshi method
      const result = await this.wallet.PreBuildTransactionSatoshi(transactionParams);
      
      logger.debug({ createdTransaction: result });

      return { 
        rawTx: result, 
        serializedTx: JSON.stringify(result),
        txId: result.txDataResponse?.txID || result.txJson?.txID || `tx_${Date.now()}`
      };
    } catch (error) {
      logger.error("Error creating transaction:", error);
      throw error;
    }
  }

  /**
   * Sign a transaction using Liminal SDK SignTransaction
   * @param {Array} tx - Array of transaction objects with address, amount, dbId
   * @param {Object} unsignedTx - The unsigned transaction from createTransaction
   * @returns {Promise<Object>} Signed transaction result
   */
  async signTransaction(tx, unsignedTx) {
    try {
      let recipients = [];
      for (let i = 0; i < tx.length; i++) {
        if ("data" in tx[i]) {
          recipients.push({
            address: tx[i].address,
            amount: tx[i].amount,
            data: tx[i].data,
          });
        } else {
          recipients.push({ address: tx[i].address, amount: tx[i].amount });
        }
      }

      let params = {
        recipients: recipients,
        isInternal: true // For cold to hot wallet transactions, this is internal
      };

      // Add TSM credentials if available
      const tsmCreds = config.getSecret("liminalTsmCredentials");
      if (tsmCreds && tsmCreds.userID && tsmCreds.userID.length > 1) {
        params.tsmCreds = tsmCreds;
        logger.debug('TSM credentials added to signing parameters');
      } else {
        logger.warn('TSM credentials not found - signing may fail');
      }

      logger.debug({ signTransaction: params });
      
      // Use Liminal SDK SignTransaction method
      const signedTx = await this.wallet.SignTransaction(params, unsignedTx);
      
      logger.debug({ signedTransaction: signedTx });
      
      return signedTx;
    } catch (error) {
      logger.error("Error signing transaction:", error);
      throw error;
    }
  }

  /**
   * Send/Submit a signed transaction using Liminal SDK Submit
   * @param {Object} halfSignedTx - The signed transaction from signTransaction
   * @param {string} batchId - Optional batch ID for the transaction
   * @returns {Promise<Object>} Submission result
   */
  async sendTransaction(halfSignedTx, batchId = null) {
    try {
      logger.debug({ sendTransaction: { batchId } });
      
      // Use Liminal SDK Submit method
      const sentTransaction = await this.wallet.Submit(halfSignedTx, batchId);
      
      logger.debug({ submittedTransaction: sentTransaction });
      
      return sentTransaction;
    } catch (error) {
      logger.error("Error sending transaction:", error);
      throw error;
    }
  }

  /**
   * Get transaction status using Liminal SDK
   * @param {string} batchId - The batch ID of the transaction
   * @returns {Promise<Object>} Transaction status
   */
  async getTransactionStatus(batchId) {
    try {
      logger.debug({ getTransactionStatus: { batchId } });
      
      // Use Liminal SDK to get transaction status
      const status = await this.wallet.GetTransactionStatus(batchId);
      
      logger.debug({ transactionStatus: status });
      
      return {
        status: status.status || 'unknown',
        sequenceId: batchId,
        details: status
      };
    } catch (error) {
      logger.error("Error getting transaction status:", error);
      throw error;
    }
  }

  /**
   * Complete transaction flow: create, sign, and submit
   * @param {Array} txns - Array of transaction objects
   * @param {Object} token - Token configuration object
   * @param {string} batchId - Optional batch ID
   * @returns {Promise<Object>} Complete transaction result
   */
  async createSignAndSubmit(txns, token, batchId = null) {
    try {
      logger.info(`Starting complete transaction flow for ${txns.length} transactions`);
      
      // Step 1: Create transaction
      const createResult = await this.createTransaction(txns, token);
      logger.info("Transaction created successfully");
      
      // Step 2: Sign transaction
      const signResult = await this.signTransaction(txns, createResult.rawTx);
      logger.info("Transaction signed successfully");
      
      // Step 3: Submit transaction
      const submitResult = await this.sendTransaction(signResult, batchId);
      logger.info("Transaction submitted successfully");
      
      return {
        success: true,
        createResult,
        signResult,
        submitResult,
        transactionId: createResult.txId,
        batchId: batchId || submitResult.batchId
      };
    } catch (error) {
      logger.error("Error in complete transaction flow:", error);
      throw error;
    }
  }
}

module.exports = Transaction;