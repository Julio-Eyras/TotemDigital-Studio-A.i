/**
 * Notifications Routes - Smart Signage Pro v3.1
 * Rotas para gerenciar notificações em tempo real
 */

import { Router, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { getNotificationService } from '../services/notificationService';
import { logError } from '../utils/loggerHelper';
import { successResponse, errorResponse } from '../utils/apiResponse';

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

      res.json(successResponse(notifications));
    } catch (error: any) {
      await logError('Erro ao listar notificações', error);
      res.status(500).json(errorResponse('Erro ao listar notificações', error.message));
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

      res.json(successResponse({ message: 'Notificação marcada como lida' }));
    } catch (error: any) {
      await logError('Erro ao marcar notificação como lida', error);
      res.status(500).json(errorResponse('Erro ao marcar notificação como lida', error.message));
    }
  }
);

export default router;

