/**
 * Publisher Routes - Smart Signage v2.1
 * Rotas para publishers (CRUD + visualização de campanhas mixadas)
 */

import { Router } from 'express';
import express from 'express';

import { PublisherService } from '../services/publisherService';
import { PublisherCampaignMixService } from '../services/publisherCampaignMixService';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { validateRequest as validateRequestMiddleware } from '../middleware/validation.middleware';
import { param, query, body, validationResult } from 'express-validator';
import { logError, logDebug } from '../utils/loggerHelper';
import { errorResponse } from '../utils/apiResponse';
import { isDatabaseError } from '../utils/dbErrors';
import { assertResourceMatchesPortalTenant } from '../utils/portalTenantAccess';
import { 

  paginationValidators, 
  searchValidators, 
  sortValidators, 
  dateRangeValidators,
  idParamValidatorDefault,
  // contractIdValidators removido - não utilizado
} from '../validators/common.validators';
import { isDirectTotemMode } from '../config/directTotemMode';
import { normalizeError } from '../utils/errors';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

function rejectIfPortalTenantMismatch(
  req: AuthenticatedRequest,
  res: express.Response,
  resource: { publisherId?: number; subscriberId?: number }
): boolean {
  const check = assertResourceMatchesPortalTenant(req.portalTenant, resource);
  if (!check.ok) {
    res.status(check.status).json({
      success: false,
      error: check.error,
      code: check.code,
    });
    return true;
  }
  return false;
}

/**
 * Em Direct Totem só a organização is_system_owner é visível/editável.
 * Retorna true se a resposta já foi enviada (acesso negado).
 */
async function rejectIfHiddenInDirectTotemMode(
  res: express.Response,
  publisherId: number
): Promise<boolean> {
  if (!isDirectTotemMode()) {
    return false;
  }
  const isOwner = await getPublisherService().isSystemOwnerPublisher(publisherId);
  if (isOwner) {
    return false;
  }
  res.status(404).json({
    ...errorResponse('Publisher não encontrado'),
    code: 'DIRECT_TOTEM_ORG_HIDDEN',
    message:
      'Em Direct Totem só a organização owner do sistema está disponível. Organizações residuais de multi-agência ficam ocultas.',
  });
  return true;
}

// Lazy initialization - PublisherService (CRUD)
function getPublisherService(): PublisherService {
  if (!(global as any).publisherServiceInstance) {
    (global as any).publisherServiceInstance = new PublisherService();
  }
  return (global as any).publisherServiceInstance;
}

// Lazy initialization - PublisherCampaignMixService (Mixagem)
function getPublisherCampaignMixService(): PublisherCampaignMixService {
  if (!(global as any).publisherCampaignMixServiceInstance) {
    (global as any).publisherCampaignMixServiceInstance = new PublisherCampaignMixService();
  }
  return (global as any).publisherCampaignMixServiceInstance;
}

// Validações para criação de publisher (payload aninhado em `publisher`)
const createPublisherValidator = [
  // publisher.name obrigatório dentro do objeto publisher
  body('publisher.name').notEmpty().withMessage('Nome é obrigatório').isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('publisher.contract_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Contract ID inválido (opcional, para rastreabilidade)'),
  body('publisher.contact_name').optional({ nullable: true }).isString(),
  body('publisher.category_segment').optional({ nullable: true }).isString(),
  body('publisher.email').optional({ checkFalsy: true, nullable: true }).isEmail().withMessage('Email deve ser válido'),
  body('publisher.phone').optional({ checkFalsy: true, nullable: true }).isString().withMessage('Telefone deve ser uma string'),
  body('publisher.whatsapp').optional({ checkFalsy: true, nullable: true }).isString().withMessage('WhatsApp deve ser uma string'),
  body('publisher.description').optional({ nullable: true }).isString().isLength({ max: 1000 }).withMessage('Descrição deve ter no máximo 1000 caracteres'),
  // Regra do domínio: Publisher NUNCA é Subscriber/ambos. Esses campos são ignorados/removidos.
];

const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction): express.Response | void => {
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
 * @route GET /api/publishers
 * @desc Listar todos os publishers
 */
router.get('/',
  ...paginationValidators,
  ...searchValidators,
  ...sortValidators,
  ...dateRangeValidators,
  query('active_only').optional().isBoolean(),
  validateRequest,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        active_only,
        sortBy = 'created_at',
        sortOrder = 'desc',
        createdFrom,
        createdTo
      } = req.query;

      // Host tenant: lista só a organização do slug
      if (req.portalTenant?.role === 'publisher' && req.portalTenant.publisherId != null) {
        const one = await getPublisherService().getPublisherById(req.portalTenant.publisherId);
        return res.json({
          success: true,
          data: one ? [one] : [],
          total: one ? 1 : 0,
          page: 1,
          limit: 1,
        });
      }

      const directMode = isDirectTotemMode();
      const residualOrganizations = directMode
        ? await getPublisherService().countActiveNonOwnerPublishers()
        : 0;
      
      const result = await getPublisherService().getAllPublishers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        // active_only:
        // - undefined => usar default do service
        // - true => filtrar apenas ativos
        // - false => NÃO filtrar por ativo (incluir inativos também)
        active_only: typeof active_only === 'string' ? active_only === 'true' : undefined,
        system_owner_only: directMode,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        createdFrom: createdFrom as string,
        createdTo: createdTo as string,
      });
      
      return res.json({
        success: true,
        ...result,
        ...(directMode ? { residual_organizations: residualOrganizations } : {}),
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar publishers', e.error);
      return res.status(500).json(errorResponse('Erro interno do servidor'));
    }
  }
);

/**
 * @route POST /api/publishers
 * @desc Criar novo publisher
 * @access Private (Apenas roles administrativos - baseado em contrato)
 */
router.post('/',
  createPublisherValidator,
  validateRequest,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      if (isDirectTotemMode()) {
        return res.status(403).json({
          ...errorResponse(
            'Criação de organização indisponível em Direct Totem',
            'Em Direct Totem só existe a organização owner do sistema. Active multi-agência (Lite/Pro) para criar outras organizações.'
          ),
          code: 'DIRECT_TOTEM_SINGLE_ORG',
        });
      }
      const pubBody = req.body && req.body.publisher ? req.body.publisher : req.body;
      const { name, contact_name, email, phone, whatsapp, category_segment, description, portal_slug, contract_id } = pubBody;

      // Se o payload trouxer recursos aninhados (locals/totems/smartTvs/contracts), usar criação transacional
      if (req.body.locals || req.body.totems || req.body.smartTvs || req.body.contracts) {
        const payload = {
          publisher: { name, contact_name, email, phone, whatsapp, category_segment, description, portal_slug, contract_id },
          locals: req.body.locals,
          totems: req.body.totems,
          smartTvs: req.body.smartTvs,
          contracts: req.body.contracts
        };
        const newPublisher = await getPublisherService().createPublisherWithResources(payload);
        return res.status(201).json(newPublisher);
      }

      const newPublisher = await getPublisherService().createPublisher({
        name,
        contact_name,
        email,
        phone,
        whatsapp,
        category_segment,
        description,
        portal_slug,
        contract_id, // Opcional - vincula publisher ao contrato (para rastreabilidade)
      });

      return res.status(201).json(newPublisher);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar publisher', e.error, { body: req.body });
      const message = e.message || 'Erro interno ao criar organização';
      const status = isDatabaseError(e.raw) ? 500 : 400;
      return res.status(status).json({
        ...errorResponse('Erro ao criar publisher', message),
        details: process.env.NODE_ENV !== 'production' ? ((e.raw as { detail?: string })?.detail || e.code) : undefined,
    });
    }
  }
);

/**
 * @route GET /api/publishers/:id/totems/:totemId/campaigns/mixed
 * @desc Obtém campanhas mixadas para um totem específico
 * @access Private (Admin, Publisher)
 * 
 * IMPORTANTE: Rotas específicas devem vir ANTES de rotas genéricas para evitar conflito
 */
router.get('/:id/totems/:totemId/campaigns/mixed',
  ...idParamValidatorDefault,
  param('totemId').isInt({ min: 1 }).withMessage('Totem ID inválido'),
  query('date').optional().isISO8601(),
  query('time').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  query('dayOfWeek').optional().isIn(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  validateRequestMiddleware,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const publisherId = parseInt(req.params.id);
      const totemId = parseInt(req.params.totemId);
      const { date, time, dayOfWeek } = req.query;
      
      if (!req.user) {
        return res.status(401).json(errorResponse('Não autenticado'));
      }
      
      // Validar acesso
      if (req.user!.role !== 'admin' && req.user!.publisherId !== publisherId) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Você só pode visualizar campanhas do seu próprio publisher'
        });
      }
      
      const mixedCampaigns = await getPublisherCampaignMixService().getMixedCampaignsForTotem(
        publisherId,
        totemId,
        {
          date: date as string | undefined,
          time: time as string | undefined,
          dayOfWeek: dayOfWeek as string | undefined
        }
      );
      
      return res.json({
        success: true,
        data: {
          campaigns: mixedCampaigns,
          total: mixedCampaigns.length,
          publisherId,
          totemId
        }
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter campanhas mixadas para totem', e.error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter campanhas mixadas',
        message: e.message || 'Erro interno do servidor'
      
    });
    }
  }
);

/**
 * @route GET /api/publishers/:id/campaigns/mixed
 * @desc Obtém campanhas mixadas para um publisher
 * @access Private (Admin, Publisher)
 * 
 * IMPORTANTE: Esta rota deve vir ANTES de router.get('/:id') para evitar conflito de rotas
 */
router.get('/:id/campaigns/mixed',
  ...idParamValidatorDefault,
  query('totemId').optional().isInt({ min: 1 }),
  query('date').optional().isISO8601(),
  query('time').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  query('dayOfWeek').optional().isIn(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  validateRequestMiddleware,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      if (!req.user) {
        return res.status(401).json(errorResponse('Não autenticado'));
      }
      
      const publisherId = parseInt(req.params.id);
      const { totemId, date, time, dayOfWeek } = req.query;
      
      // Validar acesso: admin pode ver qualquer publisher, publisher só vê o seu
      if (req.user!.role !== 'admin' && req.user!.publisherId !== publisherId) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Você só pode visualizar campanhas do seu próprio publisher'
        });
      }
      
      const mixedCampaigns = await getPublisherCampaignMixService().getMixedCampaigns({
        publisherId,
        totemId: totemId ? parseInt(totemId as string) : undefined,
        date: date as string | undefined,
        time: time as string | undefined,
        dayOfWeek: dayOfWeek as string | undefined
      });
      
      await logDebug('Campanhas mixadas obtidas para publisher', {
        publisherId,
        totemId,
        count: mixedCampaigns.length
      });
      
      return res.json({
        success: true,
        data: {
          campaigns: mixedCampaigns,
          total: mixedCampaigns.length,
          publisherId
        }
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter campanhas mixadas', e.error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter campanhas mixadas',
        message: e.message || 'Erro interno do servidor'
      
    });
    }
  }
);

/**
 * @route GET /api/publishers/:id/locals
 * @desc Listar locals de um publisher
 */
router.get('/:id/locals',
  ...idParamValidatorDefault,
  validateRequest,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const pid = parseInt(id, 10);
      if (await rejectIfHiddenInDirectTotemMode(res, pid)) {
        return;
      }
      const locals = await getPublisherService().getLocalsByPublisher(pid);
      return res.json({
        success: true, data: locals });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar locals do publisher', e.error);
      return res.status(500).json(errorResponse('Erro interno do servidor'));
    }
  }
);

/**
 * @route GET /api/publishers/:id/totems
 * @desc Listar totems de um publisher
 */
router.get('/:id/totems',
  ...idParamValidatorDefault,
  validateRequest,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const pid = parseInt(id, 10);
      if (await rejectIfHiddenInDirectTotemMode(res, pid)) {
        return;
      }
      const totems = await getPublisherService().getTotemsByPublisher(pid);
      return res.json({
        success: true, data: totems });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar totems do publisher', e.error);
      return res.status(500).json(errorResponse('Erro interno do servidor'));
    }
  }
);

/**
 * @route GET /api/publishers/:id/smart-tvs
 * @desc Listar smart TVs de um publisher
 */
router.get('/:id/smart-tvs',
  ...idParamValidatorDefault,
  validateRequest,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const pid = parseInt(id, 10);
      if (await rejectIfHiddenInDirectTotemMode(res, pid)) {
        return;
      }
      const smartTvs = await getPublisherService().getSmartTvsByPublisher(pid);
      return res.json({
        success: true, data: smartTvs });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar smart TVs do publisher', e.error);
      return res.status(500).json(errorResponse('Erro interno do servidor'));
    }
  }
);

/**
 * @route GET /api/publishers/:id/stats
 * @desc Obter estatísticas de um publisher
 */
router.get('/:id/stats',
  ...idParamValidatorDefault,
  validateRequest,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const pid = parseInt(id, 10);
      if (await rejectIfHiddenInDirectTotemMode(res, pid)) {
        return;
      }
      const stats = await getPublisherService().getPublisherStats(pid);
      return res.json({
        success: true, data: stats });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter estatísticas do publisher', e.error);
      return res.status(500).json(errorResponse('Erro interno do servidor'));
    }
  }
);

/**
 * @route GET /api/publishers/:id
 * @desc Obter publisher por ID
 * 
 * IMPORTANTE: Esta rota deve vir DEPOIS das rotas específicas para evitar conflito
 */
router.get('/:id',
  ...idParamValidatorDefault,
  validateRequest,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const pid = parseInt(id, 10);
      if (rejectIfPortalTenantMismatch(req, res, { publisherId: pid })) {
        return;
      }
      if (await rejectIfHiddenInDirectTotemMode(res, pid)) {
        return;
      }
      
      const publisher = await getPublisherService().getPublisherById(pid);
      
      if (!publisher) {
        return res.status(404).json(errorResponse('Publisher não encontrado'));
      }

      return res.json({
        success: true, data: publisher });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao obter publisher', e.error);
      return res.status(500).json(errorResponse('Erro interno do servidor'));
    }
  }
);

/**
 * @route PUT /api/publishers/:id
 * @desc Atualizar publisher
 */
router.put('/:id',
  ...idParamValidatorDefault,
  validateRequest,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const pid = parseInt(id, 10);
      if (rejectIfPortalTenantMismatch(req, res, { publisherId: pid })) {
        return;
      }
      if (await rejectIfHiddenInDirectTotemMode(res, pid)) {
        return;
      }
      const { name, contact_name, email, phone, whatsapp, category_segment, description, portal_slug, active, is_active } = req.body;
      // Aceitar active ou is_active (frontend pode enviar qualquer um); BD usa coluna is_active
      const activeValue = active !== undefined ? !!active : (is_active !== undefined ? !!is_active : undefined);
      
      const updatedPublisher = await getPublisherService().updatePublisher(parseInt(id), {
        name,
        contact_name,
        email,
        phone,
        whatsapp,
        category_segment,
        description,
        portal_slug,
        is_active: activeValue
      });
      
      return res.json(updatedPublisher);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar publisher', e.error);
      return res.status(400).json(errorResponse('Erro ao atualizar publisher', e.message));
    }
  }
);

/**
 * @route DELETE /api/publishers/:id
 * @desc Deletar publisher (soft delete)
 */
router.delete('/:id',
  ...idParamValidatorDefault,
  validateRequest,
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const pid = parseInt(id, 10);
      if (rejectIfPortalTenantMismatch(req, res, { publisherId: pid })) {
        return;
      }
      if (await rejectIfHiddenInDirectTotemMode(res, pid)) {
        return;
      }
      
      await getPublisherService().deletePublisher(pid);
      
      return res.json({
        success: true, message: 'Publisher deletado com sucesso' });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao deletar publisher', e.error);
      return res.status(400).json(errorResponse('Erro ao deletar publisher', e.message));
    }
  }
);

export default router;
