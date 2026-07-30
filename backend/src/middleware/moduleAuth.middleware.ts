/**
 * Middleware: exige módulo de produto activo na instalação.
 * Distinto de requireFlag (permissão por utilizador).
 */
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { InstallationModuleId, isInstallationModuleEnabled } from '../policy/installationModules';
import { resolveInstallationCapabilities } from '../services/installationProfileService';
import { createDatabaseWrapper } from '../config/database-pg';
import { logError } from '../utils/loggerHelper';

export const requireModule = (moduleId: InstallationModuleId) => {
  return async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const db = createDatabaseWrapper();
      const caps = await resolveInstallationCapabilities(db);
      if (!isInstallationModuleEnabled(caps.modules, moduleId)) {
        res.status(403).json({
          success: false,
          error: 'Módulo desactivado nesta instalação. Active-o em Complementos do sistema.',
          code: 'MODULE_DISABLED',
          module: moduleId,
        });
        return;
      }
      next();
    } catch (error: any) {
      logError('Erro ao verificar módulo da instalação', error).catch(() => {});
      res.status(500).json({
        success: false,
        error: 'Erro interno ao verificar módulos',
        code: 'MODULE_CHECK_ERROR',
      });
    }
  };
};

/** Exige pelo menos um dos módulos (OR). */
export const requireAnyModule = (moduleIds: InstallationModuleId[]) => {
  return async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const db = createDatabaseWrapper();
      const caps = await resolveInstallationCapabilities(db);
      const ok = moduleIds.some((id) => isInstallationModuleEnabled(caps.modules, id));
      if (!ok) {
        res.status(403).json({
          success: false,
          error: 'Nenhum dos módulos necessários está activo nesta instalação.',
          code: 'MODULE_DISABLED',
          modules: moduleIds,
        });
        return;
      }
      next();
    } catch (error: any) {
      logError('Erro ao verificar módulos da instalação', error).catch(() => {});
      res.status(500).json({
        success: false,
        error: 'Erro interno ao verificar módulos',
        code: 'MODULE_CHECK_ERROR',
      });
    }
  };
};
