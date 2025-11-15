/**
 * Campaign Routes - Smart Signage v2.0
 * Rotas para gerenciamento de campanhas
 */

import { Router } from 'express';
import { CampaignService } from '../services/campaignService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';

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
    console.error('❌ Erro ao listar campanhas:', error.message);
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
    console.error('❌ Erro ao buscar estatísticas:', error.message);
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
    console.error('❌ Erro ao buscar campanhas do cliente:', error.message);
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
    console.error('❌ Erro ao buscar campanhas do totem:', error.message);
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
    console.error('❌ Erro ao buscar campanha:', error.message);
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

    // Se clientId não foi fornecido, usar o do usuário autenticado
    if (!campaignData.clientId) {
      if (req.user.role === 'client' && req.user.clientId) {
        campaignData.clientId = req.user.clientId;
      } else {
        return res.status(400).json({
          success: false,
          message: 'clientId é obrigatório'
        });
      }
    }

    // Verificar permissão
    if (req.user.role === 'client' && req.user.clientId !== campaignData.clientId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: Você só pode criar campanhas para seu próprio cliente'
      });
    }

    const campaign = await getCampaignService().createCampaign(campaignData, req.user.userId);

    res.status(201).json({
      success: true,
      message: 'Campanha criada com sucesso',
      data: campaign
    });

  } catch (error: any) {
    console.error('❌ Erro ao criar campanha:', error.message || error);
    console.error('❌ Stack trace:', error.stack);
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
    console.error('❌ Erro ao atualizar campanha:', error.message);
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
    console.error('❌ Erro ao remover campanha:', error.message);
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

    res.json({
      success: true,
      message: 'Campanha ativada com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao ativar campanha:', error.message);
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

    res.json({
      success: true,
      message: 'Campanha pausada com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao pausar campanha:', error.message);
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

    res.json({
      success: true,
      message: 'Campanha finalizada com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao finalizar campanha:', error.message);
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

    res.json({
      success: true,
      message: 'Totem adicionado à campanha com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao adicionar totem à campanha:', error.message);
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

    res.json({
      success: true,
      message: 'Totem removido da campanha com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao remover totem da campanha:', error.message);
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
    console.error('❌ Erro ao buscar totems da campanha:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

export default router;
