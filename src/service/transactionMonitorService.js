const logger = require('../middleware/logger')('transactionMonitor');
const refillTransactionService = require('./refillTransactionService');

/**
 * Transaction Monitor Service
 * Polls pending/processing refill transactions and updates their status
 */
class TransactionMonitorService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * Start the transaction monitor
   * @param {number} intervalMs - Polling interval in milliseconds (default: 30 seconds)
   */
  start(intervalMs = 30000) {
    if (this.isRunning) {
      logger.warn('Transaction monitor is already running');
      return;
    }

    logger.info(`Starting transaction monitor with ${intervalMs}ms interval`);
    this.isRunning = true;

    // Run immediately on start
    this.monitorPendingTransactions();

    // Then schedule recurring checks
    this.intervalId = setInterval(() => {
      this.monitorPendingTransactions();
    }, intervalMs);
  }

  /**
   * Stop the transaction monitor
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('Transaction monitor stopped');
    }
  }

  /**
   * Monitor all pending/processing transactions
   */
  async monitorPendingTransactions() {
    try {
      logger.debug('Starting transaction status check cycle');

      // Get all non-final transactions from database
      const pendingTxns = await this.getPendingTransactions();

      if (!pendingTxns || pendingTxns.length === 0) {
        logger.debug('No pending transactions to monitor');
        return;
      }

      logger.info(`Monitoring ${pendingTxns.length} pending/processing transactions`);

      // Check and update each transaction
      const results = await Promise.allSettled(
        pendingTxns.map(tx => this.checkAndUpdateTransaction(tx))
      );

      // Log summary
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      logger.info(`Monitor cycle complete: ${successful} checked, ${failed} errors`);

    } catch (error) {
      logger.error(`Error in monitor cycle: ${error.message}`);
    }
  }

  /**
   * Get pending and processing transactions from database
   * @returns {Promise<Array>} List of transactions
   */
  async getPendingTransactions() {
    try {
      // Query database for non-final transactions
      const databaseService = require('./chainDb');
      
      // Get PENDING transactions
      const pending = await databaseService.getTransactionsByStatus('PENDING', 50);
      
      // Get PROCESSING transactions
      const processing = await databaseService.getTransactionsByStatus('PROCESSING', 50);
      
      // Combine and deduplicate
      const allPending = [...(pending || []), ...(processing || [])];
      
      // Sort by creation date (oldest first - higher priority)
      return allPending.sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      );
      
    } catch (error) {
      logger.error(`Error fetching pending transactions: ${error.message}`);
      return [];
    }
  }

  /**
   * Check transaction status with provider and update database
   * @param {Object} transaction - Transaction object from database
   */
  async checkAndUpdateTransaction(transaction) {
    try {
      const refillRequestId = transaction.refillRequestId;
      
      logger.debug(`Checking status for refill: ${refillRequestId}`);

      // Fetch latest status from provider and update DB (pass full transaction object)
      const result = await refillTransactionService.checkAndUpdateTransactionFromProvider(transaction);

      if (result.success) {
        const newStatus = result.data.status;
        const oldStatus = transaction.status;

        if (newStatus !== oldStatus) {
          logger.info(`Status updated for ${refillRequestId}: ${oldStatus} → ${newStatus}`);
        } else {
          logger.debug(`Status unchanged for ${refillRequestId}: ${oldStatus}`);
        }
      } else {
        logger.warn(`Failed to check status for ${refillRequestId}: ${result.error}`);
      }

    } catch (error) {
      logger.error(`Error checking transaction ${transaction.refillRequestId}: ${error.message}`);
      throw error; // Let Promise.allSettled handle it
    }
  }
}

module.exports = new TransactionMonitorService();

