const db = require('../models');

/**
 * Create a new refill transaction record
 * @param {Object} transactionData - Transaction data
 * @returns {Promise<Object>} Created transaction
 */
function createRefillTransaction(transactionData) {
  // Pass data directly to Sequelize - it will handle undefined fields gracefully
  return db.RefillTransaction.create(transactionData);
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
    // include: [{
    //   model: db.Asset,
    //   as: 'Asset',
    //   include: [
    //     { model: db.Blockchain, as: 'Blockchain' },
    //     { model: db.Wallet, as: 'Wallet' }
    //   ]
    // }]
  });
}

/**
 * Get pending/processing refill transaction by asset ID
 * @param {number} assetId - Asset ID
 * @returns {Promise<Object|null>} Transaction or null
 */
function getPendingTransactionByAssetId(assetId) {
  return db.RefillTransaction.findOne({
    where: { 
      assetId: assetId,
      status: {
        [db.Sequelize.Op.in]: ['PENDING', 'PROCESSING']
      }
    },
    order: [['createdAt', 'DESC']]
  });
}

/**
 * Get refill transactions by status
 * @param {string} status - Transaction status
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>} Array of transactions
 */
function getTransactionsByStatus(status, limit = 100) {
  return db.RefillTransaction.findAll({
    where: { status: status },
    limit: limit,
    order: [['createdAt', 'ASC']] // Oldest first for monitoring
  });
}

/**
 * Get the last successful (COMPLETED) refill transaction for an asset
 * @param {number} assetId - Asset ID
 * @returns {Promise<Object|null>} Last successful transaction or null
 */
function getLastSuccessfulRefillByAssetId(assetId) {
  return db.RefillTransaction.findOne({
    where: { 
      assetId: assetId,
      status: 'COMPLETED'
    },
    order: [['updatedAt', 'DESC']]  // Most recent completion first
  });
}

module.exports = {
  createRefillTransaction,
  updateRefillTransaction,
  getRefillTransactionByRequestId,
  getPendingTransactionByAssetId,
  getTransactionsByStatus,
  getLastSuccessfulRefillByAssetId
};
