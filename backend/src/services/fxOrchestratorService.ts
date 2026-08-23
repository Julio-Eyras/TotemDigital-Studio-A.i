/**
 * FxOrchestratorService - SmartDisplayFX Orchestrator
 *
 * Responsável por:
 *  - receber eventos de interação / IA;
 *  - decidir efeitos FX entre totens;
 *  - publicar mensagens SmartDisplayFlow (effect_transfer / timeline_update);
 *
 * Versão v1:
 *  - Usa contexto real: tags, totem_network e logs em event_logs;
 *  - Pronto para integrar com MQTT/WebSocket via bridge (TODO marcado).
 */

import { TagService } from './tagService';
import { EventLogService, EventType } from './eventLogService';
import { logInfo, logError } from '../utils/loggerHelper';
import { getDatabase } from '../config/database';
import { getFxMessageBridge, FxEffectMessage, FxTimelineMessage } from './fxMessageBridge';
import { getFxRuleService } from './fxRuleService';
import { getFxEffectService } from './fxEffectService';
import { getFxTimelineService } from './fxTimelineService';
import { getFxSiteService } from './fxSiteService';
import { getFxTelemetryService } from './fxTelemetryService';
import { ingestFxInteractionForAce, rejectFxAiEventForAce } from './ace/aceFxBridge';

// ---------------------------------------------------------------------------
// Tipos básicos segundo o protocolo SmartDisplayFlow
// ---------------------------------------------------------------------------

export interface FxInteractionEvent {
  siteId: string;
  totemId: string;
  interactionType: 'tag_id' | 'touch' | 'gesture' | 'facial_recognition';
  tagId?: string;
  contentId?: number;
  timestamp: string;
  extra?: any;
}

export interface FxAiEvent {
  siteId: string;
  totemId: string;
  eventId: string;
  eventType: 'facial_estimate' | 'attention' | 'gesture' | string;
  payload: any;
  timestamp: string;
}

export interface FxEffectTriggerParams {
  siteId: string;
  fromTotemId: string;
  toTotemId: string;
  effectId?: string;
  contentId?: number | null;
  startTs?: string;
  durationMs?: number;
  params?: Record<string, any>;
}

export interface FxTimelineEvent {
  eventId: string;
  startTs: string;
  effectType: string;
  fromTotem: string;
  toTotems: string[];
  contentId: number | null;
  durationMs: number;
  params?: Record<string, any>;
}

export interface FxTimeline {
  siteId: string;
  timelineId: string;
  version: number;
  generatedAt: string;
  events: FxTimelineEvent[];
}

// ---------------------------------------------------------------------------
// Serviço principal
// ---------------------------------------------------------------------------

export class FxOrchestratorService {
  private tagService: TagService;
  private eventLogService: EventLogService;
  private messageBridge = getFxMessageBridge();
  private db = getDatabase();
  private ruleService = getFxRuleService();
  private effectService = getFxEffectService();
  private timelineService = getFxTimelineService();
  private siteService = getFxSiteService();
  private telemetryService = getFxTelemetryService();

  constructor() {
    this.tagService = new TagService();
    this.eventLogService = new EventLogService();
  }

  /**
   * Inicialização (placeholder)
   */
  async initialize(): Promise<void> {
    await logInfo('FxOrchestratorService inicializado', {});
  }

  /**
   * Trata um evento de interação (tag, touch, gesture, etc.)
   * e decide se deve disparar um efeito FX usando regras inteligentes.
   */
  async handleInteractionEvent(event: FxInteractionEvent): Promise<void> {
    try {
      ingestFxInteractionForAce(event);
      await logInfo('FxOrchestratorService.handleInteractionEvent', {
        siteId: event.siteId,
        totemId: event.totemId,
        interactionType: event.interactionType,
      });

      // Buscar regras ativas para o site
      const rules = await this.ruleService.getActiveRulesForSite(event.siteId);
      
      // Avaliar regras em ordem de prioridade
      let matchedRule = null;
      for (const rule of rules) {
        if (await this.evaluateRuleConditions(rule.conditions, event)) {
          matchedRule = rule;
          break; // Primeira regra que corresponde
        }
      }

      let contentId = event.contentId ?? null;
      let effectId = 'neon_warp';
      let effectParams: Record<string, any> = {};

      // Se encontrou regra, usar ações da regra
      if (matchedRule) {
        const actions = matchedRule.actions;
        effectId = actions.effect_type || effectId;
        contentId = actions.content_id || contentId;
        effectParams = actions.params || {};

        await logInfo('Regra aplicada', { ruleId: matchedRule.rule_id, ruleName: matchedRule.name });
      } else {
        // Fallback: lógica padrão
        if (event.interactionType === 'tag_id' && event.tagId) {
          const result = await this.tagService.getContentForTag(event.tagId);
          contentId = result.contentId ?? contentId;
          effectId = 'neon_warp';
        } else if (event.interactionType === 'touch') {
          effectId = 'ripple_sync';
        } else if (event.interactionType === 'gesture') {
          effectId = 'particle_burst';
        }
      }

      // Buscar efeito no catálogo para obter parâmetros padrão
      const effect = await this.effectService.getEffectByName(effectId);
      if (effect && effect.default_params) {
        effectParams = { ...effect.default_params, ...effectParams };
      }

      // Encontrar totem de destino usando fx_totem_sites ou totem_network
      const toTotemId = await this.findTargetTotem(event.siteId, event.totemId);

      await this.triggerEffect({
        siteId: event.siteId,
        fromTotemId: event.totemId,
        toTotemId,
        effectId,
        contentId,
        params: effectParams,
      });

      // Registrar regra aplicada em event_logs (para BI)
      await this.eventLogService.logEvent({
        eventType: EventType.CUSTOM_EVENT,
        entityType: 'smartdisplayfx_rule',
        entityId: matchedRule?.rule_id,
        totemId: undefined,
        campaignId: undefined,
        playlistId: undefined,
        mediaId: contentId ?? undefined,
        metadata: {
          rule: matchedRule ? matchedRule.name : 'fallback',
          ruleId: matchedRule?.rule_id,
          interactionType: event.interactionType,
          tagId: event.tagId,
          totemId: event.totemId,
          targetTotemId: toTotemId,
          effectId,
        },
      });
    } catch (error: any) {
      await logError('Erro em handleInteractionEvent', error, { event }).catch(() => {});
      throw error;
    }
  }

  /**
   * Trata um evento de IA de borda (perfil, atenção, gesto, etc.)
   * usando regras inteligentes para decidir efeitos.
   */
  async handleAiEvent(event: FxAiEvent): Promise<void> {
    try {
      rejectFxAiEventForAce(event);
      await logInfo('FxOrchestratorService.handleAiEvent', {
        siteId: event.siteId,
        totemId: event.totemId,
        eventType: event.eventType,
        eventId: event.eventId,
      });
      
      // Buscar regras ativas para o site
      const rules = await this.ruleService.getActiveRulesForSite(event.siteId);
      
      // Avaliar regras em ordem de prioridade
      let matchedRule = null;
      for (const rule of rules) {
        if (await this.evaluateRuleConditions(rule.conditions, event)) {
          matchedRule = rule;
          break;
        }
      }

      if (!matchedRule) {
        // Fallback: lógica padrão
        const attentionMs = event.payload?.attention_ms ?? 0;
        const mood = event.payload?.mood ?? 'unknown';
        
        if (attentionMs >= 2000 || mood === 'happy') {
          const toTotemId = await this.findTargetTotem(event.siteId, event.totemId);
          const segment = this.getSegmentFromAiPayload(event.payload);

          await this.triggerEffect({
            siteId: event.siteId,
            fromTotemId: event.totemId,
            toTotemId,
            effectId: 'holographic_swipe',
            contentId: null,
            params: { segment, attentionMs, mood },
          });
        }
        return;
      }

      // Aplicar regra encontrada
      const actions = matchedRule.actions;
      const effectId = actions.effect_type || 'holographic_swipe';
      const contentId = actions.content_id || null;
      const effectParams = actions.params || {};

      // Buscar efeito no catálogo
      const effect = await this.effectService.getEffectByName(effectId);
      if (effect && effect.default_params) {
        Object.assign(effectParams, effect.default_params);
      }

      const toTotemId = await this.findTargetTotem(event.siteId, event.totemId);

      await this.triggerEffect({
        siteId: event.siteId,
        fromTotemId: event.totemId,
        toTotemId,
        effectId,
        contentId,
        params: { ...effectParams, ...event.payload },
      });

      await this.eventLogService.logEvent({
        eventType: EventType.CUSTOM_EVENT,
        entityType: 'smartdisplayfx_rule',
        entityId: matchedRule.rule_id,
        totemId: undefined,
        campaignId: undefined,
        playlistId: undefined,
        mediaId: contentId ?? undefined,
        metadata: {
          rule: matchedRule.name,
          ruleId: matchedRule.rule_id,
          eventType: event.eventType,
          totemId: event.totemId,
          targetTotemId: toTotemId,
          effectId,
        },
      });
    } catch (error: any) {
      await logError('Erro em handleAiEvent', error, { event }).catch(() => {});
      throw error;
    }
  }

  /**
   * Dispara um efeito FX simples entre dois totens.
   * Monta o payload, publica via MessageBridge (MQTT/WebSocket ou log-only),
   * e registra em event_logs para auditoria/BI.
   */
  async triggerEffect(params: FxEffectTriggerParams): Promise<FxEffectTriggerParams> {
    const effectPayload = this.buildEffectTransferPayload(params);

    try {
      await logInfo('FxOrchestratorService.triggerEffect', effectPayload);

      // Publicar via MessageBridge (MQTT se disponível, senão log-only)
      const effectMessage: FxEffectMessage = {
        msg_type: 'effect_transfer',
        site_id: effectPayload.site_id,
        effect_id: effectPayload.effect_id,
        from: effectPayload.from,
        to: effectPayload.to,
        content_id: effectPayload.content_id,
        start_ts: effectPayload.start_ts,
        duration_ms: effectPayload.duration_ms,
        params: effectPayload.params,
      };

      await this.messageBridge.publishEffect(effectMessage);

      // Registrar em event_logs para auditoria/BI
      await this.eventLogService.logEvent({
        eventType: EventType.CUSTOM_EVENT,
        entityType: 'smartdisplayfx_effect',
        entityId: undefined,
        totemId: undefined,
        campaignId: undefined,
        playlistId: undefined,
        mediaId: params.contentId ?? undefined,
        metadata: {
          siteId: params.siteId,
          fromTotemId: params.fromTotemId,
          toTotemId: params.toTotemId,
          effectId: effectPayload.effect_id,
          durationMs: effectPayload.duration_ms,
          params: effectPayload.params,
        },
      });

      return params;
    } catch (error: any) {
      await logError('Erro em triggerEffect', error, { params }).catch(() => {});
      throw error;
    }
  }

  /**
   * Gera uma timeline FX para um site baseada em regras, campanhas ativas e eventos.
   * Salva no banco e publica via MessageBridge.
   */
  async generateTimeline(siteId: string, durationMinutes: number = 60): Promise<FxTimeline> {
    try {
      // Usar tempo sincronizado NTP para precisão
      const { getNTPService } = await import('../config/ntp');
      const ntpService = getNTPService();
      const synchronizedNow = ntpService.getSynchronizedTime();
      
      const now = synchronizedNow;
      const startTime = new Date(now);
      const endTime = new Date(now + durationMinutes * 60 * 1000);

      // Buscar timeline ativa existente ou criar nova
      let existingTimeline = await this.timelineService.getActiveTimelineForSite(siteId);
      const version = existingTimeline ? existingTimeline.version + 1 : 1;

      const timelineId = `tl_${siteId}_${now}`;
      const events: FxTimelineEvent[] = [];

      // Buscar totens do site
      const totems = await this.siteService.getTotemsForSite(siteId);
      if (totems.length < 2) {
        await logInfo('Site não tem totens suficientes para timeline', { siteId, totemCount: totems.length });
        return {
          siteId,
          timelineId,
          version,
          generatedAt: startTime.toISOString(),
          events: [],
        };
      }

      // Buscar campanhas ativas para os totens do site
      const { CampaignService } = await import('./campaignService');
      const campaignService = new CampaignService();
      const siteCampaigns: any[] = [];
      
      for (const totem of totems) {
        try {
          const totemCampaigns = await campaignService.getActiveCampaignsForTotem(totem.totem_id);
          siteCampaigns.push(...totemCampaigns.map(c => ({ ...c, totemId: totem.totem_id })));
        } catch (e) {
          // Ignorar erros ao buscar campanhas de um totem específico
        }
      }

      // Buscar regras ativas do site para gerar eventos inteligentes
      const rules = await this.ruleService.getActiveRulesForSite(siteId);
      
      // Buscar histórico de telemetria para otimizar distribuição
      await this.telemetryService.getTelemetryStats({
        startDate: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), // Últimos 7 dias
        endDate: new Date(now).toISOString(),
      });

      // Calcular distribuição inteligente de eventos
      // Baseado em: regras ativas, campanhas, histórico de performance
      const minEvents = 5; // Mínimo de eventos por hora
      const maxEvents = 30; // Máximo de eventos por hora
      const baseEventCount = Math.max(
        rules.length * 2, // 2 eventos por regra
        siteCampaigns.length * 3, // 3 eventos por campanha
        Math.ceil(durationMinutes / 60) * minEvents, // Mínimo por hora
        minEvents
      );
      const eventCount = Math.min(baseEventCount, maxEvents * Math.ceil(durationMinutes / 60));
      const eventInterval = durationMinutes * 60 * 1000 / eventCount;
      
      for (let i = 0; i < eventCount; i++) {
        const eventTime = new Date(now + i * eventInterval);
        const fromTotem = totems[Math.floor(Math.random() * totems.length)];
        const toTotems = totems.filter(t => t.totem_id !== fromTotem.totem_id);
        const toTotem = toTotems[Math.floor(Math.random() * toTotems.length)];

        // Priorizar campanhas ativas, depois regras, depois padrão
        let effectType = 'neon_warp_v1';
        let effectParams: Record<string, any> = {};
        let contentId: number | null = null;

        // 1. Verificar se há campanha ativa para o totem de origem
        // Considerar horários agendados e segmentação
        const activeCampaign = siteCampaigns.find(c => {
          if (c.totemId !== fromTotem.totem_id) return false;
          
          // Verificar se campanha está ativa no horário do evento
          if (!this.isCampaignActiveAtTime(c, eventTime)) return false;
          
          // Verificar horários agendados específicos (scheduledStart/scheduledEnd)
          if (c.scheduledStart || c.scheduledEnd) {
            const eventHour = eventTime.getHours();
            const eventMinute = eventTime.getMinutes();
            const eventTimeMinutes = eventHour * 60 + eventMinute;
            
            if (c.scheduledStart) {
              const [startHour, startMin] = c.scheduledStart.split(':').map(Number);
              const startTimeMinutes = startHour * 60 + startMin;
              if (eventTimeMinutes < startTimeMinutes) return false;
            }
            
            if (c.scheduledEnd) {
              const [endHour, endMin] = c.scheduledEnd.split(':').map(Number);
              const endTimeMinutes = endHour * 60 + endMin;
              if (eventTimeMinutes > endTimeMinutes) return false;
            }
          }
          
          return true;
        });

        if (activeCampaign) {
          // Usar conteúdo da campanha se disponível
          const campaignPlaylists = await this.db.findMany(`
            SELECT playlist_id FROM campaign_playlists 
            WHERE campaign_id = $1 LIMIT 1
          `, [activeCampaign.id]);
          
          if (campaignPlaylists.length > 0) {
            const playlistItems = await this.db.findMany(`
              SELECT media_id FROM playlist_items 
              WHERE playlist_id = $1 ORDER BY position LIMIT 1
            `, [campaignPlaylists[0].playlist_id]);
            
            if (playlistItems.length > 0) {
              contentId = playlistItems[0].media_id;
            }
          }
          
          // Efeito baseado na prioridade da campanha
          effectType = activeCampaign.priority >= 8 ? 'holographic_swipe' : 'neon_warp_v1';
          effectParams = {
            campaignId: activeCampaign.id,
            campaignTitle: activeCampaign.title,
            priority: activeCampaign.priority,
          };
        } else {
          // 2. Usar regra correspondente se houver
          // Filtrar regras por horário e condições
          const applicableRules = rules.filter(rule => {
            // Verificar condições de horário se existirem
            if (rule.conditions?.time_range) {
              const { start, end } = rule.conditions.time_range;
              const eventHour = eventTime.getHours();
              const eventMinute = eventTime.getMinutes();
              const eventTimeMinutes = eventHour * 60 + eventMinute;
              
              if (start) {
                const [startHour, startMin] = start.split(':').map(Number);
                const startTimeMinutes = startHour * 60 + startMin;
                if (eventTimeMinutes < startTimeMinutes) return false;
              }
              
              if (end) {
                const [endHour, endMin] = end.split(':').map(Number);
                const endTimeMinutes = endHour * 60 + endMin;
                if (eventTimeMinutes > endTimeMinutes) return false;
              }
            }
            
            // Verificar condições de dia da semana se existirem
            if (rule.conditions?.weekdays) {
              const eventDay = eventTime.getDay(); // 0 = Domingo, 6 = Sábado
              const weekdays = rule.conditions.weekdays;
              if (!weekdays.includes(eventDay)) return false;
            }
            
            return true;
          });
          
          const rule = applicableRules.length > 0 
            ? applicableRules[i % applicableRules.length]
            : rules[i % rules.length];
            
          if (rule) {
            effectType = rule.actions?.effect_type || 'neon_warp_v1';
            effectParams = rule.actions?.params || {};
            contentId = rule.actions?.content_id || null;
            
            // Adicionar informações de segmentação se disponíveis
            if (rule.conditions?.age_bucket) {
              effectParams.age_segment = rule.conditions.age_bucket;
            }
            if (rule.conditions?.mood) {
              effectParams.mood_segment = rule.conditions.mood;
            }
            if (rule.conditions?.tag_category) {
              effectParams.tag_segment = rule.conditions.tag_category;
            }
          }
        }

        // Buscar efeito no catálogo para obter parâmetros padrão
        const effect = await this.effectService.getEffectByName(effectType);
        const finalParams = effect && effect.default_params 
          ? { ...effect.default_params, ...effectParams }
          : effectParams;

        events.push({
          eventId: `evt_${timelineId}_${i}`,
          startTs: eventTime.toISOString(),
          effectType,
          fromTotem: String(fromTotem.totem_id),
          toTotems: [String(toTotem.totem_id)],
          contentId,
          durationMs: finalParams.duration_ms || 1600,
          params: finalParams,
        });
      }

      // Salvar timeline no banco
      const savedTimeline = await this.timelineService.createTimeline({
        site_id: siteId,
        name: `Timeline ${new Date().toISOString()}`,
        version,
        events,
        generated_at: startTime.toISOString(),
        starts_at: startTime.toISOString(),
        ends_at: endTime.toISOString(),
        is_active: true,
      });

      const timeline: FxTimeline = {
        siteId,
        timelineId: savedTimeline.timeline_id.toString(),
        version: savedTimeline.version,
        generatedAt: savedTimeline.generated_at,
        events,
      };

      await logInfo('FxOrchestratorService.generateTimeline', { siteId, timelineId: timeline.timelineId, eventCount: events.length });

      // Publicar timeline via MessageBridge
      if (timeline.events.length > 0) {
        const timelineMessage: FxTimelineMessage = {
          msg_type: 'timeline_update',
          site_id: timeline.siteId,
          timeline_id: timeline.timelineId,
          version: timeline.version,
          generated_at: timeline.generatedAt,
          events: timeline.events,
        };

        await this.messageBridge.publishTimeline(timelineMessage);
      }

      return timeline;
    } catch (error: any) {
      await logError('Erro em generateTimeline', error, { siteId }).catch(() => {});
      throw error;
    }
  }

  /**
   * Verifica se uma campanha está ativa em um determinado momento
   */
  private isCampaignActiveAtTime(campaign: any, time: Date): boolean {
    const now = time;
    const campaignStart = campaign.startDate ? new Date(campaign.startDate) : null;
    const campaignEnd = campaign.endDate ? new Date(campaign.endDate) : null;

    // Verificar datas
    if (campaignStart && now < campaignStart) return false;
    if (campaignEnd && now > campaignEnd) return false;

    // Verificar horários (se configurados)
    if (campaign.startTime && campaign.endTime) {
      const [startHour, startMin] = campaign.startTime.split(':').map(Number);
      const [endHour, endMin] = campaign.endTime.split(':').map(Number);
      const nowHour = now.getHours();
      const nowMin = now.getMinutes();

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const nowMinutes = nowHour * 60 + nowMin;

      if (nowMinutes < startMinutes || nowMinutes > endMinutes) return false;
    }

    // Verificar dias da semana (se configurados)
    if (campaign.daysOfWeek && Array.isArray(campaign.daysOfWeek) && campaign.daysOfWeek.length > 0) {
      const dayOfWeek = now.getDay(); // 0 = Domingo, 6 = Sábado
      if (!campaign.daysOfWeek.includes(dayOfWeek)) return false;
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Escolhe um totem de destino com base em fx_totem_sites ou totem_network.
   * Prioriza totens do mesmo site.
   */
  private async findTargetTotem(siteId: string, fromTotemId: string): Promise<string> {
    try {
      const numericId = parseInt(fromTotemId, 10);
      if (Number.isNaN(numericId)) {
        return fromTotemId;
      }

      // Primeiro, tentar buscar totens do mesmo site
      const siteTotems = await this.siteService.getTotemsForSite(siteId);
      const otherTotems = siteTotems.filter(t => t.totem_id !== numericId && t.is_active);
      
      if (otherTotems.length > 0) {
        // Escolher aleatoriamente ou por posição (priorizar master se houver)
        const masterTotem = otherTotems.find(t => t.role === 'master');
        if (masterTotem) {
          return String(masterTotem.totem_id);
        }
        return String(otherTotems[Math.floor(Math.random() * otherTotems.length)].totem_id);
      }

      // Fallback: usar totem_network
      const network = await this.db.findFirst(
        `
        SELECT nearby_totems
        FROM totem_network
        WHERE totem_id = $1 AND is_active = true
      `,
        [numericId]
      );

      const nearby: number[] = network?.nearby_totems || [];
      if (nearby.length > 0) {
        return String(nearby[0]);
      }

      return fromTotemId;
    } catch (error: any) {
      await logError('Erro em findTargetTotem', error, { siteId, fromTotemId }).catch(() => {});
      return fromTotemId;
    }
  }

  /**
   * Avalia condições de uma regra contra um evento.
   */
  private async evaluateRuleConditions(conditions: Record<string, any>, event: FxInteractionEvent | FxAiEvent): Promise<boolean> {
    try {
      // Avaliar condições de idade
      if (conditions.age_bucket) {
        const ageBuckets = Array.isArray(conditions.age_bucket) ? conditions.age_bucket : [conditions.age_bucket];
        const eventAge = (event as FxAiEvent).payload?.age_bucket;
        if (eventAge && !ageBuckets.includes(eventAge)) {
          return false;
        }
      }

      // Avaliar condições de humor
      if (conditions.mood) {
        const moods = Array.isArray(conditions.mood) ? conditions.mood : [conditions.mood];
        const eventMood = (event as FxAiEvent).payload?.mood;
        if (eventMood && !moods.includes(eventMood)) {
          return false;
        }
      }

      // Avaliar condições de atenção
      if (conditions.attention_ms) {
        const attentionMs = (event as FxAiEvent).payload?.attention_ms || 0;
        if (conditions.attention_ms.min && attentionMs < conditions.attention_ms.min) {
          return false;
        }
        if (conditions.attention_ms.max && attentionMs > conditions.attention_ms.max) {
          return false;
        }
      }

      // Avaliar condições de tipo de interação
      if (conditions.interaction_type) {
        const interactionType = (event as FxInteractionEvent).interactionType;
        if (interactionType !== conditions.interaction_type) {
          return false;
        }
      }

      // Avaliar condições de tag
      if (conditions.tag_id || conditions.tag_category) {
        const tagId = (event as FxInteractionEvent).tagId;
        if (!tagId) {
          return false;
        }
        
        // Se especificou tag_id exato, verificar
        if (conditions.tag_id) {
          const expectedTagIds = Array.isArray(conditions.tag_id) 
            ? conditions.tag_id 
            : [conditions.tag_id];
          if (!expectedTagIds.includes(tagId)) {
            return false;
          }
        }
        
        // Se especificou categoria, buscar tag e verificar
        if (conditions.tag_category) {
          try {
            const tagCategories = Array.isArray(conditions.tag_category) 
              ? conditions.tag_category 
              : [conditions.tag_category];
            
            const tagResult = await this.tagService.getContentForTag(tagId);
            if (tagResult && tagResult.tag) {
              // Verificar categoria usando metadata JSONB (campo já existe na tabela)
              const tagMetadata = tagResult.tag.metadata || {};
              const tagCategory = tagMetadata.category || tagMetadata.categoria;
              
              // Fallback para nome/descrição se metadata não tiver categoria
              let hasCategory = false;
              if (tagCategory) {
                hasCategory = tagCategories.some(cat => 
                  String(tagCategory).toLowerCase() === cat.toLowerCase()
                );
              }
              
              // Se não encontrou em metadata, verificar nome/descrição
              if (!hasCategory) {
                const tagName = tagResult.tag.name?.toLowerCase() || '';
                const tagDescription = tagResult.tag.description?.toLowerCase() || '';
                hasCategory = tagCategories.some(cat => 
                  tagName.includes(cat.toLowerCase()) || 
                  tagDescription.includes(cat.toLowerCase())
                );
              }
              
              if (!hasCategory) {
                return false;
              }
            } else {
              // Tag não encontrada, considerar como não correspondente
              return false;
            }
          } catch (error: any) {
            // Se não conseguir buscar tag, considerar como não correspondente
            await logError('Erro ao buscar tag para avaliação de regra', error, { tagId }).catch(() => {});
            return false;
          }
        }
      }

      return true;
    } catch (error: any) {
      await logError('Erro em evaluateRuleConditions', error, { conditions, event }).catch(() => {});
      return false;
    }
  }

  /**
   * Deriva um segmento simples a partir do payload de IA.
   */
  private getSegmentFromAiPayload(payload: any): string {
    const ageBucket: string = payload?.age_bucket || 'unknown';
    const mood: string = payload?.mood || 'unknown';

    if (ageBucket === '14-25' || ageBucket === '18-25') {
      return 'YOUNG';
    }
    if (ageBucket === '26-40') {
      return 'ADULT';
    }
    if (ageBucket === '41-60') {
      return 'MATURE';
    }
    return `UNKNOWN_${mood.toUpperCase()}`;
  }

  private buildEffectTransferPayload(params: FxEffectTriggerParams) {
    const startTs = params.startTs || new Date(Date.now() + 700).toISOString();
    const durationMs = params.durationMs ?? 1600;

    return {
      msg_type: 'effect_transfer',
      site_id: params.siteId,
      effect_id: params.effectId || 'neon_warp_v1',
      from: {
        totem: params.fromTotemId,
        edge: 'right',
      },
      to: {
        totem: params.toTotemId,
        edge: 'left',
      },
      content_id: params.contentId ?? null,
      start_ts: startTs,
      duration_ms: durationMs,
      params: params.params || {},
    };
  }
}

// Singleton opcional
let fxOrchestratorInstance: FxOrchestratorService | null = null;

export function getFxOrchestratorService(): FxOrchestratorService {
  if (!fxOrchestratorInstance) {
    fxOrchestratorInstance = new FxOrchestratorService();
  }
  return fxOrchestratorInstance;
}


