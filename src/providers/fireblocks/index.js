const AbstractProvider = require('../abstractProvider');
const WalletFactory = require('./walletFactory');
const BigNumber = require('bignumber.js');
const logger = require('../../middleware/logger')('fireblocks');

/**
 * Fireblocks Provider Implementation
 * Implements the AbstractProvider interface for Fireblocks API integration
 */
class FireblocksProvider extends AbstractProvider {
  constructor(config, secret) {
    super(config, secret);
    this.walletFactory = new WalletFactory();
    this.supportedBlockchains = config.supportedBlockchains || [1, 137, 56, 43114, 10, 42161]; // Ethereum, Polygon, BSC, Avalanche, Optimism, Arbitrum
    this.supportedAssets = config.supportedAssets || ['ETH', 'USDC', 'USDT', 'MATIC', 'BNB', 'AVAX', 'OP', 'ARB'];
  }

  static getProviderName() {
    return 'fireblocks';
  }

  static getConfigSchema() {
    return {
      type: 'object',
      properties: {
        baseUrl: {
          type: 'string',
          default: 'https://api.fireblocks.io'
        },
        timeout: {
          type: 'number',
          default: 30000
        },
        supportedBlockchains: {
          type: 'array',
          items: { type: 'number' },
          default: [1, 137, 56, 43114, 10, 42161]
        },
        supportedAssets: {
          type: 'array',
          items: { type: 'string' },
          default: ['ETH', 'USDC', 'USDT', 'MATIC', 'BNB', 'AVAX', 'OP', 'ARB']
        }
      },
      required: ['apiKey', 'privateKey']
    };
  }

  async init() {
    try {
      if (!this.secret.apiKey || !this.secret.privateKey) {
        throw new Error('Fireblocks API credentials not configured properly');
      }

      // Initialize wallet factory
      await this.walletFactory.init(
        this.secret.privateKey,
        this.secret.apiKey,
        this.config.baseUrl || 'https://api.fireblocks.io'
      );

      logger.info('Fireblocks provider initialized successfully');
      return { success: true };
    } catch (error) {
      logger.error(`Failed to initialize Fireblocks provider: ${error.message}`);
      throw error;
    }
  }

  supportsBlockchain(blockchainId) {
    return this.supportedBlockchains.includes(blockchainId);
  }

  supportsAsset(assetSymbol, blockchainId) {
    return this.supportedAssets.includes(assetSymbol.toUpperCase()) &&
      this.supportsBlockchain(blockchainId);
  }

  async createTransaction(txns, token) {
    try {
      logger.info(`Creating transaction with Fireblocks for ${txns.length} transactions`);

      // Check if provider supports this blockchain and asset
      if (!this.supportsBlockchain(token.blockchainId)) {
        throw new Error(`Fireblocks does not support blockchain ID: ${token.blockchainId}`);
      }

      if (!this.supportsAsset(token.symbol, token.blockchainId)) {
        throw new Error(`Fireblocks does not support asset: ${token.symbol} on blockchain: ${token.blockchainId}`);
      }

      // Map blockchain ID to Fireblocks asset ID
      const fireblocksAssetId = this.walletFactory.mapToFireblocksAssetId(token.symbol, token.blockchainId);
      if (!fireblocksAssetId) {
        throw new Error(`Unable to map asset ${token.symbol} on blockchain ${token.blockchainId} to Fireblocks asset ID`);
      }

      // Get vault account ID for the source wallet
      const sourceVaultAccountId = await this.walletFactory.getVaultAccountId(token.hotWalletConfig.fireblocksConfig.vaultId);
      if (!sourceVaultAccountId) {
        throw new Error(`No Fireblocks vault account found for vault ID: ${token.hotWalletConfig.fireblocksConfig.vaultId}`);
      }

      // Prepare transaction data
      const transactionData = {
        assetId: fireblocksAssetId,
        amount: new BigNumber(txns[0].amount).dividedBy(new BigNumber(10 ** token.decimalPlaces)).toNumber(),
        source: {
          type: 'VAULT_ACCOUNT',
          id: sourceVaultAccountId
        },
        destination: {
          type: 'ONE_TIME_ADDRESS',
          oneTimeAddress: {
            address: txns[0].sendAddress
          }
        },
        note: `Hot wallet refill - Request ID: ${txns[0].dbId}`,
        externalTxId: `refill_${txns[0].dbId}_${Date.now()}`
      };

      logger.info(`Sending transaction request to Fireblocks:`, {
        from: sourceVaultAccountId,
        to: txns[0].sendAddress,
        amount: transactionData.amount,
        asset: token.symbol,
        fireblocksAssetId: fireblocksAssetId
      });

      const result = await this.walletFactory.createTransaction(transactionData);

      logger.info(`Transaction created successfully with Fireblocks`);
      return { rawTx: result, serializedTx: JSON.stringify(result) };

    } catch (error) {
      logger.error(`Error creating transaction with Fireblocks: ${error.message}`);
      throw error;
    }
  }

  async getTransactionStatus(batchId, token) {
    try {
      logger.info(`Getting transaction status from Fireblocks: ${batchId}`);

      const externalId = `${batchId}_${token.symbol}`;
      const result = await this.walletFactory.getTransactionByExternalTxId(externalId);
      return result;

    } catch (error) {
      logger.error(`Error getting transaction status from Fireblocks: ${error.message}`);
      throw error;
    }
  }

  async getTokenBalance(token) {
    try {
      logger.info(`Getting token balance for: ${token.symbol}`);

      const assetId = token.hotWalletConfig.fireblocksConfig.assetId;
      const vaultId = token.hotWalletConfig.fireblocksConfig.vaultId;
      const balance = await this.walletFactory.getTokenBalance(vaultId, assetId);
      const balanceInAtomic = new BigNumber(balance).multipliedBy(new BigNumber(10 ** token.decimalPlaces));
      return balanceInAtomic.toString();

    } catch (error) {
      logger.error(`Error getting token balance from Fireblocks: ${error.message}`);
      throw error;
    }
  }

  async validateCredentials() {
    try {
      logger.info('Validating Fireblocks API credentials');

      const result = await this.walletFactory.validateCredentials();
      return result;

    } catch (error) {
      logger.error(`Error validating Fireblocks credentials: ${error.message}`);
      return {
        success: false,
        error: 'Failed to validate credentials',
        code: 'CREDENTIAL_VALIDATION_ERROR',
        details: error.message
      };
    }
  }
}

module.exports = FireblocksProvider;
