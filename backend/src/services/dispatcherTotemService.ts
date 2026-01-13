/**
 * Dispatcher-Totem Service
 * Motor de decisão que resolve conflitos de agendamentos e gera planos de exibição
 * 
 * Responsabilidades:
 * - Resolver conflitos de agendamentos
 * - Validar frequências temporais
 * - Validar compatibilidade técnica
 * - Gerar planos de exibição (não executa)
 * - Auditoria de decisões
 */

import { getDatabase } from '../config/database';
import { logError, logDebug } from '../utils/loggerHelper';
import { getCacheService } from './cacheService';
import {
  DispatchRequest,
  DispatchPlan,
  DispatchMediaItem,
  CandidateSchedule,
  DispatchLogEntry,
  CacheConfig,
  DispatchOptions,
  DispatchResponse,
} from '../types/dispatcherTotem.types';

export class DispatcherTotemService {
  private get db() {
    return getDatabase();
  }

  private cacheConfig: CacheConfig = {
    enabled: true,
    ttlSeconds: 60, // Padrão: 60 segundos (1 minuto)
  };

  /**
   * Configurar cache do dispatcher
   */
  setCacheConfig(config: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config };
  }

  /**
   * Obter configuração de cache atual
   */
  getCacheConfig(): CacheConfig {
    return { ...this.cacheConfig };
  }

  /**
   * Método principal: Gerar plano de exibição para um totem
   */
  async dispatch(
    request: DispatchRequest,
    options: DispatchOptions = {}
  ): Promise<DispatchResponse> {
    const startTime = Date.now();
    const { totemId, timestamp, timezone } = request;
    const { skipCache = false, includeCandidates = false, validateOnly = false } = options;

    try {
      // Normalizar timestamp
      const targetTimestamp = timestamp 
        ? new Date(timestamp) 
        : new Date();

      // Gerar chave de cache
      const cacheKey = this.generateCacheKey(totemId, targetTimestamp);
      
      // Verificar cache (se habilitado e não forçado a ignorar)
      if (this.cacheConfig.enabled && !skipCache && !validateOnly) {
        const cached = await this.getFromCache(cacheKey);
        if (cached) {
          await logDebug('[DispatcherTotem] Cache hit', { totemId, cacheKey });
          
          // Registrar log de auditoria (cache hit)
          await this.logDispatch({
            totemId,
            timestamp: targetTimestamp,
            plan: cached.plan,
            fromCache: true,
            cacheKey,
            executionTimeMs: Date.now() - startTime,
            candidates: includeCandidates ? cached.candidates : undefined,
          });

          return {
            success: true,
            plan: cached.plan,
            candidates: includeCandidates ? cached.candidates : undefined,
            fromCache: true,
            executionTimeMs: Date.now() - startTime,
          };
        }
      }

      // 1. Descobrir candidatos
      const candidates = await this.getCandidateSchedules(totemId, targetTimestamp, timezone);
      
      if (candidates.length === 0) {
        await logDebug('[DispatcherTotem] Nenhum candidato encontrado', { totemId });
        
        return {
          success: true,
          plan: undefined,
          candidates: includeCandidates ? [] : undefined,
          fromCache: false,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 2. Resolver conflitos (ordenar e selecionar vencedor)
      const winner = await this.resolveConflicts(candidates);
      
      if (!winner) {
        await logDebug('[DispatcherTotem] Nenhum candidato válido após resolução', { totemId });
        
        return {
          success: true,
          plan: undefined,
          candidates: includeCandidates ? candidates : undefined,
          fromCache: false,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 3. Validar compatibilidade técnica
      const technicalValid = await this.validateTechnicalCompatibility(winner, totemId);
      if (!technicalValid.valid) {
        await logDebug('[DispatcherTotem] Falha na validação técnica', { 
          totemId, 
          errors: technicalValid.errors 
        });
        
        // Tentar próximo candidato
        const nextWinner = candidates.find(c => c.campaignId !== winner.campaignId && c.score < winner.score);
        if (nextWinner) {
          // Recursão limitada (apenas 1 nível)
          return this.dispatch(
            { totemId, timestamp: targetTimestamp, timezone },
            { ...options, skipCache: true }
          );
        }
        
        return {
          success: false,
          error: `Validação técnica falhou: ${technicalValid.errors.join(', ')}`,
          candidates: includeCandidates ? candidates : undefined,
          fromCache: false,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 4. Validar integridade da playlist
      const integrityValid = await this.validatePlaylistIntegrity(winner.playlistId);
      if (!integrityValid.valid) {
        await logDebug('[DispatcherTotem] Falha na validação de integridade', { 
          totemId, 
          errors: integrityValid.errors 
        });
        
        return {
          success: false,
          error: `Validação de integridade falhou: ${integrityValid.errors.join(', ')}`,
          candidates: includeCandidates ? candidates : undefined,
          fromCache: false,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 5. Gerar plano de exibição
      const plan = await this.generateDispatchPlan(winner, totemId, targetTimestamp);

      // 6. Salvar no cache
      if (this.cacheConfig.enabled && !validateOnly) {
        await this.saveToCache(cacheKey, {
          plan,
          candidates: includeCandidates ? candidates : undefined,
        });
      }

      // 7. Registrar log de auditoria
      await this.logDispatch({
        totemId,
        timestamp: targetTimestamp,
        selectedCampaignId: winner.campaignId,
        selectedPlaylistId: winner.playlistId,
        selectedSource: winner.source,
        selectedSourceId: winner.sourceId,
        priority: winner.priority,
        candidatesCount: candidates.length,
        candidates: includeCandidates ? candidates : undefined,
        temporalValidation: winner.temporalValid,
        technicalValidation: technicalValid.valid,
        integrityValidation: integrityValid.valid,
        validationDetails: {
          technicalErrors: technicalValid.errors,
          integrityErrors: integrityValid.errors,
        },
        fromCache: false,
        cacheKey,
        plan,
        executionTimeMs: Date.now() - startTime,
      });

      return {
        success: true,
        plan,
        candidates: includeCandidates ? candidates : undefined,
        fromCache: false,
        executionTimeMs: Date.now() - startTime,
      };

    } catch (error: any) {
      await logError('[DispatcherTotem] Erro ao gerar plano', error, { totemId, timestamp });
      
      return {
        success: false,
        error: error.message || 'Erro interno ao gerar plano',
        fromCache: false,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Descobrir candidatos: agendamentos válidos para o totem no timestamp
   */
  private async getCandidateSchedules(
    totemId: number,
    timestamp: Date,
    timezone?: string
  ): Promise<CandidateSchedule[]> {
    try {
      // Buscar totem para obter local_id e timezone
      const totem = await this.db.findFirst(`
        SELECT 
          t.totem_id,
          t.local_id,
          t.config,
          l.timezone as local_timezone
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        WHERE t.totem_id = $1
      `, [totemId]);

      if (!totem) {
        throw new Error(`Totem ${totemId} não encontrado`);
      }

      const totemTimezone = timezone || totem.local_timezone || 'America/Sao_Paulo';

      // Buscar campanhas ativas que apontam para este totem
      // Via campaign_totems (direto) ou via campaign_publishers (grupo)
      const campaigns = await this.db.findMany(`
        WITH totem_campaigns AS (
          -- Campanhas diretas (via campaign_totems)
          SELECT DISTINCT
            c.campaign_id,
            c.title as campaign_title,
            c.priority,
            c.start_date,
            c.end_date,
            c.start_time,
            c.end_time,
            c.days_of_week,
            c.timezone,
            c.status,
            c.is_active,
            ct.totem_id,
            ct.start_date as ct_start_date,
            ct.end_date as ct_end_date,
            ct.start_time as ct_start_time,
            ct.end_time as ct_end_time,
            ct.days_of_week as ct_days_of_week,
            ct.priority as ct_priority,
            'direct' as source_type,
            ct.campaign_id as source_id
          FROM campaigns c
          INNER JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
          WHERE ct.totem_id = $1
            AND ct.is_active = true
            AND c.is_active = true
            AND c.status = 'active'
          
          UNION
          
          -- Campanhas via publishers (grupo)
          SELECT DISTINCT
            c.campaign_id,
            c.title as campaign_title,
            c.priority,
            c.start_date,
            c.end_date,
            c.start_time,
            c.end_time,
            c.days_of_week,
            c.timezone,
            c.status,
            c.is_active,
            t.totem_id,
            NULL as ct_start_date,
            NULL as ct_end_date,
            NULL as ct_start_time,
            NULL as ct_end_time,
            NULL as ct_days_of_week,
            NULL as ct_priority,
            'publisher' as source_type,
            cp.publisher_id as source_id
          FROM campaigns c
          INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
          INNER JOIN locals l ON cp.publisher_id = l.publisher_id
          INNER JOIN totems t ON l.local_id = t.local_id
          WHERE t.totem_id = $1
            AND cp.is_active = true
            AND c.is_active = true
            AND c.status = 'active'
        )
        SELECT 
          tc.campaign_id,
          tc.campaign_title,
          tc.priority,
          tc.start_date,
          tc.end_date,
          tc.start_time,
          tc.end_time,
          tc.days_of_week,
          tc.timezone,
          tc.source_type,
          tc.source_id,
          COALESCE(tc.ct_priority, tc.priority) as effective_priority,
          COALESCE(tc.ct_start_date, tc.start_date) as effective_start_date,
          COALESCE(tc.ct_end_date, tc.end_date) as effective_end_date,
          COALESCE(tc.ct_start_time, tc.start_time) as effective_start_time,
          COALESCE(tc.ct_end_time, tc.end_time) as effective_end_time,
          COALESCE(tc.ct_days_of_week, tc.days_of_week) as effective_days_of_week
        FROM totem_campaigns tc
        WHERE tc.is_active = true
          AND tc.status = 'active'
      `, [totemId]);

      // Buscar playlists associadas a cada campanha
      const candidates: CandidateSchedule[] = [];
      
      for (const campaign of campaigns) {
        // Buscar playlists da campanha
        const playlists = await this.db.findMany(`
          SELECT 
            cp.playlist_id,
            cp.priority as playlist_priority,
            p.name as playlist_name
          FROM campaign_playlists cp
          INNER JOIN playlists p ON cp.playlist_id = p.playlist_id
          WHERE cp.campaign_id = $1
            AND cp.is_active = true
            AND p.is_active = true
          ORDER BY cp.priority DESC, cp.created_at ASC
          LIMIT 1
        `, [campaign.campaign_id]);

        if (playlists.length === 0) {
          continue; // Campanha sem playlist válida
        }

        const playlist = playlists[0];

        // Validar frequência temporal
        const temporalValid = this.validateTemporalFrequency(
          campaign,
          timestamp,
          totemTimezone
        );

        // Calcular score inicial (será refinado em resolveConflicts)
        const score = this.calculateScore(campaign, campaign.source_type === 'direct');

        candidates.push({
          campaignId: campaign.campaign_id,
          campaignTitle: campaign.campaign_title,
          playlistId: playlist.playlist_id,
          playlistName: playlist.playlist_name,
          priority: campaign.effective_priority,
          source: campaign.source_type === 'direct' ? 'direct' : 'campaign',
          sourceId: campaign.source_id,
          scope: campaign.source_type === 'direct' ? 'totem' : 'group',
          temporalValid,
          technicalValid: true, // Será validado depois
          integrityValid: true, // Será validado depois
          createdAt: new Date(campaign.start_date || Date.now()),
          score,
        });
      }

      return candidates;

    } catch (error: any) {
      await logError('[DispatcherTotem] Erro ao buscar candidatos', error, { totemId });
      throw error;
    }
  }

  /**
   * Resolver conflitos: ordenar candidatos e selecionar vencedor
   */
  private async resolveConflicts(
    candidates: CandidateSchedule[]
  ): Promise<CandidateSchedule | null> {
    // Filtrar apenas candidatos temporalmente válidos
    const validCandidates = candidates.filter(c => c.temporalValid);
    
    if (validCandidates.length === 0) {
      return null;
    }

    // Ordenar por:
    // 1. Prioridade (maior = melhor)
    // 2. Escopo (direct > group)
    // 3. Especificidade (menor grupo = melhor)
    // 4. Data de criação (mais recente = melhor)
    validCandidates.sort((a, b) => {
      // 1. Prioridade
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Maior prioridade primeiro
      }
      
      // 2. Escopo (direct vence group)
      if (a.scope !== b.scope) {
        if (a.scope === 'totem') return -1;
        if (b.scope === 'totem') return 1;
      }
      
      // 3. Score (já calculado considerando especificidade)
      if (a.score !== b.score) {
        return b.score - a.score; // Maior score primeiro
      }
      
      // 4. Data de criação (mais recente primeiro)
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return validCandidates[0] || null;
  }

  /**
   * Validar frequência temporal
   */
  private async validateTemporalFrequency(
    campaign: any,
    timestamp: Date,
    timezone: string
  ): Promise<boolean> {
    try {
      // Validar data (start_date e end_date)
      const effectiveStartDate = campaign.effective_start_date 
        ? new Date(campaign.effective_start_date) 
        : null;
      const effectiveEndDate = campaign.effective_end_date 
        ? new Date(campaign.effective_end_date) 
        : null;

      if (effectiveStartDate && timestamp < effectiveStartDate) {
        return false;
      }
      if (effectiveEndDate && timestamp > effectiveEndDate) {
        return false;
      }

      // Validar horário (start_time e end_time)
      const effectiveStartTime = campaign.effective_start_time;
      const effectiveEndTime = campaign.effective_end_time;

      if (effectiveStartTime || effectiveEndTime) {
        const timestampTime = timestamp.toLocaleTimeString('en-US', { 
          hour12: false, 
          timeZone: timezone 
        });
        const [hour, minute] = timestampTime.split(':').map(Number);
        const timestampMinutes = hour * 60 + minute;

        if (effectiveStartTime) {
          const [startHour, startMinute] = effectiveStartTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMinute;
          if (timestampMinutes < startMinutes) {
            return false;
          }
        }

        if (effectiveEndTime) {
          const [endHour, endMinute] = effectiveEndTime.split(':').map(Number);
          const endMinutes = endHour * 60 + endMinute;
          if (timestampMinutes > endMinutes) {
            return false;
          }
        }
      }

      // Validar dias da semana
      const effectiveDaysOfWeek = campaign.effective_days_of_week;
      if (effectiveDaysOfWeek) {
        const daysArray = JSON.parse(effectiveDaysOfWeek);
        if (Array.isArray(daysArray) && daysArray.length > 0) {
          const dayMap: Record<string, number> = {
            'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 0
          };
          const currentDay = timestamp.getDay();
          const dayName = Object.keys(dayMap).find(k => dayMap[k] === currentDay);
          
          if (dayName && !daysArray.includes(dayName)) {
            return false;
          }
        }
      }

      return true;

    } catch (error) {
      await logError('[DispatcherTotem] Erro na validação temporal', error, { campaign });
      return false;
    }
  }

  /**
   * Calcular score do candidato (para ordenação)
   */
  private calculateScore(campaign: any, isDirect: boolean): number {
    let score = campaign.effective_priority || 1;
    
    // Bonus para escopo direto
    if (isDirect) {
      score += 100;
    }
    
    return score;
  }

  /**
   * Validar compatibilidade técnica
   */
  private async validateTechnicalCompatibility(
    candidate: CandidateSchedule,
    totemId: number
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Buscar dados do totem
      const totem = await this.db.findFirst(`
        SELECT 
          t.config,
          t.local_id,
          l.timezone
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        WHERE t.totem_id = $1
      `, [totemId]);

      if (!totem) {
        errors.push('Totem não encontrado');
        return { valid: false, errors };
      }

      // TODO: Implementar validações de:
      // - Resolução compatível
      // - Orientação da tela
      // - Plataforma (WebOS, Android, Browser)
      
      // Por enquanto, retornar válido
      return { valid: true, errors: [] };

    } catch (error: any) {
      errors.push(`Erro na validação técnica: ${error.message}`);
      return { valid: false, errors };
    }
  }

  /**
   * Validar integridade da playlist
   */
  private async validatePlaylistIntegrity(
    playlistId: number
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Buscar itens da playlist
      const items = await this.db.findMany(`
        SELECT 
          pi.media_id,
          pi.order_index,
          pi.duration,
          m.media_id,
          m.file_path,
          m.media_type,
          m.width,
          m.height
        FROM playlist_items pi
        INNER JOIN medias m ON pi.media_id = m.media_id
        WHERE pi.playlist_id = $1
          AND m.status = 'published'
        ORDER BY pi.order_index
      `, [playlistId]);

      if (items.length === 0) {
        errors.push('Playlist vazia ou sem mídias válidas');
        return { valid: false, errors };
      }

      // Validar cada item
      for (const item of items) {
        if (!item.file_path) {
          errors.push(`Mídia ${item.media_id} sem file_path`);
        }
        if (!item.media_type) {
          errors.push(`Mídia ${item.media_id} sem tipo`);
        }
      }

      return { valid: errors.length === 0, errors };

    } catch (error: any) {
      errors.push(`Erro na validação de integridade: ${error.message}`);
      return { valid: false, errors };
    }
  }

  /**
   * Gerar plano de exibição
   */
  private async generateDispatchPlan(
    candidate: CandidateSchedule,
    totemId: number,
    timestamp: Date
  ): Promise<DispatchPlan> {
    // Buscar itens da playlist
    const items = await this.db.findMany(`
      SELECT 
        pi.media_id,
        pi.order_index,
        pi.duration,
        m.media_id,
        m.name,
        m.file_path,
        m.media_type,
        m.width,
        m.height,
        m.mime_type,
        m.duration_seconds
      FROM playlist_items pi
      INNER JOIN medias m ON pi.media_id = m.media_id
      WHERE pi.playlist_id = $1
        AND m.status = 'published'
      ORDER BY pi.order_index
    `, [candidate.playlistId]);

    const mediaItems: DispatchMediaItem[] = items.map(item => ({
      mediaId: item.media_id,
      order: item.order_index,
      duration: item.duration || item.duration_seconds || 10,
      url: item.file_path,
      mediaType: item.media_type,
      metadata: {
        width: item.width,
        height: item.height,
        mimeType: item.mime_type,
      },
    }));

    const totalDuration = mediaItems.reduce((sum, item) => sum + item.duration, 0);

    // Buscar dados da campanha
    const campaign = await this.db.findFirst(`
      SELECT 
        campaign_id,
        title,
        start_date,
        end_date
      FROM campaigns
      WHERE campaign_id = $1
    `, [candidate.campaignId]);

    return {
      totemId,
      timestamp,
      playlistId: candidate.playlistId,
      playlistName: candidate.playlistName,
      mediaItems,
      totalDuration,
      priority: candidate.priority,
      source: candidate.source,
      sourceId: candidate.sourceId,
      sourceName: candidate.campaignTitle,
      validityStart: campaign?.start_date ? new Date(campaign.start_date) : timestamp,
      validityEnd: campaign?.end_date ? new Date(campaign.end_date) : new Date(timestamp.getTime() + 24 * 60 * 60 * 1000),
      metadata: {
        campaignId: candidate.campaignId,
        campaignTitle: campaign?.title,
      },
    };
  }

  /**
   * Gerar chave de cache
   */
  private generateCacheKey(totemId: number, timestamp: Date): string {
    // Arredondar timestamp para o minuto (cache por minuto)
    const roundedTimestamp = new Date(timestamp);
    roundedTimestamp.setSeconds(0);
    roundedTimestamp.setMilliseconds(0);
    
    return `dispatcher:totem:${totemId}:${roundedTimestamp.getTime()}`;
  }

  /**
   * Obter do cache
   */
  private async getFromCache(cacheKey: string): Promise<{ plan: DispatchPlan; candidates?: CandidateSchedule[] } | null> {
    try {
      const cacheService = getCacheService();
      const cached = await cacheService.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      await logError('[DispatcherTotem] Erro ao ler cache', error, { cacheKey });
      return null;
    }
  }

  /**
   * Salvar no cache
   */
  private async saveToCache(
    cacheKey: string,
    data: { plan: DispatchPlan; candidates?: CandidateSchedule[] }
  ): Promise<void> {
    try {
      const cacheService = getCacheService();
      await cacheService.set(
        cacheKey,
        JSON.stringify(data),
        this.cacheConfig.ttlSeconds
      );
    } catch (error) {
      await logError('[DispatcherTotem] Erro ao salvar cache', error, { cacheKey });
      // Não falhar se cache falhar
    }
  }

  /**
   * Registrar log de auditoria
   */
  private async logDispatch(data: {
    totemId: number;
    timestamp: Date;
    selectedCampaignId?: number;
    selectedPlaylistId?: number;
    selectedSource?: 'direct' | 'group' | 'campaign';
    selectedSourceId?: number;
    priority?: number;
    candidatesCount?: number;
    candidates?: CandidateSchedule[];
    temporalValidation?: boolean;
    technicalValidation?: boolean;
    integrityValidation?: boolean;
    validationDetails?: any;
    fromCache: boolean;
    cacheKey?: string;
    plan?: DispatchPlan;
    executionTimeMs: number;
  }): Promise<void> {
    try {
      await this.db.executeRaw(`
        INSERT INTO dispatcher_log (
          totem_id,
          timestamp,
          selected_campaign_id,
          selected_playlist_id,
          selected_source,
          selected_source_id,
          priority,
          candidates_count,
          candidates,
          temporal_validation,
          technical_validation,
          integrity_validation,
          validation_details,
          from_cache,
          cache_key,
          dispatch_plan,
          execution_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        data.totemId,
        data.timestamp,
        data.selectedCampaignId || null,
        data.selectedPlaylistId || null,
        data.selectedSource || null,
        data.selectedSourceId || null,
        data.priority || null,
        data.candidatesCount || 0,
        data.candidates ? JSON.stringify(data.candidates) : null,
        data.temporalValidation ?? null,
        data.technicalValidation ?? null,
        data.integrityValidation ?? null,
        data.validationDetails ? JSON.stringify(data.validationDetails) : null,
        data.fromCache,
        data.cacheKey || null,
        data.plan ? JSON.stringify(data.plan) : null,
        data.executionTimeMs,
      ]);
    } catch (error) {
      await logError('[DispatcherTotem] Erro ao registrar log', error, { totemId: data.totemId });
      // Não falhar se log falhar
    }
  }

  /**
   * Obter histórico de decisões
   */
  async getDispatchHistory(
    totemId: number,
    startDate: Date,
    endDate: Date
  ): Promise<DispatchLogEntry[]> {
    try {
      const logs = await this.db.findMany(`
        SELECT 
          log_id,
          totem_id,
          timestamp,
          selected_campaign_id,
          selected_playlist_id,
          selected_source,
          selected_source_id,
          priority,
          candidates_count,
          candidates,
          temporal_validation,
          technical_validation,
          integrity_validation,
          validation_details,
          from_cache,
          cache_key,
          dispatch_plan,
          execution_time_ms,
          created_at
        FROM dispatcher_log
        WHERE totem_id = $1
          AND timestamp >= $2
          AND timestamp <= $3
        ORDER BY timestamp DESC
        LIMIT 1000
      `, [totemId, startDate, endDate]);

      return logs.map(log => ({
        logId: log.log_id,
        totemId: log.totem_id,
        timestamp: new Date(log.timestamp),
        selectedCampaignId: log.selected_campaign_id,
        selectedPlaylistId: log.selected_playlist_id,
        selectedSource: log.selected_source,
        selectedSourceId: log.selected_source_id,
        priority: log.priority,
        candidatesCount: log.candidates_count,
        candidates: log.candidates ? JSON.parse(log.candidates) : [],
        temporalValidation: log.temporal_validation,
        technicalValidation: log.technical_validation,
        integrityValidation: log.integrity_validation,
        validationDetails: log.validation_details ? JSON.parse(log.validation_details) : undefined,
        fromCache: log.from_cache,
        cacheKey: log.cache_key,
        dispatchPlan: log.dispatch_plan ? JSON.parse(log.dispatch_plan) : undefined,
        executionTimeMs: log.execution_time_ms,
        createdAt: new Date(log.created_at),
      }));

    } catch (error: any) {
      await logError('[DispatcherTotem] Erro ao buscar histórico', error, { totemId });
      throw error;
    }
  }
}

// Singleton instance
let dispatcherTotemServiceInstance: DispatcherTotemService | null = null;

export function getDispatcherTotemService(): DispatcherTotemService {
  if (!dispatcherTotemServiceInstance) {
    dispatcherTotemServiceInstance = new DispatcherTotemService();
  }
  return dispatcherTotemServiceInstance;
}
