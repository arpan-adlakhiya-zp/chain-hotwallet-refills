'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Balance extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Balance.belongsTo(models.Wallet, { foreignKey: 'wallet_id' });
      Balance.belongsTo(models.Asset, { foreignKey: 'asset_id' });
      Balance.belongsTo(models.Blockchain, { foreignKey: 'blockchain_id' });
    }
  };

  Balance.init({
    id: {
      field: 'id',
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
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
    assetId: {
      field: 'asset_id',
      type: DataTypes.INTEGER,
      references: {
        model: {
          tableName: 'assets',
        },
        key: 'id',
      },
      allowNull: false,
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
    balanceAtomicQty: {
      field: 'balance_atomic_qty',
      allowNull: false,
      type: DataTypes.DECIMAL
    },
    refillAmountAtomicQty: {
      field: 'refill_amount_atomic_qty',
      type: DataTypes.DECIMAL
    },
    balanceUsdEquivalent: {
      field: 'balance_usd_equivalent',
      type: DataTypes.DECIMAL
    },
    triggerRefill: {
      field: 'trigger_refill',
      type: DataTypes.STRING(100)
    },
    lastCheckedAt: {
      field: 'last_checked_at',
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    tableName: 'balances',
    timestamps: false, // This table doesn't have created_at/updated_at fields
    indexes: [
      {
        unique: true,
        fields: ['wallet_id', 'asset_id']
      }
    ]
  });

  return Balance;
};
