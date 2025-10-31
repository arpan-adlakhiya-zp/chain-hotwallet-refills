const { sendErrorResponse } = require('../../../utils/utils');

describe('Utils - sendErrorResponse', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  it('should send error response with default 500 code', () => {
    const error = {
      message: 'Something went wrong'
    };

    sendErrorResponse(mockRes, error);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 500,
        message: 'Something went wrong'
      })
    );
  });

  it('should use error code when provided', () => {
    const error = {
      code: 404,
      message: 'Not found'
    };

    sendErrorResponse(mockRes, error);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 404,
        message: 'Not found'
      })
    );
  });

  it('should normalize non-number error codes to 500', () => {
    const error = {
      code: 'INVALID_CODE',
      message: 'Error'
    };

    sendErrorResponse(mockRes, error);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it('should normalize error codes below 400 to 500', () => {
    const error = {
      code: 200, // Success code used as error
      message: 'Error'
    };

    sendErrorResponse(mockRes, error);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it('should normalize error codes above 599 to 500', () => {
    const error = {
      code: 600, // Out of range
      message: 'Error'
    };

    sendErrorResponse(mockRes, error);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it('should include stack trace when provided', () => {
    const error = {
      code: 500,
      message: 'Error',
      stack: 'Error stack trace'
    };

    sendErrorResponse(mockRes, error);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: 'Error stack trace'
      })
    );
  });

  it('should handle error with default message for typo', () => {
    const error = {
      code: 500
    };

    sendErrorResponse(mockRes, error);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unkown error' // Note: keeping the typo that exists in code
      })
    );
  });
});

