const logger = require('../../middleware/logger')('fireblocksWallet');
const FireblocksSDK = require("fireblocks-sdk").FireblocksSDK;
const { PeerType, TransactionStatus, FeeLevel } = require("fireblocks-sdk");

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

  /**
   * Get transaction by external transaction ID
   * @param {string} externalTxId - External transaction ID
   * @returns {Promise<Object>} Transaction details
   */
  async getTransactionByExternalTxId(externalTxId) {
    try {
      return await this.fireblocks.getTransactionByExternalTxId(externalTxId);
    } catch (error) {
      logger.error("Error getting transaction by external ID:", error);
      throw error;
    }
  }

  /**
   * Create a transaction
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
   * Get transaction status
   * @param {string} txId - Transaction ID
   * @returns {Promise<Object>} Transaction status
   */
  async getTransactionStatus(txId) {
    try {
      return await this.fireblocks.getTransactionById(txId);
    } catch (error) {
      logger.error("Error getting transaction status:", error);
      throw error;
    }
  }

  /**
   * Get vault accounts
   * @returns {Promise<Array>} List of vault accounts
   */
  async getVaultAccounts() {
    try {
      return await this.fireblocks.getVaultAccounts();
    } catch (error) {
      logger.error("Error getting vault accounts:", error);
      throw error;
    }
  }

  /**
   * Get vault account by ID
   * @param {string} vaultAccountId - Vault account ID
   * @returns {Promise<Object>} Vault account details
   */
  async getVaultAccount(vaultAccountId) {
    try {
      return await this.fireblocks.getVaultAccountById(vaultAccountId);
    } catch (error) {
      logger.error("Error getting vault account:", error);
      throw error;
    }
  }

  /**
   * Get supported assets
   * @returns {Promise<Array>} List of supported assets
   */
  async getSupportedAssets() {
    try {
      return await this.fireblocks.getSupportedAssets();
    } catch (error) {
      logger.error("Error getting supported assets:", error);
      throw error;
    }
  }

  /**
   * Validate credentials by making a simple API call
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async validateCredentials() {
    try {
      // Try to get vault accounts to validate credentials
      await this.fireblocks.getVaultAccounts();
      return { success: true };
    } catch (error) {
      logger.error("Error validating credentials:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Map asset symbol to Fireblocks asset ID
   * @param {string} assetSymbol - Asset symbol
   * @param {number} blockchainId - Blockchain ID
   * @returns {string|null} Fireblocks asset ID
   */
  mapToFireblocksAssetId(assetSymbol, blockchainId = null) {
    // Map common asset symbols to Fireblocks asset IDs
    const assetMapping = {
      'ETH': 'ETH',
      'USDC': 'USDC',
      'USDT': 'USDT',
      'MATIC': 'MATIC',
      'BNB': 'BNB',
      'AVAX': 'AVAX',
      'OP': 'OP',
      'ARB': 'ARB'
    };

    return assetMapping[assetSymbol.toUpperCase()] || null;
  }

  /**
   * Get vault account ID for a wallet address
   * This is a simplified mapping - in a real implementation, you'd have
   * a proper mapping between wallet addresses and Fireblocks vault account IDs
   * @param {string} walletAddress - Wallet address
   * @returns {string|null} Vault account ID
   */
  async getVaultAccountId(walletAddress) {
    try {
      // This is a placeholder implementation
      // In a real scenario, you would:
      // 1. Query your database for the mapping
      // 2. Or use Fireblocks API to find the vault account
      // 3. Or maintain a configuration mapping

      logger.warn(`Vault account ID mapping not implemented for address: ${walletAddress}`);
      return 'placeholder_vault_account_id';
    } catch (error) {
      logger.error("Error getting vault account ID:", error);
      return null;
    }
  }
}

module.exports = WalletFactory;
