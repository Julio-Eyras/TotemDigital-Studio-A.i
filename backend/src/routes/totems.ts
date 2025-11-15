import { Router, Request, Response } from 'express';
import { TotemService } from '../services/totemService';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();

// Lazy initialization - só criar quando necessário
function getTotemService(): TotemService {
  if (!(global as any).totemServiceInstance) {
    (global as any).totemServiceInstance = new TotemService();
  }
  return (global as any).totemServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @route GET /api/totems
 * @desc Listar todos os totems
 * @access Private
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }).withMessage('page deve ser um número inteiro maior que 0'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit deve ser um número inteiro entre 1 e 100'),
  query('search').optional().isString().withMessage('search deve ser uma string'),
  query('status').optional().isString().withMessage('status deve ser uma string'),
  query('clientId').optional().isInt({ min: 1 }).withMessage('clientId deve ser um número inteiro maior que 0'),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10, search, status, clientId } = req.query;
      const result = await getTotemService().getAllTotems({
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10,
        search: search as string | undefined,
        status: status as string | undefined,
        clientId: clientId ? parseInt(clientId as string) : undefined
      });
      res.json(result);
    } catch (error: any) {
      console.error('❌ Erro ao listar totems:', error.message || error);
      res.status(500).json({ 
        success: false,
        error: 'Erro ao listar totems',
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route GET /api/totems/pending
 * @desc Listar totems pendentes de aprovação
 * @access Private (Admin)
 */
router.get('/pending',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const result = await getTotemService().getAllTotems({
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10,
        status: 'pending_approval'
      });
      res.json(result);
    } catch (error: any) {
      console.error('❌ Erro ao listar totems pendentes:', error.message || error);
      res.status(500).json({ 
        success: false,
        error: 'Erro ao listar totems pendentes',
        message: error.message || 'Erro interno do servidor'
      });
    }
  }
);

/**
 * @route GET /api/totems/stats/overview
 * @desc Obter estatísticas de totems
 * @access Private (Admin/Manager)
 */
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const stats = await getTotemService().getTotemStats(1); // Default totem
    res.json(stats);
  } catch (error: any) {
    console.error('❌ Erro ao obter estatísticas:', error.message || error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao obter estatísticas',
      message: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/totems/stats/offline
 * @desc Obter totems offline
 * @access Private (Admin/Manager)
 */
router.get('/stats/offline', async (req: Request, res: Response) => {
  try {
    const offlineTotems = await getTotemService().getOfflineTotems();
    res.json(offlineTotems);
  } catch (error: any) {
    console.error('❌ Erro ao obter totems offline:', error.message || error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao obter totems offline',
      message: error.message || 'Erro interno do servidor'
    });
  }
});

/**
 * @route GET /api/totems/:id
 * @desc Obter totem por ID
 * @access Private
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const totem = await getTotemService().getTotemById(totemId);
      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }
      res.json(totem);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter totem' });
    }
  }
);

/**
 * @route GET /api/totems/uin/:uin
 * @desc Obter totem por UIN
 * @access Private
 */
router.get('/uin/:uin',
  param('uin').isString().isLength({ min: 10, max: 50 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const uin = req.params.uin;
      const totem = await getTotemService().getTotemByUin(uin);
      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }
      res.json(totem);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter totem' });
    }
  }
);

/**
 * @route POST /api/totems
 * @desc Criar novo totem
 * @access Private (Admin/Manager)
 */
router.post('/',
  body('identifier').optional().isString().isLength({ min: 2, max: 100 }),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('clientId').optional().isInt({ min: 1 }),
  body('location').optional().isString().isLength({ min: 2, max: 200 }),
  body('description').optional().isString(),
  body('ipAddress').optional().isIP(),
  body('macAddress').optional().isMACAddress(),
  body('model').optional().isString(),
  body('serialNumber').optional().isString(),
  body('resolution').optional().isString(),
  body('orientation').optional().isString().isIn(['portrait', 'landscape']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { name, identifier, location, ...rest } = req.body;
      const totemData = {
        identifier: identifier || name,
        name: name || identifier,
        location,
        ...rest,
        description: rest.description || location
      };
      const totem = await getTotemService().createTotem(totemData, 1); // Default user
      res.status(201).json(totem);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao criar totem' });
    }
  }
);

/**
 * @route PUT /api/totems/:id
 * @desc Atualizar totem
 * @access Private (Admin/Manager)
 */
router.put('/:id',
  param('id').isInt({ min: 1 }),
  body('identifier').optional().isString().isLength({ min: 2, max: 100 }),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('clientId').optional().isInt({ min: 1 }),
  body('location').optional().isString().isLength({ min: 2, max: 200 }),
  body('description').optional().isString(),
  body('ipAddress').optional().isIP(),
  body('macAddress').optional().isMACAddress(),
  body('model').optional().isString(),
  body('serialNumber').optional().isString(),
  body('resolution').optional().isString(),
  body('orientation').optional().isString().isIn(['portrait', 'landscape']),
  body('isActive').optional().isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { name, identifier, location, ...rest } = req.body;
      const totemData = {
        identifier: identifier || name,
        name,
        location,
        ...rest,
        description: rest.description || location
      };
      const totem = await getTotemService().updateTotem(totemId, totemData, 1); // Default user
      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }
      res.json(totem);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao atualizar totem' });
    }
  }
);

/**
 * @route DELETE /api/totems/:id
 * @desc Deletar totem
 * @access Private (Admin)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      await getTotemService().deleteTotem(totemId, 1); // Default user
      res.json({ message: 'Totem deletado com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao deletar totem' });
    }
  }
);

/**
 * @route PUT /api/totems/:id/activate
 * @desc Ativar/desativar totem
 * @access Private (Admin/Manager)
 */
router.put('/:id/activate',
  param('id').isInt({ min: 1 }),
  body('isActive').isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { isActive } = req.body;
      if (isActive) {
        await getTotemService().activateTotem(totemId, 1);
      } else {
        await getTotemService().deactivateTotem(totemId, 1);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao alterar status do totem' });
    }
  }
);

/**
 * @route POST /api/totems/:id/heartbeat
 * @desc Registrar heartbeat do totem
 * @access Private (Totem)
 */
router.post('/:id/heartbeat',
  param('id').isInt({ min: 1 }),
  body('status').isString().isIn(['online', 'offline', 'error']),
  body('uptime').optional().isInt({ min: 0 }),
  body('memoryUsage').optional().isFloat({ min: 0, max: 100 }),
  body('cpuUsage').optional().isFloat({ min: 0, max: 100 }),
  body('diskUsage').optional().isFloat({ min: 0, max: 100 }),
  body('temperature').optional().isFloat(),
  body('lastPlaylistUpdate').optional().isISO8601(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const heartbeatData = req.body;
      const heartbeat = await getTotemService().registerHeartbeat(totemId, heartbeatData);
      res.json(heartbeat);
    } catch (error) {
      res.status(400).json({ error: 'Erro ao registrar heartbeat' });
    }
  }
);

/**
 * @route GET /api/totems/:id/heartbeat
 * @desc Obter histórico de heartbeats
 * @access Private
 */
router.get('/:id/heartbeat',
  param('id').isInt({ min: 1 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { startDate, endDate, limit = 100 } = req.query;
      const heartbeats = await getTotemService().getHeartbeatHistory(totemId, {
        startDate: startDate as string,
        endDate: endDate as string,
        limit: Number(limit)
      });
      res.json(heartbeats);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter histórico de heartbeats' });
    }
  }
);

/**
 * @route GET /api/totems/:id/playlist
 * @desc Obter playlist atual do totem
 * @access Private
 */
router.get('/:id/playlist',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const playlist = await getTotemService().getCurrentPlaylist(totemId);
      res.json(playlist);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter playlist do totem' });
    }
  }
);

/**
 * @route GET /api/totems/:id/analytics
 * @desc Obter analytics do totem
 * @access Private
 */
router.get('/:id/analytics',
  param('id').isInt({ min: 1 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { startDate, endDate } = req.query;
      const analytics = await getTotemService().getTotemAnalytics(totemId, {
        startDate: startDate as string,
        endDate: endDate as string
      });
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao obter analytics do totem' });
    }
  }
);

/**
 * @route PUT /api/totems/:id/approve
 * @desc Aprovar totem pendente de aprovação
 * @access Private (Admin)
 */
router.put('/:id/approve',
  param('id').isInt({ min: 1 }),
  body('generateEncryptedConfig').optional().isBoolean(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { generateEncryptedConfig = false } = req.body;
      const userId = (req as any).user?.id || 1; // Default user if not available

      // Buscar totem
      const totem = await getTotemService().getTotemById(totemId);
      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }

      // Verificar se totem está pendente de aprovação
      const db = require('../config/database').getDatabase();
      const totemFull = await db.findFirst(`
        SELECT status, uin, identifier, config
        FROM totems
        WHERE totem_id = ?
      `, [totemId]);

      if (!totemFull || totemFull.status !== 'pending_approval') {
        return res.status(400).json({ 
          error: 'Totem não está pendente de aprovação',
          currentStatus: totemFull?.status || 'unknown'
        });
      }

      // Atualizar status para 'online' ou 'active'
      await db.executeRaw(`
        UPDATE totems
        SET status = 'online', updated_at = CURRENT_TIMESTAMP
        WHERE totem_id = ?
      `, [totemId]);

      // Se solicitado, gerar arquivo de configuração encriptado
      let encryptedConfigPath = null;
      if (generateEncryptedConfig && totemFull.uin) {
        try {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          
          // Determinar diretório do player
          const playerDir = process.env.PLAYER_DIR || '/opt/smart-signage/player';
          const secretKey = process.env.TOTEM_SECRET_KEY || 'smart-signage-totem-secret-key-2025-change-in-production';
          
          // Executar script de geração de config
          const path = require('path');
          const scriptPath = process.env.GENERATE_CONFIG_SCRIPT || 
                           path.join(__dirname, '../../scripts/generate-player-config.sh');
          
          await execAsync(`bash "${scriptPath}" "${totemFull.uin}" "${playerDir}" "${secretKey}"`, {
            timeout: 10000
          });
          
          encryptedConfigPath = `${playerDir}/config.json.enc`;
        } catch (configError: any) {
          console.warn('⚠️ Erro ao gerar config encriptado:', configError.message);
          // Não falhar a aprovação se gerar config falhar
        }
      }

      // Log de auditoria
      try {
        const auditService = require('../services/auditService').getAuditService();
        await auditService.log('totem', 'approved', userId, {
          totemId,
          uin: totemFull.uin,
          identifier: totemFull.identifier
        });
      } catch (auditError) {
        console.warn('⚠️ Erro ao registrar log de auditoria:', auditError);
      }

      // Buscar totem atualizado
      const approvedTotem = await getTotemService().getTotemById(totemId);

      res.json({
        success: true,
        message: 'Totem aprovado com sucesso',
        totem: approvedTotem,
        encryptedConfigPath: encryptedConfigPath || undefined
      });
    } catch (error: any) {
      console.error('❌ Erro ao aprovar totem:', error.message);
      res.status(500).json({ error: 'Erro ao aprovar totem', details: error.message });
    }
  }
);

export default router;
