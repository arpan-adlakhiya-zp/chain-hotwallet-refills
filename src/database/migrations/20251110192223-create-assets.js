'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('assets', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      symbol: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      contract_address: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      },
      decimals: {
        type: Sequelize.SMALLINT,
        allowNull: false
      },
      asset_type: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      monitor_balance: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      monitor_transactions: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      low_balance_threshold_atomic: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      refill_trigger_threshold_atomic: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      refill_target_balance_atomic: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      high_withdrawal_threshold_atomic: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      refill_dust_threshold_atomic: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      refill_cooldown_period: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cooldown period in seconds between successful refills'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      wallet_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'wallets',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      refill_sweep_wallet: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      sweep_wallet_config: {
        type: Sequelize.JSON,
        allowNull: true
      },
      hot_wallet_config: {
        type: Sequelize.JSON,
        allowNull: true
      },
      blockchain_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'blockchains',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: true,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('assets', ['symbol'], {
      name: 'idx_assets_symbol',
      unique: true
    });

    await queryInterface.addIndex('assets', ['contract_address'], {
      name: 'idx_assets_contract_address',
      unique: true
    });

    await queryInterface.addIndex('assets', ['blockchain_id'], {
      name: 'idx_assets_blockchain_id'
    });

    await queryInterface.addIndex('assets', ['wallet_id'], {
      name: 'idx_assets_wallet_id'
    });

    await queryInterface.addIndex('assets', ['is_active'], {
      name: 'idx_assets_is_active'
    });

    // Composite index for asset lookup by symbol and blockchain
    await queryInterface.addIndex('assets', ['symbol', 'blockchain_id', 'is_active'], {
      name: 'idx_assets_symbol_blockchain_active'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('assets');
  }
};

