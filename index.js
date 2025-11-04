const config = require('./src/config');
const logger = require('./src/middleware/logger')('index');
const ExpressServer = require('./src/middleware/expressServer');
const onTerminate = require('./src/utils/terminate');
const pjson = require('./package.json');
const databaseService = require('./src/service/chainDb');
const transactionMonitor = require('./src/service/transactionMonitorService');

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

    //create the express server
    expressServer = new ExpressServer(config.get('serverPort'));
    expressServer.launch();
    onTerminate(shutDown);
    logger.info('Express server running');

    // Start transaction monitor (polls every 30 seconds)
    transactionMonitor.start(30000);
    logger.info('Transaction monitor started');
  } catch (error) {
    logger.error('Server startup failure', error.message);
    shutDown();
  }
};

launchServer().catch(e => logger.error(e));
