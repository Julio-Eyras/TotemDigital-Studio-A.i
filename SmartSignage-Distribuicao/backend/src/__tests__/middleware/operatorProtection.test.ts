/**
 * Tests for Operator Protection Middleware
 */

import { Response, NextFunction } from 'express';
import { blockClientDataAccess } from '../../middleware/operatorProtection.middleware';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

describe('blockClientDataAccess', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      user: undefined,
      path: '/api/campaigns',
      method: 'GET',
      headers: {}
    } as Partial<AuthenticatedRequest>;
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
  });

  it('should allow non-operator users to access client data', () => {
    mockRequest.user = {
      id: 1,
      userId: 1,
      username: 'admin',
      email: 'admin@test.com',
      role: 'admin',
      clientId: 1
    };

    blockClientDataAccess(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should block operator from accessing campaigns', () => {
    mockRequest.user = {
      id: 1,
      userId: 1,
      username: 'operator',
      email: 'operator@test.com',
      role: 'operator'
    };
    (mockRequest as any).path = '/api/campaigns';

    blockClientDataAccess(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Acesso negado. Operadores não podem acessar dados de clientes.',
        code: 'CLIENT_DATA_ACCESS_DENIED',
        resource: 'campaigns'
      })
    );
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should block operator from accessing medias', () => {
    mockRequest.user = {
      id: 1,
      userId: 1,
      username: 'operator',
      email: 'operator@test.com',
      role: 'operator'
    };
    (mockRequest as any).path = '/api/media';

    blockClientDataAccess(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should allow operator to access totem technical data (restart)', () => {
    mockRequest.user = {
      id: 1,
      userId: 1,
      username: 'operator',
      email: 'operator@test.com',
      role: 'operator'
    };
    (mockRequest as any).path = '/api/totems/123/restart';
    mockRequest.method = 'POST';

    blockClientDataAccess(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should allow operator to access totem logs', () => {
    mockRequest.user = {
      id: 1,
      userId: 1,
      username: 'operator',
      email: 'operator@test.com',
      role: 'operator'
    };
    (mockRequest as any).path = '/api/totems/123/logs';

    blockClientDataAccess(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should allow operator to access SmartDisplayFX logs', () => {
    mockRequest.user = {
      id: 1,
      userId: 1,
      username: 'operator',
      email: 'operator@test.com',
      role: 'operator'
    };
    (mockRequest as any).path = '/api/smartdisplayfx/logs';

    blockClientDataAccess(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should block operator from accessing SmartDisplayFX data (not logs/config)', () => {
    mockRequest.user = {
      id: 1,
      userId: 1,
      username: 'operator',
      email: 'operator@test.com',
      role: 'operator'
    };
    (mockRequest as any).path = '/api/smartdisplayfx/events';

    blockClientDataAccess(
      mockRequest as AuthenticatedRequest,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(nextFunction).not.toHaveBeenCalled();
  });
});

