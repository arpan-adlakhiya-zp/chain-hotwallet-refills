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

  describe('validateCredentials', () => {
    it('should throw error if not implemented by child class', async () => {
      await expect(provider.validateCredentials()).rejects.toThrow(
        'validateCredentials() method must be implemented by provider'
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

  describe('getHealthStatus', () => {
    it('should return healthy when validateCredentials succeeds', async () => {
      provider.validateCredentials = jest.fn().mockResolvedValue({
        success: true
      });

      const result = await provider.getHealthStatus();

      expect(result.success).toBe(true);
      expect(result.status).toBe('healthy');
    });

    it('should return unhealthy when validateCredentials fails', async () => {
      provider.validateCredentials = jest.fn().mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
        code: 'AUTH_ERROR'
      });

      const result = await provider.getHealthStatus();

      expect(result.success).toBe(false);
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Invalid credentials');
      expect(result.code).toBe('AUTH_ERROR');
    });

    it('should handle exceptions during validation', async () => {
      provider.validateCredentials = jest.fn().mockRejectedValue(
        new Error('Network timeout')
      );

      const result = await provider.getHealthStatus();

      expect(result.success).toBe(false);
      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('Network timeout');
      expect(result.code).toBe('HEALTH_CHECK_ERROR');
    });
  });
});

