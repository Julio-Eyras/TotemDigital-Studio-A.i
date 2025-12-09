/**
 * Notifications Routes - Smart Signage Pro v3.1
 * Rotas para gerenciar notificações em tempo real
 */

import { Router, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { getNotificationService } from '../services/notificationService';
import { logError } from '../utils/loggerHelper';

const router = Router();

// Middleware de autenticação
router.use(authMiddleware);

const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

/**
 * @route GET /api/notifications
 * @desc Listar notificações do usuário
 * @access Private
 */
router.get('/',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const notificationService = getNotificationService();
      const notifications = await notificationService.getUserNotifications(req.user.id, limit);

      res.json({
        success: true,
        data: notifications
      });
    } catch (error: any) {
      await logError('Erro ao listar notificações', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro ao listar notificações'
      });
    }
  }
);

/**
 * @route PUT /api/notifications/:id/read
 * @desc Marcar notificação como lida
 * @access Private
 */
router.put('/:id/read',
  param('id').notEmpty().isString(),
  validateRequest,
  async (req: any, res: Response) => {
    try {
      const notificationService = getNotificationService();
      await notificationService.markAsRead(req.params.id, req.user.id);

      res.json({
        success: true,
        message: 'Notificação marcada como lida'
      });
    } catch (error: any) {
      await logError('Erro ao marcar notificação como lida', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro ao marcar notificação como lida'
      });
    }
  }
);

export default router;

