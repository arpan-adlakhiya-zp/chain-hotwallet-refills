const express = require('express');
const { processRefillRequestController, checkTransactionStatusController } = require('../controller/refillController');
const { doHealthCheckController } = require('../controller/healthCheckController');
const { authenticate } = require('../middleware/authentication');
const router = express.Router();

// Health check endpoint (no authentication required)
router.get('/v1/health', doHealthCheckController);

// Main refill endpoint (with authentication)
router.post('/v1/wallet/refill', authenticate, processRefillRequestController);

// Transaction status check endpoint (with authentication)
router.get('/v1/wallet/refill/status/:refill_request_id', authenticate, checkTransactionStatusController);

module.exports = { router };
