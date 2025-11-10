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
      // Define associations - assetId provides access to wallet and blockchain
      RefillTransaction.belongsTo(models.Asset, { foreignKey: 'asset_id', as: 'Asset' });
    }
  }

  RefillTransaction.init({
    // External system reference (used as external_tx_id for idempotency)
    // Primary key to ensure only one record per refill request ID
    refillRequestId: {
      field: 'refill_request_id',
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: true,
      comment: 'External system request ID (also used as external_tx_id) - Primary key for idempotency'
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
    
    // Foreign key to asset (provides access to wallet, blockchain, and all asset details)
    assetId: {
      field: 'asset_id',
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'assets',
        key: 'id'
      },
      comment: 'Foreign key to assets table - provides complete asset context'
    },
    
    // Transaction details
    amountAtomic: {
      field: 'amount_atomic',
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Amount in atomic units'
    },
    amount: {
      field: 'amount',
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Amount in human-readable format (not atomic units)'
    },
    tokenSymbol: {
      field: 'token_symbol',
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Token symbol (e.g., USDC, ETH, BTC)'
    },
    chainName: {
      field: 'chain_name',
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Blockchain name for easy identification'
    },
    providerStatus: {
      field: 'provider_status',
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Raw status from provider (before mapping to internal status)'
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
      // Note: refill_request_id is the primary key, so it already has an index
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
