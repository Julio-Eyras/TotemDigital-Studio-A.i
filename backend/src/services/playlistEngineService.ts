/**
 * PlaylistEngineService
 * 
 * Motor de gerenciamento de playlists para totens/TVs smart.
 * 
 * Responsabilidades:
 * 1. Coletar todas as campanhas ativas de subscribers que têm acesso ao publisher do totem
 * 2. Validar status (apenas ativas e autorizadas)
 * 3. Combinar playlists e mídias diretas de múltiplos subscribers
 * 4. Aplicar regras comerciais (time share, tiers, revenue share)
 * 5. Gerar playlist final ordenada para cada totem/TV
 * 6. Monitorar mudanças e regenerar playlists automaticamente
 */

import { getDatabase } from '../config/database';
import { logError, logDebug, logWarn } from '../utils/loggerHelper';
import crypto from 'crypto';
import { getMediaTotemSyncService } from './mediaTotemSyncService';

export interface TotemPlaylistItem {
  item_id?: number;
  media_id: number;
  campaign_id?: number;
  subscriber_id: number;
  publisher_id: number;
  order_index: number;
  priority: number;
  display_seconds?: number;
  transition_type?: string;
  transition_duration_ms?: number;
  commercial_tier?: 'premium' | 'standard' | 'remnant';
  time_share_percent?: number;
  revenue_share_percent?: number;
  start_time?: string;
  end_time?: string;
  days_of_week?: string;
  is_active: boolean;
}

export interface TotemPlaylist {
  totem_playlist_id?: number;
  totem_id: number;
  smart_tv_id?: number;
  publisher_id: number;
  playlist_hash?: string;
  version: number;
  total_items: number;
  total_duration_seconds: number;
  status: 'active' | 'paused' | 'invalidated';
  is_active: boolean;
  generated_at?: Date;
  last_updated_at?: Date;
  expires_at?: Date;
  metadata?: any;
  generation_log?: any;
  items: TotemPlaylistItem[];
}

export interface GenerationResult {
  success: boolean;
  totem_playlist_id?: number;
  items_generated: number;
  duration_seconds: number;
  campaigns_included: number;
  playlists_included: number;
  medias_included: number;
  subscribers_included: number;
  error?: string;
  generation_time_ms: number;
}

export class PlaylistEngineService {
  private get db() {
    return getDatabase();
  }

  /**
   * Gera playlist final para um totem/TV
   * 
   * Processo:
   * 1. Buscar totem e identificar publisher
   * 2. Buscar todos os subscribers que têm acesso a este publisher
   * 3. Para cada subscriber, buscar campanhas ativas que incluem este publisher
   * 4. Coletar playlists e mídias diretas dessas campanhas
   * 5. Validar status (ativo, autorizado)
   * 6. Aplicar regras comerciais (time share, tiers)
   * 7. Ordenar e combinar itens
   * 8. Gerar hash e salvar playlist
   */
  async generatePlaylistForTotem(
    totemId: number,
    smartTvId?: number,
    forceRegenerate: boolean = false
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    
    try {
      // 1. Buscar totem e identificar publisher
      const totem = await this.db.findFirst(`
        SELECT 
          t.totem_id,
          t.local_id,
          l.publisher_id,
          t.status as totem_status,
          t.is_active as totem_is_active
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        WHERE t.totem_id = $1
      `, [totemId]);

      if (!totem) {
        throw new Error(`Totem ${totemId} não encontrado`);
      }

      if (!totem.publisher_id) {
        throw new Error(`Totem ${totemId} não está associado a um publisher`);
      }

      if (!totem.totem_is_active || totem.totem_status !== 'online') {
        await logWarn('Totem inativo ou offline, pulando geração de playlist', {
          totemId,
          status: totem.totem_status,
          isActive: totem.totem_is_active
        });
        return {
          success: false,
          items_generated: 0,
          duration_seconds: 0,
          campaigns_included: 0,
          playlists_included: 0,
          medias_included: 0,
          subscribers_included: 0,
          error: 'Totem inativo ou offline',
          generation_time_ms: Date.now() - startTime
        };
      }

      const publisherId = totem.publisher_id;

      // 2. Buscar todos os subscribers que têm acesso a este publisher
      const accessibleSubscribers = await this.getAccessibleSubscribers(publisherId);

      if (accessibleSubscribers.length === 0) {
        await logWarn('Nenhum subscriber com acesso a este publisher', {
          totemId,
          publisherId
        });
        return {
          success: true,
          items_generated: 0,
          duration_seconds: 0,
          campaigns_included: 0,
          playlists_included: 0,
          medias_included: 0,
          subscribers_included: 0,
          generation_time_ms: Date.now() - startTime
        };
      }

      // 3. Coletar campanhas, playlists e mídias de todos os subscribers
      const collectedItems = await this.collectPlaylistItems(
        publisherId,
        accessibleSubscribers,
        totemId
      );

      // 4. Aplicar regras comerciais e ordenar
      const sortedItems = this.applyCommercialRules(collectedItems);

      // 5. Gerar hash da playlist
      const playlistHash = this.generatePlaylistHash(sortedItems);

      // 6. Verificar se já existe playlist com mesmo hash (se não for forçado)
      if (!forceRegenerate) {
        const existingPlaylist = await this.db.findFirst(`
          SELECT totem_playlist_id, version
          FROM totem_playlists
          WHERE totem_id = $1
            AND (smart_tv_id = $2 OR (smart_tv_id IS NULL AND $2 IS NULL))
            AND playlist_hash = $3
            AND is_active = true
            AND status = 'active'
          ORDER BY version DESC
          LIMIT 1
        `, [totemId, smartTvId || null, playlistHash]);

        if (existingPlaylist) {
          await logDebug('Playlist já existe com mesmo hash, não regenerando', {
            totemId,
            smartTvId,
            playlistHash,
            existingVersion: existingPlaylist.version
          });
          
          return {
            success: true,
            totem_playlist_id: existingPlaylist.totem_playlist_id,
            items_generated: sortedItems.length,
            duration_seconds: sortedItems.reduce((sum, item) => sum + (item.display_seconds || 0), 0),
            campaigns_included: new Set(sortedItems.map(i => i.campaign_id).filter(Boolean)).size,
            playlists_included: 0, // Não calculado quando playlist já existe (cache hit)
            medias_included: sortedItems.length,
            subscribers_included: accessibleSubscribers.length,
            generation_time_ms: Date.now() - startTime
          };
        }
      }

      // 7. Calcular estatísticas
      const totalDuration = sortedItems.reduce((sum, item) => sum + (item.display_seconds || 0), 0);
      const uniqueCampaigns = new Set(sortedItems.map(i => i.campaign_id).filter(Boolean));
      const uniqueSubscribers = new Set(sortedItems.map(i => i.subscriber_id));
      
      // Calcular playlists únicas incluídas
      let uniquePlaylistsCount = 0;
      if (uniqueCampaigns.size > 0) {
        const playlistsResult = await this.db.findFirst(`
          SELECT COUNT(DISTINCT cp.playlist_id) as count
          FROM campaign_playlists cp
          WHERE cp.campaign_id = ANY($1::int[])
            AND cp.is_active = true
        `, [Array.from(uniqueCampaigns)]);
        uniquePlaylistsCount = parseInt(playlistsResult?.count || '0', 10);
      }

      // 8. Buscar playlist existente para atualizar ou criar nova
      const existingPlaylist = await this.db.findFirst(`
        SELECT totem_playlist_id, version
        FROM totem_playlists
        WHERE totem_id = $1
          AND (smart_tv_id = $2 OR (smart_tv_id IS NULL AND $2 IS NULL))
          AND is_active = true
        ORDER BY version DESC
        LIMIT 1
      `, [totemId, smartTvId || null]);

      let totemPlaylistId: number;
      let newVersion: number;

      if (existingPlaylist) {
        // Invalidar playlist anterior
        await this.db.executeRaw(`
          UPDATE totem_playlists
          SET status = 'invalidated', is_active = false, updated_at = CURRENT_TIMESTAMP
          WHERE totem_playlist_id = $1
        `, [existingPlaylist.totem_playlist_id]);

        newVersion = existingPlaylist.version + 1;
      } else {
        newVersion = 1;
      }

      // 9. Criar nova playlist
      const newPlaylist = await this.db.executeRaw(`
        INSERT INTO totem_playlists (
          totem_id,
          smart_tv_id,
          publisher_id,
          playlist_hash,
          version,
          total_items,
          total_duration_seconds,
          status,
          is_active,
          generated_at,
          last_updated_at,
          metadata,
          generation_log
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8, $9)
        RETURNING totem_playlist_id
      `, [
        totemId,
        smartTvId || null,
        publisherId,
        playlistHash,
        newVersion,
        sortedItems.length,
        totalDuration,
        JSON.stringify({
          totemId,
          smartTvId,
          publisherId,
          generatedAt: new Date().toISOString()
        }),
        JSON.stringify({
          campaigns_included: Array.from(uniqueCampaigns),
          subscribers_included: Array.from(uniqueSubscribers),
          total_items: sortedItems.length,
          total_duration: totalDuration
        })
      ]);

      // DatabaseWrapper.executeRaw retorna o objeto do driver (pg.Result) com `.rows`
      // Em versões antigas do código, isso era tratado como array.
      totemPlaylistId = (newPlaylist?.rows?.[0] as any)?.totem_playlist_id;
      if (!totemPlaylistId) {
        throw new Error('Falha ao criar totem_playlists (RETURNING totem_playlist_id vazio)');
      }

      // 10. Inserir itens da playlist
      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        await this.db.executeRaw(`
          INSERT INTO totem_playlist_items (
            totem_playlist_id,
            media_id,
            campaign_id,
            subscriber_id,
            publisher_id,
            order_index,
            priority,
            display_seconds,
            transition_type,
            transition_duration_ms,
            commercial_tier,
            time_share_percent,
            revenue_share_percent,
            start_time,
            end_time,
            days_of_week,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [
          totemPlaylistId,
          item.media_id,
          item.campaign_id || null,
          item.subscriber_id,
          item.publisher_id,
          i, // order_index
          item.priority,
          item.display_seconds || null,
          item.transition_type || 'fade',
          item.transition_duration_ms || 500,
          item.commercial_tier || null,
          item.time_share_percent || null,
          item.revenue_share_percent || null,
          item.start_time || null,
          item.end_time || null,
          item.days_of_week || null,
          item.is_active
        ]);
      }

      // 11. Registrar log de geração
      await this.db.executeRaw(`
        INSERT INTO totem_playlist_generation_log (
          totem_id,
          totem_playlist_id,
          publisher_id,
          status,
          campaigns_included,
          playlists_included,
          medias_included,
          subscribers_included,
          generation_time_ms,
          generation_details,
          generated_by
        )
        VALUES ($1, $2, $3, 'success', $4, $5, $6, $7, $8, $9, 'system')
      `, [
        totemId,
        totemPlaylistId,
        publisherId,
        uniqueCampaigns.size,
        uniquePlaylistsCount,
        sortedItems.length,
        uniqueSubscribers.size,
        Date.now() - startTime,
        JSON.stringify({
          campaigns: Array.from(uniqueCampaigns),
          subscribers: Array.from(uniqueSubscribers),
          items: sortedItems.length
        })
      ]);

      await logDebug('Playlist gerada com sucesso', {
        totemId,
        smartTvId,
        totemPlaylistId,
        items: sortedItems.length,
        duration: totalDuration,
        campaigns: uniqueCampaigns.size,
        playlists: uniquePlaylistsCount,
        subscribers: uniqueSubscribers.size
      });

      // Limpa cache do dispatcher (incl. sticky planVersion) para o heartbeat
      // marcar needsDispatch=true no próximo batimento.
      try {
        await getMediaTotemSyncService().invalidateTotemDispatchCaches([totemId]);
      } catch (cacheErr) {
        await logWarn('Falha ao invalidar cache dispatcher após gerar playlist', {
          totemId,
          error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
        });
      }

      return {
        success: true,
        totem_playlist_id: totemPlaylistId,
        items_generated: sortedItems.length,
        duration_seconds: totalDuration,
        campaigns_included: uniqueCampaigns.size,
        playlists_included: uniquePlaylistsCount,
        medias_included: sortedItems.length,
        subscribers_included: uniqueSubscribers.size,
        generation_time_ms: Date.now() - startTime
      };

    } catch (error: any) {
      await logError('Erro ao gerar playlist para totem', error, {
        totemId,
        smartTvId
      });

      // Registrar log de erro
      try {
        const totem = await this.db.findFirst(`
          SELECT local_id, (SELECT publisher_id FROM locals WHERE local_id = totems.local_id) as publisher_id
          FROM totems
          WHERE totem_id = $1
        `, [totemId]);

        if (totem && totem.publisher_id) {
          await this.db.executeRaw(`
            INSERT INTO totem_playlist_generation_log (
              totem_id,
              publisher_id,
              status,
              error_message,
              generation_time_ms,
              generated_by
            )
            VALUES ($1, $2, 'failed', $3, $4, 'system')
          `, [
            totemId,
            totem.publisher_id,
            error.message || 'Erro desconhecido',
            Date.now() - startTime
          ]);
        }
      } catch (logError) {
        // Ignorar erro ao registrar log
      }

      return {
        success: false,
        items_generated: 0,
        duration_seconds: 0,
        campaigns_included: 0,
        playlists_included: 0,
        medias_included: 0,
        subscribers_included: 0,
        error: error.message || 'Erro desconhecido',
        generation_time_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Busca subscribers com acesso a um publisher:
   * - via contrato+plano (plan_publisher_access) — Pro
   * - via subscriber_publisher_access activo — Multi Lite / override
   */
  private async getAccessibleSubscribers(publisherId: number): Promise<number[]> {
    try {
      const rows = await this.db.findMany(
        `
        SELECT DISTINCT subscriber_id FROM (
          SELECT sc.subscriber_id
          FROM subscriber_contracts sc
          INNER JOIN plan_publisher_access ppa ON sc.plan_id = ppa.plan_id
          WHERE ppa.publisher_id = $1
            AND ppa.is_allowed = true
            AND COALESCE(ppa.is_active, true) = true
            AND sc.status = 'active'
            AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
            AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)

          UNION

          SELECT spa.subscriber_id
          FROM subscriber_publisher_access_active spa
          WHERE spa.publisher_id = $1
        ) accessible
      `,
        [publisherId]
      );

      return rows.map((s: any) => Number(s.subscriber_id)).filter((id) => Number.isInteger(id) && id > 0);
    } catch (error: any) {
      await logError('Erro ao buscar subscribers acessíveis', error, { publisherId });
      return [];
    }
  }

  /**
   * Coleta todos os itens de playlist (mídias) de campanhas ativas
   * de subscribers que têm acesso ao publisher
   */
  private async collectPlaylistItems(
    publisherId: number,
    subscriberIds: number[],
    totemId: number
  ): Promise<TotemPlaylistItem[]> {
    const items: TotemPlaylistItem[] = [];

    if (subscriberIds.length === 0) {
      return items;
    }

    try {
      // Buscar campanhas ativas que incluem este publisher
      const campaigns = await this.db.findMany(`
        SELECT DISTINCT
          c.campaign_id,
          c.subscriber_id,
          c.commercial_tier,
          c.default_time_share_percent,
          cp.time_share_percent as campaign_time_share,
          cp.revenue_share_percentage as campaign_revenue_share,
          cp.daypart_config
        FROM campaigns c
        INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
        WHERE c.subscriber_id = ANY($1::int[])
          AND c.is_active = true
          AND c.status = 'active'
          AND cp.publisher_id = $2
          AND cp.is_active = true
          AND (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
          AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
      `, [subscriberIds, publisherId]);

      // Para cada campanha, coletar mídias (via playlists e diretamente)
      for (const campaign of campaigns) {
        // 1. Mídias via playlists
        const playlistMedias = await this.db.findMany(`
          SELECT DISTINCT
            pi.media_id,
            pi.display_seconds,
            pi.order_index as playlist_order,
            p.playlist_id,
            p.subscriber_id,
            cp.priority as campaign_priority
          FROM campaign_playlists cp
          INNER JOIN playlists p ON cp.playlist_id = p.playlist_id
          INNER JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
          INNER JOIN medias m ON pi.media_id = m.media_id
          WHERE cp.campaign_id = $1
            AND cp.is_active = true
            AND p.is_active = true
            AND m.is_active = true
            AND m.status = 'approved'
            AND m.approval_status = 'approved'
          ORDER BY cp.priority, pi.order_index
        `, [campaign.campaign_id]);

        for (const pm of playlistMedias) {
          items.push({
            media_id: pm.media_id,
            campaign_id: campaign.campaign_id,
            subscriber_id: pm.subscriber_id,
            publisher_id: publisherId,
            order_index: 0, // Será recalculado após ordenação
            priority: pm.campaign_priority || 1,
            display_seconds: pm.display_seconds,
            commercial_tier: campaign.commercial_tier || 'standard',
            time_share_percent: campaign.campaign_time_share || campaign.default_time_share_percent,
            revenue_share_percent: campaign.campaign_revenue_share || null,
            is_active: true
          });
        }

        // 2. Mídias diretamente associadas (sem playlist)
        const directMedias = await this.db.findMany(`
          SELECT DISTINCT
            cm.media_id,
            cm.display_seconds,
            cm.order_index,
            cm.priority,
            m.subscriber_id
          FROM campaign_medias cm
          INNER JOIN medias m ON cm.media_id = m.media_id
          WHERE cm.campaign_id = $1
            AND cm.is_active = true
            AND m.is_active = true
            AND m.status = 'approved'
            AND m.approval_status = 'approved'
          ORDER BY cm.order_index, cm.priority
        `, [campaign.campaign_id]);

        for (const dm of directMedias) {
          items.push({
            media_id: dm.media_id,
            campaign_id: campaign.campaign_id,
            subscriber_id: dm.subscriber_id,
            publisher_id: publisherId,
            order_index: 0, // Será recalculado após ordenação
            priority: dm.priority || 1,
            display_seconds: dm.display_seconds,
            commercial_tier: campaign.commercial_tier || 'standard',
            time_share_percent: campaign.campaign_time_share || campaign.default_time_share_percent,
            revenue_share_percent: campaign.campaign_revenue_share || null,
            is_active: true
          });
        }
      }

      return items;
    } catch (error: any) {
      await logError('Erro ao coletar itens de playlist', error, {
        publisherId,
        subscriberIds,
        totemId
      });
      return [];
    }
  }

  /**
   * Aplica regras comerciais e ordena itens
   * 
   * Ordem de prioridade:
   * 1. Commercial tier (premium > standard > remnant)
   * 2. Priority (maior = mais importante)
   * 3. Time share (distribuição proporcional)
   */
  private applyCommercialRules(items: TotemPlaylistItem[]): TotemPlaylistItem[] {
    // Mapear tiers para valores numéricos
    const tierValues: Record<string, number> = {
      'premium': 3,
      'standard': 2,
      'remnant': 1
    };

    // Ordenar por:
    // 1. Tier (premium primeiro)
    // 2. Priority (maior primeiro)
    // 3. Time share (maior primeiro)
    const sorted = [...items].sort((a, b) => {
      // Comparar tier
      const tierA = tierValues[a.commercial_tier || 'standard'] || 0;
      const tierB = tierValues[b.commercial_tier || 'standard'] || 0;
      if (tierB !== tierA) {
        return tierB - tierA; // Premium primeiro
      }

      // Comparar priority
      if (b.priority !== a.priority) {
        return b.priority - a.priority; // Maior priority primeiro
      }

      // Comparar time share
      const timeShareA = a.time_share_percent || 0;
      const timeShareB = b.time_share_percent || 0;
      if (timeShareB !== timeShareA) {
        return timeShareB - timeShareA; // Maior time share primeiro
      }

      return 0;
    });

    // Recalcular order_index
    sorted.forEach((item, index) => {
      item.order_index = index;
    });

    return sorted;
  }

  /**
   * Gera hash MD5 da playlist para detectar mudanças
   */
  private generatePlaylistHash(items: TotemPlaylistItem[]): string {
    const hashData = items.map(item => ({
      media_id: item.media_id,
      campaign_id: item.campaign_id,
      order_index: item.order_index,
      priority: item.priority,
      commercial_tier: item.commercial_tier
    }));

    const hashString = JSON.stringify(hashData);
    return crypto.createHash('md5').update(hashString).digest('hex');
  }

  /**
   * Invalida playlist de um totem (marca como invalidada)
   */
  async invalidatePlaylist(totemId: number, smartTvId?: number): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE totem_playlists
        SET status = 'invalidated', is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE totem_id = $1
          AND (smart_tv_id = $2 OR (smart_tv_id IS NULL AND $2 IS NULL))
          AND is_active = true
      `, [totemId, smartTvId || null]);

      await logDebug('Playlist invalidada', { totemId, smartTvId });
    } catch (error: any) {
      await logError('Erro ao invalidar playlist', error, { totemId, smartTvId });
      throw error;
    }
  }

  /**
   * Busca playlist ativa de um totem
   */
  async getActivePlaylist(totemId: number, smartTvId?: number): Promise<TotemPlaylist | null> {
    try {
      const playlist = await this.db.findFirst(`
        SELECT 
          totem_playlist_id,
          totem_id,
          smart_tv_id,
          publisher_id,
          playlist_hash,
          version,
          total_items,
          total_duration_seconds,
          status,
          is_active,
          generated_at,
          last_updated_at,
          expires_at,
          metadata,
          generation_log
        FROM totem_playlists
        WHERE totem_id = $1
          AND (smart_tv_id = $2 OR (smart_tv_id IS NULL AND $2 IS NULL))
          AND is_active = true
          AND status = 'active'
        ORDER BY version DESC
        LIMIT 1
      `, [totemId, smartTvId || null]);

      if (!playlist) {
        return null;
      }

      // Buscar itens
      const items = await this.db.findMany(`
        SELECT 
          item_id,
          media_id,
          campaign_id,
          subscriber_id,
          publisher_id,
          order_index,
          priority,
          display_seconds,
          transition_type,
          transition_duration_ms,
          commercial_tier,
          time_share_percent,
          revenue_share_percent,
          start_time,
          end_time,
          days_of_week,
          is_active
        FROM totem_playlist_items
        WHERE totem_playlist_id = $1
          AND is_active = true
        ORDER BY order_index
      `, [playlist.totem_playlist_id]);

      return {
        totem_playlist_id: playlist.totem_playlist_id,
        totem_id: playlist.totem_id,
        smart_tv_id: playlist.smart_tv_id,
        publisher_id: playlist.publisher_id,
        playlist_hash: playlist.playlist_hash,
        version: playlist.version,
        total_items: playlist.total_items,
        total_duration_seconds: playlist.total_duration_seconds,
        status: playlist.status as 'active' | 'paused' | 'invalidated',
        is_active: playlist.is_active,
        generated_at: playlist.generated_at,
        last_updated_at: playlist.last_updated_at,
        expires_at: playlist.expires_at,
        metadata: playlist.metadata,
        generation_log: playlist.generation_log,
        items: items.map(item => ({
          item_id: item.item_id,
          media_id: item.media_id,
          campaign_id: item.campaign_id,
          subscriber_id: item.subscriber_id,
          publisher_id: item.publisher_id,
          order_index: item.order_index,
          priority: item.priority,
          display_seconds: item.display_seconds,
          transition_type: item.transition_type,
          transition_duration_ms: item.transition_duration_ms,
          commercial_tier: item.commercial_tier as 'premium' | 'standard' | 'remnant' | undefined,
          time_share_percent: item.time_share_percent,
          revenue_share_percent: item.revenue_share_percent,
          start_time: item.start_time,
          end_time: item.end_time,
          days_of_week: item.days_of_week,
          is_active: item.is_active
        }))
      };
    } catch (error: any) {
      await logError('Erro ao buscar playlist ativa', error, { totemId, smartTvId });
      return null;
    }
  }

  /**
   * Lista todas as playlists ativas de totens
   */
  async getAllTotemPlaylists(params?: {
    publisherId?: number;
    totemId?: number;
    page?: number;
    limit?: number;
  }): Promise<{
    data: Array<{
      totem_playlist_id: number;
      totem_id: number;
      totem_name?: string;
      publisher_id: number;
      publisher_name?: string;
      version: number;
      total_items: number;
      total_duration_seconds: number;
      status: string;
      generated_at: Date;
      last_updated_at: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = params?.page || 1;
      const limit = params?.limit || 50;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE tp.is_active = true AND tp.status = \'active\'';
      const queryParams: any[] = [];

      if (params?.publisherId) {
        whereClause += ` AND tp.publisher_id = $${queryParams.length + 1}`;
        queryParams.push(params.publisherId);
      }

      if (params?.totemId) {
        whereClause += ` AND tp.totem_id = $${queryParams.length + 1}`;
        queryParams.push(params.totemId);
      }

      const playlists = await this.db.findMany(`
        SELECT 
          tp.totem_playlist_id,
          tp.totem_id,
          t.name as totem_name,
          tp.publisher_id,
          p.name as publisher_name,
          tp.version,
          tp.total_items,
          tp.total_duration_seconds,
          tp.status,
          tp.generated_at,
          tp.last_updated_at
        FROM totem_playlists tp
        INNER JOIN totems t ON tp.totem_id = t.totem_id
        INNER JOIN publishers p ON tp.publisher_id = p.publisher_id
        ${whereClause}
        ORDER BY tp.last_updated_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM totem_playlists tp
        ${whereClause}
      `, queryParams);

      return {
        data: playlists.map(p => ({
          totem_playlist_id: p.totem_playlist_id,
          totem_id: p.totem_id,
          totem_name: p.totem_name,
          publisher_id: p.publisher_id,
          publisher_name: p.publisher_name,
          version: p.version,
          total_items: p.total_items,
          total_duration_seconds: p.total_duration_seconds,
          status: p.status,
          generated_at: p.generated_at,
          last_updated_at: p.last_updated_at
        })),
        total: parseInt(totalResult?.total || '0'),
        page,
        limit
      };
    } catch (error: any) {
      await logError('Erro ao listar playlists de totens', error, { params });
      throw error;
    }
  }

  /**
   * Regenera playlists para todos os totens de um publisher
   */
  async regeneratePlaylistsForPublisher(publisherId: number): Promise<number> {
    try {
      const totems = await this.db.findMany(`
        SELECT totem_id
        FROM totems t
        INNER JOIN locals l ON t.local_id = l.local_id
        WHERE l.publisher_id = $1
          AND t.is_active = true
      `, [publisherId]);

      let successCount = 0;
      for (const totem of totems) {
        const result = await this.generatePlaylistForTotem(totem.totem_id, undefined, true);
        if (result.success) {
          successCount++;
        }
      }

      await logDebug('Playlists regeneradas para publisher', {
        publisherId,
        totems: totems.length,
        successCount
      });

      return successCount;
    } catch (error: any) {
      await logError('Erro ao regenerar playlists para publisher', error, { publisherId });
      throw error;
    }
  }

  /**
   * Regenera playlists afetadas por mudança em campanha
   */
  async regeneratePlaylistsForCampaign(campaignId: number): Promise<number> {
    try {
      // Buscar todos os publishers associados à campanha
      const publishers = await this.db.findMany(`
        SELECT DISTINCT publisher_id
        FROM campaign_publishers
        WHERE campaign_id = $1
          AND is_active = true
      `, [campaignId]);

      let totalRegenerated = 0;
      for (const pub of publishers) {
        const count = await this.regeneratePlaylistsForPublisher(pub.publisher_id);
        totalRegenerated += count;
      }

      await logDebug('Playlists regeneradas para campanha', {
        campaignId,
        publishers: publishers.length,
        totalRegenerated
      });

      return totalRegenerated;
    } catch (error: any) {
      await logError('Erro ao regenerar playlists para campanha', error, { campaignId });
      throw error;
    }
  }
}

// Singleton instance
let playlistEngineServiceInstance: PlaylistEngineService | null = null;

export function getPlaylistEngineServiceInstance(): PlaylistEngineService {
  if (!playlistEngineServiceInstance) {
    playlistEngineServiceInstance = new PlaylistEngineService();
  }
  return playlistEngineServiceInstance;
}

