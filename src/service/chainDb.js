const logger = require('../middleware/logger')('databaseService');
const db = require('../database/models');
const blockchainHelper = require('../database/helpers/blockchain');
const walletHelper = require('../database/helpers/wallet');
const assetHelper = require('../database/helpers/asset');
const balanceHelper = require('../database/helpers/balance');
// Removed refillRequestHelper and alertHelper - these tables are managed by external system

class DatabaseService {
  constructor() {
    this.sequelize = db.sequelize;
    this.isConnected = false;
  }

  async connect() {
    try {
      if (!this.isConnected) {
        await this.sequelize.authenticate();
        this.isConnected = true;
        logger.info('Database connection established successfully');
      }
    } catch (error) {
      logger.error(`Unable to connect to the database: ${error.message}`);
      throw error;
    }
  }

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
  async getBlockchainDetails(blockchainId) {
    try {
      await this.connect();
      return await blockchainHelper.getBlockchainById(blockchainId);
    } catch (error) {
      logger.error(`Error fetching blockchain details: ${error.message}`);
      throw error;
    }
  }

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
  async getWalletDetails(walletId) {
    try {
      await this.connect();
      return await walletHelper.getWalletById(walletId);
    } catch (error) {
      logger.error(`Error fetching wallet details: ${error.message}`);
      throw error;
    }
  }

  async getWalletByAddress(address) {
    try {
      await this.connect();
      return await walletHelper.getWalletByAddress(address);
    } catch (error) {
      logger.error(`Error fetching wallet by address: ${error.message}`);
      throw error;
    }
  }

  async getHotWalletsByBlockchain(blockchainId) {
    try {
      await this.connect();
      return await walletHelper.getHotWalletsByBlockchain(blockchainId);
    } catch (error) {
      logger.error(`Error fetching hot wallets: ${error.message}`);
      throw error;
    }
  }

  async getColdWalletsByBlockchain(blockchainId) {
    try {
      await this.connect();
      return await walletHelper.getColdWalletsByBlockchain(blockchainId);
    } catch (error) {
      logger.error(`Error fetching cold wallets: ${error.message}`);
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

  async getAssetBySymbol(symbol) {
    try {
      await this.connect();
      return await assetHelper.getAssetBySymbol(symbol);
    } catch (error) {
      logger.error(`Error fetching asset by symbol: ${error.message}`);
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

  async getAssetsByBlockchain(blockchainId) {
    try {
      await this.connect();
      return await assetHelper.getAssetsByBlockchain(blockchainId);
    } catch (error) {
      logger.error(`Error fetching assets by blockchain: ${error.message}`);
      throw error;
    }
  }

  // Balance methods
  async getWalletBalance(walletId, assetId) {
    try {
      await this.connect();
      return await balanceHelper.getBalanceByWalletAndAsset(walletId, assetId);
    } catch (error) {
      logger.error(`Error fetching wallet balance: ${error.message}`);
      throw error;
    }
  }

  async getColdWalletBalance(coldWalletId, assetId) {
    try {
      await this.connect();
      return await balanceHelper.getBalanceByWalletAndAsset(coldWalletId, assetId);
    } catch (error) {
      logger.error(`Error fetching cold wallet balance: ${error.message}`);
      throw error;
    }
  }

  async getBalancesByWallet(walletId) {
    try {
      await this.connect();
      return await balanceHelper.getBalancesByWallet(walletId);
    } catch (error) {
      logger.error(`Error fetching balances by wallet: ${error.message}`);
      throw error;
    }
  }

  async getLowBalanceWallets(assetId, threshold) {
    try {
      await this.connect();
      return await balanceHelper.getLowBalanceWallets(assetId, threshold);
    } catch (error) {
      logger.error(`Error fetching low balance wallets: ${error.message}`);
      throw error;
    }
  }

  async createOrUpdateBalance(balanceData) {
    try {
      await this.connect();
      return await balanceHelper.createOrUpdateBalance(balanceData);
    } catch (error) {
      logger.error(`Error creating/updating balance: ${error.message}`);
      throw error;
    }
  }

  // Refill Request methods - REMOVED: These tables are managed by external system

  // Cold wallet lookup method
  async getColdWalletForAsset(assetId, blockchainId) {
    try {
      await this.connect();

      // First get the asset to find the refill_sweep_wallet
      const asset = await assetHelper.getAssetById(assetId);

      if (!asset || !asset.refillSweepWallet) {
        return null;
      }

      const sweepWalletAddress = asset.refillSweepWallet;
      console.log('Sweep Wallet Address:', sweepWalletAddress);

      // Now find the wallet with this address
      const coldWallet = await walletHelper.getWalletByAddress(sweepWalletAddress);

      if (coldWallet &&
        coldWallet.blockchainId === blockchainId &&
        coldWallet.walletType === 'cold' &&
        coldWallet.monitorStatus === 'active') {
        return coldWallet;
      }

      return null;
    } catch (error) {
      logger.error(`Error fetching cold wallet for asset: ${error.message}`);
      throw error;
    }
  }

  // Alert methods - REMOVED: These tables are managed by external system

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