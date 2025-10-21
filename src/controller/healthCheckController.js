const { doHealthCheckService } = require("../service/healthCheckService")

async function doHealthCheckController(req, res, next) {
    const dataFromService = await doHealthCheckService();
    res.send(dataFromService);
}

module.exports = {
    doHealthCheckController
}