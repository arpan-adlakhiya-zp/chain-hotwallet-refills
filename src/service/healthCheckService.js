const databaseService = require('./chainDb');

async function doHealthCheckService() {
  try {
    // Check database health
    const dbHealth = await databaseService.healthCheck();
    
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