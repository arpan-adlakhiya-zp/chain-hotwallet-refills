const db = require('../models');

function getBalanceByWalletAndAsset(walletId, assetId) {
  return db.Balance.findOne({
    where: { walletId: walletId, assetId: assetId },
    include: [
      {
        model: db.Wallet,
        as: 'Wallet',
        include: [{
          model: db.Blockchain,
          as: 'Blockchain'
        }]
      },
      {
        model: db.Asset,
        as: 'Asset',
        include: [{
          model: db.Blockchain,
          as: 'Blockchain'
        }]
      }
    ]
  });
}

function getBalancesByWallet(walletId) {
  return db.Balance.findAll({
    where: { walletId: walletId },
    include: [
      {
        model: db.Asset,
        as: 'Asset',
        include: [{
          model: db.Blockchain,
          as: 'Blockchain'
        }]
      }
    ],
    order: [['lastCheckedAt', 'DESC']]
  });
}

function getBalancesByAsset(assetId) {
  return db.Balance.findAll({
    where: { assetId: assetId },
    include: [
      {
        model: db.Wallet,
        as: 'Wallet',
        include: [{
          model: db.Blockchain,
          as: 'Blockchain'
        }]
      }
    ],
    order: [['lastCheckedAt', 'DESC']]
  });
}

function getLowBalanceWallets(assetId, threshold) {
  return db.Balance.findAll({
    where: {
      assetId: assetId,
      balanceAtomicQty: {
        [db.Sequelize.Op.lt]: threshold
      },
      triggerRefill: true
    },
    include: [
      {
        model: db.Wallet,
        as: 'Wallet',
        where: { walletType: 'hot', monitorStatus: 'active' },
        include: [{
          model: db.Blockchain,
          as: 'Blockchain'
        }]
      },
      {
        model: db.Asset,
        as: 'Asset'
      }
    ],
    order: [['balanceAtomicQty', 'ASC']]
  });
}

function createOrUpdateBalance(balanceData) {
  return db.Balance.upsert(balanceData, {
    conflictFields: ['walletId', 'assetId']
  });
}

function updateBalance(walletId, assetId, updateData) {
  return db.Balance.update(updateData, {
    where: { walletId: walletId, assetId: assetId },
    returning: true
  });
}

function deleteBalance(walletId, assetId) {
  return db.Balance.destroy({
    where: { walletId: walletId, assetId: assetId }
  });
}

function getAllBalances() {
  return db.Balance.findAll({
    include: [
      {
        model: db.Wallet,
        as: 'Wallet',
        include: [{
          model: db.Blockchain,
          as: 'Blockchain'
        }]
      },
      {
        model: db.Asset,
        as: 'Asset',
        include: [{
          model: db.Blockchain,
          as: 'Blockchain'
        }]
      }
    ],
    order: [['lastCheckedAt', 'DESC']]
  });
}

module.exports = {
  getBalanceByWalletAndAsset,
  getBalancesByWallet,
  getBalancesByAsset,
  getLowBalanceWallets,
  getAllBalances,
  createOrUpdateBalance,
  updateBalance,
  deleteBalance
};
