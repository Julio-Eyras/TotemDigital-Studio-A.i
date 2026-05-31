/**
 * Rotas API estendidas (Pro + Studio/compacto).
 * `registerCompactRoutes` regista a base operacional; este módulo acrescenta o restante.
 * Não duplicar prefixos já registados em `registerCompactRoutes`.
 */

import { Express } from 'express';
import clientRoutes from '../routes/clients';
import playlistMixRoutes from '../routes/playlist-mix';
import analyticsRoutes from '../routes/analytics';
import reportsRoutes from '../routes/reports';
import aiRoutes from '../routes/ai';
import smartPlaylistRoutes from '../routes/smart-playlist';
import exportQueriesRoutes from '../routes/export-queries';
import exportSchedulesRoutes from '../routes/export-schedules';
import exportExecutionsRoutes from '../routes/export-executions';
import advancedSchedulesRoutes from '../routes/advanced-schedules';
import emailRoutes from '../routes/email';
import otaUpdatesRoutes from '../routes/ota-updates';
import publishTemplatesRoutes from '../routes/publish-templates';
import menuCatalogRoutes from '../routes/menu-catalog';
import publishBoardRoutes from '../routes/publish-board';
import tagsRoutes from '../routes/tags';
import facialRecognitionRoutes from '../routes/facial-recognition';
import networkRoutes from '../routes/network';
import smartDisplayFxRoutes from '../routes/smartdisplayfx';
import smartDisplayFxEffectsRoutes from '../routes/smartdisplayfx-effects';
import smartDisplayFxRulesRoutes from '../routes/smartdisplayfx-rules';
import smartDisplayFxTimelinesRoutes from '../routes/smartdisplayfx-timelines';
import smartDisplayFxSitesRoutes from '../routes/smartdisplayfx-sites';
import smartDisplayFxTelemetryRoutes from '../routes/smartdisplayfx-telemetry';
import smartDisplayFxAnalyticsRoutes from '../routes/smartdisplayfx-analytics';
import rolesRoutes from '../routes/roles';
import usersRoutes from '../routes/users';
import permissionsRoutes from '../routes/permissions';
import webhooksRoutes from '../routes/webhooks';
import dashboardLayoutsRoutes from '../routes/dashboard-layouts';
import backupsRoutes from '../routes/backups';
import qrcodesRoutes from '../routes/qrcodes';
import notificationsRoutes from '../routes/notifications';
import { authMiddleware } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { rateLimitHeavyOperations } from '../middleware/rateLimitUser.middleware';

export function registerExtendedApiRoutes(app: Express): void {
  app.use('/api/clients', authMiddleware as any, blockClientDataAccess as any, (_req, res, next) => {
    res.setHeader('X-Deprecated-Route', 'true');
    res.setHeader('X-Deprecated-Message', 'Esta rota está deprecated. Use /api/subscribers');
    next();
  }, clientRoutes);

  app.use('/api/playlist-mix', authMiddleware as any, playlistMixRoutes);
  app.use('/api/analytics', blockClientDataAccess as any, analyticsRoutes);
  app.use('/api/reports', blockClientDataAccess as any, reportsRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/smart-playlist', blockClientDataAccess as any, smartPlaylistRoutes);
  app.use('/api/export-queries', exportQueriesRoutes);
  app.use('/api/export-schedules', exportSchedulesRoutes);
  app.use('/api/export-executions', exportExecutionsRoutes);
  app.use('/api/advanced-schedules', advancedSchedulesRoutes);
  app.use('/api/email', emailRoutes);
  app.use('/api/ota-updates', otaUpdatesRoutes);
  app.use('/api/publish-templates', publishTemplatesRoutes);
  app.use('/api/subscribers/:subscriberId/menu-catalog', menuCatalogRoutes);
  app.use('/api/subscribers/:subscriberId/publish-board', publishBoardRoutes);
  app.use('/api/tags', blockClientDataAccess as any, tagsRoutes);
  app.use('/api/facial-recognition', blockClientDataAccess as any, facialRecognitionRoutes);
  app.use('/api/network', networkRoutes);
  app.use('/api/smartdisplayfx', smartDisplayFxRoutes);
  app.use('/api/smartdisplayfx/effects', smartDisplayFxEffectsRoutes);
  app.use('/api/smartdisplayfx/rules', smartDisplayFxRulesRoutes);
  app.use('/api/smartdisplayfx/timelines', smartDisplayFxTimelinesRoutes);
  app.use('/api/smartdisplayfx/sites', smartDisplayFxSitesRoutes);
  app.use('/api/smartdisplayfx/telemetry', smartDisplayFxTelemetryRoutes);
  app.use('/api/smartdisplayfx/analytics', smartDisplayFxAnalyticsRoutes);
  app.use('/api/roles', rolesRoutes);
  app.use('/api/users', blockClientDataAccess as any, usersRoutes);
  app.use('/api/permissions', permissionsRoutes);
  app.use('/api/webhooks', webhooksRoutes);
  app.use('/api/dashboard-layouts', dashboardLayoutsRoutes);
  app.use('/api/backups', rateLimitHeavyOperations, backupsRoutes);
  app.use('/api/qrcodes', authMiddleware as any, blockClientDataAccess as any, qrcodesRoutes);
  // Alias usado pelo frontend (GET /api/qr-codes)
  app.use('/api/qr-codes', authMiddleware as any, blockClientDataAccess as any, qrcodesRoutes);
  app.use('/api/notifications', notificationsRoutes);
}
