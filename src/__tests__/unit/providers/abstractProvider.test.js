const AbstractProvider = require('../../../providers/abstractProvider');

describe('AbstractProvider', () => {
  let provider;
  let config;
  let secret;

  beforeEach(() => {
    config = { apiUrl: 'https://api.example.com' };
    secret = { apiKey: 'test-key' };
    provider = new AbstractProvider(config, secret);
  });

  describe('constructor', () => {
    it('should initialize with config and secret', () => {
      expect(provider.config).toEqual(config);
      expect(provider.secret).toEqual(secret);
    });
  });

  describe('config getter/setter', () => {
    it('should get config', () => {
      expect(provider.config).toEqual(config);
    });

    it('should set config', () => {
      const newConfig = { apiUrl: 'https://new-api.com' };
      provider.config = newConfig;
      
      expect(provider.config).toEqual(newConfig);
    });
  });

  describe('secret getter/setter', () => {
    it('should get secret', () => {
      expect(provider.secret).toEqual(secret);
    });

    it('should set secret', () => {
      const newSecret = { apiKey: 'new-key' };
      provider.secret = newSecret;
      
      expect(provider.secret).toEqual(newSecret);
    });
  });

  describe('init', () => {
    it('should have default implementation that returns undefined', async () => {
      const result = await provider.init();
      expect(result).toBeUndefined();
    });
  });

  describe('getTokenBalance', () => {
    it('should throw error if not implemented by child class', async () => {
      await expect(provider.getTokenBalance({})).rejects.toThrow(
        'getTokenBalance() method must be implemented by provider'
      );
    });
  });

  describe('createTransferRequest', () => {
    it('should throw error if not implemented by child class', async () => {
      await expect(provider.createTransferRequest({})).rejects.toThrow(
        'createTransferRequest() method must be implemented by provider'
      );
    });
  });

  describe('getProviderName', () => {
    it('should throw error if not implemented by child class', () => {
      expect(() => AbstractProvider.getProviderName()).toThrow(
        'getProviderName() method must be implemented by provider'
      );
    });
  });
});

