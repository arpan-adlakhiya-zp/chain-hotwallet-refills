const db = require('../models');

function getWalletByAddress(address) {
  return db.Wallet.findOne({
    where: { address: address },
    include: [{
      model: db.Blockchain,
      as: 'Blockchain'
    }]
  });
}

module.exports = {
  getWalletByAddress
};
