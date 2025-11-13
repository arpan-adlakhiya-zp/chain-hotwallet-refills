const databaseService = require('./chainDb');
const logger = require('../middleware/logger')('healthCheckService');

async function doHealthCheckService() {
  try {
    // Check database health
    const dbHealth = await databaseService.healthCheck();

    logger.info(`Health check successful`);
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth.status,
        api: 'healthy'
      },
      version: require('../../package.json').version
    };
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: 'unhealthy',
        api: 'healthy'
      }
    };
  }
}

module.exports = {
  doHealthCheckService
}