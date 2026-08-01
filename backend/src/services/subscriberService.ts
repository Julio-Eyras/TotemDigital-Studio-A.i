import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { getCacheService } from './cacheService';
import { StorageService } from './storageService';
import { SettingsService } from './settingsService';
import { LIMITS_DEFAULT_SETTING_KEYS } from '../constants/limitsSettingsKeys';
import {
  mergeNumericPlanLimit,
  normalizeLimitInt,
  resolveLimitWithDefault,
} from '../utils/subscriberLimitsPolicy';
import {
  assertPortalSlugAvailable,
  maybeSyncPortalHostsAfterSlugChange,
} from './portalHostService';

/** Campanha considerada activa para totais comerciais (alinhado a getSubscriberStats / dispatcher). */
const ACTIVE_CAMPAIGN_SQL = `
  c.is_active = true
  AND c.status IN ('active', 'approved')
  AND (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
  AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
`;

export interface Subscriber {
  subscriber_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  category_segment?: string;
  description?: string;
  portal_slug?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  active_contracts_count?: number;
  media_count?: number;
  playlist_count?: number;
  campaign_count?: number;
  /** Mídias ligadas directamente a campanhas activas. */
  campaign_direct_media_count?: number;
  /** Playlists activas ligadas a campanhas activas. */
  campaign_playlist_count?: number;
  /** Mídias activas nessas playlists de campanha. */
  campaign_playlist_media_count?: number;
  /** Mídias activas distintas em campanhas activas (directas ∪ playlists). */
  campaign_total_media_count?: number;
  /** Itens de mídia activos em playlists activas do assinante. */
  playlist_media_count?: number;
  orphan_media_count?: number;
  publisher_count?: number;
  cities_count?: number;
  totems_count?: number;
  online_totems_count?: number;
  last_media_upload_at?: string | null;
  last_campaign_activity_at?: string | null;
  plan_limit_medias?: number;
  plan_limit_playlists?: number;
  plan_limit_campaigns?: number;
  storage_used_gb?: number;
  storage_limit_gb?: number;
  /** Semáforo na listagem: contratos vencidos / a vencer (30 dias). */
  contract_alert_level?: 'error' | 'warning' | 'success' | 'neutral';
  contract_alert_label?: string;
  days_until_contract_end?: number | null;
  financial_alert_level?: 'error' | 'warning' | 'success' | 'neutral';
  financial_alert_label?: string;
  has_billing_overdue?: boolean;
  has_billing_due_soon?: boolean;
  /** Inadimplência além da tolerância — publicação/campanhas bloqueadas. */
  has_billing_publish_blocked?: boolean;
}

export interface CreateSubscriberRequest {
  name: string;
  contract_id?: number; // Opcional - pode ser usado para vincular um pré-contrato (created_before_subscriber=true)
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  category_segment?: string;
  description?: string;
  portal_slug?: string | null;
}

export interface UpdateSubscriberRequest {
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  category_segment?: string;
  description?: string;
  portal_slug?: string | null;
  isActive?: boolean;
}

export interface SubscriberListResponse {
  data: Subscriber[];
  total: number;
  page: number;
  limit: number;
}

export class SubscriberService {
  private get db() {
    return getDatabase();
  }

  private get cache() {
    return getCacheService();
  }

  /**
   * Listar subscribers (anunciantes) com paginação e filtros
   */
  async getAllSubscribers(params: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    createdFrom?: string;
    createdTo?: string;
  }): Promise<SubscriberListResponse> {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search,
        is_active,
        sortBy = 'created_at',
        sortOrder = 'desc',
        createdFrom,
        createdTo
      } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Filtro de status ativo/inativo
      if (is_active !== undefined) {
        whereClause += ` AND s.is_active = $${paramIndex}`;
        queryParams.push(is_active);
        paramIndex++;
      }

      // Busca em múltiplos campos
      if (search) {
        whereClause += ` AND (
          s.name ILIKE $${paramIndex} OR 
          s.email ILIKE $${paramIndex} OR 
          s.contact_name ILIKE $${paramIndex} OR 
          s.phone ILIKE $${paramIndex} OR
          s.whatsapp ILIKE $${paramIndex}
        )`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Filtro de data de criação
      if (createdFrom) {
        whereClause += ` AND s.created_at >= $${paramIndex}`;
        queryParams.push(createdFrom);
        paramIndex++;
      }
      if (createdTo) {
        whereClause += ` AND s.created_at <= $${paramIndex}`;
        queryParams.push(createdTo);
        paramIndex++;
      }

      // Validação de campo de ordenação
      const validSortFields: { [key: string]: string } = {
        'name': 's.name',
        'email': 's.email',
        'created_at': 's.created_at',
        'updated_at': 's.updated_at'
      };
      const sortField = validSortFields[sortBy] || 's.created_at';
      const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Buscar subscribers
      const subscribers = await this.db.findMany(`
        SELECT 
          s.subscriber_id,
          s.name,
          s.contact_name,
          s.email,
          s.phone,
          s.whatsapp,
          s.address,
          s.category_segment,
          s.description,
          s.portal_slug,
          s.is_active,
          s.created_at,
          s.updated_at
        FROM subscribers s
        ${whereClause}
        ORDER BY ${sortField} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      if (subscribers.length > 0) {
        const subscriberIds = subscribers.map((subscriber: Subscriber) => subscriber.subscriber_id);
        const metricsRows = await this.db.findMany(`
          WITH ids AS (
            SELECT unnest($1::int[]) AS subscriber_id
          ),
          active_contracts AS (
            SELECT
              sc.subscriber_id,
              COUNT(*)::int AS active_contracts_count
            FROM subscriber_contracts sc
            JOIN ids ON ids.subscriber_id = sc.subscriber_id
            WHERE sc.status = 'active'
              AND sc.start_date <= CURRENT_DATE
              AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
            GROUP BY sc.subscriber_id
          ),
          contract_alert AS (
            SELECT
              sc.subscriber_id,
              -- Só conta situação crítica em contratos "relevantes": ativo fora da vigência,
              -- ou estados explícitos expired/terminated. NÃO incluir cancelled/draft/rascunhos
              -- antigos (ex.: seed demo com Gold cancelado) — senão o anunciante fica sempre vermelho.
              BOOL_OR(
                sc.status IN ('expired', 'terminated')
                OR (
                  sc.status = 'active'
                  AND sc.end_date IS NOT NULL
                  AND sc.end_date < CURRENT_DATE
                )
              ) AS has_expired,
              BOOL_OR(
                sc.status = 'active'
                AND sc.end_date IS NOT NULL
                AND sc.end_date >= CURRENT_DATE
                AND sc.end_date <= CURRENT_DATE + (30 * INTERVAL '1 day')
              ) AS has_expiring_soon,
              MIN(
                CASE
                  WHEN sc.status = 'active'
                    AND sc.end_date IS NOT NULL
                    AND sc.end_date >= CURRENT_DATE
                  THEN (sc.end_date - CURRENT_DATE)::int
                  ELSE NULL
                END
              ) AS days_until_contract_end
            FROM subscriber_contracts sc
            JOIN ids ON ids.subscriber_id = sc.subscriber_id
            GROUP BY sc.subscriber_id
          ),
          billing_alert AS (
            SELECT
              sb.subscriber_id,
              BOOL_OR(
                sb.payment_status IN ('pending', 'overdue')
                AND sb.due_date IS NOT NULL
                AND sb.due_date < CURRENT_DATE
              ) AS has_billing_overdue,
              BOOL_OR(
                sb.payment_status = 'pending'
                AND sb.due_date IS NOT NULL
                AND sb.due_date >= CURRENT_DATE
                AND sb.due_date <= CURRENT_DATE + (30 * INTERVAL '1 day')
              ) AS has_billing_due_soon,
              BOOL_OR(
                COALESCE(
                  (SELECT LOWER(TRIM(setting_value)) FROM system_settings
                   WHERE setting_key = 'financial.block_publish_on_overdue' LIMIT 1),
                  'true'
                ) IN ('true', '1')
                AND sb.payment_status IN ('pending', 'overdue')
                AND sb.due_date IS NOT NULL
                AND sb.due_date::date < CURRENT_DATE
                AND GREATEST(0, (CURRENT_DATE - sb.due_date::date)) >= COALESCE(
                  (SELECT NULLIF(TRIM(setting_value), '')::int FROM system_settings
                   WHERE setting_key = 'financial.block_publish_overdue_grace_days' LIMIT 1),
                  0
                )
              ) AS has_billing_publish_blocked
            FROM subscriber_billing sb
            JOIN ids ON ids.subscriber_id = sb.subscriber_id
            WHERE sb.payment_status NOT IN ('paid', 'cancelled', 'refunded')
            GROUP BY sb.subscriber_id
          ),
          media_stats AS (
            SELECT
              m.subscriber_id,
              COUNT(*)::int AS media_count,
              COALESCE(SUM(m.file_size_bytes), 0)::numeric AS storage_bytes
            FROM medias m
            JOIN ids ON ids.subscriber_id = m.subscriber_id
            WHERE m.is_active = true
            GROUP BY m.subscriber_id
          ),
          playlist_stats AS (
            SELECT
              p.subscriber_id,
              COUNT(*)::int AS playlist_count
            FROM playlists p
            JOIN ids ON ids.subscriber_id = p.subscriber_id
            WHERE p.is_active = true
            GROUP BY p.subscriber_id
          ),
          campaign_stats AS (
            SELECT
              c.subscriber_id,
              COUNT(*)::int AS campaign_count
            FROM campaigns c
            JOIN ids ON ids.subscriber_id = c.subscriber_id
            WHERE ${ACTIVE_CAMPAIGN_SQL}
            GROUP BY c.subscriber_id
          ),
          campaign_direct_media_stats AS (
            SELECT
              c.subscriber_id,
              COUNT(*)::int AS campaign_direct_media_count
            FROM campaigns c
            JOIN campaign_medias cm ON cm.campaign_id = c.campaign_id AND cm.is_active = true
            JOIN medias m ON m.media_id = cm.media_id AND m.is_active = true
            JOIN ids ON ids.subscriber_id = c.subscriber_id
            WHERE ${ACTIVE_CAMPAIGN_SQL}
            GROUP BY c.subscriber_id
          ),
          campaign_playlist_media_stats AS (
            SELECT
              c.subscriber_id,
              COUNT(DISTINCT cp.playlist_id)::int AS campaign_playlist_count,
              COUNT(DISTINCT pi.media_id)::int AS campaign_playlist_media_count
            FROM campaigns c
            JOIN campaign_playlists cp ON cp.campaign_id = c.campaign_id AND cp.is_active = true
            JOIN playlists p ON p.playlist_id = cp.playlist_id AND p.is_active = true
            JOIN playlist_items pi ON pi.playlist_id = p.playlist_id AND COALESCE(pi.is_active, true) = true
            JOIN medias m ON m.media_id = pi.media_id AND m.is_active = true
            JOIN ids ON ids.subscriber_id = c.subscriber_id
            WHERE ${ACTIVE_CAMPAIGN_SQL}
            GROUP BY c.subscriber_id
          ),
          playlist_media_stats AS (
            SELECT
              p.subscriber_id,
              COUNT(DISTINCT pi.media_id)::int AS playlist_media_count
            FROM playlists p
            JOIN playlist_items pi ON pi.playlist_id = p.playlist_id AND COALESCE(pi.is_active, true) = true
            JOIN medias m ON m.media_id = pi.media_id AND m.is_active = true
            JOIN ids ON ids.subscriber_id = p.subscriber_id
            WHERE p.is_active = true
            GROUP BY p.subscriber_id
          ),
          campaign_total_media_stats AS (
            SELECT
              src.subscriber_id,
              COUNT(DISTINCT src.media_id)::int AS campaign_total_media_count
            FROM (
              SELECT c.subscriber_id, m.media_id
              FROM campaigns c
              JOIN ids ON ids.subscriber_id = c.subscriber_id
              JOIN campaign_medias cm ON cm.campaign_id = c.campaign_id AND cm.is_active = true
              JOIN medias m ON m.media_id = cm.media_id AND m.is_active = true
              WHERE ${ACTIVE_CAMPAIGN_SQL}
              UNION
              SELECT c.subscriber_id, m.media_id
              FROM campaigns c
              JOIN ids ON ids.subscriber_id = c.subscriber_id
              JOIN campaign_playlists cp ON cp.campaign_id = c.campaign_id AND cp.is_active = true
              JOIN playlists p ON p.playlist_id = cp.playlist_id AND p.is_active = true
              JOIN playlist_items pi ON pi.playlist_id = p.playlist_id AND COALESCE(pi.is_active, true) = true
              JOIN medias m ON m.media_id = pi.media_id AND m.is_active = true
              WHERE ${ACTIVE_CAMPAIGN_SQL}
            ) src
            GROUP BY src.subscriber_id
          ),
          orphan_media_stats AS (
            SELECT
              m.subscriber_id,
              COUNT(*)::int AS orphan_media_count
            FROM medias m
            JOIN ids ON ids.subscriber_id = m.subscriber_id
            WHERE m.is_active = true
              AND NOT EXISTS (
                SELECT 1
                FROM campaigns c
                JOIN campaign_medias cm ON cm.campaign_id = c.campaign_id AND cm.is_active = true
                WHERE cm.media_id = m.media_id
                  AND c.subscriber_id = m.subscriber_id
                  AND ${ACTIVE_CAMPAIGN_SQL}
              )
              AND NOT EXISTS (
                SELECT 1
                FROM campaigns c
                JOIN campaign_playlists cp ON cp.campaign_id = c.campaign_id AND cp.is_active = true
                JOIN playlists p ON p.playlist_id = cp.playlist_id AND p.is_active = true
                JOIN playlist_items pi ON pi.playlist_id = p.playlist_id AND COALESCE(pi.is_active, true) = true
                WHERE pi.media_id = m.media_id
                  AND c.subscriber_id = m.subscriber_id
                  AND ${ACTIVE_CAMPAIGN_SQL}
              )
            GROUP BY m.subscriber_id
          ),
          reach_stats AS (
            SELECT
              spa.subscriber_id,
              COUNT(DISTINCT spa.publisher_id)::int AS publisher_count,
              COUNT(DISTINCT NULLIF(TRIM(l.city), ''))::int AS cities_count,
              COUNT(DISTINCT t.totem_id)::int AS totems_count,
              COUNT(DISTINCT t.totem_id) FILTER (
                WHERE COALESCE(t.status, 'offline') = 'online'
              )::int AS online_totems_count
            FROM subscriber_publisher_access spa
            JOIN ids ON ids.subscriber_id = spa.subscriber_id
            LEFT JOIN locals l ON l.publisher_id = spa.publisher_id AND l.is_active = true
            LEFT JOIN totems t ON t.local_id = l.local_id AND t.is_active = true
            WHERE spa.is_active = true
              AND spa.revoked_at IS NULL
              AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
            GROUP BY spa.subscriber_id
          ),
          activity_stats AS (
            SELECT
              ids.subscriber_id,
              media_act.last_media_upload_at,
              camp_act.last_campaign_activity_at
            FROM ids
            LEFT JOIN (
              SELECT m.subscriber_id, MAX(m.created_at) AS last_media_upload_at
              FROM medias m
              JOIN ids i ON i.subscriber_id = m.subscriber_id
              WHERE m.is_active = true
              GROUP BY m.subscriber_id
            ) media_act ON media_act.subscriber_id = ids.subscriber_id
            LEFT JOIN (
              SELECT c.subscriber_id, MAX(c.updated_at) AS last_campaign_activity_at
              FROM campaigns c
              JOIN ids i ON i.subscriber_id = c.subscriber_id
              WHERE ${ACTIVE_CAMPAIGN_SQL}
              GROUP BY c.subscriber_id
            ) camp_act ON camp_act.subscriber_id = ids.subscriber_id
          ),
          city_stats AS (
            SELECT
              spa.subscriber_id,
              STRING_AGG(DISTINCT l.city, ', ' ORDER BY l.city) AS city
            FROM subscriber_publisher_access spa
            JOIN ids ON ids.subscriber_id = spa.subscriber_id
            JOIN locals l ON l.publisher_id = spa.publisher_id
            WHERE spa.is_active = true
              AND spa.revoked_at IS NULL
              AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
              AND l.is_active = true
              AND NULLIF(TRIM(l.city), '') IS NOT NULL
            GROUP BY spa.subscriber_id
          )
          SELECT
            ids.subscriber_id,
            COALESCE(active_contracts.active_contracts_count, 0) AS active_contracts_count,
            COALESCE(media_stats.media_count, 0) AS media_count,
            COALESCE(media_stats.storage_bytes, 0) / 1073741824.0 AS storage_used_gb,
            COALESCE(playlist_stats.playlist_count, 0) AS playlist_count,
            COALESCE(campaign_stats.campaign_count, 0) AS campaign_count,
            COALESCE(campaign_direct_media_stats.campaign_direct_media_count, 0) AS campaign_direct_media_count,
            COALESCE(campaign_playlist_media_stats.campaign_playlist_count, 0) AS campaign_playlist_count,
            COALESCE(campaign_playlist_media_stats.campaign_playlist_media_count, 0) AS campaign_playlist_media_count,
            COALESCE(campaign_total_media_stats.campaign_total_media_count, 0) AS campaign_total_media_count,
            COALESCE(playlist_media_stats.playlist_media_count, 0) AS playlist_media_count,
            COALESCE(orphan_media_stats.orphan_media_count, 0) AS orphan_media_count,
            COALESCE(reach_stats.publisher_count, 0) AS publisher_count,
            COALESCE(reach_stats.cities_count, 0) AS cities_count,
            COALESCE(reach_stats.totems_count, 0) AS totems_count,
            COALESCE(reach_stats.online_totems_count, 0) AS online_totems_count,
            activity_stats.last_media_upload_at,
            activity_stats.last_campaign_activity_at,
            city_stats.city,
            CASE
              WHEN COALESCE(contract_alert.has_expired, false) THEN 'error'
              WHEN COALESCE(contract_alert.has_expiring_soon, false) THEN 'warning'
              WHEN COALESCE(active_contracts.active_contracts_count, 0) > 0 THEN 'success'
              ELSE 'neutral'
            END AS contract_alert_level,
            contract_alert.days_until_contract_end,
            COALESCE(billing_alert.has_billing_overdue, false) AS has_billing_overdue,
            COALESCE(billing_alert.has_billing_due_soon, false) AS has_billing_due_soon,
            COALESCE(billing_alert.has_billing_publish_blocked, false) AS has_billing_publish_blocked
          FROM ids
          LEFT JOIN active_contracts ON active_contracts.subscriber_id = ids.subscriber_id
          LEFT JOIN contract_alert ON contract_alert.subscriber_id = ids.subscriber_id
          LEFT JOIN billing_alert ON billing_alert.subscriber_id = ids.subscriber_id
          LEFT JOIN media_stats ON media_stats.subscriber_id = ids.subscriber_id
          LEFT JOIN playlist_stats ON playlist_stats.subscriber_id = ids.subscriber_id
          LEFT JOIN campaign_stats ON campaign_stats.subscriber_id = ids.subscriber_id
          LEFT JOIN campaign_direct_media_stats ON campaign_direct_media_stats.subscriber_id = ids.subscriber_id
          LEFT JOIN campaign_playlist_media_stats ON campaign_playlist_media_stats.subscriber_id = ids.subscriber_id
          LEFT JOIN campaign_total_media_stats ON campaign_total_media_stats.subscriber_id = ids.subscriber_id
          LEFT JOIN playlist_media_stats ON playlist_media_stats.subscriber_id = ids.subscriber_id
          LEFT JOIN orphan_media_stats ON orphan_media_stats.subscriber_id = ids.subscriber_id
          LEFT JOIN reach_stats ON reach_stats.subscriber_id = ids.subscriber_id
          LEFT JOIN activity_stats ON activity_stats.subscriber_id = ids.subscriber_id
          LEFT JOIN city_stats ON city_stats.subscriber_id = ids.subscriber_id
        `, [subscriberIds]);

        const metricsBySubscriberId = new Map(
          metricsRows.map((row: any) => [Number(row.subscriber_id), row])
        );

        await Promise.all(
          subscribers.map(async (subscriber: Subscriber) => {
            const metrics = metricsBySubscriberId.get(subscriber.subscriber_id) || {};
            const limits = await this.getMaxLimits(subscriber.subscriber_id).catch(
              (): {
                medias?: number;
                playlists?: number;
                campaigns?: number;
                storage_gb?: number;
                totems?: number;
              } => ({}),
            );

            subscriber.city = metrics.city || undefined;
            subscriber.active_contracts_count = Number(metrics.active_contracts_count || 0);
            subscriber.media_count = Number(metrics.media_count || 0);
            subscriber.playlist_count = Number(metrics.playlist_count || 0);
            subscriber.campaign_count = Number(metrics.campaign_count || 0);
            subscriber.campaign_direct_media_count = Number(metrics.campaign_direct_media_count || 0);
            subscriber.campaign_playlist_count = Number(metrics.campaign_playlist_count || 0);
            subscriber.campaign_playlist_media_count = Number(metrics.campaign_playlist_media_count || 0);
            subscriber.campaign_total_media_count = Number(metrics.campaign_total_media_count || 0);
            subscriber.playlist_media_count = Number(metrics.playlist_media_count || 0);
            subscriber.orphan_media_count = Number(metrics.orphan_media_count || 0);
            subscriber.publisher_count = Number(metrics.publisher_count || 0);
            subscriber.cities_count = Number(metrics.cities_count || 0);
            subscriber.totems_count = Number(metrics.totems_count || 0);
            subscriber.online_totems_count = Number(metrics.online_totems_count || 0);
            subscriber.last_media_upload_at = metrics.last_media_upload_at || null;
            subscriber.last_campaign_activity_at = metrics.last_campaign_activity_at || null;
            subscriber.storage_used_gb = Number(metrics.storage_used_gb || 0);
            subscriber.storage_limit_gb = limits.storage_gb;
            subscriber.plan_limit_medias = limits.medias;
            subscriber.plan_limit_playlists = limits.playlists;
            subscriber.plan_limit_campaigns = limits.campaigns;

            const alertLevel = metrics.contract_alert_level as Subscriber['contract_alert_level'];
            subscriber.contract_alert_level = alertLevel || 'neutral';
            const daysUntil = metrics.days_until_contract_end;
            subscriber.days_until_contract_end =
              daysUntil != null && daysUntil !== '' ? Number(daysUntil) : null;
            subscriber.has_billing_overdue = Boolean(metrics.has_billing_overdue);
            subscriber.has_billing_due_soon = Boolean(metrics.has_billing_due_soon);
            subscriber.has_billing_publish_blocked = Boolean(metrics.has_billing_publish_blocked);

            const { getFinancialAdminService } = require('./financialAdminService');
            const fin = getFinancialAdminService().resolveSubscriberFinancialAlert({
              contract_alert_level: alertLevel,
              has_billing_overdue: subscriber.has_billing_overdue,
              has_billing_due_soon: subscriber.has_billing_due_soon,
              has_billing_publish_blocked: subscriber.has_billing_publish_blocked,
              days_until_contract_end: subscriber.days_until_contract_end,
            });
            subscriber.financial_alert_level = fin.level;
            subscriber.financial_alert_label = fin.label;
            subscriber.contract_alert_label = fin.tooltip;
          })
        );
      }

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM subscribers s
        ${whereClause}
      `, queryParams);

      return {
        data: subscribers,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };
    } catch (error: any) {
      await logError('Erro ao listar subscribers', error, { params });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Listar contratos ativos de um subscriber (status active e dentro do período)
   */
  async getActiveContracts(subscriberId: number): Promise<any[]> {
    try {
      const contracts = await this.db.findMany(`
        SELECT 
          sc.contract_id,
          sc.contract_number,
          sc.title,
          sc.description,
          sc.start_date,
          sc.end_date,
          sc.status,
          sc.total_amount,
          sc.currency,
          sc.billing_interval,
          sc.payment_terms,
          sc.contract_type,
          p.plan_id,
          p.name AS plan_name,
          p.slug AS plan_slug,
          p.price_monthly,
          p.price_four_month,
          p.price_semester,
          p.price_yearly,
          CASE 
            WHEN sc.status = 'active' 
              AND sc.start_date <= CURRENT_DATE 
              AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
            THEN true
            ELSE false
          END AS is_valid
        FROM subscriber_contracts sc
        LEFT JOIN plans p ON sc.plan_id = p.plan_id
        WHERE sc.subscriber_id = $1
          AND sc.status = 'active'
          AND sc.start_date <= CURRENT_DATE
          AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
        ORDER BY sc.start_date DESC
      `, [subscriberId]);

      return contracts || [];
    } catch (error: any) {
      await logError('Erro ao buscar contratos ativos do subscriber', error);
      throw error;
    }
  }

  /**
   * Listar todos os contratos de um subscriber (qualquer status), para exibição na edição do anunciante.
   */
  async getSubscriberContracts(subscriberId: number, activeOnly = false): Promise<any[]> {
    try {
      const statusCondition = activeOnly
        ? `AND sc.status = 'active' AND sc.start_date <= CURRENT_DATE AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)`
        : '';
      const contracts = await this.db.findMany(`
        SELECT 
          sc.contract_id,
          sc.contract_number,
          sc.title,
          sc.description,
          sc.start_date,
          sc.end_date,
          sc.status,
          sc.total_amount,
          sc.currency,
          sc.billing_interval,
          sc.payment_terms,
          sc.contract_type,
          p.plan_id,
          p.name AS plan_name,
          p.slug AS plan_slug,
          p.price_monthly,
          p.price_four_month,
          p.price_semester,
          p.price_yearly,
          CASE 
            WHEN sc.status = 'active' 
              AND sc.start_date <= CURRENT_DATE 
              AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
            THEN true
            ELSE false
          END AS is_valid
        FROM subscriber_contracts sc
        LEFT JOIN plans p ON sc.plan_id = p.plan_id
        WHERE sc.subscriber_id = $1
          ${statusCondition}
        ORDER BY sc.start_date DESC, sc.contract_id DESC
      `, [subscriberId]);

      return contracts || [];
    } catch (error: any) {
      await logError('Erro ao buscar contratos do subscriber', error);
      throw error;
    }
  }

  /**
   * Obter subscriber por ID
   */
  async getSubscriberById(id: number): Promise<Subscriber | null> {
    try {
      const subscriber = await this.db.findFirst(`
        SELECT 
          s.subscriber_id,
          s.name,
          s.contact_name,
          s.email,
          s.phone,
          s.whatsapp,
          s.address,
          s.category_segment,
          s.description,
          s.portal_slug,
          s.is_active,
          s.created_at,
          s.updated_at
        FROM subscribers s
        WHERE s.subscriber_id = $1
      `, [id]);

      return subscriber;
    } catch (error: any) {
      await logError('Erro ao obter subscriber', error, { id });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar novo subscriber (anunciante)
   * - Pode ser criado sem contrato
   * - Opcionalmente pode vincular um pré-contrato (subscriber_contracts.created_before_subscriber=true)
   */
  async createSubscriber(data: CreateSubscriberRequest): Promise<Subscriber> {
    try {
      const { name, contract_id } = data;
      // Sanitizar campos opcionais: tratar '' como null, trim strings
      const contact_name = (data.contact_name && String(data.contact_name).trim() !== '') ? String(data.contact_name).trim() : null;
      const email = (data.email && String(data.email).trim() !== '') ? String(data.email).trim() : null;
      const phone = (data.phone && String(data.phone).trim() !== '') ? String(data.phone).trim() : null;
      const whatsapp = (data.whatsapp && String(data.whatsapp).trim() !== '') ? String(data.whatsapp).trim() : null;
      const address = (data.address && String(data.address).trim() !== '') ? String(data.address).trim() : null;
      const category_segment = (data.category_segment && String(data.category_segment).trim() !== '') ? String(data.category_segment).trim() : null;
      const description = (data.description && String(data.description).trim() !== '') ? String(data.description).trim() : null;
      const portalSlug = await assertPortalSlugAvailable(
        this.db as any,
        data.portal_slug ?? null,
        { role: 'subscriber' }
      );

      // Validar contrato apenas se contract_id foi fornecido
      if (contract_id) {
        const contract = await this.db.findFirst(`
          SELECT 
            contract_id, 
            subscriber_id, 
            status, 
            start_date,
            end_date
          FROM subscriber_contracts 
          WHERE contract_id = $1
        `, [contract_id]);

        if (!contract) {
          throw new Error('Contrato não encontrado');
        }

        // Validar status do contrato (deve ser draft ou active)
        if (contract.status !== 'draft' && contract.status !== 'active') {
          throw new Error('Contrato deve estar em status "draft" ou "active" para vincular o subscriber');
        }

        // Se contrato já tem subscriber_id, erro (pré-contratos não são mais suportados)
        if (contract.subscriber_id) {
          throw new Error('Contrato já está vinculado a outro subscriber');
        }
      }

      // Verificar se subscriber já existe
      const existingSubscriber = await this.db.findFirst(`
        SELECT subscriber_id FROM subscribers WHERE name = $1
      `, [name]);

      if (existingSubscriber) {
        throw new Error('Subscriber com este nome já existe');
      }

      // Verificar email único (se fornecido)
      if (email) {
        const existingEmail = await this.db.findFirst(`
          SELECT subscriber_id FROM subscribers WHERE email = $1
        `, [email]);

        if (existingEmail) {
          throw new Error('Subscriber com este email já existe');
        }
      }

      // Criar subscriber
      const result = await this.db.executeRaw(`
        INSERT INTO subscribers (name, contact_name, email, phone, whatsapp, address, category_segment, description, portal_slug, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING subscriber_id
      `, [name, contact_name, email, phone, whatsapp, address, category_segment, description, portalSlug]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar subscriber');
      }

      const subscriberId = result.rows[0].subscriber_id;

      // Vincular subscriber ao contrato (se fornecido)
      if (contract_id) {
        await this.db.executeRaw(`
          UPDATE subscriber_contracts 
          SET subscriber_id = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE contract_id = $2
        `, [subscriberId, contract_id]);
      }

      // Criar diretório de uploads do assinante (subscriber-{id}/medias) para permitir upload de mídias
      try {
        const storage = new StorageService();
        await storage.ensureSubscriberUploadDirs(subscriberId);
      } catch (dirError: any) {
        await logError('Erro ao criar diretório de uploads do assinante (assinante foi criado)', dirError, { subscriberId });
        // Não falhar a criação do assinante; o diretório pode ser criado depois ou manualmente
      }

      const newSubscriber = await this.getSubscriberById(subscriberId);

      if (!newSubscriber) {
        throw new Error('Erro ao buscar subscriber criado');
      }

      if (portalSlug) {
        await maybeSyncPortalHostsAfterSlugChange(this.db as any);
      }

      return newSubscriber;
    } catch (error: any) {
      // Capturar unique constraint violation (nome/email duplicado)
      if (error && (error.code === '23505' || (error.message && error.message.includes('duplicate key')))) {
        const msg = error.detail || error.message || '';
        if (msg.includes('name')) {
          throw new Error('Subscriber com este nome já existe');
        }
        if (msg.includes('email')) {
          throw new Error('Subscriber com este email já existe');
        }
        throw new Error('Subscriber com valores duplicados (nome/email) já existe');
      }
      await logError('Erro ao criar subscriber', error, { data });
      throw error;
    }
  }

  /**
   * Criar subscriber e subscriber_contracts numa única transação via procedure no banco.
   * contract_number é gerado no banco como SUB-{subscriber_id}.{seq}.
   * Uso: POST /api/subscribers com body { subscriber: { name, ... }, contracts: [ { plan_id?, title, ... } ] }
   */
  async createSubscriberWithContracts(payload: {
    subscriber: CreateSubscriberRequest & { is_active?: boolean };
    contracts?: Array<Record<string, unknown>>;
  }): Promise<Subscriber> {
    const db = getDatabase();
    const subscriber = { ...payload.subscriber };
    const optionalTextFields = [
      'contact_name',
      'email',
      'phone',
      'whatsapp',
      'address',
      'category_segment',
      'description',
    ] as const;
    for (const field of optionalTextFields) {
      const value = subscriber[field];
      if (value !== undefined && value !== null && String(value).trim() === '') {
        (subscriber as Record<string, unknown>)[field] = null;
      }
    }

    const pSubscriber = JSON.stringify(subscriber);
    const pContracts = JSON.stringify(payload.contracts ?? []);

    let row;
    try {
      row = await db.findFirst(
        `SELECT create_subscriber_with_contracts($1::jsonb, $2::jsonb) AS data`,
        [pSubscriber, pContracts]
      );
    } catch (error: any) {
      if (error && (error.code === '23505' || String(error.message || '').includes('duplicate key'))) {
        const msg = String(error.detail || error.message || '');
        if (msg.includes('email')) {
          throw new Error('Subscriber com este email já existe');
        }
        if (msg.includes('name')) {
          throw new Error('Subscriber com este nome já existe');
        }
        throw new Error('Subscriber com valores duplicados (nome/email) já existe');
      }
      throw error;
    }
    if (!row?.data) {
      throw new Error('Erro ao criar subscriber com contratos: procedimento não retornou dados');
    }
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const subscriberId = data.subscriber_id;
    if (!subscriberId) {
      throw new Error('Erro ao criar subscriber com contratos: subscriber_id não retornado');
    }

    const subData = await db.findFirst(
      `SELECT subscriber_id, name, contact_name, email, phone, whatsapp, address, category_segment, description, is_active, created_at, updated_at
       FROM subscribers WHERE subscriber_id = $1`,
      [subscriberId]
    );
    if (!subData) {
      throw new Error('Erro ao buscar subscriber criado');
    }
    return subData as Subscriber;
  }

  /**
   * Atualizar subscriber
   */
  async updateSubscriber(id: number, data: UpdateSubscriberRequest): Promise<Subscriber> {
    try {
      const { name, contact_name: raw_contact_name, email: raw_email, phone: raw_phone, whatsapp: raw_whatsapp, address: raw_address, category_segment: raw_category_segment, description: raw_description, portal_slug, isActive } = data;
      const contact_name = (raw_contact_name !== undefined && raw_contact_name !== null && String(raw_contact_name).trim() !== '') ? String(raw_contact_name).trim() : undefined;
      const email = (raw_email !== undefined && raw_email !== null && String(raw_email).trim() !== '') ? String(raw_email).trim() : undefined;
      const phone = (raw_phone !== undefined && raw_phone !== null && String(raw_phone).trim() !== '') ? String(raw_phone).trim() : undefined;
      const whatsapp = (raw_whatsapp !== undefined && raw_whatsapp !== null && String(raw_whatsapp).trim() !== '') ? String(raw_whatsapp).trim() : undefined;
      const address = (raw_address !== undefined && raw_address !== null && String(raw_address).trim() !== '') ? String(raw_address).trim() : undefined;
      const category_segment = (raw_category_segment !== undefined && raw_category_segment !== null && String(raw_category_segment).trim() !== '') ? String(raw_category_segment).trim() : undefined;
      const description = (raw_description !== undefined && raw_description !== null && String(raw_description).trim() !== '') ? String(raw_description).trim() : undefined;

      // Verificar se subscriber existe
      const existingSubscriber = await this.getSubscriberById(id);
      if (!existingSubscriber) {
        throw new Error('Subscriber não encontrado');
      }

      // Verificar se nome já existe (se mudou)
      if (name && name !== existingSubscriber.name) {
        const subscriberWithSameName = await this.db.findFirst(`
          SELECT subscriber_id FROM subscribers WHERE name = $1 AND subscriber_id != $2
        `, [name, id]);

        if (subscriberWithSameName) {
          throw new Error('Subscriber com este nome já existe');
        }
      }

      // Verificar se email já existe (se mudou)
      if (email && email !== existingSubscriber.email) {
        const subscriberWithSameEmail = await this.db.findFirst(`
          SELECT subscriber_id FROM subscribers WHERE email = $1 AND subscriber_id != $2
        `, [email, id]);

        if (subscriberWithSameEmail) {
          throw new Error('Subscriber com este email já existe');
        }
      }

      // Preparar campos para atualização
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (name) {
        updateFields.push(`name = $${paramIndex}`);
        updateParams.push(name);
        paramIndex++;
      }

      if (contact_name !== undefined) {
        updateFields.push(`contact_name = $${paramIndex}`);
        updateParams.push(contact_name);
        paramIndex++;
      }

      if (email !== undefined) {
        updateFields.push(`email = $${paramIndex}`);
        updateParams.push(email || null);
        paramIndex++;
      }

      if (phone !== undefined) {
        updateFields.push(`phone = $${paramIndex}`);
        updateParams.push(phone);
        paramIndex++;
      }

      if (whatsapp !== undefined) {
        updateFields.push(`whatsapp = $${paramIndex}`);
        updateParams.push(whatsapp);
        paramIndex++;
      }

      if (address !== undefined) {
        updateFields.push(`address = $${paramIndex}`);
        updateParams.push(address);
        paramIndex++;
      }

      if (category_segment !== undefined) {
        updateFields.push(`category_segment = $${paramIndex}`);
        updateParams.push(category_segment || null);
        paramIndex++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        updateParams.push(description);
        paramIndex++;
      }

      if (portal_slug !== undefined) {
        const portalSlug = await assertPortalSlugAvailable(
          this.db as any,
          portal_slug,
          { role: 'subscriber', excludeId: id }
        );
        updateFields.push(`portal_slug = $${paramIndex}`);
        updateParams.push(portalSlug);
        paramIndex++;
      }

      if (isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        updateParams.push(isActive);
        paramIndex++;
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Executar atualização
      await this.db.executeRaw(`
        UPDATE subscribers 
        SET ${updateFields.join(', ')}
        WHERE subscriber_id = $${paramIndex}
      `, [...updateParams, id]);

      const updatedSubscriber = await this.getSubscriberById(id);
      if (!updatedSubscriber) {
        throw new Error('Erro ao buscar subscriber atualizado');
      }

      if (portal_slug !== undefined) {
        await maybeSyncPortalHostsAfterSlugChange(this.db as any);
      }

      return updatedSubscriber;
    } catch (error: any) {
      await logError('Erro ao atualizar subscriber', error, { id, data });
      throw error;
    }
  }

  /**
   * Excluir subscriber (soft delete)
   */
  async deleteSubscriber(id: number): Promise<void> {
    try {
      // Verificar se subscriber existe
      const existingSubscriber = await this.getSubscriberById(id);
      if (!existingSubscriber) {
        throw new Error('Subscriber não encontrado');
      }

      // Soft delete em cascata (lógica encapsulada no banco)
      await this.db.executeRaw(
        `SELECT deactivate_subscriber_cascade($1)`,
        [id]
      );
    } catch (error: any) {
      await logError('Erro ao excluir subscriber', error, { id });
      throw error;
    }
  }

  /**
   * Listar locals de um subscriber
   */
  /**
   * Listar locais acessíveis por um subscriber através de planos e contratos
   * Subscribers não possuem locais próprios - acessam locais dos publishers através de planos
   */
  async getLocalsBySubscriber(subscriberId: number): Promise<any[]> {
    try {
      const locals = await this.db.findMany(`
        SELECT DISTINCT
          l.local_id,
          l.publisher_id,
          l.name,
          l.address,
          l.city,
          l.state,
          l.zip_code,
          l.country,
          l.latitude,
          l.longitude,
          l.timezone,
          l.description,
          l.is_active,
          l.created_at,
          l.updated_at,
          p.name as publisher_name,
          spa.access_type,
          spa.expires_at
        FROM subscriber_publisher_access spa
        JOIN publishers pub ON spa.publisher_id = pub.publisher_id
        JOIN locals l ON l.publisher_id = pub.publisher_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE spa.subscriber_id = $1
          AND spa.is_active = true
          AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
          AND spa.revoked_at IS NULL
          AND l.is_active = true
        ORDER BY l.name
      `, [subscriberId]);

      return locals;
    } catch (error: any) {
      await logError('Erro ao buscar locals acessíveis do subscriber', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Listar totems acessíveis por um subscriber (via locais dos publishers acessíveis)
   */
  async getTotemsBySubscriber(subscriberId: number): Promise<any[]> {
    try {
      const totems = await this.db.findMany(`
        SELECT DISTINCT
          t.totem_id,
          t.identifier,
          t.uin,
          t.device_id,
          t.name,
          t.description,
          t.model,
          t.manufacturer,
          t.firmware_version,
          t.hardware_version,
          t.os_version,
          t.status,
          t.last_heartbeat,
          t.heartbeat_interval,
          t.network_info,
          t.capabilities,
          t.is_active,
          t.created_at,
          t.updated_at,
          l.name as local_name,
          l.local_id,
          p.name as publisher_name
        FROM subscriber_publisher_access spa
        JOIN publishers pub ON spa.publisher_id = pub.publisher_id
        JOIN locals l ON l.publisher_id = pub.publisher_id
        JOIN totems t ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE spa.subscriber_id = $1
          AND spa.is_active = true
          AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
          AND spa.revoked_at IS NULL
          AND l.is_active = true
          AND t.is_active = true
        ORDER BY l.name, t.name
      `, [subscriberId]);

      return totems;
    } catch (error: any) {
      await logError('Erro ao buscar totems do subscriber', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Totens elegíveis no modo compacto para uma campanha vinculada a um contrato:
   * contrato **ativo** (status, is_active, vigência), com **plan_id**;
   * `plan_publisher_access` (plano → publisher do local do totem);
   * **`plan_local_access` obrigatório**: só entram totens cujo `local_id` está explicitamente
   * permitido para o plano do contrato (sem fallback “todos os locais do publisher”).
   * Apenas totens e locais **ativos** (`t.is_active`, `l.is_active`).
   */
  async getTotemsBySubscriberContract(subscriberId: number, contractId: number): Promise<any[]> {
    try {
      const contract = await this.db.findFirst(
        `
        SELECT contract_id, subscriber_id, plan_id, status, is_active, start_date, end_date
        FROM subscriber_contracts
        WHERE contract_id = $1 AND subscriber_id = $2
      `,
        [contractId, subscriberId]
      );

      if (!contract) {
        return [];
      }

      if (!contract.plan_id) {
        return [];
      }

      if (String(contract.status || '').toLowerCase() !== 'active') {
        return [];
      }

      if (contract.is_active === false) {
        return [];
      }

      const totems = await this.db.findMany(
        `
        SELECT DISTINCT
          t.totem_id,
          t.identifier,
          t.uin,
          t.device_id,
          t.name,
          t.description,
          t.model,
          t.manufacturer,
          t.firmware_version,
          t.hardware_version,
          t.os_version,
          t.status,
          t.last_heartbeat,
          t.heartbeat_interval,
          t.network_info,
          t.capabilities,
          t.is_active,
          t.created_at,
          t.updated_at,
          l.name as local_name,
          l.local_id,
          p.name as publisher_name
        FROM totems t
        INNER JOIN locals l ON t.local_id = l.local_id
        INNER JOIN subscriber_contracts sc ON sc.contract_id = $1
          AND sc.subscriber_id = $2
        INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
          AND ppa.publisher_id = l.publisher_id
          AND ppa.is_allowed = true
          AND COALESCE(ppa.is_active, true) = true
        INNER JOIN plan_local_access pla ON pla.plan_id = sc.plan_id
          AND pla.local_id = l.local_id
          AND pla.is_allowed = true
          AND COALESCE(pla.is_active, true) = true
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE sc.plan_id IS NOT NULL
          AND sc.status = 'active'
          AND COALESCE(sc.is_active, true) = true
          AND sc.start_date <= CURRENT_DATE
          AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
          AND t.is_active = true
          AND l.is_active = true
        ORDER BY l.name, t.name
      `,
        [contractId, subscriberId]
      );

      return totems;
    } catch (error: any) {
      await logError('Erro ao buscar totems do subscriber por contrato', error, { subscriberId, contractId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Listar smart TVs acessíveis por um subscriber (via locais dos publishers acessíveis)
   */
  async getSmartTvsBySubscriber(subscriberId: number): Promise<any[]> {
    try {
      const smartTvs = await this.db.findMany(`
        SELECT DISTINCT
          st.smart_tv_id,
          st.identifier,
          st.device_id,
          st.name,
          st.brand,
          st.model,
          st.platform,
          st.firmware_version,
          st.resolution_width,
          st.resolution_height,
          st.orientation,
          st.status,
          st.last_heartbeat,
          st.capabilities,
          st.settings,
          st.is_active,
          st.created_at,
          st.updated_at,
          t.name as totem_name,
          t.totem_id,
          t.identifier as totem_identifier,
          l.name as local_name,
          p.name as publisher_name
        FROM subscriber_publisher_access spa
        JOIN publishers pub ON spa.publisher_id = pub.publisher_id
        JOIN locals l ON l.publisher_id = pub.publisher_id
        JOIN totems t ON t.local_id = l.local_id
        JOIN smart_tvs st ON st.totem_id = t.totem_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE spa.subscriber_id = $1
          AND spa.is_active = true
          AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
          AND spa.revoked_at IS NULL
          AND l.is_active = true
          AND t.is_active = true
          AND st.is_active = true
        ORDER BY l.name, t.name, st.name
      `, [subscriberId]);

      return smartTvs;
    } catch (error: any) {
      await logError('Erro ao buscar smart TVs do subscriber', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Buscar planos ativos de um subscriber através dos contratos
   */
  async getActivePlans(subscriberId: number): Promise<any[]> {
    try {
      const plans = await this.db.findMany(`
        SELECT DISTINCT
          p.plan_id,
          p.name,
          p.slug,
          p.description,
          p.limits,
          p.features,
          sc.contract_id,
          sc.contract_number,
          sc.status as contract_status,
          sc.start_date,
          sc.end_date
        FROM subscriber_contracts sc
        JOIN plans p ON sc.plan_id = p.plan_id
        WHERE sc.subscriber_id = $1
          AND sc.status = 'active'
          AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
          AND p.is_active = true
        ORDER BY sc.start_date DESC
      `, [subscriberId]);

      return plans;
    } catch (error: any) {
      await logError('Erro ao buscar planos ativos do subscriber', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter limites máximos dos planos ativos de um subscriber
   * Com cache de 5 minutos para melhor performance
   */
  async getMaxLimits(subscriberId: number): Promise<{
    medias?: number;
    playlists?: number;
    campaigns?: number;
    storage_gb?: number;
    totems?: number;
  }> {
    try {
      // Tentar obter do cache primeiro
      const cacheKey = `subscriber:${subscriberId}:max_limits`;
      const cached = await this.cache.get<{
        medias?: number;
        playlists?: number;
        campaigns?: number;
        storage_gb?: number;
        totems?: number;
      }>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const plans = await this.getActivePlans(subscriberId);
      const settings = new SettingsService();
      const readDefault = async (key: string): Promise<number | undefined> => {
        const row = await settings.getSetting(key);
        if (!row || row.value === undefined || row.value === null || String(row.value).trim() === '') {
          return undefined;
        }
        return normalizeLimitInt(row.value);
      };

      const defaults = {
        medias: await readDefault(LIMITS_DEFAULT_SETTING_KEYS.medias),
        playlists: await readDefault(LIMITS_DEFAULT_SETTING_KEYS.playlists),
        campaigns: await readDefault(LIMITS_DEFAULT_SETTING_KEYS.campaigns),
        storage_gb: await readDefault(LIMITS_DEFAULT_SETTING_KEYS.storage_gb),
        totems: await readDefault(LIMITS_DEFAULT_SETTING_KEYS.totems),
      };

      if (plans.length === 0) {
        // Sem contrato/plano ativo: aplica os mesmos defaults de sistema (limits.defaults.*).
        // Valor 0 em defaults = ilimitado para aquela métrica.
        const limits = {
          medias: resolveLimitWithDefault('unset', defaults.medias),
          playlists: resolveLimitWithDefault('unset', defaults.playlists),
          campaigns: resolveLimitWithDefault('unset', defaults.campaigns),
          storage_gb: resolveLimitWithDefault('unset', defaults.storage_gb),
          totems: resolveLimitWithDefault('unset', defaults.totems),
        };
        await this.cache.set(cacheKey, limits, 300);
        return limits;
      }

      const limits = {
        medias: resolveLimitWithDefault(mergeNumericPlanLimit(plans, 'medias'), defaults.medias),
        playlists: resolveLimitWithDefault(mergeNumericPlanLimit(plans, 'playlists'), defaults.playlists),
        campaigns: resolveLimitWithDefault(mergeNumericPlanLimit(plans, 'campaigns'), defaults.campaigns),
        storage_gb: resolveLimitWithDefault(mergeNumericPlanLimit(plans, 'storage_gb'), defaults.storage_gb),
        totems: resolveLimitWithDefault(mergeNumericPlanLimit(plans, 'totems'), defaults.totems),
      };

      // Armazenar no cache por 5 minutos (300 segundos)
      await this.cache.set(cacheKey, limits, 300);

      return limits;
    } catch (error: any) {
      await logError('Erro ao obter limites máximos', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Validar limites do plano ao criar/atualizar recursos
   */
  async validatePlanLimits(
    subscriberId: number,
    resourceType: 'media' | 'playlist' | 'campaign'
  ): Promise<void> {
    try {
      const limits = await this.getMaxLimits(subscriberId);
      const limitKey = resourceType === 'media' ? 'medias' : 
                      resourceType === 'playlist' ? 'playlists' : 
                      'campaigns';
      const maxLimit = limits[limitKey];

      // Sem limite ou 0 = ilimitado
      if (maxLimit === undefined || maxLimit === 0) {
        return;
      }

      // Contar recursos atuais
      let currentCount = 0;

      if (resourceType === 'media') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM medias
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      } else if (resourceType === 'playlist') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM playlists
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      } else if (resourceType === 'campaign') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM campaigns
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      }

      // Validar se não excede limite
      if (currentCount >= maxLimit) {
        throw new Error(
          `Limite de ${resourceType === 'media' ? 'mídias' : resourceType === 'playlist' ? 'playlists' : 'campanhas'} excedido. ` +
          `Limite do plano: ${maxLimit}, utilizado: ${currentCount}`
        );
      }
    } catch (error: any) {
      if (error.message.includes('Limite')) {
        throw error;
      }
      await logError('Erro ao validar limites do plano', error, { subscriberId, resourceType });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Validar limite de armazenamento (storage)
   */
  async validateStorageLimit(subscriberId: number, newFileSizeBytes: number): Promise<void> {
    try {
      const limits = await this.getMaxLimits(subscriberId);
      const maxStorageGB = limits.storage_gb;

      // Sem limite ou 0 = ilimitado
      if (maxStorageGB === undefined || maxStorageGB === 0) {
        return;
      }

      // Calcular storage atual (soma de todas as mídias)
      const currentStorageResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(file_size_bytes), 0) as total_bytes
        FROM medias
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);

      const currentStorageBytes = parseInt(currentStorageResult?.total_bytes || '0');
      const newTotalBytes = currentStorageBytes + newFileSizeBytes;
      const newTotalGB = newTotalBytes / (1024 * 1024 * 1024); // Converter para GB

      // Validar se não excede limite
      if (newTotalGB > maxStorageGB) {
        const availableGB = maxStorageGB - (currentStorageBytes / (1024 * 1024 * 1024));
        throw new Error(
          `Limite de armazenamento excedido. ` +
          `Disponível: ${availableGB.toFixed(2)} GB, ` +
          `Tentativa de upload: ${(newFileSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
        );
      }
    } catch (error: any) {
      if (error.message.includes('Limite')) {
        throw error;
      }
      await logError('Erro ao validar limite de armazenamento', error, { subscriberId, newFileSizeBytes });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter contagem atual de recursos de um tipo específico
   * Com cache de 1 minuto para melhor performance
   */
  async getCurrentResourceCount(
    subscriberId: number,
    resourceType: 'media' | 'playlist' | 'campaign'
  ): Promise<number> {
    try {
      // Tentar obter do cache primeiro
      const cacheKey = `subscriber:${subscriberId}:count:${resourceType}`;
      const cached = await this.cache.get<number>(cacheKey);
      
      if (cached !== null) {
        return cached;
      }

      let currentCount = 0;

      if (resourceType === 'media') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM medias
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      } else if (resourceType === 'playlist') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM playlists
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      } else if (resourceType === 'campaign') {
        const result = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM campaigns
          WHERE subscriber_id = $1 AND is_active = true
        `, [subscriberId]);
        currentCount = parseInt(result?.count || '0');
      }

      // Armazenar no cache por 1 minuto (60 segundos)
      await this.cache.set(cacheKey, currentCount, 60);

      return currentCount;
    } catch (error: any) {
      await logError('Erro ao obter contagem de recursos', error, { subscriberId, resourceType });
      return 0;
    }
  }

  /**
   * Obter storage atual em bytes
   * Com cache de 1 minuto para melhor performance
   */
  async getCurrentStorage(subscriberId: number): Promise<number> {
    try {
      // Tentar obter do cache primeiro
      const cacheKey = `subscriber:${subscriberId}:storage`;
      const cached = await this.cache.get<number>(cacheKey);
      
      if (cached !== null) {
        return cached;
      }

      const currentStorageResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(file_size_bytes), 0) as total_bytes
        FROM medias
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);

      const storageBytes = parseInt(currentStorageResult?.total_bytes || '0');

      // Armazenar no cache por 1 minuto (60 segundos)
      await this.cache.set(cacheKey, storageBytes, 60);

      return storageBytes;
    } catch (error: any) {
      await logError('Erro ao obter storage atual', error, { subscriberId });
      return 0;
    }
  }

  /**
   * Invalidar cache de limites e contagens de um subscriber
   * Chamar quando recursos são criados/atualizados/deletados
   */
  async invalidateSubscriberCache(subscriberId: number): Promise<void> {
    try {
      const patterns = [
        `subscriber:${subscriberId}:max_limits`,
        `subscriber:${subscriberId}:count:*`,
        `subscriber:${subscriberId}:storage`,
      ];

      for (const pattern of patterns) {
        await this.cache.deletePattern(pattern);
      }
    } catch (error: any) {
      // Não falhar se cache não estiver disponível
      await logError('Erro ao invalidar cache do subscriber', error, { subscriberId }).catch(() => {});
    }
  }

  /**
   * Validar acesso a totem (verificar se subscriber tem acesso via contratos/planos)
   */
  async validateTotemAccess(subscriberId: number, totemId: number): Promise<boolean> {
    try {
      // Buscar publisher do totem
      const totem = await this.db.findFirst(`
        SELECT t.totem_id, l.publisher_id
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        WHERE t.totem_id = $1 AND t.is_active = true
      `, [totemId]);

      if (!totem || !totem.publisher_id) {
        return false;
      }

      const publisherId = totem.publisher_id;

      // Verificar acesso via subscriber_publisher_access
      const hasAccess = await this.db.findFirst(`
        SELECT 1
        FROM subscriber_publisher_access spa
        WHERE spa.subscriber_id = $1
          AND spa.publisher_id = $2
          AND spa.is_active = true
          AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
          AND spa.revoked_at IS NULL
      `, [subscriberId, publisherId]);

      return !!hasAccess;
    } catch (error: any) {
      await logError('Erro ao validar acesso a totem', error, { subscriberId, totemId });
      return false;
    }
  }

  /**
   * Obter estatísticas de um subscriber
   */
  async getSubscriberStats(subscriberId: number): Promise<{
    localsCount: number;
    totemsCount: number;
    smartTvsCount: number;
    activeCampaignsCount: number;
    onlineTotems: number;
    playingTvs: number;
    media_count: number;
    playlist_count: number;
    campaign_count: number;
    campaign_direct_media_count: number;
    campaign_playlist_count: number;
    campaign_playlist_media_count: number;
    campaign_total_media_count: number;
    playlist_media_count: number;
    storage_used_gb: number;
    storage_limit_gb?: number;
    plan_limits?: {
      medias?: number;
      playlists?: number;
      campaigns?: number;
      storage_gb?: number;
      totems?: number;
    };
  }> {
    try {
      // Subdomínio/Contrato: Subscriber acessa publishers via subscriber_publisher_access.
      // Portanto, locals/totems/smart_tvs devem ser contados via publishers acessíveis, e não por locals.subscriber_id (que não existe no schema v2).
      const publisherAccessCte = `
        WITH pubs AS (
          SELECT spa.publisher_id
          FROM subscriber_publisher_access spa
          WHERE spa.subscriber_id = $1
            AND spa.is_active = true
            AND spa.revoked_at IS NULL
            AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
        )
      `;

      // Contar locals
      const localsCountResult = await this.db.findFirst(`
        ${publisherAccessCte}
        SELECT COUNT(*) as count
        FROM locals l
        JOIN pubs p ON l.publisher_id = p.publisher_id
        WHERE l.is_active = true
      `, [subscriberId]);

      // Contar totems
      const totemsCountResult = await this.db.findFirst(`
        ${publisherAccessCte}
        SELECT COUNT(*) as count
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        JOIN pubs p ON l.publisher_id = p.publisher_id
        WHERE t.is_active = true
      `, [subscriberId]);

      // Contar smart TVs
      const smartTvsCountResult = await this.db.findFirst(`
        ${publisherAccessCte}
        SELECT COUNT(*) as count
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        JOIN pubs p ON l.publisher_id = p.publisher_id
        WHERE st.is_active = true
      `, [subscriberId]);

      // Contar campanhas activas (mesmas regras da listagem / execução)
      const campaignsCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM campaigns c
        WHERE c.subscriber_id = $1 
          AND ${ACTIVE_CAMPAIGN_SQL}
      `, [subscriberId]);

      const campaignDirectMediaResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM campaigns c
        JOIN campaign_medias cm ON cm.campaign_id = c.campaign_id AND cm.is_active = true
        JOIN medias m ON m.media_id = cm.media_id AND m.is_active = true
        WHERE c.subscriber_id = $1 AND ${ACTIVE_CAMPAIGN_SQL}
      `, [subscriberId]);

      const campaignPlaylistMediaResult = await this.db.findFirst(`
        SELECT
          COUNT(DISTINCT cp.playlist_id) as playlist_count,
          COUNT(DISTINCT pi.media_id) as media_count
        FROM campaigns c
        JOIN campaign_playlists cp ON cp.campaign_id = c.campaign_id AND cp.is_active = true
        JOIN playlists p ON p.playlist_id = cp.playlist_id AND p.is_active = true
        JOIN playlist_items pi ON pi.playlist_id = p.playlist_id AND COALESCE(pi.is_active, true) = true
        JOIN medias m ON m.media_id = pi.media_id AND m.is_active = true
        WHERE c.subscriber_id = $1 AND ${ACTIVE_CAMPAIGN_SQL}
      `, [subscriberId]);

      const playlistMediaResult = await this.db.findFirst(`
        SELECT COUNT(DISTINCT pi.media_id) as count
        FROM playlists p
        JOIN playlist_items pi ON pi.playlist_id = p.playlist_id AND COALESCE(pi.is_active, true) = true
        JOIN medias m ON m.media_id = pi.media_id AND m.is_active = true
        WHERE p.subscriber_id = $1 AND p.is_active = true
      `, [subscriberId]);

      const campaignTotalMediaResult = await this.db.findFirst(`
        SELECT COUNT(DISTINCT media_id) as count
        FROM (
          SELECT m.media_id
          FROM campaigns c
          JOIN campaign_medias cm ON cm.campaign_id = c.campaign_id AND cm.is_active = true
          JOIN medias m ON m.media_id = cm.media_id AND m.is_active = true
          WHERE c.subscriber_id = $1 AND ${ACTIVE_CAMPAIGN_SQL}
          UNION
          SELECT m.media_id
          FROM campaigns c
          JOIN campaign_playlists cp ON cp.campaign_id = c.campaign_id AND cp.is_active = true
          JOIN playlists p ON p.playlist_id = cp.playlist_id AND p.is_active = true
          JOIN playlist_items pi ON pi.playlist_id = p.playlist_id AND COALESCE(pi.is_active, true) = true
          JOIN medias m ON m.media_id = pi.media_id AND m.is_active = true
          WHERE c.subscriber_id = $1 AND ${ACTIVE_CAMPAIGN_SQL}
        ) u
      `, [subscriberId]);

      // Contar totens online
      const onlineTotemsResult = await this.db.findFirst(`
        ${publisherAccessCte}
        SELECT COUNT(*) as count
        FROM totems t
        JOIN locals l ON t.local_id = l.local_id
        JOIN pubs p ON l.publisher_id = p.publisher_id
        WHERE t.is_active = true 
          AND COALESCE(t.status, 'offline') = 'online'
      `, [subscriberId]);

      // Contar smart TVs reproduzindo
      const playingTvsResult = await this.db.findFirst(`
        ${publisherAccessCte}
        SELECT COUNT(*) as count
        FROM smart_tvs st
        JOIN totems t ON st.totem_id = t.totem_id
        JOIN locals l ON t.local_id = l.local_id
        JOIN pubs p ON l.publisher_id = p.publisher_id
        WHERE st.is_active = true 
          AND COALESCE(st.status, 'offline') = 'playing'
      `, [subscriberId]);

      // Contar mídias
      const mediaCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM medias
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);

      // Contar playlists
      const playlistCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count
        FROM playlists
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);

      // Obter storage usado
      const storageResult = await this.db.findFirst(`
        SELECT COALESCE(SUM(file_size_bytes), 0) as total_bytes
        FROM medias
        WHERE subscriber_id = $1 AND is_active = true
      `, [subscriberId]);
      const storageUsedGB = storageResult?.total_bytes ? parseFloat(storageResult.total_bytes) / (1024 * 1024 * 1024) : 0;

      // Obter limites do plano
      const maxLimits = await this.getMaxLimits(subscriberId);
      const storageLimitGB = maxLimits.storage_gb;

      return {
        localsCount: parseInt(localsCountResult?.count || '0'),
        totemsCount: parseInt(totemsCountResult?.count || '0'),
        smartTvsCount: parseInt(smartTvsCountResult?.count || '0'),
        activeCampaignsCount: parseInt(campaignsCountResult?.count || '0'),
        onlineTotems: parseInt(onlineTotemsResult?.count || '0'),
        playingTvs: parseInt(playingTvsResult?.count || '0'),
        media_count: parseInt(mediaCountResult?.count || '0'),
        playlist_count: parseInt(playlistCountResult?.count || '0'),
        campaign_count: parseInt(campaignsCountResult?.count || '0'),
        campaign_direct_media_count: parseInt(campaignDirectMediaResult?.count || '0'),
        campaign_playlist_count: parseInt(campaignPlaylistMediaResult?.playlist_count || '0'),
        campaign_playlist_media_count: parseInt(campaignPlaylistMediaResult?.media_count || '0'),
        campaign_total_media_count: parseInt(campaignTotalMediaResult?.count || '0'),
        playlist_media_count: parseInt(playlistMediaResult?.count || '0'),
        storage_used_gb: storageUsedGB,
        storage_limit_gb: storageLimitGB,
        plan_limits: {
          medias: maxLimits.medias,
          playlists: maxLimits.playlists,
          campaigns: maxLimits.campaigns,
          storage_gb: maxLimits.storage_gb,
          totems: maxLimits.totems,
        },
      };
    } catch (error: any) {
      await logError('Erro ao buscar estatísticas do subscriber', error, { subscriberId });
      throw new Error('Erro interno do servidor');
    }
  }
}

// Instância global do serviço
let subscriberServiceInstance: SubscriberService;

export function getSubscriberService(): SubscriberService {
  if (!subscriberServiceInstance) {
    subscriberServiceInstance = new SubscriberService();
  }
  return subscriberServiceInstance;
}

