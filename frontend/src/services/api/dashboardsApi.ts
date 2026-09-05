import { api } from './index';

export type DashboardKind = 'ace' | 'fx' | 'general';

export interface WidgetMeta {
  id: string;
  title: string;
  description?: string;
  category: 'kpi' | 'chart' | 'heatmap' | 'timeline' | 'table' | 'gauge' | 'compare';
  unit?: string;
  updatedAt?: string;
  cacheKey?: string;
  sources?: string[];
}

export interface KpiValue {
  value: number;
  previous?: number;
  delta?: number;
  deltaPercent?: number;
  trend?: 'up' | 'down' | 'flat';
  label?: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
  group?: string;
}

export interface HeatmapCell {
  x: string;
  y: string;
  value: number;
  count?: number;
}

export interface AceAudienceTimeline {
  hour: number;
  weekday: string;
  detected: number;
  engaged: number;
}

export interface AceTopContent {
  mediaId: number;
  mediaName: string;
  impressions: number;
  engagements: number;
  targetProfile?: string;
}

export interface AceDemographicBucket {
  ageRange: string;
  gender: 'male' | 'female' | 'unknown' | 'other';
  detections: number;
  engagements: number;
  avgDurationSec?: number;
}

export interface AceRecallMetrics {
  totalDetections: number;
  uniqueFaces: number;
  engagedFaces: number;
  recallRate: number;
  avgEngagementDurationSec?: number;
  bounceRate?: number;
}

export interface DashboardFilters {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
  totemIds?: number[];
  campaignIds?: number[];
  mediaIds?: number[];
  fxEffectIds?: number[];
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface DashboardPeriod {
  start: string;
  end: string;
}

export interface DashboardMeta {
  generatedAt: string;
  filters: DashboardFilters;
  period: DashboardPeriod;
}

export interface AceDashboardResponse {
  meta: DashboardMeta;
  widgets: WidgetMeta[];
  kpis: {
    totalDetections: KpiValue;
    uniqueFaces: KpiValue;
    engagementRate: KpiValue;
    recallRate: KpiValue;
    avgWatchTimeSec: KpiValue;
  };
  demographicHeatmap: HeatmapCell[];
  audienceTimeline: AceAudienceTimeline[];
  topContents: AceTopContent[];
  demographicBuckets: AceDemographicBucket[];
  recall: AceRecallMetrics;
}

export interface FxEffectStat {
  effectId: number;
  effectName: string;
  executions: number;
  avgLatencyMs: number;
  p95LatencyMs?: number;
  errors: number;
  successRate: number;
}

export interface FxUptimeStat {
  totemId: number;
  totemName?: string;
  uptimePercent: number;
  downtimeMinutes: number;
  lastOfflineAt?: string;
  syncDriftMs?: number;
}

export interface FxCompareEntry {
  label: string;
  before: number;
  after: number;
  deltaPercent: number;
  metric: string;
}

export interface FxTimelineEvent {
  timestamp: string;
  type: 'orchestration' | 'sync' | 'effect' | 'error' | 'heartbeat';
  totemId?: number;
  effectName?: string;
  durationMs?: number;
  ok: boolean;
}

export interface FxDashboardResponse {
  meta: DashboardMeta;
  widgets: WidgetMeta[];
  kpis: {
    totalExecutions: KpiValue;
    avgLatencyMs: KpiValue;
    fleetUptimePercent: KpiValue;
    syncSuccessRate: KpiValue;
    totalErrors: KpiValue;
  };
  topEffects: FxEffectStat[];
  uptimeByTotem: FxUptimeStat[];
  compareAB: FxCompareEntry[];
  timeline: FxTimelineEvent[];
}

export interface GeneralMediaStat {
  mediaId: number;
  mediaName: string;
  mediaType: string;
  impressions: number;
  plays: number;
  ctrPercent: number;
  avgWatchPercent?: number;
}

export interface GeneralCampaignStat {
  campaignId: number;
  campaignName: string;
  budgetSpent?: number;
  impressions: number;
  clicks?: number;
  conversions?: number;
  roi?: number;
}

export interface GeneralTotemFleetStat {
  total: number;
  online: number;
  offline: number;
  warning: number;
  avgUptimePercent: number;
  totalHeartbeats24h: number;
}

export interface GeneralPlaylistStat {
  playlistId: number;
  playlistName: string;
  plays: number;
  impressions: number;
  skipRate?: number;
  avgCompletionPercent?: number;
}

export interface GeneralBillingStat {
  plan?: string;
  meteredUsage?: {
    impressions: number;
    bandwidthMB: number;
    storageMB: number;
    aiCreditsUsed: number;
  };
  currentMonthCost?: number;
  projectedCost?: number;
}

export interface GeneralAnalyticsResponse {
  meta: DashboardMeta;
  widgets: WidgetMeta[];
  kpis: {
    totalImpressions: KpiValue;
    totalPlays: KpiValue;
    ctrPercent: KpiValue;
    avgWatchTimeSec: KpiValue;
    fleetUptimePercent: KpiValue;
  };
  impressionsTimeline: TimeSeriesPoint[];
  topMedias: GeneralMediaStat[];
  topCampaigns: GeneralCampaignStat[];
  fleet: GeneralTotemFleetStat;
  playlists: GeneralPlaylistStat[];
  billing?: GeneralBillingStat;
}

export interface DashboardAggregateRequest {
  kind: DashboardKind;
  filters?: DashboardFilters;
  includeWidgets?: string[];
  excludeWidgets?: string[];
  useCache?: boolean;
  ttlSec?: number;
}

export type AnyDashboardResponse = AceDashboardResponse | FxDashboardResponse | GeneralAnalyticsResponse;

export interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp?: string;
  kind?: DashboardKind;
}

export interface DashboardsQueryOptions {
  filters?: DashboardFilters;
  useCache?: boolean;
  ttlSec?: number;
}

function toQuery(params: Record<string, unknown>): string {
  const parts: string[] = [];
  const push = (k: string, v: unknown) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      if (value.length) push(key, value.join(','));
    } else {
      push(key, value);
    }
  });
  return parts.length ? `?${parts.join('&')}` : '';
}

export const dashboardsApi = {
  getAce: async (opts?: DashboardsQueryOptions): Promise<AceDashboardResponse> => {
    const qs = toQuery({
      startDate: opts?.filters?.startDate,
      endDate: opts?.filters?.endDate,
      granularity: opts?.filters?.granularity,
      totemIds: opts?.filters?.totemIds,
      mediaIds: opts?.filters?.mediaIds,
      campaignIds: opts?.filters?.campaignIds,
      fxEffectIds: opts?.filters?.fxEffectIds,
      search: opts?.filters?.search,
      sortBy: opts?.filters?.sortBy,
      sortOrder: opts?.filters?.sortOrder,
      useCache: opts?.useCache === false ? 'false' : undefined,
      ttlSec: opts?.ttlSec
    });
    const res = await api.get<Envelope<AceDashboardResponse>>(`/dashboards/ace${qs}`);
    if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Falha ao carregar dashboard ACE');
    return res.data.data;
  },
  getFx: async (opts?: DashboardsQueryOptions): Promise<FxDashboardResponse> => {
    const qs = toQuery({
      startDate: opts?.filters?.startDate,
      endDate: opts?.filters?.endDate,
      granularity: opts?.filters?.granularity,
      totemIds: opts?.filters?.totemIds,
      fxEffectIds: opts?.filters?.fxEffectIds,
      search: opts?.filters?.search,
      sortBy: opts?.filters?.sortBy,
      sortOrder: opts?.filters?.sortOrder,
      useCache: opts?.useCache === false ? 'false' : undefined,
      ttlSec: opts?.ttlSec
    });
    const res = await api.get<Envelope<FxDashboardResponse>>(`/dashboards/fx${qs}`);
    if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Falha ao carregar dashboard FX');
    return res.data.data;
  },
  getGeneral: async (opts?: DashboardsQueryOptions): Promise<GeneralAnalyticsResponse> => {
    const qs = toQuery({
      startDate: opts?.filters?.startDate,
      endDate: opts?.filters?.endDate,
      granularity: opts?.filters?.granularity,
      totemIds: opts?.filters?.totemIds,
      mediaIds: opts?.filters?.mediaIds,
      campaignIds: opts?.filters?.campaignIds,
      search: opts?.filters?.search,
      sortBy: opts?.filters?.sortBy,
      sortOrder: opts?.filters?.sortOrder,
      useCache: opts?.useCache === false ? 'false' : undefined,
      ttlSec: opts?.ttlSec
    });
    const res = await api.get<Envelope<GeneralAnalyticsResponse>>(`/dashboards/general${qs}`);
    if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Falha ao carregar dashboard Geral');
    return res.data.data;
  },
  aggregate: async (body: DashboardAggregateRequest): Promise<AnyDashboardResponse> => {
    const res = await api.post<Envelope<AnyDashboardResponse>>('/dashboards/aggregate', body);
    if (!res.data.success || !res.data.data) throw new Error(res.data.error || 'Falha ao carregar aggregate');
    return res.data.data;
  }
};

export default dashboardsApi;
