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
            liminal: { 
              walletId: 'lim123',
              tokenSymbol: 'USDT',
              version: '2'
            }
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
    it('should return success for valid Liminal config with all required fields', () => {
      const walletConfig = {
        liminal: { 
          walletId: 'wallet123',
          tokenSymbol: 'USDT',
          version: '2'
        }
      };

      const result = refillUtils.getWalletConfig('liminal', walletConfig);

      expect(result.success).toBe(true);
      expect(result.data.walletConfig.liminal.walletId).toBe('wallet123');
      expect(result.data.walletConfig.liminal.tokenSymbol).toBe('USDT');
      expect(result.data.walletConfig.liminal.version).toBe('2');
    });

    it('should return error for missing Liminal walletId', () => {
      const walletConfig = {
        liminal: {
          tokenSymbol: 'USDT',
          version: '2'
        }
      };

      const result = refillUtils.getWalletConfig('liminal', walletConfig);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_LIMINAL_COLD_WALLET_CONFIGURATION');
    });

    it('should return error for missing Liminal tokenSymbol', () => {
      const walletConfig = {
        liminal: {
          walletId: 'wallet123',
          version: '2'
        }
      };

      const result = refillUtils.getWalletConfig('liminal', walletConfig);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_LIMINAL_COLD_WALLET_CONFIGURATION');
    });

    it('should return error for missing Liminal version', () => {
      const walletConfig = {
        liminal: {
          walletId: 'wallet123',
          tokenSymbol: 'USDT'
        }
      };

      const result = refillUtils.getWalletConfig('liminal', walletConfig);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_LIMINAL_COLD_WALLET_CONFIGURATION');
    });

    it('should return error for empty Liminal config', () => {
      const walletConfig = {
        liminal: {}
      };

      const result = refillUtils.getWalletConfig('liminal', walletConfig);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_LIMINAL_COLD_WALLET_CONFIGURATION');
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
      expect(result.code).toBe('INVALID_FIREBLOCKS_COLD_WALLET_CONFIGURATION');
    });

    it('should return error for unsupported provider', () => {
      const result = refillUtils.getWalletConfig('unknown', {});

      expect(result.success).toBe(false);
      expect(result.code).toBe('UNSUPPORTED_PROVIDER');
    });
  });

  describe('buildTransactionUpdateData', () => {
    it('should return empty update when nothing changed', () => {
      const transaction = {
        status: 'PROCESSING',
        providerStatus: 'SUBMITTED',
        txHash: '0xabc',
        message: 'Processing'
      };

      const transactionDetails = {
        status: 'SUBMITTED',
        txHash: '0xabc',
        message: 'Processing',
        providerData: {}
      };

      const result = refillUtils.buildTransactionUpdateData(
        transaction,
        transactionDetails,
        'PROCESSING'  // Same mapped status
      );

      expect(result.hasChanges).toBe(false);
      expect(result.updateData).toEqual({});
    });

    it('should include only changed fields', () => {
      const transaction = {
        status: 'PROCESSING',
        providerStatus: 'SUBMITTED',
        txHash: null,
        message: null
      };

      const transactionDetails = {
        status: 'BROADCASTING',  // Changed
        txHash: '0xnew',         // Changed
        message: 'Broadcasting',  // Changed
        providerData: { id: 'fb-123' }
      };

      const result = refillUtils.buildTransactionUpdateData(
        transaction,
        transactionDetails,
        'PROCESSING'  // Still PROCESSING
      );

      expect(result.hasChanges).toBe(true);
      expect(result.updateData).toHaveProperty('providerStatus');
      expect(result.updateData).toHaveProperty('txHash');
      expect(result.updateData).toHaveProperty('message');
      expect(result.updateData).toHaveProperty('providerData');
      expect(result.updateData).not.toHaveProperty('status'); // Status unchanged
      
      expect(result.updateData.providerStatus).toBe('BROADCASTING');
      expect(result.updateData.txHash).toBe('0xnew');
      expect(result.updateData.message).toBe('Broadcasting');
    });

    it('should update status when mapped status changes', () => {
      const transaction = {
        status: 'PROCESSING',
        providerStatus: 'BROADCASTING'
      };

      const transactionDetails = {
        status: 'COMPLETED',
        providerData: {}
      };

      const result = refillUtils.buildTransactionUpdateData(
        transaction,
        transactionDetails,
        'COMPLETED'  // Changed from PROCESSING
      );

      expect(result.hasChanges).toBe(true);
      expect(result.updateData.status).toBe('COMPLETED');
      expect(result.updateData.providerStatus).toBe('COMPLETED');
    });

    it('should include providerData when providerStatus changes', () => {
      const transaction = {
        status: 'PROCESSING',
        providerStatus: 'SUBMITTED'
      };

      const transactionDetails = {
        status: 'PENDING_SIGNATURE',
        providerData: { full: 'response' }
      };

      const result = refillUtils.buildTransactionUpdateData(
        transaction,
        transactionDetails,
        'PROCESSING'
      );

      expect(result.hasChanges).toBe(true);
      expect(result.updateData.providerStatus).toBe('PENDING_SIGNATURE');
      expect(result.updateData.providerData).toEqual({ full: 'response' });
    });

    it('should not update providerData if providerStatus unchanged', () => {
      const transaction = {
        status: 'PROCESSING',
        providerStatus: 'SUBMITTED',
        txHash: null
      };

      const transactionDetails = {
        status: 'SUBMITTED',  // Same
        txHash: '0xnew',      // Changed
        providerData: { data: 'here' }
      };

      const result = refillUtils.buildTransactionUpdateData(
        transaction,
        transactionDetails,
        'PROCESSING'
      );

      expect(result.hasChanges).toBe(true);
      expect(result.updateData).toHaveProperty('txHash');
      expect(result.updateData).not.toHaveProperty('providerData'); // Not updated
    });

    it('should handle null/undefined values correctly', () => {
      const transaction = {
        status: 'PROCESSING',
        providerStatus: 'SUBMITTED',
        txHash: '0xold',
        message: 'Old message'
      };

      const transactionDetails = {
        status: 'BROADCASTING',
        txHash: null,           // Null shouldn't update
        message: undefined,     // Undefined shouldn't update
        providerData: {}
      };

      const result = refillUtils.buildTransactionUpdateData(
        transaction,
        transactionDetails,
        'PROCESSING'
      );

      expect(result.hasChanges).toBe(true);
      expect(result.updateData).toHaveProperty('providerStatus');
      expect(result.updateData).not.toHaveProperty('txHash');  // Null ignored
      expect(result.updateData).not.toHaveProperty('message'); // Undefined ignored
    });
  });
});

