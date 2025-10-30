const http = require("http");
const express = require("express");
const cors = require("cors");
const logger = require("./logger")('expressServer');
const { sendErrorResponse } = require("../utils/utils");
const { router } = require("../routes/routes");

class ExpressServer {
  constructor(port) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
    
    // routes API
    this.app.use('/', router);
    
    // Error handler (must be after routes)
    this.app.use((err, req, res, next) => {
      logger.error(err);
      sendErrorResponse(res, {
        code: err.status || 500,
        message: err.message,
        stack: JSON.stringify(err.errors),
      });
    });
  }

  launch() {
    this.server = http.createServer(this.app).listen(this.port);
    logger.info(`Listening on port ${this.port}`);
  }

  async close() {
    if (this.server !== undefined) {
      await this.server.close();
      logger.info(`Server on port ${this.port} shut down`);
    }
  }
}

module.exports = ExpressServer;
