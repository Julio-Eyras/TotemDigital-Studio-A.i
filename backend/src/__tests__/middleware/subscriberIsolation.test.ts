/**
 * Subscriber Isolation Middleware Tests
 * Testes para validação de isolamento de dados por subscriber
 */

import { Request, Response, NextFunction } from 'express';
import { subscriberIsolationMiddleware } from '../../middleware/subscriberIsolation.middleware';
// logWarn removido - não utilizado

jest.mock('../../utils/loggerHelper', () => ({
  logWarn: jest.fn(),
}));

describe('SubscriberIsolationMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 1,
        userId: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'subscriber',
        subscriberId: 1,
      },
      query: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve permitir acesso quando usuário tem subscriberId', () => {
    subscriberIsolationMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('deve definir subscriberId no request quando usuário é subscriber', () => {
    subscriberIsolationMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect((mockRequest as any).subscriberId).toBe(1);
    expect(mockNext).toHaveBeenCalled();
  });

  it('deve permitir acesso quando usuário é admin', () => {
    mockRequest.user = {
      id: 1,
      userId: 1,
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      subscriberId: undefined,
    };

    subscriberIsolationMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('deve bloquear acesso quando subscriber não identificado para role subscriber', () => {
    mockRequest.user = {
      id: 1,
      userId: 1,
      username: 'subscriber',
      email: 'subscriber@example.com',
      role: 'subscriber',
      subscriberId: undefined,
    };

    subscriberIsolationMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('deve usar subscriberId do request se disponível', () => {
    (mockRequest as any).subscriberId = 2;
    mockRequest.user = {
      id: 1,
      userId: 1,
      username: 'subscriber',
      email: 'subscriber@example.com',
      role: 'subscriber',
      subscriberId: 1,
    };

    subscriberIsolationMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect((mockRequest as any).subscriberId).toBe(2); // Prioriza o do request
    expect(mockNext).toHaveBeenCalled();
  });

  it('deve extrair subscriberId de subscriber_id se disponível', () => {
    mockRequest.user = {
      id: 1,
      userId: 1,
      username: 'subscriber',
      email: 'subscriber@example.com',
      role: 'subscriber',
      subscriberId: undefined,
    };
    (mockRequest.user as any).subscriber_id = 3;

    subscriberIsolationMiddleware(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    );

    expect((mockRequest as any).subscriberId).toBe(3);
    expect(mockNext).toHaveBeenCalled();
  });
});
