import { Router, Response } from 'express';
import { getTotemService } from '../services/totemService';
import { getRemoteCommandService } from '../services/remoteCommandService';
import { getTotemLogService } from '../services/totemLogService';
import { getSmartTvService } from '../services/smartTvService';
import { getTotemDirectMediaService } from '../services/totemDirectMediaService';
import { isDirectTotemMode } from '../config/directTotemMode';
import {
  ensureDefaultLocalForPublisher,
  resolveSinglePublisherId,
} from '../services/directTotemOrgService';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { requireFlag } from '../middleware/flagAuth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import { logError, logWarn, logInfo } from '../utils/loggerHelper';
import { getDatabase } from '../config/database';
import { isStudioRuntime } from '../config/installationRuntime';
import { getTotemSecretKey } from '../config/totemSecurity';
import { getTotemCreateRoles } from '../utils/totemCreateRoles';

const router = Router();

function isTotemRowActive(t: any): boolean {
  const active = t?.is_active ?? t?.active;
  return active !== false && active !== 0 && active !== 'false' && active !== '0';
}

// Aplicar bloqueio de dados de clientes para OPERATOR
// OPERATOR pode acessar apenas dados técnicos (restart, screenshot, logs, status)
router.use(blockClientDataAccess);

const isAdminRole = (role?: string) =>
  ['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial'].includes(role || '');

const getTotemApproveRoles = () =>
  isStudioRuntime()
    ? ['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial', 'publisher_user']
    : ['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial'];

const getTotemUpdateRoles = () =>
  isStudioRuntime()
    ? [
        'admin',
        'admin_sql',
        'owner_system',
        'operador_tecnico',
        'operador_faturamento',
        'operador_comercial',
        'publisher_user',
        'gerente_marketing',
      ]
    : ['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial', 'publisher_user'];

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @route GET /api/totems
 * @desc Listar todos os totems
 * @access Private
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }).withMessage('page deve ser um número inteiro maior que 0'),
  // Frontend usa limit=1000 em alguns pontos (ex.: monitor dispatcher)
  query('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('limit deve ser um número inteiro entre 1 e 10000'),
  query('search').optional().isString().withMessage('search deve ser uma string'),
  query('status').optional().isString().withMessage('status deve ser uma string'),
  // REMOVIDO: clientId - totem não pertence a subscriber
  // query('publisherId').optional().isInt({ min: 1 }).withMessage('publisherId deve ser um número inteiro maior que 0'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 10, search, status } = req.query;
      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;
      // REMOVIDO: clientId - totem não pertence a subscriber, pertence a publisher via local_id
      const result = await getTotemService().getAllTotems({
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10,
        search: search as string | undefined,
        status: status as string | undefined,
        requestPublisherId,
        isAdmin
      });
      let totems = result.totems || [];
      const includeInactive = String(req.query.includeInactive || '') === '1';
      const onlyActive = String(req.query.onlyActive || '') === '1';
      if (isDirectTotemMode() && onlyActive && !includeInactive) {
        totems = totems.filter((t: any) => isTotemRowActive(t));
      }
      if (isDirectTotemMode() && totems.length > 0) {
        const db = getDatabase();
        const ids = totems.map((t: any) => Number(t.totem_id ?? t.id)).filter((id: number) => id > 0);
        const counts = await db.findMany(
          `
          SELECT tp.totem_id, COUNT(tpi.item_id)::int AS media_count
          FROM totem_playlists tp
          JOIN totem_playlist_items tpi ON tpi.totem_playlist_id = tp.totem_playlist_id
          WHERE tp.totem_id = ANY($1::int[])
            AND COALESCE(tp.is_active, true) = true
            AND tp.status = 'active'
            AND COALESCE(tpi.is_active, true) = true
          GROUP BY tp.totem_id
        `,
          [ids]
        );
        const byTotem = new Map(counts.map((r: any) => [Number(r.totem_id), Number(r.media_count)]));
        totems = totems.map((t: any) => ({
          ...t,
          media_count: byTotem.get(Number(t.totem_id ?? t.id)) ?? 0,
        }));
      }
      // Converter formato: { totems: [] } para { data: [] } para compatibilidade com frontend
      return res.json({
        data: totems,
        total: isDirectTotemMode() && onlyActive && !includeInactive ? totems.length : result.total || 0,
        page: result.page || 1,
        limit: result.limit || 10
      });
    } catch (error: any) {
      await logError('Erro ao listar totems', error);
      if ((error?.message || '').includes('Acesso negado') || (error?.message || '').includes('Modo compacto')) {
        return res.status(403).json({
          success: false,
          error: error.message || 'Acesso negado'
        });
      }
      return res.status(500).json({ 
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;
      const result = await getTotemService().getAllTotems({
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10,
        status: 'pending_approval',
        requestPublisherId,
        isAdmin
      });
      // Converter formato: { totems: [] } para { data: [] } para compatibilidade com frontend
      return res.json({
        data: result.totems || [],
        total: result.total || 0,
        page: result.page || 1,
        limit: result.limit || 10
      });
    } catch (error: any) {
      await logError('Erro ao listar totems pendentes', error);
      if ((error?.message || '').includes('Acesso negado') || (error?.message || '').includes('Modo compacto')) {
        return res.status(403).json({
          success: false,
          error: error.message || 'Acesso negado'
        });
      }
      return res.status(500).json({ 
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
router.get('/stats/overview', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const stats = await getTotemService().getTotemStats(1); // Default totem
    res.json(stats);
    return;
  } catch (error: any) {
    await logError('Erro ao obter estatísticas', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao obter estatísticas',
      message: error.message || 'Erro interno do servidor'
    });
    return;
  }
});

/**
 * @route GET /api/totems/stats/offline
 * @desc Obter totems offline
 * @access Private (Admin/Manager)
 */
router.get('/stats/offline', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const offlineTotems = await getTotemService().getOfflineTotems();
    res.json(offlineTotems);
    return;
  } catch (error: any) {
    await logError('Erro ao obter totems offline', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao obter totems offline',
      message: error.message || 'Erro interno do servidor'
    });
    return;
  }
});

/**
 * @route GET /api/totems/:id/medias
 * @desc Lista mídias da playlist direta do totem (modo Publicar em Totem)
 */
router.get('/:id/medias',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id, 10);
      const items = await getTotemDirectMediaService().listTotemMedias(totemId);
      return res.json({ success: true, data: items });
    } catch (error: any) {
      await logError('Erro ao listar mídias do totem', error, { totemId: req.params.id });
      return res.status(400).json({ success: false, error: error.message || 'Erro ao listar mídias' });
    }
  }
);

/**
 * @route POST /api/totems/:id/medias
 * @desc Adiciona mídia à playlist direta do totem
 */
router.post('/:id/medias',
  param('id').isInt({ min: 1 }),
  body('mediaId').isInt({ min: 1 }).withMessage('mediaId é obrigatório'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id, 10);
      const mediaId = parseInt(req.body.mediaId, 10);
      const items = await getTotemDirectMediaService().addMediaToTotem(totemId, mediaId);
      return res.status(201).json({ success: true, data: items });
    } catch (error: any) {
      await logError('Erro ao adicionar mídia ao totem', error, { totemId: req.params.id });
      return res.status(400).json({ success: false, error: error.message || 'Erro ao adicionar mídia' });
    }
  }
);

/**
 * @route PUT /api/totems/:id/medias/reorder
 * @desc Reordena mídias da playlist direta do totem
 */
router.put('/:id/medias/reorder',
  param('id').isInt({ min: 1 }),
  body('mediaIds').isArray({ min: 1 }).withMessage('mediaIds deve ser um array'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id, 10);
      const mediaIds = (req.body.mediaIds as unknown[]).map((v) => parseInt(String(v), 10));
      const items = await getTotemDirectMediaService().reorderTotemMedias(totemId, mediaIds);
      return res.json({ success: true, data: items });
    } catch (error: any) {
      await logError('Erro ao reordenar mídias do totem', error, { totemId: req.params.id });
      return res.status(400).json({ success: false, error: error.message || 'Erro ao reordenar' });
    }
  }
);

/**
 * @route PUT /api/totems/:id/medias/:mediaId/active
 * @desc Habilita/desabilita mídia na playlist do totem (modo direto)
 */
router.put('/:id/medias/:mediaId/active',
  param('id').isInt({ min: 1 }),
  param('mediaId').isInt({ min: 1 }),
  body('isActive').isBoolean().withMessage('isActive deve ser boolean'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id, 10);
      const mediaId = parseInt(req.params.mediaId, 10);
      const isActive = Boolean(req.body.isActive);
      const items = await getTotemDirectMediaService().setTotemMediaActive(totemId, mediaId, isActive);
      return res.json({ success: true, data: items });
    } catch (error: any) {
      await logError('Erro ao alterar status da mídia no totem', error, { totemId: req.params.id });
      return res.status(400).json({ success: false, error: error.message || 'Erro ao alterar mídia' });
    }
  }
);

/**
 * @route DELETE /api/totems/:id/medias/:mediaId
 * @desc Remove mídia da playlist do totem (não exclui arquivo)
 */
router.delete('/:id/medias/:mediaId',
  param('id').isInt({ min: 1 }),
  param('mediaId').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id, 10);
      const mediaId = parseInt(req.params.mediaId, 10);
      const result = await getTotemDirectMediaService().removeMediaFromTotem(totemId, mediaId);
      return res.json({
        success: true,
        data: result.items,
        mediaUsageCount: result.mediaUsageCount,
        orphan: result.mediaUsageCount === 0,
      });
    } catch (error: any) {
      await logError('Erro ao remover mídia do totem', error, { totemId: req.params.id });
      return res.status(400).json({ success: false, error: error.message || 'Erro ao remover mídia' });
    }
  }
);

/**
 * @route GET /api/totems/:id
 * @desc Obter totem por ID
 * @access Private
 */
router.get('/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;
      const totem = await getTotemService().getTotemByIdScoped(totemId, requestPublisherId, isAdmin);
      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }
      return res.json(totem);
    } catch (error: any) {
      await logError('Erro ao obter totem', error);
      if ((error?.message || '').includes('Acesso negado') || (error?.message || '').includes('Modo compacto')) {
        return res.status(403).json({ error: error.message || 'Acesso negado' });
      }
      return res.status(500).json({ error: 'Erro ao obter totem', message: error.message });
    }
  }
);

/**
 * @route GET /api/totems/:id/smart-tvs
 * @desc Listar Smart TVs de um totem (relação 1:N)
 * @access Private (requer flag_smart_0 - acesso técnico)
 */
router.get('/:id/smart-tvs',
  requireFlag('flag_smart_0'),
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'owner_system' || req.user?.role === 'admin_sql';
      const requestPublisherId = req.user?.publisherId || undefined;

      const smartTvs = await getSmartTvService().getSmartTvsByTotem(totemId, requestPublisherId, isAdmin);
      
      return res.json({ 
        success: true, 
        data: smartTvs,
        count: smartTvs.length,
        totem_id: totemId
      });
    } catch (error: any) {
      await logError('Erro ao listar Smart TVs do totem', error);
      if (error.message.includes('Acesso negado') || error.message.includes('não encontrado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const uin = req.params.uin;
      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;
      const totem = await getTotemService().getTotemByUinScoped(uin, requestPublisherId, isAdmin);
      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }
      return res.json(totem);
    } catch (error: any) {
      await logError('Erro ao obter totem por UIN', error);
      if ((error?.message || '').includes('Acesso negado') || (error?.message || '').includes('Modo compacto')) {
        return res.status(403).json({ error: error.message || 'Acesso negado' });
      }
      return res.status(500).json({ error: 'Erro ao obter totem', message: error?.message });
    }
  }
);

/**
 * @route POST /api/totems
 * @desc Criar novo totem
 * @access Private (Apenas roles administrativos - baseado em contrato)
 */
router.post('/',
  authorizeRole(getTotemCreateRoles()),
  body('identifier').optional({ nullable: true }).isString().isLength({ min: 2, max: 100 }),
  body('name').optional({ nullable: true }).isString().isLength({ min: 2, max: 100 }),
  body('uin').optional({ nullable: true }).isString(),
  body('localId')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const num = typeof value === 'string' ? parseInt(value, 10) : value;
      if (isNaN(num) || num < 1) {
        throw new Error('localId deve ser um número inteiro maior que 0');
      }
      return true;
    }),
  body('contract_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Contract ID inválido (opcional, para rastreabilidade)'),
  body('deviceId').optional({ nullable: true }).isString(),
  body('location').optional({ nullable: true }).isString().isLength({ min: 2, max: 200 }),
  body('description').optional({ nullable: true }).isString(),
  body('ipAddress').optional({ nullable: true }).isIP(),
  body('macAddress').optional({ nullable: true }).isMACAddress(),
  body('model').optional({ nullable: true }).isString(),
  body('serialNumber').optional({ nullable: true }).isString(),
  body('resolution').optional({ nullable: true }).isString(),
  body('orientation').optional({ nullable: true }).isString().isIn(['portrait', 'landscape']),
  body('firmwareVersion').optional({ nullable: true }).isString(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, identifier, uin, localId, contract_id, deviceId, location, firmwareVersion, ...rest } = req.body;
      
      // Validar que name ou identifier foi fornecido
      if (!name && !identifier) {
        return res.status(400).json({ 
          error: 'Nome ou identificador é obrigatório',
          details: [{ msg: 'É necessário fornecer pelo menos um nome ou identificador para o totem' }]
        });
      }

      let resolvedLocalId = localId ? parseInt(String(localId), 10) : undefined;
      if (!resolvedLocalId && isDirectTotemMode()) {
        const publisherId = await resolveSinglePublisherId(req.user?.publisherId);
        resolvedLocalId = await ensureDefaultLocalForPublisher(publisherId);
      }

      // Validar que localId foi fornecido (ou resolvido automaticamente)
      if (!resolvedLocalId) {
        return res.status(400).json({ 
          error: 'localId é obrigatório',
          details: [{ msg: 'Totem deve pertencer a um local' }]
        });
      }
      
      const totemData = {
        identifier: identifier || name,
        name: name || identifier,
        uin: uin || undefined,
        localId: resolvedLocalId,
        contract_id: contract_id || undefined, // Opcional - para rastreabilidade
        deviceId: deviceId || undefined,
        location,
        firmwareVersion: firmwareVersion || undefined,
        ...rest,
        description: rest.description || location
      };
      
      // Usar o ID do usuário autenticado
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Determinar publisherId do usuário (se não for admin)
      const userRole = req.user?.role;
      const isAdmin = [
        'admin',
        'admin_sql',
        'owner_system',
        'gerente_marketing',
        'operador_tecnico',
        'operador_faturamento',
        'operador_comercial',
      ].includes(userRole || '');
      const requestPublisherId = req.user?.publisherId || undefined;
      
      const totem = await getTotemService().createTotem(
        totemData,
        userId,
        requestPublisherId,
        isAdmin,
        String(userRole ?? '')
      );
      return res.status(201).json(totem);
    } catch (error: any) {
      await logError('Erro ao criar totem', error);
      if (error.message.includes('Acesso negado')) {
        return res.status(403).json({ error: error.message });
      }
      return res.status(400).json({ 
        error: error.message || 'Erro ao criar totem',
        details: error.message ? [{ msg: error.message }] : undefined
      });
    }
  }
);

/**
 * @route PUT /api/totems/:id
 * @desc Atualizar totem
 * @access Private (Admin only)
 */
router.put('/:id',
  authorizeRole(getTotemUpdateRoles()),
  param('id').isInt({ min: 1 }),
  body('identifier').optional({ nullable: true }).isString().isLength({ min: 2, max: 100 }),
  body('name').optional({ nullable: true }).isString().isLength({ min: 2, max: 100 }),
  body('uin').optional({ nullable: true }).isString(),
  body('deviceId').optional({ nullable: true }).isString(),
  body('localId').optional({ nullable: true }).isInt({ min: 1 }),
  body('clientId').optional({ nullable: true }).isInt({ min: 1 }),
  body('location').optional({ nullable: true }).isString().isLength({ min: 2, max: 200 }),
  body('description').optional({ nullable: true }).isString(),
  body('ipAddress').optional({ nullable: true }).isIP(),
  body('macAddress').optional({ nullable: true }).isMACAddress(),
  body('model').optional({ nullable: true }).isString(),
  body('serialNumber').optional({ nullable: true }).isString(),
  body('resolution').optional({ nullable: true }).isString(),
  body('orientation').optional({ nullable: true }).isString().isIn(['portrait', 'landscape']),
  body('isActive').optional({ nullable: true }).isBoolean(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
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
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }
      const totem = await getTotemService().updateTotem(totemId, totemData, userId);
      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }
      return res.json(totem);
    } catch (error: any) {
      await logError('Erro ao atualizar totem', error, {
        totemId: req.params.id,
        userId: req.user?.id || req.user?.userId,
      });
      return res.status(400).json({ error: error?.message || 'Erro ao atualizar totem' });
    }
  }
);

/**
 * @route DELETE /api/totems/:id
 * @desc Deletar totem
 * @access Private (Admin only)
 */
router.delete('/:id',
  authorizeRole(getTotemUpdateRoles()),
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      await getTotemService().deleteTotem(totemId, userId);
      return res.json({ message: 'Totem deletado com sucesso' });
    } catch (error: any) {
      await logError('Erro ao deletar totem', error, {
        totemId: req.params.id,
        userId: req.user?.id || req.user?.userId,
      });

      const message = error?.message || 'Erro ao deletar totem';
      // Erros de domínio conhecidos do TotemService
      if (message.includes('Totem não encontrado')) {
        return res.status(404).json({ error: message });
      }
      if (
        message.includes('Não é possível remover totem com dados associados') ||
        message.includes('Não é possível remover totem com mídias publicadas') ||
        message.includes('Falha ao remover totem')
      ) {
        return res.status(400).json({ error: message });
      }

      if (error?.code === '23503') {
        return res.status(400).json({
          error: `Falha ao remover totem: ainda existem registros vinculados (${error?.detail || message})`,
        });
      }

      return res.status(500).json({ error: message });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { isActive } = req.body;
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }
      if (isActive) {
        await getTotemService().activateTotem(totemId, userId);
      } else {
        await getTotemService().deactivateTotem(totemId, userId);
      }
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao alterar status do totem' });
    }
  }
);

/**
 * @route PUT /api/totems/:id/force-online
 * @desc Forçar totem a ficar online por X minutos (default 30)
 * @access Private (Admin)
 */
router.put('/:id/force-online',
  authorizeRole(['admin']),
  param('id').isInt({ min: 1 }),
  body('minutes').optional({ nullable: true }).isInt({ min: 1, max: 1440 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const minutes = req.body.minutes ? parseInt(req.body.minutes, 10) : 30;
      const userId = req.user?.id || req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Usuário não autenticado' });

      const totemService = getTotemService();
      await totemService.forceOnlineTotem(totemId, minutes, userId);
      return res.json({ success: true, message: `Totem forçado online por ${minutes} minutos` });
    } catch (error: any) {
      await logError('Erro ao forçar totem online', error, { totemId: req.params.id });
      return res.status(500).json({ success: false, error: error.message || 'Erro ao forçar totem online' });
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
  body('uptime').optional({ nullable: true }).isInt({ min: 0 }),
  body('memoryUsage').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('cpuUsage').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('diskUsage').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('temperature').optional({ nullable: true }).isFloat(),
  body('lastPlaylistUpdate').optional({ nullable: true }).isISO8601(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const heartbeatData = req.body;
      const heartbeat = await getTotemService().registerHeartbeat(totemId, heartbeatData);
      return res.json(heartbeat);
    } catch (error) {
      return res.status(400).json({ error: 'Erro ao registrar heartbeat' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { startDate, endDate, limit = 100 } = req.query;
      const heartbeats = await getTotemService().getHeartbeatHistory(totemId, {
        startDate: startDate as string,
        endDate: endDate as string,
        limit: Number(limit)
      });
      return res.json(heartbeats);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao obter histórico de heartbeats' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const playlist = await getTotemService().getCurrentPlaylist(totemId);
      return res.json(playlist);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao obter playlist do totem' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { startDate, endDate } = req.query;
      const analytics = await getTotemService().getTotemAnalytics(totemId, {
        startDate: startDate as string,
        endDate: endDate as string
      });
      return res.json(analytics);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao obter analytics do totem' });
    }
  }
);

/**
 * @route PUT /api/totems/:id/approve
 * @desc Aprovar totem pendente de aprovação
 * @access Private (Admin)
 */
router.put('/:id/approve',
  authorizeRole(getTotemApproveRoles()),
  param('id').isInt({ min: 1 }),
  body('generateEncryptedConfig').optional({ nullable: true }).isBoolean(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (isStudioRuntime()) {
        return res.status(400).json({
          error: 'Modo compacto: aprovação manual de totem não é necessária.'
        });
      }
      const totemId = parseInt(req.params.id);
      const { generateEncryptedConfig = false } = req.body;
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Buscar totem
      const isAdmin = isAdminRole(req.user?.role);
      const requestPublisherId = req.user?.publisherId || undefined;
      const totem = await getTotemService().getTotemByIdScoped(totemId, requestPublisherId, isAdmin);
      if (!totem) {
        return res.status(404).json({ error: 'Totem não encontrado' });
      }

      // Verificar se totem pode ser aprovado (não pode estar já online)
      const db = require('../config/database').getDatabase();
      const totemFull = await db.findFirst(`
        SELECT status, uin, identifier, config
        FROM totems
        WHERE totem_id = ?
      `, [totemId]);

      if (!totemFull) {
        return res.status(404).json({ 
          error: 'Totem não encontrado'
        });
      }

      // Totem já está online, não precisa aprovar novamente
      if (totemFull.status === 'online') {
        return res.status(400).json({ 
          error: 'Totem já está aprovado e online',
          currentStatus: totemFull.status
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
          const { config } = require('../config/env');
          const playerDir = config.player.dir;
          const secretKey = getTotemSecretKey();
          
          // Executar script de geração de config
          const path = require('path');
          const scriptPath = process.env.GENERATE_CONFIG_SCRIPT || 
                           path.join(__dirname, '../../scripts/generate-player-config.sh');
          
          await execAsync(`bash "${scriptPath}" "${totemFull.uin}" "${playerDir}" "${secretKey}"`, {
            timeout: 10000
          });
          
          encryptedConfigPath = `${playerDir}/config.json.enc`;
        } catch (configError: any) {
          await logWarn('Erro ao gerar config encriptado', { error: configError.message });
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
        await logWarn('Erro ao registrar log de auditoria', { error: auditError });
      }

      // Buscar totem atualizado
      const approvedTotem = await getTotemService().getTotemByIdScoped(totemId, requestPublisherId, isAdmin);

      return res.json({
        success: true,
        message: 'Totem aprovado com sucesso',
        totem: approvedTotem,
        encryptedConfigPath: encryptedConfigPath || undefined
      });
    } catch (error: any) {
      await logError('Erro ao aprovar totem', error);
      if ((error?.message || '').includes('Acesso negado') || (error?.message || '').includes('Modo compacto')) {
        return res.status(403).json({ error: error.message || 'Acesso negado' });
      }
      return res.status(500).json({ error: 'Erro ao aprovar totem', details: error.message });
    }
  }
);

// =============================================
// REMOTE CONTROL ROUTES
// =============================================

/**
 * @route POST /api/totems/:id/restart
 * @desc Envia comando de reinício remoto ao totem
 * @access Private (Admin, Manager)
 */
router.post('/:id/restart',
  param('id').isInt({ min: 1 }).withMessage('ID do totem inválido'),
  validateRequest,
  authorizeRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      await logInfo('Solicitando reinício remoto', { totemId, userId });

      const remoteCommandService = getRemoteCommandService();
      const command = await remoteCommandService.createCommand({
        totemId,
        commandType: 'restart',
        commandData: {
          reason: 'Manual restart requested',
          requestedBy: userId
        }
      }, userId);

      return res.json({
        success: true,
        message: 'Comando de reinício enviado ao totem',
        command: {
          id: command.id,
          status: command.status,
          createdAt: command.createdAt
        }
      });

    } catch (error: any) {
      await logError('Erro ao enviar comando de reinício', error, {
        totemId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao enviar comando de reinício'
      });
    }
  }
);

/**
 * @route POST /api/totems/:id/screenshot
 * @desc Solicita captura de screenshot remoto
 * @access Private (Admin, Manager)
 */
router.post('/:id/screenshot',
  param('id').isInt({ min: 1 }).withMessage('ID do totem inválido'),
  validateRequest,
  authorizeRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      await logInfo('Solicitando screenshot remoto', { totemId, userId });

      const remoteCommandService = getRemoteCommandService();
      const command = await remoteCommandService.createCommand({
        totemId,
        commandType: 'screenshot',
        commandData: {
          format: 'png',
          quality: 90
        }
      }, userId);

      return res.json({
        success: true,
        message: 'Comando de screenshot enviado ao totem',
        command: {
          id: command.id,
          status: command.status,
          createdAt: command.createdAt
        }
      });

    } catch (error: any) {
      await logError('Erro ao enviar comando de screenshot', error, {
        totemId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao enviar comando de screenshot'
      });
    }
  }
);

/**
 * @route POST /api/totems/:id/commands
 * @desc Enfileira comando remoto genérico para o totem
 * @access Private (Admin)
 */
router.post('/:id/commands',
  param('id').isInt({ min: 1 }).withMessage('ID do totem inválido'),
  body('type')
    .isString()
    .isIn([
      'invalidate_media',
      'invalidate_playlist',
      'invalidate_campaign',
      'refresh_dispatch',
      'sync_now',
      'content_version_check',
      'purge_cache',
      'restart_app',
      'reset_board',
      'capture_screen',
      // Compatibilidade com comandos legados já usados no painel
      'restart',
      'reboot',
      'screenshot'
    ])
    .withMessage('Tipo de comando inválido'),
  body('data').optional({ nullable: true }).isObject().withMessage('data deve ser objeto JSON'),
  validateRequest,
  authorizeRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id, 10);
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const type = String(req.body.type || '').trim();
      const data = req.body.data || {};

      const remoteCommandService = getRemoteCommandService();
      const command = await remoteCommandService.createCommand(
        {
          totemId,
          commandType: type as any,
          commandData: data,
        },
        userId
      );

      await logInfo('Comando remoto genérico enfileirado', {
        totemId,
        commandId: command.id,
        commandType: type,
        userId,
      });

      return res.json({
        success: true,
        message: 'Comando remoto enfileirado com sucesso',
        command: {
          id: command.id,
          type,
          status: command.status,
          createdAt: command.createdAt,
        },
      });
    } catch (error: any) {
      await logError('Erro ao enfileirar comando remoto genérico', error, {
        totemId: req.params.id,
        commandType: req.body?.type,
      });
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao enfileirar comando remoto',
      });
    }
  }
);

/**
 * @route GET /api/totems/:id/commands
 * @desc Obtém histórico de comandos remotos do totem
 * @access Private (Admin, Manager)
 */
router.get('/:id/commands',
  param('id').isInt({ min: 1 }).withMessage('ID do totem inválido'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit deve ser entre 1 e 100'),
  validateRequest,
  authorizeRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 50;

      const remoteCommandService = getRemoteCommandService();
      const commands = await remoteCommandService.getCommandHistory(totemId, limit);

      return res.json({
        success: true,
        data: commands
      });

    } catch (error: any) {
      await logError('Erro ao obter histórico de comandos', error, {
        totemId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter histórico de comandos'
      });
    }
  }
);

/**
 * @route GET /api/totems/:id/screenshots
 * @desc Obtém screenshots capturados do totem
 * @access Private (Admin, Manager)
 */
router.get('/:id/screenshots',
  param('id').isInt({ min: 1 }).withMessage('ID do totem inválido'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit deve ser entre 1 e 50'),
  validateRequest,
  authorizeRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 20;

      const remoteCommandService = getRemoteCommandService();
      const screenshots = await remoteCommandService.getScreenshots(totemId, limit);

      return res.json({
        success: true,
        data: screenshots
      });

    } catch (error: any) {
      await logError('Erro ao obter screenshots', error, {
        totemId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter screenshots'
      });
    }
  }
);

/**
 * @route GET /api/totems/:id/screenshots/:screenshotId/download
 * @desc Download de screenshot
 * @access Private (Admin, Manager)
 */
router.get('/:id/screenshots/:screenshotId/download',
  param('id').isInt({ min: 1 }),
  param('screenshotId').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const screenshotId = parseInt(req.params.screenshotId);
      const db = getDatabase();

      const screenshot = await db.findFirst(`
        SELECT file_path, format, totem_id
        FROM remote_screenshots
        WHERE id = $1 AND totem_id = $2
      `, [screenshotId, parseInt(req.params.id)]);

      if (!screenshot) {
        return res.status(404).json({
          success: false,
          error: 'Screenshot não encontrado'
        });
      }

      const fs = require('fs');

      if (!fs.existsSync(screenshot.file_path)) {
        return res.status(404).json({
          success: false,
          error: 'Arquivo de screenshot não encontrado'
        });
      }

      const fileName = `screenshot_${screenshotId}.${screenshot.format || 'png'}`;
      res.setHeader('Content-Type', `image/${screenshot.format || 'png'}`);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      const fileStream = fs.createReadStream(screenshot.file_path);
      fileStream.pipe(res);
      return; // pipe já envia a resposta

    } catch (error: any) {
      await logError('Erro ao fazer download de screenshot', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao fazer download de screenshot'
      });
    }
  }
);

/**
 * @route GET /api/totems/:id/logs
 * @desc Obtém logs de um totem
 * @access Private (Admin, Manager)
 */
router.get('/:id/logs',
  param('id').isInt({ min: 1 }).withMessage('ID do totem inválido'),
  query('level').optional().isIn(['info', 'warn', 'error', 'debug']).withMessage('level inválido'),
  query('startDate').optional().isISO8601().withMessage('startDate deve ser uma data válida'),
  query('endDate').optional().isISO8601().withMessage('endDate deve ser uma data válida'),
  query('search').optional().isString().withMessage('search deve ser uma string'),
  query('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('limit deve ser entre 1 e 10000'),
  validateRequest,
  authorizeRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { level, startDate, endDate, search, limit } = req.query;

      const totemLogService = getTotemLogService();
      const logs = await totemLogService.getTotemLogs({
        totemId,
        level: level as any,
        startDate: startDate as string,
        endDate: endDate as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined
      });

      return res.json({
        success: true,
        data: logs,
        count: logs.length
      });

    } catch (error: any) {
      await logError('Erro ao obter logs do totem', error, {
        totemId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter logs do totem'
      });
    }
  }
);

/**
 * @route GET /api/totems/:id/logs/download
 * @desc Download de logs de um totem
 * @access Private (Admin, Manager)
 */
router.get('/:id/logs/download',
  param('id').isInt({ min: 1 }).withMessage('ID do totem inválido'),
  query('level').optional().isIn(['info', 'warn', 'error', 'debug']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('search').optional().isString(),
  validateRequest,
  authorizeRole(['admin']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const { level, startDate, endDate, search } = req.query;

      const totemLogService = getTotemLogService();
      const { filePath, fileName } = await totemLogService.downloadLogs({
        totemId,
        level: level as any,
        startDate: startDate as string,
        endDate: endDate as string,
        search: search as string
      });

      const fs = require('fs');
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'Arquivo de log não encontrado'
        });
      }

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      // pipe já envia a resposta, não precisa return explícito
      // mas adicionamos para satisfazer TypeScript
      fileStream.on('close', () => {
        fs.unlink(filePath, (err: any) => {
          if (err) logError('Erro ao remover arquivo temporário de log', err, { filePath });
        });
      });
      return;

    } catch (error: any) {
      await logError('Erro ao fazer download de logs', error, {
        totemId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao fazer download de logs'
      });
    }
  }
);

/**
 * @route GET /api/totems/:id/playlist/mix
 * @desc Obter playlist mixada atual do totem
 * @access Private
 */
router.get('/:id/playlist/mix',
  param('id').isInt({ min: 1 }).withMessage('ID do totem inválido'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const playlist = await getTotemService().getCurrentMixedPlaylist(totemId);
      
      if (!playlist) {
        return res.status(404).json({
          success: false,
          error: 'Playlist mixada não encontrada'
        });
      }
      
      return res.json({
        success: true,
        data: playlist
      });
    } catch (error: any) {
      await logError('Erro ao obter playlist mixada', error, {
        totemId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter playlist mixada',
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/totems/:id/playlist/mix/generate
 * @desc Gerar nova playlist mixada para o totem
 * @access Private (Admin, Manager)
 */
router.post('/:id/playlist/mix/generate',
  param('id').isInt({ min: 1 }).withMessage('ID do totem inválido'),
  validateRequest,
  authorizeRole(['admin', 'manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.id);
      const mix = await getTotemService().generateMixedPlaylist(totemId);
      
      return res.json({
        success: true,
        data: mix,
        message: 'Playlist mixada gerada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao gerar playlist mixada', error, {
        totemId: req.params.id
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar playlist mixada',
        message: error.message
      });
    }
  }
);

export default router;
