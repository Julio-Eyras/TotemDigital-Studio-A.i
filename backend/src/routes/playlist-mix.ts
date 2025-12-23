/**
 * Routes para gerenciamento de mixagem de playlists
 */

import { Router, Response } from 'express';
import { getTotemPlaylistMixService } from '../services/totemPlaylistMixService';
import { authMiddleware, AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import { logError } from '../utils/loggerHelper';
import { getDatabase } from '../config/database';

const router = Router();

// Middleware de autenticação
router.use(authMiddleware);

/**
 * @route GET /api/playlist-mix/rules
 * @desc Listar regras de mixagem
 * @access Private
 */
router.get('/rules',
  query('totemId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { totemId } = req.query;
      const db = getDatabase();
      
      let query = `
        SELECT 
          rule_id,
          totem_id,
          name,
          description,
          rule_type,
          priority_weight,
          time_weight,
          tag_weight,
          subscriber_weight,
          ai_enabled,
          ai_provider,
          ai_model,
          use_pedestrian_detection,
          use_sentiment_analysis,
          use_context_awareness,
          use_historical_optimization,
          max_items_per_playlist,
          rotation_strategy,
          shuffle_enabled,
          is_active,
          is_default,
          created_at,
          updated_at
        FROM playlist_mix_rules
        WHERE 1=1
      `;
      
      const params: any[] = [];
      
      if (totemId) {
        query += ` AND (totem_id = $${params.length + 1} OR totem_id IS NULL)`;
        params.push(parseInt(totemId as string));
      }
      
      query += ` ORDER BY is_default DESC, totem_id NULLS LAST, created_at DESC`;
      
      const rules = await db.findMany(query, params);
      
      return res.json({
        success: true,
        data: rules
      });
    } catch (error: any) {
      await logError('Erro ao listar regras de mixagem', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar regras de mixagem'
      });
    }
  }
);

/**
 * @route GET /api/playlist-mix/rules/:id
 * @desc Obter regra de mixagem por ID
 * @access Private
 */
router.get('/rules/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ruleId = parseInt(req.params.id);
      const db = getDatabase();
      
      const rule = await db.findFirst(`
        SELECT * FROM playlist_mix_rules WHERE rule_id = $1
      `, [ruleId]);
      
      if (!rule) {
        return res.status(404).json({
          success: false,
          error: 'Regra não encontrada'
        });
      }
      
      return res.json({
        success: true,
        data: rule
      });
    } catch (error: any) {
      await logError('Erro ao obter regra de mixagem', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter regra de mixagem'
      });
    }
  }
);

/**
 * @route POST /api/playlist-mix/rules
 * @desc Criar nova regra de mixagem
 * @access Private (Admin, Manager)
 */
router.post('/rules',
  body('name').isString().isLength({ min: 1, max: 255 }),
  body('description').optional().isString(),
  body('totem_id').optional().isInt({ min: 1 }),
  body('rule_type').isIn(['systematic', 'ai', 'hybrid']),
  body('priority_weight').optional().isFloat({ min: 0, max: 10 }),
  body('time_weight').optional().isFloat({ min: 0, max: 10 }),
  body('tag_weight').optional().isFloat({ min: 0, max: 10 }),
  body('subscriber_weight').optional().isFloat({ min: 0, max: 10 }),
  body('ai_enabled').optional().isBoolean(),
  body('ai_provider').optional().isString(),
  body('ai_model').optional().isString(),
  body('use_pedestrian_detection').optional().isBoolean(),
  body('use_sentiment_analysis').optional().isBoolean(),
  body('use_context_awareness').optional().isBoolean(),
  body('use_historical_optimization').optional().isBoolean(),
  body('max_items_per_playlist').optional().isInt({ min: 1, max: 1000 }),
  body('rotation_strategy').optional().isIn(['round_robin', 'priority', 'weighted', 'ai_optimized']),
  body('shuffle_enabled').optional().isBoolean(),
  body('is_default').optional().isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getDatabase();
      const {
        name,
        description,
        totem_id,
        rule_type,
        priority_weight = 1.0,
        time_weight = 1.0,
        tag_weight = 0.5,
        subscriber_weight = 0.5,
        ai_enabled = false,
        ai_provider,
        ai_model,
        ai_config,
        use_pedestrian_detection = false,
        use_sentiment_analysis = false,
        use_context_awareness = false,
        use_historical_optimization = false,
        max_items_per_playlist = 50,
        rotation_strategy = 'priority',
        shuffle_enabled = false,
        is_default = false
      } = req.body;
      
      const result = await db.executeRaw(`
        INSERT INTO playlist_mix_rules (
          totem_id, name, description, rule_type,
          priority_weight, time_weight, tag_weight, subscriber_weight,
          ai_enabled, ai_provider, ai_model, ai_config,
          use_pedestrian_detection, use_sentiment_analysis,
          use_context_awareness, use_historical_optimization,
          max_items_per_playlist, rotation_strategy, shuffle_enabled,
          is_default, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, true)
        RETURNING rule_id
      `, [
        totem_id || null,
        name,
        description || null,
        rule_type,
        priority_weight,
        time_weight,
        tag_weight,
        subscriber_weight,
        ai_enabled,
        ai_provider || null,
        ai_model || null,
        ai_config ? JSON.stringify(ai_config) : null,
        use_pedestrian_detection,
        use_sentiment_analysis,
        use_context_awareness,
        use_historical_optimization,
        max_items_per_playlist,
        rotation_strategy,
        shuffle_enabled,
        is_default
      ]);
      
      const ruleId = result.rows[0].rule_id;
      
      const rule = await db.findFirst(`
        SELECT * FROM playlist_mix_rules WHERE rule_id = $1
      `, [ruleId]);
      
      return res.status(201).json({
        success: true,
        data: rule,
        message: 'Regra de mixagem criada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao criar regra de mixagem', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar regra de mixagem',
        message: error.message
      });
    }
  }
);

/**
 * @route PUT /api/playlist-mix/rules/:id
 * @desc Atualizar regra de mixagem
 * @access Private (Admin, Manager)
 */
router.put('/rules/:id',
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().isLength({ min: 1, max: 255 }),
  body('description').optional().isString(),
  body('rule_type').optional().isIn(['systematic', 'ai', 'hybrid']),
  body('is_active').optional().isBoolean(),
  body('is_default').optional().isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ruleId = parseInt(req.params.id);
      const db = getDatabase();
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      
      const allowedFields = [
        'name', 'description', 'rule_type', 'priority_weight', 'time_weight',
        'tag_weight', 'subscriber_weight', 'ai_enabled', 'ai_provider',
        'ai_model', 'ai_config', 'use_pedestrian_detection',
        'use_sentiment_analysis', 'use_context_awareness',
        'use_historical_optimization', 'max_items_per_playlist',
        'rotation_strategy', 'shuffle_enabled', 'is_active', 'is_default'
      ];
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (field === 'ai_config' && typeof req.body[field] === 'object') {
            updates.push(`${field} = $${paramIndex}`);
            params.push(JSON.stringify(req.body[field]));
          } else {
            updates.push(`${field} = $${paramIndex}`);
            params.push(req.body[field]);
          }
          paramIndex++;
        }
      }
      
      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum campo para atualizar'
        });
      }
      
      params.push(ruleId);
      
      await db.executeRaw(`
        UPDATE playlist_mix_rules
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE rule_id = $${paramIndex}
      `, params);
      
      const rule = await db.findFirst(`
        SELECT * FROM playlist_mix_rules WHERE rule_id = $1
      `, [ruleId]);
      
      if (!rule) {
        return res.status(404).json({
          success: false,
          error: 'Regra não encontrada'
        });
      }
      
      return res.json({
        success: true,
        data: rule,
        message: 'Regra atualizada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao atualizar regra de mixagem', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar regra de mixagem',
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/playlist-mix/context/:totemId
 * @desc Obter contexto de IA para um totem
 * @access Private
 */
router.get('/context/:totemId',
  param('totemId').isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.totemId);
      const mixService = getTotemPlaylistMixService();
      const context = await mixService.getAIContextForTotem(totemId);
      
      return res.json({
        success: true,
        data: context
      });
    } catch (error: any) {
      await logError('Erro ao obter contexto de IA', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter contexto de IA'
      });
    }
  }
);

/**
 * @route POST /api/playlist-mix/context/:totemId
 * @desc Atualizar contexto de IA para um totem
 * @access Private (Admin, Manager, Publisher)
 */
router.post('/context/:totemId',
  param('totemId').isInt({ min: 1 }),
  body('pedestrian_count').optional().isInt({ min: 0 }),
  body('pedestrian_density').optional().isIn(['low', 'medium', 'high']),
  body('pedestrian_demographics').optional().isObject(),
  body('sentiment_score').optional().isFloat({ min: -1, max: 1 }),
  body('sentiment_label').optional().isIn(['positive', 'neutral', 'negative']),
  body('emotion_tags').optional().isArray(),
  body('time_of_day').optional().isString(),
  body('day_type').optional().isString(),
  body('weather_context').optional().isObject(),
  body('event_context').optional().isObject(),
  body('performance_metrics').optional().isObject(),
  validateRequest,
  authorizeRole(['admin', 'manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.totemId);
      const mixService = getTotemPlaylistMixService();
      
      const contextData = {
        pedestrian_count: req.body.pedestrian_count,
        pedestrian_density: req.body.pedestrian_density,
        pedestrian_demographics: req.body.pedestrian_demographics,
        sentiment_score: req.body.sentiment_score,
        sentiment_label: req.body.sentiment_label,
        emotion_tags: req.body.emotion_tags,
        time_of_day: req.body.time_of_day,
        day_type: req.body.day_type,
        weather_context: req.body.weather_context,
        event_context: req.body.event_context,
        performance_metrics: req.body.performance_metrics,
      };
      
      const updated = await mixService.updateAIContext(totemId, contextData);
      
      return res.json({
        success: true,
        data: updated,
        message: 'Contexto de IA atualizado com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao atualizar contexto de IA', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar contexto de IA',
        message: error.message
      });
    }
  }
);

/**
 * @route PUT /api/playlist-mix/context/:totemId
 * @desc Atualizar contexto de IA para um totem (alias para POST)
 * @access Private (Admin, Manager, Publisher)
 */
router.put('/context/:totemId',
  param('totemId').isInt({ min: 1 }),
  body('pedestrian_count').optional().isInt({ min: 0 }),
  body('pedestrian_density').optional().isIn(['low', 'medium', 'high']),
  body('pedestrian_demographics').optional().isObject(),
  body('sentiment_score').optional().isFloat({ min: -1, max: 1 }),
  body('sentiment_label').optional().isIn(['positive', 'neutral', 'negative']),
  body('emotion_tags').optional().isArray(),
  body('time_of_day').optional().isString(),
  body('day_type').optional().isString(),
  body('weather_context').optional().isObject(),
  body('event_context').optional().isObject(),
  body('performance_metrics').optional().isObject(),
  validateRequest,
  authorizeRole(['admin', 'manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    // Reutilizar a mesma lógica do POST - fazer requisição POST internamente
    return (async () => {
      try {
        const totemId = parseInt(req.params.totemId);
        const mixService = getTotemPlaylistMixService();
        
        const contextData = {
          pedestrian_count: req.body.pedestrian_count,
          pedestrian_density: req.body.pedestrian_density,
          pedestrian_demographics: req.body.pedestrian_demographics,
          sentiment_score: req.body.sentiment_score,
          sentiment_label: req.body.sentiment_label,
          emotion_tags: req.body.emotion_tags,
          time_of_day: req.body.time_of_day,
          day_type: req.body.day_type,
          weather_context: req.body.weather_context,
          event_context: req.body.event_context,
          performance_metrics: req.body.performance_metrics,
        };
        
        const updated = await mixService.updateAIContext(totemId, contextData);
        
        return res.json({
          success: true,
          data: updated,
          message: 'Contexto de IA atualizado com sucesso'
        });
      } catch (error: any) {
        await logError('Erro ao atualizar contexto de IA', error);
        return res.status(500).json({
          success: false,
          error: 'Erro ao atualizar contexto de IA',
          message: error.message
        });
      }
    })();
  }
);

/**
 * @route DELETE /api/playlist-mix/rules/:id
 * @desc Deletar regra de mixagem
 * @access Private (Admin, Manager)
 */
router.delete('/rules/:id',
  param('id').isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ruleId = parseInt(req.params.id);
      const db = getDatabase();
      
      // Verificar se regra existe
      const rule = await db.findFirst(`
        SELECT rule_id, is_default FROM playlist_mix_rules WHERE rule_id = $1
      `, [ruleId]);
      
      if (!rule) {
        return res.status(404).json({
          success: false,
          error: 'Regra não encontrada'
        });
      }
      
      // Não permitir deletar regra padrão global
      if (rule.is_default) {
        return res.status(400).json({
          success: false,
          error: 'Não é possível deletar a regra padrão. Desative-a ou crie outra regra padrão primeiro.'
        });
      }
      
      // Deletar regra
      await db.executeRaw(`
        DELETE FROM playlist_mix_rules WHERE rule_id = $1
      `, [ruleId]);
      
      return res.json({
        success: true,
        message: 'Regra deletada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao deletar regra de mixagem', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao deletar regra de mixagem',
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/playlist-mix/history
 * @desc Obter histórico de mixagens
 * @access Private
 */
router.get('/history',
  query('totemId').optional().isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { totemId, page = 1, limit = 20, startDate, endDate } = req.query;
      const db = getDatabase();
      
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (totemId) {
        whereClause += ` AND totem_id = $${paramIndex}`;
        params.push(parseInt(totemId as string));
        paramIndex++;
      }
      
      if (startDate) {
        whereClause += ` AND generated_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }
      
      if (endDate) {
        whereClause += ` AND generated_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }
      
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      params.push(parseInt(limit as string));
      params.push(offset);
      
      const history = await db.findMany(`
        SELECT 
          history_id,
          totem_id,
          mix_id,
          rule_id,
          mix_strategy,
          total_items,
          total_duration,
          execution_count,
          average_view_time,
          engagement_score,
          context_snapshot,
          generated_at,
          applied_at,
          last_executed_at,
          created_at
        FROM playlist_mix_history
        ${whereClause}
        ORDER BY generated_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, params);
      
      const totalResult = await db.findFirst(`
        SELECT COUNT(*) as total FROM playlist_mix_history ${whereClause}
      `, params.slice(0, params.length - 2));
      
      return res.json({
        success: true,
        data: history,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: parseInt(totalResult?.total || '0')
        }
      });
    } catch (error: any) {
      await logError('Erro ao obter histórico de mixagens', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter histórico de mixagens'
      });
    }
  }
);

export default router;

