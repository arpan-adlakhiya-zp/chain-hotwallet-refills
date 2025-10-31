const { doHealthCheckService } = require('../../../service/healthCheckService');
const databaseService = require('../../../service/chainDb');

jest.mock('../../../service/chainDb');

describe('HealthCheckService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('doHealthCheckService', () => {
    it('should return healthy status when database is connected', async () => {
      databaseService.healthCheck.mockResolvedValue({
        status: 'healthy',
        message: 'Database connection is active'
      });

      const result = await doHealthCheckService();

      expect(result.status).toBe('healthy');
      expect(result.services.database).toBe('healthy');
      expect(result.services.api).toBe('healthy');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('version');
      expect(databaseService.healthCheck).toHaveBeenCalled();
    });

    it('should include timestamp in ISO format', async () => {
      databaseService.healthCheck.mockResolvedValue({ status: 'healthy' });

      const result = await doHealthCheckService();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include version from package.json', async () => {
      databaseService.healthCheck.mockResolvedValue({ status: 'healthy' });

      const result = await doHealthCheckService();

      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('string');
    });

    it('should return unhealthy status when database fails', async () => {
      databaseService.healthCheck.mockRejectedValue(new Error('Connection timeout'));

      const result = await doHealthCheckService();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('Connection timeout');
      expect(result.services.database).toBe('unhealthy');
      expect(result.services.api).toBe('healthy');
    });

    it('should handle database returning unhealthy status', async () => {
      databaseService.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        message: 'Cannot connect'
      });

      const result = await doHealthCheckService();

      expect(result.services.database).toBe('unhealthy');
    });
  });
});

