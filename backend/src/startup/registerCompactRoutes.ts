import { Express } from 'express';
import authRoutes from '../routes/auth';
import localRoutes from '../routes/locals';
import totemRoutes from '../routes/totems';
import dispatcherTotemRoutes from '../routes/dispatcher-totem';
import dispatcherDebugRoutes from '../routes/dispatcher-debug';
import playerRoutes from '../routes/players';
import mediaRoutes from '../routes/media';
import playlistRoutes from '../routes/playlists';
import campaignRoutes from '../routes/campaigns';
import quickPublishRoutes from '../routes/quick-publish';
import simplePublishRoutes from '../routes/simple-publish';
import publishTemplatesRoutes from '../routes/publish-templates';
import menuCatalogRoutes from '../routes/menu-catalog';
import publishBoardRoutes from '../routes/publish-board';
import publishBoardPublicRoutes from '../routes/publish-board-public';
import settingsRoutes from '../routes/settings';
import installationModulesRoutes from '../routes/installationModules';
import dashboardRoutes from '../routes/dashboard';
import healthRoutes from '../routes/health';
import alertsRoutes from '../routes/alerts';
import logsRoutes from '../routes/logs';
import playlistEngineRoutes from '../routes/playlist-engine';
import subscriberRoutes from '../routes/subscribers';
import plansRoutes from '../routes/plans';
import contractRoutes from '../routes/contracts';
import billingRoutes from '../routes/billing';
import subscriberBillingRoutes from '../routes/subscriber-billing';
import publisherBillingRoutes from '../routes/publisher-billing';
import billingControlRoutes from '../routes/billing-control';
import financialAdminRoutes from '../routes/financial-admin';
import financialPixWebhookRoutes from '../routes/financial-pix-webhook';
import subscriptionsRoutes from '../routes/subscriptions';
import publisherRoutes from '../routes/publishers';
import subscriberAccessRoutes from '../routes/subscriber-access';
import smartTvRoutes from '../routes/smart-tvs';
import { authMiddleware } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { requireModule } from '../middleware/moduleAuth.middleware';

/**
 * Rotas expostas no perfil TotemDigital compacto (monousuário).
 * Inclui faturamento (subscriber/publisher billing, assinaturas e rota billing legada)
 * alinhado à versão Pro, com o mesmo middleware de auth e bloqueio operator.
 * Fase B: requireModule nas superfícies complementares.
 */
export function registerCompactRoutes(app: Express): void {
  app.use('/api/auth', authRoutes);
  app.use('/api/plans', requireModule('plans') as any, plansRoutes);
  app.use('/api/contracts', requireModule('contracts') as any, contractRoutes);
  app.use('/api/publishers', authMiddleware as any, publisherRoutes);
  app.use('/api/subscriber-access', requireModule('subscribers') as any, subscriberAccessRoutes);
  app.use(
    '/api/subscribers',
    authMiddleware as any,
    requireModule('subscribers') as any,
    blockClientDataAccess as any,
    subscriberRoutes
  );
  app.use('/api/locals', authMiddleware as any, localRoutes);
  app.use('/api/smart-tvs', requireModule('devices') as any, smartTvRoutes);
  app.use('/api/totems', totemRoutes);
  app.use('/api/dispatcher-totem', dispatcherTotemRoutes);
  app.use('/api/dispatcher-debug', requireModule('dispatcher_admin') as any, dispatcherDebugRoutes);
  app.use('/api/players', authMiddleware as any, requireModule('devices') as any, playerRoutes);
  app.use('/api/media', blockClientDataAccess as any, mediaRoutes);
  app.use(
    '/api/playlists',
    requireModule('playlists_advanced') as any,
    blockClientDataAccess as any,
    playlistRoutes
  );
  app.use(
    '/api/campaigns',
    requireModule('campaigns') as any,
    blockClientDataAccess as any,
    campaignRoutes
  );
  app.use(
    '/api/quick-publish',
    requireModule('quick_publish') as any,
    blockClientDataAccess as any,
    quickPublishRoutes
  );
  app.use('/api/simple-publish', blockClientDataAccess as any, simplePublishRoutes);
  app.use(
    '/api/publish-templates',
    authMiddleware as any,
    requireModule('quick_publish') as any,
    publishTemplatesRoutes
  );
  app.use(
    '/api/subscribers/:subscriberId/menu-catalog',
    authMiddleware as any,
    requireModule('quick_publish') as any,
    blockClientDataAccess as any,
    menuCatalogRoutes
  );
  app.use('/api/publish-board', publishBoardPublicRoutes);
  app.use(
    '/api/subscribers/:subscriberId/publish-board',
    authMiddleware as any,
    requireModule('quick_publish') as any,
    blockClientDataAccess as any,
    publishBoardRoutes
  );
  app.use('/api/settings', settingsRoutes);
  app.use('/api/installation', installationModulesRoutes);
  // ui-context é público (definido antes do auth no router); auth só nas demais rotas do dashboard
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/alerts', alertsRoutes);
  app.use('/api/logs', logsRoutes);
  app.use('/api/playlist-engine', playlistEngineRoutes);
  app.use('/api/health', healthRoutes);

  app.use('/api/billing', authMiddleware as any, requireModule('billing') as any, blockClientDataAccess as any, (_req, res, next) => {
    res.setHeader('X-Deprecated-Route', 'true');
    res.setHeader('X-Deprecated-Message', 'Esta rota está deprecated. Use /api/subscriber-billing ou /api/publisher-billing');
    next();
  }, billingRoutes);
  app.use(
    '/api/subscriber-billing',
    authMiddleware as any,
    requireModule('billing') as any,
    blockClientDataAccess as any,
    subscriberBillingRoutes
  );
  app.use(
    '/api/publisher-billing',
    authMiddleware as any,
    requireModule('billing') as any,
    blockClientDataAccess as any,
    publisherBillingRoutes
  );
  app.use(
    '/api/billing-control',
    authMiddleware as any,
    requireModule('billing') as any,
    blockClientDataAccess as any,
    billingControlRoutes
  );
  app.use('/api/financial-admin', financialPixWebhookRoutes);
  app.use(
    '/api/financial-admin',
    authMiddleware as any,
    requireModule('billing') as any,
    blockClientDataAccess as any,
    financialAdminRoutes
  );
  app.use('/api/subscriptions', requireModule('billing') as any, subscriptionsRoutes);
}

