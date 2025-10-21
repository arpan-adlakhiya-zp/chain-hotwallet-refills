const db = require('../models');

function getBlockchainById(id) {
  return db.Blockchain.findByPk(id);
}

function getBlockchainByName(name) {
  return db.Blockchain.findOne({
    where: { name: name, isActive: true }
  });
}

function getAllActiveBlockchains() {
  return db.Blockchain.findAll({
    where: { isActive: true },
    order: [['name', 'ASC']]
  });
}

function getAllBlockchains() {
  return db.Blockchain.findAll({
    order: [['name', 'ASC']]
  });
}

function getBlockchainBySymbol(symbol) {
  return db.Blockchain.findOne({
    where: { symbol: symbol, isActive: true }
  });
}

function createBlockchain(blockchainData) {
  return db.Blockchain.create(blockchainData);
}

function updateBlockchain(id, updateData) {
  return db.Blockchain.update(updateData, {
    where: { id: id },
    returning: true
  });
}

function deleteBlockchain(id) {
  return db.Blockchain.destroy({
    where: { id: id }
  });
}

module.exports = {
  getBlockchainById,
  getBlockchainByName,
  getBlockchainBySymbol,
  getAllActiveBlockchains,
  getAllBlockchains,
  createBlockchain,
  updateBlockchain,
  deleteBlockchain
};
