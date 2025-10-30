const db = require('../models');

function getAssetById(id) {
  return db.Asset.findByPk(id, {
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

module.exports = {
  getAssetById,
  getAssetBySymbolAndBlockchain
};
