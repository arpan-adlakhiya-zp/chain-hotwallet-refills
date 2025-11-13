const refillService = require("../service/refillService");
const refillTransactionService = require("../service/refillTransactionService");
const logger = require("../middleware/logger")("refillController");
const config = require("../config");
const signingUtil = require("../service/utils/signingUtil");

async function processRefillRequestController(req, res, next) {
  const authEnabled = config.get('authEnabled');
  
  try {
    const requestData = req.verifiedData;

    const result = await refillService.processRefillRequestService(requestData);

    let signedRes;
    if (authEnabled) {
      signedRes = signingUtil.signResponse(result);
    }
    
    if (result.success) {
      authEnabled ? res.status(200).send(signedRes) : res.status(200).json(result);
    } else {
      if (result.code === 'REFILL_IN_PROGRESS') {
        authEnabled ? res.status(409).send(signedRes) : res.status(409).json(result);
      } else {
        authEnabled ? res.status(400).send(signedRes) : res.status(400).json(result);
      }
    }
  } catch (e) {
    logger.error(`Error processing refill request: ${e.message}`);
    const errorResponse = {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      data: { details: e.message }
    };
    try {
      authEnabled
        ? res.status(500).send(signingUtil.signResponse(errorResponse))
        : res.status(500).json(errorResponse);
    } catch (e) {
      logger.error(`Error: ${e.message}`);
      res.sendStatus(500);
    }
  }
}

async function checkTransactionStatusController(req, res, next) {
  const authEnabled = config.get('authEnabled');

  try {
    const { refill_request_id } = req.verifiedData;

    if (!refill_request_id) {
      logger.error('refill_request_id is missing in JWT');
      const errorResponse = {
        success: false,
        error: 'refill_request_id is required in JWT',
        code: 'MISSING_PARAMETER',
        data: null
      };
      return authEnabled
        ? res.status(400).send(signingUtil.signResponse(errorResponse))
        : res.status(400).json(errorResponse);
    }

    if (authEnabled) {
      // Verify whether the refill request ID in JWT token matches the value in URL parameter
      if (refill_request_id !== req.params.refill_request_id) {
        logger.error(`Refill request ID mismatch in JWT and URL parameter: ${refill_request_id} !== ${req.params.refill_request_id}`);
        const errorResponse = {
          success: false,
          error: 'Refill request ID mismatch in JWT and URL parameter',
          code: 'REFILL_REQUEST_ID_MISMATCH',
          data: {
            requestIdInJwt: refill_request_id,
            requestIdInUrl: req.params.refill_request_id
          }
        };
        return res.status(400).send(signingUtil.signResponse(errorResponse));
      }
    }

    logger.info(`Checking transaction status for refill request: ${refill_request_id}`);

    // Get status from DB
    const result = await refillTransactionService.getTransactionStatusFromDB(refill_request_id);

    let signedRes;
    if (authEnabled) {
      signedRes = signingUtil.signResponse(result);
    }

    if (result.success) {
      authEnabled ? res.status(200).send(signedRes) : res.status(200).json(result);
    } else {
      authEnabled ? res.status(404).send(signedRes) : res.status(404).json(result);
    }
  } catch (e) {
    logger.error(`Error checking transaction status: ${e.message}`);
    const errorResponse = {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      data: { details: e.message }
    };
    try {
      authEnabled
        ? res.status(500).send(signingUtil.signResponse(errorResponse))
        : res.status(500).json(errorResponse);
    } catch (e) {
      logger.error(`Error: ${e.message}`);
      res.sendStatus(500);
    }
  }
}

module.exports = {
  processRefillRequestController,
  checkTransactionStatusController
};
