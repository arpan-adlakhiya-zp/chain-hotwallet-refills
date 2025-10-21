const logger = require('../middleware/logger')('database-init');
const db = require('./models');

class DatabaseInitializer {
  constructor() {
    this.sequelize = db.sequelize;
  }

  async initialize() {
    try {
      logger.info('Initializing database connection...');

      // Test the connection
      await this.sequelize.authenticate();
      logger.info('Database connection established successfully');

      // Sync models (create tables if they don't exist)
      // Note: In production, use migrations instead of sync
      if (process.env.NODE_ENV !== 'production') {
        await this.sequelize.sync({ alter: true });
        logger.info('Database models synchronized');
      }

      return true;
    } catch (error) {
      logger.error(`Database initialization failed: ${error.message}`);
      throw error;
    }
  }

  async close() {
    try {
      await this.sequelize.close();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error(`Error closing database connection: ${error.message}`);
      throw error;
    }
  }

  async healthCheck() {
    try {
      await this.sequelize.query('SELECT 1');
      return { status: 'healthy', message: 'Database connection is active' };
    } catch (error) {
      logger.error(`Database health check failed: ${error.message}`);
      return { status: 'unhealthy', message: error.message };
    }
  }
}

module.exports = new DatabaseInitializer();
