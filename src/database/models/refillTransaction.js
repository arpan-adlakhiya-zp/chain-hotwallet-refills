'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class RefillTransaction extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Define associations here if needed
      // RefillTransaction.belongsTo(models.Wallet, { foreignKey: 'wallet_id' });
      // RefillTransaction.belongsTo(models.Asset, { foreignKey: 'asset_id' });
      // RefillTransaction.belongsTo(models.Blockchain, { foreignKey: 'blockchain_id' });
    }
  }

  RefillTransaction.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    
    // External system reference (used as external_tx_id for idempotency)
    refillRequestId: {
      field: 'refill_request_id',
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'External system request ID (also used as external_tx_id)'
    },
    
    // Provider information
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Provider name: liminal or fireblocks'
    },
    providerTxId: {
      field: 'provider_tx_id',
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Provider internal transaction ID'
    },
    
    // Status tracking
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'PENDING',
      comment: 'Transaction status: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED'
    },
    
    // Transaction details
    amountAtomic: {
      field: 'amount_atomic',
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Amount in atomic units'
    },
    tokenSymbol: {
      field: 'token_symbol',
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Token symbol (e.g., USDC, ETH, BTC)'
    },
    
    // Blockchain transaction hash (for reference only)
    txHash: {
      field: 'tx_hash',
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Blockchain transaction hash'
    },
    
    // Provider-specific data (JSON for flexibility)
    providerData: {
      field: 'provider_data',
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Store full provider response for reference'
    },
    
    // Metadata
    message: {
      field: 'message',
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Any kind of message (error, warning, info, etc.)'
    },
    createdAt: {
      field: 'created_at',
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      field: 'updated_at',
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'RefillTransaction',
    tableName: 'refill_transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_refill_transactions_refill_request_id',
        fields: ['refill_request_id']
      },
      {
        name: 'idx_refill_transactions_provider_tx_id',
        fields: ['provider_tx_id']
      },
      {
        name: 'idx_refill_transactions_status',
        fields: ['status']
      },
      {
        name: 'idx_refill_transactions_token_symbol',
        fields: ['token_symbol']
      },
      {
        name: 'idx_refill_transactions_created_at',
        fields: ['created_at']
      }
    ]
  });

  return RefillTransaction;
};
