/**
 * Network Routes - Smart Signage Pro v2.1
 * Rotas para rede visual entre totens
 */

import { Router, Response } from 'express';
import { getDatabase } from '../config/database';
import { AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import { logError, logInfo } from '../utils/loggerHelper';

const router = Router();

/**
 * @route POST /api/network/related-content
 * @desc Busca conteúdo relacionado baseado em interação de outro totem
 * @access Public (para players)
 */
router.post('/related-content',
  body('interaction').notEmpty().withMessage('interaction é obrigatório'),
  body('totemId').notEmpty().withMessage('totemId é obrigatório'),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { interaction } = req.body;
      const db = getDatabase();

      // Buscar conteúdo relacionado baseado no tipo de interação
      let contentId: number | null = null;

      if (interaction.type === 'facial_recognition' && interaction.metadata?.personId) {
        // Se pessoa foi reconhecida, buscar conteúdo personalizado
        const person = await db.findFirst(`
          SELECT content_id FROM recognized_persons
          WHERE person_id = $1 AND is_active = true
        `, [interaction.metadata.personId]);

        if (person && person.content_id) {
          contentId = person.content_id;
        }
      } else if (interaction.type === 'tag_id' && interaction.metadata?.tagId) {
        // Se tag foi lida, buscar conteúdo da tag
        const tag = await db.findFirst(`
          SELECT content_id FROM tags
          WHERE tag_id = $1 AND is_active = true
        `, [interaction.metadata.tagId]);

        if (tag && tag.content_id) {
          contentId = tag.content_id;
        }
      }

      // Se não encontrou conteúdo específico, buscar conteúdo padrão de rede
      if (!contentId) {
        const defaultContent = await db.findFirst(`
          SELECT media_id FROM medias
          WHERE media_type = 'interactive'
          ORDER BY created_at DESC
          LIMIT 1
        `);

        if (defaultContent) {
          contentId = defaultContent.media_id;
        }
      }

      return res.json({
        success: true,
        data: {
          contentId: contentId,
          sourceInteraction: interaction
        }
      });
    } catch (error: any) {
      await logError('Erro ao buscar conteúdo relacionado', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar conteúdo relacionado'
      });
    }
  }
);

/**
 * @route GET /api/network/nearby-totems/:totemId
 * @desc Lista totens próximos
 * @access Private (Admin, Manager)
 */
router.get('/nearby-totems/:totemId',
  param('totemId').isInt({ min: 1 }),
  query('radius').optional().isInt({ min: 1 }),
  validateRequest,
  authorizeRole(['admin', 'admin_sql']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const totemId = parseInt(req.params.totemId);
      // const radius = parseInt(req.query.radius as string) || 50; // TODO: usar quando necessário
      const db = getDatabase();

      // Buscar totens na mesma rede
      const network = await db.findFirst(`
        SELECT network_id, nearby_totems
        FROM totem_network
        WHERE totem_id = $1 AND is_active = true
      `, [totemId]);

      if (!network) {
        return res.json({
          success: true,
          data: []
        });
      }

      // Buscar informações dos totens próximos
      const nearbyTotems = await db.findMany(`
        SELECT 
          t.totem_id,
          t.identifier,
          t.name,
          t.location,
          t.status,
          t.last_heartbeat
        FROM totems t
        WHERE t.totem_id = ANY($1)
        ORDER BY t.name
      `, [network.nearby_totems || []]);

      return res.json({
        success: true,
        data: nearbyTotems
      });
    } catch (error: any) {
      await logError('Erro ao buscar totens próximos', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar totens próximos'
      });
    }
  }
);

/**
 * @route POST /api/network/interactions
 * @desc Registra interação na rede
 * @access Public (para players)
 */
router.post('/interactions',
  body('totemId').isInt({ min: 1 }),
  body('interactionType').isIn(['facial_recognition', 'tag_id', 'touch', 'gesture']),
  body('interactionData').optional(),
  body('contentId').optional().isInt({ min: 1 }),
  body('personId').optional().isString(),
  body('tagId').optional().isString(),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { totemId, interactionType, interactionData, contentId, personId, tagId } = req.body;
      const db = getDatabase();

      await db.executeRaw(`
        INSERT INTO interaction_logs (
          totem_id, interaction_type, interaction_data, content_id, person_id, tag_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        totemId,
        interactionType,
        interactionData ? JSON.stringify(interactionData) : null,
        contentId || null,
        personId || null,
        tagId || null
      ]);

      await logInfo('Interação registrada', { totemId, interactionType });

      return res.json({
        success: true,
        message: 'Interação registrada com sucesso'
      });
    } catch (error: any) {
      await logError('Erro ao registrar interação', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao registrar interação'
      });
    }
  }
);

export default router;

