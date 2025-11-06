const refillService = require("../service/refillService");
const refillTransactionService = require("../service/refillTransactionService");
const logger = require("../middleware/logger")("refillController");
const config = require("../config");

async function processRefillRequestController(req, res, next) {
  try {
    const requestData = req.verifiedData;

    const result = await refillService.processRefillRequestService(requestData);

    if (result.success) {
      res.status(200).json(result);
    } else {
      // Return 409 Conflict for in-progress refills
      if (result.code === 'REFILL_IN_PROGRESS') {
        res.status(409).json(result);
      } else {
        res.status(400).json(result);
      }
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
    const { refill_request_id } = req.verifiedData;

    if (!refill_request_id) {
      logger.error('refill_request_id is missing in JWT');
      return res.status(400).json({
        success: false,
        error: 'refill_request_id is required in JWT',
        code: 'MISSING_PARAMETER',
        data: null
      });
    }

    if (config.get('authEnabled')) {
      // Verify whether the refill request ID in JWT token matches the value in URL parameter
      if (refill_request_id !== req.params.refill_request_id) {
        logger.error(`Refill request ID mismatch in JWT and URL parameter: ${refill_request_id} !== ${req.params.refill_request_id}`);
        return res.status(400).json({
          success: false,
          error: 'Refill request ID mismatch in JWT and URL parameter',
          code: 'REFILL_REQUEST_ID_MISMATCH',
          data: {
            requestIdInJwt: refill_request_id,
            requestIdInUrl: req.params.refill_request_id
          }
        });
      }
    }

    logger.info(`Checking transaction status for refill request: ${refill_request_id}`);

    // Get status from DB only (cron updates from provider in background)
    const result = await refillTransactionService.getTransactionStatusFromDB(refill_request_id);

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
