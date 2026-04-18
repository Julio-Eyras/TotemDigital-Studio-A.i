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
import settingsRoutes from '../routes/settings';
import dashboardRoutes from '../routes/dashboard';
import healthRoutes from '../routes/health';
import { authMiddleware } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';

/**
 * Rotas expostas no perfil TotemDigital compacto (monousuário).
 * Exclui superfície Pro (users admin UI, smart TV, QR codes, centro de notificações API)
 * mantendo /api/locals (filtros e cadastro de totem) e /api/players (campanhas).
 */
export function registerCompactRoutes(app: Express): void {
  app.use('/api/auth', authRoutes);
  app.use('/api/locals', authMiddleware as any, localRoutes);
  app.use('/api/totems', totemRoutes);
  app.use('/api/dispatcher-totem', dispatcherTotemRoutes);
  app.use('/api/dispatcher-debug', dispatcherDebugRoutes);
  app.use('/api/players', authMiddleware as any, playerRoutes);
  app.use('/api/media', blockClientDataAccess as any, mediaRoutes);
  app.use('/api/playlists', blockClientDataAccess as any, playlistRoutes);
  app.use('/api/campaigns', blockClientDataAccess as any, campaignRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/dashboard', authMiddleware as any, dashboardRoutes);
  app.use('/api/health', healthRoutes);
}

