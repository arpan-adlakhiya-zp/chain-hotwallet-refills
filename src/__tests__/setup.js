/**
 * Global Jest Setup
 * This file runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Mock Liminal SDK to prevent import errors (WIP integration)
jest.mock('@lmnl/liminaljs', () => ({
  LiminalJs: jest.fn(),
  CoinsEnum: {},
  LiminalEnvironment: {}
}));

// Mock logger to prevent console spam during tests
jest.mock('../middleware/logger', () => {
  return jest.fn().mockImplementation((moduleName) => {
    return {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });
});

// Global test utilities
global.createMockProvider = (providerName = 'fireblocks') => {
  return {
    constructor: {
      getProviderName: () => providerName
    },
    init: jest.fn().mockResolvedValue({ success: true }),
    getTokenBalance: jest.fn(),
    createTransferRequest: jest.fn(),
    validateCredentials: jest.fn().mockResolvedValue({ success: true }),
    getTransactionById: jest.fn() // Fireblocks specific
  };
};

global.createMockAsset = (overrides = {}) => {
  return {
    id: 1,
    symbol: 'BTC',
    decimals: 8,
    contractAddress: 'native',
    refillSweepWallet: '0xcold',
    sweepWalletConfig: {
      provider: 'fireblocks',
      fireblocks: { vaultId: '1', assetId: 'BTC' }
    },
    hotWalletConfig: {
      provider: 'fireblocks',
      fireblocks: { vaultId: '2', assetId: 'BTC' }
    },
    refillTargetBalanceAtomic: '100000000',
    refillTriggerThresholdAtomic: '50000000',
    Blockchain: {
      id: 1,
      symbol: 'BTC',
      name: 'Bitcoin'
    },
    Wallet: {
      id: 1,
      address: '0xhot',
      walletType: 'hot'
    },
    ...overrides
  };
};

global.createMockBlockchain = (overrides = {}) => {
  return {
    id: 1,
    name: 'Bitcoin',
    symbol: 'BTC',
    chainId: '0',
    nativeAssetSymbol: 'BTC',
    isActive: true,
    ...overrides
  };
};

global.createMockWallet = (overrides = {}) => {
  return {
    id: 1,
    address: '0x123',
    name: 'Hot Wallet',
    walletType: 'hot',
    monitorStatus: 'active',
    blockchainId: 1,
    Blockchain: {
      symbol: 'BTC'
    },
    ...overrides
  };
};

// Cleanup after all tests
afterAll(() => {
  jest.restoreAllMocks();
});

