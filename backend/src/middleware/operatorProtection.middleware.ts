/**
 * Operator Protection Middleware
 * Bloqueia acesso de OPERATOR a dados de clientes
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { logWarn } from '../utils/loggerHelper';

/**
 * Middleware para bloquear acesso de OPERATOR a dados de clientes
 * OPERATOR só pode acessar dados técnicos do sistema, não dados privados de clientes
 */
export const blockClientDataAccess = (
  req: Request | AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.role === 'operator') {
    // Recursos bloqueados para OPERATOR (dados de clientes)
    const blockedResources = [
      'campaigns',
      'quick-publish',
      'simple-publish',
      'medias',
      'playlists',
      'reports',
      'billing',
      'clients',
      'analytics',
      'subscribers',
    ];

    const fullPath = String(req.originalUrl || req.baseUrl + req.path || req.path);
    const clientDataPaths = [
      '/menu-catalog',
      '/publish-board',
      '/quick-publish',
      '/simple-publish',
    ];
    if (clientDataPaths.some((segment) => fullPath.includes(segment))) {
      logWarn('OPERATOR tentou acessar dados de cliente (rota aninhada)', {
        userId: authReq.user.id,
        username: authReq.user.username,
        path: fullPath,
        method: req.method,
      });
      res.status(403).json({
        error: 'Acesso negado. Operadores não podem acessar dados de clientes.',
        code: 'CLIENT_DATA_ACCESS_DENIED',
        resource: 'subscribers',
      });
      return;
    }

    // Extrair recurso da URL
    const pathParts = req.path.split('/').filter(p => p);
    const resource = pathParts[1]; // Ex: /api/campaigns -> campaigns

    if (blockedResources.includes(resource)) {
      logWarn('OPERATOR tentou acessar dados de cliente', {
        userId: authReq.user.id,
        username: authReq.user.username,
        resource,
        path: req.path,
        method: req.method
      });

      res.status(403).json({
        error: 'Acesso negado. Operadores não podem acessar dados de clientes.',
        code: 'CLIENT_DATA_ACCESS_DENIED',
        resource
      });
      return;
    }

    // SmartDisplayFX: Permitir apenas config/logs técnicos, bloquear dados de clientes
    if (resource === 'smartdisplayfx') {
      const action = pathParts[2]; // Ex: /api/smartdisplayfx/logs -> logs
      const allowedActions = ['logs', 'config'];
      
      if (!allowedActions.includes(action)) {
        logWarn('OPERATOR tentou acessar dados de SmartDisplayFX do cliente', {
          userId: authReq.user.id,
          username: authReq.user.username,
          action,
          path: req.path
        });

        res.status(403).json({
          error: 'Acesso negado. Operadores só podem acessar logs/config técnicos do SmartDisplayFX.',
          code: 'CLIENT_DATA_ACCESS_DENIED',
          resource: 'smartdisplayfx'
        });
        return;
      }
    }

    // Totens: Permitir apenas ações técnicas, bloquear dados de campanhas/playlists
    if (resource === 'totems') {
      const action = pathParts[2]; // Ex: /api/totems/restart -> restart
      const allowedActions = ['restart', 'screenshot', 'logs', 'status'];
      
      // Se não for uma ação técnica permitida, verificar se está tentando acessar dados do cliente
      if (!allowedActions.includes(action)) {
        // Permitir GET /api/totems (lista) mas bloquear acesso a dados de campanhas/playlists
        if (req.method === 'GET' && pathParts.length === 2) {
          // Permitir listar totens (apenas dados técnicos)
          next();
          return;
        }
        
        // Bloquear outras ações que podem expor dados do cliente
        logWarn('OPERATOR tentou acessar dados de totem do cliente', {
          userId: authReq.user.id,
          username: authReq.user.username,
          action,
          path: req.path
        });

        res.status(403).json({
          error: 'Acesso negado. Operadores só podem acessar dados técnicos dos totens.',
          code: 'CLIENT_DATA_ACCESS_DENIED',
          resource: 'totems'
        });
        return;
      }
    }
  }

  next();
};

