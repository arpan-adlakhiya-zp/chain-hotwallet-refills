'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wallets', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      address: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      wallet_type: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      monitor_status: {
        type: Sequelize.STRING(20),
        allowNull: false
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
    await queryInterface.addIndex('wallets', ['address'], {
      name: 'idx_wallets_address',
      unique: true
    });

    await queryInterface.addIndex('wallets', ['blockchain_id'], {
      name: 'idx_wallets_blockchain_id'
    });

    await queryInterface.addIndex('wallets', ['wallet_type'], {
      name: 'idx_wallets_wallet_type'
    });

    await queryInterface.addIndex('wallets', ['monitor_status'], {
      name: 'idx_wallets_monitor_status'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('wallets');
  }
};

