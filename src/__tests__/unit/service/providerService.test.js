// Mock config before any imports to prevent database config errors
jest.mock('../../../config', () => ({
  get: jest.fn(),
  getSecret: jest.fn(() => ({
    host: 'localhost',
    port: 5432,
    user: 'test',
    password: 'test',
    name: 'testdb'
  })),
  getAllConfig: jest.fn()
}));

jest.mock('../../../service/chainDb');
jest.mock('../../../providers/liminal');
jest.mock('../../../providers/fireblocks');
jest.mock('../../../middleware/logger');

const providerService = require('../../../service/providerService');
const databaseService = require('../../../service/chainDb');
const LiminalProvider = require('../../../providers/liminal');
const FireblocksProvider = require('../../../providers/fireblocks');
const config = require('../../../config');

describe('ProviderService', () => {
  let mockLiminalProvider;
  let mockFireblocksProvider;

  beforeEach(() => {
    mockLiminalProvider = {
      init: jest.fn().mockResolvedValue({ success: true })
    };

    mockFireblocksProvider = {
      init: jest.fn().mockResolvedValue({ success: true })
    };

    LiminalProvider.mockImplementation(() => mockLiminalProvider);
    FireblocksProvider.mockImplementation(() => mockFireblocksProvider);
    
    // Reset singleton state
    providerService.initialized = false;
    providerService.providers = new Map();
    
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize providers when credentials are available', async () => {
      config.getSecret.mockImplementation((key) => {
        if (key === 'liminal') return { clientId: 'id', clientSecret: 'secret', AuthAudience: 'aud' };
        if (key === 'fireblocks') return { apiKey: 'key', privateKey: 'pk' };
        return null;
      });

      config.get.mockImplementation((key) => {
        if (key === 'providers.liminal') return { env: 'dev' };
        if (key === 'providers.fireblocks') return { apiBaseUrl: 'https://api.fireblocks.io' };
        return null;
      });

      await providerService.initialize();

      expect(LiminalProvider).toHaveBeenCalled();
      expect(FireblocksProvider).toHaveBeenCalled();
      expect(providerService.initialized).toBe(true);
    });

    it('should only initialize once', async () => {
      config.getSecret.mockReturnValue({ clientId: 'id', clientSecret: 'secret', AuthAudience: 'aud' });
      config.get.mockReturnValue({ env: 'dev' });

      await providerService.initialize();
      await providerService.initialize();

      expect(LiminalProvider).toHaveBeenCalledTimes(1);
    });

    it('should skip provider when credentials missing', async () => {
      config.getSecret.mockReturnValue(null);

      await providerService.initialize();

      expect(LiminalProvider).not.toHaveBeenCalled();
      expect(FireblocksProvider).not.toHaveBeenCalled();
    });

    it('should throw error when provider initialization fails', async () => {
      config.getSecret.mockReturnValue({ apiKey: 'key', privateKey: 'pk' });
      config.get.mockReturnValue({ apiBaseUrl: 'url' });
      
      mockFireblocksProvider.init.mockRejectedValue(new Error('Init failed'));

      await expect(providerService.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('getProviders', () => {
    it('should return providers map', () => {
      const providers = providerService.getProviders();

      expect(providers).toBeInstanceOf(Map);
    });
  });

  describe('getTokenProvider', () => {
    beforeEach(async () => {
      config.getSecret.mockReturnValue({ apiKey: 'key', privateKey: 'pk' });
      config.get.mockReturnValue({ apiBaseUrl: 'url' });
      
      await providerService.initialize();
      providerService.providers.set('fireblocks', mockFireblocksProvider);
    });

    it('should return provider for valid blockchain and asset', async () => {
      const mockBlockchain = { id: 1, name: 'Bitcoin' };
      const mockAsset = {
        id: 1,
        symbol: 'BTC',
        sweepWalletConfig: { provider: 'fireblocks' }
      };

      databaseService.getBlockchainByName.mockResolvedValue(mockBlockchain);
      databaseService.getAssetBySymbolAndBlockchain.mockResolvedValue(mockAsset);

      const result = await providerService.getTokenProvider('Bitcoin', 'BTC');

      expect(result).toBe(mockFireblocksProvider);
      expect(databaseService.getBlockchainByName).toHaveBeenCalledWith('Bitcoin');
      expect(databaseService.getAssetBySymbolAndBlockchain).toHaveBeenCalledWith('BTC', 1);
    });

    it('should return null when blockchain not found', async () => {
      databaseService.getBlockchainByName.mockResolvedValue(null);

      const result = await providerService.getTokenProvider('Unknown', 'BTC');

      expect(result).toBeNull();
    });

    it('should return null when asset not found', async () => {
      databaseService.getBlockchainByName.mockResolvedValue({ id: 1 });
      databaseService.getAssetBySymbolAndBlockchain.mockResolvedValue(null);

      const result = await providerService.getTokenProvider('Bitcoin', 'INVALID');

      expect(result).toBeNull();
    });

    it('should return null when provider not configured in asset', async () => {
      databaseService.getBlockchainByName.mockResolvedValue({ id: 1 });
      databaseService.getAssetBySymbolAndBlockchain.mockResolvedValue({
        id: 1,
        sweepWalletConfig: {}
      });

      const result = await providerService.getTokenProvider('Bitcoin', 'BTC');

      expect(result).toBeNull();
    });

    it('should return null when provider not initialized', async () => {
      databaseService.getBlockchainByName.mockResolvedValue({ id: 1 });
      databaseService.getAssetBySymbolAndBlockchain.mockResolvedValue({
        id: 1,
        sweepWalletConfig: { provider: 'unknown_provider' }
      });

      const result = await providerService.getTokenProvider('Bitcoin', 'BTC');

      expect(result).toBeNull();
    });

    it('should handle uppercase asset symbols', async () => {
      const mockBlockchain = { id: 1 };
      const mockAsset = { id: 1, sweepWalletConfig: { provider: 'fireblocks' } };

      databaseService.getBlockchainByName.mockResolvedValue(mockBlockchain);
      databaseService.getAssetBySymbolAndBlockchain.mockResolvedValue(mockAsset);

      await providerService.getTokenProvider('Bitcoin', 'btc');

      expect(databaseService.getAssetBySymbolAndBlockchain).toHaveBeenCalledWith('BTC', 1);
    });

    it('should handle database errors gracefully', async () => {
      databaseService.getBlockchainByName.mockRejectedValue(new Error('DB error'));

      const result = await providerService.getTokenProvider('Bitcoin', 'BTC');

      expect(result).toBeNull();
    });
  });
});

