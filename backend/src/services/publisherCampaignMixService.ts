/**
 * Publisher Campaign Mix Service
 * Serviço para mixar campanhas de múltiplos subscribers para um publisher
 */

import { getDatabase } from '../config/database';
import { logError, logDebug } from '../utils/loggerHelper';

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
            
            let whereClause = `
                WHERE cp.publisher_id = $1
                  AND cp.is_active = true
                  AND c.status = 'active'
                  AND c.is_active = true
            `;
            
            const params: any[] = [publisherId];
            let paramIndex = 2;
            
            // Filtrar por totem específico se fornecido
            if (totemId) {
                whereClause += ` AND ct.totem_id = $${paramIndex}`;
                params.push(totemId);
                paramIndex++;
            }
            
            // Filtrar por data específica se fornecida
            if (date) {
                whereClause += ` AND (
                    (c.start_date IS NULL OR c.start_date <= $${paramIndex}::date)
                    AND (c.end_date IS NULL OR c.end_date >= $${paramIndex}::date)
                )`;
                params.push(date);
                paramIndex++;
            }
            
            // Filtrar por dia da semana se fornecido
            if (dayOfWeek) {
                whereClause += ` AND (
                    c.days_of_week IS NULL 
                    OR c.days_of_week::jsonb ? $${paramIndex}
                )`;
                params.push(dayOfWeek);
                paramIndex++;
            }
            
            // Buscar campanhas com suas configurações
            const campaigns = await this.db.findMany(`
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
                      -- Verificar agendamento global da campanha
                      (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
                      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
                  )
                  AND (
                      -- Verificar agendamento específico do totem
                      (ct.start_date IS NULL OR ct.start_date <= CURRENT_DATE)
                      AND (ct.end_date IS NULL OR ct.end_date >= CURRENT_DATE)
                  )
                ORDER BY 
                    c.priority DESC,  -- Prioridade maior primeiro
                    c.created_at ASC   -- Mais antigas primeiro (em caso de empate)
            `, params);
            
            // Buscar playlists para cada campanha
            const campaignsWithPlaylists = await Promise.all(
                campaigns.map(async (campaign: any) => {
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
                    
                    return {
                        ...campaignPublic,
                        playlists: playlists.map((pl: any) => ({
                            playlist_id: pl.playlist_id,
                            name: pl.name,
                            priority: pl.priority
                        }))
                    };
                })
            );
            
            await logDebug('Campanhas mixadas obtidas', {
                publisherId,
                totemId,
                count: campaignsWithPlaylists.length
            });
            
            return campaignsWithPlaylists;
            
        } catch (error: any) {
            await logError('Erro ao obter campanhas mixadas', error, { filters });
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
     * Valida se uma campanha está ativa e pode ser exibida no momento atual
     */
    async validateCampaignActive(campaignId: number, totemId: number): Promise<boolean> {
        try {
            const result = await this.db.findFirst(`
                SELECT 1
                FROM campaigns c
                INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
                INNER JOIN subscriber_publisher_access_active spa
                  ON spa.subscriber_id = c.subscriber_id
                 AND spa.publisher_id = cp.publisher_id
                INNER JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
                WHERE c.campaign_id = $1
                  AND ct.totem_id = $2
                  AND cp.is_active = true
                  AND ct.is_active = true
                  AND c.status = 'active'
                  AND c.is_active = true
                  AND (
                      (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
                      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
                  )
                  AND (
                      (ct.start_date IS NULL OR ct.start_date <= CURRENT_DATE)
                      AND (ct.end_date IS NULL OR ct.end_date >= CURRENT_DATE)
                  )
            `, [campaignId, totemId]);
            
            return !!result;
        } catch (error: any) {
            await logError('Erro ao validar campanha ativa', error, { campaignId, totemId });
            return false;
        }
    }
}

