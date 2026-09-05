/**
 * Backups Routes - Smart Signage Pro v3.1
 * Rotas para gerenciar backups do sistema
 */

import { Router} from 'express';
import express from 'express';

import { param, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getBackupService } from '../services/backupService';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const router = Router();

// Middleware de autenticação
router.use(authMiddleware);

const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction): express.Response | void => {
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
  async (_req: express.Request, res: express.Response) => {
    try {
      const backupService = getBackupService();
      const result = await backupService.createFullBackup();

      if (result.success) {
        return res.status(201).json({
          success: true,
          message: 'Backup criado com sucesso',
          data: result
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Erro ao criar backup',
          error: result.error
        });
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar backup', e.error);
      return res.status(500).json({
        success: false,
        message: e.message || 'Erro ao criar backup'
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
  async (_req: express.Request, res: express.Response) => {
    try {
      const backupService = getBackupService();
      const backups = await backupService.listBackups();

      return res.json({
        success: true,
        data: backups
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar backups', e.error);
      return res.status(500).json({
        success: false,
        message: e.message || 'Erro ao listar backups'
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
  async (req: express.Request, res: express.Response) => {
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
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao restaurar backup', e.error);
      res.status(500).json({
        success: false,
        message: e.message || 'Erro ao restaurar backup'
    });
    }
  }
);

export default router;

