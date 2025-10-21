'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('assets', 'wallet_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'wallets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('assets', 'wallet_id');
  }
};
