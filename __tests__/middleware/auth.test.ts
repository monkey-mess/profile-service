import { Request, Response, NextFunction } from 'express';
import authenticateToken from '../../middleware/auth';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

describe('authenticateToken middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockNext = jest.fn();

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    process.env.SECRET_KEY = 'test-secret-key';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.SECRET_KEY;
  });

  it('должен вызвать next() при валидном токене', () => {
    const token = 'valid-token';
    const decoded = { userId: 'user-123' };

    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    (jwt.verify as jest.Mock).mockImplementation((_token, _secret, callback) => {
      callback(null, decoded);
    });

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(jwt.verify).toHaveBeenCalledWith(
      token,
      'test-secret-key',
      expect.any(Function)
    );
    expect(mockRequest.user).toEqual({ userId: 'user-123' });
    expect(mockNext).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('должен вернуть 401 если токен отсутствует', () => {
    mockRequest.headers = {};

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('должен вернуть 401 если заголовок authorization отсутствует', () => {
    mockRequest.headers = {};

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('должен вернуть 403 при невалидном токене', () => {
    const token = 'invalid-token';

    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    (jwt.verify as jest.Mock).mockImplementation((_token, _secret, callback) => {
      callback(new Error('Invalid token'), null);
    });

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('должен вернуть 500 если SECRET_KEY не установлен', () => {
    delete process.env.SECRET_KEY;

    mockRequest.headers = {
      authorization: 'Bearer some-token',
    };

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Server configuration error' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('должен извлечь токен из заголовка Bearer', () => {
    const token = 'extracted-token';
    const decoded = { id: 'user-123' };

    mockRequest.headers = {
      authorization: `Bearer ${token}`,
    };

    (jwt.verify as jest.Mock).mockImplementation((_token, _secret, callback) => {
      callback(null, decoded);
    });

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(jwt.verify).toHaveBeenCalledWith(
      token,
      'test-secret-key',
      expect.any(Function)
    );
  });
});

