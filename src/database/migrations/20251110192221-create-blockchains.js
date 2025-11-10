'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('blockchains', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      symbol: {
        type: Sequelize.STRING(10),
        allowNull: false,
        unique: true
      },
      chain_id: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      explorer_url_tx: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      explorer_url_address: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      native_asset_symbol: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
    await queryInterface.addIndex('blockchains', ['name'], {
      name: 'idx_blockchains_name',
      unique: true
    });

    await queryInterface.addIndex('blockchains', ['symbol'], {
      name: 'idx_blockchains_symbol',
      unique: true
    });

    await queryInterface.addIndex('blockchains', ['is_active'], {
      name: 'idx_blockchains_is_active'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('blockchains');
  }
};

