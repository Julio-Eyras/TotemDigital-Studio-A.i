/**
 * Settings Routes - Smart Signage v2.0
 * Rotas para configurações do sistema
 */

import { Router } from 'express';
import { SettingsService } from '../services/settingsService';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';

const router = Router();

// Lazy initialization - só criar quando necessário
function getSettingsService(): SettingsService {
  if (!(global as any).settingsServiceInstance) {
    (global as any).settingsServiceInstance = new SettingsService();
  }
  return (global as any).settingsServiceInstance;
}

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * @route GET /api/settings
 * @desc Busca todas as configurações
 * @access Private (Admin, Manager)
 */
router.get('/', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const settings = await getSettingsService().getSettings();

    res.json({
      success: true,
      data: settings
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar configurações:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/settings/public
 * @desc Busca configurações públicas
 * @access Private (Admin, Manager, Client)
 */
router.get('/public', async (req, res) => {
  try {
    const settings = await getSettingsService().getSettings();

    res.json({
      success: true,
      data: settings.publicSettings
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar configurações públicas:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/settings/:key
 * @desc Busca configuração específica
 * @access Private (Admin, Manager)
 */
router.get('/:key', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const { key } = req.params;

    const setting = await getSettingsService().getSetting(key);

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'Configuração não encontrada'
      });
    }

    res.json({
      success: true,
      data: setting
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar configuração:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/settings
 * @desc Atualiza configurações
 * @access Private (Admin apenas - configurações parametrizáveis do sistema)
 */
router.put('/', authorizeRole(['admin']), async (req, res) => {
  try {
    const settings = req.body;

    const validation = await getSettingsService().updateSettings(settings, req.user.id);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Erro de validação',
        data: validation
      });
    }

    // Se foram alteradas configurações de mídia, recarregar automaticamente
    const mediaSettingsChanged = Object.keys(settings).some(key => key.startsWith('media.'));
    if (mediaSettingsChanged) {
      try {
        const { reloadMediaConfig } = await import('../config/mediaConfig');
        await reloadMediaConfig();
        console.log('✅ Configurações de mídia recarregadas automaticamente após atualização');
      } catch (reloadError: any) {
        console.warn('⚠️ Erro ao recarregar configurações de mídia:', reloadError.message);
      }
    }

    res.json({
      success: true,
      message: 'Configurações atualizadas com sucesso',
      data: validation
    });

  } catch (error: any) {
    console.error('❌ Erro ao atualizar configurações:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao atualizar configurações',
      error: error.message
    });
  }
});

/**
 * @route POST /api/settings/:key/reset
 * @desc Reseta configuração para valor padrão
 * @access Private (Admin, Manager)
 */
router.post('/:key/reset', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const { key } = req.params;

    await getSettingsService().resetSetting(key, req.user.id);

    res.json({
      success: true,
      message: 'Configuração resetada para valor padrão'
    });

  } catch (error: any) {
    console.error('❌ Erro ao resetar configuração:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao resetar configuração',
      error: error.message
    });
  }
});

/**
 * @route POST /api/settings/reset-all
 * @desc Reseta todas as configurações para valores padrão
 * @access Private (Admin)
 */
router.post('/reset-all', authorizeRole(['admin']), async (req, res) => {
  try {
    await getSettingsService().resetAllSettings(req.user.id);

    res.json({
      success: true,
      message: 'Todas as configurações foram resetadas para valores padrão'
    });

  } catch (error: any) {
    console.error('❌ Erro ao resetar todas as configurações:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/settings
 * @desc Cria nova configuração
 * @access Private (Admin)
 */
router.post('/', authorizeRole(['admin']), async (req, res) => {
  try {
    const settingData = req.body;

    const setting = await getSettingsService().createSetting(settingData, req.user.id);

    res.status(201).json({
      success: true,
      message: 'Configuração criada com sucesso',
      data: setting
    });

  } catch (error: any) {
    console.error('❌ Erro ao criar configuração:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao criar configuração',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/settings/:key
 * @desc Remove configuração
 * @access Private (Admin)
 */
router.delete('/:key', authorizeRole(['admin']), async (req, res) => {
  try {
    const { key } = req.params;

    await getSettingsService().deleteSetting(key, req.user.id);

    res.json({
      success: true,
      message: 'Configuração removida com sucesso'
    });

  } catch (error: any) {
    console.error('❌ Erro ao remover configuração:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao remover configuração',
      error: error.message
    });
  }
});

/**
 * @route POST /api/settings/validate
 * @desc Valida configurações
 * @access Private (Admin, Manager)
 */
router.post('/validate', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const settings = req.body;

    const validation = await getSettingsService().validateSettings(settings);

    res.json({
      success: true,
      data: validation
    });

  } catch (error: any) {
    console.error('❌ Erro ao validar configurações:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/settings/export
 * @desc Exporta configurações
 * @access Private (Admin, Manager)
 */
router.get('/export', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const settings = await getSettingsService().exportSettings();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="settings-export.json"');
    res.json(settings);

  } catch (error: any) {
    console.error('❌ Erro ao exportar configurações:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/settings/import
 * @desc Importa configurações
 * @access Private (Admin)
 */
router.post('/import', authorizeRole(['admin']), async (req, res) => {
  try {
    const settings = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Dados de configuração inválidos'
      });
    }

    const validation = await getSettingsService().importSettings(settings, req.user.id);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Erro de validação na importação',
        data: validation
      });
    }

    res.json({
      success: true,
      message: 'Configurações importadas com sucesso',
      data: validation
    });

  } catch (error: any) {
    console.error('❌ Erro ao importar configurações:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao importar configurações',
      error: error.message
    });
  }
});

/**
 * @route GET /api/settings/categories
 * @desc Lista categorias de configurações
 * @access Private (Admin, Manager)
 */
router.get('/categories', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const settings = await getSettingsService().getSettings();

    const categories = settings.categories.map(category => ({
      name: category.name,
      displayName: category.displayName,
      description: category.description,
      icon: category.icon,
      settingsCount: category.settings.length
    }));

    res.json({
      success: true,
      data: categories
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar categorias:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/settings/category/:category
 * @desc Busca configurações de uma categoria específica
 * @access Private (Admin, Manager)
 */
router.get('/category/:category', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const { category } = req.params;

    const settings = await getSettingsService().getSettings();
    const categorySettings = settings.categories.find(cat => cat.name === category);

    if (!categorySettings) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    res.json({
      success: true,
      data: categorySettings
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar configurações da categoria:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/settings/category/:category
 * @desc Atualiza configurações de uma categoria específica
 * @access Private (Admin, Manager)
 */
router.put('/category/:category', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    const { category } = req.params;
    const settings = req.body;

    // Filtrar apenas configurações da categoria
    const categorySettings: { [key: string]: any } = {};
    const allSettings = await getSettingsService().getSettings();
    const categoryData = allSettings.categories.find(cat => cat.name === category);

    if (!categoryData) {
      return res.status(404).json({
        success: false,
        message: 'Categoria não encontrada'
      });
    }

    // Verificar se as configurações pertencem à categoria
    for (const [key, value] of Object.entries(settings)) {
      const setting = categoryData.settings.find(s => s.key === key);
      if (setting) {
        categorySettings[key] = value;
      }
    }

    const validation = await getSettingsService().updateSettings(categorySettings, req.user.id);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Erro de validação',
        data: validation
      });
    }

    res.json({
      success: true,
      message: `Configurações da categoria ${category} atualizadas com sucesso`,
      data: validation
    });

  } catch (error: any) {
    console.error('❌ Erro ao atualizar configurações da categoria:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao atualizar configurações da categoria',
      error: error.message
    });
  }
});

/**
 * @route POST /api/settings/media/apply
 * @desc Aplica configurações de mídia ao sistema
 * @access Private (Admin)
 */
router.post('/media/apply', authorizeRole(['admin']), async (req, res) => {
  try {
    const { applyChanges = true } = req.body;

    const { MediaConfigService } = await import('../services/mediaConfigService');
    const mediaConfigService = new MediaConfigService();

    // Aplicar configurações (Nginx + recarregar Express/Multer do banco)
    const result = await mediaConfigService.applyMediaConfig(applyChanges);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        data: result
      });
    }

    res.json({
      success: true,
      message: result.message,
      data: result
    });

  } catch (error: any) {
    console.error('❌ Erro ao aplicar configurações de mídia:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao aplicar configurações de mídia',
      error: error.message
    });
  }
});

export default router;
