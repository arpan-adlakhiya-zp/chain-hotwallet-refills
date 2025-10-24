const db = require('../models');

function getAssetById(id) {
  return db.Asset.findByPk(id, {
    include: [
      { model: db.Blockchain, as: 'Blockchain' },
      { model: db.Wallet, as: 'Wallet' }
    ]
  });
}

function getAssetBySymbol(symbol) {
  return db.Asset.findOne({
    where: { 
      symbol: { [db.Sequelize.Op.iLike]: symbol }, 
      isActive: true 
    },
    include: [
      { model: db.Blockchain, as: 'Blockchain' },
      { model: db.Wallet, as: 'Wallet' }
    ]
  });
}

function getAssetBySymbolAndBlockchain(symbol, blockchainId) {
  return db.Asset.findOne({
    where: { 
      symbol: { [db.Sequelize.Op.iLike]: symbol }, 
      blockchainId: blockchainId, 
      isActive: true 
    },
    include: [
      { model: db.Blockchain, as: 'Blockchain' },
      { model: db.Wallet, as: 'Wallet' }
    ]
  });
}

function getAssetsByBlockchain(blockchainId) {
  return db.Asset.findAll({
    where: { blockchainId: blockchainId, isActive: true },
    include: [
      { model: db.Blockchain, as: 'Blockchain' },
      { model: db.Wallet, as: 'Wallet' }
    ],
    order: [['symbol', 'ASC']]
  });
}

function getAllActiveAssets() {
  return db.Asset.findAll({
    where: { isActive: true },
    include: [
      { model: db.Blockchain, as: 'Blockchain' },
      { model: db.Wallet, as: 'Wallet' }
    ],
    order: [['symbol', 'ASC']]
  });
}

function createAsset(assetData) {
  return db.Asset.create(assetData);
}

function updateAsset(id, updateData) {
  return db.Asset.update(updateData, {
    where: { id: id },
    returning: true
  });
}

function deleteAsset(id) {
  return db.Asset.destroy({
    where: { id: id }
  });
}

module.exports = {
  getAssetById,
  getAssetBySymbol,
  getAssetBySymbolAndBlockchain,
  getAssetsByBlockchain,
  getAllActiveAssets,
  createAsset,
  updateAsset,
  deleteAsset
};
