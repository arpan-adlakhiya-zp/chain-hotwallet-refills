const assetHelper = require('../../../../database/helpers/asset');
const db = require('../../../../database/models');

jest.mock('../../../../database/models');

describe('Asset Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAssetById', () => {
    it('should fetch asset with blockchain and wallet associations', async () => {
      const mockAsset = {
        id: 1,
        symbol: 'BTC',
        name: 'Bitcoin',
        Blockchain: { id: 1, name: 'Bitcoin' },
        Wallet: { id: 1, address: '0x123' }
      };
      
      db.Asset.findByPk = jest.fn().mockResolvedValue(mockAsset);
      
      const result = await assetHelper.getAssetById(1);
      
      expect(db.Asset.findByPk).toHaveBeenCalledWith(1, {
        include: [
          { model: db.Blockchain, as: 'Blockchain' },
          { model: db.Wallet, as: 'Wallet' }
        ]
      });
      expect(result).toEqual(mockAsset);
    });

    it('should return null when asset not found', async () => {
      db.Asset.findByPk = jest.fn().mockResolvedValue(null);
      
      const result = await assetHelper.getAssetById(999);
      
      expect(result).toBeNull();
    });
  });

  describe('getAssetBySymbolAndBlockchain', () => {
    it('should use case-insensitive search for symbol', async () => {
      const mockAsset = { id: 1, symbol: 'BTC' };
      db.Asset.findOne = jest.fn().mockResolvedValue(mockAsset);
      
      await assetHelper.getAssetBySymbolAndBlockchain('btc', 1);
      
      expect(db.Asset.findOne).toHaveBeenCalledWith({
        where: { 
          symbol: { [db.Sequelize.Op.iLike]: 'btc' }, 
          blockchainId: 1, 
          isActive: true 
        },
        include: [
          { model: db.Blockchain, as: 'Blockchain' },
          { model: db.Wallet, as: 'Wallet' }
        ]
      });
    });

    it('should only return active assets', async () => {
      db.Asset.findOne = jest.fn().mockResolvedValue(null);
      
      await assetHelper.getAssetBySymbolAndBlockchain('BTC', 1);
      
      const callArgs = db.Asset.findOne.mock.calls[0][0];
      expect(callArgs.where.isActive).toBe(true);
    });

    it('should filter by blockchainId', async () => {
      db.Asset.findOne = jest.fn().mockResolvedValue(null);
      
      await assetHelper.getAssetBySymbolAndBlockchain('USDC', 5);
      
      const callArgs = db.Asset.findOne.mock.calls[0][0];
      expect(callArgs.where.blockchainId).toBe(5);
    });
  });
});

