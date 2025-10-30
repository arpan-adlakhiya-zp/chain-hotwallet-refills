'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('refill_transactions', 'asset_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Foreign key to assets table - provides complete asset context',
      references: {
        model: 'assets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add index for better query performance
    await queryInterface.addIndex('refill_transactions', ['asset_id'], {
      name: 'idx_refill_transactions_asset_id'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('refill_transactions', 'idx_refill_transactions_asset_id');
    
    // Remove column
    await queryInterface.removeColumn('refill_transactions', 'asset_id');
  }
};
