'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('blockchains', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING(100),
        unique: true
      },
      symbol: {
        allowNull: false,
        type: Sequelize.STRING(10),
        unique: true
      },
      chain_id: {
        type: Sequelize.STRING(50)
      },
      explorer_url_tx: {
        type: Sequelize.STRING(255)
      },
      explorer_url_address: {
        type: Sequelize.STRING(255)
      },
      native_asset_symbol: {
        type: Sequelize.STRING(10)
      },
      is_active: {
        allowNull: false,
        defaultValue: true,
        type: Sequelize.BOOLEAN
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE
      },
      created_by: {
        allowNull: false,
        type: Sequelize.STRING(50)
      },
      updated_by: {
        type: Sequelize.STRING(50)
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('blockchains');
  }
};
