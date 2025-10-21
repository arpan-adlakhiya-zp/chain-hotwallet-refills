// Entry Point of your Microservice
// server.js
const { Logger } = require('@zebpay/colt');
const config = require('../config');

//...other initialization code
function configureLogger() {
  // Get log config from the new simplified config structure
  const logConfig = config.get('logConfig');
  
  if (!logConfig) {
    console.error('Log configuration not found in config file');
    process.exit(1);
  }
  
  const logOptions = {
    level: logConfig.logLevel,
    logPath: logConfig.logPath,
    logFile: logConfig.logFile,
  };

  Logger.setLoggerOptions(logOptions);
  Logger.addAdapter(logConfig.logAdapter, Logger.setAdapter(logConfig.logAdapter));
}

// should be configured once hence in entry point file
configureLogger();

module.exports = function createLogger(moduleName) {
  return new Logger(moduleName);
};