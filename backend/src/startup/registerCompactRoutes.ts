import { Express } from 'express';
import authRoutes from '../routes/auth';
import userRoutes from '../routes/users';
import localRoutes from '../routes/locals';
import smartTvRoutes from '../routes/smart-tvs';
import totemRoutes from '../routes/totems';
import dispatcherTotemRoutes from '../routes/dispatcher-totem';
import dispatcherDebugRoutes from '../routes/dispatcher-debug';
import playerRoutes from '../routes/players';
import mediaRoutes from '../routes/media';
import playlistRoutes from '../routes/playlists';
import campaignRoutes from '../routes/campaigns';
import qrcodeRoutes from '../routes/qrcodes';
import settingsRoutes from '../routes/settings';
import dashboardRoutes from '../routes/dashboard';
import healthRoutes from '../routes/health';
import notificationsRoutes from '../routes/notifications';
import { authMiddleware } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';

export function registerCompactRoutes(app: Express): void {
  app.use('/api/auth', authRoutes);
  app.use('/api/users', authMiddleware as any, userRoutes);
  app.use('/api/locals', authMiddleware as any, localRoutes);
  app.use('/api/smart-tvs', authMiddleware as any, smartTvRoutes);
  app.use('/api/totems', totemRoutes);
  app.use('/api/dispatcher-totem', dispatcherTotemRoutes);
  app.use('/api/dispatcher-debug', dispatcherDebugRoutes);
  app.use('/api/players', authMiddleware as any, playerRoutes);
  app.use('/api/media', blockClientDataAccess as any, mediaRoutes);
  app.use('/api/playlists', blockClientDataAccess as any, playlistRoutes);
  app.use('/api/campaigns', blockClientDataAccess as any, campaignRoutes);
  app.use('/api/qrcodes', blockClientDataAccess as any, qrcodeRoutes);
  app.use('/api/qr-codes', blockClientDataAccess as any, qrcodeRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/dashboard', authMiddleware as any, dashboardRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/notifications', notificationsRoutes);
}

