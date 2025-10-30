'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Wallet extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Wallet.belongsTo(models.Blockchain, { foreignKey: 'blockchain_id' });
    }
  };

  Wallet.init({
    id: {
      field: 'id',
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    address: {
      field: 'address',
      allowNull: false,
      type: DataTypes.STRING(255),
      unique: true
    },
    name: {
      field: 'name',
      allowNull: true,
      type: DataTypes.STRING(100)
    },
    description: {
      field: 'description',
      type: DataTypes.TEXT
    },
    walletType: {
      field: 'wallet_type',
      allowNull: false,
      type: DataTypes.STRING(20)
    },
    monitorStatus: {
      field: 'monitor_status',
      allowNull: false,
      type: DataTypes.STRING(20)
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
    tableName: 'wallets',
  });

  return Wallet;
};
