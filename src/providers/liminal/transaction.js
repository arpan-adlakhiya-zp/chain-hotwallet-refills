const logger = require('../../middleware/logger')('liminalTransaction');

/**
 * Liminal Transaction class for handling transaction operations
 * Based on hot wallet infra pattern
 */
class Transaction {
  constructor(walletFactory) {
    this.walletFactory = walletFactory;
  }

  /**
   * Create a transfer request from cold wallet to hot wallet
   * using CreateSendManyTransactionRequestAsync
   * @param {Object} transferData - Transfer configuration
   * @returns {Promise<Object>} Transfer request result
   */
  async createTransferRequest(transferData) {
    try {
      const { coldWalletId, hotWalletAddress, amount, asset, blockchain, externalTxId, coldWalletConfig } = transferData;
      
      logger.debug(`Creating transfer request: ${amount} ${asset} from cold wallet ${coldWalletId} to ${hotWalletAddress}`);

      let symbol = null;
      if (coldWalletConfig && coldWalletConfig.liminal && coldWalletConfig.liminal.tokenSymbol) {
        symbol = coldWalletConfig.liminal.tokenSymbol;
      } else {
        logger.info(`Missing token symbol for asset ${asset} on blockchain ${blockchain} for Liminal, continuing with default asset symbol`);
        // Keep default asset symbol
        symbol = asset;
      }
      
      const wallet = await this.walletFactory.getWallet({
        symbol: symbol,
        blockchainSymbol: blockchain,
        contractAddress: transferData.contractAddress || null,
        walletConfig: coldWalletConfig
      });
      
      if (!wallet) {
        throw new Error("Unable to get cold wallet instance");
      }
      
      // Use provided externalTxId or generate one if not provided
      const sequenceId = `${externalTxId}_${symbol}`;

      try {
        // Get WalletV2 instance
        const walletV2 = wallet.WalletV2();
        
        if (!walletV2) {
          throw new Error("Unable to get WalletV2 instance");
        }

        // Prepare the SendMany request options as per WalletV2 API
        const sendManyOptions = {
          recipients: [{
            address: hotWalletAddress,
            amount: amount
          }],
          sequenceId: sequenceId,
          isInternal: true,
          comment: `Cold to hot wallet refill: ${amount} ${asset}`
        };

        logger.info("Sending transfer request to Liminal:", sendManyOptions);

        // Use CreateSendManyTransactionRequestAsync method
        const result = await walletV2.CreateSendManyTransactionRequestAsync({
          sendManyOptions: sendManyOptions
        });
        if (result.isErr()) {
          const error = result.error;
          const errorMessage = error.message || 'CreateSendManyTransactionRequestAsync failed';
          logger.error(`CreateSendManyTransactionRequestAsync error: ${errorMessage}`, error);
          throw new Error(errorMessage);
        }
        
        // Extract response from Result value
        const response = result.value;
        if (!response.success) {
          throw new Error(response.message || 'CreateSendManyTransactionRequestAsync failed');
        }
        
        logger.info("Transfer request created successfully with Liminal:", response);
        
        // Extract transaction ID from response data
        const transactionId = response.data?.txnReqId?.toString();
        
        // Return the transfer result
        return {
          status: response.data?.status || null,
          message: response.data?.comment || sendManyOptions.comment,
          externalTxId: response.data?.sequenceId || sequenceId,
          transactionId: transactionId,
          createdAt: response.data?.timestamp ? new Date(response.data?.timestamp).toISOString() : new Date().toISOString(),
          result: response.data
        }; 
      } catch (sdkError) {
        logger.error("Error in CreateSendManyTransactionRequestAsync transfer process:", sdkError);
        throw new Error(`Failed to create transfer request: ${sdkError.message}`);
      }
    } catch (error) {
      logger.error("Error creating transfer request:", error);
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
        throw new Error("Token configuration is required to get transaction by ID");
      }

      logger.info(`Getting transaction by ID: ${txnId} and sequenceId: ${sequenceId} for token: ${token.symbol}`);

      // Get wallet instance
      const wallet = await this.walletFactory.getWallet(token);
      if (!wallet) {
        throw new Error("Unable to get wallet instance");
      }

      let transferResult = null;
      if (sequenceId) {
        logger.debug(`Fetching pending transaction with sequenceId: ${sequenceId}`);
        transferResult = await wallet.GetPendingTransaction({ sequenceId: sequenceId });
      } 
      if (!transferResult.success) {
        if (txnId && transferResult.message && transferResult.message.toLowerCase().includes("pending transaction is not found")) {
          logger.info(`Fetching transaction with txId: ${txnId}`);
          transferResult = await wallet.GetTransfer({ txId: txnId, sequenceId: sequenceId });
          if (!transferResult.success) {
            throw new Error(`error: ${transferResult}`);
          }
        } else {
          throw new Error(`error: ${transferResult}`);
        }
      }

      logger.debug(`Transaction found:`, transferResult);

      return transferResult.data.transaction;
    } catch (error) {
      logger.error("Error getting transaction:", error);
      throw error;
    }
  }
}

module.exports = Transaction;