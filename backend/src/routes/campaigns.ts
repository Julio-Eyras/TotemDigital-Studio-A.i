/**
 * Campaign Routes - Smart Signage v2.1
 * Rotas para gerenciamento de campanhas
 * 
 * Logging: Usa arquivos locais para logs operacionais
 */

import { Router } from 'express';
import { CampaignService } from '../services/campaignService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { logError, logInfo } from '../utils/loggerHelper';
import { getEventLogService, EventType } from '../services/eventLogService';

const router = Router();

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
router.get('/', async (req: any, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      clientId,
      status,
      campaignType,
      isActive,
      search
    } = req.query;

    // Aplicar filtro de cliente se for Client
    const filters: any = {
      clientId: req.user.role === 'client' ? req.user.clientId : (clientId ? parseInt(clientId as string) : undefined),
      status: status as string,
      campaignType: campaignType as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search: search as string
    };

    const result = await getCampaignService().getCampaigns(
      parseInt(page as string),
      parseInt(limit as string),
      filters
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    await logError('Erro ao listar campanhas', error, { filters: req.query });
    res.status(500).json({
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
router.get('/stats', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const stats = await getCampaignService().getCampaignsStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    await logError('Erro ao buscar estatísticas', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/campaigns/client/:clientId
 * @desc Lista campanhas de um cliente específico
 * @access Private (Admin, Manager, Client)
 */
router.get('/client/:clientId', async (req: any, res) => {
  try {
    const { clientId } = req.params;
    const { limit = 50 } = req.query;

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== parseInt(clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver suas próprias campanhas'
      });
    }

    const campaigns = await getCampaignService().getCampaignsByClient(
      parseInt(clientId),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: campaigns
    });

  } catch (error: any) {
    await logError('Erro ao buscar campanhas do cliente', error, { clientId });
    res.status(500).json({
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
  try {
    const { totemId } = req.params;

    const campaigns = await getCampaignService().getActiveCampaignsForTotem(parseInt(totemId));

    res.json({
      success: true,
      data: campaigns
    });

  } catch (error: any) {
    await logError('Erro ao buscar campanhas do totem', error, { totemId });
    res.status(500).json({
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
router.get('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;

    const campaign = await getCampaignService().getCampaignById(parseInt(id));

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== campaign.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver suas próprias campanhas'
      });
    }

    res.json({
      success: true,
      data: campaign
    });

  } catch (error: any) {
    await logError('Erro ao buscar campanha', error, { id });
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/campaigns
 * @desc Cria nova campanha
 * @access Private (Admin, Manager, Client)
 */
router.post('/', async (req: any, res) => {
  try {
    const campaignData = req.body;
    
    const { logDebug, logError, logInfo } = await import('../utils/loggerHelper');
    await logDebug('[Campaign] Dados recebidos', { campaignData, user: { userId: req.user?.userId || req.user?.id, role: req.user?.role, clientId: req.user?.clientId } });

    // Validar campos obrigatórios
    if (!campaignData.title) {
      await logError('Erro de validação: title é obrigatório', undefined, { campaignData });
      return res.status(400).json({
        success: false,
        message: 'Título é obrigatório',
        error: 'Campo title é obrigatório'
      });
    }

    // Mapear campos do frontend para o backend
    const mappedData: any = {
      clientId: campaignData.clientId,
      title: campaignData.title,
      description: campaignData.description,
      campaignType: campaignData.campaign_type || campaignData.campaignType || 'general',
      status: campaignData.status || 'draft',
      startDate: campaignData.start_date || campaignData.startDate,
      endDate: campaignData.end_date || campaignData.endDate,
      isActive: campaignData.isActive !== undefined ? campaignData.isActive : true
    };

    // Se clientId não foi fornecido, usar o do usuário autenticado ou buscar primeiro cliente ativo
    if (!mappedData.clientId) {
      if (req.user.role === 'client' && req.user.clientId) {
        mappedData.clientId = req.user.clientId;
      } else {
        // Para admin/manager, buscar primeiro cliente ativo
        try {
          const db = require('../config/database').getDatabase();
          const firstClient = await db.findFirst(`
            SELECT client_id FROM clients WHERE is_active = true LIMIT 1
          `);
          if (firstClient) {
            mappedData.clientId = firstClient.client_id;
            await logInfo('[Campaign] Usando primeiro cliente ativo', { clientId: mappedData.clientId });
          } else {
            await logError('Erro: Nenhum cliente ativo encontrado', undefined, {});
            return res.status(400).json({
              success: false,
              message: 'É necessário ter pelo menos um cliente ativo para criar campanhas'
            });
          }
        } catch (dbError: any) {
          await logError('Erro ao buscar cliente', dbError);
          return res.status(400).json({
            success: false,
            message: 'clientId é obrigatório'
          });
        }
      }
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== mappedData.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode criar campanhas para seu próprio cliente'
      });
    }

    const campaign = await getCampaignService().createCampaign(mappedData, req.user.userId);

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
            { createdBy: req.user.userId, title: campaign.title }
          );
        }
      } catch (eventError: any) {
        // Não falhar a criação se o log de evento falhar
        await logError('Erro ao registrar evento de criação de campanha', eventError, { campaignId: campaign.id });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Campanha criada com sucesso',
      data: campaign
    });

  } catch (error: any) {
    const { logError } = await import('../utils/loggerHelper');
    await logError('Erro ao criar campanha', error, { campaignData });
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar campanha',
      error: error.message || 'Erro desconhecido'
    });
  }
});

/**
 * @route PUT /api/campaigns/:id
 * @desc Atualiza campanha
 * @access Private (Admin, Manager, Client)
 */
router.put('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Verificar se campanha existe e permissão
    const existingCampaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== existingCampaign.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode editar suas próprias campanhas'
      });
    }

    const campaign = await getCampaignService().updateCampaign(
      parseInt(id),
      updateData,
      req.user.userId
    );

    res.json({
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
    res.status(400).json({
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
router.delete('/:id', authorizeRole(['admin', 'manager']), async (req: any, res) => {
  try {
    const { id } = req.params;

    await getCampaignService().deleteCampaign(parseInt(id), req.user.userId);

    res.json({
      success: true,
      message: 'Campanha removida com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao remover campanha', error, { id });
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao remover campanha',
      error: error.message
    });
  }
});

/**
 * @route POST /api/campaigns/:id/activate
 * @desc Ativa campanha
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/activate', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== campaign.clientId) {
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
      `, [id]);
      
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

    res.json({
      success: true,
      message: 'Campanha ativada com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao ativar campanha', error, { id });
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao ativar campanha',
      error: error.message
    });
  }
});

/**
 * @route POST /api/campaigns/:id/pause
 * @desc Pausa campanha
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/pause', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== campaign.clientId) {
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
      `, [id]);
      
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

    res.json({
      success: true,
      message: 'Campanha pausada com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao pausar campanha', error, { id });
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao pausar campanha',
      error: error.message
    });
  }
});

/**
 * @route POST /api/campaigns/:id/finish
 * @desc Finaliza campanha
 * @access Private (Admin, Manager, Client)
 */
router.post('/:id/finish', async (req: any, res) => {
  try {
    const { id } = req.params;

    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== campaign.clientId) {
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
      `, [id]);
      
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

    res.json({
      success: true,
      message: 'Campanha finalizada com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao finalizar campanha', error, { id });
    res.status(400).json({
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
  try {
    const { id } = req.params;
    const totemData = req.body;

    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== campaign.clientId) {
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

    res.json({
      success: true,
      message: 'Totem adicionado à campanha com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao adicionar totem à campanha', error, { id, totemData });
    res.status(400).json({
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
  try {
    const { id, totemId } = req.params;

    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== campaign.clientId) {
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

    res.json({
      success: true,
      message: 'Totem removido da campanha com sucesso'
    });

  } catch (error: any) {
    await logError('Erro ao remover totem da campanha', error, { id, totemId });
    res.status(400).json({
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
  try {
    const { id } = req.params;

    // Verificar se campanha existe e permissão
    const campaign = await getCampaignService().getCampaignById(parseInt(id));
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    if (req.user.role === 'client' && req.user.clientId !== campaign.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode ver totems de suas próprias campanhas'
      });
    }

    // Buscar totems da campanha
    const totems = await getCampaignService().getCampaignTotems(parseInt(id));

    res.json({
      success: true,
      data: totems
    });

  } catch (error: any) {
    await logError('Erro ao buscar totems da campanha', error, { id });
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

export default router;
