/**
 * Totem Playlist Mix Service
 * Serviço para mixagem inteligente de playlists para totens
 * Combina playlists de múltiplas campanhas usando regras sistemáticas e/ou IA
 */

import { getDatabase } from '../config/database';
import { logError, logDebug } from '../utils/loggerHelper';
import { PublisherCampaignMixService } from './publisherCampaignMixService';
import { AIService } from './aiService';
import { getCacheService } from './cacheService';
import { getWebhookService } from './webhookService';

export interface MixRule {
  rule_id: number;
  name: string;
  totem_id?: number | null;
  rule_type: 'systematic' | 'ai' | 'hybrid';
  priority_weight: number;
  time_weight: number;
  tag_weight: number;
  subscriber_weight: number;
  ai_enabled: boolean;
  ai_provider?: string;
  ai_model?: string;
  ai_config?: any;
  use_pedestrian_detection: boolean;
  use_sentiment_analysis: boolean;
  use_context_awareness: boolean;
  use_historical_optimization: boolean;
  max_items_per_playlist: number;
  rotation_strategy: 'round_robin' | 'priority' | 'weighted' | 'ai_optimized';
  shuffle_enabled: boolean;
}

export interface AIContext {
  context_id: number;
  pedestrian_count: number;
  pedestrian_density?: 'low' | 'medium' | 'high';
  pedestrian_demographics?: any;
  sentiment_score?: number;
  sentiment_label?: 'positive' | 'neutral' | 'negative';
  emotion_tags?: string[];
  time_of_day?: string;
  day_type?: string;
  weather_context?: any;
  event_context?: any;
  performance_metrics?: any;
}

export interface MixItem {
  media_id: number;
  playlist_id: number;
  campaign_id: number;
  subscriber_id: number;
  order_index: number;
  weight: number;
  source: 'campaign' | 'playlist';
  priority: number;
  tags?: string[];
  duration?: number;
}

export interface TotemPlaylistMix {
  mix_id: number;
  totem_id: number;
  rule_id?: number;
  mix_version: number;
  mix_items: MixItem[];
  total_items: number;
  total_duration: number;
  mix_strategy: string;
  context_snapshot?: any;
  is_active: boolean;
  is_current: boolean;
  generated_at: string;
  applied_at?: string;
}

export class TotemPlaylistMixService {
  private get db() {
    return getDatabase();
  }

  private get campaignMixService() {
    return new PublisherCampaignMixService();
  }

  private getAIService(): AIService {
    return new AIService();
  }

  private get cacheService() {
    return getCacheService();
  }

  /**
   * Obtém a regra de mixagem para um totem (com cache)
   */
  async getMixRuleForTotem(totemId: number): Promise<MixRule | null> {
    try {
      // Tentar obter do cache
      const cacheKey = `mix_rule:totem:${totemId}`;
      try {
        const cached = await this.cacheService.get(cacheKey);
        if (cached && typeof cached === 'string') {
          return JSON.parse(cached);
        }
      } catch (e) {
        // Cache não disponível, continuar
      }

      const result = await this.db.findFirst(`
        SELECT * FROM get_mix_rule_for_totem($1)
      `, [totemId]);

      if (!result) {
        // Retornar regra padrão se não houver regra específica
        const defaultRule = this.getDefaultMixRule();
        // Cache da regra padrão por 1 hora
        await this.cacheService.set(cacheKey, JSON.stringify(defaultRule), 3600);
        return defaultRule;
      }

      const rule = {
        rule_id: result.rule_id,
        name: result.name,
        totem_id: result.totem_id,
        rule_type: result.rule_type,
        priority_weight: parseFloat(result.priority_weight || '1.0'),
        time_weight: parseFloat(result.time_weight || '1.0'),
        tag_weight: parseFloat(result.tag_weight || '0.5'),
        subscriber_weight: parseFloat(result.subscriber_weight || '0.5'),
        ai_enabled: result.ai_enabled || false,
        ai_provider: result.ai_provider,
        ai_model: result.ai_model,
        ai_config: result.ai_config,
        use_pedestrian_detection: result.use_pedestrian_detection || false,
        use_sentiment_analysis: result.use_sentiment_analysis || false,
        use_context_awareness: result.use_context_awareness || false,
        use_historical_optimization: result.use_historical_optimization || false,
        max_items_per_playlist: result.max_items_per_playlist || 50,
        rotation_strategy: result.rotation_strategy || 'priority',
        shuffle_enabled: result.shuffle_enabled || false,
      };
      
      // Cache da regra por 1 hora
      await this.cacheService.set(cacheKey, JSON.stringify(rule), 3600);
      
      return rule;
    } catch (error: any) {
      await logError('Erro ao obter regra de mixagem', error, { totemId });
      return this.getDefaultMixRule();
    }
  }

  /**
   * Valida uma regra de mixagem
   */
  async validateMixRule(ruleData: Partial<MixRule>): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar nome
    if (ruleData.name !== undefined) {
      if (!ruleData.name || ruleData.name.trim().length === 0) {
        errors.push('Nome da regra é obrigatório');
      } else if (ruleData.name.length > 255) {
        errors.push('Nome da regra não pode ter mais de 255 caracteres');
      }
    }

    // Validar tipo de regra
    if (ruleData.rule_type !== undefined) {
      const validTypes = ['systematic', 'ai', 'hybrid'];
      if (!validTypes.includes(ruleData.rule_type)) {
        errors.push(`Tipo de regra deve ser um de: ${validTypes.join(', ')}`);
      }
    }

    // Validar pesos (0-10)
    const weightFields = ['priority_weight', 'time_weight', 'tag_weight', 'subscriber_weight'] as const;
    for (const field of weightFields) {
      if (ruleData[field] !== undefined) {
        const weight = ruleData[field];
        if (weight < 0 || weight > 10) {
          errors.push(`${field} deve estar entre 0 e 10`);
        }
      }
    }

    // Validar soma total de pesos (opcional, mas avisar se muito alto/baixo)
    if (ruleData.priority_weight !== undefined && 
        ruleData.time_weight !== undefined && 
        ruleData.tag_weight !== undefined && 
        ruleData.subscriber_weight !== undefined) {
      const totalWeight = ruleData.priority_weight + ruleData.time_weight + 
                         ruleData.tag_weight + ruleData.subscriber_weight;
      if (totalWeight > 30) {
        warnings.push(`Soma total de pesos (${totalWeight}) é muito alta, pode causar distorções na ordenação`);
      } else if (totalWeight < 1) {
        warnings.push(`Soma total de pesos (${totalWeight}) é muito baixa, pode não ter efeito significativo`);
      }
    }

    // Validar configurações de IA
    if (ruleData.ai_enabled !== undefined && ruleData.ai_enabled) {
      if (ruleData.rule_type === 'systematic') {
        warnings.push('IA habilitada mas tipo de regra é systematic - IA não será usada');
      }
      
      if (ruleData.use_pedestrian_detection || ruleData.use_sentiment_analysis || 
          ruleData.use_context_awareness || ruleData.use_historical_optimization) {
        // Validar provedor e modelo se qualquer recurso de IA estiver habilitado
        if (!ruleData.ai_provider || ruleData.ai_provider.trim().length === 0) {
          warnings.push('Provedor de IA não especificado - recursos de IA podem não funcionar');
        }
      }
    }

    // Validar estratégia de rotação
    if (ruleData.rotation_strategy !== undefined) {
      const validStrategies = ['round_robin', 'priority', 'weighted', 'ai_optimized'];
      if (!validStrategies.includes(ruleData.rotation_strategy)) {
        errors.push(`Estratégia de rotação deve ser uma de: ${validStrategies.join(', ')}`);
      }

      // Validar compatibilidade entre estratégia e tipo de regra
      if (ruleData.rotation_strategy === 'ai_optimized') {
        if (ruleData.rule_type === 'systematic' && ruleData.ai_enabled === false) {
          warnings.push('Estratégia ai_optimized requer IA habilitada ou tipo de regra ai/hybrid');
        }
      }
    }

    // Validar max_items_per_playlist
    if (ruleData.max_items_per_playlist !== undefined) {
      if (ruleData.max_items_per_playlist < 1) {
        errors.push('max_items_per_playlist deve ser pelo menos 1');
      } else if (ruleData.max_items_per_playlist > 1000) {
        errors.push('max_items_per_playlist não pode ser maior que 1000');
      } else if (ruleData.max_items_per_playlist > 500) {
        warnings.push('max_items_per_playlist muito alto pode causar problemas de performance');
      }
    }

    // Validar totem_id se fornecido
    const totemId = (ruleData as any).totem_id;
    if (totemId !== undefined && totemId !== null && totemId > 0) {
      const totemExists = await this.db.findFirst(`
        SELECT totem_id FROM totems WHERE totem_id = $1
      `, [totemId]);
      
      if (!totemExists) {
        errors.push(`Totem com ID ${totemId} não existe`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Retorna regra padrão
   */
  private getDefaultMixRule(): MixRule {
    return {
      rule_id: 0,
      name: 'Regra Padrão',
      rule_type: 'systematic',
      priority_weight: 1.0,
      time_weight: 1.0,
      tag_weight: 0.5,
      subscriber_weight: 0.5,
      ai_enabled: false,
      use_pedestrian_detection: false,
      use_sentiment_analysis: false,
      use_context_awareness: false,
      use_historical_optimization: false,
      max_items_per_playlist: 50,
      rotation_strategy: 'priority',
      shuffle_enabled: false,
    };
  }

  /**
   * Atualiza ou cria contexto de IA para um totem
   */
  async updateAIContext(totemId: number, contextData: Partial<AIContext>): Promise<AIContext> {
    try {
      // Verificar se totem existe
      const totem = await this.db.findFirst(`
        SELECT totem_id FROM totems WHERE totem_id = $1
      `, [totemId]);

      if (!totem) {
        throw new Error('Totem não encontrado');
      }

      // Verificar se contexto já existe
      const existing = await this.db.findFirst(`
        SELECT context_id FROM ai_context_data WHERE totem_id = $1
      `, [totemId]);

      let contextId: number;

      if (existing) {
        // Atualizar contexto existente
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (contextData.pedestrian_count !== undefined) {
          updates.push(`pedestrian_count = $${paramIndex}`);
          params.push(contextData.pedestrian_count);
          paramIndex++;
        }
        if (contextData.pedestrian_density !== undefined) {
          updates.push(`pedestrian_density = $${paramIndex}`);
          params.push(contextData.pedestrian_density);
          paramIndex++;
        }
        if (contextData.pedestrian_demographics !== undefined) {
          updates.push(`pedestrian_demographics = $${paramIndex}`);
          params.push(JSON.stringify(contextData.pedestrian_demographics));
          paramIndex++;
        }
        if (contextData.sentiment_score !== undefined) {
          updates.push(`sentiment_score = $${paramIndex}`);
          params.push(contextData.sentiment_score);
          paramIndex++;
        }
        if (contextData.sentiment_label !== undefined) {
          updates.push(`sentiment_label = $${paramIndex}`);
          params.push(contextData.sentiment_label);
          paramIndex++;
        }
        if (contextData.emotion_tags !== undefined) {
          updates.push(`emotion_tags = $${paramIndex}`);
          params.push(contextData.emotion_tags);
          paramIndex++;
        }
        if (contextData.time_of_day !== undefined) {
          updates.push(`time_of_day = $${paramIndex}`);
          params.push(contextData.time_of_day);
          paramIndex++;
        }
        if (contextData.day_type !== undefined) {
          updates.push(`day_type = $${paramIndex}`);
          params.push(contextData.day_type);
          paramIndex++;
        }
        if (contextData.weather_context !== undefined) {
          updates.push(`weather_context = $${paramIndex}`);
          params.push(JSON.stringify(contextData.weather_context));
          paramIndex++;
        }
        if (contextData.event_context !== undefined) {
          updates.push(`event_context = $${paramIndex}`);
          params.push(JSON.stringify(contextData.event_context));
          paramIndex++;
        }
        if (contextData.performance_metrics !== undefined) {
          updates.push(`performance_metrics = $${paramIndex}`);
          params.push(JSON.stringify(contextData.performance_metrics));
          paramIndex++;
        }

        // Atualizar timestamps apropriados
        if (contextData.pedestrian_count !== undefined || contextData.pedestrian_density !== undefined) {
          updates.push(`last_pedestrian_detection = CURRENT_TIMESTAMP`);
        }
        if (contextData.sentiment_score !== undefined || contextData.sentiment_label !== undefined) {
          updates.push(`last_sentiment_analysis = CURRENT_TIMESTAMP`);
        }
        if (contextData.performance_metrics !== undefined) {
          updates.push(`last_performance_update = CURRENT_TIMESTAMP`);
        }

        params.push(existing.context_id);

        await this.db.executeRaw(`
          UPDATE ai_context_data
          SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE context_id = $${paramIndex}
        `, params);

        contextId = existing.context_id;
      } else {
        // Criar novo contexto
        const result = await this.db.executeRaw(`
          INSERT INTO ai_context_data (
            totem_id,
            pedestrian_count,
            pedestrian_density,
            pedestrian_demographics,
            sentiment_score,
            sentiment_label,
            emotion_tags,
            time_of_day,
            day_type,
            weather_context,
            event_context,
            performance_metrics,
            last_pedestrian_detection,
            last_sentiment_analysis,
            last_performance_update
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING context_id
        `, [
          totemId,
          contextData.pedestrian_count || 0,
          contextData.pedestrian_density || null,
          contextData.pedestrian_demographics ? JSON.stringify(contextData.pedestrian_demographics) : null,
          contextData.sentiment_score || null,
          contextData.sentiment_label || null,
          contextData.emotion_tags || null,
          contextData.time_of_day || null,
          contextData.day_type || null,
          contextData.weather_context ? JSON.stringify(contextData.weather_context) : null,
          contextData.event_context ? JSON.stringify(contextData.event_context) : null,
          contextData.performance_metrics ? JSON.stringify(contextData.performance_metrics) : null,
          (contextData.pedestrian_count !== undefined) ? new Date() : null,
          (contextData.sentiment_score !== undefined || contextData.sentiment_label !== undefined) ? new Date() : null,
          (contextData.performance_metrics !== undefined) ? new Date() : null,
        ]);

        contextId = result.rows[0].context_id;
      }

      // Buscar contexto atualizado
      const updated = await this.getAIContextForTotem(totemId);
      if (!updated) {
        throw new Error('Erro ao buscar contexto atualizado');
      }

      await logDebug('Contexto de IA atualizado', { totemId, contextId });

      return updated;
    } catch (error: any) {
      await logError('Erro ao atualizar contexto de IA', error, { totemId, contextData });
      throw error;
    }
  }

  /**
   * Obtém contexto de IA para um totem
   */
  async getAIContextForTotem(totemId: number): Promise<AIContext | null> {
    try {
      const result = await this.db.findFirst(`
        SELECT * FROM get_ai_context_for_totem($1)
      `, [totemId]);

      if (!result) {
        return null;
      }

      return {
        context_id: result.context_id,
        pedestrian_count: result.pedestrian_count || 0,
        pedestrian_density: result.pedestrian_density,
        pedestrian_demographics: result.pedestrian_demographics,
        sentiment_score: result.sentiment_score ? parseFloat(result.sentiment_score) : undefined,
        sentiment_label: result.sentiment_label,
        emotion_tags: result.emotion_tags,
        time_of_day: result.time_of_day,
        day_type: result.day_type,
        weather_context: result.weather_context,
        event_context: result.event_context,
        performance_metrics: result.performance_metrics,
      };
    } catch (error: any) {
      await logError('Erro ao obter contexto de IA', error, { totemId });
      return null;
    }
  }

  /**
   * Gera playlist mixada para um totem
   */
  async generateMixForTotem(totemId: number): Promise<TotemPlaylistMix> {
    try {
      // 1. Obter regra de mixagem
      const rule = await this.getMixRuleForTotem(totemId);
      if (!rule) {
        throw new Error('Regra de mixagem não encontrada');
      }

      // 2. Obter contexto de IA (se habilitado)
      let aiContext: AIContext | null = null;
      if (rule.ai_enabled || rule.rule_type === 'ai' || rule.rule_type === 'hybrid') {
        aiContext = await this.getAIContextForTotem(totemId);
        
        // Se análise de sentimento está habilitada mas não temos dados, tentar usar IA
        if (rule.use_sentiment_analysis && (!aiContext || aiContext.sentiment_score === undefined)) {
          try {
            const sentimentAnalysis = await this.analyzeSentimentWithAI(totemId, rule);
            if (sentimentAnalysis) {
              if (!aiContext) {
                // Criar contexto básico se não existir
                aiContext = await this.updateAIContext(totemId, {
                  sentiment_score: sentimentAnalysis.score,
                  sentiment_label: sentimentAnalysis.label,
                });
              } else {
                aiContext.sentiment_score = sentimentAnalysis.score;
                aiContext.sentiment_label = sentimentAnalysis.label;
              }
            }
          } catch (error: any) {
            await logDebug('Erro ao analisar sentimento com IA, continuando sem dados', { totemId, error: error.message });
          }
        }
      }
      
      // Tentar obter mix do cache antes de gerar
      const mixCacheKey = `totem_mix:${totemId}:current`;
      try {
        const cachedMix = await this.cacheService.get(mixCacheKey);
        if (cachedMix && typeof cachedMix === 'string') {
          const parsed = JSON.parse(cachedMix);
          // Verificar se a mixagem ainda é válida (ex: não expirou, mesma regra)
          if (parsed.rule_id === (rule.rule_id > 0 ? rule.rule_id : null)) {
            await logDebug('Retornando mix do cache', { totemId, mixId: parsed.mix_id });
            return parsed;
          }
        }
      } catch (e) {
        // Cache não disponível ou inválido, continuar com geração
      }

      // 3. Obter totem e publisher
      const totem = await this.db.findFirst(`
        SELECT t.totem_id, t.local_id, l.publisher_id
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        WHERE t.totem_id = $1
      `, [totemId]);

      if (!totem || !totem.publisher_id) {
        throw new Error('Totem ou publisher não encontrado');
      }

      // 4. Obter campanhas mixadas para o totem
      const mixedCampaigns = await this.campaignMixService.getMixedCampaignsForTotem(
        totem.publisher_id,
        totemId
      );

      // 5. Coletar todos os itens de todas as playlists + mídias diretas das campanhas
      const allItems: MixItem[] = [];

      for (const campaign of mixedCampaigns) {
        // 5.1 Itens vindos de playlists da campanha
        for (const playlist of campaign.playlists) {
          // Buscar itens da playlist
          const playlistItems = await this.db.findMany(`
            SELECT 
              pi.item_id,
              pi.media_id,
              pi.playlist_id,
              pi.order_index,
              pi.display_seconds as duration,
              m.tags,
              m.duration_seconds as media_duration
            FROM playlist_items pi
            INNER JOIN medias m ON pi.media_id = m.media_id
            WHERE pi.playlist_id = $1
            ORDER BY pi.order_index ASC
          `, [playlist.playlist_id]);

          for (const item of playlistItems) {
            // Calcular peso do item
            const weight = this.calculateItemWeight(
              item,
              campaign,
              playlist,
              rule,
              aiContext
            );

            allItems.push({
              media_id: item.media_id,
              playlist_id: playlist.playlist_id,
              campaign_id: campaign.campaign_id,
              subscriber_id: campaign.subscriber_id,
              order_index: item.order_index,
              weight: weight,
              source: 'campaign',
              priority: campaign.priority * playlist.priority,
              tags: item.tags ? (typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags) : [],
              duration: item.duration || item.media_duration || 10,
            });
          }
        }

        // 5.2 Mídias diretas associadas à campanha (campaign_medias)
        const directMedias = await this.db.findMany(`
          SELECT 
            cm.media_id,
            cm.order_index,
            cm.display_seconds as duration,
            m.tags,
            m.duration_seconds as media_duration
          FROM campaign_medias cm
          INNER JOIN medias m ON m.media_id = cm.media_id
          WHERE cm.campaign_id = $1
            AND COALESCE(cm.is_active, true) = true
            AND m.is_active = true
          ORDER BY cm.order_index ASC, m.media_id ASC
        `, [campaign.campaign_id]);

        for (const item of directMedias) {
          const weight = this.calculateItemWeight(
            item,
            campaign,
            // Não há playlist específica; usamos um objeto \"playlist\" neutro apenas para o cálculo de peso
            { playlist_id: 0, name: 'direct-medias', priority: 1 } as any,
            rule,
            aiContext
          );

          allItems.push({
            media_id: item.media_id,
            playlist_id: 0,
            campaign_id: campaign.campaign_id,
            subscriber_id: campaign.subscriber_id,
            order_index: item.order_index ?? 0,
            weight,
            source: 'campaign',
            priority: campaign.priority,
            tags: item.tags ? (typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags) : [],
            duration: item.duration || item.media_duration || 10,
          });
        }
      }

      // 6. Ordenar e filtrar itens baseado na regra
      const sortedItems = this.sortAndFilterItems(allItems, rule, aiContext);

      // 7. Distribuir em slots por hora (timeline) usando campos comerciais
      const finalItems = await this.distributeIntoTimeSlots(
        sortedItems,
        mixedCampaigns,
        rule
      );

      // 8. Calcular duração total
      const totalDuration = finalItems.reduce((sum, item) => sum + (item.duration || 10), 0);

      // 9. Criar snapshot do contexto
      const contextSnapshot = {
        rule_id: rule.rule_id,
        rule_name: rule.name,
        ai_context: aiContext,
        generated_at: new Date().toISOString(),
        total_campaigns: mixedCampaigns.length,
        total_playlists: mixedCampaigns.reduce((sum, c) => sum + c.playlists.length, 0),
        total_items_before_filter: allItems.length,
      };

      // 10. Salvar mixagem no banco
      const mixResult = await this.db.executeRaw(`
        INSERT INTO totem_playlist_mix (
          totem_id,
          rule_id,
          mix_version,
          mix_items,
          total_items,
          total_duration,
          mix_strategy,
          context_snapshot,
          is_active,
          is_current
        )
        VALUES ($1, $2, 
          COALESCE((SELECT MAX(mix_version) FROM totem_playlist_mix WHERE totem_id = $1), 0) + 1,
          $3, $4, $5, $6, $7, true, false
        )
        RETURNING mix_id, mix_version, generated_at
      `, [
        totemId,
        rule.rule_id > 0 ? rule.rule_id : null,
        JSON.stringify(finalItems),
        finalItems.length,
        totalDuration,
        rule.rule_type,
        JSON.stringify(contextSnapshot),
      ]);

      const mixId = mixResult.rows[0].mix_id;
      const mixVersion = mixResult.rows[0].mix_version;

      // 11. Marcar como atual
      await this.setCurrentMix(totemId, mixId);

      const mixResult_obj = {
        mix_id: mixId,
        totem_id: totemId,
        rule_id: rule.rule_id > 0 ? rule.rule_id : undefined,
        mix_version: mixVersion,
        mix_items: finalItems,
        total_items: finalItems.length,
        total_duration: totalDuration,
        mix_strategy: rule.rule_type,
        context_snapshot: contextSnapshot,
        is_active: true,
        is_current: true,
        generated_at: mixResult.rows[0].generated_at,
        applied_at: new Date().toISOString(),
      };
      
      // 12. Cachear mixagem por 30 minutos
      await this.cacheService.set(mixCacheKey, JSON.stringify(mixResult_obj), 1800);

      // 13. Disparar webhooks para mixagem gerada
      try {
        await getWebhookService().triggerWebhook('playlist_mix.generated', {
          totem_id: totemId,
          mix_id: mixId,
          mix_version: mixVersion,
          total_items: finalItems.length,
          total_duration: totalDuration,
          strategy: rule.rule_type,
          rule_id: rule.rule_id > 0 ? rule.rule_id : null,
          generated_at: mixResult.rows[0].generated_at,
        });
      } catch (webhookError: any) {
        // Não falhar se webhook falhar
        await logDebug('Erro ao disparar webhook para mixagem gerada', { 
          totemId, 
          mixId, 
          error: webhookError.message 
        });
      }

      await logDebug('Playlist mixada gerada', {
        totemId,
        mixId,
        mixVersion,
        totalItems: finalItems.length,
        totalDuration,
        strategy: rule.rule_type,
      });

      return mixResult_obj;
    } catch (error: any) {
      await logError('Erro ao gerar mix para totem', error, { totemId });
      throw error;
    }
  }

  /**
   * Calcula peso de um item baseado nas regras
   */
  private calculateItemWeight(
    item: any,
    campaign: any,
    playlist: any,
    rule: MixRule,
    aiContext: AIContext | null
  ): number {
    let weight = 0;

    // Peso por prioridade da campanha
    const campaignPriority = typeof campaign.priority === 'number' ? campaign.priority : 1;
    weight += campaignPriority * rule.priority_weight;

    // Peso por tier comercial da campanha (premium > standard > remnant)
    const tier = (campaign.commercial_tier as string) || 'standard';
    const tierWeights: Record<string, number> = {
      premium: 3,
      standard: 2,
      remnant: 1,
    };
    const tierWeight = tierWeights[tier] || 2;
    weight += tierWeight * rule.priority_weight;

    // Peso por share de tempo configurado (campaign_publishers ou campaign)
    const publisherTimeShare =
      typeof campaign.time_share_percent === 'number' ? campaign.time_share_percent : null;
    const defaultTimeShare =
      typeof campaign.default_time_share_percent === 'number'
        ? campaign.default_time_share_percent
        : 0;
    const effectiveTimeShare = publisherTimeShare ?? defaultTimeShare;
    if (effectiveTimeShare > 0) {
      // Normalizar para um fator razoável (0–10) e aplicar peso de horário
      const timeShareFactor = (effectiveTimeShare / 100) * 10;
      weight += timeShareFactor * (rule.time_weight || 1);
    }

    // Peso por prioridade da playlist
    const playlistPriority = typeof playlist.priority === 'number' ? playlist.priority : 1;
    weight += playlistPriority * rule.priority_weight * 0.5;

    // Peso por horário (se aplicável)
    if (rule.time_weight > 0) {
      const now = new Date();
      const hour = now.getHours();
      const isWithinTimeRange = this.isWithinTimeRange(campaign, hour);
      if (isWithinTimeRange) {
        weight += rule.time_weight;
      }
    }

    // Peso por tags (se aplicável)
    if (rule.tag_weight > 0 && item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
      weight += item.tags.length * rule.tag_weight * 0.1;
    }

    // Peso por subscriber (se aplicável)
    if (rule.subscriber_weight > 0) {
      weight += rule.subscriber_weight * 0.5;
    }

    // Ajustes baseados em IA (se habilitado)
    if (aiContext && (rule.ai_enabled || rule.rule_type === 'ai' || rule.rule_type === 'hybrid')) {
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
   * Distribui itens em slots de tempo (timeline) baseado em campos comerciais
   * Respeita time_share_percent, impression limits, e max_consecutive_slots
   */
  private async distributeIntoTimeSlots(
    items: MixItem[],
    campaigns: any[],
    rule: MixRule
  ): Promise<MixItem[]> {
    // Quantidade de slots por hora (6 slots de 10 minutos = 1 hora)
    const SLOTS_PER_HOUR = 6;
    // Período total para gerar mix (ex: 24 horas = 144 slots)
    const TOTAL_HOURS = 24;
    const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR;

    // Criar mapa de campanhas com informações comerciais
    const campaignMap = new Map<number, any>();
    for (const campaign of campaigns) {
      campaignMap.set(campaign.campaign_id, campaign);
    }

    // Calcular share de tempo por campanha (em slots)
    const campaignSlots = new Map<number, number>(); // campaign_id -> número de slots
    const campaignItems = new Map<number, MixItem[]>(); // campaign_id -> itens da campanha
    const campaignConsecutiveCount = new Map<number, number>(); // campaign_id -> slots consecutivos atuais

    // Agrupar itens por campanha
    for (const item of items) {
      if (!campaignItems.has(item.campaign_id)) {
        campaignItems.set(item.campaign_id, []);
        campaignConsecutiveCount.set(item.campaign_id, 0);
      }
      campaignItems.get(item.campaign_id)!.push(item);
    }

    // Calcular slots alocados por campanha baseado em time_share_percent
    let totalAllocatedPercent = 0;
    for (const [campaignId, campaign] of campaignMap) {
      const timeShare = campaign.time_share_percent ?? campaign.default_time_share_percent ?? 0;
      const slots = Math.floor((timeShare / 100) * TOTAL_SLOTS);
      campaignSlots.set(campaignId, slots);
      totalAllocatedPercent += timeShare;
    }

    // Distribuir slots restantes proporcionalmente para campanhas sem share definido
    const unallocatedSlots = TOTAL_SLOTS - Array.from(campaignSlots.values()).reduce((a, b) => a + b, 0);
    if (unallocatedSlots > 0 && totalAllocatedPercent < 100) {
      const remainingCampaigns = Array.from(campaignMap.entries()).filter(
        ([id]) => !campaignSlots.has(id) || campaignSlots.get(id) === 0
      );
      const slotsPerCampaign = Math.floor(unallocatedSlots / remainingCampaigns.length);
      for (const [campaignId] of remainingCampaigns) {
        campaignSlots.set(campaignId, (campaignSlots.get(campaignId) || 0) + slotsPerCampaign);
      }
    }

    // Distribuir itens nos slots respeitando limites
    const timeline: (MixItem | null)[] = new Array(TOTAL_SLOTS).fill(null);
    const campaignSlotCount = new Map<number, number>(); // Contador de slots usados por campanha
    const campaignHourlyImpressions = new Map<number, Map<number, number>>(); // campaign_id -> hour -> impressions

    // Inicializar contadores
    for (const campaignId of campaignMap.keys()) {
      campaignSlotCount.set(campaignId, 0);
      campaignHourlyImpressions.set(campaignId, new Map());
    }

    // Ordenar campanhas por tier (premium primeiro) e prioridade
    const sortedCampaignIds = Array.from(campaignMap.keys()).sort((a, b) => {
      const campaignA = campaignMap.get(a)!;
      const campaignB = campaignMap.get(b)!;
      const tierOrder: Record<string, number> = { premium: 3, standard: 2, remnant: 1 };
      const tierA = tierOrder[campaignA.commercial_tier || 'standard'] || 2;
      const tierB = tierOrder[campaignB.commercial_tier || 'standard'] || 2;
      if (tierA !== tierB) return tierB - tierA;
      return (campaignB.priority || 1) - (campaignA.priority || 1);
    });

    // Preencher timeline slot por slot
    for (let slotIndex = 0; slotIndex < TOTAL_SLOTS; slotIndex++) {
      const hour = Math.floor(slotIndex / SLOTS_PER_HOUR);
      
      // Tentar preencher slot com itens das campanhas prioritárias
      let filled = false;
      for (const campaignId of sortedCampaignIds) {
        const campaign = campaignMap.get(campaignId)!;
        const maxSlots = campaignSlots.get(campaignId) || 0;
        const currentSlots = campaignSlotCount.get(campaignId) || 0;
        const maxConsecutive = campaign.max_consecutive_slots || 2;
        const currentConsecutive = campaignConsecutiveCount.get(campaignId) || 0;
        const hourlyImpressions = campaignHourlyImpressions.get(campaignId)!.get(hour) || 0;
        const maxImpressions = campaign.max_impressions_per_hour || Infinity;

        // Verificar limites
        if (currentSlots >= maxSlots) continue; // Limite de slots atingido
        if (currentConsecutive >= maxConsecutive) continue; // Limite de consecutivos atingido
        if (maxImpressions !== Infinity && hourlyImpressions >= maxImpressions) continue; // Limite de impressões/hora

        // Pegar próximo item da campanha
        const items = campaignItems.get(campaignId) || [];
        if (items.length === 0) continue;

        const item = items.shift()!; // Remove do array
        timeline[slotIndex] = item;

        // Atualizar contadores
        campaignSlotCount.set(campaignId, currentSlots + 1);
        campaignConsecutiveCount.set(campaignId, currentConsecutive + 1);
        
        // Reset contador consecutivo das outras campanhas
        for (const [otherId] of campaignMap) {
          if (otherId !== campaignId) {
            campaignConsecutiveCount.set(otherId, 0);
          }
        }

        // Atualizar impressões por hora
        const currentHourly = campaignHourlyImpressions.get(campaignId)!.get(hour) || 0;
        campaignHourlyImpressions.get(campaignId)!.set(hour, currentHourly + 1);

        filled = true;
        break;
      }

      // Se não preencheu, tentar com qualquer campanha disponível
      if (!filled) {
        for (const campaignId of sortedCampaignIds) {
          const items = campaignItems.get(campaignId) || [];
          if (items.length > 0) {
            const item = items.shift()!;
            timeline[slotIndex] = item;
            const currentSlots = campaignSlotCount.get(campaignId) || 0;
            campaignSlotCount.set(campaignId, currentSlots + 1);
            break;
          }
        }
      }
    }

    // Remover slots vazios e retornar itens ordenados
    const finalItems = timeline.filter(item => item !== null) as MixItem[];
    
    // Adicionar ordem sequencial baseada na posição no timeline
    finalItems.forEach((item, index) => {
      item.order_index = index + 1;
    });

    // Limitar ao máximo permitido pela regra
    return finalItems.slice(0, rule.max_items_per_playlist);
  }

  /**
   * Verifica se está dentro do intervalo de horário
   */
  private isWithinTimeRange(campaign: any, currentHour: number): boolean {
    if (!campaign.start_time || !campaign.end_time) {
      return true; // Sem restrição de horário
    }

    const [startHour] = campaign.start_time.split(':').map(Number);
    const [endHour] = campaign.end_time.split(':').map(Number);

    if (startHour <= endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      // Horário cruza meia-noite
      return currentHour >= startHour || currentHour < endHour;
    }
  }

  /**
   * Ordena e filtra itens baseado na regra
   */
  private sortAndFilterItems(
    items: MixItem[],
    rule: MixRule,
    aiContext: AIContext | null
  ): MixItem[] {
    let sorted = [...items];

    // Ordenar por peso (maior primeiro)
    sorted.sort((a, b) => b.weight - a.weight);

    // Aplicar estratégia de rotação
    if (rule.rotation_strategy === 'round_robin') {
      // Round-robin: distribuir igualmente entre campanhas
      sorted = this.roundRobinSort(sorted);
    } else if (rule.rotation_strategy === 'priority') {
      // Já ordenado por peso/prioridade
      // Manter ordenação atual
    } else if (rule.rotation_strategy === 'weighted') {
      // Weighted: usar peso calculado (já está ordenado)
      // Manter ordenação atual
    } else if (rule.rotation_strategy === 'ai_optimized' && aiContext) {
      // IA otimizada: reordenar baseado em contexto de IA
      sorted = this.aiOptimizedSort(sorted, aiContext, rule);
    }

    // Embaralhar dentro da mesma prioridade (se habilitado)
    if (rule.shuffle_enabled) {
      sorted = this.shuffleByPriority(sorted);
    }

    return sorted;
  }

  /**
   * Ordenação round-robin
   */
  private roundRobinSort(items: MixItem[]): MixItem[] {
    const byCampaign = new Map<number, MixItem[]>();
    
    // Agrupar por campanha
    for (const item of items) {
      if (!byCampaign.has(item.campaign_id)) {
        byCampaign.set(item.campaign_id, []);
      }
      byCampaign.get(item.campaign_id)!.push(item);
    }

    // Intercalar itens de cada campanha
    const result: MixItem[] = [];
    const campaigns = Array.from(byCampaign.keys());
    let maxLength = Math.max(...Array.from(byCampaign.values()).map(arr => arr.length));

    for (let i = 0; i < maxLength; i++) {
      for (const campaignId of campaigns) {
        const campaignItems = byCampaign.get(campaignId)!;
        if (i < campaignItems.length) {
          result.push(campaignItems[i]);
        }
      }
    }

    return result;
  }

  /**
   * Ordenação otimizada por IA
   */
  private aiOptimizedSort(items: MixItem[], context: AIContext, rule: MixRule): MixItem[] {
    // Aplicar ajustes adicionais baseados em contexto de IA
    const adjusted = items.map(item => {
      let adjustedWeight = item.weight;

      // Ajustar baseado em densidade de transeuntes
      if (rule.use_pedestrian_detection && context.pedestrian_density) {
        if (context.pedestrian_density === 'high' && item.tags?.includes('promocao')) {
          adjustedWeight *= 1.3;
        }
      }

      // Ajustar baseado em sentimento
      if (rule.use_sentiment_analysis && context.sentiment_score !== undefined) {
        if (context.sentiment_score > 0.5 && item.tags?.includes('positivo')) {
          adjustedWeight *= 1.2;
        }
      }

      return { ...item, weight: adjustedWeight };
    });

    // Reordenar por peso ajustado
    adjusted.sort((a, b) => b.weight - a.weight);

    return adjusted;
  }

  /**
   * Analisa sentimento usando AIService
   */
  private async analyzeSentimentWithAI(totemId: number, rule: MixRule): Promise<{ score: number; label: 'positive' | 'neutral' | 'negative' } | null> {
    try {
      // Verificar se AIService está habilitado
      const aiService = this.getAIService();
      
      // Buscar dados recentes do totem para análise
      const recentData = await this.db.findFirst(`
        SELECT 
          t.name as totem_name,
          COUNT(DISTINCT el.log_id) as recent_views
        FROM totems t
        LEFT JOIN event_logs el ON el.totem_id = t.totem_id 
          AND el.event_type = 'media_play'
          AND el.timestamp > NOW() - INTERVAL '24 hours'
        WHERE t.totem_id = $1
        GROUP BY t.totem_id, t.name
      `, [totemId]);

      if (!recentData) {
        return null;
      }

      // Criar prompt para análise de sentimento
      const prompt = `Analise o sentimento e engajamento do público baseado nos seguintes dados do totem digital:
- Nome do totem: ${recentData.totem_name}
- Visualizações nas últimas 24 horas: ${recentData.recent_views || 0}

Retorne apenas um JSON com:
- "sentiment": número de -1 (negativo) a 1 (positivo)
- "label": "positive", "neutral" ou "negative"
- "confidence": número de 0 a 1`;

      // Usar AIService para análise (userId 1 = sistema)
      const aiResponse = await aiService.processRequest({
        prompt,
        maxTokens: 200,
        temperature: 0.3,
        model: rule.ai_model,
        systemPrompt: 'Você é um analista de sentimento especializado em análise de engajamento de público em displays digitais. Sempre retorne JSON válido.'
      }, 1);

      // Tentar extrair JSON da resposta
      const jsonMatch = aiResponse.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const score = Math.max(-1, Math.min(1, parseFloat(parsed.sentiment) || 0));
        const label = parsed.label === 'positive' || parsed.label === 'negative' || parsed.label === 'neutral' 
          ? parsed.label 
          : (score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral');
        
        return { score, label };
      }

      return null;
    } catch (error: any) {
      await logDebug('Erro ao analisar sentimento com IA', { totemId, error: error.message });
      return null;
    }
  }

  /**
   * Embaralhar itens dentro da mesma prioridade
   */
  private shuffleByPriority(items: MixItem[]): MixItem[] {
    const byPriority = new Map<number, MixItem[]>();

    // Agrupar por prioridade
    for (const item of items) {
      const priority = Math.floor(item.priority);
      if (!byPriority.has(priority)) {
        byPriority.set(priority, []);
      }
      byPriority.get(priority)!.push(item);
    }

    // Embaralhar dentro de cada grupo de prioridade
    const result: MixItem[] = [];
    const priorities = Array.from(byPriority.keys()).sort((a, b) => b - a);

    for (const priority of priorities) {
      const group = byPriority.get(priority)!;
      // Embaralhar array
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
      }
      result.push(...group);
    }

    return result;
  }

  /**
   * Define mixagem atual para um totem
   */
  async setCurrentMix(totemId: number, mixId: number): Promise<boolean> {
    try {
      const result = await this.db.executeRaw(`
        SELECT set_current_mix_for_totem($1, $2) as success
      `, [totemId, mixId]);

      return result.rows[0].success === true;
    } catch (error: any) {
      await logError('Erro ao definir mix atual', error, { totemId, mixId });
      return false;
    }
  }

  /**
   * Obtém mixagem atual de um totem
   */
  async getCurrentMix(totemId: number): Promise<TotemPlaylistMix | null> {
    try {
      const result = await this.db.findFirst(`
        SELECT * FROM get_current_mix_for_totem($1)
      `, [totemId]);

      if (!result) {
        return null;
      }

      return {
        mix_id: result.mix_id,
        totem_id: totemId,
        rule_id: result.rule_id,
        mix_version: result.mix_version,
        mix_items: typeof result.mix_items === 'string' 
          ? JSON.parse(result.mix_items) 
          : result.mix_items,
        total_items: result.total_items,
        total_duration: result.total_duration,
        mix_strategy: result.mix_strategy,
        context_snapshot: result.context_snapshot,
        is_active: true,
        is_current: true,
        generated_at: result.generated_at,
        applied_at: result.applied_at,
      };
    } catch (error: any) {
      await logError('Erro ao obter mix atual', error, { totemId });
      return null;
    }
  }
}

let totemPlaylistMixServiceInstance: TotemPlaylistMixService;

export function getTotemPlaylistMixService(): TotemPlaylistMixService {
  if (!totemPlaylistMixServiceInstance) {
    totemPlaylistMixServiceInstance = new TotemPlaylistMixService();
  }
  return totemPlaylistMixServiceInstance;
}

