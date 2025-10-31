const refillUtils = require('../../../../service/utils/utils');
const config = require('../../../../config');

jest.mock('../../../../config');
jest.mock('../../../../middleware/logger');

describe('RefillUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLiminalConfig', () => {
    it('should return env from config when available', () => {
      config.get.mockReturnValue({ env: 'prod' });
      
      const result = refillUtils.getLiminalConfig();
      
      expect(result).toBe('prod');
      expect(config.get).toHaveBeenCalledWith('providers.liminal');
    });

    it('should return dev as default when config is null', () => {
      config.get.mockReturnValue(null);
      
      const result = refillUtils.getLiminalConfig();
      
      expect(result).toBe('dev');
    });

    it('should return dev when env is not in config', () => {
      config.get.mockReturnValue({});
      
      const result = refillUtils.getLiminalConfig();
      
      expect(result).toBe('dev');
    });

    it('should return dev when config throws error', () => {
      config.get.mockImplementation(() => {
        throw new Error('Config error');
      });
      
      const result = refillUtils.getLiminalConfig();
      
      expect(result).toBe('dev');
    });
  });

  describe('getFireblocksConfig', () => {
    it('should return apiBaseUrl from config when available', () => {
      config.get.mockReturnValue({ apiBaseUrl: 'https://custom.fireblocks.io' });
      
      const result = refillUtils.getFireblocksConfig();
      
      expect(result).toBe('https://custom.fireblocks.io');
      expect(config.get).toHaveBeenCalledWith('providers.fireblocks');
    });

    it('should return default URL when config is null', () => {
      config.get.mockReturnValue(null);
      
      const result = refillUtils.getFireblocksConfig();
      
      expect(result).toBe('https://api.fireblocks.io');
    });

    it('should return default URL when apiBaseUrl not in config', () => {
      config.get.mockReturnValue({});
      
      const result = refillUtils.getFireblocksConfig();
      
      expect(result).toBe('https://api.fireblocks.io');
    });

    it('should return default URL when config throws error', () => {
      config.get.mockImplementation(() => {
        throw new Error('Config error');
      });
      
      const result = refillUtils.getFireblocksConfig();
      
      expect(result).toBe('https://api.fireblocks.io');
    });
  });

  describe('getColdWalletId', () => {
    it('should return Liminal wallet ID for Liminal provider', () => {
      const validatedData = {
        asset: {
          sweepWalletConfig: {
            liminal: { walletId: 'lim123' }
          }
        }
      };
      const provider = {
        constructor: { getProviderName: () => 'liminal' }
      };

      const result = refillUtils.getColdWalletId(validatedData, provider);
      
      expect(result).toBe('lim123');
    });

    it('should return Fireblocks vault ID for Fireblocks provider', () => {
      const validatedData = {
        asset: {
          sweepWalletConfig: {
            fireblocks: { vaultId: 'vault456' }
          }
        }
      };
      const provider = {
        constructor: { getProviderName: () => 'fireblocks' }
      };

      const result = refillUtils.getColdWalletId(validatedData, provider);
      
      expect(result).toBe('vault456');
    });

    it('should handle other providers with walletId', () => {
      const validatedData = {
        asset: {
          sweepWalletConfig: {
            customprovider: { walletId: 'custom123' }
          }
        }
      };
      const provider = {
        constructor: { getProviderName: () => 'customprovider' }
      };

      const result = refillUtils.getColdWalletId(validatedData, provider);
      
      expect(result).toBe('custom123');
    });
  });

  describe('getHotWalletId', () => {
    it('should return wallet address for Liminal provider', () => {
      const validatedData = {
        wallet: { address: '0xhot123' }
      };
      const provider = {
        constructor: { getProviderName: () => 'liminal' }
      };

      const result = refillUtils.getHotWalletId(validatedData, provider);
      
      expect(result).toBe('0xhot123');
    });

    it('should return Fireblocks vault ID for Fireblocks provider', () => {
      const validatedData = {
        asset: {
          hotWalletConfig: {
            fireblocks: { vaultId: 'hotvault789' }
          }
        }
      };
      const provider = {
        constructor: { getProviderName: () => 'fireblocks' }
      };

      const result = refillUtils.getHotWalletId(validatedData, provider);
      
      expect(result).toBe('hotvault789');
    });
  });

  describe('getWalletConfig', () => {
    it('should return success for valid Liminal config', () => {
      const walletConfig = {
        liminal: { walletId: 'wallet123' }
      };

      const result = refillUtils.getWalletConfig('liminal', walletConfig);

      expect(result.success).toBe(true);
      expect(result.data.walletConfig.liminal.walletId).toBe('wallet123');
    });

    it('should return error for missing Liminal walletId', () => {
      const walletConfig = {
        liminal: {}
      };

      const result = refillUtils.getWalletConfig('liminal', walletConfig);

      expect(result.success).toBe(false);
      expect(result.code).toBe('NO_LIMINAL_COLD_WALLET_CONFIGURED');
    });

    it('should return success for valid Fireblocks config', () => {
      const walletConfig = {
        fireblocks: { vaultId: 'vault1', assetId: 'BTC' }
      };

      const result = refillUtils.getWalletConfig('fireblocks', walletConfig);

      expect(result.success).toBe(true);
      expect(result.data.walletConfig.fireblocks.vaultId).toBe('vault1');
      expect(result.data.walletConfig.fireblocks.assetId).toBe('BTC');
    });

    it('should return error for missing Fireblocks assetId', () => {
      const walletConfig = {
        fireblocks: { vaultId: 'vault1' }
      };

      const result = refillUtils.getWalletConfig('fireblocks', walletConfig);

      expect(result.success).toBe(false);
      expect(result.code).toBe('NO_FIREBLOCKS_COLD_WALLET_CONFIGURED');
    });

    it('should return error for unsupported provider', () => {
      const result = refillUtils.getWalletConfig('unknown', {});

      expect(result.success).toBe(false);
      expect(result.code).toBe('UNSUPPORTED_PROVIDER');
    });
  });
});

