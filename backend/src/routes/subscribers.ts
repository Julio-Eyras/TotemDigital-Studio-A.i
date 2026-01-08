import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getSubscriberService } from '../services/subscriberService';
import { logError } from '../utils/loggerHelper';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações
const createSubscriberValidator = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('contract_id').isInt({ min: 1 }).withMessage('Contract ID é obrigatório'),
  body('contact_name').optional().isString(),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('phone').optional().isString(),
  body('whatsapp').optional().isString(),
  body('address').optional().isString(),
];

const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  return next();
};

/**
 * @route GET /api/subscribers
 * @desc Listar todos os subscribers (anunciantes)
 */
router.get('/', 
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { page = 1, limit = 10, search } = req.query;
      
      const result = await getSubscriberService().getAllSubscribers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
      });
      
      return res.json(result);
    } catch (error) {
      await logError('Erro ao listar subscribers', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id
 * @desc Obter subscriber por ID
 */
router.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      const subscriber = await getSubscriberService().getSubscriberById(parseInt(id));
      
      if (!subscriber) {
        return res.status(404).json({ error: 'Subscriber não encontrado' });
      }

      return res.json(subscriber);
    } catch (error) {
      await logError('Erro ao obter subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route POST /api/subscribers
 * @desc Criar novo subscriber (anunciante)
 * @access Private (Apenas roles administrativos - baseado em contrato)
 */
router.post('/',
  createSubscriberValidator,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  async (req: any, res: any) => {
    try {
      const { name, contact_name, email, phone, whatsapp, address, description, contract_id } = req.body;
      
      const newSubscriber = await getSubscriberService().createSubscriber({
        name,
        contact_name,
        email,
        phone,
        whatsapp,
        address,
        description,
        contract_id, // Obrigatório - vincula subscriber ao contrato
      });

      return res.status(201).json(newSubscriber);
    } catch (error: any) {
      await logError('Erro ao criar subscriber', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route PUT /api/subscribers/:id
 * @desc Atualizar subscriber
 */
router.put('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('name').optional().notEmpty().withMessage('Nome não pode ser vazio'),
  body('contact_name').optional().isString(),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('phone').optional().isString(),
  body('whatsapp').optional().isString(),
  body('address').optional().isString(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { name, contact_name, email, phone, whatsapp, address, description } = req.body;
      
      const updatedSubscriber = await getSubscriberService().updateSubscriber(parseInt(id), {
        name,
        contact_name,
        email,
        phone,
        whatsapp,
        address,
        description,
      });

      return res.json(updatedSubscriber);
    } catch (error: any) {
      await logError('Erro ao atualizar subscriber', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route DELETE /api/subscribers/:id
 * @desc Excluir subscriber (soft delete)
 */
router.delete('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      await getSubscriberService().deleteSubscriber(parseInt(id));
      
      return res.status(204).send();
    } catch (error: any) {
      await logError('Erro ao excluir subscriber', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/locals
 * @desc Listar locals de um subscriber
 */
router.get('/:id/locals',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const locals = await getSubscriberService().getLocalsBySubscriber(parseInt(id));
      return res.json({ success: true, data: locals });
    } catch (error: any) {
      await logError('Erro ao listar locals do subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/totems
 * @desc Listar totems de um subscriber
 */
router.get('/:id/totems',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const totems = await getSubscriberService().getTotemsBySubscriber(parseInt(id));
      return res.json({ success: true, data: totems });
    } catch (error: any) {
      await logError('Erro ao listar totems do subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/smart-tvs
 * @desc Listar smart TVs de um subscriber
 */
router.get('/:id/smart-tvs',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const smartTvs = await getSubscriberService().getSmartTvsBySubscriber(parseInt(id));
      return res.json({ success: true, data: smartTvs });
    } catch (error: any) {
      await logError('Erro ao listar smart TVs do subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/stats
 * @desc Obter estatísticas de um subscriber
 */
router.get('/:id/stats',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const stats = await getSubscriberService().getSubscriberStats(parseInt(id));
      return res.json({ success: true, data: stats });
    } catch (error: any) {
      await logError('Erro ao obter estatísticas do subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/contracts
 * @desc Listar contratos ativos de um subscriber
 */
router.get('/:id/contracts',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      // Verificar permissão: subscriber só pode ver seus próprios contratos
      if (req.user.role === 'client' || req.user.role === 'subscriber') {
        const userSubscriberId = req.subscriberId || req.user.clientId || req.user.subscriberId;
        if (userSubscriberId !== parseInt(id)) {
          return res.status(403).json({
            success: false,
            error: 'Acesso negado',
            message: 'Você só pode ver seus próprios contratos'
          });
        }
      }
      
      const contracts = await getSubscriberService().getActiveContracts(parseInt(id));
      return res.json({ success: true, data: contracts });
    } catch (error: any) {
      await logError('Erro ao listar contratos do subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/validate/plan-limits
 * @desc Validar limites de plano antes de criar recurso
 */
router.get('/:id/validate/plan-limits',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  query('resourceType').isIn(['media', 'playlist', 'campaign']).withMessage('Tipo de recurso inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { resourceType } = req.query;
      
      const limits = await getSubscriberService().getMaxLimits(parseInt(id));
      const currentCount = await getSubscriberService().getCurrentResourceCount(
        parseInt(id),
        resourceType as 'media' | 'playlist' | 'campaign'
      );
      
      const limitKey = resourceType === 'media' ? 'medias' : 
                      resourceType === 'playlist' ? 'playlists' : 
                      'campaigns';
      const maxLimit = limits[limitKey];
      
      const canCreate = maxLimit === undefined || currentCount < maxLimit;
      
      return res.json({
        valid: canCreate,
        current: currentCount,
        limit: maxLimit,
        remaining: maxLimit !== undefined ? maxLimit - currentCount : null,
        message: canCreate 
          ? `Você pode criar ${maxLimit !== undefined ? maxLimit - currentCount : 'ilimitados'} ${resourceType === 'media' ? 'mídia(s)' : resourceType === 'playlist' ? 'playlist(s)' : 'campanha(s)'}`
          : `Limite atingido: você já possui ${currentCount} ${resourceType === 'media' ? 'mídia(s)' : resourceType === 'playlist' ? 'playlist(s)' : 'campanha(s)'} de ${maxLimit} permitidas`
      });
    } catch (error: any) {
      await logError('Erro ao validar limites de plano', error);
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/validate/storage
 * @desc Validar limite de storage antes de fazer upload
 */
router.get('/:id/validate/storage',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  query('fileSizeBytes').isInt({ min: 0 }).withMessage('Tamanho do arquivo inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { fileSizeBytes } = req.query;
      
      const limits = await getSubscriberService().getMaxLimits(parseInt(id));
      const currentStorage = await getSubscriberService().getCurrentStorage(parseInt(id));
      
      const maxStorageBytes = limits.storage_gb !== undefined
        ? limits.storage_gb * 1024 * 1024 * 1024
        : null;
      
      const newFileSizeBytes = parseInt(fileSizeBytes as string);
      const totalAfterUpload = currentStorage + newFileSizeBytes;
      
      const canUpload = maxStorageBytes === null || totalAfterUpload <= maxStorageBytes;
      
      return res.json({
        valid: canUpload,
        currentBytes: currentStorage,
        currentGB: currentStorage / (1024 * 1024 * 1024),
        limitBytes: maxStorageBytes,
        limitGB: maxStorageBytes ? maxStorageBytes / (1024 * 1024 * 1024) : null,
        fileSizeBytes: newFileSizeBytes,
        fileSizeGB: newFileSizeBytes / (1024 * 1024 * 1024),
        totalAfterUploadBytes: totalAfterUpload,
        totalAfterUploadGB: totalAfterUpload / (1024 * 1024 * 1024),
        remainingBytes: maxStorageBytes ? maxStorageBytes - currentStorage : null,
        remainingGB: maxStorageBytes ? (maxStorageBytes - currentStorage) / (1024 * 1024 * 1024) : null,
        message: canUpload
          ? `Upload permitido. Storage disponível: ${maxStorageBytes !== null ? ((maxStorageBytes - currentStorage) / (1024 * 1024 * 1024)).toFixed(2) : 'ilimitado'} GB`
          : `Limite de storage excedido. Você tem ${(currentStorage / (1024 * 1024 * 1024)).toFixed(2)} GB de ${maxStorageBytes !== null ? (maxStorageBytes / (1024 * 1024 * 1024)).toFixed(2) : 'ilimitado'} GB permitidos`
      });
    } catch (error: any) {
      await logError('Erro ao validar storage', error);
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/validate/totem-access
 * @desc Validar acesso a totem antes de associar campanha
 */
router.get('/:id/validate/totem-access',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  query('totemId').isInt({ min: 1 }).withMessage('Totem ID inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { totemId } = req.query;
      
      const hasAccess = await getSubscriberService().validateTotemAccess(
        parseInt(id),
        parseInt(totemId as string)
      );
      
      return res.json({
        valid: hasAccess,
        message: hasAccess
          ? 'Acesso ao totem permitido'
          : 'Acesso negado: você não tem permissão para acessar este totem através de seus contratos/planos'
      });
    } catch (error: any) {
      await logError('Erro ao validar acesso a totem', error);
      return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

export default router;

