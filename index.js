const config = require('./src/config');
const logger = require('./src/middleware/logger')('index');
const ExpressServer = require('./src/middleware/expressServer');
const onTerminate = require('./src/utils/terminate');
const pjson = require('./package.json');
const databaseInitializer = require('./src/database/init');

let expressServer = null;

async function shutDown() {
  await databaseInitializer.close();
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
    await databaseInitializer.initialize();
    logger.info('Database initialized successfully');

    //create the express server
    expressServer = new ExpressServer(config.get('serverPort'));
    expressServer.launch();
    onTerminate(shutDown);
    logger.info('Express server running');
  } catch (error) {
    logger.error('Server startup failure', error.message);
    shutDown();
  }
};

launchServer().catch(e => logger.error(e));
