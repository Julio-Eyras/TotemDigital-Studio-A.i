/**
 * Validate Action Middleware
 * Valida se uma role pode executar uma ação específica em um recurso
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Mapeamento de roles e ações permitidas por recurso
 */
const roleResourceActions: Record<string, Record<string, string[]>> = {
  'admin': {
    '*': ['read', 'create', 'update', 'delete'], // Todas as ações em todos os recursos
  },
  'gerente_marketing': {
    'campaigns': ['read', 'create', 'update', 'delete'],
    'medias': ['read', 'create', 'update', 'delete'],
    'playlists': ['read', 'create', 'update', 'delete'],
    'smart-playlist': ['read', 'create', 'update', 'delete'],
    'reports': ['read', 'create'],
    'analytics': ['read'],
    'qr-codes': ['read', 'create', 'update', 'delete'],
    'tags': ['read', 'create', 'update', 'delete'],
    'smartdisplayfx': ['read', 'create', 'update', 'delete'],
    'ai': ['read', 'create', 'update', 'delete'],
    'totems': ['read'],
  },
  'editoracao': {
    'medias': ['read', 'create', 'update', 'delete'],
    'tags': ['read', 'create'],
    'campaigns': ['read'], // Apenas leitura para contexto
    'playlists': ['read'], // Apenas leitura para contexto
  },
  'visualizador': {
    '*': ['read'], // Apenas leitura em todos os recursos
  },
};

/**
 * Middleware para validar ação baseada em role e recurso
 */
export const validateAction = (resource: string, action: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const userRole = req.user.role;

    // ADMIN_SQL e OPERATOR sempre permitidos (validação separada)
    if (userRole === 'admin_sql' || userRole === 'operator') {
      next();
      return;
    }

    // ADMIN sempre permitido para recursos do cliente
    if (userRole === 'admin') {
      next();
      return;
    }

    // Verificar permissões específicas da role
    const rolePermissions = roleResourceActions[userRole];
    if (!rolePermissions) {
      res.status(403).json({
        error: 'Role não possui permissões configuradas',
        code: 'ROLE_NOT_CONFIGURED',
        role: userRole
      });
      return;
    }

    // Verificar permissão específica do recurso ou wildcard
    const resourcePermissions = rolePermissions[resource] || rolePermissions['*'];
    if (!resourcePermissions) {
      res.status(403).json({
        error: 'Acesso negado ao recurso',
        code: 'RESOURCE_ACCESS_DENIED',
        role: userRole,
        resource
      });
      return;
    }

    // Verificar se a ação é permitida
    if (!resourcePermissions.includes(action)) {
      res.status(403).json({
        error: 'Ação não permitida para sua role',
        code: 'ACTION_NOT_ALLOWED',
        role: userRole,
        resource,
        action,
        allowed: resourcePermissions
      });
      return;
    }

    next();
  };
};

/**
 * Helper para validar múltiplas ações
 */
export const validateAnyAction = (resource: string, actions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const userRole = req.user.role;

    // ADMIN_SQL, OPERATOR e ADMIN sempre permitidos
    if (userRole === 'admin_sql' || userRole === 'operator' || userRole === 'admin') {
      next();
      return;
    }

    // Verificar se pelo menos uma ação é permitida
    const rolePermissions = roleResourceActions[userRole];
    if (!rolePermissions) {
      res.status(403).json({
        error: 'Role não possui permissões configuradas',
        code: 'ROLE_NOT_CONFIGURED',
        role: userRole
      });
      return;
    }

    const resourcePermissions = rolePermissions[resource] || rolePermissions['*'];
    if (!resourcePermissions) {
      res.status(403).json({
        error: 'Acesso negado ao recurso',
        code: 'RESOURCE_ACCESS_DENIED',
        role: userRole,
        resource
      });
      return;
    }

    const hasPermission = actions.some(action => resourcePermissions.includes(action));
    if (!hasPermission) {
      res.status(403).json({
        error: 'Nenhuma das ações é permitida para sua role',
        code: 'ACTIONS_NOT_ALLOWED',
        role: userRole,
        resource,
        requested: actions,
        allowed: resourcePermissions
      });
      return;
    }

    next();
  };
};

