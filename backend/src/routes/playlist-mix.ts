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
  body('description').optional({ nullable: true }).isString(),
  body('totem_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('rule_type').isIn(['systematic', 'ai', 'hybrid']),
  body('priority_weight').optional({ nullable: true }).isFloat({ min: 0, max: 10 }),
  body('time_weight').optional({ nullable: true }).isFloat({ min: 0, max: 10 }),
  body('tag_weight').optional({ nullable: true }).isFloat({ min: 0, max: 10 }),
  body('subscriber_weight').optional({ nullable: true }).isFloat({ min: 0, max: 10 }),
  body('ai_enabled').optional({ nullable: true }).isBoolean(),
  body('ai_provider').optional({ nullable: true }).isString(),
  body('ai_model').optional({ nullable: true }).isString(),
  body('use_pedestrian_detection').optional({ nullable: true }).isBoolean(),
  body('use_sentiment_analysis').optional({ nullable: true }).isBoolean(),
  body('use_context_awareness').optional({ nullable: true }).isBoolean(),
  body('use_historical_optimization').optional({ nullable: true }).isBoolean(),
  body('max_items_per_playlist').optional({ nullable: true }).isInt({ min: 1, max: 1000 }),
  body('rotation_strategy').optional({ nullable: true }).isIn(['round_robin', 'priority', 'weighted', 'ai_optimized']),
  body('shuffle_enabled').optional({ nullable: true }).isBoolean(),
  body('is_default').optional({ nullable: true }).isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getDatabase();
      const mixService = getTotemPlaylistMixService();
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

      // Validar regra antes de criar
      const validation = await mixService.validateMixRule({
        name,
        rule_type,
        priority_weight,
        time_weight,
        tag_weight,
        subscriber_weight,
        ai_enabled,
        ai_provider,
        rotation_strategy,
        max_items_per_playlist,
        totem_id,
        use_pedestrian_detection,
        use_sentiment_analysis,
        use_context_awareness,
        use_historical_optimization,
      });

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Erro de validação',
          validationErrors: validation.errors,
          warnings: validation.warnings,
        });
      }

      // Retornar warnings se houver (mas permitir criação)
      if (validation.warnings.length > 0) {
        await logError('Avisos de validação na criação de regra', new Error(validation.warnings.join('; ')), {
          warnings: validation.warnings,
          ruleData: req.body,
        });
      }
      
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
        message: 'Regra de mixagem criada com sucesso',
        warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
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
  body('name').optional({ nullable: true }).isString().isLength({ min: 1, max: 255 }),
  body('description').optional({ nullable: true }).isString(),
  body('rule_type').optional({ nullable: true }).isIn(['systematic', 'ai', 'hybrid']),
  body('is_active').optional({ nullable: true }).isBoolean(),
  body('is_default').optional({ nullable: true }).isBoolean(),
  validateRequest,
  authorizeRole(['admin', 'manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ruleId = parseInt(req.params.id);
      const db = getDatabase();
      const mixService = getTotemPlaylistMixService();
      
      // Buscar regra existente para validação
      const existingRule = await db.findFirst(`
        SELECT * FROM playlist_mix_rules WHERE rule_id = $1
      `, [ruleId]);
      
      if (!existingRule) {
        return res.status(404).json({
          success: false,
          error: 'Regra não encontrada'
        });
      }

      // Validar dados atualizados (mesclar com dados existentes)
      const updatedRuleData = {
        ...existingRule,
        ...req.body,
      };

      const validation = await mixService.validateMixRule(updatedRuleData);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Erro de validação',
          validationErrors: validation.errors,
          warnings: validation.warnings,
        });
      }

      // Retornar warnings se houver (mas permitir atualização)
      if (validation.warnings.length > 0) {
        await logError('Avisos de validação na atualização de regra', new Error(validation.warnings.join('; ')), {
          warnings: validation.warnings,
          ruleId,
          ruleData: req.body,
        });
      }

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
        message: 'Regra atualizada com sucesso',
        warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
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
  body('pedestrian_count').optional({ nullable: true }).isInt({ min: 0 }),
  body('pedestrian_density').optional({ nullable: true }).isIn(['low', 'medium', 'high']),
  body('pedestrian_demographics').optional({ nullable: true }).isObject(),
  body('sentiment_score').optional({ nullable: true }).isFloat({ min: -1, max: 1 }),
  body('sentiment_label').optional({ nullable: true }).isIn(['positive', 'neutral', 'negative']),
  body('emotion_tags').optional({ nullable: true }).isArray(),
  body('time_of_day').optional({ nullable: true }).isString(),
  body('day_type').optional({ nullable: true }).isString(),
  body('weather_context').optional({ nullable: true }).isObject(),
  body('event_context').optional({ nullable: true }).isObject(),
  body('performance_metrics').optional({ nullable: true }).isObject(),
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
  body('pedestrian_count').optional({ nullable: true }).isInt({ min: 0 }),
  body('pedestrian_density').optional({ nullable: true }).isIn(['low', 'medium', 'high']),
  body('pedestrian_demographics').optional({ nullable: true }).isObject(),
  body('sentiment_score').optional({ nullable: true }).isFloat({ min: -1, max: 1 }),
  body('sentiment_label').optional({ nullable: true }).isIn(['positive', 'neutral', 'negative']),
  body('emotion_tags').optional({ nullable: true }).isArray(),
  body('time_of_day').optional({ nullable: true }).isString(),
  body('day_type').optional({ nullable: true }).isString(),
  body('weather_context').optional({ nullable: true }).isObject(),
  body('event_context').optional({ nullable: true }).isObject(),
  body('performance_metrics').optional({ nullable: true }).isObject(),
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

/**
 * @route GET /api/playlist-mix/overview
 * @desc Obter visão agregada de mixagem por publisher/local (mapa de slots por grupo)
 * @access Private
 */
router.get('/overview',
  query('publisherId').optional().isInt({ min: 1 }),
  query('localId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { publisherId, localId } = req.query;
      const db = getDatabase();

      const params: any[] = [];
      let whereClause = 'WHERE t.is_active = true';

      if (publisherId) {
        whereClause += ` AND p.publisher_id = $${params.length + 1}`;
        params.push(parseInt(publisherId as string, 10));
      }

      if (localId) {
        whereClause += ` AND l.local_id = $${params.length + 1}`;
        params.push(parseInt(localId as string, 10));
      }

      // Buscar todos os totems com seus publishers/locais e contagem de TVs
      const totems = await db.findMany(`
        SELECT
          t.totem_id,
          t.name as totem_name,
          t.identifier,
          l.local_id,
          l.name as local_name,
          p.publisher_id,
          p.name as publisher_name,
          COALESCE((
            SELECT COUNT(*) FROM smart_tvs st WHERE st.totem_id = t.totem_id
          ), 0) as tv_count
        FROM totems t
        INNER JOIN locals l ON t.local_id = l.local_id
        INNER JOIN publishers p ON l.publisher_id = p.publisher_id
        ${whereClause}
        ORDER BY p.name, l.name, t.name
      `, params);

      if (!totems || totems.length === 0) {
        return res.json({
          success: true,
          data: [],
        });
      }

      interface CampaignAgg {
        campaign_id: number;
        total_duration: number;
        total_items: number;
        subscriber_id?: number;
        subscriber_name?: string | null;
        commercial_tier?: string | null;
        share_percent?: number;
      }

      interface GroupAgg {
        publisher_id: number;
        publisher_name: string;
        local_id: number | null;
        local_name: string | null;
        total_totems: number;
        total_tvs: number;
        campaigns: CampaignAgg[];
        totems: Array<{
          totem_id: number;
          name: string | null;
          identifier: string;
          local_id: number | null;
          local_name: string | null;
          tv_count: number;
          mix_total_duration: number;
          mix_total_items: number;
        }>;
      }

      const groupsMap = new Map<string, GroupAgg>();

      // Para cada totem, buscar mix atual e agregar por grupo (publisher+local)
      for (const t of totems) {
        const mix = await db.findFirst(`
          SELECT 
            m.mix_id,
            m.mix_items,
            m.total_duration,
            m.total_items,
            m.generated_at,
            m.applied_at
          FROM totem_playlist_mix m
          WHERE m.totem_id = $1
            AND m.is_current = true
          ORDER BY m.generated_at DESC
          LIMIT 1
        `, [t.totem_id]);

        const groupKey = `${t.publisher_id || 0}:${t.local_id || 0}`;
        let group = groupsMap.get(groupKey);
        if (!group) {
          group = {
            publisher_id: t.publisher_id,
            publisher_name: t.publisher_name,
            local_id: t.local_id,
            local_name: t.local_name,
            total_totems: 0,
            total_tvs: 0,
            campaigns: [],
            totems: [],
          };
          groupsMap.set(groupKey, group);
        }

        group.total_totems += 1;
        group.total_tvs += Number(t.tv_count || 0);

        let mixItems: any[] = [];
        let mixTotalDuration = 0;
        let mixTotalItems = 0;

        if (mix && mix.mix_items) {
          if (Array.isArray(mix.mix_items)) {
            mixItems = mix.mix_items;
          } else {
            try {
              mixItems = JSON.parse(mix.mix_items);
            } catch {
              mixItems = [];
            }
          }
          mixTotalItems = mix.total_items || mixItems.length;
          mixTotalDuration = mix.total_duration || mixItems.reduce(
            (sum: number, it: any) => sum + (it.duration || 10),
            0
          );
        }

        group.totems.push({
          totem_id: t.totem_id,
          name: t.totem_name,
          identifier: t.identifier,
          local_id: t.local_id,
          local_name: t.local_name,
          tv_count: Number(t.tv_count || 0),
          mix_total_duration: mixTotalDuration,
          mix_total_items: mixTotalItems,
        });

        // Agregar campanhas por grupo
        for (const item of mixItems) {
          const campaignId = Number(item.campaign_id);
          if (!campaignId) continue;
          const duration = Number(item.duration || 10);

          let agg = group.campaigns.find((c) => c.campaign_id === campaignId);
          if (!agg) {
            agg = {
              campaign_id: campaignId,
              total_duration: 0,
              total_items: 0,
            };
            group.campaigns.push(agg);
          }
          agg.total_duration += duration;
          agg.total_items += 1;
        }
      }

      // Calcular share_percent por grupo
      for (const group of groupsMap.values()) {
        const totalDuration = group.campaigns.reduce(
          (sum, c) => sum + c.total_duration,
          0
        );
        const base = totalDuration || 1;
        for (const c of group.campaigns) {
          c.share_percent = (c.total_duration / base) * 100;
        }
        // Ordenar campanhas por share decrescente
        group.campaigns.sort((a, b) => (b.share_percent || 0) - (a.share_percent || 0));
      }

      return res.json({
        success: true,
        data: Array.from(groupsMap.values()),
      });
    } catch (error: any) {
      await logError('Erro ao obter overview de mixagem', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter overview de mixagem',
        message: error.message,
      });
    }
  }
);

/**
 * @route GET /api/playlist-mix/analytics
 * @desc Obter analytics de performance de mixagens
 * @access Private
 */
router.get('/analytics',
  query('totemId').optional().isInt({ min: 1 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('ruleId').optional().isInt({ min: 1 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { totemId, startDate, endDate, ruleId } = req.query;
      const db = getDatabase();
      
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (totemId) {
        whereClause += ` AND pmh.totem_id = $${paramIndex}`;
        params.push(parseInt(totemId as string));
        paramIndex++;
      }

      if (ruleId) {
        whereClause += ` AND pmh.rule_id = $${paramIndex}`;
        params.push(parseInt(ruleId as string));
        paramIndex++;
      }

      if (startDate) {
        whereClause += ` AND pmh.generated_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND pmh.generated_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Estatísticas gerais
      const stats = await db.findFirst(`
        SELECT 
          COUNT(*) as total_mixes,
          AVG(pmh.total_items) as avg_items,
          AVG(pmh.total_duration) as avg_duration,
          AVG(pmh.engagement_score) as avg_engagement,
          AVG(pmh.execution_count) as avg_executions,
          SUM(pmh.execution_count) as total_executions
        FROM playlist_mix_history pmh
        ${whereClause}
      `, params);

      // Performance por estratégia
      const byStrategy = await db.findMany(`
        SELECT 
          pmh.mix_strategy,
          COUNT(*) as count,
          AVG(pmh.engagement_score) as avg_engagement,
          AVG(pmh.execution_count) as avg_executions,
          AVG(pmh.total_items) as avg_items
        FROM playlist_mix_history pmh
        ${whereClause}
        GROUP BY pmh.mix_strategy
        ORDER BY avg_engagement DESC
      `, params);

      // Top mixagens por engajamento
      const topMixes = await db.findMany(`
        SELECT 
          pmh.history_id,
          pmh.totem_id,
          pmh.mix_strategy,
          pmh.engagement_score,
          pmh.execution_count,
          pmh.total_items,
          pmh.total_duration,
          pmh.generated_at,
          t.identifier as totem_identifier,
          t.name as totem_name
        FROM playlist_mix_history pmh
        LEFT JOIN totems t ON pmh.totem_id = t.totem_id
        ${whereClause}
        ORDER BY pmh.engagement_score DESC NULLS LAST
        LIMIT 10
      `, params);

      // Performance por totem
      const byTotem = await db.findMany(`
        SELECT 
          pmh.totem_id,
          t.identifier as totem_identifier,
          t.name as totem_name,
          COUNT(*) as mix_count,
          AVG(pmh.engagement_score) as avg_engagement,
          SUM(pmh.execution_count) as total_executions,
          AVG(pmh.total_items) as avg_items
        FROM playlist_mix_history pmh
        LEFT JOIN totems t ON pmh.totem_id = t.totem_id
        ${whereClause}
        GROUP BY pmh.totem_id, t.identifier, t.name
        ORDER BY avg_engagement DESC NULLS LAST
        LIMIT 20
      `, params);

      // Tendência temporal (últimos 30 dias)
      const trendData = await db.findMany(`
        SELECT 
          DATE(pmh.generated_at) as date,
          COUNT(*) as mix_count,
          AVG(pmh.engagement_score) as avg_engagement,
          SUM(pmh.execution_count) as total_executions
        FROM playlist_mix_history pmh
        ${whereClause}
          AND pmh.generated_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(pmh.generated_at)
        ORDER BY date DESC
      `, params);

      return res.json({
        success: true,
        data: {
          stats: {
            total_mixes: parseInt(stats?.total_mixes || '0'),
            avg_items: parseFloat(stats?.avg_items || '0'),
            avg_duration: parseFloat(stats?.avg_duration || '0'),
            avg_engagement: parseFloat(stats?.avg_engagement || '0'),
            avg_executions: parseFloat(stats?.avg_executions || '0'),
            total_executions: parseInt(stats?.total_executions || '0'),
          },
          byStrategy: byStrategy.map((s: any) => ({
            strategy: s.mix_strategy,
            count: parseInt(s.count),
            avg_engagement: parseFloat(s.avg_engagement || '0'),
            avg_executions: parseFloat(s.avg_executions || '0'),
            avg_items: parseFloat(s.avg_items || '0'),
          })),
          topMixes: topMixes.map((m: any) => ({
            history_id: m.history_id,
            totem_id: m.totem_id,
            totem_identifier: m.totem_identifier,
            totem_name: m.totem_name,
            mix_strategy: m.mix_strategy,
            engagement_score: m.engagement_score ? parseFloat(m.engagement_score) : null,
            execution_count: parseInt(m.execution_count || '0'),
            total_items: parseInt(m.total_items || '0'),
            total_duration: parseInt(m.total_duration || '0'),
            generated_at: m.generated_at,
          })),
          byTotem: byTotem.map((t: any) => ({
            totem_id: t.totem_id,
            totem_identifier: t.totem_identifier,
            totem_name: t.totem_name,
            mix_count: parseInt(t.mix_count),
            avg_engagement: parseFloat(t.avg_engagement || '0'),
            total_executions: parseInt(t.total_executions || '0'),
            avg_items: parseFloat(t.avg_items || '0'),
          })),
          trend: trendData.map((t: any) => ({
            date: t.date,
            mix_count: parseInt(t.mix_count),
            avg_engagement: parseFloat(t.avg_engagement || '0'),
            total_executions: parseInt(t.total_executions || '0'),
          })),
        },
      });
    } catch (error: any) {
      await logError('Erro ao obter analytics de mixagens', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter analytics de mixagens',
      });
    }
  }
);

export default router;

