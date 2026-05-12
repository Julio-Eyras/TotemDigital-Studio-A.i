import { Express } from 'express';
import clientRoutes from '../routes/clients';
import subscriberRoutes from '../routes/subscribers';
import publisherRoutes from '../routes/publishers';
import subscriberAccessRoutes from '../routes/subscriber-access';
import contractRoutes from '../routes/contracts';
import playlistMixRoutes from '../routes/playlist-mix';
import playlistEngineRoutes from '../routes/playlist-engine';
import analyticsRoutes from '../routes/analytics';
import billingRoutes from '../routes/billing';
import subscriberBillingRoutes from '../routes/subscriber-billing';
import publisherBillingRoutes from '../routes/publisher-billing';
import plansRoutes from '../routes/plans';
import subscriptionsRoutes from '../routes/subscriptions';
import reportsRoutes from '../routes/reports';
import aiRoutes from '../routes/ai';
import smartPlaylistRoutes from '../routes/smart-playlist';
import quickPublishRoutes from '../routes/quick-publish';
import exportQueriesRoutes from '../routes/export-queries';
import exportSchedulesRoutes from '../routes/export-schedules';
import exportExecutionsRoutes from '../routes/export-executions';
import logsRoutes from '../routes/logs';
import advancedSchedulesRoutes from '../routes/advanced-schedules';
import emailRoutes from '../routes/email';
import otaUpdatesRoutes from '../routes/ota-updates';
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
import alertsRoutes from '../routes/alerts';
import rolesRoutes from '../routes/roles';
import permissionsRoutes from '../routes/permissions';
import webhooksRoutes from '../routes/webhooks';
import dashboardLayoutsRoutes from '../routes/dashboard-layouts';
import backupsRoutes from '../routes/backups';
import { authMiddleware } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { rateLimitHeavyOperations } from '../middleware/rateLimitUser.middleware';

export function registerProRoutes(app: Express): void {
  app.use('/api/clients', authMiddleware as any, blockClientDataAccess as any, (_req, res, next) => {
    res.setHeader('X-Deprecated-Route', 'true');
    res.setHeader('X-Deprecated-Message', 'Esta rota está deprecated. Use /api/subscribers');
    next();
  }, clientRoutes);

  app.use('/api/subscribers', authMiddleware as any, blockClientDataAccess as any, subscriberRoutes);
  app.use('/api/publishers', authMiddleware as any, publisherRoutes);
  app.use('/api/subscriber-access', subscriberAccessRoutes);
  app.use('/api/contracts', contractRoutes);
  app.use('/api/playlist-mix', authMiddleware as any, playlistMixRoutes);
  app.use('/api/playlist-engine', playlistEngineRoutes);
  app.use('/api/analytics', blockClientDataAccess as any, analyticsRoutes);

  app.use('/api/billing', authMiddleware as any, blockClientDataAccess as any, (_req, res, next) => {
    res.setHeader('X-Deprecated-Route', 'true');
    res.setHeader('X-Deprecated-Message', 'Esta rota está deprecated. Use /api/subscriber-billing ou /api/publisher-billing');
    next();
  }, billingRoutes);

  app.use('/api/subscriber-billing', authMiddleware as any, blockClientDataAccess as any, subscriberBillingRoutes);
  app.use('/api/publisher-billing', authMiddleware as any, publisherBillingRoutes);
  app.use('/api/plans', plansRoutes);
  app.use('/api/subscriptions', subscriptionsRoutes);
  app.use('/api/reports', blockClientDataAccess as any, reportsRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/smart-playlist', blockClientDataAccess as any, smartPlaylistRoutes);
  app.use('/api/quick-publish', blockClientDataAccess as any, quickPublishRoutes);
  app.use('/api/export-queries', exportQueriesRoutes);
  app.use('/api/export-schedules', exportSchedulesRoutes);
  app.use('/api/export-executions', exportExecutionsRoutes);
  app.use('/api/logs', logsRoutes);
  app.use('/api/advanced-schedules', advancedSchedulesRoutes);
  app.use('/api/email', emailRoutes);
  app.use('/api/ota-updates', otaUpdatesRoutes);
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
  app.use('/api/alerts', alertsRoutes);
  app.use('/api/roles', rolesRoutes);
  app.use('/api/permissions', permissionsRoutes);
  app.use('/api/webhooks', webhooksRoutes);
  app.use('/api/dashboard-layouts', dashboardLayoutsRoutes);
  app.use('/api/backups', rateLimitHeavyOperations, backupsRoutes);
}

