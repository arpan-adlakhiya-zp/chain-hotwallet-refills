const logger = require('../../middleware/logger')('liminalWallet');
const { LiminalJs, CoinsEnum, LiminalEnvironment } = require("@lmnl/liminaljs");

class WalletFactory {
  constructor(env, walletId) {
    this.liminalJs = new LiminalJs(LiminalEnvironment[env]);
    this.env = env;
    this.walletId = walletId;
  }

  /**
   * Authenticate LiminalJs api
   * @param {Object} auth - Authentication credentials
   * @returns {Promise<boolean>}
   */
  async init(auth) {
    try {
      await this.liminalJs.Authenticate(auth).AuthenticateWithAccessToken();
      logger.info('Liminal wallet factory initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Liminal wallet factory:', error.message);
      throw error;
    }
  }

  /**
   * Get the wallet instance
   * @param {Object} token - Token configuration object
   * @returns {Promise<Object>} Wallet instance
   */
  async getWallet(token) {
    let wallet = null;
    try {
      if (token.nativeCoin && token.contractAddress) {
        let liminalTokenSymbol = token.symbol.toLowerCase();

        // For AVAX on BSC Liminal expects token symbol as avaxb
        if (token.nativeCoin.toLowerCase() === 'bnb' && token.symbol.toLowerCase() === 'avax') {
          liminalTokenSymbol = 'avaxb';
        }
        if (token.nativeCoin.toLowerCase() === 'bnb' && token.symbol.toLowerCase() === 'wrx') {
          liminalTokenSymbol = 'wrxnew';
        }

        wallet = await this.liminalJs
          .Coin(CoinsEnum[token.nativeCoin.toLowerCase()])
          .Token({
            tokenName: liminalTokenSymbol,
            tokenAddress: token.contractAddress,
          })
          .Wallets()
          .Get({ walletId: token.hotWalletConfig.liminalHotWalletId, allTokens: true });
      } else {
        let coinSymbol = token.symbol.toLowerCase() === 'atom' ?
          ((this.env === 'prod' || this.env === 'beta') ? "uatom" : "umlg") :
          token.symbol.toLowerCase();

        logger.debug(`Getting wallet for coin: ${CoinsEnum[coinSymbol]}, walletId: ${token.hotWalletConfig.liminalHotWalletId}`);

        wallet = await this.liminalJs
          .Coin(CoinsEnum[coinSymbol])
          .Wallets()
          .Get({ walletId: token.hotWalletConfig.liminalHotWalletId });
      }
    } catch (error) {
      logger.error("Error getting wallet:", error);
      throw error;
    }
    return wallet;
  }

  /**
   * Get token balance for a specific wallet
   * @param {Object} token - Token configuration object
   * @returns {Promise<string>} Balance in atomic units
   */
  async getTokenBalance(token) {
    try {
      const wallet = await this.getWallet(token);
      if (wallet) {
        const response = await wallet.GetBalance();
        return response.spendableBalanceInLowerDenom;
      } else {
        throw new Error("Unable to get wallet");
      }
    } catch (error) {
      logger.error("Error getting token balance:", error);
      throw error;
    }
  }

  /**
   * Create and send a transaction using Liminal SDK SendMany
   * @param {Array} txns - Array of transaction objects
   * @param {Object} token - Token configuration object
   * @returns {Promise<Object>} Transaction result
   */
  async createTransaction(txns, token) {
    try {
      const wallet = await this.getWallet(token);
      
      // Prepare recipients data for SendMany
      const recipients = txns.map((txn) => {
        let recipient = {
          address: txn.sendAddress,
          amount: txn.amount
        };

        return recipient;
      });

      // Prepare sendMany options
      const sendManyOptions = {
        recipients: recipients,
        sequenceId: `refill_${txns[0].dbId}_${Date.now()}`
      };

      logger.debug({ wallet: wallet });
      logger.debug({ createTransaction: sendManyOptions });
      
      // Use Liminal SDK SendMany method
      const result = await wallet.SendMany(sendManyOptions);
      
      // Mock result for testing (remove this when ready for actual transactions)
      // const result = {
      //   sequenceId: `refill_${txns[0].dbId}_${Date.now()}`,
      //   id: `mock_tx_${Date.now()}`,
      //   status: 'pending',
      //   recipients: recipients,
      //   message: 'Mock transaction - wallet.SendMany commented out for testing'
      // };
      
      logger.debug({ createdTransaction: result });

      return { 
        rawTx: result, 
        serializedTx: JSON.stringify(result),
        txId: result.sequenceId || result.id || `tx_${txns[0].dbId}_${Date.now()}`
      };
    } catch (error) {
      logger.error("Error creating transaction:", error);
      throw error;
    }
  }

  /**
   * Send a transaction (alias for createTransaction since SendMany handles the full flow)
   * @param {Object} txn - Transaction object
   * @param {Object} token - Token configuration object
   * @returns {Promise<Object>} Transaction result
   */
  async sendTransaction(txn, token) {
    try {
      // Convert single transaction to array format expected by createTransaction
      const txns = [{
        sendAddress: txn.toAddress,
        amount: txn.amount,
        dbId: txn.refillRequestId
      }];

      const result = await this.createTransaction(txns, token);
      return { txId: result.txId };
    } catch (error) {
      logger.error("Error sending transaction:", error);
      throw error;
    }
  }

  /**
   * Get transaction status
   * @param {string} batchId - Transaction batch ID (sequenceId)
   * @param {Object} token - Token configuration object
   * @returns {Promise<Object>} Transaction status
   */
  async getTransactionStatus(batchId, token) {
    try {
      const wallet = await this.getWallet(token);
      
      // Use Liminal SDK to get transaction status
      // Note: The exact method may vary based on Liminal SDK version
      // This is a placeholder implementation - you may need to adjust based on actual SDK methods
      const status = await wallet.GetTransactionStatus(batchId);
      
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
   * Validate credentials by making a simple API call
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async validateCredentials() {
    try {
      // Try to get wallet list to validate credentials
      const walletList = await this.liminalJs.Coin(this.liminalJs.CoinsEnum.trx).Wallets().WalletList();
      return { success: true };
    } catch (error) {
      logger.error("Error validating credentials:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}


module.exports = WalletFactory;
