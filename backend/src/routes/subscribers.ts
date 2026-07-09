import express from 'express';
import { body, query, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { protectContractValues } from '../middleware/contractValuesProtection.middleware';
import { getSubscriberService } from '../services/subscriberService';
import { logError } from '../utils/loggerHelper';
import { isDatabaseError, isUniqueViolationError } from '../utils/dbErrors';
import { assertTenantClientParamAccess } from '../utils/tenantClientAccess';
import { 
  paginationValidators, 
  searchValidators, 
  sortValidators, 
  dateRangeValidators,
  idParamValidatorDefault,
  nameValidators,
  emailValidators,
  phoneValidators,
  // descriptionValidators removido - não utilizado
} from '../validators/common.validators';
import { planLimitsValidators, storageValidators, totemAccessValidators } from '../validators/plan.validators';

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Validações - usando validadores centralizados
const createSubscriberValidator = [
  ...nameValidators,
  // contract_id é opcional (pode criar subscriber sem contrato). Tratar '' como ausente.
  body('contract_id').optional({ checkFalsy: true, nullable: true }).isInt({ min: 1 }).withMessage('Contract ID inválido'),
  body('contact_name').optional({ nullable: true }).isString(),
  body('category_segment').optional({ nullable: true }).isString(),
  ...emailValidators,
  ...phoneValidators,
  body('address').optional({ nullable: true }).isString(),
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

async function ensureSubscriberResourceAccess(req: any, res: any, subscriberId: number): Promise<boolean> {
  try {
    await assertTenantClientParamAccess(req, subscriberId);
    return true;
  } catch (e: any) {
    if (e?.statusCode === 403) {
      res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: e.message || 'Acesso negado',
      });
      return false;
    }
    throw e;
  }
}

/** Normaliza body para validação: quando enviar subscriber + contracts, expõe subscriber.name como name para o nameValidator. */
const normalizeSubscriberCreateBody = (req: any, _res: any, next: any) => {
  if (Array.isArray(req.body.contracts) && req.body.subscriber && req.body.name === undefined) {
    req.body.name = req.body.subscriber.name;
  }
  next();
};

/**
 * @route GET /api/subscribers
 * @desc Listar todos os subscribers (anunciantes)
 */
router.get('/', 
  ...paginationValidators,
  ...searchValidators,
  ...sortValidators,
  ...dateRangeValidators,
  query('is_active').optional().isIn(['true', 'false', '1', '0']).withMessage('is_active deve ser "true" ou "false"'),
  query('active_only').optional().isIn(['true', 'false', '1', '0']).withMessage('active_only deve ser "true" ou "false"'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        is_active,
        active_only,
        sortBy = 'created_at',
        sortOrder = 'desc',
        createdFrom,
        createdTo
      } = req.query;
      
      const activeFilter =
        is_active !== undefined
          ? (is_active === 'true' || is_active === '1')
          : active_only === 'true' || active_only === '1'
            ? true
            : undefined;

      const result = await getSubscriberService().getAllSubscribers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        is_active: activeFilter,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        createdFrom: createdFrom as string,
        createdTo: createdTo as string,
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
  ...idParamValidatorDefault,
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const sid = parseInt(id, 10);
      if (!(await ensureSubscriberResourceAccess(req, res, sid))) {
        return;
      }

      const subscriber = await getSubscriberService().getSubscriberById(sid);
      
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
 * @desc Criar novo subscriber (anunciante).
 * Aceita dois formatos:
 * - Simples: body com name, contact_name, ... (createSubscriber).
 * - Com contratos: body com subscriber: { name, ... } e contracts: [ { plan_id?, title, ... } ] (procedure create_subscriber_with_contracts; contract_number gerado no banco como SUB-{id}.{seq}).
 * @access Private (Apenas roles administrativos - baseado em contrato)
 */
router.post('/',
  normalizeSubscriberCreateBody,
  createSubscriberValidator,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  async (req: any, res: any) => {
    try {
      // Se vier contracts (array), criar subscriber + contratos numa única transação (procedure)
      if (Array.isArray(req.body.contracts)) {
        const sub = req.body.subscriber ?? req.body;
        if (!sub?.name || !String(sub.name).trim()) {
          return res.status(400).json({ error: 'Nome do subscriber é obrigatório quando se envia contracts' });
        }
        const newSubscriber = await getSubscriberService().createSubscriberWithContracts({
          subscriber: sub,
          contracts: req.body.contracts,
        });
        return res.status(201).json(newSubscriber);
      }

      const { name, contact_name, email, phone, whatsapp, address, category_segment, description, contract_id } = req.body;

      const newSubscriber = await getSubscriberService().createSubscriber({
        name,
        contact_name,
        email,
        phone,
        whatsapp,
        address,
        category_segment,
        description,
        contract_id,
      });

      return res.status(201).json(newSubscriber);
    } catch (error: any) {
      await logError('Erro ao criar subscriber', error);
      const status = isUniqueViolationError(error) || !isDatabaseError(error) ? 400 : 500;
      return res.status(status).json({ error: error.message || 'Erro ao criar subscriber' });
    }
  }
);

/**
 * @route PUT /api/subscribers/:id
 * @desc Atualizar subscriber
 */
router.put('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('name').optional({ nullable: true }).notEmpty().withMessage('Nome não pode ser vazio'),
  // Allow null/empty values for optional fields (frontend may send null)
  body('contact_name').optional({ nullable: true, checkFalsy: true }).isString(),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email inválido'),
  body('phone').optional({ nullable: true, checkFalsy: true }).isString(),
  body('whatsapp').optional({ nullable: true, checkFalsy: true }).isString(),
  body('address').optional({ nullable: true, checkFalsy: true }).isString(),
  body('category_segment').optional({ nullable: true, checkFalsy: true }).isString(),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const sid = parseInt(id, 10);
      if (!(await ensureSubscriberResourceAccess(req, res, sid))) {
        return;
      }
      const { name, contact_name, email, phone, whatsapp, address, category_segment, description } = req.body;

      const updatedSubscriber = await getSubscriberService().updateSubscriber(sid, {
        name,
        contact_name,
        email,
        phone,
        whatsapp,
        address,
        category_segment,
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
      const sid = parseInt(id, 10);
      if (!(await ensureSubscriberResourceAccess(req, res, sid))) {
        return;
      }

      await getSubscriberService().deleteSubscriber(sid);
      
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
      const sid = parseInt(id, 10);
      if (!(await ensureSubscriberResourceAccess(req, res, sid))) {
        return;
      }
      const locals = await getSubscriberService().getLocalsBySubscriber(sid);
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
  query('contractId').optional().isInt({ min: 1 }).withMessage('contractId inválido'),
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const subscriberId = parseInt(id, 10);
      if (!(await ensureSubscriberResourceAccess(req, res, subscriberId))) {
        return;
      }
      const contractIdRaw = req.query?.contractId;
      const contractId =
        contractIdRaw !== undefined && contractIdRaw !== null && String(contractIdRaw).trim() !== ''
          ? parseInt(String(contractIdRaw), 10)
          : undefined;
      const totems =
        contractId !== undefined && !Number.isNaN(contractId)
          ? await getSubscriberService().getTotemsBySubscriberContract(subscriberId, contractId)
          : await getSubscriberService().getTotemsBySubscriber(subscriberId);
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
      const sid = parseInt(id, 10);
      if (!(await ensureSubscriberResourceAccess(req, res, sid))) {
        return;
      }
      const smartTvs = await getSubscriberService().getSmartTvsBySubscriber(sid);
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
      const sid = parseInt(id, 10);
      if (!(await ensureSubscriberResourceAccess(req, res, sid))) {
        return;
      }
      const stats = await getSubscriberService().getSubscriberStats(sid);
      return res.json({ success: true, data: stats });
    } catch (error: any) {
      await logError('Erro ao obter estatísticas do subscriber', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * @route GET /api/subscribers/:id/contracts
 * @desc Listar contratos de um subscriber. Query: ?activeOnly=true (default) só ativos; ?activeOnly=false todos (para aba Contratos na edição do anunciante).
 */
router.get('/:id/contracts',
  ...idParamValidatorDefault,
  validateRequest,
  protectContractValues,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const sid = parseInt(id, 10);
      if (!(await ensureSubscriberResourceAccess(req, res, sid))) {
        return;
      }
      const activeOnly = req.query.activeOnly !== 'false';

      const contracts = await getSubscriberService().getSubscriberContracts(sid, activeOnly);
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
  ...idParamValidatorDefault,
  ...planLimitsValidators,
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const sid = parseInt(id, 10);
      if (!(await ensureSubscriberResourceAccess(req, res, sid))) {
        return;
      }
      const { resourceType } = req.query;

      const limits = await getSubscriberService().getMaxLimits(sid);
      const currentCount = await getSubscriberService().getCurrentResourceCount(
        sid,
        resourceType as 'media' | 'playlist' | 'campaign'
      );
      
      const limitKey = resourceType === 'media' ? 'medias' : 
                      resourceType === 'playlist' ? 'playlists' : 
                      'campaigns';
      const maxLimit = limits[limitKey];
      
      const canCreate =
        maxLimit === undefined || maxLimit === 0 || currentCount < maxLimit;
      
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
  ...idParamValidatorDefault,
  ...storageValidators,
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const sid = parseInt(id, 10);
      if (!(await ensureSubscriberResourceAccess(req, res, sid))) {
        return;
      }
      const { fileSizeBytes } = req.query;

      const limits = await getSubscriberService().getMaxLimits(sid);
      const currentStorage = await getSubscriberService().getCurrentStorage(sid);
      
      const maxStorageBytes =
        limits.storage_gb !== undefined && limits.storage_gb !== 0
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
  ...idParamValidatorDefault,
  ...totemAccessValidators,
  validateRequest,
  async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const sid = parseInt(id, 10);
      if (!(await ensureSubscriberResourceAccess(req, res, sid))) {
        return;
      }
      const { totemId } = req.query;

      const hasAccess = await getSubscriberService().validateTotemAccess(
        sid,
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

