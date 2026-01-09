/**
 * Campaign Routes - Smart Signage v2.1
 * Rotas para gerenciamento de campanhas
 * 
 * Logging: Usa arquivos locais para logs operacionais
 */

import { Router } from 'express';
import { CampaignService } from '../services/campaignService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { subscriberIsolationMiddleware } from '../middleware/subscriberIsolation.middleware';
import { logError, logInfo, logDebug, sanitizeForLogging } from '../utils/loggerHelper';
import { getEventLogService, EventType } from '../services/eventLogService';
import { getSubscriberService } from '../services/subscriberService';
import { 
  paginationValidators, 
  searchValidators, 
  sortValidators, 
  dateRangeValidators,
  idParamValidator
} from '../validators/common.validators';
import { 
  createCampaignValidators, 
  updateCampaignValidators, 
  campaignFilterValidators,
  reorderCampaignMediasValidators,
  reorderCampaignPlaylistsValidators
} from '../validators/campaign.validators';
import { validateRequest } from '../middleware/validation.middleware';

const router = Router();

// Aplicar bloqueio de dados de clientes para OPERATOR
router.use(blockClientDataAccess);

// Aplicar isolamento de dados por subscriber
router.use(subscriberIsolationMiddleware);

// Lazy initialization - só criar quando necessário
function getCampaignService(): CampaignService {
  if (!(global as any).campaignServiceInstance) {
    (global as any).campaignServiceInstance = new CampaignService();
  }
  return (global as any).campaignServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * @route GET /api/campaigns
 * @desc Lista campanhas com paginação e filtros
 * @access Private (Admin, Manager, Client)
 */
router.get('/',
  ...paginationValidators,
  ...searchValidators,
  ...sortValidators,
  ...dateRangeValidators,
  ...campaignFilterValidators,
  validateRequest,
  async (req: any, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      subscriberId,
      status,
      campaignType,
      isActive,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc',
      createdFrom,
      createdTo
    } = req.query;

    // Aplicar filtro de subscriber - garantir isolamento de dados
    // Se usuário é subscriber/client, só pode ver suas próprias campanhas
    let finalSubscriberId: number | undefined;
    if (req.user.role === 'client' || req.user.role === 'subscriber') {
      // Usar subscriberId do middleware de isolamento
      finalSubscriberId = req.subscriberId || req.user.subscriberId;
      if (!finalSubscriberId) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado',
          message: 'Subscriber ID não identificado'
        });
      }
    } else {
      // Admin pode ver todas ou filtrar por subscriberId fornecido
      finalSubscriberId = subscriberId ? parseInt(subscriberId as string) : undefined;
    }
    
    const filters: any = {
      subscriberId: finalSubscriberId,
      status: status as string,
      campaignType: campaignType as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      createdFrom: createdFrom as string,
      createdTo: createdTo as string,
    };

    const result = await getCampaignService().getCampaigns(
      parseInt(page as string),
      parseInt(limit as string),
      filters
    );

    // Converter estrutura { campaigns: [...] } para { data: [...] } para compatibilidade com frontend
    return res.json({
      success: true,
      data: {
        data: result.campaigns,
        total: result.total,
        page: result.page,
        limit: result.limit
      }
    });

  } catch (error: any) {
    await logError('Erro ao listar campanhas', error, { filters: req.query });
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/campaigns/stats
 * @desc Busca estatísticas gerais de campanhas
 * @access Private (Admin, Manager)
 */
router.get('/stats', authorizeRole(['admin', 'gerente_marketing', 'visualizador']), async (_req, res) => {
  try {
    const stats = await getCampaignService().getCampaignsStats();

    return res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    await logError('Erro ao buscar estatísticas', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/campaigns/client/:clientId
 * @desc Lista campanhas de um subscriber específico (antes cliente)
 * @access Private (Admin, Manager, Client)
 */
router.get('/client/:clientId', async (req: any, res) => {
  const { clientId } = req.params;
  try {
    const { limit = 50 } = req.query;

    // Verificar permissão (legado para role 'client')
    if (req.user.role === 'client' && req.user.subscriberId !== parseInt(clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver suas próprias campanhas'
      });
    }

    const campaigns = await getCampaignService().getCampaignsByClient(
      parseInt(clientId),
      parseInt(limit as string)
    );

    return res.json({
      success: true,
      data: campaigns
    });

  } catch (error: any) {
    await logError('Erro ao buscar campanhas do cliente', error, { clientId: parseInt(clientId) });
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/campaigns/totem/:totemId
 * @desc Lista campanhas ativas para um totem
 * @access Private (Admin, Manager, Client)
 */
router.get('/totem/:totemId', async (req: any, res) => {
  const { totemId } = req.params;
  try {
    const campaigns = await getCampaignService().getActiveCampaignsForTotem(parseInt(totemId));

    return res.json({
      success: true,
      data: campaigns
    });

  } catch (error: any) {
    await logError('Erro ao buscar campanhas do totem', error, { totemId: parseInt(totemId) });
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/campaigns/:id
 * @desc Busca campanha por ID
 * @access Private (Admin, Manager, Client)
 */
router.get('/:id',
  ...idParamValidator,
  validateRequest,
  async (req: any, res) => {
  const { id } = req.params;
  try {
    const campaign = await getCampaignService().getCampaignById(parseInt(id));

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.subscriberId !== campaign.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver suas próprias campanhas'
      });
    }

    return res.json({
      success: true,
      data: campaign
    });

  } catch (error: any) {
    await logError('Erro ao buscar campanha', error, { id: parseInt(id) });
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/campaigns
 * @desc Cria nova campanha
 * @access Private (Admin, Gerente Marketing)
 */
router.post('/', 
  authorizeRole(['admin', 'gerente_marketing']),
  ...createCampaignValidators,
  validateRequest,
  async (req: any, res) => {
  try {
    const campaignData = req.body;
    
    // Sanitizar dados antes de logar para evitar expor informações sensíveis
    const sanitizedData = sanitizeForLogging(campaignData);
    await logDebug('[Campaign] Dados recebidos', { campaignData: sanitizedData, user: { userId: req.user?.userId || req.user?.id, role: req.user?.role, clientId: req.user?.clientId } });

    // Validar campos obrigatórios
    if (!campaignData.title) {
      const validationError = new Error('Campo title é obrigatório');
      await logError('Erro de validação: title é obrigatório', validationError, { campaignData: sanitizedData });
      return res.status(400).json({
        success: false,
        message: 'Título é obrigatório',
        error: 'Campo title é obrigatório'
      });
    }

    // Mapear campos do frontend para o backend
    const mappedData: any = {
      // Mantemos clientId no payload, mas ele será gravado em subscriber_id no banco
      clientId: campaignData.clientId,
      title: campaignData.title,
      description: campaignData.description,
      campaignType: campaignData.campaign_type || campaignData.campaignType || 'general',
      status: campaignData.status || 'draft',
      startDate: campaignData.start_date || campaignData.startDate,
      endDate: campaignData.end_date || campaignData.endDate,
      isActive: campaignData.isActive !== undefined ? campaignData.isActive : true
    };

    // Se clientId (subscriber) não foi fornecido, usar o do usuário autenticado ou buscar primeiro subscriber ativo
    if (!mappedData.clientId) {
      if (req.user.role === 'client' && req.user.subscriberId) {
        mappedData.subscriberId = req.user.subscriberId;
      } else {
        // Para admin/manager, buscar primeiro subscriber ativo
        try {
          const db = require('../config/database').getDatabase();
          const firstSubscriber = await db.findFirst(`
            SELECT subscriber_id FROM subscribers WHERE is_active = true LIMIT 1
          `);
          if (firstSubscriber) {
            mappedData.clientId = firstSubscriber.subscriber_id;
            await logInfo('[Campaign] Usando primeiro subscriber ativo', { clientId: mappedData.clientId });
          } else {
            const validationError = new Error('Nenhum subscriber ativo encontrado no sistema');
            await logError('Erro: Nenhum subscriber ativo encontrado', validationError, {});
            return res.status(400).json({
              success: false,
              message: 'É necessário ter pelo menos um subscriber ativo para criar campanhas'
            });
          }
        } catch (dbError: any) {
          await logError('Erro ao buscar subscriber', dbError);
          return res.status(400).json({
            success: false,
            message: 'clientId (subscriber) é obrigatório'
          });
        }
      }
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.subscriberId !== mappedData.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode criar campanhas para seu próprio cliente'
      });
    }

    // Validar limites do plano antes de criar campanha
    if (mappedData.clientId) {
      try {
        const subscriberService = getSubscriberService();
        await subscriberService.validatePlanLimits(mappedData.clientId, 'campaign');
      } catch (limitError: any) {
        return res.status(400).json({
          success: false,
          error: 'Limite do plano excedido',
          message: limitError.message || 'Limite de campanhas do plano foi excedido'
        });
      }
    }

    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      await logError('Erro: userId não encontrado no token', new Error('userId ausente'), { user: req.user });
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado corretamente',
        error: 'userId ausente no token'
      });
    }

    const campaign = await getCampaignService().createCampaign(mappedData, userId);

    // Registrar evento de criação de campanha (se ativa)
    if (campaign.isActive && campaign.status === 'active') {
      try {
        const eventLogService = getEventLogService();
        // Buscar totems associados à campanha para registrar eventos
        const db = require('../config/database').getDatabase();
        const totems = await db.findMany(`
          SELECT totem_id FROM campaign_totems WHERE campaign_id = $1
        `, [campaign.id]);
        
        for (const totem of totems) {
          await eventLogService.logCampaignStart(
            campaign.id,
            totem.totem_id,
            { createdBy: userId, title: campaign.title }
          );
        }
      } catch (eventError: any) {
        // Não falhar a criação se o log de evento falhar
        await logError('Erro ao registrar evento de criação de campanha', eventError, { campaignId: campaign.id });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Campanha criada com sucesso',
      data: campaign
    });

  } catch (error: any) {
    // Sanitizar dados antes de logar (campaignData pode não estar definido se erro ocorrer antes)
    const sanitizedData = req.body ? sanitizeForLogging(req.body) : null;
    await logError('Erro ao criar campanha', error, { campaignData: sanitizedData });
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar campanha',
      error: error.message || 'Erro desconhecido'
    });
  }
});

/**
 * @route PUT /api/campaigns/:id
 * @desc Atualiza campanha
 * @access Private (Admin, Gerente Marketing)
 */
router.put('/:id', 
  authorizeRole(['admin', 'gerente_marketing']),
  ...idParamValidator,
  ...updateCampaignValidators,
  validateRequest,
  async (req: any, res) => {
  const { id } = req.params;
  try {
    const updateData = req.body;

    // Verificar se campanha existe e permissão
    const existingCampaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    // Verificar se usuário tem acesso ao cliente da campanha
    if (req.user.role !== 'admin_sql' && req.user.subscriberId !== existingCampaign.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode editar campanhas do seu cliente'
      });
    }

    const campaign = await getCampaignService().updateCampaign(
      parseInt(id),
      updateData,
      req.user.userId
    );

    return res.json({
      success: true,
      message: 'Campanha atualizada com sucesso',
      data: campaign
    });

  } catch (error: any) {
    // Usar req.body diretamente, pois updateData pode não estar definido se erro ocorrer antes
    await logError('Erro ao atualizar campanha', error, { 
      id, 
      updateData: req.body || null 
    });
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao atualizar campanha',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/campaigns/:id
 * @desc Remove campanha
 * @access Private (Admin, Manager)
 */
router.delete('/:id', 
  authorizeRole(['admin', 'gerente_marketing']),
  ...idParamValidator,
  validateRequest,
  async (req: any, res) => {
  const { id } = req.params;
  try {
    await getCampaignService().deleteCampaign(parseInt(id), req.user.userId);

    return res.json({
      success: true,
      message: 'Campanha removida com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao remover campanha', error, { id });
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao remover campanha',
      error: error.message
    });
  }
});

/**
 * @route POST /api/campaigns/:id/activate
 * @desc Ativa campanha
 * @access Private (Admin, Gerente Marketing)
 */
router.post('/:id/activate', 
  authorizeRole(['admin', 'gerente_marketing']),
  async (req: any, res) => {
  const { id } = req.params;
  try {
    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.subscriberId !== campaign.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ativar suas próprias campanhas'
      });
    }

    await getCampaignService().activateCampaign(parseInt(id), req.user.userId);

    // Registrar evento de início de campanha para todos os totems associados
    try {
      const eventLogService = getEventLogService();
      const db = require('../config/database').getDatabase();
      const totems = await db.findMany(`
        SELECT totem_id FROM campaign_totems WHERE campaign_id = $1
      `, [parseInt(id)]);
      
      for (const totem of totems) {
        await eventLogService.logCampaignStart(
          parseInt(id),
          totem.totem_id,
          { activatedBy: req.user.userId, title: campaign.title }
        );
      }
      
      await logInfo('[Campaign] Eventos de início registrados', { campaignId: id, totemCount: totems.length });
    } catch (eventError: any) {
      await logError('Erro ao registrar eventos de início de campanha', eventError, { campaignId: id });
    }

    return res.json({
      success: true,
      message: 'Campanha ativada com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao ativar campanha', error, { id });
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao ativar campanha',
      error: error.message
    });
  }
});

/**
 * @route POST /api/campaigns/:id/pause
 * @desc Pausa campanha
 * @access Private (Admin, Gerente Marketing)
 */
router.post('/:id/pause', 
  authorizeRole(['admin', 'gerente_marketing']),
  async (req: any, res) => {
  const { id } = req.params;
  try {
    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.subscriberId !== campaign.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode pausar suas próprias campanhas'
      });
    }

    await getCampaignService().pauseCampaign(parseInt(id), req.user.userId);

    // Registrar evento de pausa de campanha
    try {
      const eventLogService = getEventLogService();
      const db = require('../config/database').getDatabase();
      const totems = await db.findMany(`
        SELECT totem_id FROM campaign_totems WHERE campaign_id = $1
      `, [parseInt(id)]);
      
      for (const totem of totems) {
        await eventLogService.logEvent({
          eventType: EventType.CAMPAIGN_PAUSE,
          entityType: 'campaign',
          entityId: parseInt(id),
          campaignId: parseInt(id),
          totemId: totem.totem_id,
          metadata: { pausedBy: req.user.userId, title: campaign.title }
        });
      }
    } catch (eventError: any) {
      await logError('Erro ao registrar eventos de pausa de campanha', eventError, { campaignId: id });
    }

    return res.json({
      success: true,
      message: 'Campanha pausada com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao pausar campanha', error, { id });
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao pausar campanha',
      error: error.message
    });
  }
});

/**
 * @route POST /api/campaigns/:id/finish
 * @desc Finaliza campanha
 * @access Private (Admin, Gerente Marketing)
 */
router.post('/:id/finish', 
  authorizeRole(['admin', 'gerente_marketing']),
  async (req: any, res) => {
  const { id } = req.params;
  try {
    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.subscriberId !== campaign.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode finalizar suas próprias campanhas'
      });
    }

    await getCampaignService().finishCampaign(parseInt(id), req.user.userId);

    // Registrar evento de fim de campanha para todos os totems associados
    try {
      const eventLogService = getEventLogService();
      const db = require('../config/database').getDatabase();
      const totems = await db.findMany(`
        SELECT totem_id FROM campaign_totems WHERE campaign_id = $1
      `, [parseInt(id)]);
      
      for (const totem of totems) {
        await eventLogService.logCampaignEnd(
          parseInt(id),
          totem.totem_id,
          { finishedBy: req.user.userId, title: campaign.title }
        );
      }
      
      await logInfo('[Campaign] Eventos de fim registrados', { campaignId: id, totemCount: totems.length });
    } catch (eventError: any) {
      await logError('Erro ao registrar eventos de fim de campanha', eventError, { campaignId: id });
    }

    return res.json({
      success: true,
      message: 'Campanha finalizada com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao finalizar campanha', error, { id });
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao finalizar campanha',
      error: error.message
    });
  }
});

/**
 * @route POST /api/campaigns/:id/totems
 * @desc Adiciona totem à campanha
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/totems', async (req: any, res) => {
  const { id } = req.params;
  const totemData = req.body;
  try {

    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.subscriberId !== campaign.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode gerenciar totems de suas próprias campanhas'
      });
    }

    await getCampaignService().addTotemToCampaign(parseInt(id), totemData, req.user.userId);

    // Se a campanha estiver ativa, registrar evento de início para o totem
    if (campaign.status === 'active' && campaign.isActive) {
      try {
        const eventLogService = getEventLogService();
        const totemId = totemData.totemId || totemData.totem_id;
        if (totemId) {
          await eventLogService.logCampaignStart(
            parseInt(id),
            totemId,
            { addedBy: req.user.userId, title: campaign.title }
          );
        }
      } catch (eventError: any) {
        await logError('Erro ao registrar evento de início de campanha para totem', eventError, {
          campaignId: id,
          totemId: totemData.totemId || totemData.totem_id
        });
      }
    }

    return res.json({
      success: true,
      message: 'Totem adicionado à campanha com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao adicionar totem à campanha', error, { id, totemData });
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao adicionar totem à campanha',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/campaigns/:id/totems/:totemId
 * @desc Remove totem da campanha
 * @access Private (Admin, Manager, Client)
 */
router.delete('/:id/totems/:totemId', async (req: any, res) => {
  const { id, totemId } = req.params;
  try {

    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.subscriberId !== campaign.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode gerenciar totems de suas próprias campanhas'
      });
    }

    await getCampaignService().removeTotemFromCampaign(
      parseInt(id),
      parseInt(totemId),
      req.user.userId
    );

    // Registrar evento de fim de campanha para o totem removido (se campanha estava ativa)
    if (campaign.status === 'active' && campaign.isActive) {
      try {
        const eventLogService = getEventLogService();
        await eventLogService.logCampaignEnd(
          parseInt(id),
          parseInt(totemId),
          { removedBy: req.user.userId, title: campaign.title, reason: 'totem_removed' }
        );
      } catch (eventError: any) {
        await logError('Erro ao registrar evento de fim de campanha para totem removido', eventError, {
          campaignId: id,
          totemId
        });
      }
    }

    return res.json({
      success: true,
      message: 'Totem removido da campanha com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao remover totem da campanha', error, { id, totemId });
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao remover totem da campanha',
      error: error.message
    });
  }
});

/**
 * @route GET /api/campaigns/:id/totems
 * @desc Lista totems da campanha
 * @access Private (Admin, Manager, Client)
 */
router.get('/:id/totems', async (req: any, res) => {
  const { id } = req.params;
  try {

    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.subscriberId !== campaign.subscriberId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver totems de suas próprias campanhas'
      });
    }

    // Buscar totems da campanha
    const totems = await getCampaignService().getCampaignTotems(parseInt(id));

    return res.json({
      success: true,
      data: totems
    });

  } catch (error: any) {
    await logError('Erro ao buscar totems da campanha', error, { id });
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/campaigns/:id/medias/reorder
 * @desc Reordena mídias em uma campanha
 * @access Private (Admin, Gerente Marketing)
 */
router.put('/:id/medias/reorder',
  authorizeRole(['admin', 'gerente_marketing']),
  ...idParamValidator,
  ...reorderCampaignMediasValidators,
  validateRequest,
  async (req: any, res) => {
  try {
    const { id } = req.params;
    const { mediaIds } = req.body;
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }

    await getCampaignService().reorderCampaignMedias(
      parseInt(id),
      mediaIds,
      userId
    );

    return res.json({
      success: true,
      message: 'Mídias reordenadas com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao reordenar mídias da campanha', error, { 
      id: req.params.id,
      mediaIds: req.body.mediaIds 
    });
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao reordenar mídias',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/campaigns/:id/playlists/reorder
 * @desc Reordena playlists em uma campanha
 * @access Private (Admin, Gerente Marketing)
 */
router.put('/:id/playlists/reorder',
  authorizeRole(['admin', 'gerente_marketing']),
  ...idParamValidator,
  ...reorderCampaignPlaylistsValidators,
  validateRequest,
  async (req: any, res) => {
  try {
    const { id } = req.params;
    const { playlistIds } = req.body;
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }

    await getCampaignService().reorderCampaignPlaylists(
      parseInt(id),
      playlistIds,
      userId
    );

    return res.json({
      success: true,
      message: 'Playlists reordenadas com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao reordenar playlists da campanha', error, { 
      id: req.params.id,
      playlistIds: req.body.playlistIds 
    });
    return res.status(400).json({
      success: false,
      message: error.message || 'Erro ao reordenar playlists',
      error: error.message
    });
  }
});

export default router;
