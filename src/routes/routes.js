const express = require('express');
const { processRefillRequestController, checkTransactionStatusController } = require('../controller/refillController');
const { doHealthCheckController } = require('../controller/healthCheckController');
const router = express.Router();

// Health check endpoint
router.get('/v1/health', doHealthCheckController);

// Main refill endpoint
router.post('/v1/wallet/refill', processRefillRequestController);

// Transaction status check endpoint
router.get('/v1/wallet/refill/status/:refill_request_id', checkTransactionStatusController);

module.exports = { router };
