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
import publishBoardPublicRoutes from '../routes/publish-board-public';
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
import { requireModule } from '../middleware/moduleAuth.middleware';
import { requireFeatureNotDeferred } from '../middleware/deferredFeature.middleware';

export function registerExtendedApiRoutes(app: Express): void {
  app.use(
    '/api/clients',
    authMiddleware as any,
    requireModule('subscribers') as any,
    blockClientDataAccess as any,
    (_req, res, next) => {
    res.setHeader('X-Deprecated-Route', 'true');
    res.setHeader('X-Deprecated-Message', 'Esta rota está deprecated. Use /api/subscribers');
    next();
  }, clientRoutes);

  app.use('/api/playlist-mix', authMiddleware as any, requireModule('dispatcher_admin') as any, playlistMixRoutes);
  app.use('/api/analytics', requireModule('analytics') as any, blockClientDataAccess as any, analyticsRoutes);
  app.use('/api/reports', requireModule('commercial_reports') as any, blockClientDataAccess as any, reportsRoutes);
  app.use('/api/ai', requireModule('analytics') as any, aiRoutes);
  app.use(
    '/api/smart-playlist',
    requireModule('playlists_advanced') as any,
    blockClientDataAccess as any,
    smartPlaylistRoutes
  );
  app.use('/api/export-queries', requireModule('dispatcher_admin') as any, exportQueriesRoutes);
  app.use('/api/export-schedules', requireModule('dispatcher_admin') as any, exportSchedulesRoutes);
  app.use('/api/export-executions', requireModule('dispatcher_admin') as any, exportExecutionsRoutes);
  app.use('/api/advanced-schedules', requireModule('dispatcher_admin') as any, advancedSchedulesRoutes);
  app.use('/api/email', emailRoutes);
  app.use('/api/ota-updates', requireModule('ota') as any, otaUpdatesRoutes);
  app.use('/api/publish-templates', requireModule('quick_publish') as any, publishTemplatesRoutes);
  app.use(
    '/api/subscribers/:subscriberId/menu-catalog',
    requireModule('quick_publish') as any,
    menuCatalogRoutes
  );
  app.use('/api/publish-board', publishBoardPublicRoutes);
  app.use(
    '/api/subscribers/:subscriberId/publish-board',
    requireModule('quick_publish') as any,
    publishBoardRoutes
  );
  app.use(
    '/api/tags',
    requireFeatureNotDeferred('tags_crud') as any,
    blockClientDataAccess as any,
    tagsRoutes
  );
  app.use(
    '/api/facial-recognition',
    requireFeatureNotDeferred('facial_recognition') as any,
    blockClientDataAccess as any,
    facialRecognitionRoutes
  );
  app.use('/api/network', networkRoutes);
  app.use('/api/smartdisplayfx', requireModule('smart_display_fx') as any, smartDisplayFxRoutes);
  app.use('/api/smartdisplayfx/effects', requireModule('smart_display_fx') as any, smartDisplayFxEffectsRoutes);
  app.use('/api/smartdisplayfx/rules', requireModule('smart_display_fx') as any, smartDisplayFxRulesRoutes);
  app.use('/api/smartdisplayfx/timelines', requireModule('smart_display_fx') as any, smartDisplayFxTimelinesRoutes);
  app.use('/api/smartdisplayfx/sites', requireModule('smart_display_fx') as any, smartDisplayFxSitesRoutes);
  app.use('/api/smartdisplayfx/telemetry', requireModule('smart_display_fx') as any, smartDisplayFxTelemetryRoutes);
  app.use('/api/smartdisplayfx/analytics', requireModule('smart_display_fx') as any, smartDisplayFxAnalyticsRoutes);
  app.use('/api/roles', rolesRoutes);
  app.use('/api/users', blockClientDataAccess as any, usersRoutes);
  app.use('/api/permissions', permissionsRoutes);
  app.use('/api/webhooks', webhooksRoutes);
  app.use('/api/dashboard-layouts', dashboardLayoutsRoutes);
  app.use('/api/backups', rateLimitHeavyOperations, backupsRoutes);
  app.use('/api/qrcodes', authMiddleware as any, blockClientDataAccess as any, qrcodesRoutes);
  // Alias usado pelo frontend (GET /api/qr-codes)
  app.use('/api/qr-codes', authMiddleware as any, blockClientDataAccess as any, qrcodesRoutes);
  app.use(
    '/api/notifications',
    requireFeatureNotDeferred('notifications') as any,
    notificationsRoutes
  );
}
