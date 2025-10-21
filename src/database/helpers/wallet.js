const db = require('../models');

function getWalletById(id) {
  return db.Wallet.findByPk(id, {
    include: [{
      model: db.Blockchain,
      as: 'Blockchain'
    }]
  });
}

function getWalletByAddress(address) {
  return db.Wallet.findOne({
    where: { address: address },
    include: [{
      model: db.Blockchain,
      as: 'Blockchain'
    }]
  });
}

function getWalletsByType(walletType, blockchainId = null) {
  const whereClause = { walletType: walletType, monitorStatus: 'active' };
  if (blockchainId) {
    whereClause.blockchainId = blockchainId;
  }
  
  return db.Wallet.findAll({
    where: whereClause,
    include: [{
      model: db.Blockchain,
      as: 'Blockchain'
    }]
  });
}

function getHotWalletsByBlockchain(blockchainId) {
  return getWalletsByType('hot', blockchainId);
}

function getColdWalletsByBlockchain(blockchainId) {
  return getWalletsByType('cold', blockchainId);
}

function createWallet(walletData) {
  return db.Wallet.create(walletData);
}

function updateWallet(id, updateData) {
  return db.Wallet.update(updateData, {
    where: { id: id },
    returning: true
  });
}

function deleteWallet(id) {
  return db.Wallet.destroy({
    where: { id: id }
  });
}

function getAllWallets() {
  return db.Wallet.findAll({
    include: [{
      model: db.Blockchain,
      as: 'Blockchain'
    }]
  });
}

module.exports = {
  getWalletById,
  getWalletByAddress,
  getWalletsByType,
  getHotWalletsByBlockchain,
  getColdWalletsByBlockchain,
  getAllWallets,
  createWallet,
  updateWallet,
  deleteWallet
};
