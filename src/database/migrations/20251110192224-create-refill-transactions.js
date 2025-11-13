'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('refill_transactions', {
      refill_request_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        primaryKey: true,
        comment: 'External system request ID (also used as external_tx_id) - Primary key for idempotency'
      },
      provider: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Provider name: liminal or fireblocks'
      },
      provider_tx_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Provider internal transaction ID'
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'PENDING',
        comment: 'Transaction status: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED'
      },
      asset_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'assets',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Foreign key to assets table - provides complete asset context'
      },
      amount_atomic: {
        type: Sequelize.DECIMAL(40, 0),
        allowNull: false,
        comment: 'Amount in atomic units'
      },
      amount: {
        type: Sequelize.DECIMAL(38, 18),
        allowNull: true,
        comment: 'Amount in human-readable format (not atomic units)'
      },
      token_symbol: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Token symbol (e.g., USDC, ETH, BTC)'
      },
      chain_name: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Blockchain name for easy identification'
      },
      provider_status: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Raw status from provider (before mapping to internal status)'
      },
      tx_hash: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Blockchain transaction hash'
      },
      provider_data: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Store full provider response for reference'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Any kind of message (error, warning, info, etc.)'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('refill_transactions', ['provider_tx_id'], {
      name: 'idx_refill_transactions_provider_tx_id'
    });

    await queryInterface.addIndex('refill_transactions', ['status'], {
      name: 'idx_refill_transactions_status'
    });

    await queryInterface.addIndex('refill_transactions', ['token_symbol'], {
      name: 'idx_refill_transactions_token_symbol'
    });

    await queryInterface.addIndex('refill_transactions', ['created_at'], {
      name: 'idx_refill_transactions_created_at'
    });

    await queryInterface.addIndex('refill_transactions', ['asset_id'], {
      name: 'idx_refill_transactions_asset_id'
    });

    // Composite index for pending transaction queries
    await queryInterface.addIndex('refill_transactions', ['asset_id', 'status'], {
      name: 'idx_refill_transactions_asset_status'
    });

    // Composite index for status-based queries (used by transaction monitor)
    await queryInterface.addIndex('refill_transactions', ['status', 'created_at'], {
      name: 'idx_refill_transactions_status_created_at'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('refill_transactions');
  }
};

