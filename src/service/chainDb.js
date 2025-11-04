const logger = require('../middleware/logger')('databaseService');
const db = require('../database/models');
const blockchainHelper = require('../database/helpers/blockchain');
const walletHelper = require('../database/helpers/wallet');
const assetHelper = require('../database/helpers/asset');
const refillTransactionHelper = require('../database/helpers/refillTransaction');
// Removed balanceHelper - balances are fetched on-chain via providers, not stored in DB
// Removed refillRequestHelper and alertHelper - these tables are managed by external system

class DatabaseService {
  constructor() {
    this.sequelize = db.sequelize;
    this.isConnected = false;
  }

  /**
   * Connect to database and authenticate
   */
  async connect() {
    try {
      if (!this.isConnected) {
        logger.info('Initializing database connection...');
        await this.sequelize.authenticate();
        this.isConnected = true;
        logger.info('Database connection established successfully');
      }
    } catch (error) {
      logger.error(`Unable to connect to the database: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    try {
      if (this.isConnected) {
        await this.sequelize.close();
        this.isConnected = false;
        logger.info('Database connection closed');
      }
    } catch (error) {
      logger.error(`Error closing database connection: ${error.message}`);
      throw error;
    }
  }

  // Blockchain methods
  async getBlockchainByName(blockchainName) {
    try {
      await this.connect();
      return await blockchainHelper.getBlockchainByName(blockchainName);
    } catch (error) {
      logger.error(`Error fetching blockchain by name: ${error.message}`);
      throw error;
    }
  }

  // Wallet methods
  async getWalletByAddress(address) {
    try {
      await this.connect();
      return await walletHelper.getWalletByAddress(address);
    } catch (error) {
      logger.error(`Error fetching wallet by address: ${error.message}`);
      throw error;
    }
  }

  // Asset methods
  async getAssetDetails(assetId) {
    try {
      await this.connect();
      return await assetHelper.getAssetById(assetId);
    } catch (error) {
      logger.error(`Error fetching asset details: ${error.message}`);
      throw error;
    }
  }

  async getAssetBySymbolAndBlockchain(symbol, blockchainId) {
    try {
      await this.connect();
      return await assetHelper.getAssetBySymbolAndBlockchain(symbol, blockchainId);
    } catch (error) {
      logger.error(`Error fetching asset by symbol and blockchain: ${error.message}`);
      throw error;
    }
  }

  // Refill Transaction methods
  async createRefillTransaction(transactionData) {
    try {
      await this.connect();
      return await refillTransactionHelper.createRefillTransaction(transactionData);
    } catch (error) {
      logger.error(`Error creating refill transaction: ${error.message}`);
      throw error;
    }
  }

  async updateRefillTransaction(refillRequestId, updateData) {
    try {
      await this.connect();
      return await refillTransactionHelper.updateRefillTransaction(refillRequestId, updateData);
    } catch (error) {
      logger.error(`Error updating refill transaction: ${error.message}`);
      throw error;
    }
  }

  async getRefillTransactionByRequestId(refillRequestId) {
    try {
      await this.connect();
      return await refillTransactionHelper.getRefillTransactionByRequestId(refillRequestId);
    } catch (error) {
      logger.error(`Error getting refill transaction: ${error.message}`);
      throw error;
    }
  }

  async getPendingTransactionByAssetId(assetId) {
    try {
      await this.connect();
      return await refillTransactionHelper.getPendingTransactionByAssetId(assetId);
    } catch (error) {
      logger.error(`Error getting pending transaction by asset: ${error.message}`);
      throw error;
    }
  }

  async getTransactionsByStatus(status, limit = 100) {
    try {
      await this.connect();
      return await refillTransactionHelper.getTransactionsByStatus(status, limit);
    } catch (error) {
      logger.error(`Error getting transactions by status: ${error.message}`);
      throw error;
    }
  }

  // Health check method
  async healthCheck() {
    try {
      await this.connect();
      await this.sequelize.query('SELECT 1');
      return { status: 'healthy', message: 'Database connection is active' };
    } catch (error) {
      logger.error(`Database health check failed: ${error.message}`);
      return { status: 'unhealthy', message: error.message };
    }
  }
}

module.exports = new DatabaseService();