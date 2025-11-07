const logger = require('../middleware/logger')('transactionMonitor');
const refillTransactionService = require('./refillTransactionService');
const config = require('../config');
const { sendSlackAlert } = require('../utils/slackAlerts');

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
      logger.info('Transaction monitor is already running');
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

      console.log('results', JSON.stringify(results, null, 2));
      // Log summary
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      logger.info(`Monitor cycle complete: ${successful} checked, ${failed} errors`);

      // Check for long-pending transactions and raise alerts
      await this.checkAndAlertLongPending(pendingTxns, results);

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
      const pending = await databaseService.getTransactionsByStatus('PENDING');
      
      // Get PROCESSING transactions
      const processing = await databaseService.getTransactionsByStatus('PROCESSING');
      
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
        logger.info(`Failed to check status for ${refillRequestId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error(`Error checking transaction ${transaction.refillRequestId}: ${error.message}`);
      throw error; // Let Promise.allSettled handle it
    }
  }

  /**
   * Check for long-pending transactions and send grouped Slack alert
   * Uses results from the current monitoring cycle to avoid extra DB call
   * @param {Array} transactions - Original list of pending/processing transactions
   * @param {Array} results - Results from Promise.allSettled (after status updates)
   */
  async checkAndAlertLongPending(transactions, results) {
    try {
      const slackWebhookUrl = config.get('slackWebhookUrl');
      
      // Skip if Slack webhook URL is not configured
      if (!slackWebhookUrl) {
        logger.debug('Slack webhook URL not configured, skipping alert');
        return;
      }

      const pendingAlertThreshold = config.get('pendingAlertThreshold') || 1800; // Default: 30 minutes
      const now = new Date();
      const longPendingTxns = [];

      // Iterate through results to find transactions still pending after update
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        const result = results[i];

        // Get the current status from the result (post-update)
        const currentStatus = result.value?.data?.status || tx.status;
        
        // Only alert for PENDING and PROCESSING statuses (not final states)
        if (currentStatus !== 'PENDING' && currentStatus !== 'PROCESSING') {
          continue;
        }

        // Calculate time pending based on last update
        const updatedAt = new Date(tx.updatedAt);
        const timePendingSec = Math.floor((now - updatedAt) / 1000);

        // Check if transaction has been pending beyond threshold
        if (timePendingSec >= pendingAlertThreshold) {
          longPendingTxns.push({
            refillRequestId: tx.refillRequestId,
            status: currentStatus,
            provider: tx.provider,
            timePendingSec,
            updatedAt: tx.updatedAt
          });
        }
      }

      // Send grouped alert if there are long-pending transactions
      if (longPendingTxns.length > 0) {
        logger.info(`Found ${longPendingTxns.length} long-pending refill transactions`);
        logger.debug('Long-pending refill transactions', longPendingTxns);
        
        const alertMessage = this.formatPendingAlert(longPendingTxns, pendingAlertThreshold);
        console.log('alertMessage', alertMessage);
        
        // Raise Slack alert
        await sendSlackAlert(alertMessage);
        
        logger.info(`Slack alert sent for ${longPendingTxns.length} long-pending transactions`);
      } else {
        logger.debug('No long-pending transactions found');
      }
    } catch (error) {
      logger.error(`Error checking/alerting long-pending transactions: ${error.message}`);
    }
  }

  /**
   * Format grouped Slack alert message for long-pending transactions
   * @param {Array} longPendingTxns - List of long-pending transactions
   * @param {number} thresholdSec - Alert threshold in seconds
   * @returns {string} Formatted alert message
   */
  formatPendingAlert(longPendingTxns, thresholdSec) {
    const thresholdMin = Math.floor(thresholdSec / 60);
    
    let message = `Refill Alert: ${longPendingTxns.length} transaction(s) pending for over ${thresholdMin} minutes\n\n`;
    
    longPendingTxns.forEach((tx, index) => {
      const timePendingMin = Math.floor(tx.timePendingSec / 60);
      const timePendingHrs = (tx.timePendingSec / 3600).toFixed(1);
      
      const timeDisplay = timePendingMin < 60 
        ? `${timePendingMin} minutes`
        : `${timePendingHrs} hours`;
      
      message += `${index + 1}. ${tx.refillRequestId}\n`;
      message += `   • Status: \`${tx.status}\`\n`;
      message += `   • Provider: ${tx.provider}\n`;
      message += `   • Pending for: ${timeDisplay}\n`;
      message += `   • Last updated: ${new Date(tx.updatedAt).toISOString()}\n\n`;
    });
    
    message += `_Monitor cycle: ${new Date().toISOString()}_`;
    
    return message;
  }
}

module.exports = new TransactionMonitorService();

