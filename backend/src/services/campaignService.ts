/**
 * Campaign Service - Smart Signage v2.0
 * Serviço de gerenciamento de campanhas
 */

import { getDatabase } from '../config/database';
import { transaction } from '../config/database-pg';
import { AuditService } from './auditService';
import { logError, logDebug, logInfo } from '../utils/loggerHelper';
import { getCacheService } from './cacheService';
import { getSubscriberAccessServiceInstance } from './subscriberAccessService';
import { getSubscriberService } from './subscriberService';
import type { PoolClient } from 'pg';
import { dateToYmd, todayYmd } from '../utils/businessDate';

const CAMPAIGN_START_BEFORE_CREATED_MSG =
  'Data de início não pode ser anterior à data de criação da campanha.';

function assertCampaignStartNotBeforeYmd(startYmd: string, minYmd: string): void {
  if (!startYmd || !minYmd) return;
  if (startYmd < minYmd) {
    throw new Error(CAMPAIGN_START_BEFORE_CREATED_MSG);
  }
}

export interface CreateCampaignRequest {
  subscriberId: number; // subscriber_id explícito
  contractId?: number; // ⭐ NOVO: Contrato vinculado (opcional, mas recomendado para execução)
  title: string;
  categorySegment?: string; // Categoria/segmento (para agrupamento/observabilidade)
  description?: string;
  campaignType?: string;
  priority?: number;
  commercialTier?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: string[];
  timezone?: string;
  status?: string;
  isActive?: boolean;
  publisherIds?: number[];
  playlistIds?: number[];
  mediaIds?: number[];
}

export interface UpdateCampaignRequest {
  title?: string;
  categorySegment?: string; // Categoria/segmento
  description?: string;
  campaignType?: string;
  priority?: number;
  contractId?: number; // ⭐ NOVO: Contrato vinculado
  commercialTier?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: string[];
  timezone?: string;
  status?: string;
  isActive?: boolean;
  publisherIds?: number[];
  playlistIds?: number[];
  mediaIds?: number[];
  totemIds?: number[];
}

export interface CampaignResponse {
  id: number;
  subscriberId: number;
  contractId?: number; // ⭐ NOVO: Contrato vinculado
  title: string;
  categorySegment?: string;
  description?: string;
  campaignType: string;
  priority: number;
  commercialTier?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek: string[];
  timezone?: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  contractNumber?: string; // Dados do contrato
  contractTitle?: string;
  planName?: string;
  publisherIds?: number[];
  publisherNames?: string[];
  playlistIds?: number[];
  playlistNames?: string[];
  totemIds?: number[];
  totemCount?: number;
  playlistCount?: number;
  mediaCount?: number;
  totalDuration?: number;
  isScheduled?: boolean;
  isExpired?: boolean;
  isActiveNow?: boolean;
}

export interface CampaignStats {
  total: number;
  active: number;
  paused: number;
  finished: number;
  draft: number;
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  // Estatísticas agregadas por subscriber
  bySubscriber: { subscriberId: number; subscriberName: string; count: number }[];
  recentActivity: {
    newCampaigns: number;
    activated: number;
    paused: number;
    finished: number;
  };
}

export interface CampaignTotemRequest {
  totemId: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  config?: any;
}

export class CampaignService {
  private get db() {
    return getDatabase();
  }

  private get cache() {
    return getCacheService();
  }
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  /**
   * Lista campanhas com paginação e filtros
   */
  async getCampaigns(
    page: number = 1,
    limit: number = 20,
    filters: {
      clientId?: number; // DEPRECATED
      subscriberId?: number;
      /**
       * Restringe a campanhas que o publisher enxerga: `campaign_publishers` ativo;
       * ou, com `campaigns.contract_id`, o contrato dessa campanha com plano que inclui o publisher;
       * ou, sem `contract_id` (legado), qualquer contrato ativo do assinante com plano que inclua o publisher.
       */
      scopedPublisherId?: number;
      status?: string;
      campaignType?: string;
      isActive?: boolean;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      createdFrom?: string;
      createdTo?: string;
    } = {}
  ): Promise<{ campaigns: CampaignResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      let paramIndex = 1;
      if (filters.subscriberId) {
        // Filtro por subscriber
        whereClause += ` AND c.subscriber_id = $${paramIndex}`;
        params.push(filters.subscriberId);
        paramIndex++;
      } else if (filters.clientId) {
        // DEPRECATED: Filtro por clientId (compatibilidade)
        whereClause += ` AND c.subscriber_id = $${paramIndex}`;
        params.push(filters.clientId);
        paramIndex++;
      }

      if (filters.scopedPublisherId != null) {
        const pid = filters.scopedPublisherId;
        whereClause += ` AND (
          EXISTS (
            SELECT 1 FROM campaign_publishers cp
            WHERE cp.campaign_id = c.campaign_id
              AND cp.publisher_id = $${paramIndex}
              AND COALESCE(cp.is_active, true) = true
          )
          OR (
            c.contract_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM subscriber_contracts sc
              INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
                AND ppa.publisher_id = $${paramIndex + 1}
                AND ppa.is_allowed = true
                AND COALESCE(ppa.is_active, true) = true
              WHERE sc.contract_id = c.contract_id
                AND sc.subscriber_id = c.subscriber_id
                AND sc.status = 'active'
                AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
                AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
            )
          )
          OR (
            c.contract_id IS NULL
            AND EXISTS (
              SELECT 1
              FROM subscriber_contracts sc
              INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
                AND ppa.publisher_id = $${paramIndex + 2}
                AND ppa.is_allowed = true
                AND COALESCE(ppa.is_active, true) = true
              WHERE sc.subscriber_id = c.subscriber_id
                AND sc.status = 'active'
                AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
                AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
            )
          )
        )`;
        params.push(pid, pid, pid);
        paramIndex += 3;
      }

      if (filters.status) {
        whereClause += ` AND c.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.campaignType) {
        whereClause += ` AND c.campaign_type = $${paramIndex}`;
        params.push(filters.campaignType);
        paramIndex++;
      }

      if (filters.isActive !== undefined) {
        whereClause += ` AND c.is_active = $${paramIndex}`;
        params.push(filters.isActive);
        paramIndex++;
      }

      if (filters.search) {
        whereClause += ` AND (c.title ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex + 1})`;
        params.push(`%${filters.search}%`, `%${filters.search}%`);
        paramIndex += 2;
      }

      // Filtros de data de criação
      if (filters.createdFrom) {
        whereClause += ` AND c.created_at >= $${paramIndex}`;
        params.push(filters.createdFrom);
        paramIndex++;
      }
      if (filters.createdTo) {
        whereClause += ` AND c.created_at <= $${paramIndex}`;
        params.push(filters.createdTo);
        paramIndex++;
      }

      // Validação de campo de ordenação
      const validSortFields: { [key: string]: string } = {
        'title': 'c.title',
        'created_at': 'c.created_at',
        'updated_at': 'c.updated_at',
        'priority': 'c.priority',
        'start_date': 'c.start_date',
        'end_date': 'c.end_date'
      };
      const sortBy = filters.sortBy || 'created_at';
      const sortField = validSortFields[sortBy] || 'c.created_at';
      const orderDirection = (filters.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Buscar campanhas (usar subscriberId em vez de clientId para consistência)
      const campaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.subscriber_id as "subscriberId",
          c.subscriber_id as "clientId", -- Mantido para compatibilidade
          c.contract_id as "contractId",
          c.title,
          c.category_segment as "categorySegment",
          c.description,
          c.campaign_type as "campaignType",
          c.priority,
          c.commercial_tier as "commercialTier",
          c.start_date as "startDate",
          c.end_date as "endDate",
          c.start_time as "startTime",
          c.end_time as "endTime",
          c.days_of_week as "daysOfWeek",
          c.timezone,
          c.status,
          c.is_active as "isActive",
          c.created_at as "createdAt",
          c.updated_at as "updatedAt",
          s.name as "clientName",
          sc.contract_number as "contractNumber",
          sc.title as "contractTitle",
          p.name as "planName"
        FROM campaigns c
        LEFT JOIN subscribers s ON c.subscriber_id = s.subscriber_id
        LEFT JOIN subscriber_contracts sc ON c.contract_id = sc.contract_id
        LEFT JOIN plans p ON sc.plan_id = p.plan_id
        ${whereClause}
        ORDER BY ${sortField} ${orderDirection}, c.priority DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM campaigns c
        ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Otimização: Buscar relacionamentos em batch para evitar N+1 queries
      const campaignIds = campaigns.map(c => c.id);
      
      if (campaignIds.length === 0) {
        return {
          campaigns: [],
          total,
          page,
          limit
        };
      }

      // Buscar todos os publishers de uma vez (batch query)
      const allPublishers = await this.db.findMany(`
        SELECT 
          cp.campaign_id,
          cp.publisher_id,
          p.name as publisher_name
        FROM campaign_publishers cp
        JOIN publishers p ON cp.publisher_id = p.publisher_id
        WHERE cp.campaign_id = ANY($1::int[]) AND cp.is_active = true
        ORDER BY cp.campaign_id, p.name
      `, [campaignIds]);

      // Buscar todas as playlists de uma vez (batch query)
      const allPlaylists = await this.db.findMany(`
        SELECT 
          cp.campaign_id,
          cp.playlist_id,
          p.name as playlist_name,
          cp.priority
        FROM campaign_playlists cp
        JOIN playlists p ON cp.playlist_id = p.playlist_id
        WHERE cp.campaign_id = ANY($1::int[]) AND cp.is_active = true
        ORDER BY cp.campaign_id, cp.priority DESC, p.name
      `, [campaignIds]);

      // Buscar todas as mídias de uma vez (batch query)
      const allMedias = await this.db.findMany(`
        SELECT 
          cm.campaign_id,
          cm.media_id,
          m.name as media_name,
          m.file_name,
          m.media_type,
          cm.order_index,
          cm.priority
        FROM campaign_medias cm
        JOIN medias m ON cm.media_id = m.media_id
        WHERE cm.campaign_id = ANY($1::int[]) AND cm.is_active = true
        ORDER BY cm.campaign_id, cm.order_index, cm.priority
      `, [campaignIds]);

      // Criar mapas para acesso rápido
      const publishersMap = new Map<number, Array<{ publisher_id: number; publisher_name: string }>>();
      const playlistsMap = new Map<number, Array<{ playlist_id: number; playlist_name: string }>>();
      const mediasMap = new Map<number, Array<{ media_id: number; media_name: string | null; file_name: string }>>();

      allPublishers.forEach(p => {
        if (!publishersMap.has(p.campaign_id)) {
          publishersMap.set(p.campaign_id, []);
        }
        publishersMap.get(p.campaign_id)!.push({ publisher_id: p.publisher_id, publisher_name: p.publisher_name });
      });

      allPlaylists.forEach(p => {
        if (!playlistsMap.has(p.campaign_id)) {
          playlistsMap.set(p.campaign_id, []);
        }
        playlistsMap.get(p.campaign_id)!.push({ playlist_id: p.playlist_id, playlist_name: p.playlist_name });
      });

      allMedias.forEach(m => {
        if (!mediasMap.has(m.campaign_id)) {
          mediasMap.set(m.campaign_id, []);
        }
        mediasMap.get(m.campaign_id)!.push({ 
          media_id: m.media_id, 
          media_name: m.media_name, 
          file_name: m.file_name 
        });
      });

      // Totens explicitamente associados (lista global / modal só leitura)
      const allCampaignTotems = await this.db.findMany(`
        SELECT campaign_id, totem_id
        FROM campaign_totems
        WHERE campaign_id = ANY($1::int[])
          AND COALESCE(is_active, true) = true
        ORDER BY campaign_id, totem_id
      `, [campaignIds]);

      const totemIdsByCampaign = new Map<number, number[]>();
      allCampaignTotems.forEach((row: any) => {
        const cid = Number(row.campaign_id);
        const tid = Number(row.totem_id);
        if (Number.isNaN(cid) || Number.isNaN(tid)) return;
        if (!totemIdsByCampaign.has(cid)) totemIdsByCampaign.set(cid, []);
        totemIdsByCampaign.get(cid)!.push(tid);
      });

      // Combinar dados das campanhas com relacionamentos (paralelo para stats)
      const campaignsWithStats = await Promise.all(
        campaigns.map(async (campaign) => {
          const stats = await this.getCampaignStats(campaign.id);
          const scheduleInfo = this.getScheduleInfo(campaign);
          
          const publishers = publishersMap.get(campaign.id) || [];
          const playlists = playlistsMap.get(campaign.id) || [];
          const directMedias = mediasMap.get(campaign.id) || [];

          return { 
            ...campaign, 
            ...stats, 
            ...scheduleInfo,
            publisherIds: publishers.map(p => p.publisher_id),
            publisherNames: publishers.map(p => p.publisher_name),
            playlistIds: playlists.map(p => p.playlist_id),
            playlistNames: playlists.map(p => p.playlist_name),
            mediaIds: directMedias.map(m => m.media_id),
            mediaNames: directMedias.map(m => m.media_name || m.file_name),
            totemIds: totemIdsByCampaign.get(campaign.id) || []
          };
        })
      );

      return {
        campaigns: campaignsWithStats,
        total,
        page,
        limit
      };

    } catch (error: any) {
      await logError('Erro ao buscar campanhas', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca campanha por ID usando client específico (para transações)
   */
  private async getCampaignByIdWithClient(client: PoolClient, campaignId: number): Promise<CampaignResponse | null> {
    const result = await client.query(`
      SELECT 
        c.campaign_id as id,
        c.subscriber_id as "subscriberId",
        c.subscriber_id as "clientId",
        c.contract_id as "contractId",
        c.title,
        c.category_segment as "categorySegment",
        c.description,
        c.campaign_type as "campaignType",
        c.priority,
        c.commercial_tier as "commercialTier",
        c.start_date as "startDate",
        c.end_date as "endDate",
        c.start_time as "startTime",
        c.end_time as "endTime",
        c.days_of_week as "daysOfWeek",
        c.timezone,
        c.status,
        c.is_active as "isActive",
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        s.name as "clientName",
        sc.contract_number as "contractNumber",
        sc.title as "contractTitle",
        p.name as "planName"
      FROM campaigns c
      LEFT JOIN subscribers s ON c.subscriber_id = s.subscriber_id
      LEFT JOIN subscriber_contracts sc ON c.contract_id = sc.contract_id
      LEFT JOIN plans p ON sc.plan_id = p.plan_id
      WHERE c.campaign_id = $1
    `, [campaignId]);

    if (result.rows.length === 0) {
      return null;
    }

    const campaign = result.rows[0];
    
    // Buscar publishers associados (dentro da transação)
    const publishersResult = await client.query(`
      SELECT 
        cp.publisher_id,
        p.name as publisher_name
      FROM campaign_publishers cp
      JOIN publishers p ON cp.publisher_id = p.publisher_id
      WHERE cp.campaign_id = $1 AND cp.is_active = true
      ORDER BY p.name
    `, [campaignId]);

    // Buscar playlists associadas (dentro da transação)
    const playlistsResult = await client.query(`
      SELECT 
        cp.playlist_id,
        pl.name as playlist_name
      FROM campaign_playlists cp
      JOIN playlists pl ON cp.playlist_id = pl.playlist_id
      WHERE cp.campaign_id = $1 AND cp.is_active = true
      ORDER BY pl.name
    `, [campaignId]);

    // Buscar mídias associadas (dentro da transação)
    const mediasResult = await client.query(`
      SELECT 
        cm.media_id,
        m.name as media_name
      FROM campaign_medias cm
      JOIN medias m ON cm.media_id = m.media_id
      WHERE cm.campaign_id = $1 AND cm.is_active = true
      ORDER BY cm.order_index
    `, [campaignId]);

    const scheduleInfo = this.getScheduleInfo(campaign);
    
    return {
      ...campaign,
      publishers: publishersResult.rows.map((p: any) => ({
        id: p.publisher_id,
        name: p.publisher_name
      })),
      playlists: playlistsResult.rows.map((p: any) => ({
        id: p.playlist_id,
        name: p.playlist_name
      })),
      medias: mediasResult.rows.map((m: any) => ({
        id: m.media_id,
        name: m.media_name
      })),
      ...scheduleInfo
    };
  }

  /**
   * Mesmas regras de `getCampaigns` com `scopedPublisherId`: publishers, contrato da campanha, ou legado sem `contract_id`.
   */
  async isCampaignVisibleToPublisher(campaignId: number, publisherId: number): Promise<boolean> {
    try {
      const row = await this.db.findFirst(
        `
        SELECT 1 AS ok
        FROM campaigns c
        WHERE c.campaign_id = $1
        AND (
          EXISTS (
            SELECT 1 FROM campaign_publishers cp
            WHERE cp.campaign_id = c.campaign_id
              AND cp.publisher_id = $2
              AND COALESCE(cp.is_active, true) = true
          )
          OR (
            c.contract_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM subscriber_contracts sc
              INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
                AND ppa.publisher_id = $2
                AND ppa.is_allowed = true
                AND COALESCE(ppa.is_active, true) = true
              WHERE sc.contract_id = c.contract_id
                AND sc.subscriber_id = c.subscriber_id
                AND sc.status = 'active'
                AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
                AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
            )
          )
          OR (
            c.contract_id IS NULL
            AND EXISTS (
              SELECT 1
              FROM subscriber_contracts sc
              INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
                AND ppa.publisher_id = $2
                AND ppa.is_allowed = true
                AND COALESCE(ppa.is_active, true) = true
              WHERE sc.subscriber_id = c.subscriber_id
                AND sc.status = 'active'
                AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
                AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
            )
          )
        )
        LIMIT 1
      `,
        [campaignId, publisherId]
      );
      return Boolean(row);
    } catch (error: any) {
      await logError('isCampaignVisibleToPublisher', error, { campaignId, publisherId });
      return false;
    }
  }

  /**
   * Busca campanha por ID
   */
  async getCampaignById(campaignId: number): Promise<CampaignResponse | null> {
    try {
      const campaign = await this.db.findFirst(`
        SELECT 
          c.campaign_id as id,
          c.subscriber_id as "subscriberId",
          c.subscriber_id as "clientId", -- Mantido para compatibilidade
          c.contract_id as "contractId",
          c.title,
          c.category_segment as "categorySegment",
          c.description,
          c.campaign_type as "campaignType",
          c.priority,
          c.commercial_tier as "commercialTier",
          c.start_date as "startDate",
          c.end_date as "endDate",
          c.start_time as "startTime",
          c.end_time as "endTime",
          c.days_of_week as "daysOfWeek",
          c.timezone,
          c.status,
          c.is_active as "isActive",
          c.created_at as "createdAt",
          c.updated_at as "updatedAt",
          s.name as "clientName",
          sc.contract_number as "contractNumber",
          sc.title as "contractTitle",
          p.name as "planName"
        FROM campaigns c
        LEFT JOIN subscribers s ON c.subscriber_id = s.subscriber_id
        LEFT JOIN subscriber_contracts sc ON c.contract_id = sc.contract_id
        LEFT JOIN plans p ON sc.plan_id = p.plan_id
        WHERE c.campaign_id = $1
      `, [campaignId]);

      if (!campaign) {
        return null;
      }

      // Buscar publishers associados
      const publishers = await this.db.findMany(`
        SELECT 
          cp.publisher_id,
          p.name as publisher_name
        FROM campaign_publishers cp
        JOIN publishers p ON cp.publisher_id = p.publisher_id
        WHERE cp.campaign_id = $1 AND cp.is_active = true
        ORDER BY p.name
      `, [campaignId]);

      campaign.publisherIds = publishers.map(p => p.publisher_id);
      campaign.publisherNames = publishers.map(p => p.publisher_name);

      // Buscar playlists associadas
      const playlists = await this.db.findMany(`
        SELECT 
          cp.playlist_id,
          p.name as playlist_name
        FROM campaign_playlists cp
        JOIN playlists p ON cp.playlist_id = p.playlist_id
        WHERE cp.campaign_id = $1 AND cp.is_active = true
        ORDER BY cp.priority, p.name
      `, [campaignId]);

      campaign.playlistIds = playlists.map(p => p.playlist_id);
      campaign.playlistNames = playlists.map(p => p.playlist_name);

      // Buscar mídias diretamente associadas
      const directMedias = await this.db.findMany(`
        SELECT 
          cm.media_id,
          m.name as media_name,
          m.file_name,
          m.media_type,
          m.duration_seconds
        FROM campaign_medias cm
        JOIN medias m ON cm.media_id = m.media_id
        WHERE cm.campaign_id = $1 AND cm.is_active = true
        ORDER BY cm.order_index, cm.priority
      `, [campaignId]);

      campaign.mediaIds = directMedias.map(m => m.media_id);
      campaign.mediaNames = directMedias.map(m => m.media_name || m.file_name);

      // Totens explicitamente associados (campaign_totems) — todos os vínculos, para o editor não “esvaziar”
      // após cascade (is_active=false). Execução/dispatcher continua filtrando ct.is_active nas queries próprias.
      const totemRows = await this.db.findMany(`
        SELECT totem_id
        FROM campaign_totems
        WHERE campaign_id = $1
        ORDER BY totem_id
      `, [campaignId]);
      campaign.totemIds = totemRows.map((r: any) => Number(r.totem_id));

      // Buscar estatísticas
      const stats = await this.getCampaignStats(campaignId);
      const scheduleInfo = this.getScheduleInfo(campaign);
      return { ...campaign, ...stats, ...scheduleInfo };

    } catch (error: any) {
      await logError('Erro ao buscar campanha', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Métodos auxiliares privados para associações dentro de transações
   */
  private async associatePublishersWithClient(
    client: PoolClient,
    campaignId: number,
    publisherIds: number[],
    subscriberId: number,
    userId: number
  ): Promise<void> {
    // Remover associações existentes
    await client.query(`
      DELETE FROM campaign_publishers WHERE campaign_id = $1
    `, [campaignId]);

    // Criar novas associações
    for (const publisherId of publisherIds) {
      const accessService = getSubscriberAccessServiceInstance();
      const hasAccessNow = await accessService.hasAccess(subscriberId, publisherId);
      const accessDetails = await accessService.getAccessDetails(subscriberId, publisherId);
      
      const metadata = {
        snapshotVersion: 1,
        takenAt: new Date().toISOString(),
        takenByUserId: userId,
        campaignId,
        publisherId,
        subscriberId,
        accessAtThatTime: accessDetails
          ? {
              accessId: accessDetails.accessId,
              accessType: accessDetails.accessType,
              contractId: accessDetails.contractId,
              planId: accessDetails.planId,
              grantedAt: accessDetails.grantedAt,
              expiresAt: accessDetails.expiresAt,
              isActive: accessDetails.isActive
            }
          : null,
        validation: {
          validNow: hasAccessNow,
          reason: hasAccessNow ? 'has_access_now' : 'no_access_now'
        }
      };

      await client.query(`
        INSERT INTO campaign_publishers (
          campaign_id,
          publisher_id,
          is_active,
          metadata
        )
        VALUES ($1, $2, true, $3::jsonb)
        ON CONFLICT (campaign_id, publisher_id)
        DO UPDATE SET
          is_active = true,
          metadata = EXCLUDED.metadata,
          updated_at = CURRENT_TIMESTAMP
      `, [campaignId, publisherId, JSON.stringify(metadata)]);
    }
  }

  private async associatePlaylistsWithClient(
    client: PoolClient,
    campaignId: number,
    playlistIds: number[],
    _campaignSubscriberId: number,
    userId: number,
    playlistsInfo: Array<{ playlist_id: number; subscriber_id: number; name: string }>
  ): Promise<void> {
    // Remover associações existentes
    await client.query(`
      DELETE FROM campaign_playlists WHERE campaign_id = $1
    `, [campaignId]);

    // Criar novas associações
    for (const playlistId of playlistIds) {
      const playlist = playlistsInfo.find(p => p.playlist_id === playlistId);
      const metadata = {
        snapshotVersion: 1,
        takenAt: new Date().toISOString(),
        takenByUserId: userId,
        campaignId,
        playlistId,
        playlistSnapshot: {
          playlistId,
          name: playlist?.name,
          subscriberId: playlist?.subscriber_id,
          isActive: true
        },
        validation: {
          validNow: true,
          reason: 'playlist_belongs_to_subscriber'
        }
      };

      await client.query(`
        INSERT INTO campaign_playlists (campaign_id, playlist_id, priority, is_active, metadata)
        VALUES ($1, $2, 1, true, $3::jsonb)
        ON CONFLICT (campaign_id, playlist_id) DO UPDATE
        SET is_active = true, priority = 1, metadata = EXCLUDED.metadata
      `, [campaignId, playlistId, JSON.stringify(metadata)]);
    }
  }

  private async associateMediasWithClient(
    client: PoolClient,
    campaignId: number,
    mediaIds: number[],
    _campaignSubscriberId: number,
    userId: number,
    mediasInfo: Array<{ media_id: number; subscriber_id: number; name: string; status: string }>
  ): Promise<void> {
    // Remover associações existentes
    await client.query(`
      DELETE FROM campaign_medias WHERE campaign_id = $1
    `, [campaignId]);

    // Criar novas associações
    for (let i = 0; i < mediaIds.length; i++) {
      const mediaId = mediaIds[i];
      const media = mediasInfo.find(m => m.media_id === mediaId);
      const metadata = {
        snapshotVersion: 1,
        takenAt: new Date().toISOString(),
        takenByUserId: userId,
        campaignId,
        mediaId,
        orderIndex: i,
        mediaSnapshot: {
          mediaId,
          name: media?.name,
          subscriberId: media?.subscriber_id,
          status: media?.status,
          isActive: true
        },
        validation: {
          validNow: true,
          reason: 'media_belongs_to_subscriber'
        }
      };

      await client.query(`
        INSERT INTO campaign_medias (campaign_id, media_id, order_index, priority, is_active, metadata)
        VALUES ($1, $2, $3, 1, true, $4::jsonb)
        ON CONFLICT (campaign_id, media_id) DO UPDATE
        SET is_active = true, order_index = $3, priority = 1, updated_at = CURRENT_TIMESTAMP, metadata = EXCLUDED.metadata
      `, [campaignId, mediaId, i, JSON.stringify(metadata)]);
    }
  }

  /**
   * Cria nova campanha (com transação para garantir consistência)
   */
  async createCampaign(data: CreateCampaignRequest, createdBy: number): Promise<CampaignResponse> {
    // Validações prévias (fora da transação - são apenas leituras)
    const {
      subscriberId,
      contractId,
      title,
      description,
      campaignType = 'general',
      priority = 1,
      commercialTier = 'standard',
      startDate,
      endDate,
      startTime,
      endTime,
      daysOfWeek = [],
      timezone = 'America/Sao_Paulo',
      status = 'draft',
      isActive = true
    } = data;

    // Validar campos obrigatórios
    if (!subscriberId) {
      throw new Error('subscriberId é obrigatório');
    }

    if (!title || title.trim() === '') {
      throw new Error('title é obrigatório');
    }

    const createdMinYmd = todayYmd();
    let resolvedStartDate = startDate ? dateToYmd(startDate) : createdMinYmd;
    if (!resolvedStartDate) {
      resolvedStartDate = createdMinYmd;
    }
    assertCampaignStartNotBeforeYmd(resolvedStartDate, createdMinYmd);

    // Verificar se subscriber existe
    const subscriber = await this.db.findFirst(`
      SELECT subscriber_id FROM subscribers WHERE subscriber_id = $1 AND COALESCE(is_active, true) = true
    `, [subscriberId]);

    if (!subscriber) {
      throw new Error('Subscriber (anunciante) não encontrado ou inativo');
    }

    // Validar contrato se fornecido
    if (contractId) {
      const contract = await this.db.findFirst(`
        SELECT 
          contract_id, 
          subscriber_id, 
          status, 
          start_date, 
          end_date
        FROM subscriber_contracts 
        WHERE contract_id = $1 AND subscriber_id = $2
      `, [contractId, subscriberId]);

      if (!contract) {
        throw new Error('Contrato não encontrado ou não pertence a este subscriber');
      }

      if (contract.status !== 'active') {
        throw new Error('Contrato não está ativo. Apenas contratos ativos podem ser vinculados a campanhas.');
      }

      const now = new Date();
      const startDateObj = new Date(contract.start_date);
      const endDateObj = contract.end_date ? new Date(contract.end_date) : null;

      if (startDateObj > now) {
        throw new Error('Contrato ainda não está no período válido (start_date no futuro)');
      }

      if (endDateObj && endDateObj < now) {
        throw new Error('Contrato está expirado (end_date no passado)');
      }
    }

    // Validar acesso a publishers se publishers foram fornecidos
    if (data.publisherIds && Array.isArray(data.publisherIds) && data.publisherIds.length > 0) {
      const accessService = getSubscriberAccessServiceInstance();
      const validation = await accessService.validateCampaignPublishers(subscriberId, data.publisherIds);
      
      if (!validation.valid) {
        throw new Error(
          `Subscriber não tem acesso aos seguintes publishers: ${validation.invalidPublishers.join(', ')}. ` +
          `Verifique o contrato e plano do subscriber.`
        );
      }
    }

    // Validar e buscar informações de playlists se fornecidas
    let playlistsInfo: Array<{ playlist_id: number; subscriber_id: number; name: string }> = [];
    if (data.playlistIds && Array.isArray(data.playlistIds) && data.playlistIds.length > 0) {
      playlistsInfo = await this.db.findMany(`
        SELECT playlist_id, subscriber_id, name
        FROM playlists
        WHERE playlist_id = ANY($1::int[])
        AND is_active = true
      `, [data.playlistIds]);

      if (playlistsInfo.length !== data.playlistIds.length) {
        const foundIds = playlistsInfo.map(p => p.playlist_id);
        const missingIds = data.playlistIds.filter(id => !foundIds.includes(id));
        throw new Error(`Playlists não encontradas ou inativas: ${missingIds.join(', ')}`);
      }

      const invalidPlaylists = playlistsInfo.filter(p => p.subscriber_id !== subscriberId);
      if (invalidPlaylists.length > 0) {
        const invalidNames = invalidPlaylists.map(p => `${p.name} (ID: ${p.playlist_id})`).join(', ');
        throw new Error(
          `As seguintes playlists pertencem a outro subscriber: ${invalidNames}. ` +
          `A campanha pertence ao subscriber ${subscriberId}, mas essas playlists pertencem a outros subscribers.`
        );
      }
    }

    // Validar e buscar informações de mídias se fornecidas
    let mediasInfo: Array<{ media_id: number; subscriber_id: number; name: string; status: string }> = [];
    if (data.mediaIds && Array.isArray(data.mediaIds) && data.mediaIds.length > 0) {
      mediasInfo = await this.db.findMany(`
        SELECT media_id, subscriber_id, name, status
        FROM medias
        WHERE media_id = ANY($1::int[])
        AND is_active = true
      `, [data.mediaIds]);

      if (mediasInfo.length !== data.mediaIds.length) {
        const foundIds = mediasInfo.map(m => m.media_id);
        const missingIds = data.mediaIds.filter(id => !foundIds.includes(id));
        throw new Error(`Mídias não encontradas ou inativas: ${missingIds.join(', ')}`);
      }

      const invalidMedias = mediasInfo.filter(m => m.subscriber_id !== subscriberId);
      if (invalidMedias.length > 0) {
        const invalidNames = invalidMedias.map(m => `${m.name} (ID: ${m.media_id})`).join(', ');
        throw new Error(
          `As seguintes mídias pertencem a outro subscriber: ${invalidNames}. ` +
          `A campanha pertence ao subscriber ${subscriberId}, mas essas mídias pertencem a outros subscribers.`
        );
      }
    }

    // Executar operações críticas dentro de transação
    return await transaction(async (client) => {
      await logDebug('[CampaignService] Tentando inserir campanha no banco', {
        subscriberId,
        title,
        description,
        campaignType,
        priority,
        startDate: resolvedStartDate,
        endDate,
        status,
        isActive
      });

      // Criar campanha
      const result = await client.query(`
        INSERT INTO campaigns (
          subscriber_id, contract_id, title, category_segment, description, campaign_type, priority,
          commercial_tier, start_date, end_date, start_time, end_time, days_of_week,
          timezone, status, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING campaign_id
      `, [
        subscriberId,
        contractId || null,
        title,
        data.categorySegment || null,
        description,
        campaignType,
        priority,
        commercialTier,
        resolvedStartDate,
        endDate || null,
        startTime || null,
        endTime || null,
        daysOfWeek && daysOfWeek.length > 0 ? JSON.stringify(daysOfWeek) : null,
        timezone,
        status,
        isActive
      ]);

      const insertedCampaign = result.rows[0];
      if (!insertedCampaign?.campaign_id) {
        throw new Error('Erro ao criar campanha: ID não foi retornado pelo banco de dados');
      }

      const campaignId = insertedCampaign.campaign_id;

      // Associar publishers se fornecidos (dentro da transação)
      if (data.publisherIds && Array.isArray(data.publisherIds) && data.publisherIds.length > 0) {
        await this.associatePublishersWithClient(client, campaignId, data.publisherIds, subscriberId, createdBy);
      }

      // Associar playlists se fornecidas (dentro da transação)
      if (data.playlistIds && Array.isArray(data.playlistIds) && data.playlistIds.length > 0) {
        await this.associatePlaylistsWithClient(client, campaignId, data.playlistIds, subscriberId, createdBy, playlistsInfo);
      }

      // Associar mídias diretamente se fornecidas (dentro da transação)
      if (data.mediaIds && Array.isArray(data.mediaIds) && data.mediaIds.length > 0) {
        await this.associateMediasWithClient(client, campaignId, data.mediaIds, subscriberId, createdBy, mediasInfo);
      }

      // Log de auditoria (dentro da transação)
      await client.query(`
        INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, timestamp)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [
        createdBy,
        'created',
        'campaign',
        campaignId,
        JSON.stringify({
          campaignId,
          title,
          subscriberId,
          publisherIds: data.publisherIds || [],
          playlistIds: data.playlistIds || [],
          mediaIds: data.mediaIds || []
        })
      ]);

      // Buscar campanha criada (dentro da transação)
      const newCampaign = await this.getCampaignByIdWithClient(client, campaignId);
      if (!newCampaign) {
        throw new Error('Erro ao buscar campanha criada');
      }

      return newCampaign;
    }).then(async (newCampaign) => {
      // Invalidar cache relacionado (fora da transação - não crítico)
      await this.cache.invalidateEntity('campaign', newCampaign.id).catch(() => {});
      return newCampaign;
    }).catch(async (error: any) => {
      await logError('Erro ao criar campanha', error);
      throw error;
    });
  }

  /**
   * Atualiza campanha
   */
  async updateCampaign(campaignId: number, data: UpdateCampaignRequest, updatedBy: number): Promise<CampaignResponse> {
    try {
      // Verificar se campanha existe
      const existingCampaign = await this.getCampaignById(campaignId);
      if (!existingCampaign) {
        throw new Error('Campanha não encontrada');
      }

      // Construir query de atualização (placeholders PostgreSQL $1, $2, ...)
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.title !== undefined) {
        updates.push(`title = $${paramIndex}`);
        params.push(data.title);
        paramIndex++;
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(data.description);
        paramIndex++;
      }

      if (data.categorySegment !== undefined) {
        updates.push(`category_segment = $${paramIndex}`);
        params.push(data.categorySegment || null);
        paramIndex++;
      }

      if (data.campaignType !== undefined) {
        updates.push(`campaign_type = $${paramIndex}`);
        params.push(data.campaignType);
        paramIndex++;
      }

      if (data.priority !== undefined) {
        updates.push(`priority = $${paramIndex}`);
        params.push(data.priority);
        paramIndex++;
      }

      if (data.contractId !== undefined) {
        // Validar contrato se fornecido
        if (data.contractId !== null) {
          const contract = await this.db.findFirst(`
            SELECT 
              contract_id, 
              subscriber_id, 
              status, 
              start_date, 
              end_date
            FROM subscriber_contracts 
            WHERE contract_id = $1 AND subscriber_id = $2
          `, [data.contractId, existingCampaign.subscriberId]);

          if (!contract) {
            throw new Error('Contrato não encontrado ou não pertence a este subscriber');
          }

          if (contract.status !== 'active') {
            throw new Error('Contrato não está ativo. Apenas contratos ativos podem ser vinculados a campanhas.');
          }

          const now = new Date();
          const startDateObj = new Date(contract.start_date);
          const endDateObj = contract.end_date ? new Date(contract.end_date) : null;

          if (startDateObj > now) {
            throw new Error('Contrato ainda não está no período válido (start_date no futuro)');
          }

          if (endDateObj && endDateObj < now) {
            throw new Error('Contrato está expirado (end_date no passado)');
          }
        }
        updates.push(`contract_id = $${paramIndex}`);
        params.push(data.contractId);
        paramIndex++;
      }

      if (data.commercialTier !== undefined) {
        updates.push(`commercial_tier = $${paramIndex}`);
        params.push(data.commercialTier);
        paramIndex++;
      }

      if (data.timezone !== undefined) {
        updates.push(`timezone = $${paramIndex}`);
        params.push(data.timezone);
        paramIndex++;
      }

      if (data.startDate !== undefined) {
        const createdYmd = dateToYmd(existingCampaign.createdAt);
        const nextStartYmd = data.startDate ? dateToYmd(data.startDate) : '';
        if (nextStartYmd) {
          assertCampaignStartNotBeforeYmd(nextStartYmd, createdYmd);
        }
        updates.push(`start_date = $${paramIndex}`);
        params.push(data.startDate);
        paramIndex++;
      }

      if (data.endDate !== undefined) {
        updates.push(`end_date = $${paramIndex}`);
        params.push(data.endDate);
        paramIndex++;
      }

      if (data.startTime !== undefined) {
        updates.push(`start_time = $${paramIndex}`);
        params.push(data.startTime);
        paramIndex++;
      }

      if (data.endTime !== undefined) {
        updates.push(`end_time = $${paramIndex}`);
        params.push(data.endTime);
        paramIndex++;
      }

      if (data.daysOfWeek !== undefined) {
        updates.push(`days_of_week = $${paramIndex}`);
        params.push(JSON.stringify(data.daysOfWeek));
        paramIndex++;
      }

      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        params.push(data.status);
        paramIndex++;
      }

      if (data.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(data.isActive);
        paramIndex++;
      }

      const hasAssociationWork =
        data.publisherIds !== undefined ||
        data.playlistIds !== undefined ||
        data.mediaIds !== undefined ||
        data.totemIds !== undefined;

      if (updates.length === 0 && !hasAssociationWork) {
        return existingCampaign;
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(campaignId);
        const wherePlaceholder = `$${params.length}`;

        await this.db.executeRaw(
          `UPDATE campaigns SET ${updates.join(', ')} WHERE campaign_id = ${wherePlaceholder}`,
          params
        );
      } else {
        await this.db.executeRaw(
          `UPDATE campaigns SET updated_at = CURRENT_TIMESTAMP WHERE campaign_id = $1`,
          [campaignId]
        );
      }

      // Atualizar publishers se fornecidos
      if (data.publisherIds !== undefined) {
        // Buscar subscriber_id da campanha para validação
        const campaign = await this.db.findFirst(`
          SELECT subscriber_id FROM campaigns WHERE campaign_id = $1
        `, [campaignId]);

        if (campaign) {
          // Política A: manter histórico mesmo que alguns publishers não sejam acessíveis agora.
          // A execução (dispatcher/engine) deve filtrar por acesso vigente.
          await this.associatePublishers(campaignId, data.publisherIds, updatedBy, { allowInvalid: true });
        }
      }

      // Atualizar playlists associadas à campanha (substitui as atuais pelas enviadas)
      if (data.playlistIds !== undefined) {
        const subscriberId = existingCampaign.subscriberId ?? (existingCampaign as any).subscriber_id;
        if (subscriberId != null) {
          await this.associatePlaylists(campaignId, Array.isArray(data.playlistIds) ? data.playlistIds : [], subscriberId, updatedBy);
        }
      }

      // Atualizar mídias individuais associadas à campanha (substitui as atuais pelas enviadas)
      if (data.mediaIds !== undefined) {
        const subscriberId = existingCampaign.subscriberId ?? (existingCampaign as any).subscriber_id;
        if (subscriberId != null) {
          await this.associateMedias(campaignId, Array.isArray(data.mediaIds) ? data.mediaIds : [], subscriberId, updatedBy);
        }
      }

      // Atualizar totems explicitamente associados à campanha (campaign_totems)
      // Regra:
      // - Se totemIds vier undefined: não mexe nas associações atuais
      // - Se vier array (inclusive vazio): sincroniza campaign_totems para bater exatamente com essa lista
      if (data.totemIds !== undefined) {
        const desiredTotemIds = Array.isArray(data.totemIds)
          ? (data.totemIds as unknown[])
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0)
          : [];

        const campRow = await this.db.findFirst(
          `SELECT COALESCE(is_active, true) AS ia FROM campaigns WHERE campaign_id = $1`,
          [campaignId]
        );
        const linkIsActive = campRow?.ia !== false;

        // Buscar associações atuais
        const existingRows = await this.db.findMany(`
          SELECT totem_id 
          FROM campaign_totems 
          WHERE campaign_id = $1
        `, [campaignId]);

        const existingIds = existingRows.map((r: any) => Number(r.totem_id)).filter((id) => !isNaN(id));

        const toRemove = existingIds.filter((id) => !desiredTotemIds.includes(id));
        const uniqueDesired = [...new Set(desiredTotemIds)];

        if (toRemove.length > 0) {
          await this.db.executeRaw(`
            DELETE FROM campaign_totems 
            WHERE campaign_id = $1 
              AND totem_id = ANY($2::int[])
          `, [campaignId, toRemove]);
        }

        // Upsert cada totem desejado (não só os "novos"): linhas já existentes mas is_active=false
        // (ex.: trigger cascade_campaign_deactivate ao desligar a campanha) voltam a ativas aqui.
        for (const totemId of uniqueDesired) {
          const totem = await this.db.findFirst(`
            SELECT totem_id, COALESCE(is_active, true) AS is_active
            FROM totems 
            WHERE totem_id = $1
          `, [totemId]);

          if (!totem) {
            throw new Error(
              `Totem ${totemId} não existe. Não foi possível associar à campanha.`
            );
          }
          if (totem.is_active === false) {
            throw new Error(
              `Totem ${totemId} está inativo. Ative o totem ou remova-o da seleção.`
            );
          }

          await this.db.executeRaw(`
            INSERT INTO campaign_totems (
              campaign_id,
              totem_id,
              start_date,
              end_date,
              start_time,
              end_time,
              days_of_week,
              priority,
              is_active
            )
            VALUES ($1, $2, NULL, NULL, NULL, NULL, NULL, 1, $3)
            ON CONFLICT (campaign_id, totem_id)
            DO UPDATE SET
              is_active = EXCLUDED.is_active,
              updated_at = CURRENT_TIMESTAMP
          `, [campaignId, totemId, linkIsActive]);
        }
      }

      // Buscar campanha atualizada
      const updatedCampaign = await this.getCampaignById(campaignId);
      if (!updatedCampaign) {
        throw new Error('Erro ao buscar campanha atualizada');
      }

      // Log de auditoria
      await this.getAuditService().log('campaign', 'updated', updatedBy, {
        campaignId,
        changes: data,
        publisherIds: data.publisherIds || []
      });

      // Invalidar cache relacionado
      await this.cache.invalidateEntity('campaign', campaignId).catch(() => {});

      return updatedCampaign;

    } catch (error: any) {
      await logError('Erro ao atualizar campanha', error);
      throw error;
    }
  }

  /**
   * Remove campanha
   */
  async deleteCampaign(campaignId: number, deletedBy: number): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Verificar se tem dados associados
      const hasPlaylists = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaign_playlists WHERE campaign_id = $1 AND is_active = true
      `, [campaignId]);

      const hasTotems = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaign_totems WHERE campaign_id = $1 AND is_active = true
      `, [campaignId]);

      const hasMedias = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaign_medias WHERE campaign_id = $1 AND is_active = true
      `, [campaignId]);

      if (hasPlaylists.count > 0 || hasTotems.count > 0 || hasMedias.count > 0) {
        throw new Error('Não é possível remover campanha com dados associados (playlists, totems ou mídias). Desative-a primeiro.');
      }

      // Remover campanha (PostgreSQL placeholders)
      await this.db.executeRaw(`
        DELETE FROM campaigns WHERE campaign_id = $1
      `, [campaignId]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'deleted', deletedBy, {
        campaignId,
        title: campaign.title,
        subscriberId: campaign.subscriberId
      });

      // Invalidar cache relacionado
      await this.cache.invalidateEntity('campaign', campaignId).catch(() => {});

    } catch (error: any) {
      await logError('Erro ao remover campanha', error);
      throw error;
    }
  }

  /**
   * Adiciona totem à campanha
   */
  async addTotemToCampaign(campaignId: number, data: CampaignTotemRequest, addedBy: number): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Validar execução da campanha antes de adicionar totem
      const validation = await this.validateCampaignExecution(campaignId, [data.totemId]);
      if (!validation.valid) {
        throw new Error(validation.error || 'Campanha não pode ser executada neste totem');
      }

      // Verificar se totem existe (PostgreSQL placeholders)
      const totem = await this.db.findFirst(`
        SELECT totem_id FROM totems WHERE totem_id = $1 AND COALESCE(is_active, true) = true
      `, [data.totemId]);

      if (!totem) {
        throw new Error('Totem não encontrado ou inativo');
      }

      // Verificar se já está associado (PK é campaign_id + totem_id; tabela não tem coluna id)
      const existing = await this.db.findFirst(`
        SELECT 1 FROM campaign_totems WHERE campaign_id = $1 AND totem_id = $2
      `, [campaignId, data.totemId]);

      if (existing) {
        throw new Error('Totem já está associado à campanha');
      }

      // Adicionar totem à campanha (schema: start_date, end_date, start_time, end_time, days_of_week, priority, is_active)
      await this.db.executeRaw(`
        INSERT INTO campaign_totems (
          campaign_id, totem_id, start_date, end_date,
          start_time, end_time, days_of_week, priority, is_active
        )
        VALUES ($1, $2, $3, $4, NULL, NULL, NULL, 1, true)
      `, [
        campaignId,
        data.totemId,
        data.scheduledStart ?? null,
        data.scheduledEnd ?? null
      ]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'totem_added', addedBy, {
        campaignId,
        totemId: data.totemId
      });

    } catch (error: any) {
      await logError('Erro ao adicionar totem à campanha', error);
      throw error;
    }
  }

  /**
   * Remove totem da campanha
   */
  async removeTotemFromCampaign(campaignId: number, totemId: number, removedBy: number): Promise<void> {
    try {
      // Verificar se associação existe (PK é campaign_id + totem_id)
      const association = await this.db.findFirst(`
        SELECT 1 FROM campaign_totems WHERE campaign_id = $1 AND totem_id = $2
      `, [campaignId, totemId]);

      if (!association) {
        throw new Error('Totem não está associado à campanha');
      }

      // Remover associação (PostgreSQL placeholders)
      await this.db.executeRaw(`
        DELETE FROM campaign_totems WHERE campaign_id = $1 AND totem_id = $2
      `, [campaignId, totemId]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'totem_removed', removedBy, {
        campaignId,
        totemId
      });

    } catch (error: any) {
      await logError('Erro ao remover totem da campanha', error);
      throw error;
    }
  }

  /**
   * Validar execução de campanha (contrato, conteúdo, totens)
   */
  async validateCampaignExecution(campaignId: number, totemIds: number[]): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      // 1. Buscar campanha
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        return { valid: false, error: 'Campanha não encontrada' };
      }

      // 2. Validar contrato
      if (!campaign.contractId) {
        return { valid: false, error: 'Campanha não está vinculada a um contrato' };
      }

      const contract = await this.db.findFirst(`
        SELECT contract_id, status, start_date, end_date
        FROM subscriber_contracts
        WHERE contract_id = $1
      `, [campaign.contractId]);

      if (!contract) {
        return { valid: false, error: 'Contrato não encontrado' };
      }

      if (contract.status !== 'active') {
        return { valid: false, error: 'Contrato não está ativo' };
      }

      const now = new Date();
      const startDate = contract.start_date ? new Date(contract.start_date) : null;
      const endDate = contract.end_date ? new Date(contract.end_date) : null;

      if (startDate && startDate > now) {
        return { valid: false, error: 'Contrato ainda não iniciou' };
      }

      if (endDate && endDate < now) {
        return { valid: false, error: 'Contrato está expirado' };
      }

      // 3. Validar status da campanha
      if (!['active', 'approved'].includes(campaign.status || '') || !campaign.isActive) {
        return { valid: false, error: 'Campanha não está ativa ou aprovada' };
      }

      // 4. Validar conteúdo (mídias ou playlists)
      const hasMedia = await this.db.findFirst(`
        SELECT 1 FROM campaign_medias WHERE campaign_id = $1 AND is_active = true LIMIT 1
      `, [campaignId]);

      const hasPlaylists = await this.db.findFirst(`
        SELECT 1 FROM campaign_playlists WHERE campaign_id = $1 AND is_active = true LIMIT 1
      `, [campaignId]);

      if (!hasMedia && !hasPlaylists) {
        return { valid: false, error: 'Campanha não tem conteúdo (mídias ou playlists)' };
      }

      // 5. Validar acesso aos totens
      const subscriberService = getSubscriberService();
      for (const totemId of totemIds) {
        const hasAccess = await subscriberService.validateTotemAccess(campaign.subscriberId, totemId);
        if (!hasAccess) {
          return { valid: false, error: `Subscriber não tem acesso ao totem ${totemId}` };
        }
      }

      return { valid: true };
    } catch (error: any) {
      await logError('Erro ao validar execução de campanha', error, { campaignId, totemIds });
      return { valid: false, error: 'Erro ao validar execução da campanha' };
    }
  }

  /**
   * Ativa campanha
   */
  async activateCampaign(campaignId: number, activatedBy: number): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      if (campaign.isActive) {
        throw new Error('Campanha já está ativa');
      }

      // Validar execução antes de ativar
      const totems = await this.getCampaignTotems(campaignId);
      const totemIds = totems.map((t: any) => t.totem_id);
      
      if (totemIds.length > 0) {
        const validation = await this.validateCampaignExecution(campaignId, totemIds);
        if (!validation.valid) {
          throw new Error(validation.error || 'Campanha não pode ser ativada: validação falhou');
        }
      }

      // Ativar campanha (PostgreSQL placeholders)
      await this.db.executeRaw(`
        UPDATE campaigns 
        SET is_active = true, status = 'active', updated_at = CURRENT_TIMESTAMP 
        WHERE campaign_id = $1
      `, [campaignId]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'activated', activatedBy, {
        campaignId,
        title: campaign.title
      });

    } catch (error: any) {
      await logError('Erro ao ativar campanha', error);
      throw error;
    }
  }

  /**
   * Pausa campanha
   */
  async pauseCampaign(campaignId: number, pausedBy: number): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      if (!campaign.isActive) {
        throw new Error('Campanha já está inativa');
      }

      // Pausar campanha
      await this.db.executeRaw(`
        UPDATE campaigns 
        SET is_active = false, status = 'paused', updated_at = CURRENT_TIMESTAMP 
        WHERE campaign_id = $1
      `, [campaignId]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'paused', pausedBy, {
        campaignId,
        title: campaign.title
      });

    } catch (error: any) {
      await logError('Erro ao pausar campanha', error);
      throw error;
    }
  }

  /**
   * Finaliza campanha
   */
  async finishCampaign(campaignId: number, finishedBy: number): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Finalizar campanha
      await this.db.executeRaw(`
        UPDATE campaigns 
        SET is_active = false, status = 'finished', updated_at = CURRENT_TIMESTAMP 
        WHERE campaign_id = $1
      `, [campaignId]);

      // Log de auditoria
      await this.getAuditService().log('campaign', 'finished', finishedBy, {
        campaignId,
        title: campaign.title
      });

    } catch (error: any) {
      await logError('Erro ao finalizar campanha', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas de uma campanha (com cache de 2 minutos)
   */
  async getCampaignStats(campaignId: number): Promise<{
    totemCount: number;
    playlistCount: number;
    mediaCount: number;
    totalDuration: number;
  }> {
    const cacheKey = this.cache.generateKey('stats', 'campaign', campaignId.toString());
    
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          // Contar totems (PostgreSQL placeholders)
          const totemCountResult = await this.db.findFirst(`
            SELECT COUNT(*) as count FROM campaign_totems WHERE campaign_id = $1 AND is_active = true
          `, [campaignId]);

          // Contar playlists (PostgreSQL placeholders)
          const playlistCountResult = await this.db.findFirst(`
            SELECT COUNT(*) as count FROM campaign_playlists WHERE campaign_id = $1 AND is_active = true
          `, [campaignId]);

          // Contar mídias únicas (via playlists associadas)
          const mediaCountResult = await this.db.findFirst(`
            SELECT COUNT(DISTINCT pi.media_id) as count
            FROM playlist_items pi
            JOIN campaign_playlists cp ON pi.playlist_id = cp.playlist_id
            JOIN playlists p ON cp.playlist_id = p.playlist_id
            WHERE cp.campaign_id = $1 AND cp.is_active = true AND p.is_active = true
          `, [campaignId]);

          // Calcular duração total (via playlists associadas + mídias diretas)
          const durationResult = await this.db.findFirst(`
            SELECT COALESCE(SUM(duration), 0) as total
            FROM (
              -- Duração via playlists
              SELECT CASE
                WHEN COALESCE(pi.display_seconds, 0) > 0 THEN pi.display_seconds
                WHEN LOWER(COALESCE(m.media_type, '')) IN ('video', 'audio')
                  THEN COALESCE(NULLIF(m.duration_seconds, 0), 10)
                ELSE 10
              END as duration
              FROM playlist_items pi
              JOIN campaign_playlists cp ON pi.playlist_id = cp.playlist_id
              JOIN playlists p ON cp.playlist_id = p.playlist_id
              JOIN medias m ON pi.media_id = m.media_id
              WHERE cp.campaign_id = $1 AND cp.is_active = true AND p.is_active = true
              UNION ALL
              -- Duração de mídias diretamente associadas
              SELECT CASE
                WHEN COALESCE(cm.display_seconds, 0) > 0 THEN cm.display_seconds
                WHEN LOWER(COALESCE(m.media_type, '')) IN ('video', 'audio')
                  THEN COALESCE(NULLIF(m.duration_seconds, 0), 10)
                ELSE 10
              END as duration
              FROM campaign_medias cm
              JOIN medias m ON cm.media_id = m.media_id
              WHERE cm.campaign_id = $1 AND cm.is_active = true
            ) all_durations
          `, [campaignId]);

          return {
            totemCount: totemCountResult?.count || 0,
            playlistCount: playlistCountResult?.count || 0,
            mediaCount: mediaCountResult?.count || 0,
            totalDuration: durationResult?.total || 0
          };

        } catch (error: any) {
          await logError('Erro ao buscar estatísticas da campanha', error);
          return {
            totemCount: 0,
            playlistCount: 0,
            mediaCount: 0,
            totalDuration: 0
          };
        }
      },
      120 // Cache por 2 minutos
    );
  }

  /**
   * Busca totems de uma campanha
   */
  async getCampaignTotems(campaignId: number): Promise<any[]> {
    try {
      const totems = await this.db.findMany(`
        SELECT
          t.totem_id as id,
          t.name,
          t.location,
          t.uin,
          t.is_active as isActive,
          t.last_heartbeat as lastHeartbeat,
          t.created_at as createdAt
        FROM totems t
        INNER JOIN campaign_totems ct ON t.totem_id = ct.totem_id
        WHERE ct.campaign_id = $1
        ORDER BY t.name
      `, [campaignId]);

      return totems;
    } catch (error: any) {
      await logError('Erro ao buscar totems da campanha', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca estatísticas gerais de campanhas
   */
  async getCampaignsStats(): Promise<CampaignStats> {
    try {
      // Total de campanhas
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM campaigns
      `);

      // Por status
      const byStatus = await this.db.findMany(`
        SELECT status, COUNT(*) as count
        FROM campaigns
        GROUP BY status
        ORDER BY count DESC
      `);

      // Contar por status
      const activeResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE status = 'active' AND is_active = true
      `);

      const pausedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE status = 'paused'
      `);

      const finishedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE status = 'finished'
      `);

      const draftResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE status = 'draft'
      `);

      // Por tipo
      const byType = await this.db.findMany(`
        SELECT campaign_type as type, COUNT(*) as count
        FROM campaigns
        GROUP BY campaign_type
        ORDER BY count DESC
      `);

      // Por cliente
      const bySubscriber = await this.db.findMany(`
        SELECT 
          c.subscriber_id as subscriberId,
          s.name as subscriberName,
          COUNT(*) as count
        FROM campaigns c
        LEFT JOIN subscribers s ON c.subscriber_id = s.subscriber_id
        GROUP BY c.subscriber_id, s.name
        ORDER BY count DESC
        LIMIT 10
      `);

      // Atividade recente (últimos 7 dias)
      const newCampaignsResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns WHERE created_at >= NOW() - INTERVAL '7 days'
      `);

      const activatedResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns 
        WHERE status = 'active' AND updated_at >= NOW() - INTERVAL '7 days'
      `);

      const pausedResult2 = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns 
        WHERE status = 'paused' AND updated_at >= NOW() - INTERVAL '7 days'
      `);

      const finishedResult2 = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM campaigns 
        WHERE status = 'finished' AND updated_at >= NOW() - INTERVAL '7 days'
      `);

      return {
        total: totalResult?.total || 0,
        active: activeResult?.count || 0,
        paused: pausedResult?.count || 0,
        finished: finishedResult?.count || 0,
        draft: draftResult?.count || 0,
        byType: byType.map(t => ({ type: t.type, count: t.count })),
        byStatus: byStatus.map(s => ({ status: s.status, count: s.count })),
        bySubscriber: bySubscriber.map(s => ({ subscriberId: s.subscriberId, subscriberName: s.subscriberName, count: s.count })),
        recentActivity: {
          newCampaigns: newCampaignsResult?.count || 0,
          activated: activatedResult?.count || 0,
          paused: pausedResult2?.count || 0,
          finished: finishedResult2?.count || 0
        }
      };

    } catch (error: any) {
      await logError('Erro ao buscar estatísticas gerais', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca campanhas ativas para um totem
   */
  async getActiveCampaignsForTotem(totemId: number): Promise<CampaignResponse[]> {
    try {
      const campaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.subscriber_id as clientId,
          c.title,
          c.description,
          c.campaign_type as campaignType,
          c.priority,
          c.start_date as startDate,
          c.end_date as endDate,
          c.start_time as startTime,
          c.end_time as endTime,
          c.days_of_week as daysOfWeek,
          c.status,
          c.is_active as isActive,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          s.name as clientName
        FROM campaigns c
        LEFT JOIN subscribers s ON c.subscriber_id = s.subscriber_id
        JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
        WHERE ct.totem_id = $1 AND c.is_active = true AND c.status = 'active'
        ORDER BY c.priority DESC, c.created_at DESC
      `, [totemId]);

      // Buscar estatísticas para cada campanha
      const campaignsWithStats = await Promise.all(
        campaigns.map(async (campaign) => {
          const stats = await this.getCampaignStats(campaign.id);
          const scheduleInfo = this.getScheduleInfo(campaign);
          return { ...campaign, ...stats, ...scheduleInfo };
        })
      );

      return campaignsWithStats;

    } catch (error: any) {
      await logError('Erro ao buscar campanhas ativas para totem', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca campanhas que precisam ser ativadas/pausadas
   */
  async getCampaignsToUpdate(): Promise<CampaignResponse[]> {
    try {
      const now = new Date().toISOString();

      // Campanhas que devem ser ativadas
      const toActivate = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.subscriber_id as clientId,
          c.title,
          c.description,
          c.campaign_type as campaignType,
          c.priority,
          c.start_date as startDate,
          c.end_date as endDate,
          c.start_time as startTime,
          c.end_time as endTime,
          c.days_of_week as daysOfWeek,
          c.status,
          c.is_active as isActive,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          s.name as clientName
        FROM campaigns c
        LEFT JOIN subscribers s ON c.subscriber_id = s.subscriber_id
        WHERE c.status = 'draft' 
        AND c.start_date <= ? 
        AND c.is_active = false
      `, [now]);

      // Campanhas que devem ser pausadas
      const toPause = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.subscriber_id as clientId,
          c.title,
          c.description,
          c.campaign_type as campaignType,
          c.priority,
          c.start_date as startDate,
          c.end_date as endDate,
          c.start_time as startTime,
          c.end_time as endTime,
          c.days_of_week as daysOfWeek,
          c.status,
          c.is_active as isActive,
          c.created_at as createdAt,
          c.updated_at as updatedAt,
          s.name as clientName
        FROM campaigns c
        LEFT JOIN subscribers s ON c.subscriber_id = s.subscriber_id
        WHERE c.status = 'active' 
        AND c.end_date <= ? 
        AND c.is_active = true
      `, [now]);

      return [...toActivate, ...toPause];

    } catch (error: any) {
      await logError('Erro ao buscar campanhas para atualizar', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obtém informações de agendamento da campanha
   */
  private getScheduleInfo(campaign: any): {
    isScheduled: boolean;
    isExpired: boolean;
    isActiveNow: boolean;
  } {
    const now = new Date();
    // Compat: alguns drivers/queries podem retornar aliases em lowercase (startdate/enddate)
    const startRaw = campaign.startDate ?? campaign.startdate;
    const endRaw = campaign.endDate ?? campaign.enddate;
    const startDate = startRaw ? new Date(startRaw) : null;
    const endDate = endRaw ? new Date(endRaw) : null;

    const isScheduled = !!(startDate || endDate);
    const isExpired = endDate ? now > endDate : false;
    const isActiveNow = campaign.isActive && 
      (!startDate || now >= startDate) && 
      (!endDate || now <= endDate);

    return {
      isScheduled,
      isExpired,
      isActiveNow
    };
  }

  /**
   * Busca campanhas por subscriber (DEPRECATED: usar getCampaigns com filtro subscriberId)
   */
  async getCampaignsByClient(subscriberId: number, limit: number = 50): Promise<CampaignResponse[]> {
    try {
      const campaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id as id,
          c.subscriber_id as "clientId",
          c.title,
          c.description,
          c.campaign_type as "campaignType",
          c.priority,
          c.start_date as "startDate",
          c.end_date as "endDate",
          c.start_time as "startTime",
          c.end_time as "endTime",
          c.days_of_week as "daysOfWeek",
          c.status,
          c.is_active as "isActive",
          c.created_at as "createdAt",
          c.updated_at as "updatedAt",
          s.name as "clientName"
        FROM campaigns c
        LEFT JOIN subscribers s ON c.subscriber_id = s.subscriber_id
        WHERE c.subscriber_id = ?
        ORDER BY c.priority DESC, c.created_at DESC
        LIMIT ?
      `, [subscriberId, limit]);

      // Buscar estatísticas para cada campanha
      const campaignsWithStats = await Promise.all(
        campaigns.map(async (campaign) => {
          const stats = await this.getCampaignStats(campaign.id);
          const scheduleInfo = this.getScheduleInfo(campaign);
          return { ...campaign, ...stats, ...scheduleInfo };
        })
      );

      return campaignsWithStats;

    } catch (error: any) {
      await logError('Erro ao buscar campanhas por cliente', error);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Associa playlists a uma campanha
   * Valida que todas as playlists pertencem ao mesmo subscriber da campanha
   */
  async associatePlaylists(
    campaignId: number,
    playlistIds: number[],
    campaignSubscriberId: number,
    userId: number
  ): Promise<void> {
    try {
      // Buscar informações das playlists
      const playlists = await this.db.findMany(`
        SELECT playlist_id, subscriber_id, name
        FROM playlists
        WHERE playlist_id = ANY($1::int[])
        AND is_active = true
      `, [playlistIds]);

      if (playlists.length !== playlistIds.length) {
        const foundIds = playlists.map(p => p.playlist_id);
        const missingIds = playlistIds.filter(id => !foundIds.includes(id));
        throw new Error(`Playlists não encontradas ou inativas: ${missingIds.join(', ')}`);
      }

      // VALIDAÇÃO CRÍTICA: Todas as playlists devem pertencer ao mesmo subscriber da campanha
      const invalidPlaylists = playlists.filter(p => p.subscriber_id !== campaignSubscriberId);
      if (invalidPlaylists.length > 0) {
        const invalidNames = invalidPlaylists.map(p => `${p.name} (ID: ${p.playlist_id})`).join(', ');
        throw new Error(
          `As seguintes playlists pertencem a outro subscriber: ${invalidNames}. ` +
          `A campanha pertence ao subscriber ${campaignSubscriberId}, mas essas playlists pertencem a outros subscribers.`
        );
      }

      // Remover associações existentes
      await this.db.executeRaw(`
        DELETE FROM campaign_playlists WHERE campaign_id = $1
      `, [campaignId]);

      // Criar novas associações (com snapshot em metadata, quando disponível no schema)
      for (const playlistId of playlistIds) {
        const playlist = playlists.find(p => p.playlist_id === playlistId);
        const metadata = {
          snapshotVersion: 1,
          takenAt: new Date().toISOString(),
          takenByUserId: userId,
          campaignId,
          playlistId,
          playlistSnapshot: {
            playlistId,
            name: playlist?.name,
            subscriberId: playlist?.subscriber_id,
            isActive: true
          },
          validation: {
            validNow: true,
            reason: 'playlist_belongs_to_subscriber'
          }
        };
        await this.db.executeRaw(`
          INSERT INTO campaign_playlists (campaign_id, playlist_id, priority, is_active, metadata)
          VALUES ($1, $2, 1, true, $3::jsonb)
          ON CONFLICT (campaign_id, playlist_id) DO UPDATE
          SET is_active = true, priority = 1, metadata = EXCLUDED.metadata
        `, [campaignId, playlistId, JSON.stringify(metadata)]);
      }

      // Log de auditoria
      await this.getAuditService().log('campaign', 'playlists_associated', userId, {
        campaignId,
        playlistIds,
        campaignSubscriberId
      });

    } catch (error: any) {
      await logError('Erro ao associar playlists à campanha', error, {
        campaignId,
        playlistIds,
        campaignSubscriberId
      });
      throw error;
    }
  }

  /**
   * Associa mídias diretamente a uma campanha (sem playlist)
   * Valida que todas as mídias pertencem ao mesmo subscriber da campanha
   */
  async associateMedias(
    campaignId: number,
    mediaIds: number[],
    campaignSubscriberId: number,
    userId: number
  ): Promise<void> {
    try {
      // Buscar informações das mídias
      const medias = await this.db.findMany(`
        SELECT media_id, subscriber_id, name, status
        FROM medias
        WHERE media_id = ANY($1::int[])
        AND is_active = true
      `, [mediaIds]);

      if (medias.length !== mediaIds.length) {
        const foundIds = medias.map(m => m.media_id);
        const missingIds = mediaIds.filter(id => !foundIds.includes(id));
        throw new Error(`Mídias não encontradas ou inativas: ${missingIds.join(', ')}`);
      }

      // VALIDAÇÃO CRÍTICA: Todas as mídias devem pertencer ao mesmo subscriber da campanha
      const invalidMedias = medias.filter(m => m.subscriber_id !== campaignSubscriberId);
      if (invalidMedias.length > 0) {
        const invalidNames = invalidMedias.map(m => `${m.name} (ID: ${m.media_id})`).join(', ');
        throw new Error(
          `As seguintes mídias pertencem a outro subscriber: ${invalidNames}. ` +
          `A campanha pertence ao subscriber ${campaignSubscriberId}, mas essas mídias pertencem a outros subscribers.`
        );
      }

      // Remover associações existentes
      await this.db.executeRaw(`
        DELETE FROM campaign_medias WHERE campaign_id = $1
      `, [campaignId]);

      // Criar novas associações (com snapshot em metadata)
      for (let i = 0; i < mediaIds.length; i++) {
        const mediaId = mediaIds[i];
        const media = medias.find(m => m.media_id === mediaId);
        const metadata = {
          snapshotVersion: 1,
          takenAt: new Date().toISOString(),
          takenByUserId: userId,
          campaignId,
          mediaId,
          orderIndex: i,
          mediaSnapshot: {
            mediaId,
            name: media?.name,
            subscriberId: media?.subscriber_id,
            status: media?.status,
            isActive: true
          },
          validation: {
            validNow: true,
            reason: 'media_belongs_to_subscriber'
          }
        };
        await this.db.executeRaw(`
          INSERT INTO campaign_medias (campaign_id, media_id, order_index, priority, is_active, metadata)
          VALUES ($1, $2, $3, 1, true, $4::jsonb)
          ON CONFLICT (campaign_id, media_id) DO UPDATE
          SET is_active = true, order_index = $3, priority = 1, updated_at = CURRENT_TIMESTAMP, metadata = EXCLUDED.metadata
        `, [campaignId, mediaId, i, JSON.stringify(metadata)]);
      }

      // Log de auditoria
      await this.getAuditService().log('campaign', 'medias_associated', userId, {
        campaignId,
        mediaIds,
        campaignSubscriberId
      });

    } catch (error: any) {
      await logError('Erro ao associar mídias à campanha', error, {
        campaignId,
        mediaIds,
        campaignSubscriberId
      });
      throw error;
    }
  }

  /**
   * Associa publishers a uma campanha
   * Valida acesso antes de associar
   */
  async associatePublishers(
    campaignId: number,
    publisherIds: number[],
    userId: number,
    options: { allowInvalid?: boolean } = {}
  ): Promise<void> {
    try {
      // Buscar subscriber_id da campanha
      const campaign = await this.db.findFirst(`
        SELECT subscriber_id
        FROM campaigns
        WHERE campaign_id = $1
      `, [campaignId]);

      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Validar acesso (política A):
      // - allowInvalid=false (create): bloquear publishers inválidos
      // - allowInvalid=true (update): permitir salvar histórico, mas marcar snapshot como inválido no momento
      const accessService = getSubscriberAccessServiceInstance();
      const validation = await accessService.validateCampaignPublishers(campaign.subscriber_id, publisherIds);
      if (!validation.valid && !options.allowInvalid) {
        throw new Error(`Subscriber não tem acesso aos seguintes publishers: ${validation.invalidPublishers.join(', ')}`);
      }
      if (!validation.valid && options.allowInvalid) {
        await logInfo('[CampaignService] Publishers inválidos mantidos por política A (histórico preservado)', {
          campaignId,
          subscriberId: campaign.subscriber_id,
          invalidPublishers: validation.invalidPublishers
        });
      }

      // Substituir associações: remover as atuais e inserir a nova lista
      await this.db.executeRaw(`
        DELETE FROM campaign_publishers WHERE campaign_id = $1
      `, [campaignId]);

      // Inserir/atualizar cada publisher da lista
      for (const publisherId of publisherIds) {
        const hasAccessNow = await accessService.hasAccess(campaign.subscriber_id, publisherId);
        const accessDetails = await accessService.getAccessDetails(campaign.subscriber_id, publisherId);
        const metadata = {
          snapshotVersion: 1,
          takenAt: new Date().toISOString(),
          takenByUserId: userId,
          campaignId,
          publisherId,
          subscriberId: campaign.subscriber_id,
          accessAtThatTime: accessDetails
            ? {
                accessId: accessDetails.accessId,
                accessType: accessDetails.accessType,
                contractId: accessDetails.contractId,
                planId: accessDetails.planId,
                grantedAt: accessDetails.grantedAt,
                expiresAt: accessDetails.expiresAt,
                isActive: accessDetails.isActive
              }
            : null,
          validation: {
            validNow: hasAccessNow,
            reason: hasAccessNow ? 'has_access_now' : 'no_access_now'
          }
        };
        await this.db.executeRaw(`
          INSERT INTO campaign_publishers (
            campaign_id,
            publisher_id,
            is_active,
            metadata
          )
          VALUES ($1, $2, true, $3::jsonb)
          ON CONFLICT (campaign_id, publisher_id)
          DO UPDATE SET
            is_active = true,
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP
        `, [campaignId, publisherId, JSON.stringify(metadata)]);
      }

      await logDebug('Publishers associados à campanha', {
        campaignId,
        publisherIds,
        userId
      });
    } catch (error: any) {
      await logError('Erro ao associar publishers à campanha', error, {
        campaignId,
        publisherIds
      });
      throw error;
    }
  }

  /**
   * Reordena mídias em uma campanha
   * @param campaignId ID da campanha
   * @param mediaIds Array de IDs de mídias na nova ordem
   * @param userId ID do usuário que está reordenando
   */
  async reorderCampaignMedias(
    campaignId: number,
    mediaIds: number[],
    userId: number
  ): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Verificar se todas as mídias pertencem à campanha
      const existingMedias = await this.db.findMany(`
        SELECT media_id
        FROM campaign_medias
        WHERE campaign_id = $1 AND is_active = true
      `, [campaignId]);

      const existingMediaIds = existingMedias.map(m => m.media_id);
      const invalidIds = mediaIds.filter(id => !existingMediaIds.includes(id));
      
      if (invalidIds.length > 0) {
        throw new Error(`Mídias não encontradas na campanha: ${invalidIds.join(', ')}`);
      }

      if (mediaIds.length > existingMediaIds.length) {
        throw new Error('Não é possível adicionar mídias pelo endpoint de reordenação');
      }

      const uniqueMediaIds = [...new Set(mediaIds)];
      if (uniqueMediaIds.length !== mediaIds.length) {
        throw new Error('Lista de mídias contém IDs duplicados');
      }

      // Lista mais curta = remoção de vínculos (clientes antigos chamavam reorder ao excluir na UI).
      if (mediaIds.length < existingMediaIds.length) {
        const subscriberId = campaign.subscriberId ?? (campaign as any).subscriber_id;
        if (subscriberId == null || typeof subscriberId !== 'number') {
          throw new Error('Campanha sem subscriber válido para atualizar mídias');
        }
        await this.associateMedias(campaignId, mediaIds, subscriberId, userId);
        await this.cache.invalidateEntity('campaign', campaignId).catch(() => {});
        return;
      }

      // Atualizar order_index para cada mídia
      for (let i = 0; i < mediaIds.length; i++) {
        await this.db.executeRaw(`
          UPDATE campaign_medias
          SET order_index = $1, updated_at = CURRENT_TIMESTAMP
          WHERE campaign_id = $2 AND media_id = $3
        `, [i, campaignId, mediaIds[i]]);
      }

      // Log de auditoria
      await this.getAuditService().log('campaign', 'medias_reordered', userId, {
        campaignId,
        mediaIds,
        newOrder: mediaIds
      });

      // Invalidar cache
      await this.cache.invalidateEntity('campaign', campaignId).catch(() => {});

    } catch (error: any) {
      await logError('Erro ao reordenar mídias da campanha', error, {
        campaignId,
        mediaIds
      });
      throw error;
    }
  }

  /**
   * Reordena playlists em uma campanha
   * @param campaignId ID da campanha
   * @param playlistIds Array de IDs de playlists na nova ordem
   * @param userId ID do usuário que está reordenando
   */
  async reorderCampaignPlaylists(
    campaignId: number,
    playlistIds: number[],
    userId: number
  ): Promise<void> {
    try {
      // Verificar se campanha existe
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Verificar se todas as playlists pertencem à campanha
      const existingPlaylists = await this.db.findMany(`
        SELECT playlist_id
        FROM campaign_playlists
        WHERE campaign_id = $1 AND is_active = true
      `, [campaignId]);

      const existingPlaylistIds = existingPlaylists.map(p => p.playlist_id);
      const invalidIds = playlistIds.filter(id => !existingPlaylistIds.includes(id));
      
      if (invalidIds.length > 0) {
        throw new Error(`Playlists não encontradas na campanha: ${invalidIds.join(', ')}`);
      }

      if (playlistIds.length > existingPlaylistIds.length) {
        throw new Error('Não é possível adicionar playlists pelo endpoint de reordenação');
      }

      const uniquePlaylistIds = [...new Set(playlistIds)];
      if (uniquePlaylistIds.length !== playlistIds.length) {
        throw new Error('Lista de playlists contém IDs duplicados');
      }

      if (playlistIds.length < existingPlaylistIds.length) {
        const subscriberId = campaign.subscriberId ?? (campaign as any).subscriber_id;
        if (subscriberId == null || typeof subscriberId !== 'number') {
          throw new Error('Campanha sem subscriber válido para atualizar playlists');
        }
        await this.associatePlaylists(campaignId, playlistIds, subscriberId, userId);
        await this.cache.invalidateEntity('campaign', campaignId).catch(() => {});
        return;
      }

      // Atualizar priority para cada playlist (usando priority como ordem)
      // Quanto maior o priority, mais cedo aparece
      for (let i = 0; i < playlistIds.length; i++) {
        const priority = playlistIds.length - i; // Primeira playlist tem maior priority
        await this.db.executeRaw(`
          UPDATE campaign_playlists
          SET priority = $1, updated_at = CURRENT_TIMESTAMP
          WHERE campaign_id = $2 AND playlist_id = $3
        `, [priority, campaignId, playlistIds[i]]);
      }

      // Log de auditoria
      await this.getAuditService().log('campaign', 'playlists_reordered', userId, {
        campaignId,
        playlistIds,
        newOrder: playlistIds
      });

      // Invalidar cache
      await this.cache.invalidateEntity('campaign', campaignId).catch(() => {});

    } catch (error: any) {
      await logError('Erro ao reordenar playlists da campanha', error, {
        campaignId,
        playlistIds
      });
      throw error;
    }
  }
}

// Lazy singleton accessor (padroniza com outros serviços e facilita testes/mocks)
export function getCampaignService(): CampaignService {
  if (!(global as any).campaignServiceInstance) {
    (global as any).campaignServiceInstance = new CampaignService();
  }
  return (global as any).campaignServiceInstance;
}


