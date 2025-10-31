const walletHelper = require('../../../../database/helpers/wallet');
const db = require('../../../../database/models');

jest.mock('../../../../database/models');

describe('Wallet Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWalletByAddress', () => {
    it('should fetch wallet with blockchain association', async () => {
      const mockWallet = {
        id: 1,
        address: '0x123abc',
        walletType: 'hot',
        Blockchain: { id: 1, name: 'Ethereum' }
      };
      
      db.Wallet.findOne = jest.fn().mockResolvedValue(mockWallet);
      
      const result = await walletHelper.getWalletByAddress('0x123abc');
      
      expect(db.Wallet.findOne).toHaveBeenCalledWith({
        where: { address: '0x123abc' },
        include: [{
          model: db.Blockchain,
          as: 'Blockchain'
        }]
      });
      expect(result).toEqual(mockWallet);
    });

    it('should return null when wallet not found', async () => {
      db.Wallet.findOne = jest.fn().mockResolvedValue(null);
      
      const result = await walletHelper.getWalletByAddress('0xnonexistent');
      
      expect(result).toBeNull();
    });

    it('should handle different address formats', async () => {
      db.Wallet.findOne = jest.fn().mockResolvedValue({ id: 1 });
      
      // Test with various address formats
      await walletHelper.getWalletByAddress('0xABC123');
      await walletHelper.getWalletByAddress('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
      
      expect(db.Wallet.findOne).toHaveBeenCalledTimes(2);
    });
  });
});

