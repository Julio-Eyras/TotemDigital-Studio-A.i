/**
 * Publisher Routes - Smart Signage v2.1
 * Rotas para publishers (CRUD + visualização de campanhas mixadas)
 */

import { Router, Response } from 'express';
import { PublisherService } from '../services/publisherService';
import { PublisherCampaignMixService } from '../services/publisherCampaignMixService';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { validateRequest as validateRequestMiddleware } from '../middleware/validation.middleware';
import { param, query, body, validationResult } from 'express-validator';
import { logError, logDebug } from '../utils/loggerHelper';
import { 
  paginationValidators, 
  searchValidators, 
  sortValidators, 
  dateRangeValidators,
  idParamValidatorDefault,
  nameValidators,
  emailValidators,
  phoneValidators,
  descriptionValidators,
  // contractIdValidators removido - não utilizado
} from '../validators/common.validators';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

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

// Validações - usando validadores centralizados
const createPublisherValidator = [
  ...nameValidators,
  body('contract_id').optional().isInt({ min: 1 }).withMessage('Contract ID inválido (opcional, para rastreabilidade)'),
  body('contact_name').optional().isString(),
  ...emailValidators,
  ...phoneValidators,
  ...descriptionValidators,
  body('is_subscriber').optional().isBoolean(),
  body('is_publisher').optional().isBoolean(),
  body('client_type').optional().isIn(['subscriber', 'publisher', 'both']).withMessage('client_type deve ser subscriber, publisher ou both'),
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
 * @route GET /api/publishers
 * @desc Listar todos os publishers
 */
router.get('/',
  ...paginationValidators,
  ...searchValidators,
  ...sortValidators,
  ...dateRangeValidators,
  query('client_type').optional().isIn(['subscriber', 'publisher', 'both']),
  query('active_only').optional().isBoolean(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        client_type, 
        active_only,
        sortBy = 'created_at',
        sortOrder = 'desc',
        createdFrom,
        createdTo
      } = req.query;
      
      const result = await getPublisherService().getAllPublishers({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        client_type: client_type as 'subscriber' | 'publisher' | 'both' | undefined,
        active_only: active_only === 'true',
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        createdFrom: createdFrom as string,
        createdTo: createdTo as string,
      });
      
      return res.json({ success: true, ...result });
    } catch (error: any) {
      await logError('Erro ao listar publishers', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, contact_name, email, phone, whatsapp, description, is_subscriber, is_publisher, client_type, contract_id } = req.body;
      
      const newPublisher = await getPublisherService().createPublisher({
        name,
        contact_name,
        email,
        phone,
        whatsapp,
        description,
        is_subscriber,
        is_publisher,
        client_type,
        contract_id, // Opcional - vincula publisher ao contrato (para rastreabilidade)
      });
      
      return res.status(201).json(newPublisher);
    } catch (error: any) {
      await logError('Erro ao criar publisher', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const publisherId = parseInt(req.params.id);
      const totemId = parseInt(req.params.totemId);
      const { date, time, dayOfWeek } = req.query;
      
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      
      // Validar acesso
      if (req.user.role !== 'admin' && req.user.publisherId !== publisherId) {
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
      });
      
    } catch (error: any) {
      await logError('Erro ao obter campanhas mixadas para totem', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter campanhas mixadas',
        message: error.message || 'Erro interno do servidor'
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      
      const publisherId = parseInt(req.params.id);
      const { totemId, date, time, dayOfWeek } = req.query;
      
      // Validar acesso: admin pode ver qualquer publisher, publisher só vê o seu
      if (req.user.role !== 'admin' && req.user.publisherId !== publisherId) {
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
      });
      
    } catch (error: any) {
      await logError('Erro ao obter campanhas mixadas', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter campanhas mixadas',
        message: error.message || 'Erro interno do servidor'
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const locals = await getPublisherService().getLocalsByPublisher(parseInt(id));
      return res.json({ success: true, data: locals });
    } catch (error: any) {
      await logError('Erro ao listar locals do publisher', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const totems = await getPublisherService().getTotemsByPublisher(parseInt(id));
      return res.json({ success: true, data: totems });
    } catch (error: any) {
      await logError('Erro ao listar totems do publisher', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const smartTvs = await getPublisherService().getSmartTvsByPublisher(parseInt(id));
      return res.json({ success: true, data: smartTvs });
    } catch (error: any) {
      await logError('Erro ao listar smart TVs do publisher', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const stats = await getPublisherService().getPublisherStats(parseInt(id));
      return res.json({ success: true, data: stats });
    } catch (error: any) {
      await logError('Erro ao obter estatísticas do publisher', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const publisher = await getPublisherService().getPublisherById(parseInt(id));
      
      if (!publisher) {
        return res.status(404).json({ error: 'Publisher não encontrado' });
      }

      return res.json({ success: true, data: publisher });
    } catch (error: any) {
      await logError('Erro ao obter publisher', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, contact_name, email, phone, whatsapp, description, is_subscriber, is_publisher, client_type, active } = req.body;
      
      const updatedPublisher = await getPublisherService().updatePublisher(parseInt(id), {
        name,
        contact_name,
        email,
        phone,
        whatsapp,
        description,
        is_subscriber,
        is_publisher,
        client_type,
        active
      });
      
      return res.json(updatedPublisher);
    } catch (error: any) {
      await logError('Erro ao atualizar publisher', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      await getPublisherService().deletePublisher(parseInt(id));
      
      return res.json({ success: true, message: 'Publisher deletado com sucesso' });
    } catch (error: any) {
      await logError('Erro ao deletar publisher', error);
      return res.status(400).json({ error: error.message || 'Erro interno do servidor' });
    }
  }
);

export default router;
