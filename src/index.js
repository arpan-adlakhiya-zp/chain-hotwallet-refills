const config = require('./config');
const logger = require('./middleware/logger')('index');
const ExpressServer = require('./middleware/expressServer');
const onTerminate = require('./utils/terminate');
const pjson = require('../package.json');
const databaseService = require('./service/chainDb');
const transactionMonitor = require('./service/transactionMonitorService');

let expressServer = null;

async function shutDown() {
  // Stop transaction monitor
  transactionMonitor.stop();
  
  await databaseService.disconnect();
  if (expressServer) {
    logger.info("Closing server");
    await expressServer.close();
  }
}

function logStartupMsg() {
  logger.info({
    appStart: {
      version: pjson.version,
      config: config.getAllConfig()
    }
  });
}

const launchServer = async () => {
  try {
    logStartupMsg();

    // Initialize database
    await databaseService.connect();
    logger.info('Database initialized successfully');

    // Launch the express server
    expressServer = new ExpressServer(config.get('serverPort'));
    expressServer.launch();
    onTerminate(shutDown);
    logger.info('Express server running');

    // Start transaction monitor if enabled (polls every 30 seconds)
    const cronEnabled = config.get('cronEnabled');
    if (cronEnabled === true) {
      logger.info('Transaction monitoring cron is ENABLED');

      let cronInterval = 30000;
      if (config.get('cronInterval')) {
        cronInterval = parseInt(config.get('cronInterval'));
      }
      transactionMonitor.start(cronInterval);

      logger.info(`Transaction monitor started with interval of ${cronInterval/1000} seconds`);
    }
  } catch (error) {
    logger.error('Server startup failure', error.message);
    shutDown();
  }
};

launchServer().catch(e => logger.error(e));
