const db = require('../models');

/**
 * Create a new refill transaction record
 * @param {Object} transactionData - Transaction data
 * @returns {Promise<Object>} Created transaction
 */
function createRefillTransaction(transactionData) {
  return db.RefillTransaction.create({
    refillRequestId: transactionData.refillRequestId,
    walletId: transactionData.walletId,
    assetId: transactionData.assetId,
    blockchainId: transactionData.blockchainId,
    fromAddress: transactionData.fromAddress,
    toAddress: transactionData.toAddress,
    amountAtomic: transactionData.amountAtomic,
    provider: transactionData.provider,
    status: transactionData.status || 'PENDING',
    tokenSymbol: transactionData.tokenSymbol,
    walletDetails: transactionData.walletDetails || null,
    message: transactionData.message || null
  });
}

/**
 * Update refill transaction with new data
 * @param {string} refillRequestId - External request ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Array>} Updated rows count
 */
function updateRefillTransaction(refillRequestId, updateData) {
  return db.RefillTransaction.update(updateData, {
    where: { refillRequestId: refillRequestId }
  });
}

/**
 * Get refill transaction by request ID
 * @param {string} refillRequestId - External request ID
 * @returns {Promise<Object|null>} Transaction or null
 */
function getRefillTransactionByRequestId(refillRequestId) {
  return db.RefillTransaction.findOne({
    where: { refillRequestId: refillRequestId }
  });
}

/**
 * Get refill transaction by provider transaction ID
 * @param {string} providerTxId - Provider transaction ID
 * @returns {Promise<Object|null>} Transaction or null
 */
function getRefillTransactionByProviderTxId(providerTxId) {
  return db.RefillTransaction.findOne({
    where: { providerTxId: providerTxId }
  });
}

/**
 * Get refill transactions by status
 * @param {string} status - Transaction status
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>} Array of transactions
 */
function getRefillTransactionsByStatus(status, limit = 100) {
  return db.RefillTransaction.findAll({
    where: { status: status },
    limit: limit,
    order: [['createdAt', 'DESC']]
  });
}

module.exports = {
  createRefillTransaction,
  updateRefillTransaction,
  getRefillTransactionByRequestId,
  getRefillTransactionByProviderTxId,
  getRefillTransactionsByStatus
};
