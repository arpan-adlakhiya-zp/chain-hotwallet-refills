'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Blockchain extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Blockchain.hasMany(models.Wallet, { foreignKey: 'blockchain_id' });
      Blockchain.hasMany(models.Asset, { foreignKey: 'blockchain_id' });
    }
  };

  Blockchain.init({
    id: {
      field: 'id',
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    name: {
      field: 'name',
      allowNull: false,
      type: DataTypes.STRING(100),
      unique: true
    },
    symbol: {
      field: 'symbol',
      allowNull: false,
      type: DataTypes.STRING(10),
      unique: true
    },
    chainId: {
      field: 'chain_id',
      type: DataTypes.STRING(50)
    },
    explorerUrlTx: {
      field: 'explorer_url_tx',
      type: DataTypes.STRING(255)
    },
    explorerUrlAddress: {
      field: 'explorer_url_address',
      type: DataTypes.STRING(255)
    },
    nativeAssetSymbol: {
      field: 'native_asset_symbol',
      type: DataTypes.STRING(10)
    },
    isActive: {
      field: 'is_active',
      allowNull: false,
      defaultValue: true,
      type: DataTypes.BOOLEAN
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
    tableName: 'blockchains',
  });

  return Blockchain;
};
