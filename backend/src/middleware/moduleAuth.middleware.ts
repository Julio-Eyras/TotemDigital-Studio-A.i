/**
 * Middleware: exige módulo de produto activo na instalação.
 * Distinto de requireFlag (permissão por utilizador).
 */
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import {

  InstallationModuleId,
  INSTALLATION_MODULE_CATALOG,
  isInstallationModuleEnabled,
} from '../policy/installationModules';
import { resolveInstallationCapabilities } from '../services/installationProfileService';
import { createDatabaseWrapper } from '../config/database-pg';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

function moduleDisabledPayload(moduleId: InstallationModuleId | InstallationModuleId[]) {
  const ids = Array.isArray(moduleId) ? moduleId : [moduleId];
  const titles = ids.map(
    (id) => INSTALLATION_MODULE_CATALOG.find((m) => m.id === id)?.title || id
  );
  const multiRelated = ids.some((id) =>
    [
      'multi_agency',
      'subscribers',
      'contracts',
      'plans',
      'billing',
      'commercial_reports',
      'campaigns',
      'playlists_advanced',
      'quick_publish',
      'devices',
      'ota',
      'dispatcher_admin',
      'analytics',
      'subscriber_portal',
    ].includes(id)
  );
  return {
    success: false,
    error: multiRelated
      ? `Funcionalidade indisponível: «${titles.join('», «')}». Active o Modo multi-agência (ou o módulo em Opções avançadas) em Complementos do sistema.`
      : `Módulo desactivado nesta instalação: «${titles.join('», «')}». Active-o em Complementos do sistema.`,
    code: 'MODULE_DISABLED' as const,
    module: Array.isArray(moduleId) ? undefined : moduleId,
    modules: Array.isArray(moduleId) ? moduleId : undefined,
    hint: 'Complementos do sistema → Modo multi-agência',
  };
}

export const requireModule = (moduleId: InstallationModuleId) => {
  return async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const db = createDatabaseWrapper();
      const caps = await resolveInstallationCapabilities(db);
      if (!isInstallationModuleEnabled(caps.modules, moduleId)) {
        res.status(403).json(moduleDisabledPayload(moduleId));
        return;
      }
      next();} catch (error: unknown) {
      const e = normalizeError(error);
      logError('Erro ao verificar módulo da instalação', e.error).catch(() => {});
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
        res.status(403).json(moduleDisabledPayload(moduleIds));
        return;
      }
      next();} catch (error: unknown) {
      const e = normalizeError(error);
      logError('Erro ao verificar módulos da instalação', e.error).catch(() => {});
      res.status(500).json({
        success: false,
        error: 'Erro interno ao verificar módulos',
        code: 'MODULE_CHECK_ERROR',
    });
    }
  };
};
