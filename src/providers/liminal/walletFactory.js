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
        logger.info(`Getting contract token wallet for: ${token.symbol.toLowerCase()}, walletId: ${walletId}`);

        wallet = await this.liminalJs
          .Coin(CoinsEnum[token.blockchainSymbol.toLowerCase()])
          .Token({
            tokenName: token.symbol.toLowerCase(),
            tokenAddress: token.contractAddress,
          })
          .Wallets()
          .Get({ walletId: walletId, allTokens: true });
      } else {
        // Native token
        logger.info(`Getting native token wallet for coin: ${CoinsEnum[token.symbol.toLowerCase()]}, walletId: ${walletId}`);

        wallet = await this.liminalJs
          .Coin(CoinsEnum[token.symbol.toLowerCase()])
          .Wallets()
          .Get({ walletId: walletId });
      }
    } catch (error) {
      logger.error(`Error getting wallet: ${error.message}`);
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
      logger.error(`Error getting token balance: ${error.message}`);
      throw error;
    }
  }
}


module.exports = WalletFactory;
