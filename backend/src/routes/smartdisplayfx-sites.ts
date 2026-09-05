/**
 * SmartDisplayFX Sites Routes
 * Rotas CRUD para gerenciamento de sites/rede estrela
 * @access Private (Admin, Admin SQL)
 */

import { Router } from 'express';
import express from 'express';

import { body, query, param, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { getFxSiteService } from '../services/fxSiteService';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction): express.Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

/**
 * @route GET /api/smartdisplayfx/sites
 * @desc Lista todos os sites com paginação e filtros
 * @access Private (Admin, Admin SQL)
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('client_id').optional().isInt({ min: 1 }),
  query('isActive').optional().isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const { page, limit, search, client_id, isActive } = req.query;
      
      const result = await getFxSiteService().getAllSites({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined,
        client_id: client_id ? parseInt(client_id as string) : undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });

      return res.json(result);} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/sites error', error, req.query);
      return res.status(500).json({
        error: 'Erro ao listar sites',
        message: e.message
    });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/sites/:siteId
 * @desc Busca um site por ID
 * @access Private (Admin, Admin SQL)
 */
router.get('/:siteId',
  param('siteId').isString().notEmpty(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const site = await getFxSiteService().getSiteById(req.params.siteId);

      if (!site) {
        return res.status(404).json({
          error: 'Site não encontrado'
        });
      }

      return res.json({
        data: site });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/sites/:siteId error', e.error, { siteId: req.params.siteId });
      return res.status(500).json({
        error: 'Erro ao buscar site',
        message: e.message
    });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/sites/:siteId/config
 * @desc Obtém configuração do site para o player (broker_url, etc.)
 * @access Private (Player autenticado ou Admin)
 * 
 * Retorna apenas informações necessárias para o player conectar ao broker MQTT
 */
router.get('/:siteId/config',
  param('siteId').isString().notEmpty(),
  validateRequest,
  // Permitir acesso para players autenticados (sem role específico) ou admins
  async (req: express.Request, res: express.Response) => {
    try {
      const site = await getFxSiteService().getSiteById(req.params.siteId);

      if (!site) {
        return res.status(404).json({
          error: 'Site não encontrado'
        });
      }

      if (!site.is_active) {
        return res.status(403).json({
          error: 'Site não está ativo'
        });
      }

      // Retornar apenas configuração necessária para o player
      const config = {
        site_id: site.site_id,
        broker_url: site.broker_url || null,
        broker_type: site.broker_type || 'mqtt',
        broker_config: site.broker_config || {},
        sync_interval_ms: site.sync_interval_ms || 2000,
        time_sync_enabled: site.time_sync_enabled !== undefined ? site.time_sync_enabled : true,
        // Extrair prefixo dos tópicos do broker_config se disponível
        mqtt_prefix: site.broker_config?.topics?.base || 
                    site.broker_config?.prefix || 
                    'smartdisplay'
      };

      return res.json({ 
        success: true,
        data: config 
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/sites/:siteId/config error', e.error, { siteId: req.params.siteId });
      return res.status(500).json({
        error: 'Erro ao obter configuração do site',
        message: e.message
    });
    }
  }
);

/**
 * @route GET /api/smartdisplayfx/sites/:siteId/totems
 * @desc Lista totens de um site
 * @access Private (Admin, Admin SQL)
 */
router.get('/:siteId/totems',
  param('siteId').isString().notEmpty(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const totems = await getFxSiteService().getTotemsForSite(req.params.siteId);
      return res.json({
        data: totems });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('GET /api/smartdisplayfx/sites/:siteId/totems error', e.error, { siteId: req.params.siteId });
      return res.status(500).json({
        error: 'Erro ao listar totens do site',
        message: e.message
    });
    }
  }
);

/**
 * @route POST /api/smartdisplayfx/sites
 * @desc Cria um novo site
 * @access Private (Admin, Admin SQL)
 */
router.post('/',
  body('site_id').isString().notEmpty(),
  body('name').isString().notEmpty(),
  body('description').optional({ nullable: true }).isString(),
  body('client_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('broker_url').optional({ nullable: true }).isString(),
  body('broker_type').optional({ nullable: true }).isString(),
  body('broker_config').optional({ nullable: true }).isObject(),
  body('sync_interval_ms').optional({ nullable: true }).isInt({ min: 100 }),
  body('time_sync_enabled').optional({ nullable: true }).isBoolean(),
  body('config').optional({ nullable: true }).isObject(),
  body('is_active').optional({ nullable: true }).isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const site = await getFxSiteService().createSite(req.body);
      return res.status(201).json({
        data: site });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('POST /api/smartdisplayfx/sites error', error, req.body);
      return res.status(500).json({
        error: 'Erro ao criar site',
        message: e.message
    });
    }
  }
);

/**
 * @route PUT /api/smartdisplayfx/sites/:siteId
 * @desc Atualiza um site
 * @access Private (Admin, Admin SQL)
 */
router.put('/:siteId',
  param('siteId').isString().notEmpty(),
  body('name').optional({ nullable: true }).isString().notEmpty(),
  body('description').optional({ nullable: true }).isString(),
  body('client_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('broker_url').optional({ nullable: true }).isString(),
  body('broker_type').optional({ nullable: true }).isString(),
  body('broker_config').optional({ nullable: true }).isObject(),
  body('sync_interval_ms').optional({ nullable: true }).isInt({ min: 100 }),
  body('time_sync_enabled').optional({ nullable: true }).isBoolean(),
  body('config').optional({ nullable: true }).isObject(),
  body('is_active').optional({ nullable: true }).isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const site = await getFxSiteService().updateSite(req.params.siteId, req.body);
      return res.json({
        data: site });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('PUT /api/smartdisplayfx/sites/:siteId error', e.error, { siteId: req.params.siteId, body: req.body });
      if (e.message.includes('não encontrado')) {
        return res.status(404).json({
          error: e.message
    });
      }
      return res.status(500).json({
        error: 'Erro ao atualizar site',
        message: e.message
      });
    }
  }
);

/**
 * @route DELETE /api/smartdisplayfx/sites/:siteId
 * @desc Deleta um site (soft delete)
 * @access Private (Admin, Admin SQL)
 */
router.delete('/:siteId',
  param('siteId').isString().notEmpty(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      await getFxSiteService().deleteSite(req.params.siteId);
      return res.json({
        message: 'Site deletado com sucesso' });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('DELETE /api/smartdisplayfx/sites/:siteId error', e.error, { siteId: req.params.siteId });
      if (e.message.includes('não encontrado')) {
        return res.status(404).json({
          error: e.message
    });
      }
      return res.status(500).json({
        error: 'Erro ao deletar site',
        message: e.message
      });
    }
  }
);

/**
 * @route POST /api/smartdisplayfx/sites/:siteId/totems
 * @desc Adiciona um totem a um site
 * @access Private (Admin, Admin SQL)
 */
router.post('/:siteId/totems',
  param('siteId').isString().notEmpty(),
  body('totem_id').isInt({ min: 1 }),
  body('role').optional({ nullable: true }).isString(),
  body('position_x').optional({ nullable: true }).isInt(),
  body('position_y').optional({ nullable: true }).isInt(),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      const { totem_id, role, position_x, position_y } = req.body;
      const totemSite = await getFxSiteService().addTotemToSite(
        req.params.siteId,
        totem_id,
        role || 'participant',
        position_x,
        position_y
      );
      return res.status(201).json({
        data: totemSite });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('POST /api/smartdisplayfx/sites/:siteId/totems error', e.error, { siteId: req.params.siteId, body: req.body });
      return res.status(500).json({
        error: 'Erro ao adicionar totem ao site',
        message: e.message
    });
    }
  }
);

/**
 * @route DELETE /api/smartdisplayfx/sites/:siteId/totems/:totemId
 * @desc Remove um totem de um site
 * @access Private (Admin, Admin SQL)
 */
router.delete('/:siteId/totems/:totemId',
  param('siteId').isString().notEmpty(),
  param('totemId').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: express.Request, res: express.Response) => {
    try {
      await getFxSiteService().removeTotemFromSite(req.params.siteId, parseInt(req.params.totemId));
      return res.json({
        message: 'Totem removido do site com sucesso' });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('DELETE /api/smartdisplayfx/sites/:siteId/totems/:totemId error', e.error, { 
        siteId: req.params.siteId, 
        totemId: req.params.totemId 
    });
      return res.status(500).json({
        error: 'Erro ao remover totem do site',
        message: e.message
      });
    }
  }
);

export default router;

