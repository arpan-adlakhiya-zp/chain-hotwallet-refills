const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const logger = require("./logger")('expressServer');
const { sendErrorResponse } = require("../utils/utils");
const config = require('../config');
const { router } = require("../routes/routes");
const bodyParser = require("body-parser");

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
    this.app.use(cookieParser());
    this.app.use(bodyParser.json())
    this.app.use((req) => {
      if (req.path === "/v2/tx_sign_request") { // body processing for fireblocks cosigner
        req.rawBody = "";
        req.setEncoding("utf8");
        req.on("data", (chunk) => {
          req.rawBody += chunk;
        });
        req.on("end", () => {
          req.next();
        });
      } else {
        req.next();
      }
    }
    );
    this.app.use((err, req, res, next) => {
      logger.error(err);
      sendErrorResponse(res, {
        code: err.status || 500,
        message: err.message,
        stack: JSON.stringify(err.errors),
      });
    });
    // routes API
    this.app.use('/', router)
  }

  launch() {
    http.createServer(this.app).listen(this.port);
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
