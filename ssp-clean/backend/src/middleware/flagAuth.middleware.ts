/**
 * Middleware de Autorização por Flags
 * Verifica se usuário tem flag específica antes de permitir acesso
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { hasFlag, FlagName } from '../utils/flagChecker';
import { logError } from '../utils/loggerHelper';

/**
 * Middleware para verificar flag específica
 * Uso: router.get('/route', requireFlag('flag_smart_0'), handler)
 */
export const requireFlag = (flag: FlagName) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }
    
    try {
      const userHasFlag = await hasFlag(req.user, flag);
      
      if (!userHasFlag) {
        res.status(403).json({
          error: 'Permissão insuficiente',
          code: 'INSUFFICIENT_PERMISSION',
          required_flag: flag,
          user_role: req.user.role
        });
        return;
      }
      
      next();
    } catch (error: any) {
      logError('Erro ao verificar flag', error).catch(() => {});
      res.status(500).json({
        error: 'Erro interno ao verificar permissões',
        code: 'FLAG_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware para verificar múltiplas flags (OR - pelo menos uma)
 */
export const requireAnyFlag = (flags: FlagName[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }
    
    try {
      for (const flag of flags) {
        const userHasFlag = await hasFlag(req.user, flag);
        if (userHasFlag) {
          next();
          return;
        }
      }
      
      res.status(403).json({
        error: 'Permissão insuficiente',
        code: 'INSUFFICIENT_PERMISSION',
        required_flags: flags,
        user_role: req.user.role
      });
    } catch (error: any) {
      logError('Erro ao verificar flags', error).catch(() => {});
      res.status(500).json({
        error: 'Erro interno ao verificar permissões',
        code: 'FLAG_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware para verificar múltiplas flags (AND - todas)
 */
export const requireAllFlags = (flags: FlagName[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }
    
    try {
      for (const flag of flags) {
        const userHasFlag = await hasFlag(req.user, flag);
        if (!userHasFlag) {
          res.status(403).json({
            error: 'Permissão insuficiente',
            code: 'INSUFFICIENT_PERMISSION',
            required_flag: flag,
            required_flags: flags,
            user_role: req.user.role
          });
          return;
        }
      }
      
      next();
    } catch (error: any) {
      logError('Erro ao verificar flags', error).catch(() => {});
      res.status(500).json({
        error: 'Erro interno ao verificar permissões',
        code: 'FLAG_CHECK_ERROR'
      });
    }
  };
};
