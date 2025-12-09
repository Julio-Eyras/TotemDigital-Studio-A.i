/**
 * Admin SQL Middleware
 * Requer role ADMIN_SQL para acesso a funcionalidades críticas
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Middleware para requerer role ADMIN_SQL
 * ADMIN_SQL tem acesso total ao sistema e dados gerais da base de dados
 */
export const requireAdminSql = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Usuário não autenticado',
      code: 'NOT_AUTHENTICATED'
    });
    return;
  }

  if (req.user.role !== 'admin_sql') {
    res.status(403).json({
      error: 'Acesso negado. Requer role ADMIN_SQL.',
      code: 'ADMIN_SQL_REQUIRED',
      current: req.user.role
    });
    return;
  }

  next();
};

