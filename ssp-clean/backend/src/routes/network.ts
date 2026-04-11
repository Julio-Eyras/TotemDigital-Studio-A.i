/**
 * Network Routes - Smart Signage Pro v2.1
 * Rotas para rede visual entre totens
 */

import { Router, Response } from 'express';
import { getDatabase } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { AuthenticatedRequest, authorizeRole } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import { logError, logInfo } from '../utils/loggerHelper';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { normalizeDownloadUrl } from '../utils/pathHelper';

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

      return res.json(successResponse({ contentId, sourceInteraction: interaction }));
    } catch (error: any) {
      await logError('Erro ao buscar conteúdo relacionado', error);
      return res.status(500).json(errorResponse('Erro ao buscar conteúdo relacionado', error.message));
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
        return res.json(successResponse([]));
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

      return res.json(successResponse(nearbyTotems));
    } catch (error: any) {
      await logError('Erro ao buscar totens próximos', error);
      return res.status(500).json(errorResponse('Erro ao buscar totens próximos', error.message));
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

      return res.json(successResponse({ message: 'Interação registrada com sucesso' }));
    } catch (error: any) {
      await logError('Erro ao registrar interação', error);
      return res.status(500).json(errorResponse('Erro ao registrar interação', error.message));
    }
  }
);

/**
 * @route GET /api/network/topology
 * @desc Topologia da rede: publishers → locals → totems → smart_tvs com mídias atreladas
 * @access Private (Admin, Admin SQL, Operador Técnico)
 */
router.get('/topology',
  authMiddleware as any,
  authorizeRole(['admin', 'admin_sql', 'operador_tecnico', 'operator']),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getDatabase();

      const rows = await db.findMany(`
        SELECT 
          p.publisher_id,
          p.name AS publisher_name,
          l.local_id,
          l.name AS local_name,
          t.totem_id,
          t.identifier AS totem_identifier,
          t.name AS totem_name,
          t.status AS totem_status,
          t.last_heartbeat AS totem_last_heartbeat,
          st.smart_tv_id,
          st.identifier AS smart_tv_identifier,
          st.name AS smart_tv_name,
          st.status AS smart_tv_status,
          st.last_heartbeat AS smart_tv_last_heartbeat
        FROM publishers p
        LEFT JOIN locals l ON l.publisher_id = p.publisher_id AND COALESCE(l.is_active, true) = true
        LEFT JOIN totems t ON t.local_id = l.local_id AND COALESCE(t.is_active, true) = true
        LEFT JOIN smart_tvs st ON st.totem_id = t.totem_id AND COALESCE(st.is_active, true) = true
        WHERE p.is_publisher = true AND p.is_subscriber = false
          AND COALESCE(p.is_active, true) = true
        ORDER BY p.name NULLS LAST, l.name NULLS LAST, t.identifier NULLS LAST, st.identifier NULLS LAST
      `);

      const totemIds = [...new Set(rows.map((r: any) => r.totem_id).filter(Boolean))] as number[];
      const smartTvIds = [...new Set(rows.map((r: any) => r.smart_tv_id).filter(Boolean))] as number[];
      let mediaCountByTotem: Record<number, number> = {};
      let mediaCountBySmartTv: Record<number, number> = {};
      if (totemIds.length > 0) {
        try {
          const mediaRows = await db.findMany(`
            SELECT ct.totem_id, COUNT(DISTINCT cm.media_id)::int AS media_count
            FROM campaign_totems ct
            JOIN campaign_medias cm ON cm.campaign_id = ct.campaign_id AND COALESCE(cm.is_active, true) = true
            WHERE ct.totem_id = ANY($1) AND COALESCE(ct.is_active, true) = true
            GROUP BY ct.totem_id
          `, [totemIds]);
          mediaCountByTotem = Object.fromEntries(mediaRows.map((r: any) => [r.totem_id, r.media_count]));
        } catch (_) {
          mediaCountByTotem = {};
        }
      }
      if (smartTvIds.length > 0) {
        try {
          const tvMediaRows = await db.findMany(`
            SELECT tp.smart_tv_id, COUNT(DISTINCT tpi.media_id)::int AS media_count
            FROM totem_playlists tp
            JOIN totem_playlist_items tpi ON tpi.totem_playlist_id = tp.totem_playlist_id AND COALESCE(tpi.is_active, true) = true
            WHERE tp.smart_tv_id = ANY($1) AND COALESCE(tp.is_active, true) = true
            GROUP BY tp.smart_tv_id
          `, [smartTvIds]);
          mediaCountBySmartTv = Object.fromEntries(tvMediaRows.map((r: any) => [r.smart_tv_id, r.media_count]));
        } catch (_) {
          mediaCountBySmartTv = {};
        }
      }

      const topology: any[] = [];
      const seenPublishers = new Map<number, any>();
      const seenLocals = new Map<string, any>();
      const seenTotems = new Map<number, any>();

      for (const r of rows) {
        if (!r.publisher_id) continue;
        let pub = seenPublishers.get(r.publisher_id);
        if (!pub) {
          pub = {
            id: r.publisher_id,
            name: r.publisher_name,
            locals: [],
          };
          seenPublishers.set(r.publisher_id, pub);
          topology.push(pub);
        }

        if (r.local_id) {
          const localKey = `${r.publisher_id}-${r.local_id}`;
          let loc = seenLocals.get(localKey);
          if (!loc) {
            loc = {
              id: r.local_id,
              name: r.local_name,
              totems: [],
            };
            seenLocals.set(localKey, loc);
            pub.locals.push(loc);
          }

          if (r.totem_id) {
            let tot = seenTotems.get(r.totem_id);
            if (!tot) {
              tot = {
                id: r.totem_id,
                identifier: r.totem_identifier,
                name: r.totem_name,
                status: r.totem_status,
                lastHeartbeat: r.totem_last_heartbeat,
                mediaCount: mediaCountByTotem[r.totem_id] ?? 0,
                smartTvs: [],
              };
              seenTotems.set(r.totem_id, tot);
              loc.totems.push(tot);
            }

            if (r.smart_tv_id) {
              tot.smartTvs.push({
                id: r.smart_tv_id,
                identifier: r.smart_tv_identifier,
                name: r.smart_tv_name,
                status: r.smart_tv_status,
                lastHeartbeat: r.smart_tv_last_heartbeat,
                mediaCount: mediaCountBySmartTv[r.smart_tv_id] ?? 0,
              });
            }
          }
        }
      }

      return res.json(successResponse(topology, { totalPublishers: topology.length }));
    } catch (error: any) {
      await logError('Erro ao obter topologia da rede', error);
      return res.status(500).json(errorResponse('Erro ao obter topologia da rede', error.message));
    }
  }
);

/**
 * Mapeia days_of_week do BD (["monday","tuesday",...]) para números 0-6 (dom=0).
 */
function daysOfWeekToNumbers(daysJson: string | null): number[] | undefined {
  if (!daysJson) return undefined;
  try {
    const arr = JSON.parse(daysJson);
    if (!Array.isArray(arr)) return undefined;
    const map: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    return arr.map((d: string) => map[String(d).toLowerCase()]).filter((n: number) => n !== undefined);
  } catch {
    return undefined;
  }
}

/**
 * @route GET /api/network/graph
 * @desc Rede no formato SmartSignageNetwork para HoloGraph Engine (publishers, subscribers, scheduleAssignments).
 * @query dayOfWeek (0-6, opcional), time (HH:mm, opcional)
 * @access Private (Admin, Admin SQL, Operador Técnico)
 */
router.get('/graph',
  authMiddleware as any,
  authorizeRole(['admin', 'admin_sql', 'operador_tecnico', 'operator', 'manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    let db;
    try {
      db = getDatabase();
    } catch (dbErr: any) {
      await logError('Erro ao obter conexão DB no graph', dbErr);
      return res.status(500).json(errorResponse('Banco de dados não disponível', dbErr.message));
    }
    const dayOfWeek = req.query.dayOfWeek != null ? parseInt(String(req.query.dayOfWeek), 10) : undefined;
    const time = typeof req.query.time === 'string' ? req.query.time : undefined;
    const warnings: string[] = [];

    try {
      // 1) Publishers (topologia: publishers → locals → totems → smart_tvs), IDs como string
      let rows: any[] = [];
      try {
        rows = await db.findMany(`
          SELECT
            p.publisher_id, p.name AS publisher_name,
            l.local_id, l.name AS local_name, l.address AS local_address,
            t.totem_id, t.identifier AS totem_identifier, t.name AS totem_name,
            st.smart_tv_id, st.identifier AS smart_tv_identifier, st.name AS smart_tv_name
          FROM publishers p
          LEFT JOIN locals l ON l.publisher_id = p.publisher_id AND COALESCE(l.is_active, true) = true
          LEFT JOIN totems t ON t.local_id = l.local_id AND COALESCE(t.is_active, true) = true
          LEFT JOIN smart_tvs st ON st.totem_id = t.totem_id AND COALESCE(st.is_active, true) = true
          WHERE p.is_publisher = true AND p.is_subscriber = false AND COALESCE(p.is_active, true) = true
          ORDER BY p.name NULLS LAST, l.name NULLS LAST, t.identifier NULLS LAST, st.identifier NULLS LAST
        `);
      } catch (pubErr: any) {
        await logError('Erro ao carregar publishers no graph', pubErr);
        warnings.push(`publishers: ${pubErr.message}`);
      }

      const publishersMap = new Map<number, any>();
      const localsMap = new Map<string, any>();
      const totemsMap = new Map<number, any>();

      for (const r of rows) {
        if (!r.publisher_id) continue;
        let pub = publishersMap.get(r.publisher_id);
        if (!pub) {
          pub = { id: String(r.publisher_id), name: r.publisher_name || '', locations: [] };
          publishersMap.set(r.publisher_id, pub);
        }
        if (r.local_id) {
          const lk = `${r.publisher_id}-${r.local_id}`;
          if (!localsMap.has(lk)) {
            const loc = {
              id: String(r.local_id),
              publisherId: String(r.publisher_id),
              name: r.local_name || '',
              address: r.local_address || undefined,
              totems: []
            };
            localsMap.set(lk, loc);
            pub.locations.push(loc);
          }
          const loc = localsMap.get(lk);
          if (r.totem_id) {
            let tot = totemsMap.get(r.totem_id);
            if (!tot) {
              tot = { id: String(r.totem_id), locationId: String(r.local_id), name: r.totem_name || r.totem_identifier || '', smartTvs: [] };
              totemsMap.set(r.totem_id, tot);
              loc.totems.push(tot);
            }
            if (r.smart_tv_id) {
              tot.smartTvs.push({
                id: String(r.smart_tv_id),
                totemId: String(r.totem_id),
                name: r.smart_tv_name || r.smart_tv_identifier || ''
              });
            }
          }
        }
      }
      const publishers = Array.from(publishersMap.values());

      // 2) Subscribers com media, playlists, campaigns (IDs como string)
      let subscribers: any[] = [];
      try {
        const subRows = await db.findMany(`
          SELECT subscriber_id, name FROM subscribers WHERE COALESCE(is_active, true) = true
        `);
        for (const s of subRows) {
          try {
            const subId = s.subscriber_id;
            const medias = await db.findMany(`
              SELECT media_id AS id, subscriber_id AS subscriberId, name, media_type AS type, file_path AS url
              FROM medias WHERE subscriber_id = $1 AND COALESCE(is_active, true) = true
            `, [subId]);
            const playlists = await db.findMany(`
              SELECT p.playlist_id AS id, p.subscriber_id AS subscriberId, p.name
              FROM playlists p WHERE p.subscriber_id = $1 AND COALESCE(p.is_active, true) = true
            `, [subId]);
            for (const pl of playlists) {
              const items = await db.findMany(`SELECT media_id FROM playlist_items WHERE playlist_id = $1 AND COALESCE(is_active, true) = true`, [pl.id]);
              (pl as any).mediaIds = items.map((i: any) => String(i.media_id));
            }
            const campaigns = await db.findMany(`
              SELECT c.campaign_id AS id, c.subscriber_id AS subscriberId, c.title AS name
              FROM campaigns c WHERE c.subscriber_id = $1 AND COALESCE(c.is_active, true) = true
            `, [subId]);
            for (const c of campaigns) {
              const cpl = await db.findMany(`SELECT playlist_id FROM campaign_playlists WHERE campaign_id = $1 AND COALESCE(is_active, true) = true`, [c.id]);
              (c as any).playlistIds = cpl.map((x: any) => String(x.playlist_id));
            }
            subscribers.push({
              id: String(subId),
              name: s.name || '',
              media: medias.map((m: any) => ({ id: String(m.id), subscriberId: String(m.subscriberId), name: m.name, type: m.type, url: normalizeDownloadUrl(m.url) || m.url })),
              playlists: playlists.map((p: any) => ({ id: String(p.id), subscriberId: String(p.subscriberId), name: p.name, mediaIds: (p as any).mediaIds })),
              campaigns: campaigns.map((c: any) => ({ id: String(c.id), subscriberId: String(c.subscriberId), name: c.name, playlistIds: (c as any).playlistIds }))
            });
          } catch (subErr: any) {
            await logError('Erro ao processar subscriber no graph', subErr, { subscriberId: s.subscriber_id });
            warnings.push(`subscriber ${s.subscriber_id}: ${subErr.message}`);
          }
        }
      } catch (subErr: any) {
        await logError('Erro ao listar subscribers no graph', subErr);
        warnings.push(`subscribers: ${subErr.message}`);
      }

      // 3) Schedule assignments: campaign_totems, campaign_publishers, campaign_locals
      let scheduleAssignments: Array<{ id: string; sourceId: string; sourceType: 'campaign'; slots: Array<{ targetId: string; targetType: 'publisher' | 'location' | 'totem' | 'smarttv'; dayOfWeek?: number[]; startTime?: string; endTime?: string }> }> = [];
      try {
        let ctRows: Array<{ campaign_id: number; totem_id: number; start_time?: string; end_time?: string; days_of_week?: string | string[] }> = [];
        try {
          ctRows = await db.findMany(`
            SELECT ct.campaign_id, ct.totem_id, ct.start_time, ct.end_time, ct.days_of_week
            FROM campaign_totems ct
            JOIN campaigns c ON c.campaign_id = ct.campaign_id AND COALESCE(c.is_active, true) = true
            WHERE COALESCE(ct.is_active, true) = true
          `);
        } catch {
          ctRows = [];
        }
        let cpRows: Array<{ campaign_id: number; publisher_id: number }> = [];
        let clRows: Array<{ campaign_id: number; local_id: number }> = [];
        try {
          cpRows = await db.findMany(`SELECT campaign_id, publisher_id FROM campaign_publishers WHERE COALESCE(is_active, true) = true`);
        } catch {
          cpRows = [];
        }
        try {
          clRows = await db.findMany(`SELECT campaign_id, local_id FROM campaign_locals WHERE COALESCE(is_active, true) = true`);
        } catch {
          clRows = [];
        }

        const campaignIds = new Set<number>([
          ...ctRows.map((r: { campaign_id: number }) => r.campaign_id),
          ...cpRows.map((r: { campaign_id: number }) => r.campaign_id),
          ...clRows.map((r: { campaign_id: number }) => r.campaign_id)
        ]);
        for (const cid of campaignIds) {
          const totemSlots = ctRows
            .filter((r: { campaign_id: number }) => r.campaign_id === cid)
            .map((r: { totem_id: number; start_time?: string; end_time?: string; days_of_week?: string | string[] }) => ({
              targetId: String(r.totem_id),
              targetType: 'totem' as const,
              dayOfWeek: daysOfWeekToNumbers(r.days_of_week == null ? null : typeof r.days_of_week === 'string' ? r.days_of_week : JSON.stringify(r.days_of_week)),
              startTime: r.start_time || undefined,
              endTime: r.end_time || undefined
            }));
          const pubSlots = cpRows
            .filter((r: { campaign_id: number }) => r.campaign_id === cid)
            .map((r: { publisher_id: number }) => ({
              targetId: String(r.publisher_id),
              targetType: 'publisher' as const,
              dayOfWeek: undefined as number[] | undefined,
              startTime: undefined as string | undefined,
              endTime: undefined as string | undefined
            }));
          const locSlots = clRows
            .filter((r: { campaign_id: number }) => r.campaign_id === cid)
            .map((r: { local_id: number }) => ({
              targetId: String(r.local_id),
              targetType: 'location' as const,
              dayOfWeek: undefined as number[] | undefined,
              startTime: undefined as string | undefined,
              endTime: undefined as string | undefined
            }));
          const slots = [...totemSlots, ...pubSlots, ...locSlots];
          if (slots.length > 0) {
            scheduleAssignments.push({
              id: `campaign-${cid}`,
              sourceId: String(cid),
              sourceType: 'campaign',
              slots
            });
          }
        }
      } catch (schedErr: any) {
        await logError('Erro ao obter schedule assignments no graph', schedErr);
        warnings.push(`scheduleAssignments: ${schedErr.message}`);
      }

      const payload: Record<string, unknown> = {
        publishers,
        subscribers,
        scheduleAssignments,
        queryFilters: { dayOfWeek, time }
      };
      if (warnings.length > 0) {
        payload.warnings = warnings;
      }
      return res.json(successResponse(payload));
    } catch (error: any) {
      await logError('Erro ao obter grafo da rede', error);
      const msg = error?.message || String(error);
      const isDev = process.env.NODE_ENV !== 'production';
      return res.status(500).json(errorResponse(
        'Erro ao obter grafo da rede',
        msg,
        isDev ? { stack: error?.stack } : undefined
      ));
    }
  }
);

export default router;

