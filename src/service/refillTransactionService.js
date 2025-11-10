const logger = require('../middleware/logger')('refillTransactionService');
const databaseService = require('./chainDb');
const providerService = require('./providerService');
const refillUtils = require('./utils/utils');

class RefillTransactionService {
  constructor() {
    this.logger = logger;
  }

  /**
   * Create a new refill transaction record
   * @param {Object} transactionData - Transaction data
   * @returns {Object} Standardized response
   */
  async createRefillTransaction(transactionData) {
    try {
      logger.info(`Creating refill transaction for request: ${transactionData.refillRequestId}`);

      // Check if transaction already exists (idempotency)
      const existingTransaction = await databaseService.getRefillTransactionByRequestId(transactionData.refillRequestId);
      if (existingTransaction) {
        logger.debug(`Refill transaction already exists for request: ${transactionData.refillRequestId}`);
        return {
          success: false,
          error: `Refill transaction already exists for request: ${transactionData.refillRequestId}`,
          code: 'TRANSACTION_EXISTS',
          data: {
            transaction: {
              refillRequestId: existingTransaction.refillRequestId,
              status: existingTransaction.status,
              amountAtomic: existingTransaction.amountAtomic,
              amount: existingTransaction.amount,
              tokenSymbol: existingTransaction.tokenSymbol,
              chainName: existingTransaction.chainName,
              assetId: existingTransaction.assetId,
              providerStatus: existingTransaction.providerStatus,
              provider: existingTransaction.provider,
              providerTxId: existingTransaction.providerTxId,
              txHash: existingTransaction.txHash,
              message: existingTransaction.message,
              createdAt: existingTransaction.createdAt,
              updatedAt: existingTransaction.updatedAt
            },
            message: 'Transaction already exists'
          }
        };
      }

      const transaction = await databaseService.createRefillTransaction(transactionData);

      logger.info(`Refill transaction created with request ID: ${transaction.refillRequestId}`);
      
      return {
        success: true,
        error: null,
        code: null,
        data: {
          transaction: transaction
        }
      };
    } catch (error) {
      logger.error(`Error creating refill transaction: ${error.message}`);
      return {
        success: false,
        error: 'Failed to create refill transaction',
        code: 'TRANSACTION_CREATION_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Update refill transaction with provider response
   * @param {string} refillRequestId - External request ID
   * @param {Object} updateData - Update data
   * @returns {Object} Standardized response
   */
  async updateRefillTransaction(refillRequestId, updateData) {
    try {
      logger.info(`Updating refill transaction for request: ${refillRequestId}`);

      const [updatedRowsCount] = await databaseService.updateRefillTransaction(refillRequestId, updateData);

      if (updatedRowsCount === 0) {
        return {
          success: false,
          error: 'Refill transaction not found',
          code: 'TRANSACTION_NOT_FOUND',
          data: {
            refillRequestId
          }
        };
      }
      
      return {
        success: true,
        error: null,
        code: null,
        data: null
      };
    } catch (error) {
      logger.error(`Error updating refill transaction: ${error.message}`);
      return {
        success: false,
        error: 'Failed to update refill transaction',
        code: 'TRANSACTION_UPDATE_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Get refill transaction by request ID
   * @param {string} refillRequestId - External request ID
   * @returns {Object} Standardized response
   */
  async getRefillTransactionByRequestId(refillRequestId) {
    try {
      const transaction = await databaseService.getRefillTransactionByRequestId(refillRequestId);

      if (!transaction) {
        return {
          success: false,
          error: 'Refill transaction not found',
          code: 'TRANSACTION_NOT_FOUND',
          data: {
            refillRequestId
          }
        };
      }

      return {
        success: true,
        error: null,
        code: null,
        data: {
          transaction: transaction
        }
      };
    } catch (error) {
      logger.error(`Error getting refill transaction: ${error.message}`);
      return {
        success: false,
        error: 'Failed to get refill transaction',
        code: 'TRANSACTION_GET_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Map provider status to internal status
   * @param {string} provider - Provider name
   * @param {string} providerStatus - Provider status
   * @returns {string} Internal status
   */
  mapProviderStatusToInternal(provider, providerStatus) {
    const statusMaps = {
      fireblocks: {
        'SUBMITTED': 'PROCESSING',
        'PENDING_AML_SCREENING': 'PROCESSING',
        'PENDING_ENRICHMENT': 'PROCESSING',
        'PENDING_AUTHORIZATION': 'PROCESSING',
        'QUEUED': 'PROCESSING',
        'PENDING_SIGNATURE': 'PROCESSING',
        'PENDING_3RD_PARTY_MANUAL_APPROVAL': 'PROCESSING',
        'PENDING_3RD_PARTY': 'PROCESSING',
        'BROADCASTING': 'PROCESSING',
        'CONFIRMING': 'PROCESSING',
        'COMPLETED': 'COMPLETED',
        'CANCELLING': 'PROCESSING',
        'CANCELLED': 'FAILED',
        'BLOCKED': 'FAILED',
        'REJECTED': 'FAILED',
        'FAILED': 'FAILED',
      },
      liminal: {
        '1': 'PROCESSING',
        '2': 'PROCESSING',
        '4': 'COMPLETED',
        '5': 'FAILED'
      }
    };

    const statusMap = statusMaps[provider?.toLowerCase()];
    if (statusMap && providerStatus) {
      return statusMap[providerStatus] || 'PROCESSING';
    }
    return 'PROCESSING';
  }

  /**
   * Check if a status is final (no further updates expected)
   * @param {string} status - Internal status
   * @returns {boolean} True if status is final
   */
  isFinalStatus(status) {
    const finalStatuses = ['COMPLETED', 'FAILED'];
    return finalStatuses.includes(status?.toUpperCase());
  }

  /**
   * Get transaction status from database only (fast, for external API)
   * @param {string} refillRequestId - External refill request ID
   * @returns {Promise<Object>} Standardized response with transaction status
   */
  async getTransactionStatusFromDB(refillRequestId) {
    try {
      logger.info(`Getting transaction status from DB: ${refillRequestId}`);

      // Get transaction from database
      const transactionResult = await this.getRefillTransactionByRequestId(refillRequestId);
      if (!transactionResult.success || !transactionResult.data.transaction) {
        logger.error(`Transaction not found for refill request: ${refillRequestId}`);
        return {
          success: false,
          error: 'Transaction not found',
          code: 'TRANSACTION_NOT_FOUND',
          data: {
            refillRequestId
          }
        };
      }

      const transaction = transactionResult.data.transaction;

      return {
        success: true,
        error: null,
        code: null,
        data: {
          refillRequestId: refillRequestId,
          status: transaction.status,
          amountAtomic: transaction.amountAtomic,
          amount: transaction.amount,
          tokenSymbol: transaction.tokenSymbol,
          chainName: transaction.chainName,
          assetId: transaction.assetId,
          providerStatus: transaction.providerStatus,
          provider: transaction.provider,
          providerTxId: transaction.providerTxId,
          txHash: transaction.txHash,
          message: transaction.message,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt
        }
      };
    } catch (error) {
      logger.error(`Error getting transaction status from DB: ${error.message}`);
      return {
        success: false,
        error: 'Failed to get transaction status',
        code: 'STATUS_CHECK_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Check transaction status from provider and update database (used by cron monitor)
   * @param {Object} transaction - Transaction object from database
   * @returns {Promise<Object>} Standardized response with transaction status
   */
  async checkAndUpdateTransactionFromProvider(transaction) {
    try {
      const refillRequestId = transaction.refillRequestId;
      const providerName = transaction.provider;
      const currentStatus = transaction.status;
      const providerTxId = transaction.providerTxId;

      logger.info(`Fetching latest status from provider for ${refillRequestId}: ${providerName} - ${providerTxId}`);

      // Get providers from provider service
      await providerService.initialize();
      const providers = providerService.getProviders();

      // Get provider instance
      const provider = providers.get(providerName.toLowerCase());
      if (!provider) {
        logger.error(`Provider ${providerName} not found in initialized providers`);
        return {
          success: false,
          error: `Provider ${providerName} not available`,
          code: 'PROVIDER_NOT_AVAILABLE',
          data: {
            refillRequestId,
            provider: providerName
          }
        };
      }

      // Fetch latest status from provider
      let providerStatusResponse = null;
      try {
        logger.info(`Fetching latest status from provider ${providerName} for transaction: ${providerTxId}`);

        // Fetch status from provider based on provider type
        if (providerName.toLowerCase() === 'fireblocks') {
          providerStatusResponse = await provider.getTransactionById(providerTxId);
        } else if (providerName.toLowerCase() === 'liminal') {
          // Get asset info from transaction association (already loaded with transaction)
          const asset = transaction.Asset;
          
          if (!asset) {
            logger.error(`Asset not found in transaction association for transaction: ${refillRequestId}`);
            return {
              success: false,
              error: 'Asset data not available for status check',
              code: 'ASSET_NOT_FOUND',
              data: { refillRequestId }
            };
          }

          // Construct token object for provider API calls
          const tokenInfo = {
            symbol: asset.symbol,
            blockchainSymbol: asset.Blockchain?.symbol || transaction.tokenSymbol,
            contractAddress: asset.contractAddress === 'native' ? null : asset.contractAddress,
            decimalPlaces: asset.decimals,
            walletConfig: asset.hotWalletConfig || {}
          };
          providerStatusResponse = await provider.getTransferStatus(providerTxId, tokenInfo);
        } else {
          logger.error(`Unknown provider type: ${providerName}`);
          return {
            success: false,
            error: `Unknown provider type: ${providerName}`,
            code: 'UNKNOWN_PROVIDER',
            data: {
              refillRequestId,
              provider: providerName
            }
          };
        }

        logger.info(`Provider status response:`, JSON.stringify(providerStatusResponse, null, 2));

      } catch (error) {
        logger.error(`Error fetching status from provider: ${error.message}`);
        // Return current status even if provider fetch fails
        return {
          success: true,
          error: null,
          code: null,
          data: {
            refillRequestId: refillRequestId,
            status: currentStatus,
            provider: providerName,
            providerTxId: providerTxId,
            txHash: transaction.txHash,
            message: `Failed to fetch latest status from provider: ${error.message}`
          }
        };
      }

      // Extract transaction details from provider response
      const transactionDetails = this.extractTransactionDetails(providerName, providerStatusResponse);
      const mappedStatus = this.mapProviderStatusToInternal(providerName, transactionDetails.status);

      // Build update data - only include fields that changed
      const { updateData, hasChanges } = refillUtils.buildTransactionUpdateData(
        transaction,
        transactionDetails,
        mappedStatus
      );

      // Only update database if something actually changed
      if (hasChanges) {
        logger.info(`Updating transaction ${refillRequestId} in DB with changed fields`);
        
        const updateResult = await this.updateRefillTransaction(refillRequestId, updateData);
        
        if (!updateResult.success) {
          logger.error(`Failed to update transaction: ${updateResult.error}`);
        }
        
        return {
          success: true,
          error: null,
          code: null,
          data: {
            refillRequestId: refillRequestId,
            status: updateData.status || currentStatus,
            provider: providerName,
            providerTxId: providerTxId,
            providerStatus: updateData.providerStatus || transaction.providerStatus,
            txHash: updateData.txHash || transaction.txHash,
            message: updateData.message || transaction.message,
            previousStatus: currentStatus,
            updated: true
          }
        };
      } else {
        logger.debug(`No changes detected for transaction ${refillRequestId}`);
        return {
          success: true,
          error: null,
          code: null,
          data: {
            refillRequestId: refillRequestId,
            status: currentStatus,
            provider: providerName,
            providerTxId: providerTxId,
            providerStatus: transaction.providerStatus,
            txHash: transaction.txHash,
            message: transaction.message,
            updated: false
          }
        };
      }
    } catch (error) {
      logger.error(`Error checking transaction status: ${error.message}`);
      return {
        success: false,
        error: 'Failed to check transaction status',
        code: 'STATUS_CHECK_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Extract transaction details from provider response
   * @param {string} provider - Provider name
   * @param {Object} providerResponse - Provider response
   * @returns {Object} Extracted transaction details
   */
  extractTransactionDetails(provider, providerResponse) {
    try {
      if (provider === 'fireblocks') {
        return {
          providerTxId: providerResponse.id,
          txHash: providerResponse.txHash,
          status: providerResponse.status,
          message: providerResponse.note || null,
          providerData: providerResponse
        };
      } else if (provider === 'liminal') {
        // Liminal response can be in different formats
        const responseData = providerResponse.data || providerResponse;
        return {
          providerTxId: responseData.id?.toString() || responseData.txid || null,
          txHash: responseData.txid || responseData.txHash || null,
          status: responseData.status || responseData.type || 'pending',
          message: responseData.note || responseData.message || null,
          providerData: responseData
        };
      }
      
      return {
        providerTxId: null,
        txHash: null,
        status: 'PROCESSING',
        providerData: providerResponse
      };
    } catch (error) {
      logger.error(`Error extracting transaction details: ${error.message}`);
      return {
        providerTxId: null,
        txHash: null,
        status: 'PROCESSING',
        providerData: providerResponse
      };
    }
  }
}

module.exports = new RefillTransactionService();
