const blockchainHelper = require('../../../../database/helpers/blockchain');
const db = require('../../../../database/models');

jest.mock('../../../../database/models');

describe('Blockchain Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBlockchainByName', () => {
    it('should fetch blockchain with case-insensitive search', async () => {
      const mockBlockchain = {
        id: 1,
        name: 'Bitcoin',
        symbol: 'BTC',
        isActive: true
      };
      
      db.Blockchain.findOne = jest.fn().mockResolvedValue(mockBlockchain);
      
      const result = await blockchainHelper.getBlockchainByName('bitcoin');
      
      expect(db.Blockchain.findOne).toHaveBeenCalledWith({
        where: { 
          name: { [db.Sequelize.Op.iLike]: 'bitcoin' },
          isActive: true 
        }
      });
      expect(result).toEqual(mockBlockchain);
    });

    it('should only return active blockchains', async () => {
      db.Blockchain.findOne = jest.fn().mockResolvedValue(null);
      
      await blockchainHelper.getBlockchainByName('Bitcoin');
      
      const callArgs = db.Blockchain.findOne.mock.calls[0][0];
      expect(callArgs.where.isActive).toBe(true);
    });

    it('should return null when blockchain not found', async () => {
      db.Blockchain.findOne = jest.fn().mockResolvedValue(null);
      
      const result = await blockchainHelper.getBlockchainByName('NonExistent');
      
      expect(result).toBeNull();
    });

    it('should handle uppercase names', async () => {
      db.Blockchain.findOne = jest.fn().mockResolvedValue({ id: 1 });
      
      await blockchainHelper.getBlockchainByName('ETHEREUM');
      
      expect(db.Blockchain.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { [db.Sequelize.Op.iLike]: 'ETHEREUM' }
          })
        })
      );
    });
  });
});

