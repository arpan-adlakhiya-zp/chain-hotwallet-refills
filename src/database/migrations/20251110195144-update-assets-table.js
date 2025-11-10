'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add individual unique constraint on symbol
    await queryInterface.addIndex('assets', ['symbol'], {
      name: 'idx_assets_symbol',
      unique: true
    });

    await queryInterface.addIndex('assets', ['contract_address'], {
      name: 'idx_assets_contract_address',
      unique: true
    });

    // Add refill_cooldown_period column if it doesn't exist
    const tableDescription = await queryInterface.describeTable('assets');
    if (!tableDescription.refill_cooldown_period) {
      await queryInterface.addColumn('assets', 'refill_cooldown_period', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cooldown period in seconds between successful refills'
      });
    }

    // Add sweep_wallet_config column if it doesn't exist
    if (!tableDescription.sweep_wallet_config) {
      await queryInterface.addColumn('assets', 'sweep_wallet_config', {
        type: Sequelize.JSON,
        allowNull: true
      });
    }

    // Add hot_wallet_config column if it doesn't exist
    if (!tableDescription.hot_wallet_config) {
      await queryInterface.addColumn('assets', 'hot_wallet_config', {
        type: Sequelize.JSON,
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove new columns
    try {
      await queryInterface.removeColumn('assets', 'refill_cooldown_period');
    } catch (error) {
      console.log('Note: refill_cooldown_period column may not exist');
    }

    try {
      await queryInterface.removeColumn('assets', 'sweep_wallet_config');
    } catch (error) {
      console.log('Note: sweep_wallet_config column may not exist');
    }

    try {
      await queryInterface.removeColumn('assets', 'hot_wallet_config');
    } catch (error) {
      console.log('Note: hot_wallet_config column may not exist');
    }

    // Remove individual unique constraints
    try {
      await queryInterface.removeIndex('assets', 'idx_assets_symbol');
    } catch (error) {
      console.log('Note: idx_assets_symbol index may not exist');
    }

    try {
      await queryInterface.removeIndex('assets', 'idx_assets_contract_address');
    } catch (error) {
      console.log('Note: idx_assets_contract_address index may not exist');
    }
  }
};

