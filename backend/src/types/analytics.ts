import type { CommonFilters } from './shared';

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

export interface CompareSeries {
  name: string;
  value: number;
  previous?: number;
  color?: string;
}

export interface DashboardFilters extends CommonFilters {
  totemIds?: number[];
  campaignIds?: number[];
  mediaIds?: number[];
  fxEffectIds?: number[];
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface AceDemographicBucket {
  ageRange: string;
  gender: 'male' | 'female' | 'unknown' | 'other';
  detections: number;
  engagements: number;
  avgDurationSec?: number;
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

export interface AceRecallMetrics {
  totalDetections: number;
  uniqueFaces: number;
  engagedFaces: number;
  recallRate: number;
  avgEngagementDurationSec?: number;
  bounceRate?: number;
}

export interface AceDashboardResponse {
  meta: {
    generatedAt: string;
    filters: DashboardFilters;
    period: { start: string; end: string };
  };
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
  meta: {
    generatedAt: string;
    filters: DashboardFilters;
    period: { start: string; end: string };
  };
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
  meta: {
    generatedAt: string;
    filters: DashboardFilters;
    period: { start: string; end: string };
  };
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

export type DashboardKind = 'ace' | 'fx' | 'general';

export interface DashboardAggregateRequest {
  kind: DashboardKind;
  filters?: DashboardFilters;
  includeWidgets?: string[];
  excludeWidgets?: string[];
  useCache?: boolean;
  ttlSec?: number;
}
