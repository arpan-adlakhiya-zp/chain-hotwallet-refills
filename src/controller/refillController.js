const refillService = require("../service/refillService");
const refillTransactionService = require("../service/refillTransactionService");
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
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      data: { details: e.message }
    });
  }
}

async function checkTransactionStatusController(req, res, next) {
  try {
    const { refill_request_id } = req.params;

    if (!refill_request_id) {
      return res.status(400).json({
        success: false,
        error: 'refill_request_id is required',
        code: 'MISSING_PARAMETER',
        data: null
      });
    }

    logger.info(`Checking transaction status for refill request: ${refill_request_id}`);

    const result = await refillTransactionService.checkTransactionStatus(refill_request_id);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (e) {
    logger.error(`Error checking transaction status: ${e.message}`);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      data: { details: e.message }
    });
  }
}

module.exports = {
  processRefillRequestController,
  checkTransactionStatusController
};
