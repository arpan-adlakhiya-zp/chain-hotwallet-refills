const db = require('../models');

function getBlockchainByName(name) {
  return db.Blockchain.findOne({
    where: { 
      name: { [db.Sequelize.Op.iLike]: name },
      isActive: true 
    }
  });
}

module.exports = {
  getBlockchainByName
};
