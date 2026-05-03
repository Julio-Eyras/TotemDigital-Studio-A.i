/**
 * OTA Updates Routes - Smart Signage v2.1
 * Rotas para gerenciar atualizações Over-The-Air
 */

import { Router, Response } from 'express';
import { getOTAUpdateService } from '../services/otaUpdateService';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import { logError } from '../utils/loggerHelper';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configurar multer para upload de arquivos de atualização
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'ota-updates');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `update-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB máximo (alinhar a media.upload)
  },
  fileFilter: (_req, file, cb) => {
    // Aceitar apenas arquivos de atualização (zip, tar.gz, etc)
    const allowedExtensions = ['.zip', '.tar.gz', '.tar', '.deb', '.rpm', '.apk', '.ipk'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext) || file.originalname.endsWith('.tar.gz')) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use: zip, tar.gz, tar, deb, rpm, apk, ipk'));
    }
  }
});

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @route GET /api/ota-updates
 * @desc Lista todas as atualizações OTA
 * @access Private (Admin, Manager)
 */
router.get('/',
  query('platform').optional().isString(),
  query('status').optional().isIn(['draft', 'testing', 'active', 'paused', 'completed', 'cancelled']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'operator']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { platform, status, limit } = req.query;
      const otaService = getOTAUpdateService();
      const updates = await otaService.getUpdateHistory(limit ? parseInt(limit as string) : 50);

      // Aplicar filtros
      let filtered = updates;
      if (platform) {
        filtered = filtered.filter(u => u.platform === platform || u.platform === 'all');
      }
      if (status) {
        filtered = filtered.filter(u => u.status === status);
      }

      return res.json({
        success: true,
        data: filtered
      });
    } catch (error: any) {
      await logError('Erro ao listar atualizações OTA', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar atualizações OTA'
      });
    }
  }
);

/**
 * @route POST /api/ota-updates
 * @desc Cria uma nova atualização OTA
 * @access Private (Admin)
 */
router.post('/',
  upload.single('file'),
  body('version').isString().notEmpty().withMessage('Versão é obrigatória'),
  body('platform').isIn(['webos', 'tizen', 'android', 'linux', 'windows', 'all']).withMessage('Plataforma inválida'),
  body('description').optional().isString(),
  body('changelog').optional().isString(),
  body('isMandatory').optional().isBoolean(),
  body('minVersion').optional().isString(),
  body('maxVersion').optional().isString(),
  body('rolloutPercentage').optional().isInt({ min: 0, max: 100 }),
  validateRequest,
  authorizeRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Arquivo de atualização é obrigatório'
        });
      }

      const {
        version,
        platform,
        description,
        changelog,
        isMandatory,
        minVersion,
        maxVersion,
        rolloutPercentage
      } = req.body;

      const otaService = getOTAUpdateService();
      const update = await otaService.createUpdate({
        version,
        platform,
        filePath: req.file.path,
        description,
        changelog,
        isMandatory: isMandatory === 'true' || isMandatory === true,
        minVersion,
        maxVersion,
        rolloutPercentage: rolloutPercentage ? parseInt(rolloutPercentage) : undefined
      }, req.user!.id);

      return res.json({
        success: true,
        message: 'Atualização OTA criada com sucesso',
        data: update
      });
    } catch (error: any) {
      await logError('Erro ao criar atualização OTA', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao criar atualização OTA'
      });
    }
  }
);

/**
 * @route POST /api/ota-updates/:id/activate
 * @desc Ativa uma atualização OTA
 * @access Private (Admin)
 */
router.post('/:id/activate',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updateId = parseInt(req.params.id);
      const otaService = getOTAUpdateService();
      await otaService.activateUpdate(updateId, req.user!.id);

      return res.json({
        success: true,
        message: 'Atualização OTA ativada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao ativar atualização OTA', error, { updateId: req.params.id });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao ativar atualização OTA'
      });
    }
  }
);

/**
 * @route POST /api/ota-updates/:id/pause
 * @desc Pausa uma atualização OTA
 * @access Private (Admin)
 */
router.post('/:id/pause',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updateId = parseInt(req.params.id);
      const otaService = getOTAUpdateService();
      await otaService.pauseUpdate(updateId);

      return res.json({
        success: true,
        message: 'Atualização OTA pausada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao pausar atualização OTA', error, { updateId: req.params.id });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao pausar atualização OTA'
      });
    }
  }
);

/**
 * @route GET /api/ota-updates/stats
 * @desc Obtém estatísticas de atualizações
 * @access Private (Admin, Manager)
 */
router.get('/stats',
  authorizeRole(['admin', 'admin_sql', 'operator']),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const otaService = getOTAUpdateService();
      const stats = await otaService.getUpdateStats();

      return res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      await logError('Erro ao obter estatísticas de atualizações', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter estatísticas de atualizações'
      });
    }
  }
);

/**
 * @route GET /api/ota-updates/:id/download
 * @desc Download de arquivo de atualização
 * @access Private (para players autenticados)
 */
router.get('/:id/download',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updateId = parseInt(req.params.id);
      const { getDatabase } = await import('../config/database');
      const db = getDatabase();

      const update = await db.findFirst(`
        SELECT file_path, version, platform, checksum
        FROM ota_updates
        WHERE id = $1 AND status = 'active'
      `, [updateId]);

      if (!update) {
        return res.status(404).json({
          success: false,
          error: 'Atualização não encontrada ou não está ativa'
        });
      }

      if (!fs.existsSync(update.file_path)) {
        return res.status(404).json({
          success: false,
          error: 'Arquivo de atualização não encontrado'
        });
      }

      const fileName = `update_${update.version}_${update.platform}${path.extname(update.file_path)}`;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('X-Update-Checksum', update.checksum);
      res.setHeader('X-Update-Version', update.version);

      const fileStream = fs.createReadStream(update.file_path);
      fileStream.pipe(res);
      return;

    } catch (error: any) {
      await logError('Erro ao fazer download de atualização', error, { updateId: req.params.id });
      return res.status(500).json({
        success: false,
        error: 'Erro ao fazer download de atualização'
      });
    }
  }
);

export default router;

