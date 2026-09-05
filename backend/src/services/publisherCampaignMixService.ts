/**
 * Publisher Campaign Mix Service
 * Serviço para mixar campanhas de múltiplos subscribers para um publisher
 */

import { getDatabase } from '../config/database';
import { DISABLE_DIRECT_CAMPAIGN_TOTEM } from '../config/featureFlags';
import { logError, logDebug } from '../utils/loggerHelper';
import { getCampaignEligibilityService } from './campaignEligibilityService';
import { normalizeError } from '../utils/errors';

export interface MixedCampaign {
    campaign_id: number;
    subscriber_id: number;
    subscriber_name: string;
    title: string;
    description: string;
    campaign_type: string;
    priority: number;
    
    // Agendamento global da campanha
    start_date: string | null;
    end_date: string | null;
    start_time: string | null;
    end_time: string | null;
    days_of_week: string | null; // JSON array
    
    // Configuração específica do publisher
    revenue_share_percentage: number | null;
    
    // Configuração específica do totem
    totem_id: number;
    totem_name: string | null;
    totem_start_date: string | null;
    totem_end_date: string | null;
    totem_start_time: string | null;
    totem_end_time: string | null;
    totem_days_of_week: string | null; // JSON array
    
    // Playlists da campanha
    playlists: Array<{
        playlist_id: number;
        name: string;
        priority: number;
    }>;
}

export interface CampaignMixFilters {
    publisherId: number;
    totemId?: number;
    date?: string; // Data específica para filtrar
    time?: string; // Hora específica para filtrar
    dayOfWeek?: string; // Dia da semana para filtrar
}

export class PublisherCampaignMixService {
    private get db() {
        return getDatabase();
    }

    /**
     * Obtém campanhas mixadas para um publisher
     * 
     * Mixagem considera:
     * - Prioridade da campanha (maior = mais prioridade)
     * - Agendamento global da campanha
     * - Agendamento específico por totem
     * - Status ativo
     * - Associação ativa com publisher
     */
    async getMixedCampaigns(filters: CampaignMixFilters): Promise<MixedCampaign[]> {
        try {
            const { publisherId, totemId, date, dayOfWeek } = filters;
            const useDirectTotem = totemId != null && !DISABLE_DIRECT_CAMPAIGN_TOTEM;
            const publisherContext = await this.getPublisherContextForLogs(publisherId);
            const totemContext = totemId != null ? await this.getTotemContextForLogs(totemId) : undefined;

            let whereClause = `
                WHERE cp.publisher_id = $1
                  AND cp.is_active = true
                  AND c.status = 'active'
                  AND c.is_active = true
            `;
            const params: unknown[] = [publisherId];
            let paramIndex = 2;

            if (useDirectTotem) {
                whereClause += ` AND ct.totem_id = $${paramIndex}`;
                params.push(totemId);
                paramIndex++;
            }
            if (date) {
                whereClause += ` AND (
                    (c.start_date IS NULL OR c.start_date <= $${paramIndex}::date)
                    AND (c.end_date IS NULL OR c.end_date >= $${paramIndex}::date)
                )`;
                params.push(date);
                paramIndex++;
            }
            if (dayOfWeek) {
                whereClause += ` AND (
                    c.days_of_week IS NULL 
                    OR c.days_of_week::jsonb ? $${paramIndex}
                )`;
                params.push(dayOfWeek);
                paramIndex++;
            }

            // Forma 2 desabilitada: quando totemId informado, usar apenas campaign_publishers (forma 1).
            // Código com campaign_totems preservado para uso futuro (useDirectTotem === true).
            const campaigns = await this.db.findMany(useDirectTotem
                ? `
                SELECT DISTINCT
                    c.campaign_id,
                    c.subscriber_id,
                    s.name as subscriber_name,
                    c.title,
                    c.description,
                    c.campaign_type,
                    c.priority,
                    c.created_at as campaign_created_at,
                    c.commercial_tier,
                    c.default_time_share_percent,
                    c.max_consecutive_slots,
                    c.start_date,
                    c.end_date,
                    c.start_time,
                    c.end_time,
                    c.days_of_week,
                    cp.revenue_share_percentage,
                    cp.time_share_percent,
                    cp.daypart_config,
                    cp.min_impressions_per_hour,
                    cp.max_impressions_per_hour,
                    ct.totem_id,
                    t.name as totem_name,
                    ct.start_date as totem_start_date,
                    ct.end_date as totem_end_date,
                    ct.start_time as totem_start_time,
                    ct.end_time as totem_end_time,
                    ct.days_of_week as totem_days_of_week
                FROM campaigns c
                INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
                INNER JOIN subscriber_publisher_access_active spa
                  ON spa.subscriber_id = c.subscriber_id
                 AND spa.publisher_id = cp.publisher_id
                INNER JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
                INNER JOIN subscribers s ON c.subscriber_id = s.subscriber_id
                LEFT JOIN totems t ON ct.totem_id = t.totem_id
                ${whereClause}
                  AND ct.is_active = true
                  AND (
                      (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
                      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
                  )
                  AND (
                      (ct.start_date IS NULL OR ct.start_date <= CURRENT_DATE)
                      AND (ct.end_date IS NULL OR ct.end_date >= CURRENT_DATE)
                  )
                ORDER BY c.priority DESC, c.created_at ASC
            `
                : `
                SELECT DISTINCT
                    c.campaign_id,
                    c.subscriber_id,
                    s.name as subscriber_name,
                    c.title,
                    c.description,
                    c.campaign_type,
                    c.priority,
                    c.created_at as campaign_created_at,
                    c.commercial_tier,
                    c.default_time_share_percent,
                    c.max_consecutive_slots,
                    c.start_date,
                    c.end_date,
                    c.start_time,
                    c.end_time,
                    c.days_of_week,
                    cp.revenue_share_percentage,
                    cp.time_share_percent,
                    cp.daypart_config,
                    cp.min_impressions_per_hour,
                    cp.max_impressions_per_hour,
                    NULL::integer as totem_id,
                    NULL::text as totem_name,
                    NULL::timestamp as totem_start_date,
                    NULL::timestamp as totem_end_date,
                    NULL::text as totem_start_time,
                    NULL::text as totem_end_time,
                    NULL::text as totem_days_of_week
                FROM campaigns c
                INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
                INNER JOIN subscriber_publisher_access_active spa
                  ON spa.subscriber_id = c.subscriber_id
                 AND spa.publisher_id = cp.publisher_id
                INNER JOIN subscribers s ON c.subscriber_id = s.subscriber_id
                ${whereClause}
                  AND (
                      (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
                      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
                  )
                ORDER BY c.priority DESC, c.created_at ASC
            `,
            useDirectTotem ? params : params
            );
            
            // Buscar playlists para cada campanha
            const campaignsWithPlaylists = await Promise.all(
                campaigns.map(async (campaignRaw: unknown) => {
                    const campaign = campaignRaw as unknown as Record<string, unknown>;
                    // Não expor campos auxiliares usados apenas para ordenação
                    const { campaign_created_at: _campaignCreatedAt, ...campaignPublic } = campaign;
                    const playlists = await this.db.findMany(`
                        SELECT 
                            p.playlist_id,
                            p.name,
                            cpl.priority
                        FROM campaign_playlists cpl
                        INNER JOIN playlists p ON cpl.playlist_id = p.playlist_id
                        WHERE cpl.campaign_id = $1
                          AND cpl.is_active = true
                          AND p.is_active = true
                        ORDER BY cpl.priority DESC, p.created_at ASC
                    `, [campaign.campaign_id]);

                    const medias = await this.db.findMany(`
                        WITH playlist_medias AS (
                            SELECT
                                m.media_id,
                                m.name AS media_name,
                                'playlist'::text AS source
                            FROM campaign_playlists cpl
                            INNER JOIN playlist_items pi
                                ON pi.playlist_id = cpl.playlist_id
                                AND COALESCE(pi.is_active, true) = true
                            INNER JOIN medias m
                                ON m.media_id = pi.media_id
                                AND m.is_active = true
                            WHERE cpl.campaign_id = $1
                              AND COALESCE(cpl.is_active, true) = true
                        ),
                        direct_medias AS (
                            SELECT
                                m.media_id,
                                m.name AS media_name,
                                'campaign_media'::text AS source
                            FROM campaign_medias cm
                            INNER JOIN medias m
                                ON m.media_id = cm.media_id
                                AND m.is_active = true
                            WHERE cm.campaign_id = $1
                              AND COALESCE(cm.is_active, true) = true
                        )
                        SELECT DISTINCT media_id, media_name, source
                        FROM (
                            SELECT * FROM playlist_medias
                            UNION ALL
                            SELECT * FROM direct_medias
                        ) x
                        ORDER BY media_name ASC NULLS LAST, media_id ASC
                    `, [campaign.campaign_id]);
                    
                    return {
                        ...campaignPublic,
                        playlists: playlists.map((plRaw: unknown) => {
                            const pl = plRaw as unknown as Record<string, unknown>;
                            return {
                                playlist_id: pl.playlist_id,
                                name: pl.name,
                                priority: pl.priority
                            };
                        }),
                        medias: medias.map((mRaw: unknown) => {
                            const m = mRaw as unknown as Record<string, unknown>;
                            return {
                                media_id: m.media_id,
                                name: m.media_name,
                                source: m.source,
                            };
                        }),
                    };
                })
            );
            
            await logDebug('Campanhas mixadas obtidas', {
                publisher: publisherContext,
                totem: totemContext,
                count: campaignsWithPlaylists.length,
                campaigns: campaignsWithPlaylists.map((campaignRaw: unknown) => {
                    const campaign = campaignRaw as unknown as Record<string, unknown>;
                    return {
                        id: campaign.campaign_id,
                        title: campaign.title,
                        subscriber: {
                            id: campaign.subscriber_id,
                            name: campaign.subscriber_name,
                        },
                        playlists: ((campaign.playlists as unknown[]) || []).map((plRaw: unknown) => {
                            const pl = plRaw as unknown as Record<string, unknown>;
                            return {
                                id: pl.playlist_id,
                                name: pl.name,
                            };
                        }),
                        medias: ((campaign.medias as unknown[]) || []).map((mRaw: unknown) => {
                            const m = mRaw as unknown as Record<string, unknown>;
                            return {
                                id: m.media_id,
                                name: m.name,
                                source: m.source,
                            };
                        }),
                    };
                }),
            });
            
            return campaignsWithPlaylists as unknown as MixedCampaign[];} catch (error: unknown) {
      const e = normalizeError(error);
            const publisherContext = await this.getPublisherContextForLogs(filters.publisherId);
            const totemContext = filters.totemId != null ? await this.getTotemContextForLogs(filters.totemId) : undefined;
            await logError('Erro ao obter campanhas mixadas', e.error, {
                publisher: publisherContext,
                totem: totemContext,
                filters,
            });
            throw new Error('Erro interno do servidor');
        }
    }
    
    /**
     * Obtém campanhas mixadas para um totem específico
     * (Alias para getMixedCampaigns com totemId)
     */
    async getMixedCampaignsForTotem(
        publisherId: number,
        totemId: number,
        filters?: { date?: string; time?: string; dayOfWeek?: string }
    ): Promise<MixedCampaign[]> {
        return this.getMixedCampaigns({
            publisherId,
            totemId,
            ...filters
        });
    }
    
    /**
     * Valida se uma campanha está ativa e pode ser exibida no momento atual.
     * Com DISABLE_DIRECT_CAMPAIGN_TOTEM=true valida apenas por publisher do totem (forma 1).
     */
    async validateCampaignActive(campaignId: number, totemId: number): Promise<boolean> {
        return getCampaignEligibilityService().isCampaignActiveForTotem(campaignId, totemId);
    }

    private async getPublisherContextForLogs(publisherId: number): Promise<Record<string, unknown>> {
        const row = await this.db.findFirst(
            `
            SELECT publisher_id, name
            FROM publishers
            WHERE publisher_id = $1
            `,
            [publisherId]
        );
        return row ? { id: row.publisher_id, name: row.name } : { id: publisherId };
    }

    private async getTotemContextForLogs(totemId: number): Promise<Record<string, unknown>> {
        const row = await this.db.findFirst(
            `
            SELECT totem_id, name, uin
            FROM totems
            WHERE totem_id = $1
            `,
            [totemId]
        );
        return row ? { id: row.totem_id, name: row.name, uin: row.uin } : { id: totemId };
    }
}

