const refillService = require("../service/refillService");
const logger = require("../middleware/logger")("refillController");

async function processRefillRequestController(req, res, next) {
    try {
        logger.info(`Processing refill request for wallet: ${req.body?.wallet_address}`);
        
        const result = await refillService.processRefillRequestService(req.body);
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (e) {
        logger.error(`Error processing refill request: ${e.message}`);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: e.message
        });
    }
}

module.exports = {
    processRefillRequestController
};
