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
import { DISABLE_DIRECT_CAMPAIGN_TOTEM } from '../config/featureFlags';
import { isStudioRuntime } from '../config/installationRuntime';
import { isDirectTotemMode } from '../config/directTotemMode';
import { logError, logDebug } from '../utils/loggerHelper';
import { getCacheService } from './cacheService';
import { getTotemPlaylistMixService, TotemPlaylistMix } from './totemPlaylistMixService';
import { getTotemSimpleMixService } from './totemSimpleMixService';
import { isTotemSimpleModeEnabled } from './totemSimpleModeService';
import { buildDispatchMediaItem } from '../utils/dispatchMediaItem';
import { sumDispatchMediaItemsPlanDuration } from '../utils/dispatchItemDuration';
import { enrichDispatchPlanWithGlobalVinhetas } from './dispatchVinhetaEnrichment';
import { getMediaService } from './mediaService';
import {
  DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA,
  DispatchConsolidatedRow,
  interleaveDirectAndPlaylistItems,
} from '../utils/dispatchPlaylistDirectMix';
import {
  buildDispatchPlanVersionFromPlan,
  planVersionCacheKey,
} from '../utils/dispatchPlanVersion';
import {
  DispatchRequest,
  DispatchPlan,
  DispatchMediaItem,
  CandidateSchedule,
  DispatchLogEntry,
  CacheConfig,
  DispatchOptions,
  DispatchResponse,
  DispatchEmptyCheck,
  DispatchEmptyExplanation,
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
      const totemContext = await this.getTotemLogContext(totemId);
      // Normalizar timestamp
      const targetTimestamp = timestamp 
        ? new Date(timestamp) 
        : new Date();

      // Gerar chave de cache
      const cacheKey = this.generateCacheKey(totemId, targetTimestamp);
      
      // Verificar cache (se habilitado e não forçado a ignorar)
      if (this.cacheConfig.enabled && !skipCache && !validateOnly) {
        const cached = await this.getFromCache(cacheKey);
        // Se pedimos candidates, mas o cache não tem candidates (porque foi gerado via /dispatch sem includeCandidates),
        // tratar como cache miss para evitar retorno "vazio" no endpoint /candidates.
        // Além disso, ignorar entradas de cache cujo plano não contenha mídias (mediaItems vazio),
        // pois isso costuma indicar um cache antigo/inconsistente para o player.
        const hasCandidatesData = !includeCandidates || (cached?.candidates && cached.candidates.length > 0);
        const hasMediaItems = !!cached?.plan?.mediaItems && cached.plan.mediaItems.length > 0;
        if (cached && hasCandidatesData && hasMediaItems) {
          await logDebug('[DispatcherTotem] Cache hit', { totem: totemContext, cacheKey });
          const planVersion = await this.rememberPlanVersion(totemId, cached.plan);
          
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
            planVersion,
            candidates: includeCandidates ? cached.candidates : undefined,
            fromCache: true,
            executionTimeMs: Date.now() - startTime,
          };
        }
      }

      // 1. Descobrir candidatos
      const candidates = await this.getCandidateSchedules(totemId, targetTimestamp, timezone);
      
      if (candidates.length === 0) {
        await logDebug('[DispatcherTotem] Nenhum candidato encontrado, tentando playlist consolidada do totem', {
          totem: totemContext,
        });
        const fallbackPlan = await this.getFallbackPlanFromTotemPlaylist(totemId, targetTimestamp);
        if (fallbackPlan) {
          await logDebug('[DispatcherTotem] Usando playlist consolidada (totem_playlists) como fallback', {
            totem: totemContext,
            items: fallbackPlan.mediaItems.length,
            fallbackPlaylist: { id: fallbackPlan.playlistId, name: fallbackPlan.playlistName },
          });
          const planVersion = await this.rememberPlanVersion(totemId, fallbackPlan);
          if (this.cacheConfig.enabled && !validateOnly) {
            await this.saveToCache(cacheKey, { plan: fallbackPlan, candidates: [] });
          }
          return {
            success: true,
            plan: fallbackPlan,
            planVersion,
            candidates: includeCandidates ? [] : undefined,
            fromCache: false,
            executionTimeMs: Date.now() - startTime,
          };
        }
        await logDebug('[DispatcherTotem] Sem candidatos e sem playlist consolidada ativa para o totem', {
          totem: totemContext,
        });
        return {
          success: true,
          plan: undefined,
          candidates: includeCandidates ? [] : undefined,
          fromCache: false,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 1.5. Validar regras comerciais para cada candidato (Fase 1.3)
      const validatedCandidates: CandidateSchedule[] = [];
      for (const candidate of candidates) {
        const commercialValidation = await this.validateCommercialRules(
          candidate,
          totemId,
          targetTimestamp
        );
        
        if (commercialValidation.valid) {
          validatedCandidates.push(candidate);
        } else {
          await logDebug('[DispatcherTotem] Candidato rejeitado por regras comerciais', {
            totem: totemContext,
            candidate: await this.getCandidateLogContext(candidate),
            errors: commercialValidation.errors,
          });
          // Adicionar erros ao candidato para referência
          candidate.validationErrors = [
            ...(candidate.validationErrors || []),
            ...commercialValidation.errors,
          ];
        }
      }

      if (validatedCandidates.length === 0) {
        await logDebug('[DispatcherTotem] Nenhum candidato válido após validação comercial, tentando fallbacks', {
          totem: totemContext,
        });
        const fallbackPlan = await this.getFallbackPlanFromTotemPlaylist(totemId, targetTimestamp);
        if (fallbackPlan) {
          return {
            success: true,
            plan: fallbackPlan,
            candidates: includeCandidates ? candidates : undefined,
            fromCache: false,
            executionTimeMs: Date.now() - startTime,
          };
        }
        return {
          success: true,
          plan: undefined,
          candidates: includeCandidates ? candidates : undefined,
          fromCache: false,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Mix simples quando o totem está em modo simples (round-robin multi-anunciante)
      const simpleModeEnabled = await isTotemSimpleModeEnabled(totemId);
      if (simpleModeEnabled) {
        try {
          const simpleMixPlan = await getTotemSimpleMixService().buildPlan(
            validatedCandidates,
            totemId,
            targetTimestamp,
            { allowSingleSubscriber: true }
          );
          if (simpleMixPlan && simpleMixPlan.mediaItems.length > 0) {
            await logDebug('[DispatcherTotem] Plano mix modo simples', {
              totem: totemContext,
              items: simpleMixPlan.mediaItems.length,
              subscribers: simpleMixPlan.metadata?.subscriberIds,
              simpleMode: true,
            });
            if (this.cacheConfig.enabled && !skipCache && !validateOnly) {
              await this.saveToCache(cacheKey, {
                plan: simpleMixPlan,
                candidates: includeCandidates ? validatedCandidates : undefined,
              });
            }
            await this.logDispatch({
              totemId,
              timestamp: targetTimestamp,
              selectedSource: 'mix',
              selectedSourceId: totemId,
              candidatesCount: validatedCandidates.length,
              candidates: validatedCandidates,
              fromCache: false,
              cacheKey,
              plan: simpleMixPlan,
              executionTimeMs: Date.now() - startTime,
            });
            return {
              success: true,
              plan: simpleMixPlan,
              candidates: includeCandidates ? validatedCandidates : undefined,
              fromCache: false,
              executionTimeMs: Date.now() - startTime,
            };
          }
        } catch (simpleMixError: any) {
          await logError('[DispatcherTotem] Erro no mix modo simples', simpleMixError, {
            totem: totemContext,
          });
        }
      }

      // 2. Decidir estratégia (Fase 1.4)
      const strategy = this.decideStrategy(validatedCandidates);
      await logDebug('[DispatcherTotem] Estratégia decidida', {
        totem: totemContext,
        strategy,
        candidatesCount: validatedCandidates.length,
      });

      // 3. Processar conforme estratégia
      let plan: DispatchPlan | undefined;
      let winner: CandidateSchedule | null = null;

      let mixId: number | undefined = undefined;
      
      if (strategy === 'mix') {
        // Mix simples round-robin (preferido) ou mix ponderado legado
        try {
          const simpleMixPlan = await getTotemSimpleMixService().buildPlan(
            validatedCandidates,
            totemId,
            targetTimestamp
          );
          if (simpleMixPlan && simpleMixPlan.mediaItems.length > 0) {
            plan = simpleMixPlan;
          }
        } catch (simpleMixError: any) {
          await logError('[DispatcherTotem] Mix simples falhou no ramo mix', simpleMixError, {
            totem: totemContext,
          });
        }

        if (!plan?.mediaItems?.length) {
        // FASE 3.1: Usar Mix Service para combinar múltiplas campanhas
        try {
          const mixService = getTotemPlaylistMixService();
          const mix = await mixService.generateMixForTotem(totemId);
          mixId = mix.mix_id;
          
          // Converter TotemPlaylistMix → DispatchPlan
          plan = await this.convertMixToDispatchPlan(mix, totemId, targetTimestamp);
          if (!plan.mediaItems || plan.mediaItems.length === 0) {
            await logDebug('[DispatcherTotem] Mix convertido sem itens; fallback para PRIORITY', {
              totem: totemContext,
              mix: {
                id: mix.mix_id,
                version: mix.mix_version,
                strategy: mix.mix_strategy,
                totalItems: mix.total_items,
              },
            });
            const fallback = await this.tryPriorityPlanFallback(
              validatedCandidates,
              totemId,
              targetTimestamp
            );
            plan = fallback.plan;
            winner = fallback.winner;
          }
          
          await logDebug('[DispatcherTotem] Mix gerado com sucesso', {
            totem: totemContext,
            mix: {
              id: mix.mix_id,
              version: mix.mix_version,
              strategy: mix.mix_strategy,
              totalItems: mix.total_items,
            },
          });
        } catch (mixError: any) {
          await logError('[DispatcherTotem] Erro ao gerar mix', mixError, { totem: totemContext });
          // Fallback: tentar estratégia PRIORITY
          await logDebug('[DispatcherTotem] Fallback para estratégia PRIORITY após erro no mix', {
            totem: totemContext,
          });
          const fallback = await this.tryPriorityPlanFallback(
            validatedCandidates,
            totemId,
            targetTimestamp
          );
          plan = fallback.plan;
          winner = fallback.winner;
        }
        }
      } else {
        // Estratégia SINGLE ou PRIORITY: usar resolução de conflitos tradicional
        winner = await this.resolveConflictsWithValidPlan(validatedCandidates, totemId, targetTimestamp);

        if (!winner) {
          await logDebug('[DispatcherTotem] Nenhum candidato válido após resolução, tentando fallbacks', {
            totem: totemContext,
          });
          const fallbackPlan = await this.getFallbackPlanFromTotemPlaylist(totemId, targetTimestamp);
          if (fallbackPlan) {
            return {
              success: true,
              plan: fallbackPlan,
              candidates: includeCandidates ? validatedCandidates : undefined,
              fromCache: false,
              executionTimeMs: Date.now() - startTime,
            };
          }
          return {
            success: true,
            plan: undefined,
            candidates: includeCandidates ? validatedCandidates : undefined,
            fromCache: false,
            executionTimeMs: Date.now() - startTime,
          };
        }

        // Validar compatibilidade técnica
        const technicalValid = await this.validateTechnicalCompatibility(winner, totemId);
        if (!technicalValid.valid) {
          await logDebug('[DispatcherTotem] Falha na validação técnica', {
            totem: totemContext,
            winner: await this.getCandidateLogContext(winner),
            errors: technicalValid.errors,
          });

          return {
            success: false,
            error: `Validação técnica falhou: ${technicalValid.errors.join(', ')}`,
            candidates: includeCandidates ? validatedCandidates : undefined,
            fromCache: false,
            executionTimeMs: Date.now() - startTime,
          };
        }

        // Gerar plano de exibição (integridade já validada em resolveConflictsWithValidPlan)
        plan = await this.generateDispatchPlan(winner, totemId, targetTimestamp);
      }

      if (!plan) {
        return {
          success: false,
          error: 'Não foi possível gerar plano de exibição',
          candidates: includeCandidates ? validatedCandidates : undefined,
          fromCache: false,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // 6. Salvar no cache
      if (this.cacheConfig.enabled && !validateOnly) {
        await this.saveToCache(cacheKey, {
          plan,
          candidates: includeCandidates ? validatedCandidates : undefined,
        });
      }

      // 7. Registrar log de auditoria
      await this.logDispatch({
        totemId,
        timestamp: targetTimestamp,
        selectedCampaignId: strategy === 'mix' ? undefined : winner?.campaignId,
        selectedPlaylistId: plan.playlistId,
        selectedSource: strategy === 'mix' && !winner ? 'mix' : (winner?.source || 'campaign'),
        selectedSourceId: strategy === 'mix' && !winner ? (mixId || 0) : (winner?.sourceId || 0),
        priority: strategy === 'mix' && !winner ? 0 : (winner?.priority || 0),
        candidatesCount: validatedCandidates.length,
        candidates: includeCandidates ? validatedCandidates : undefined,
        temporalValidation: strategy === 'mix' && !winner ? true : (winner?.temporalValid || false),
        technicalValidation: true, // Já validado antes
        integrityValidation: true, // Já validado antes
        validationDetails: {
          strategy: strategy === 'mix' && winner ? 'priority_fallback' : strategy,
          commercialValidation: true,
        },
        fromCache: false,
        cacheKey,
        plan,
        executionTimeMs: Date.now() - startTime,
      });

      return {
        success: true,
        plan,
        planVersion: await this.rememberPlanVersion(totemId, plan),
        candidates: includeCandidates ? validatedCandidates : undefined,
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
          t.network_info as config,
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
      // Forma 2 (direct) pode ser desabilitada por DISABLE_DIRECT_CAMPAIGN_TOTEM; código preservado.
      // Totens com cadastro desativado: ver `campaignDeliveryPolicy.sqlTotemRegistryActive` (filtros COALESCE(is_active) abaixo).
      const enableDirectLeg = !DISABLE_DIRECT_CAMPAIGN_TOTEM;
      const campaigns = await this.db.findMany(`
        WITH totem_campaigns AS (
          -- Campanhas diretas (via campaign_totems). Desabilitado quando DISABLE_DIRECT_CAMPAIGN_TOTEM=true.
          SELECT DISTINCT
            c.campaign_id,
            c.subscriber_id,
            c.contract_id,
            c.title as campaign_title,
            c.priority,
            c.commercial_tier,
            c.default_time_share_percent,
            c.max_consecutive_slots,
            CAST(c.start_date AS timestamp without time zone) as start_date,
            CAST(c.end_date AS timestamp without time zone) as end_date,
            c.start_time::text,
            c.end_time::text,
            c.days_of_week::text,
            c.timezone,
            c.status,
            c.is_active,
            ct.totem_id,
            CAST(ct.start_date AS timestamp without time zone) as ct_start_date,
            CAST(ct.end_date AS timestamp without time zone) as ct_end_date,
            ct.start_time::text as ct_start_time,
            ct.end_time::text as ct_end_time,
            ct.days_of_week::text as ct_days_of_week,
            ct.priority as ct_priority,
            'direct' as source_type,
            ct.campaign_id as source_id,
            NULL::integer as cp_time_share_percent,
            NULL::integer as cp_max_impressions_per_hour
          FROM campaigns c
          INNER JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
          INNER JOIN totems t_direct ON ct.totem_id = t_direct.totem_id
          INNER JOIN locals l_direct ON t_direct.local_id = l_direct.local_id
          INNER JOIN subscriber_contracts sc_direct ON sc_direct.subscriber_id = c.subscriber_id
            AND sc_direct.status = 'active'
            AND (sc_direct.end_date IS NULL OR sc_direct.end_date >= CURRENT_DATE)
            AND (sc_direct.start_date IS NULL OR sc_direct.start_date <= CURRENT_DATE)
          INNER JOIN plan_publisher_access ppa_direct ON ppa_direct.plan_id = sc_direct.plan_id
            AND ppa_direct.publisher_id = l_direct.publisher_id
            AND ppa_direct.is_allowed = true
            AND COALESCE(ppa_direct.is_active, true) = true
          WHERE ct.totem_id = $1
            AND COALESCE(t_direct.is_active, true) = true
            AND ct.is_active = true
            AND c.is_active = true
            AND c.status = 'active'
            AND ($2::boolean)
          
          UNION
          
          -- Campanhas via publishers (grupo). Elegibilidade por contrato+plano (plan_publisher_access).
          SELECT DISTINCT
            c.campaign_id,
            c.subscriber_id,
            c.contract_id,
            c.title as campaign_title,
            c.priority,
            c.commercial_tier,
            c.default_time_share_percent,
            c.max_consecutive_slots,
            CAST(c.start_date AS timestamp without time zone) as start_date,
            CAST(c.end_date AS timestamp without time zone) as end_date,
            c.start_time::text,
            c.end_time::text,
            c.days_of_week::text,
            c.timezone,
            c.status,
            c.is_active,
            t.totem_id,
            NULL::timestamp without time zone as ct_start_date,
            NULL::timestamp without time zone as ct_end_date,
            NULL::text as ct_start_time,
            NULL::text as ct_end_time,
            NULL::text as ct_days_of_week,
            NULL::integer as ct_priority,
            'publisher' as source_type,
            cp.publisher_id as source_id,
            cp.time_share_percent as cp_time_share_percent,
            cp.max_impressions_per_hour as cp_max_impressions_per_hour
          FROM campaigns c
          INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
          INNER JOIN subscriber_contracts sc_group ON sc_group.subscriber_id = c.subscriber_id
            AND sc_group.status = 'active'
            AND (sc_group.end_date IS NULL OR sc_group.end_date >= CURRENT_DATE)
            AND (sc_group.start_date IS NULL OR sc_group.start_date <= CURRENT_DATE)
          INNER JOIN plan_publisher_access ppa_group ON ppa_group.plan_id = sc_group.plan_id
            AND ppa_group.publisher_id = cp.publisher_id
            AND ppa_group.is_allowed = true
            AND COALESCE(ppa_group.is_active, true) = true
          INNER JOIN locals l ON cp.publisher_id = l.publisher_id
          INNER JOIN totems t ON l.local_id = t.local_id
          WHERE t.totem_id = $1
            AND COALESCE(t.is_active, true) = true
            AND cp.is_active = true
            AND c.is_active = true
            AND c.status = 'active'
          
          UNION
          
          -- Fallback: campanhas via campaign_publishers quando o assinante tem acesso ao publisher
          -- apenas via contrato/plano (plan_publisher_access), sem precisar de subscriber_publisher_access.
          -- Assim o dispatcher considera a campanha mesmo se a reconciliação não tiver rodado.
          SELECT DISTINCT
            c.campaign_id,
            c.subscriber_id,
            c.contract_id,
            c.title as campaign_title,
            c.priority,
            c.commercial_tier,
            c.default_time_share_percent,
            c.max_consecutive_slots,
            CAST(c.start_date AS timestamp without time zone) as start_date,
            CAST(c.end_date AS timestamp without time zone) as end_date,
            c.start_time::text,
            c.end_time::text,
            c.days_of_week::text,
            c.timezone,
            c.status,
            c.is_active,
            t.totem_id,
            NULL::timestamp without time zone as ct_start_date,
            NULL::timestamp without time zone as ct_end_date,
            NULL::text as ct_start_time,
            NULL::text as ct_end_time,
            NULL::text as ct_days_of_week,
            NULL::integer as ct_priority,
            'publisher' as source_type,
            cp.publisher_id as source_id,
            cp.time_share_percent as cp_time_share_percent,
            cp.max_impressions_per_hour as cp_max_impressions_per_hour
          FROM campaigns c
          INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
          INNER JOIN locals l ON cp.publisher_id = l.publisher_id
          INNER JOIN totems t ON l.local_id = t.local_id
          INNER JOIN subscriber_contracts sc ON sc.subscriber_id = c.subscriber_id
            AND sc.status = 'active'
            AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
          INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
            AND ppa.publisher_id = cp.publisher_id
            AND ppa.is_allowed = true
            AND COALESCE(ppa.is_active, true) = true
          WHERE t.totem_id = $1
            AND COALESCE(t.is_active, true) = true
            AND cp.is_active = true
            AND c.is_active = true
            AND c.status = 'active'
          
          UNION
          
          -- Regra por contrato/plano: campanha cujo CONTRATO designado tem um PLANO que permite o publisher do totem.
          -- Não exige campaign_publishers: basta o plano do contrato da campanha incluir o publisher do totem (e contrato válido).
          SELECT DISTINCT
            c.campaign_id,
            c.subscriber_id,
            c.contract_id,
            c.title as campaign_title,
            c.priority,
            c.commercial_tier,
            c.default_time_share_percent,
            c.max_consecutive_slots,
            CAST(c.start_date AS timestamp without time zone) as start_date,
            CAST(c.end_date AS timestamp without time zone) as end_date,
            c.start_time::text,
            c.end_time::text,
            c.days_of_week::text,
            c.timezone,
            c.status,
            c.is_active,
            t_plan.totem_id,
            NULL::timestamp without time zone as ct_start_date,
            NULL::timestamp without time zone as ct_end_date,
            NULL::text as ct_start_time,
            NULL::text as ct_end_time,
            NULL::text as ct_days_of_week,
            NULL::integer as ct_priority,
            'contract_plan' as source_type,
            ppa_plan.publisher_id as source_id,
            NULL::integer as cp_time_share_percent,
            NULL::integer as cp_max_impressions_per_hour
          FROM campaigns c
          INNER JOIN subscriber_contracts sc_plan ON sc_plan.contract_id = c.contract_id
            AND sc_plan.subscriber_id = c.subscriber_id
            AND sc_plan.status = 'active'
            AND (sc_plan.end_date IS NULL OR sc_plan.end_date >= CURRENT_DATE)
            AND (sc_plan.start_date IS NULL OR sc_plan.start_date <= CURRENT_DATE)
          INNER JOIN plan_publisher_access ppa_plan ON ppa_plan.plan_id = sc_plan.plan_id
            AND ppa_plan.is_allowed = true
            AND COALESCE(ppa_plan.is_active, true) = true
          INNER JOIN totems t_plan ON t_plan.totem_id = $1
          INNER JOIN locals l_plan ON l_plan.local_id = t_plan.local_id
            AND l_plan.publisher_id = ppa_plan.publisher_id
          WHERE c.contract_id IS NOT NULL
            AND COALESCE(t_plan.is_active, true) = true
            AND c.is_active = true
            AND c.status = 'active'

          UNION

          -- Multi Lite / SPA: campanhas directas no totem com acesso subscriber_publisher_access
          SELECT DISTINCT
            c.campaign_id,
            c.subscriber_id,
            c.contract_id,
            c.title as campaign_title,
            c.priority,
            c.commercial_tier,
            c.default_time_share_percent,
            c.max_consecutive_slots,
            CAST(c.start_date AS timestamp without time zone) as start_date,
            CAST(c.end_date AS timestamp without time zone) as end_date,
            c.start_time::text,
            c.end_time::text,
            c.days_of_week::text,
            c.timezone,
            c.status,
            c.is_active,
            ct.totem_id,
            CAST(ct.start_date AS timestamp without time zone) as ct_start_date,
            CAST(ct.end_date AS timestamp without time zone) as ct_end_date,
            ct.start_time::text as ct_start_time,
            ct.end_time::text as ct_end_time,
            ct.days_of_week::text as ct_days_of_week,
            ct.priority as ct_priority,
            'direct' as source_type,
            ct.campaign_id as source_id,
            NULL::integer as cp_time_share_percent,
            NULL::integer as cp_max_impressions_per_hour
          FROM campaigns c
          INNER JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
          INNER JOIN totems t_spa_d ON ct.totem_id = t_spa_d.totem_id
          INNER JOIN locals l_spa_d ON t_spa_d.local_id = l_spa_d.local_id
          INNER JOIN subscriber_publisher_access_active spa_d
            ON spa_d.subscriber_id = c.subscriber_id
           AND spa_d.publisher_id = l_spa_d.publisher_id
          WHERE ct.totem_id = $1
            AND COALESCE(t_spa_d.is_active, true) = true
            AND ct.is_active = true
            AND c.is_active = true
            AND c.status = 'active'
            AND ($2::boolean)

          UNION

          -- Multi Lite / SPA: campanhas via publisher com acesso subscriber_publisher_access
          SELECT DISTINCT
            c.campaign_id,
            c.subscriber_id,
            c.contract_id,
            c.title as campaign_title,
            c.priority,
            c.commercial_tier,
            c.default_time_share_percent,
            c.max_consecutive_slots,
            CAST(c.start_date AS timestamp without time zone) as start_date,
            CAST(c.end_date AS timestamp without time zone) as end_date,
            c.start_time::text,
            c.end_time::text,
            c.days_of_week::text,
            c.timezone,
            c.status,
            c.is_active,
            t.totem_id,
            NULL::timestamp without time zone as ct_start_date,
            NULL::timestamp without time zone as ct_end_date,
            NULL::text as ct_start_time,
            NULL::text as ct_end_time,
            NULL::text as ct_days_of_week,
            NULL::integer as ct_priority,
            'publisher' as source_type,
            cp.publisher_id as source_id,
            cp.time_share_percent as cp_time_share_percent,
            cp.max_impressions_per_hour as cp_max_impressions_per_hour
          FROM campaigns c
          INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
          INNER JOIN subscriber_publisher_access_active spa_g
            ON spa_g.subscriber_id = c.subscriber_id
           AND spa_g.publisher_id = cp.publisher_id
          INNER JOIN locals l ON cp.publisher_id = l.publisher_id
          INNER JOIN totems t ON l.local_id = t.local_id
          WHERE t.totem_id = $1
            AND COALESCE(t.is_active, true) = true
            AND cp.is_active = true
            AND c.is_active = true
            AND c.status = 'active'
        )
        SELECT 
          tc.campaign_id,
          tc.subscriber_id,
          tc.contract_id,
          tc.campaign_title,
          tc.priority,
          tc.commercial_tier,
          tc.default_time_share_percent,
          tc.max_consecutive_slots,
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
          COALESCE(tc.ct_days_of_week, tc.days_of_week) as effective_days_of_week,
          COALESCE(tc.cp_time_share_percent, tc.default_time_share_percent, 0) as effective_time_share_percent,
          tc.cp_max_impressions_per_hour as max_impressions_per_hour
        FROM totem_campaigns tc
        WHERE tc.is_active = true
          AND tc.status = 'active'
      `, [totemId, enableDirectLeg]);

      // Buscar playlists associadas a cada campanha
      const candidates: CandidateSchedule[] = [];
      
      for (const campaign of campaigns) {
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
        `, [campaign.campaign_id]);

        const consolidatedPreview = await this.getConsolidatedDispatchItems(campaign.campaign_id);
        if (consolidatedPreview.items.length === 0) {
          await logDebug('[DispatcherTotem] Campanha ignorada: sem mídia reproduzível (playlist vazia e sem diretas)', {
            campaignId: campaign.campaign_id,
            playlistCount: playlists.length,
            playlistItems: consolidatedPreview.playlistItemsCount,
            campaignMedias: consolidatedPreview.campaignMediaCount,
          });
          continue;
        }

        let playlistId = 0;
        let playlistName = '';
        const firstItem = consolidatedPreview.items[0];
        const mediaId = Number(firstItem?.media_id) || undefined;
        const mediaName = firstItem?.name || undefined;

        if (playlists.length === 1) {
          playlistId = Number(playlists[0].playlist_id);
          playlistName = playlists[0].playlist_name || '';
        } else if (playlists.length > 1) {
          playlistId = Number(playlists[0].playlist_id);
          playlistName = `${playlists.length} playlists`;
        } else {
          playlistName = '(mídias diretas)';
        }

        // Validar frequência temporal
        const temporalValid = await this.validateTemporalFrequency(
          campaign,
          timestamp,
          totemTimezone
        );

        // Calcular score inicial (será refinado em resolveConflicts com peso completo)
        const score = this.calculateScore(campaign, campaign.source_type === 'direct');

        candidates.push({
          campaignId: campaign.campaign_id,
          campaignTitle: campaign.campaign_title,
          playlistId,
          playlistName,
          mediaId,
          mediaName,
          priority: campaign.effective_priority,
          source: campaign.source_type === 'direct' ? 'direct' : 'campaign',
          sourceId: campaign.source_id,
          scope: campaign.source_type === 'direct' ? 'totem' : 'group',
          temporalValid,
          technicalValid: true, // Será validado depois
          integrityValid: true, // Será validado depois
          createdAt: new Date(campaign.start_date || Date.now()),
          score,
          // Campos comerciais (Fase 1.1)
          commercialTier: campaign.commercial_tier as 'premium' | 'standard' | 'remnant' | undefined,
          timeSharePercent: campaign.effective_time_share_percent ? Number(campaign.effective_time_share_percent) : undefined,
          maxConsecutiveSlots: campaign.max_consecutive_slots ? Number(campaign.max_consecutive_slots) : undefined,
          maxImpressionsPerHour: campaign.max_impressions_per_hour ? Number(campaign.max_impressions_per_hour) : undefined,
          subscriberId: campaign.subscriber_id ? Number(campaign.subscriber_id) : undefined,
          contractId: campaign.contract_id ? Number(campaign.contract_id) : undefined,
        });
      }

      // Deduplicar por (campaignId, playlistId): a mesma campanha pode vir da perna "direct" (campaign_totems)
      // e das pernas "publisher"/"contract_plan"; manter uma única entrada por campanha+playlist para evitar duplicidade na UI.
      const seen = new Map<string, CandidateSchedule>();
      for (const c of candidates) {
        const key = `${c.campaignId}-${c.playlistId}`;
        if (!seen.has(key)) seen.set(key, c);
        // Opcional: preferir o candidato "direct" quando houver dois para o mesmo par (prioridade ao totem explícito)
        else if (c.source === 'direct') seen.set(key, c);
      }
      const deduped = Array.from(seen.values());

      return deduped;

    } catch (error: any) {
      const totemContext = await this.getTotemLogContext(totemId);
      await logError('[DispatcherTotem] Erro ao buscar candidatos', error, { totem: totemContext });
      throw error;
    }
  }

  /**
   * Fallback: quando não há candidatos (campaign_totems/campaign_publishers), usa a playlist
   * consolidada do totem (totem_playlists + totem_playlist_items) gerada pela tela "Playlists de Totem".
   * Assim o player recebe conteúdo quando a playlist foi regenerada mesmo sem vínculo direto no dispatcher.
   */
  async getFallbackPlanFromTotemPlaylist(totemId: number, timestamp: Date): Promise<DispatchPlan | null> {
    try {
      const directOnly = isDirectTotemMode();
      const tp = await this.db.findFirst(`
        SELECT 
          tp.totem_playlist_id, 
          tp.version, 
          tp.total_items, 
          tp.total_duration_seconds, 
          tp.generated_at
        FROM totem_playlists tp
        WHERE tp.totem_id = $1
          AND COALESCE(tp.is_active, true) = true
          AND COALESCE(tp.status, 'active') = 'active'
          AND ($2::boolean = false OR COALESCE(tp.metadata->>'source', '') = 'direct_totem')
        ORDER BY tp.generated_at DESC NULLS LAST, tp.totem_playlist_id DESC
        LIMIT 1
      `, [totemId, directOnly]);
      if (!tp || !tp.totem_playlist_id) return null;

      const items = await this.db.findMany(`
        SELECT tpi.media_id, tpi.order_index, tpi.display_seconds, tpi.campaign_id
        FROM totem_playlist_items tpi
        WHERE tpi.totem_playlist_id = $1
          AND COALESCE(tpi.is_active, true) = true
        ORDER BY tpi.order_index
      `, [tp.totem_playlist_id]);
      if (!items.length) return null;

      const mediaIds = [...new Set(items.map((i: any) => i.media_id))];
      const medias = await this.db.findMany(`
        SELECT media_id, name, file_name, file_path, media_type, duration_seconds, width, height, mime_type, tags, updated_at, file_size_bytes
        FROM medias
        WHERE media_id = ANY($1::int[]) AND is_active = true
      `, [mediaIds]);
      const mediaMap = new Map(medias.map((m: any) => [m.media_id, m]));
      const mediaService = getMediaService();

      const now = timestamp || new Date();
      const validityEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const mediaItems: DispatchMediaItem[] = items
        .filter((item: any) => {
          const m = mediaMap.get(item.media_id);
          if (!m) return false;
          // Adequação ainda a correr: não enviar ficheiro original virado ao player.
          if (mediaService.isTotemDeliveryPending(m.tags)) return false;
          if (mediaService.hasPendingDeliveryNormalization(Number(item.media_id))) return false;
          return true;
        })
        .map((item: any, index: number) => {
          const m = mediaMap.get(item.media_id);
          const built = buildDispatchMediaItem({
            mediaId: item.media_id,
            order: item.order_index ?? index + 1,
            displaySeconds: item.display_seconds,
            mediaType: m?.media_type,
            durationSeconds: m?.duration_seconds,
            filePath: m?.file_path,
            name: m?.name,
            fileName: m?.file_name,
            width: m?.width,
            height: m?.height,
            mimeType: m?.mime_type,
            tags: m?.tags,
            updatedAt: m?.updated_at,
            fileSizeBytes: m?.file_size_bytes,
          });
          if (!built.url) {
            built.url = `/api/media/${item.media_id}/download`;
          }
          return built;
        });
      if (mediaItems.length === 0) return null;

      const totalDuration = sumDispatchMediaItemsPlanDuration(mediaItems);
      return {
        totemId,
        timestamp: now,
        playlistId: tp.totem_playlist_id,
        playlistName: `Totem #${totemId} (v${tp.version})`,
        mediaItems,
        totalDuration,
        priority: 1,
        source: 'mix',
        sourceId: tp.totem_playlist_id,
        sourceName: `Playlist consolidada totem ${totemId}`,
        validityStart: now,
        validityEnd,
        metadata: {
          mixId: tp.totem_playlist_id,
          mixVersion: tp.version,
          mixStrategy: 'totem_playlist_fallback',
        },
      };
    } catch (error: any) {
      const totemContext = await this.getTotemLogContext(totemId);
      await logError('[DispatcherTotem] Erro ao obter fallback totem_playlists', error, { totem: totemContext });
      return null;
    }
  }

  /**
   * Debug: diagnosticar por que um totem não tem candidatos.
   * Retorna contagens em cada etapa (campanhas diretas / por publisher, com e sem access_active),
   * além de contagens na view subscriber_scheduled_campaigns_playlists_medias para comparação.
   *
   * Importante: esse método NÃO altera a lógica do dispatcher; é apenas para troubleshooting.
   */
  async getDiagnostics(totemId: number): Promise<any> {
    const totemRow = await this.db.findFirst(
      `
      SELECT
        t.totem_id,
        t.local_id,
        l.publisher_id
      FROM totems t
      LEFT JOIN locals l ON t.local_id = l.local_id
      WHERE t.totem_id = $1
      `,
      [totemId]
    );

    const publisherId = totemRow?.publisher_id ? Number(totemRow.publisher_id) : null;

    const accessActiveCount =
      publisherId !== null
        ? await this.db.findFirst(
            `SELECT COUNT(*)::int as count FROM subscriber_publisher_access_active WHERE publisher_id = $1`,
            [publisherId]
          )
        : { count: 0 };

    const viewTotemCount = await this.db.findFirst(
      `SELECT COUNT(*)::int as count FROM subscriber_scheduled_campaigns_playlists_medias WHERE totem_id = $1`,
      [totemId]
    );

    const viewPublisherCount =
      publisherId !== null
        ? await this.db.findFirst(
            `SELECT COUNT(*)::int as count FROM subscriber_scheduled_campaigns_playlists_medias WHERE target_type = 'publisher' AND publisher_id = $1`,
            [publisherId]
          )
        : { count: 0 };

    const directWithoutAccess = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT c.campaign_id)::int as count
      FROM campaigns c
      INNER JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
      WHERE ct.totem_id = $1
        AND ct.is_active = true
        AND c.is_active = true
        AND c.status = 'active'
      `,
      [totemId]
    );

    const directWithAccess =
      publisherId !== null
        ? await this.db.findFirst(
            `
            SELECT COUNT(DISTINCT c.campaign_id)::int as count
            FROM campaigns c
            INNER JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
            INNER JOIN totems t_direct ON ct.totem_id = t_direct.totem_id
            INNER JOIN locals l_direct ON t_direct.local_id = l_direct.local_id
            INNER JOIN subscriber_publisher_access_active spa_direct
              ON spa_direct.subscriber_id = c.subscriber_id
             AND spa_direct.publisher_id = l_direct.publisher_id
            WHERE ct.totem_id = $1
              AND ct.is_active = true
              AND c.is_active = true
              AND c.status = 'active'
            `,
            [totemId]
          )
        : { count: 0 };

    const groupWithoutAccess =
      publisherId !== null
        ? await this.db.findFirst(
            `
            SELECT COUNT(DISTINCT c.campaign_id)::int as count
            FROM campaigns c
            INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
            WHERE cp.publisher_id = $1
              AND cp.is_active = true
              AND c.is_active = true
              AND c.status = 'active'
            `,
            [publisherId]
          )
        : { count: 0 };

    const groupWithAccess =
      publisherId !== null
        ? await this.db.findFirst(
            `
            SELECT COUNT(DISTINCT c.campaign_id)::int as count
            FROM campaigns c
            INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
            INNER JOIN subscriber_publisher_access_active spa_group
              ON spa_group.subscriber_id = c.subscriber_id
             AND spa_group.publisher_id = cp.publisher_id
            WHERE cp.publisher_id = $1
              AND cp.is_active = true
              AND c.is_active = true
              AND c.status = 'active'
            `,
            [publisherId]
          )
        : { count: 0 };

    const directWith = directWithAccess?.count ?? 0;
    const groupWith = groupWithAccess?.count ?? 0;
    const hasCandidates = directWith > 0 || groupWith > 0;
    const suggestion: string[] = [];
    if (!hasCandidates) {
      if (publisherId === null) {
        suggestion.push('Este totem não está vinculado a um local/publisher. Associe o totem a um local que pertença a um publisher.');
      } else {
        suggestion.push('Para o DispatchPlan retornar playlist, a campanha do assinante precisa estar vinculada a este totem ou ao publisher deste totem.');
        suggestion.push('Em Assinantes → Editar Anunciante → CAMPANHAS → editar a campanha → aba PUBLICADORES: adicione o publisher onde este totem está.');
        suggestion.push('Ou use a aba TOTENS e associe este totem diretamente à campanha.');
      }
    }

    return {
      totem: {
        totemId,
        localId: totemRow?.local_id ?? null,
        publisherId,
      },
      counts: {
        subscriberPublisherAccessActiveByPublisher: accessActiveCount?.count ?? 0,
        view: {
          directTotemRows: viewTotemCount?.count ?? 0,
          publisherTargetRows: viewPublisherCount?.count ?? 0,
        },
        dispatcherQuery: {
          directWithoutAccess: directWithoutAccess?.count ?? 0,
          directWithAccess: directWith,
          groupWithoutAccess: groupWithoutAccess?.count ?? 0,
          groupWithAccess: groupWith,
        },
      },
      hasCandidates,
      suggestion,
      notes: [
        'A view subscriber_scheduled_campaigns_playlists_medias não é usada pelo dispatcher; é para auditoria/BI.',
        'O dispatcher filtra por c.status=\'active\' e exige subscriber_publisher_access_active (quando aplicável).',
        'Se "directWithAccess" e "groupWithAccess" forem 0: associe publishers ou totens à campanha do assinante.',
      ],
    };
  }

  /**
   * Explicação estruturada para UI (Monitor Dispatcher) quando o plano não tem itens.
   * Usa a mesma descoberta de candidatos do motor + contagens por etapa (contrato, playlist, plano/local).
   */
  async buildEmptyPlanExplanation(
    totemId: number,
    timestamp: Date,
    timezone?: string
  ): Promise<DispatchEmptyExplanation> {
    const checks: DispatchEmptyCheck[] = [];
    const diagnosticsPath = `/api/dispatcher-totem/${totemId}/diagnostics`;

    const totemRow = await this.db.findFirst(
      `
      SELECT
        t.totem_id,
        COALESCE(t.is_active, true) AS totem_active,
        t.local_id,
        COALESCE(l.is_active, true) AS local_active,
        l.publisher_id
      FROM totems t
      LEFT JOIN locals l ON l.local_id = t.local_id
      WHERE t.totem_id = $1
    `,
      [totemId]
    );

    checks.push({
      id: 'totem_exists',
      label: 'Totem existe na base',
      ok: !!totemRow,
    });
    checks.push({
      id: 'totem_active',
      label: 'Totem ativo (is_active)',
      ok: !!totemRow?.totem_active,
      hint: !totemRow?.totem_active ? 'Ative o totem na gestão de Totens.' : undefined,
    });
    checks.push({
      id: 'totem_local',
      label: 'Totem associado a um local',
      ok: !!totemRow?.local_id,
      hint: !totemRow?.local_id ? 'Associe o totem a um local com publisher.' : undefined,
    });
    checks.push({
      id: 'local_active',
      label: 'Local ativo',
      ok: totemRow?.local_id ? !!totemRow?.local_active : false,
      hint: totemRow?.local_id && !totemRow?.local_active ? 'Ative o local.' : undefined,
    });
    checks.push({
      id: 'local_publisher',
      label: 'Local com publisher',
      ok: !!totemRow?.publisher_id,
      hint: !totemRow?.publisher_id ? 'O local do totem precisa de publisher para regras de plano/contrato.' : undefined,
    });

    const breakdown = await this.buildNoCandidateBreakdownChecks(totemId);
    checks.push(...breakdown);

    const candidates = await this.getCandidateSchedules(totemId, timestamp, timezone);
    checks.push({
      id: 'dispatcher_pipeline',
      label:
        'Motor do dispatcher: campanha candidata após todos os filtros (contrato/plano/publisher/playlist ou mídia direta/tempo)',
      ok: candidates.length > 0,
      hint:
        candidates.length === 0
          ? 'Nenhuma campanha cumpre simultaneamente as regras do SQL do dispatcher para este totem. Revise os itens acima.'
          : undefined,
    });

    let summary: string;

    if (candidates.length === 0) {
      summary =
        'Não há plano com mídia: o dispatcher não encontrou nenhuma campanha elegível neste momento. Veja as verificações abaixo (falhou = precisa correção).';
    } else {
      const commercialFails: string[] = [];
      let anyCommercialOk = false;
      for (const c of candidates) {
        const v = await this.validateCommercialRules(c, totemId, timestamp);
        if (v.valid) anyCommercialOk = true;
        else commercialFails.push(...(v.errors || []));
      }
      checks.push({
        id: 'commercial_rules',
        label: 'Regras comerciais (acesso subscriber↔publisher, contrato, limites)',
        ok: anyCommercialOk,
        hint:
          !anyCommercialOk && commercialFails.length
            ? [...new Set(commercialFails)].slice(0, 6).join(' · ')
            : undefined,
      });

      const temporalOk = candidates.some((c) => c.temporalValid);
      checks.push({
        id: 'temporal_window',
        label: 'Janela temporal (dia/hora) permite exibição agora',
        ok: temporalOk,
        hint: !temporalOk ? 'Ajuste datas/horários da campanha ou de campaign_totems.' : undefined,
      });

      if (!anyCommercialOk) {
        summary =
          'Há campanhas candidatas no motor, mas todas falharam na validação comercial (acesso/contrato/limites).';
      } else if (!temporalOk) {
        summary =
          'Há campanhas válidas comercialmente, mas nenhuma está dentro da janela de tempo atual.';
      } else {
        summary =
          'Há candidatos válidos, mas o plano final não foi gerado (mix, validação técnica ou integridade). Consulte os logs do servidor.';
      }
    }

    return {
      summary,
      checks,
      diagnosticsPath,
    };
  }

  /**
   * Contagens por etapa para campanhas ligadas a este totem (caminho direto campaign_totems).
   */
  private async buildNoCandidateBreakdownChecks(totemId: number): Promise<DispatchEmptyCheck[]> {
    const checks: DispatchEmptyCheck[] = [];

    const linkCt = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS c
      FROM campaign_totems
      WHERE totem_id = $1 AND COALESCE(is_active, true)
    `,
      [totemId]
    );
    checks.push({
      id: 'campaign_totems_link',
      label: 'Vínculo campanha ↔ totem (campaign_totems ativo)',
      ok: (linkCt?.c ?? 0) > 0,
      hint:
        (linkCt?.c ?? 0) === 0
          ? 'Associe o totem à campanha (aba Totens) ou um publisher que inclua o local deste totem.'
          : undefined,
    });

    const campActive = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS c
      FROM campaign_totems ct
      INNER JOIN campaigns c ON c.campaign_id = ct.campaign_id
      WHERE ct.totem_id = $1
        AND COALESCE(ct.is_active, true)
        AND COALESCE(c.is_active, true)
        AND LOWER(COALESCE(c.status, '')) = 'active'
    `,
      [totemId]
    );
    checks.push({
      id: 'campaign_status_active',
      label: 'Campanha com status "active" e is_active',
      ok: (campActive?.c ?? 0) > 0,
      hint:
        (campActive?.c ?? 0) === 0
          ? 'Ative a campanha: status deve ser active e is_active verdadeiro.'
          : undefined,
    });

    const withPlaylist = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT c.campaign_id)::int AS c
      FROM campaign_totems ct
      INNER JOIN campaigns c ON c.campaign_id = ct.campaign_id
      WHERE ct.totem_id = $1
        AND COALESCE(ct.is_active, true)
        AND COALESCE(c.is_active, true)
        AND LOWER(COALESCE(c.status, '')) = 'active'
        AND (
          EXISTS (
            SELECT 1
            FROM campaign_playlists cp
            INNER JOIN playlists p ON p.playlist_id = cp.playlist_id
            WHERE cp.campaign_id = c.campaign_id
              AND COALESCE(cp.is_active, true)
              AND COALESCE(p.is_active, true)
          )
          OR EXISTS (
            SELECT 1
            FROM campaign_medias cm
            INNER JOIN medias m ON m.media_id = cm.media_id
            WHERE cm.campaign_id = c.campaign_id
              AND COALESCE(cm.is_active, true)
              AND COALESCE(m.is_active, true)
          )
        )
    `,
      [totemId]
    );
    checks.push({
      id: 'campaign_playlist',
      label: 'Campanha com playlist ativa ou mídias diretas associadas',
      ok: (withPlaylist?.c ?? 0) > 0,
      hint:
        (withPlaylist?.c ?? 0) === 0
          ? 'Associe uma playlist ativa ou mídias diretas à campanha.'
          : undefined,
    });

    const withMedia = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT c.campaign_id)::int AS c
      FROM campaign_totems ct
      INNER JOIN campaigns c ON c.campaign_id = ct.campaign_id
      WHERE ct.totem_id = $1
        AND COALESCE(ct.is_active, true)
        AND COALESCE(c.is_active, true)
        AND LOWER(COALESCE(c.status, '')) = 'active'
        AND (
          EXISTS (
            SELECT 1
            FROM campaign_playlists cp
            INNER JOIN playlists p ON p.playlist_id = cp.playlist_id
            INNER JOIN playlist_items pi ON pi.playlist_id = p.playlist_id
              AND COALESCE(pi.is_active, true) = true
            INNER JOIN medias m ON m.media_id = pi.media_id
              AND COALESCE(m.is_active, true)
              AND m.status IN ('approved', 'published')
            WHERE cp.campaign_id = c.campaign_id
              AND COALESCE(cp.is_active, true)
              AND COALESCE(p.is_active, true)
          )
          OR EXISTS (
            SELECT 1
            FROM campaign_medias cm
            INNER JOIN medias m ON m.media_id = cm.media_id
            WHERE cm.campaign_id = c.campaign_id
              AND COALESCE(cm.is_active, true) = true
              AND COALESCE(m.is_active, true)
              AND m.status IN ('approved', 'published')
          )
        )
    `,
      [totemId]
    );
    checks.push({
      id: 'playlist_media',
      label: 'Pelo menos uma mídia ativa (playlist ou direta na campanha)',
      ok: (withMedia?.c ?? 0) > 0,
      hint:
        (withMedia?.c ?? 0) === 0
          ? 'Adicione mídias à campanha (diretas ou via playlist) e ative/aprove as mídias.'
          : undefined,
    });

    const contractOk = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT c.campaign_id)::int AS c
      FROM campaign_totems ct
      INNER JOIN campaigns c ON c.campaign_id = ct.campaign_id
      LEFT JOIN subscriber_contracts sc ON sc.contract_id = c.contract_id AND sc.subscriber_id = c.subscriber_id
      WHERE ct.totem_id = $1
        AND COALESCE(ct.is_active, true)
        AND COALESCE(c.is_active, true)
        AND LOWER(COALESCE(c.status, '')) = 'active'
        AND (
          c.contract_id IS NULL
          OR (
            sc.contract_id IS NOT NULL
            AND LOWER(COALESCE(sc.status, '')) = 'active'
            AND COALESCE(sc.is_active, true)
            AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
            AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
          )
        )
    `,
      [totemId]
    );
    checks.push({
      id: 'contract_active',
      label: 'Contrato ativo e em vigência (quando a campanha tem contract_id)',
      ok: (contractOk?.c ?? 0) > 0,
      hint:
        (contractOk?.c ?? 0) === 0
          ? 'Vincule contrato ativo (datas válidas) ou ajuste o contract_id da campanha.'
          : undefined,
    });

    const withContract = await this.db.findFirst(
      `
      SELECT COUNT(*)::int AS c
      FROM campaign_totems ct
      INNER JOIN campaigns c ON c.campaign_id = ct.campaign_id
      WHERE ct.totem_id = $1
        AND COALESCE(ct.is_active, true)
        AND COALESCE(c.is_active, true)
        AND LOWER(COALESCE(c.status, '')) = 'active'
        AND c.contract_id IS NOT NULL
    `,
      [totemId]
    );

    if ((withContract?.c ?? 0) > 0) {
      const planAccess = await this.db.findFirst(
        `
        SELECT COUNT(DISTINCT c.campaign_id)::int AS c
        FROM campaign_totems ct
        INNER JOIN campaigns c ON c.campaign_id = ct.campaign_id
        INNER JOIN totems t ON t.totem_id = ct.totem_id
        INNER JOIN locals l ON l.local_id = t.local_id
        INNER JOIN subscriber_contracts sc ON sc.contract_id = c.contract_id AND sc.subscriber_id = c.subscriber_id
        INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
          AND ppa.publisher_id = l.publisher_id
          AND ppa.is_allowed = true
          AND COALESCE(ppa.is_active, true) = true
        INNER JOIN plan_local_access pla ON pla.plan_id = sc.plan_id
          AND pla.local_id = l.local_id
          AND pla.is_allowed = true
          AND COALESCE(pla.is_active, true) = true
        WHERE ct.totem_id = $1
          AND COALESCE(ct.is_active, true)
          AND COALESCE(c.is_active, true)
          AND LOWER(COALESCE(c.status, '')) = 'active'
          AND LOWER(COALESCE(sc.status, '')) = 'active'
          AND COALESCE(sc.is_active, true)
          AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
          AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
      `,
        [totemId]
      );
      checks.push({
        id: 'plan_publisher_and_local',
        label: 'Plano do contrato permite publisher do local E local na lista plan_local_access',
        ok: (planAccess?.c ?? 0) > 0,
        hint:
          (planAccess?.c ?? 0) === 0
            ? 'Configure plan_publisher_access (plano → publisher) e plan_local_access (plano → local do totem).'
            : undefined,
      });
    } else {
      checks.push({
        id: 'plan_publisher_and_local',
        label: 'Plano do contrato: publisher + local (plan_local_access)',
        ok: true,
        hint: 'Nenhuma campanha ligada a este totem tem contract_id; esta verificação não se aplica ao caminho direto.',
      });
    }

    return checks;
  }

  /**
   * Escolhe o melhor candidato cujo conteúdo consolidado (playlist + mídias diretas) é reproduzível.
   */
  private async resolveConflictsWithValidPlan(
    candidates: CandidateSchedule[],
    totemId: number,
    timestamp: Date
  ): Promise<CandidateSchedule | null> {
    let remaining = candidates.filter((c) => c.temporalValid);
    const tried = new Set<string>();

    while (remaining.length > 0) {
      const winner = await this.resolveConflicts(remaining, totemId, timestamp);
      if (!winner) return null;

      const key = `${winner.campaignId}-${winner.playlistId}`;
      if (tried.has(key)) break;
      tried.add(key);

      const integrityValid = await this.validatePlaylistIntegrity(winner.playlistId, winner.campaignId);
      if (integrityValid.valid) {
        return winner;
      }

      await logDebug('[DispatcherTotem] Candidato descartado por integridade; tentando próximo', {
        campaignId: winner.campaignId,
        playlistId: winner.playlistId,
        errors: integrityValid.errors,
      });

      remaining = remaining.filter(
        (c) => !(c.campaignId === winner.campaignId && c.playlistId === winner.playlistId)
      );
    }

    return null;
  }

  /**
   * FASE 2.2: Resolver conflitos usando peso completo calculado
   */
  private async resolveConflicts(
    candidates: CandidateSchedule[],
    totemId?: number,
    timestamp?: Date
  ): Promise<CandidateSchedule | null> {
    // Filtrar apenas candidatos temporalmente válidos
    const validCandidates = candidates.filter(c => c.temporalValid);
    
    if (validCandidates.length === 0) {
      return null;
    }

    // Calcular peso completo para cada candidato (Fase 2.1) se totemId e timestamp disponíveis
    const candidatesWithWeight = await Promise.all(
      validCandidates.map(async (candidate) => {
        const weight = totemId && timestamp
          ? await this.calculateWeight(candidate, totemId, timestamp)
          : candidate.score; // Fallback para score simples se não tiver totemId/timestamp
        
        return {
          ...candidate,
          weight, // Adicionar peso calculado
        };
      })
    );

    // Ordenar por:
    // 1. Peso calculado (maior = melhor) - NOVO na Fase 2
    // 2. Escopo (direct > group)
    // 3. Prioridade (maior = melhor)
    // 4. Data de criação (mais recente = melhor)
    candidatesWithWeight.sort((a, b) => {
      // 1. Peso calculado (Fase 2)
      if (a.weight !== b.weight) {
        return b.weight - a.weight; // Maior peso primeiro
      }
      
      // 2. Escopo (direct vence group)
      if (a.scope !== b.scope) {
        if (a.scope === 'totem') return -1;
        if (b.scope === 'totem') return 1;
      }
      
      // 3. Prioridade
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Maior prioridade primeiro
      }
      
      // 4. Data de criação (mais recente primeiro)
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return candidatesWithWeight[0] || null;
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
      logError('[DispatcherTotem] Erro na validação temporal', error, { campaign });
      return false;
    }
  }

  /**
   * Calcular score do candidato (para ordenação)
   * TODO: Será substituído por calculateWeight() na Fase 2
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
   * FASE 2.1: Calcular peso completo do candidato
   * Considera: prioridade, tier comercial, time share, horário, tags, subscriber, IA
   */
  private async calculateWeight(
    candidate: CandidateSchedule,
    totemId: number,
    _timestamp: Date
  ): Promise<number> {
    let weight = 0;
    
    // Pesos padrão (se não houver regra de mixagem)
    const defaultPriorityWeight = 1.0;
    const defaultTimeWeight = 1.0;
    const defaultSubscriberWeight = 0.5;
    
    // Tentar obter regra de mixagem do totem (opcional)
    let rule: any = null;
    let aiContext: any = null;
    
    try {
      const mixService = getTotemPlaylistMixService();
      rule = await mixService.getMixRuleForTotem(totemId);
      
      if (rule && (rule.ai_enabled || rule.rule_type === 'ai' || rule.rule_type === 'hybrid')) {
        aiContext = await mixService.getAIContextForTotem(totemId);
      }
    } catch (error) {
      // Se não conseguir obter regra, usar valores padrão
      await logDebug('[DispatcherTotem] Usando pesos padrão (regra não disponível)', {
        totem: await this.getTotemLogContext(totemId),
      });
    }
    
    const priorityWeight = rule?.priority_weight || defaultPriorityWeight;
    const timeWeight = rule?.time_weight || defaultTimeWeight;
    const subscriberWeight = rule?.subscriber_weight || defaultSubscriberWeight;
    
    // 1. Peso por prioridade da campanha
    weight += candidate.priority * priorityWeight;
    
    // 2. Peso por tier comercial (premium > standard > remnant)
    const tierWeights: Record<string, number> = {
      premium: 3,
      standard: 2,
      remnant: 1,
    };
    const tierWeight = tierWeights[candidate.commercialTier || 'standard'] || 2;
    weight += tierWeight * priorityWeight;
    
    // 3. Peso por time share percent
    if (candidate.timeSharePercent && candidate.timeSharePercent > 0) {
      const timeShareFactor = (candidate.timeSharePercent / 100) * 10;
      weight += timeShareFactor * timeWeight;
    }
    
    // 4. Peso por horário (se aplicável)
    if (timeWeight > 0) {
      // Verificar se está dentro do horário válido da campanha
      // (isso já foi validado em validateTemporalFrequency, mas podemos dar bonus aqui)
      if (candidate.temporalValid) {
        weight += timeWeight * 0.5; // Bonus menor que time share
      }
    }
    
    // 5. Peso por subscriber (se aplicável)
    if (subscriberWeight > 0 && candidate.subscriberId) {
      weight += subscriberWeight * 0.5;
    }
    
    // 6. Bonus para escopo direto (totem específico)
    if (candidate.scope === 'totem') {
      weight += 100; // Bonus significativo para agendamento direto
    }
    
    // 7. Ajustes baseados em IA (se disponível)
    if (aiContext && rule && (rule.ai_enabled || rule.rule_type === 'ai' || rule.rule_type === 'hybrid')) {
      // Ajuste por densidade de transeuntes
      if (rule.use_pedestrian_detection && aiContext.pedestrian_count > 0) {
        const densityMultiplier = aiContext.pedestrian_density === 'high' ? 1.5 :
                                 aiContext.pedestrian_density === 'medium' ? 1.2 : 1.0;
        weight *= densityMultiplier;
      }
      
      // Ajuste por sentimento
      if (rule.use_sentiment_analysis && aiContext.sentiment_score !== undefined) {
        const sentimentMultiplier = 1.0 + (aiContext.sentiment_score * 0.3);
        weight *= sentimentMultiplier;
      }
      
      // Ajuste por performance histórica
      if (rule.use_historical_optimization && aiContext.performance_metrics) {
        const engagementRate = aiContext.performance_metrics.engagement_rate || 0;
        const performanceMultiplier = 1.0 + (engagementRate * 0.2);
        weight *= performanceMultiplier;
      }
    }
    
    return Math.max(0, weight);
  }

  /**
   * FASE 1.3: Validar regras comerciais
   * - **Pro (padrão):** acesso explícito `subscriber_publisher_access` entre subscriber e publisher do local do totem.
   * - **Compact:** com `contract_id` na campanha, o vínculo comercial segue o contrato escolhido + `plan_publisher_access`
   *   e `plan_local_access` (mesma regra que `getTotemsBySubscriberContract`), sem exigir linha em `subscriber_publisher_access`.
   *   Sem contrato na campanha, mantém-se a verificação via `subscriber_publisher_access` como fallback.
   */
  private async validateCommercialRules(
    candidate: CandidateSchedule,
    totemId: number,
    timestamp: Date
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // 1. Acesso comercial subscriber ↔ totem (publisher/local)
      if (candidate.subscriberId) {
        const usePlanInsteadOfSpa =
          isStudioRuntime() &&
          candidate.contractId != null &&
          !Number.isNaN(Number(candidate.contractId));

        if (usePlanInsteadOfSpa) {
          const planAccess = await this.db.findFirst(
            `
            SELECT 1 AS ok
            FROM totems t
            INNER JOIN locals l ON l.local_id = t.local_id AND COALESCE(l.is_active, true) = true
            INNER JOIN subscriber_contracts sc ON sc.contract_id = $2
              AND sc.subscriber_id = $3
              AND LOWER(COALESCE(sc.status, '')) IN ('active', 'approved')
              AND COALESCE(sc.is_active, true) = true
              AND sc.plan_id IS NOT NULL
              AND (sc.start_date IS NULL OR sc.start_date::date <= ($4::timestamptz)::date)
              AND (sc.end_date IS NULL OR sc.end_date::date >= ($4::timestamptz)::date)
            INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
              AND ppa.publisher_id = l.publisher_id
              AND ppa.is_allowed = true
              AND COALESCE(ppa.is_active, true) = true
            INNER JOIN plan_local_access pla ON pla.plan_id = sc.plan_id
              AND pla.local_id = l.local_id
              AND pla.is_allowed = true
              AND COALESCE(pla.is_active, true) = true
            WHERE t.totem_id = $1
              AND COALESCE(t.is_active, true) = true
            LIMIT 1
          `,
            [totemId, candidate.contractId, candidate.subscriberId, timestamp]
          );

          if (!planAccess) {
            errors.push(
              'Modo compacto: o plano do contrato desta campanha não autoriza este totem (publisher/local). Verifique plan_publisher_access e plan_local_access.'
            );
          }
        } else {
          const access = await this.db.findFirst(`
          SELECT 
            spa.access_id,
            spa.expires_at,
            spa.is_active
          FROM subscriber_publisher_access spa
          INNER JOIN totems t ON t.local_id IN (
            SELECT l.local_id 
            FROM locals l 
            WHERE l.publisher_id = spa.publisher_id
          )
          WHERE spa.subscriber_id = $1
            AND t.totem_id = $2
            AND spa.is_active = true
            AND (spa.expires_at IS NULL OR spa.expires_at > $3)
          LIMIT 1
        `, [candidate.subscriberId, totemId, timestamp]);
        
        if (!access) {
          errors.push('Anunciante não tem acesso a esta organização');
        }
        }
      }
      
      // 2. Verificar se contrato está ativo
      if (candidate.contractId) {
        const contract = await this.db.findFirst(`
          SELECT 
            contract_id,
            start_date,
            end_date,
            status
          FROM subscriber_contracts
          WHERE contract_id = $1
        `, [candidate.contractId]);
        
        if (!contract) {
          errors.push('Contrato não encontrado');
        } else {
          const contractStart = contract.start_date ? new Date(contract.start_date) : null;
          const contractEnd = contract.end_date ? new Date(contract.end_date) : null;
          
          if (contractStart && timestamp < contractStart) {
            errors.push('Contrato ainda não está ativo');
          }
          if (contractEnd && timestamp > contractEnd) {
            errors.push('Contrato expirado');
          }
          if (contract.status !== 'active' && contract.status !== 'approved') {
            errors.push(`Contrato não está ativo (status: ${contract.status})`);
          }
        }
      }
      
      // 3. Verificar limite de impressões por hora
      if (candidate.maxImpressionsPerHour && candidate.maxImpressionsPerHour > 0) {
        const hourStart = new Date(timestamp);
        hourStart.setMinutes(0, 0, 0);
        const hourEnd = new Date(hourStart);
        hourEnd.setHours(hourStart.getHours() + 1);
        
        const impressionsCount = await this.db.findFirst(`
          SELECT COUNT(*) as count
          FROM dispatcher_log
          WHERE totem_id = $1
            AND selected_campaign_id = $2
            AND timestamp >= $3
            AND timestamp < $4
        `, [totemId, candidate.campaignId, hourStart, hourEnd]);
        
        const count = impressionsCount?.count ? Number(impressionsCount.count) : 0;
        if (count >= candidate.maxImpressionsPerHour) {
          errors.push(`Limite de impressões por hora atingido (${count}/${candidate.maxImpressionsPerHour})`);
        }
      }
      
      return { valid: errors.length === 0, errors };
      
    } catch (error: any) {
      await logError('[DispatcherTotem] Erro na validação comercial', error, {
        totem: await this.getTotemLogContext(totemId),
        candidate: await this.getCandidateLogContext(candidate),
      });
      return { valid: false, errors: [`Erro na validação comercial: ${error.message}`] };
    }
  }

  /**
   * FASE 1.4: Decidir estratégia de dispatch
   * SINGLE: apenas 1 candidato válido
   * PRIORITY: múltiplos candidatos, mas há vencedor claro por prioridade
   * MIX: múltiplos candidatos com mesma prioridade OU time_share_percent > 0
   */
  private decideStrategy(
    candidates: CandidateSchedule[]
  ): 'single' | 'priority' | 'mix' {
    if (candidates.length === 0) {
      return 'single'; // Nenhum candidato = plano vazio
    }
    
    if (candidates.length === 1) {
      return 'single'; // Apenas um candidato = plano único
    }
    
    // Filtrar apenas candidatos temporalmente válidos
    const validCandidates = candidates.filter(c => c.temporalValid);
    
    if (validCandidates.length === 0) {
      return 'single'; // Nenhum válido = plano vazio
    }
    
    if (validCandidates.length === 1) {
      return 'single'; // Apenas um válido = plano único
    }

    const uniqueSubscribers = new Set(
      validCandidates
        .map((c) => Number(c.subscriberId))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    if (uniqueSubscribers.size > 1) {
      return 'mix'; // Vários anunciantes → mixar campanhas na playlist final
    }
    
    // Verificar se algum tem time_share_percent > 0
    const hasTimeShare = validCandidates.some(
      c => (c.timeSharePercent || 0) > 0
    );
    
    if (hasTimeShare) {
      return 'mix'; // Time share requer mix
    }
    
    // Verificar prioridades
    const priorities = validCandidates.map(c => c.priority);
    const maxPriority = Math.max(...priorities);
    const candidatesWithMaxPriority = validCandidates.filter(
      c => c.priority === maxPriority
    );
    
    if (candidatesWithMaxPriority.length === 1) {
      return 'priority'; // Apenas um com prioridade máxima
    }
    
    // Verificar se todos têm mesma prioridade
    if (priorities.every(p => p === maxPriority)) {
      return 'mix'; // Mesma prioridade = mixar
    }
    
    // Por padrão, usar prioridade (vencedor único)
    return 'priority';
  }

  /**
   * Validar compatibilidade técnica
   */
  private async validateTechnicalCompatibility(
    _candidate: CandidateSchedule,
    totemId: number
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Buscar dados do totem
      const totem = await this.db.findFirst(`
        SELECT 
          t.network_info as config,
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
    playlistId: number,
    campaignId?: number
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const consolidated = campaignId
        ? await this.getConsolidatedDispatchItems(campaignId)
        : await this.getConsolidatedDispatchItemsFromPlaylistOnly(playlistId);
      const items = consolidated.items;

      if (items.length === 0) {
        errors.push('Playlist/campanha sem mídias válidas para dispatch');
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
   * Expõe consolidação de mídias da campanha para serviços auxiliares (mix simples).
   */
  async consolidateCampaignForDispatch(campaignId: number) {
    return this.getConsolidatedDispatchItems(campaignId);
  }

  /**
   * Consolida mídias de todas as playlists da campanha + campaign_medias.
   * Quando ambos existem, intercala N mídias diretas : 1 item de playlist
   * (N = fallbackPropagandasPerVinheta do player, default 3).
   */
  private async getConsolidatedDispatchItems(
    campaignId: number,
    mixRatio: number = DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA
  ): Promise<{
    items: DispatchConsolidatedRow[];
    playlistItemsCount: number;
    campaignMediaCount: number;
    playlistDirectMixApplied: boolean;
    playlistDirectMixRatio: number;
    campaignPlaylistCount: number;
  }> {
    const playlistRows = await this.db.findMany(
      `
      SELECT
        pi.media_id,
        pi.order_index,
        pi.display_seconds as duration,
        m.name,
        m.file_name,
        m.file_path,
        m.media_type,
        m.tags,
        m.width,
        m.height,
        m.mime_type,
        m.duration_seconds,
        m.updated_at,
        m.file_size_bytes,
        cp.priority as playlist_priority,
        cp.created_at as playlist_linked_at,
        cp.playlist_id
      FROM campaign_playlists cp
      INNER JOIN playlist_items pi ON pi.playlist_id = cp.playlist_id
      INNER JOIN medias m ON m.media_id = pi.media_id
      WHERE cp.campaign_id = $1
        AND cp.is_active = true
        AND COALESCE(pi.is_active, true) = true
        AND m.is_active = true
        AND m.status IN ('approved', 'published')
      ORDER BY cp.priority DESC, cp.created_at ASC, pi.order_index ASC, m.media_id ASC
    `,
      [campaignId]
    );

    const campaignItems = await this.db.findMany(
      `
          SELECT 
            cm.media_id,
            cm.order_index,
            cm.display_seconds as duration,
            m.name,
            m.file_name,
            m.file_path,
            m.media_type,
            m.tags,
            m.width,
            m.height,
            m.mime_type,
            m.duration_seconds,
            m.updated_at,
            m.file_size_bytes
          FROM campaign_medias cm
          INNER JOIN medias m ON cm.media_id = m.media_id
          WHERE cm.campaign_id = $1
            AND COALESCE(cm.is_active, true) = true
            AND m.is_active = true
            AND m.status IN ('approved', 'published')
          ORDER BY cm.order_index ASC, m.media_id ASC
        `,
      [campaignId]
    );

    const normalizedPlaylist = playlistRows.map((item: any) => ({
      media_id: Number(item.media_id),
      order_index: Number(item.order_index ?? 0),
      duration: item.duration,
      name: item.name,
      file_name: item.file_name,
      file_path: item.file_path,
      media_type: item.media_type,
      tags: item.tags,
      width: item.width,
      height: item.height,
      mime_type: item.mime_type,
      duration_seconds: item.duration_seconds,
      updated_at: item.updated_at,
      file_size_bytes: item.file_size_bytes,
      source: 'playlist' as const,
      source_priority: 0,
    }));

    const normalizedCampaign = campaignItems.map((item: any) => ({
      media_id: Number(item.media_id),
      order_index: Number(item.order_index ?? 0),
      duration: item.duration,
      name: item.name,
      file_name: item.file_name,
      file_path: item.file_path,
      media_type: item.media_type,
      tags: item.tags,
      width: item.width,
      height: item.height,
      mime_type: item.mime_type,
      duration_seconds: item.duration_seconds,
      updated_at: item.updated_at,
      file_size_bytes: item.file_size_bytes,
      source: 'campaign' as const,
      source_priority: 1,
    }));

    const campaignPlaylistCount = new Set(
      playlistRows.map((row: { playlist_id?: number }) => Number(row.playlist_id)).filter((id) => id > 0)
    ).size;

    const playlistDirectMixApplied =
      normalizedPlaylist.length > 0 && normalizedCampaign.length > 0;

    const items = playlistDirectMixApplied
      ? interleaveDirectAndPlaylistItems(normalizedCampaign, normalizedPlaylist, mixRatio)
      : normalizedPlaylist.length > 0
        ? normalizedPlaylist
        : normalizedCampaign;

    return {
      items,
      playlistItemsCount: normalizedPlaylist.length,
      campaignMediaCount: normalizedCampaign.length,
      playlistDirectMixApplied,
      playlistDirectMixRatio: Math.max(1, Math.floor(mixRatio || DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA)),
      campaignPlaylistCount,
    };
  }

  /** Fallback quando só há playlistId (sem campanha) — mantém ordem linear da playlist. */
  private async getConsolidatedDispatchItemsFromPlaylistOnly(playlistId: number): Promise<{
    items: DispatchConsolidatedRow[];
    playlistItemsCount: number;
    campaignMediaCount: number;
    playlistDirectMixApplied: boolean;
    playlistDirectMixRatio: number;
    campaignPlaylistCount: number;
  }> {
    const playlistItems =
      playlistId > 0
        ? await this.db.findMany(
            `
      SELECT 
        pi.media_id,
        pi.order_index,
        pi.display_seconds as duration,
        m.name,
        m.file_name,
        m.file_path,
        m.media_type,
        m.tags,
        m.width,
        m.height,
        m.mime_type,
        m.duration_seconds,
        m.updated_at,
        m.file_size_bytes
      FROM playlist_items pi
      INNER JOIN medias m ON pi.media_id = m.media_id
      WHERE pi.playlist_id = $1
        AND COALESCE(pi.is_active, true) = true
        AND m.is_active = true
        AND m.status IN ('approved', 'published')
      ORDER BY pi.order_index ASC, m.media_id ASC
    `,
            [playlistId]
          )
        : [];

    const items = playlistItems.map((item: any) => ({
      media_id: Number(item.media_id),
      order_index: Number(item.order_index ?? 0),
      duration: item.duration,
      name: item.name,
      file_name: item.file_name,
      file_path: item.file_path,
      media_type: item.media_type,
      tags: item.tags,
      width: item.width,
      height: item.height,
      mime_type: item.mime_type,
      duration_seconds: item.duration_seconds,
      updated_at: item.updated_at,
      file_size_bytes: item.file_size_bytes,
      source: 'playlist' as const,
      source_priority: 0,
    }));

    return {
      items,
      playlistItemsCount: items.length,
      campaignMediaCount: 0,
      playlistDirectMixApplied: false,
      playlistDirectMixRatio: DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA,
      campaignPlaylistCount: playlistId > 0 ? 1 : 0,
    };
  }

  /**
   * FASE 3.2: Converter TotemPlaylistMix → DispatchPlan
   */
  private async convertMixToDispatchPlan(
    mix: TotemPlaylistMix,
    totemId: number,
    timestamp: Date
  ): Promise<DispatchPlan> {
    // Buscar informações das mídias do mix
    const mediaItems: DispatchMediaItem[] = [];
    const attemptedItems = mix.mix_items.length;
    let discardedItems = 0;
    
    const totemContext = await this.getTotemLogContext(totemId);
    const discardCounts: Record<string, number> = {};
    const DISCARD_LOG_LIMIT = 8;
    let discardLogs = 0;

    for (const mixItem of mix.mix_items) {
      const media = await this.db.findFirst(`
        SELECT 
          m.media_id,
          m.name,
          m.file_name,
          m.file_path,
          m.media_type,
          m.is_active,
          m.status,
          m.tags,
          m.width,
          m.height,
          m.mime_type,
          m.duration_seconds,
          m.updated_at,
          m.file_size_bytes
        FROM medias m
        WHERE m.media_id = $1
      `, [mixItem.media_id]);
      
      const mediaIsPlayable =
        !!media && media.is_active === true && ['approved', 'published'].includes(String(media.status));

      if (media && mediaIsPlayable) {
        mediaItems.push(
          buildDispatchMediaItem({
            mediaId: media.media_id,
            order: mixItem.order_index,
            displaySeconds: mixItem.duration,
            mediaType: media.media_type,
            durationSeconds: media.duration_seconds,
            filePath: media.file_path,
            name: media.name,
            fileName: media.file_name,
            width: media.width,
            height: media.height,
            mimeType: media.mime_type,
            tags: media.tags,
            updatedAt: media.updated_at,
            fileSizeBytes: media.file_size_bytes,
          })
        );
      } else {
        discardedItems++;
        const reason = !media
          ? 'media_not_found'
          : media.is_active !== true
            ? 'media_inactive'
            : 'media_status_not_allowed';
        discardCounts[reason] = (discardCounts[reason] || 0) + 1;
        if (discardLogs < DISCARD_LOG_LIMIT) {
          await logDebug('[DispatcherTotem] Item de mix descartado na conversão', {
            totem: totemContext,
            mix: { id: mix.mix_id, version: mix.mix_version },
            media: media
              ? {
                  id: media.media_id,
                  name: media.name,
                  status: media.status,
                  isActive: media.is_active,
                }
              : { id: mixItem.media_id },
            reason,
          });
          discardLogs++;
        }
      }
    }
    if (discardedItems > 0) {
      await logDebug('[DispatcherTotem] Resumo de descarte de itens do mix', {
        totem: totemContext,
        mix: { id: mix.mix_id, version: mix.mix_version },
        discardedItems,
        discardCounts,
      });
    }
    
    // Buscar informações da primeira playlist do mix (para metadados)
    const firstPlaylistId = mix.mix_items.length > 0 ? mix.mix_items[0].playlist_id : 0;
    const playlist = firstPlaylistId > 0 ? await this.db.findFirst(`
      SELECT playlist_id, name FROM playlists WHERE playlist_id = $1
    `, [firstPlaylistId]) : null;

    const subscriberIds = [
      ...new Set(
        (mix.mix_items || [])
          .map((item) => Number((item as { subscriber_id?: number }).subscriber_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ];

    const basePlan: DispatchPlan = {
      totemId,
      timestamp,
      playlistId: firstPlaylistId,
      playlistName: playlist?.name || `Mix ${mix.mix_id}`,
      mediaItems,
      totalDuration: mix.total_duration,
      priority: 0, // Mix não tem prioridade única
      source: 'mix',
      sourceId: mix.mix_id,
      sourceName: `Mix ${mix.mix_id}`,
      validityStart: timestamp,
      validityEnd: new Date(timestamp.getTime() + 24 * 60 * 60 * 1000), // 24 horas
      metadata: {
        mixId: mix.mix_id,
        mixVersion: mix.mix_version,
        mixStrategy: mix.mix_strategy,
        mixItemsCount: attemptedItems,
        mixItemsResolvedCount: mediaItems.length,
        mixItemsDiscardedCount: discardedItems,
      },
    };

    return enrichDispatchPlanWithGlobalVinhetas(basePlan, subscriberIds);
  }

  /**
   * Tenta fallback para fluxo tradicional de prioridade quando mix falha
   */
  private async tryPriorityPlanFallback(
    validatedCandidates: CandidateSchedule[],
    totemId: number,
    targetTimestamp: Date
  ): Promise<{ plan?: DispatchPlan; winner: CandidateSchedule | null }> {
    const winner = await this.resolveConflictsWithValidPlan(validatedCandidates, totemId, targetTimestamp);
    if (!winner) {
      return { plan: undefined, winner: null };
    }
    const totemContext = await this.getTotemLogContext(totemId);
    const winnerContext = await this.getCandidateLogContext(winner);
    await logDebug('[DispatcherTotem] Candidato escolhido no fallback PRIORITY', {
      totem: totemContext,
      winner: winnerContext,
    });
    const technicalValid = await this.validateTechnicalCompatibility(winner, totemId);
    if (!technicalValid.valid) {
      return { plan: undefined, winner: null };
    }
    const plan = await this.generateDispatchPlan(winner, totemId, targetTimestamp);
    return { plan, winner };
  }

  private async getTotemLogContext(totemId: number): Promise<Record<string, unknown>> {
    const row = await this.db.findFirst(
      `
      SELECT
        t.totem_id,
        t.name AS totem_name,
        t.uin,
        l.local_id,
        l.name AS local_name,
        p.publisher_id,
        p.name AS publisher_name
      FROM totems t
      LEFT JOIN locals l ON l.local_id = t.local_id
      LEFT JOIN publishers p ON p.publisher_id = l.publisher_id
      WHERE t.totem_id = $1
    `,
      [totemId]
    );
    if (!row) {
      return { id: totemId };
    }
    return {
      id: row.totem_id,
      name: row.totem_name,
      uin: row.uin,
      local: row.local_id ? { id: row.local_id, name: row.local_name } : undefined,
      publisher: row.publisher_id ? { id: row.publisher_id, name: row.publisher_name } : undefined,
    };
  }

  private async getCandidateLogContext(candidate: CandidateSchedule): Promise<Record<string, unknown>> {
    const subscriber = candidate.subscriberId
      ? await this.db.findFirst(`SELECT subscriber_id, name FROM subscribers WHERE subscriber_id = $1`, [
          candidate.subscriberId,
        ])
      : null;
    return {
      campaign: { id: candidate.campaignId, title: candidate.campaignTitle },
      playlist: { id: candidate.playlistId, name: candidate.playlistName },
      subscriber: subscriber
        ? { id: subscriber.subscriber_id, name: subscriber.name }
        : candidate.subscriberId
          ? { id: candidate.subscriberId }
          : undefined,
      source: { type: candidate.source, id: candidate.sourceId },
    };
  }

  /**
   * Gerar plano de exibição
   */
  private async generateDispatchPlan(
    candidate: CandidateSchedule,
    totemId: number,
    timestamp: Date
  ): Promise<DispatchPlan> {
    const consolidated = await this.getConsolidatedDispatchItems(candidate.campaignId);
    const items = consolidated.items;

    const mediaItems: DispatchMediaItem[] = items.map((item, index) =>
      buildDispatchMediaItem({
        mediaId: item.media_id,
        order: index + 1,
        displaySeconds: item.duration,
        mediaType: item.media_type,
        durationSeconds: item.duration_seconds,
        filePath: item.file_path,
        name: item.name,
        fileName: item.file_name,
        width: item.width,
        height: item.height,
        mimeType: item.mime_type,
        tags: item.tags,
        updatedAt: item.updated_at,
        fileSizeBytes: item.file_size_bytes,
      })
    );

    const totalDuration = sumDispatchMediaItemsPlanDuration(mediaItems);

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

    return enrichDispatchPlanWithGlobalVinhetas(
      {
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
          playlistItemsCount: consolidated.playlistItemsCount,
          campaignMediaCount: consolidated.campaignMediaCount,
          mergedItemsCount: mediaItems.length,
          campaignPlaylistCount: consolidated.campaignPlaylistCount,
          playlistDirectMixApplied: consolidated.playlistDirectMixApplied,
          playlistDirectMixRatio: consolidated.playlistDirectMixRatio,
        },
      },
      candidate.subscriberId ? [candidate.subscriberId] : []
    );
  }

  /**
   * Versão leve do plano para o heartbeat (sem rerodar dispatch completo).
   * 1) sticky do último GET /dispatch (fingerprint do plano completo, incl. mix/vinheta)
   * 2) cache do minuto
   * 3) watermark da totem_playlist no DB
   *
   * Importante: sticky deve ser invalidada em regenerate/publish
   * (`invalidateTotemDispatchCaches`), senão o player não vê mudança.
   */
  async peekPlanVersion(totemId: number, timestamp: Date = new Date()): Promise<{
    planVersion: string | null;
    source: 'sticky' | 'minute_cache' | 'playlist_db' | 'none';
  }> {
    try {
      const cacheService = getCacheService();
      const sticky = await cacheService.get<string>(planVersionCacheKey(totemId));
      if (typeof sticky === 'string' && sticky.trim()) {
        return { planVersion: sticky.trim(), source: 'sticky' };
      }

      if (this.cacheConfig.enabled) {
        const minuteKey = this.generateCacheKey(totemId, timestamp);
        const cached = await this.getFromCache(minuteKey);
        if (cached?.plan?.mediaItems?.length) {
          const version = buildDispatchPlanVersionFromPlan(cached.plan as any);
          await this.rememberPlanVersion(totemId, version);
          return { planVersion: version, source: 'minute_cache' };
        }
      }

      const dbVersion = await this.computePlaylistDbPlanVersion(totemId);
      if (dbVersion) {
        await this.rememberPlanVersion(totemId, dbVersion);
        return { planVersion: dbVersion, source: 'playlist_db' };
      }
    } catch (error) {
      await logError('[DispatcherTotem] peekPlanVersion falhou', error, { totemId });
    }
    return { planVersion: null, source: 'none' };
  }

  async rememberPlanVersion(totemId: number, planOrVersion: string | DispatchPlan): Promise<string> {
    const version =
      typeof planOrVersion === 'string'
        ? planOrVersion
        : buildDispatchPlanVersionFromPlan(planOrVersion as any);
    try {
      const cacheService = getCacheService();
      // TTL longo: só muda quando o plano muda ou o cache é invalidado.
      await cacheService.set(planVersionCacheKey(totemId), version, 24 * 60 * 60);
    } catch (error) {
      await logError('[DispatcherTotem] rememberPlanVersion falhou', error, { totemId });
    }
    return version;
  }

  private async computePlaylistDbPlanVersion(totemId: number): Promise<string | null> {
    try {
      const { buildMediaContentVersion } = await import('./mediaTotemSyncService');
      const tp = await this.db.findFirst(
        `
        SELECT tp.totem_playlist_id, COALESCE(tp.version, 0) AS playlist_version
        FROM totem_playlists tp
        WHERE tp.totem_id = $1
          AND COALESCE(tp.is_active, true) = true
          AND COALESCE(tp.status, 'active') = 'active'
        ORDER BY tp.generated_at DESC NULLS LAST, tp.totem_playlist_id DESC
        LIMIT 1
        `,
        [totemId]
      );
      if (!tp?.totem_playlist_id) return null;

      const rows = await this.db.findMany(
        `
        SELECT
          tpi.media_id AS media_id,
          COALESCE(tpi.order_index, 0) AS item_order,
          m.updated_at AS media_updated_at,
          m.file_size_bytes AS file_size_bytes,
          m.file_path AS file_path
        FROM totem_playlist_items tpi
        LEFT JOIN medias m ON m.media_id = tpi.media_id
        WHERE tpi.totem_playlist_id = $1
          AND COALESCE(tpi.is_active, true) = true
        ORDER BY tpi.order_index ASC, tpi.media_id ASC
        `,
        [tp.totem_playlist_id]
      );
      if (!rows?.length) {
        return buildDispatchPlanVersionFromPlan({
          mediaItems: [],
          playlistId: tp.totem_playlist_id,
          source: 'direct',
          metadata: { mixVersion: tp.playlist_version },
        });
      }

      const items = rows.map((r: any) => ({
        mediaId: r.media_id,
        order: Number(r.item_order) || 0,
        contentVersion: buildMediaContentVersion({
          updatedAt: r.media_updated_at,
          fileSizeBytes: r.file_size_bytes,
          filePath: r.file_path,
          fileCrc: null,
        }),
      }));
      return buildDispatchPlanVersionFromPlan({
        mediaItems: items.map((i) => ({
          mediaId: i.mediaId,
          order: i.order,
          contentVersion: i.contentVersion,
        })),
        playlistId: tp.totem_playlist_id,
        source: 'direct',
        metadata: { mixVersion: tp.playlist_version },
      });
    } catch (error) {
      await logError('[DispatcherTotem] computePlaylistDbPlanVersion falhou', error, { totemId });
      return null;
    }
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
      const cached = await cacheService.get<any>(cacheKey);
      if (!cached) {
        return null;
      }
      // CacheService já faz JSON.parse, então cached já é um objeto
      if (typeof cached === 'object' && cached.plan) {
        return cached;
      }
      // Se for string (compatibilidade), fazer parse
      if (typeof cached === 'string') {
        return JSON.parse(cached);
      }
      return null;
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
      const totemIdMatch = /^dispatcher:totem:(\d+):/.exec(cacheKey);
      if (totemIdMatch && data.plan) {
        await this.rememberPlanVersion(Number(totemIdMatch[1]), data.plan);
      }
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
    selectedSource?: 'direct' | 'group' | 'campaign' | 'mix';
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
      await logError('[DispatcherTotem] Erro ao registrar log', error, {
        totem: await this.getTotemLogContext(data.totemId),
      });
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
          dl.log_id,
          dl.totem_id,
          dl.timestamp,
          dl.selected_campaign_id,
          dl.selected_playlist_id,
          dl.selected_source,
          dl.selected_source_id,
          dl.priority,
          dl.candidates_count,
          dl.candidates,
          dl.temporal_validation,
          dl.technical_validation,
          dl.integrity_validation,
          dl.validation_details,
          dl.from_cache,
          dl.cache_key,
          dl.dispatch_plan,
          dl.execution_time_ms,
          dl.created_at,
          c.subscriber_id as subscriber_id,
          s.name as subscriber_name,
          l.publisher_id as publisher_id,
          p.name as publisher_name
        FROM dispatcher_log dl
        LEFT JOIN campaigns c ON dl.selected_campaign_id = c.campaign_id
        LEFT JOIN subscribers s ON c.subscriber_id = s.subscriber_id
        LEFT JOIN totems t ON dl.totem_id = t.totem_id
        LEFT JOIN locals l ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE dl.totem_id = $1
          AND dl.timestamp >= $2
          AND dl.timestamp <= $3
        ORDER BY dl.timestamp DESC
        LIMIT 1000
      `, [totemId, startDate, endDate]);

      return logs.map(log => ({
        logId: log.log_id,
        totemId: log.totem_id,
        timestamp: new Date(log.timestamp),
        subscriberId: log.subscriber_id ? Number(log.subscriber_id) : undefined,
        subscriberName: log.subscriber_name || undefined,
        publisherId: log.publisher_id ? Number(log.publisher_id) : undefined,
        publisherName: log.publisher_name || undefined,
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
      await logError('[DispatcherTotem] Erro ao buscar histórico', error, {
        totem: await this.getTotemLogContext(totemId),
      });
      throw error;
    }
  }

  /**
   * Vários instantes num único pedido HTTP (timeline do Dispatcher Manager).
   * Reutiliza `dispatch`; a ordem de retorno alinha-se à de `timestamps` (máx. 48).
   */
  async dispatchBatch(
    totemId: number,
    timestamps: Date[],
    options: DispatchOptions = {},
    timezone?: string
  ): Promise<
    Array<{
      timestamp: string;
      success: boolean;
      plan?: DispatchPlan;
      fromCache?: boolean;
      executionTimeMs?: number;
      error?: string;
    }>
  > {
    const max = 48;
    const slice = timestamps.slice(0, max);
    const mergedOptions: DispatchOptions = {
      ...options,
      includeCandidates: options.includeCandidates ?? false,
    };
    const out: Array<{
      timestamp: string;
      success: boolean;
      plan?: DispatchPlan;
      fromCache?: boolean;
      executionTimeMs?: number;
      error?: string;
    }> = [];

    for (const ts of slice) {
      const iso = ts.toISOString();
      try {
        const r = await this.dispatch(
          { totemId, timestamp: ts, timezone },
          mergedOptions
        );
        out.push({
          timestamp: iso,
          success: r.success,
          plan: r.plan,
          fromCache: r.fromCache,
          executionTimeMs: r.executionTimeMs,
          error: r.error,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro ao calcular plano';
        out.push({
          timestamp: iso,
          success: false,
          error: msg,
        });
      }
    }
    return out;
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
