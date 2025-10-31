const { doHealthCheckController } = require('../../../controller/healthCheckController');
const { doHealthCheckService } = require('../../../service/healthCheckService');

jest.mock('../../../service/healthCheckService');

describe('HealthCheckController', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('doHealthCheckController', () => {
    it('should return 200 with health data when service succeeds', async () => {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: { database: 'healthy', api: 'healthy' },
        version: '1.0.0'
      };

      doHealthCheckService.mockResolvedValue(healthData);

      await doHealthCheckController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(healthData);
      expect(doHealthCheckService).toHaveBeenCalled();
    });

    it('should return 500 when service throws error', async () => {
      doHealthCheckService.mockRejectedValue(new Error('Service unavailable'));

      await doHealthCheckController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'unhealthy',
        error: 'Service unavailable'
      });
    });

    it('should handle database connection errors', async () => {
      doHealthCheckService.mockRejectedValue(new Error('Database connection timeout'));

      await doHealthCheckController(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          error: expect.stringContaining('Database')
        })
      );
    });
  });
});

