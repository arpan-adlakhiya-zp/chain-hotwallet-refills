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
      // Get wallet ID from the correct location
      let walletId = null;
      if (token.walletConfig && token.walletConfig.liminal && token.walletConfig.liminal.walletId) {
        walletId = token.walletConfig.liminal.walletId;
      } else {
        throw new Error("No wallet ID found in token configuration");
      }

      // Check if this is a contract token (has contractAddress) or native token
      if (token.contractAddress && token.contractAddress !== 'native') {
        logger.info(`Getting contract token wallet for: ${token.symbol}, walletId: ${walletId}`);

        wallet = await this.liminalJs
          .Coin(CoinsEnum[token.blockchainSymbol.toLowerCase()])
          .Token({
            tokenName: token.symbol,
            tokenAddress: token.contractAddress,
          })
          .Wallets()
          .Get({ walletId: walletId, allTokens: true });
      } else {
        // Native token
        logger.info(`Getting native token wallet for coin: ${CoinsEnum[token.symbol]}, walletId: ${walletId}`);

        wallet = await this.liminalJs
          .Coin(CoinsEnum[token.symbol])
          .Wallets()
          .Get({ walletId: walletId });
      }
    } catch (error) {
      logger.error("Error getting wallet:", JSON.stringify(error, null, 2));
      throw error;
    }
    return wallet;
  }

  /**
   * Get token balance for a wallet
   * @param {Object} token - Token configuration object
   * @returns {Promise<string>} Balance in atomic units
   */
  async getTokenBalance(token) {
    try {
      const wallet = await this.getWallet(token);
      if (!wallet) {
        throw new Error("Unable to get wallet instance");
      }
      
      // Get balance from wallet - use the wallet's address for GetAddressBalance
      const walletAddress = wallet.WalletAddress;
      const balance = await wallet.GetBalance({ address: walletAddress });
      
      logger.debug(`Token balance for ${token.symbol}: ${balance.spendableBalanceInLowerDenom}`);
      return balance.spendableBalanceInLowerDenom;
      
    } catch (error) {
      logger.error("Error getting token balance:", error);
      throw error;
    }
  }

  /**
   * Create a transfer request from cold wallet to hot wallet using SendMany
   * This uses Liminal SDK's SendMany method which handles the entire flow internally
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
        logger.warn(`Missing token symbol for asset ${asset} on blockchain ${blockchain} for Liminal, continuing with default asset symbol`);
        // Keep default asset symbol
        symbol = asset;
      }
      
      const wallet = await this.getWallet({
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
      
      logger.debug("Creating transfer request using Liminal SDK SendMany method");
      
        // Get the wallet address for native tokens
        const walletAddress = wallet.WalletAddress;
        logger.debug("Retrieved wallet address:", walletAddress);

      try {
        // Prepare the SendMany request body as per Liminal API documentation
        const sendManyData = {
          wallet: {
            coin: asset.toLowerCase(),
            walletId: parseInt(coldWalletId),
            allToken: true,
            tokenOptions: transferData.contractAddress && transferData.contractAddress !== 'native' ? {
              tokenName: symbol,
              tokenAddress: transferData.contractAddress
            } : {
              tokenName: symbol,
              tokenAddress: walletAddress
            }
          },
          transactions: {
            recipientsData: {
              recipients: [{
                address: hotWalletAddress,
                amount: amount
              }],
              sequenceId: sequenceId,
            }
          }
        };

        logger.debug("Creating SendMany transaction with data:", sendManyData);

        // Use SendMany method directly
        const sendManyResult = await wallet.SendMany(sendManyData.transactions.recipientsData, {
          sequenceId: sequenceId
        });
        
        logger.debug("SendMany result:", sendManyResult);
        
        if (!sendManyResult.success) {
          throw new Error(sendManyResult.message || 'SendMany failed');
        }
        
        logger.debug("SendMany transaction created successfully:", sendManyResult);
        
        // Return the transfer result
        return {
          transactionId: sendManyResult.data?.txID || sendManyResult.data?.id || sequenceId,
          status: 'pending_approval',
          message: 'Transfer request created and queued for approval',
          fromWalletId: coldWalletId,
          toWalletAddress: hotWalletAddress,
          amount: amount,
          asset: asset,
          blockchain: blockchain,
          requiresApproval: true,
          approvalPlatform: 'Liminal Multi-Sig',
          refillType: 'sendmany_transfer',
          sequenceId: sequenceId,
          createdAt: new Date().toISOString(),
          result: sendManyResult
        };
        
      } catch (sdkError) {
        logger.error("Error in SendMany transfer process:", sdkError);
        throw new Error(`Failed to create transfer request: ${sdkError.message}`);
      }
      
    } catch (error) {
      logger.error("Error creating transfer request:", error);
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
      const wallet = await this.getWallet(token);
      if (!wallet) {
        throw new Error("Unable to get wallet instance");
      }
      
      const status = await wallet.GetTransactionStatus(transferId);
      logger.debug(`Transfer ${transferId} status:`, status);
      return status;
      
    } catch (error) {
      logger.error("Error getting transfer status:", error);
      throw error;
    }
  }

  /**
   * Get pending transfers for a wallet
   * @param {Object} token - Token configuration object
   * @returns {Promise<Array>} List of pending transfers
   */
  async getPendingTransfers(token) {
    try {
      const wallet = await this.getWallet(token);
      if (!wallet) {
        throw new Error("Unable to get wallet instance");
      }
      
      const transfers = await wallet.GetTransactions({ status: 'pending' });
      logger.debug(`Found ${transfers.length} pending transfers`);
      return transfers;
      
    } catch (error) {
      logger.error("Error getting pending transfers:", error);
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
