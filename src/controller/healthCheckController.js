const { doHealthCheckService } = require("../service/healthCheckService")

async function doHealthCheckController(req, res, next) {
    try {
        const dataFromService = await doHealthCheckService();
        res.status(200).json(dataFromService);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
}

module.exports = {
    doHealthCheckController
}