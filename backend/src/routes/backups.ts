/**
 * Backups Routes - Smart Signage Pro v3.1
 * Rotas para gerenciar backups do sistema
 */

import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getBackupService } from '../services/backupService';
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
 * @route POST /api/backups/create
 * @desc Criar backup completo do sistema
 * @access Private (Admin, Admin SQL)
 */
router.post('/create',
  authorizeRole(['admin', 'admin_sql']),
  async (req: any, res: Response) => {
    try {
      const backupService = getBackupService();
      const result = await backupService.createFullBackup();

      if (result.success) {
        res.status(201).json({
          success: true,
          message: 'Backup criado com sucesso',
          data: result
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Erro ao criar backup',
          error: result.error
        });
      }
    } catch (error: any) {
      await logError('Erro ao criar backup', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro ao criar backup'
      });
    }
  }
);

/**
 * @route GET /api/backups
 * @desc Listar backups disponíveis
 * @access Private (Admin, Admin SQL, Gerente Marketing)
 */
router.get('/',
  authorizeRole(['admin', 'admin_sql', 'gerente_marketing']),
  async (req: any, res: Response) => {
    try {
      const backupService = getBackupService();
      const backups = await backupService.listBackups();

      res.json({
        success: true,
        data: backups
      });
    } catch (error: any) {
      await logError('Erro ao listar backups', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro ao listar backups'
      });
    }
  }
);

/**
 * @route POST /api/backups/:id/restore
 * @desc Restaurar backup
 * @access Private (Admin, Admin SQL)
 */
router.post('/:id/restore',
  param('id').notEmpty().isString(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: any, res: Response) => {
    try {
      const backupService = getBackupService();
      const result = await backupService.restoreBackup(req.params.id);

      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error: any) {
      await logError('Erro ao restaurar backup', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erro ao restaurar backup'
      });
    }
  }
);

export default router;

