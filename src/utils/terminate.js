const logger = require("../middleware/logger")("terminate");

module.exports = function onTerminate(callback){
  const errorTypes = ['unhandledRejection', 'uncaughtException'];
  const signalTraps = ['SIGTERM', 'SIGINT','SIGUSR2'];

  errorTypes.map(type => {
    process.on(type, async (error) => {
      try {
        logger.error(type,error);
        logger.info({shutDownError:{type}});
        await callback();
        process.exit(1)
      } catch (err) {
        process.exit(1)
      }
    })
  })

  signalTraps.map(type => {
    process.once(type, async () => {
      try {
        logger.info({shutDownSignal:{type}});
        await callback();
      } finally {
        process.kill(process.pid, type)
      }
    })
  })
}