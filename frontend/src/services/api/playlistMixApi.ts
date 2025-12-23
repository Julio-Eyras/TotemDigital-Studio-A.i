/**
 * API Service para Mixagem de Playlists
 */

import api from './index';

export interface MixRule {
  rule_id: number;
  totem_id?: number | null;
  name: string;
  description?: string;
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
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIContext {
  context_id: number;
  totem_id: number;
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
  last_pedestrian_detection?: string;
  last_sentiment_analysis?: string;
  last_performance_update?: string;
  updated_at: string;
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

export interface MixHistory {
  history_id: number;
  totem_id: number;
  mix_id?: number;
  rule_id?: number;
  mix_strategy?: string;
  total_items: number;
  total_duration: number;
  execution_count: number;
  average_view_time?: number;
  engagement_score?: number;
  context_snapshot?: any;
  generated_at?: string;
  applied_at?: string;
  last_executed_at?: string;
  created_at: string;
}

export interface MixGroupCampaignSummary {
  campaign_id: number;
  total_duration: number;
  total_items: number;
  share_percent?: number;
}

export interface MixGroupTotemSummary {
  totem_id: number;
  name?: string | null;
  identifier: string;
  local_id?: number | null;
  local_name?: string | null;
  tv_count: number;
  mix_total_duration: number;
  mix_total_items: number;
}

export interface MixGroupOverview {
  publisher_id: number;
  publisher_name: string;
  local_id?: number | null;
  local_name?: string | null;
  total_totems: number;
  total_tvs: number;
  campaigns: MixGroupCampaignSummary[];
  totems: MixGroupTotemSummary[];
}

export interface CreateMixRuleRequest {
  name: string;
  description?: string;
  totem_id?: number;
  rule_type: 'systematic' | 'ai' | 'hybrid';
  priority_weight?: number;
  time_weight?: number;
  tag_weight?: number;
  subscriber_weight?: number;
  ai_enabled?: boolean;
  ai_provider?: string;
  ai_model?: string;
  ai_config?: any;
  use_pedestrian_detection?: boolean;
  use_sentiment_analysis?: boolean;
  use_context_awareness?: boolean;
  use_historical_optimization?: boolean;
  max_items_per_playlist?: number;
  rotation_strategy?: 'round_robin' | 'priority' | 'weighted' | 'ai_optimized';
  shuffle_enabled?: boolean;
  is_default?: boolean;
}

export interface UpdateMixRuleRequest extends Partial<CreateMixRuleRequest> {
  is_active?: boolean;
}

export interface UpdateAIContextRequest {
  pedestrian_count?: number;
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

export interface MixHistoryFilters {
  totemId?: number;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Lista todas as regras de mixagem
 */
export const getMixRules = async (totemId?: number): Promise<MixRule[]> => {
  const params = totemId ? { totemId } : {};
  const response = await api.get('/playlist-mix/rules', { params });
  return response.data.data || [];
};

/**
 * Obtém uma regra de mixagem por ID
 */
export const getMixRule = async (ruleId: number): Promise<MixRule> => {
  const response = await api.get(`/playlist-mix/rules/${ruleId}`);
  return response.data.data;
};

/**
 * Cria uma nova regra de mixagem
 */
export const createMixRule = async (data: CreateMixRuleRequest): Promise<MixRule> => {
  const response = await api.post('/playlist-mix/rules', data);
  return response.data.data;
};

/**
 * Atualiza uma regra de mixagem
 */
export const updateMixRule = async (ruleId: number, data: UpdateMixRuleRequest): Promise<MixRule> => {
  const response = await api.put(`/playlist-mix/rules/${ruleId}`, data);
  return response.data.data;
};

/**
 * Deleta uma regra de mixagem
 */
export const deleteMixRule = async (ruleId: number): Promise<void> => {
  await api.delete(`/playlist-mix/rules/${ruleId}`);
};

/**
 * Obtém contexto de IA para um totem
 */
export const getAIContext = async (totemId: number): Promise<AIContext | null> => {
  const response = await api.get(`/playlist-mix/context/${totemId}`);
  return response.data.data || null;
};

/**
 * Atualiza contexto de IA para um totem
 */
export const updateAIContext = async (totemId: number, data: UpdateAIContextRequest): Promise<AIContext> => {
  const response = await api.post(`/playlist-mix/context/${totemId}`, data);
  return response.data.data;
};

/**
 * Obtém playlist mixada atual de um totem
 */
export const getCurrentMix = async (totemId: number): Promise<TotemPlaylistMix> => {
  const response = await api.get(`/totems/${totemId}/playlist/mix`);
  return response.data.data;
};

/**
 * Gera nova playlist mixada para um totem
 */
export const generateMix = async (totemId: number): Promise<TotemPlaylistMix> => {
  const response = await api.post(`/totems/${totemId}/playlist/mix/generate`);
  return response.data.data;
};

/**
 * Obtém histórico de mixagens
 */
export const getMixHistory = async (filters: MixHistoryFilters = {}): Promise<{
  data: MixHistory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}> => {
  const response = await api.get('/playlist-mix/history', { params: filters });
  return {
    data: response.data.data || [],
    pagination: response.data.pagination || { page: 1, limit: 20, total: 0 }
  };
};

/**
 * Obtém overview de mixagem por grupo (publisher/local)
 */
export const getMixOverview = async (params?: {
  publisherId?: number;
  localId?: number;
}): Promise<MixGroupOverview[]> => {
  const response = await api.get('/playlist-mix/overview', { params });
  return response.data.data || [];
};

/**
 * Analytics de performance de mixagens
 */
export interface MixAnalytics {
  stats: {
    total_mixes: number;
    avg_items: number;
    avg_duration: number;
    avg_engagement: number;
    avg_executions: number;
    total_executions: number;
  };
  byStrategy: Array<{
    strategy: string;
    count: number;
    avg_engagement: number;
    avg_executions: number;
    avg_items: number;
  }>;
  topMixes: Array<{
    history_id: number;
    totem_id: number;
    totem_identifier?: string;
    totem_name?: string;
    mix_strategy?: string;
    engagement_score: number | null;
    execution_count: number;
    total_items: number;
    total_duration: number;
    generated_at?: string;
  }>;
  byTotem: Array<{
    totem_id: number;
    totem_identifier?: string;
    totem_name?: string;
    mix_count: number;
    avg_engagement: number;
    total_executions: number;
    avg_items: number;
  }>;
  trend: Array<{
    date: string;
    mix_count: number;
    avg_engagement: number;
    total_executions: number;
  }>;
}

export const getMixAnalytics = async (filters?: {
  totemId?: number;
  startDate?: string;
  endDate?: string;
  ruleId?: number;
}): Promise<{
  success: boolean;
  data: MixAnalytics;
}> => {
  const params: any = {};
  if (filters?.totemId) params.totemId = filters.totemId;
  if (filters?.startDate) params.startDate = filters.startDate;
  if (filters?.endDate) params.endDate = filters.endDate;
  if (filters?.ruleId) params.ruleId = filters.ruleId;
  
  const response = await api.get('/playlist-mix/analytics', { params });
  return response.data;
};

