// Mock the entire @lmnl/liminaljs module before requiring anything
const mockLiminalEnvironment = {
  dev: 'dev',
  prod: 'prod'
};

const mockCoinsEnum = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum',
  btc: 'btc',
  eth: 'eth'
};

jest.mock('@lmnl/liminaljs', () => ({
  LiminalJs: jest.fn(),
  CoinsEnum: {
    bitcoin: 'bitcoin',
    ethereum: 'ethereum',
    btc: 'btc',
    eth: 'eth'
  },
  LiminalEnvironment: {
    dev: 'dev',
    prod: 'prod'
  }
}));

const WalletFactory = require('../../../../providers/liminal/walletFactory');
const { LiminalJs, CoinsEnum, LiminalEnvironment } = require('@lmnl/liminaljs');

jest.mock('../../../../middleware/logger');

describe('Liminal WalletFactory', () => {
  let walletFactory;
  let mockLiminalJs;
  let mockAuthenticate;
  let mockCoin;
  let mockToken;
  let mockWallets;
  let mockWallet;

  beforeEach(() => {
    // Mock wallet instance
    mockWallet = {
      WalletAddress: '0x1234567890abcdef',
      GetBalance: jest.fn(),
      WalletV2: jest.fn(),
      GetPendingTransaction: jest.fn(),
      GetTransfer: jest.fn()
    };

    // Mock wallets chain
    mockWallets = {
      Get: jest.fn().mockResolvedValue(mockWallet),
      WalletList: jest.fn()
    };

    // Mock token chain
    mockToken = {
      Wallets: jest.fn().mockReturnValue(mockWallets)
    };

    // Mock coin chain
    mockCoin = {
      Token: jest.fn().mockReturnValue(mockToken),
      Wallets: jest.fn().mockReturnValue(mockWallets)
    };

    // Mock authenticate chain
    mockAuthenticate = {
      AuthenticateWithAccessToken: jest.fn().mockResolvedValue(true)
    };

    // Mock LiminalJs instance
    mockLiminalJs = {
      Authenticate: jest.fn().mockReturnValue(mockAuthenticate),
      Coin: jest.fn().mockReturnValue(mockCoin),
      CoinsEnum: CoinsEnum
    };

    LiminalJs.mockImplementation(() => mockLiminalJs);

    walletFactory = new WalletFactory('dev', 'wallet-123');
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with environment and walletId', () => {
      const factory = new WalletFactory('prod', 'wallet-456');
      expect(factory.env).toBe('prod');
      expect(factory.walletId).toBe('wallet-456');
      expect(LiminalJs).toHaveBeenCalledWith('prod');
    });
  });

  describe('init', () => {
    it('should initialize LiminalJs successfully', async () => {
      const auth = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        AuthAudience: 'test-audience'
      };

      const result = await walletFactory.init(auth);

      expect(mockLiminalJs.Authenticate).toHaveBeenCalledWith(auth);
      expect(mockAuthenticate.AuthenticateWithAccessToken).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should throw error on initialization failure', async () => {
      mockAuthenticate.AuthenticateWithAccessToken.mockRejectedValue(
        new Error('Invalid credentials')
      );

      await expect(
        walletFactory.init({ clientId: 'bad', clientSecret: 'bad', AuthAudience: 'bad' })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('getWallet', () => {
    beforeEach(async () => {
      await walletFactory.init({
        clientId: 'test',
        clientSecret: 'test',
        AuthAudience: 'test'
      });
    });

    it('should get native token wallet successfully', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        contractAddress: null,
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      const wallet = await walletFactory.getWallet(token);

      expect(mockLiminalJs.Coin).toHaveBeenCalledWith(mockCoinsEnum.btc);
      expect(mockCoin.Wallets).toHaveBeenCalled();
      expect(mockWallets.Get).toHaveBeenCalledWith({ walletId: 'wallet-123' });
      expect(wallet).toBe(mockWallet);
    });

    it('should get contract token wallet successfully', async () => {
      const token = {
        symbol: 'USDC',
        blockchainSymbol: 'ethereum',
        contractAddress: '0xabc123',
        walletConfig: {
          liminal: {
            walletId: 'wallet-456'
          }
        }
      };

      const wallet = await walletFactory.getWallet(token);

      expect(mockLiminalJs.Coin).toHaveBeenCalledWith(mockCoinsEnum.ethereum);
      expect(mockCoin.Token).toHaveBeenCalledWith({
        tokenName: 'usdc',
        tokenAddress: '0xabc123'
      });
      expect(mockWallets.Get).toHaveBeenCalledWith({ walletId: 'wallet-456', allTokens: true });
      expect(wallet).toBe(mockWallet);
    });

    it('should throw error when wallet ID not found', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {}
      };

      await expect(
        walletFactory.getWallet(token)
      ).rejects.toThrow('No wallet ID found in token configuration');
    });

    it('should throw error when wallet retrieval fails', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      mockWallets.Get.mockRejectedValue(new Error('Wallet not found'));

      await expect(
        walletFactory.getWallet(token)
      ).rejects.toThrow('Wallet not found');
    });
  });

  describe('getTokenBalance', () => {
    beforeEach(async () => {
      await walletFactory.init({
        clientId: 'test',
        clientSecret: 'test',
        AuthAudience: 'test'
      });
    });

    it('should return balance in atomic units', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      mockWallet.GetBalance.mockResolvedValue({
        spendableBalanceInLowerDenom: '150000000'
      });

      const balance = await walletFactory.getTokenBalance(token);

      expect(mockWallet.GetBalance).toHaveBeenCalledWith({
        address: '0x1234567890abcdef'
      });
      expect(balance).toBe('150000000');
    });

    it('should handle zero balance', async () => {
      const token = {
        symbol: 'ETH',
        blockchainSymbol: 'ethereum',
        walletConfig: {
          liminal: {
            walletId: 'wallet-456'
          }
        }
      };

      mockWallet.GetBalance.mockResolvedValue({
        spendableBalanceInLowerDenom: '0'
      });

      const balance = await walletFactory.getTokenBalance(token);

      expect(balance).toBe('0');
    });

    it('should throw error when wallet not found', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      mockWallets.Get.mockResolvedValue(null);

      await expect(
        walletFactory.getTokenBalance(token)
      ).rejects.toThrow('Unable to get wallet instance');
    });

    it('should throw error on balance retrieval failure', async () => {
      const token = {
        symbol: 'BTC',
        blockchainSymbol: 'bitcoin',
        walletConfig: {
          liminal: {
            walletId: 'wallet-123'
          }
        }
      };

      mockWallet.GetBalance.mockRejectedValue(new Error('Balance API error'));

      await expect(
        walletFactory.getTokenBalance(token)
      ).rejects.toThrow('Balance API error');
    });
  });
});

