const logger = require('../../middleware/logger')('fireblocksWallet');
const FireblocksSDK = require("fireblocks-sdk").FireblocksSDK;

class WalletFactory {
  constructor() {
    this.fireblocks = null;
  }

  /**
   * Initialize Fireblocks SDK
   * @param {string} privateKey - Private key for authentication
   * @param {string} apiKey - API key
   * @param {string} apiBaseUrl - Base URL for API
   * @returns {Promise<boolean>}
   */
  async init(privateKey, apiKey, apiBaseUrl) {
    try {
      this.fireblocks = new FireblocksSDK(privateKey, apiKey, apiBaseUrl);
      logger.info('Fireblocks wallet factory initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Fireblocks wallet factory:', error.message);
      throw error;
    }
  }

  /**
   * Get token balance for a vault account
   * @param {string} vaultId - Vault account ID
   * @param {string} assetId - Asset ID
   * @returns {Promise<string>} Available balance
   */
  async getTokenBalance(vaultId, assetId) {
    try {
      const { available } = await this.fireblocks.getVaultAccountAsset(vaultId, assetId);
      return available;
    } catch (error) {
      logger.error("Error getting token balance:", error);
      throw error;
    }
  }
}

module.exports = WalletFactory;
