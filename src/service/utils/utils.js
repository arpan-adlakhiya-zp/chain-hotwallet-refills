const logger = require("../../middleware/logger")("refillUtils");
const config = require("../../config");

class RefillUtils {
  /**
   * Get Liminal environment from config
   * @returns {string} Environment (dev/prod) or 'dev' as default
   */
  getLiminalConfig() {
    try {
      const liminalConfig = config.get('providers.liminal');
      if (liminalConfig && liminalConfig.env) {
        logger.info(`Found Liminal environment from providers config: ${liminalConfig.env}`);
        return liminalConfig.env;
      }
      
      logger.debug('No Liminal environment found in config, using default: dev');
      return 'dev';
    } catch (error) {
      logger.error(`Error getting Liminal environment from config: ${error.message}`);
      return 'dev';
    }
  }

  /**
   * Get Fireblocks API URL from config
   * @returns {string} API URL or default Fireblocks URL
   */
  getFireblocksConfig() {
    try {
      const fireblocksConfig = config.get('providers.fireblocks');
      if (fireblocksConfig && fireblocksConfig.apiBaseUrl) {
        logger.info(`Found Fireblocks API URL from providers config: ${fireblocksConfig.apiBaseUrl}`);
        return fireblocksConfig.apiBaseUrl;
      }
      
      logger.debug('No Fireblocks API URL found in config, using default: https://api.fireblocks.io');
      return 'https://api.fireblocks.io';
    } catch (error) {
      logger.error(`Error getting Fireblocks API URL from config: ${error.message}`);
      return 'https://api.fireblocks.io';
    }
  }

  /**
   * Get cold wallet ID based on provider
   * @param {Object} validatedData - Validated refill data
   * @param {Object} provider - Provider instance
   * @returns {string} Cold wallet ID
   */
  getColdWalletId(validatedData, provider) {
    const providerName = provider.constructor.getProviderName();
    
    if (providerName === 'liminal') {
      return validatedData.asset.sweepWalletConfig.liminal.walletId;
    } else if (providerName === 'fireblocks') {
      return validatedData.asset.sweepWalletConfig.fireblocks.vaultId;
    } else {
      // For other providers, try to get from sweepWalletConfig
      const sweepConfig = validatedData.asset.sweepWalletConfig;
      return sweepConfig[providerName]?.walletId || sweepConfig[providerName]?.vaultId;
    }
  }

  /**
   * Get hot wallet ID based on provider
   * @param {Object} validatedData - Validated refill data
   * @param {Object} provider - Provider instance
   * @returns {string} Hot wallet ID
   */
  getHotWalletId(validatedData, provider) {
    const providerName = provider.constructor.getProviderName();
    
    if (providerName === 'liminal') {
      return validatedData.wallet.address; // Liminal uses wallet address
    } else if (providerName === 'fireblocks') {
      return validatedData.asset.hotWalletConfig.fireblocks.vaultId;
    } else {
      // For other providers, try to get from hotWalletConfig
      const hotWalletConfig = validatedData.asset.hotWalletConfig;
      return hotWalletConfig[providerName]?.vaultId || hotWalletConfig[providerName]?.walletId;
    }
  }

  /**
   * Get wallet configuration object based on provider and wallet configuration
   * @param {string} providerName - Provider name
   * @param {Object} walletConfig - Provider specific wallet configuration
   * @returns {Object}
   *   - success {boolean}: true if the wallet configuration is valid, false otherwise.
   *   - error {string}: the error message if the wallet configuration is not valid.
   *   - code {string}: the error code if the wallet configuration is not valid.
   *   - data {Object}: the wallet configuration object if the wallet configuration is valid.
   */
  getWalletConfig(providerName, walletConfig) {
    if (providerName === 'liminal') {
      if (!walletConfig.liminal || !walletConfig.liminal.walletId || !walletConfig.liminal.tokenSymbol || !walletConfig.liminal.version) {
        return {
          success: false,
          error: 'Invalid cold wallet configuration found for this asset',
          code: 'INVALID_LIMINAL_COLD_WALLET_CONFIGURATION',
          data: null
        };
      }
      
      return {
        success: true,
        error: null,
        code: null,
        data: {
          walletConfig: {
            liminal: {
              walletId: walletConfig.liminal.walletId,
              version: walletConfig.liminal.version,
              tokenSymbol: walletConfig.liminal.tokenSymbol
            }
          }
        }
      };
    } else if (providerName === 'fireblocks') {
      if (!walletConfig.fireblocks || !walletConfig.fireblocks.vaultId || !walletConfig.fireblocks.assetId) {
        return {
          success: false,
          error: 'Invalid cold wallet configuration found for this asset',
          code: 'INVALID_FIREBLOCKS_COLD_WALLET_CONFIGURATION',
          data: null
        };
      }
      
      return {
        success: true,
        error: null,
        code: null,
        data: {
          walletConfig: {
            fireblocks: {
              vaultId: walletConfig.fireblocks.vaultId,
              assetId: walletConfig.fireblocks.assetId
            }
          }
        }
      };
    } else {
      return {
        success: false,
        error: `Unsupported provider: ${providerName}`,
        code: 'UNSUPPORTED_PROVIDER',
        data: null
      };
    }
  }

  /**
   * Build update data by comparing provider response with current DB transaction
   * Only returns fields that have actually changed
   * @param {Object} dbTransaction - Current transaction from database
   * @param {Object} providerDetails - Details extracted from provider response
   * @param {string} mappedStatus - Internal status (mapped from provider status)
   * @returns {Object} { updateData, hasChanges } - Fields to update and whether any changed
   */
  buildTransactionUpdateData(dbTransaction, providerDetails, mappedStatus) {
    const updateData = {};
    let hasChanges = false;

    // Check if mapped status changed
    if (mappedStatus !== dbTransaction.status) {
      updateData.status = mappedStatus;
      hasChanges = true;
      logger.info(`Status updated: ${dbTransaction.status} → ${mappedStatus}`);
    }

    // Check if raw provider status changed
    if (providerDetails.status && providerDetails.status !== dbTransaction.providerStatus) {
      updateData.providerStatus = providerDetails.status;
      updateData.providerData = providerDetails.providerData; // Include full response
      hasChanges = true;
      logger.info(`Provider status updated: ${dbTransaction.providerStatus} → ${providerDetails.status}`);
    }

    // Check if txHash added
    if (providerDetails.txHash && providerDetails.txHash !== dbTransaction.txHash) {
      updateData.txHash = providerDetails.txHash;
      hasChanges = true;
      logger.info(`TxHash: ${providerDetails.txHash}`);
    }

    // Check if message changed
    if (providerDetails.message && providerDetails.message !== dbTransaction.message) {
      updateData.message = providerDetails.message;
      hasChanges = true;
      logger.info(`Message updated: ${dbTransaction.message} → ${providerDetails.message}`);
    }

    return { updateData, hasChanges };
  }
}

module.exports = new RefillUtils();
