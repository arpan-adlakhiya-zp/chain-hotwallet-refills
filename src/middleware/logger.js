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
    // Use JSON pretty formatting from config
    prettyPrint: logConfig.prettyPrint || true,
    format: logConfig.format || 'json',
    // Add custom formatter for pretty JSON
    formatter: (log) => {
      return JSON.stringify(log, null, 2);
    }
  };

  Logger.setLoggerOptions(logOptions);
  Logger.addAdapter(logConfig.logAdapter, Logger.setAdapter(logConfig.logAdapter));
}

// should be configured once hence in entry point file
configureLogger();

module.exports = function createLogger(moduleName) {
  const logger = new Logger(moduleName);
  
  // Create a wrapper that formats JSON output
  const originalInfo = logger.info.bind(logger);
  const originalDebug = logger.debug.bind(logger);
  const originalError = logger.error.bind(logger);
  
  // Override methods to format JSON output
  logger.info = function(message, meta) {
    const logData = {
      level: 'INFO',
      time: Date.now(),
      pid: process.pid,
      hostname: require('os').hostname(),
      name: 'chain-hotwallet-refills',
      microservice: 'chain-hotwallet-refills',
      zone: 'IN',
      env: 'local',
      meta: moduleName,
      message: message,
      correlationIds: meta || {},
      event: {}
    };
    console.log(JSON.stringify(logData, null, 2));
  };
  
  logger.debug = function(message, meta) {
    const logData = {
      level: 'DEBUG',
      time: Date.now(),
      pid: process.pid,
      hostname: require('os').hostname(),
      name: 'chain-hotwallet-refills',
      microservice: 'chain-hotwallet-refills',
      zone: 'IN',
      env: 'local',
      meta: moduleName,
      message: message,
      correlationIds: meta || {},
      event: {}
    };
    console.log(JSON.stringify(logData, null, 2));
  };
  
  logger.error = function(message, meta) {
    const logData = {
      level: 'ERROR',
      time: Date.now(),
      pid: process.pid,
      hostname: require('os').hostname(),
      name: 'chain-hotwallet-refills',
      microservice: 'chain-hotwallet-refills',
      zone: 'IN',
      env: 'local',
      meta: moduleName,
      message: message,
      correlationIds: meta || {},
      event: {},
      error: {
        name: 'Error',
        reason: '[]',
        stack: {}
      }
    };
    console.log(JSON.stringify(logData, null, 2));
  };
  
  return logger;
};