'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Asset extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Asset.belongsTo(models.Blockchain, { foreignKey: 'blockchain_id' });
      Asset.belongsTo(models.Wallet, { foreignKey: 'wallet_id' });
    }
  };

  Asset.init({
    id: {
      field: 'id',
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    symbol: {
      field: 'symbol',
      allowNull: false,
      type: DataTypes.STRING(20),
      unique: true
    },
    name: {
      field: 'name',
      allowNull: false,
      type: DataTypes.STRING(100)
    },
    contractAddress: {
      field: 'contract_address',
      type: DataTypes.STRING(255),
      unique: true
    },
    decimals: {
      field: 'decimals',
      allowNull: false,
      type: DataTypes.SMALLINT
    },
    assetType: {
      field: 'asset_type',
      allowNull: false,
      type: DataTypes.STRING(20)
    },
    monitorBalance: {
      field: 'monitor_balance',
      allowNull: false,
      type: DataTypes.BOOLEAN
    },
    monitorTransactions: {
      field: 'monitor_transactions',
      allowNull: false,
      type: DataTypes.BOOLEAN
    },
    lowBalanceThresholdAtomic: {
      field: 'low_balance_threshold_atomic',
      type: DataTypes.BIGINT
    },
    refillTriggerThresholdAtomic: {
      field: 'refill_trigger_threshold_atomic',
      type: DataTypes.BIGINT
    },
    refillTargetBalanceAtomic: {
      field: 'refill_target_balance_atomic',
      type: DataTypes.BIGINT
    },
    highWithdrawalThresholdAtomic: {
      field: 'high_withdrawal_threshold_atomic',
      type: DataTypes.BIGINT
    },
    refillDustThresholdAtomic: {
      field: 'refill_dust_threshold_atomic',
      type: DataTypes.BIGINT
    },
    refillCooldownPeriod: {
      field: 'refill_cooldown_period',
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Cooldown period in seconds between successful refills'
    },
    isActive: {
      field: 'is_active',
      allowNull: false,
      type: DataTypes.BOOLEAN
    },
    walletId: {
      field: 'wallet_id',
      type: DataTypes.INTEGER,
      references: {
        model: {
          tableName: 'wallets',
        },
        key: 'id',
      },
      allowNull: false,
    },
    refillSweepWallet: {
      field: 'refill_sweep_wallet',
      type: DataTypes.STRING(255)
    },
    sweepWalletConfig: {
      field: 'sweep_wallet_config',
      type: DataTypes.JSON
    },
    hotWalletConfig: {
      field: 'hot_wallet_config',
      type: DataTypes.JSON
    },
    blockchainId: {
      field: 'blockchain_id',
      type: DataTypes.INTEGER,
      references: {
        model: {
          tableName: 'blockchains',
        },
        key: 'id',
      },
      allowNull: false,
    },
    createdAt: {
      field: 'created_at',
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      field: 'updated_at',
      type: DataTypes.DATE
    }
  }, {
    sequelize,
    tableName: 'assets',
  });

  return Asset;
};
