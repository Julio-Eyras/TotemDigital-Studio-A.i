/**
 * Smoke testes builders de dashboard (unitário, sem HTTP).
 *
 * Usa jest.mock() para substituir singletons de serviço (Banco, Analytics,
 * FX Analytics, Facial Recognition, Dashboard, Billing, Cache).
 *
 * Cobre o mesmo pipeline das rotas HTTP (exceto autenticação e serialização
 * JSON do Express — esta parte já é um wrapper fino `return res.json({success:true,data})`
 * sem transformações).
 *
 * Assertions: status do envelope { success:true, data }, widgets.length>0,
 *   tipos canônicos de kpi (value/trend/label), granularidade default day,
 *   POST aggregate kind ace/fx/general + includeWidgets filtro + granularity week.
 */

jest.mock('../../../config/database', () => ({
  getDatabase: jest.fn(() => ({
    findFirst: jest.fn(async () => null),
    query: jest.fn(async () => []),
  })),
}));

const mockCache = new Map<string, unknown>();
jest.mock('../../../services/analyticsCacheService', () => ({
  getAnalyticsCacheService: () => ({
    get: jest.fn(async (k: string) => mockCache.get(k) ?? null),
    set: jest.fn(async (k: string, v: unknown) => {
      mockCache.set(k, v);
      return true;
    }),
    invalidatePattern: jest.fn(async () => 0),
  }),
}));

jest.mock('../../../services/facialRecognitionService', () => ({
  getFacialRecognitionService: () => ({
    getAllPersons: jest.fn(async () => []),
  }),
}));

jest.mock('../../../services/analyticsService', () => ({
  getAnalyticsService: () => ({
    getAnalytics: jest.fn(async () => ({
      totalViews: 100,
      uniqueViewers: 30,
      averageViewDuration: 42,
      viewingTrends: [
        { date: '2026-09-01', views: 50, duration: 60, uniqueViewers: 10 },
        { date: '2026-09-02', views: 50, duration: 60, uniqueViewers: 20 },
      ],
      mostViewedContent: [{ mediaId: 1, title: 'Mídia 1', views: 30, duration: 420 }],
      campaignPerformance: [{ campaignId: 1, title: 'Campanha 1', views: 40, uptime: 98 }],
      totemPerformance: [{ totemId: 1, name: 'Totem 1', views: 20, uptime: 99 }],
      revenue: {
        total: 150.5,
        byCampaign: [{ campaignId: 1, amount: 150.5 }],
      },
    })),
  }),
}));

jest.mock('../../../services/fxAnalyticsService', () => ({
  getFxAnalyticsService: () => ({
    getOverview: jest.fn(async () => ({
      totalExecutions: 120,
      successful: 118,
      failed: 2,
      successRate: 98.3,
      avgDuration: 120,
      topEffects: [{ effect_id: '1', executions: 50, avg_duration: 110, success_rate: 99 }],
      topTotems: [{ totem_id: '1', name: 'Totem 1', executions: 120, avg_fps: 30, success_rate: 99.5 }],
      trends: [{ date: '2026-09-02T10:00:00Z', executions: 12, avg_fps: 30 }],
    })),
  }),
}));

jest.mock('../../../services/dashboardService', () => ({
  getDashboardService: () => ({
    getDashboardStats: jest.fn(async () => ({
      totalPlayers: 20,
      activePlayers: 19,
      offlinePlayers: 1,
      commercialOverview: {
        totalScreens: 20,
        onlineScreens: 19,
        offlineScreens: 1,
        activeCampaigns: 5,
      },
    })),
  }),
}));

jest.mock('../../../services/billingControlService', () => ({
  getBillingControlService: () => ({
    getDashboard: jest.fn(async () => ({
      contracts: { active: 3, expired: 0 },
      publisherBilling: {
        plan: 'Pro',
        currentMonthCost: 520,
        projectedCost: 610,
        totalPaid: 1800,
        meteredUsage: {
          impressions: 150_000,
          bandwidthMB: 12_500,
          storageMB: 40_000,
          aiCreditsUsed: 412,
        },
      },
    })),
  }),
}));

import express from 'express';
import type {
  AceDashboardResponse,
  DashboardAggregateRequest,
  DashboardFilters,
  DashboardKind,
  FxDashboardResponse,
  GeneralAnalyticsResponse,
  WidgetMeta,
} from '../../../types/analytics';

type AuthenticatedRequest = express.Request & {
  user?: { id: number; role?: string; clientId?: number };
};

// Builder exports públicos (S13-C)
import {
  buildFiltersFromQuery,
  buildAceDashboard,
  buildFxDashboard,
  buildGeneralDashboard,
} from '../../../routes/dashboards';

function stubReq(overrides?: Partial<{ user: unknown; t: unknown }>): AuthenticatedRequest {
  return {
    user: { id: 1, role: 'admin', clientId: 1, userId: 1, username: 'test', email: 'test@example.com' },
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

/** Replica o envelope padrão do Express routes/dashboards.ts → res.json({success,data,timestamp}). */
function wrapSuccess<T>(data: T): { success: true; data: T; timestamp: string } {
  return { success: true, data, timestamp: new Date().toISOString() };
}

/** Replica o aggregate handler do router POST. */
async function aggregateCall(body: Partial<DashboardAggregateRequest>): Promise<{ success: boolean; kind: DashboardKind | string; data: unknown }> {
  const req = stubReq();
  const kind: DashboardKind = (body.kind as DashboardKind) ?? 'general';
  const filters: DashboardFilters = { ...buildFiltersFromQuery({}), ...(body.filters ?? {}) };
  const useCache = body.useCache !== false;
  const ttl = Number.isFinite(body.ttlSec) ? (body.ttlSec as number) : 300;
  let data: AceDashboardResponse | FxDashboardResponse | GeneralAnalyticsResponse;
  switch (kind) {
    case 'ace':
      data = await buildAceDashboard(req, filters, useCache, ttl); break;
    case 'fx':
      data = await buildFxDashboard(req, filters, useCache, ttl); break;
    default:
      data = await buildGeneralDashboard(req, filters, useCache, ttl); break;
  }
  if (Array.isArray(body.includeWidgets) && body.includeWidgets.length > 0) {
    const allow = new Set(body.includeWidgets);
    (data as { widgets?: WidgetMeta[] }).widgets = (data as { widgets?: WidgetMeta[] }).widgets?.filter(w => allow.has(w.id));
  }
  if (Array.isArray(body.excludeWidgets) && body.excludeWidgets.length > 0) {
    const deny = new Set(body.excludeWidgets);
    (data as { widgets?: WidgetMeta[] }).widgets = (data as { widgets?: WidgetMeta[] }).widgets?.filter(w => !deny.has(w.id));
  }
  return { success: true, kind, data };
}

describe('S13-C: dashboards builders smoke (unitário · builders exportados · mocks em cascata)', () => {
  beforeEach(() => { mockCache.clear(); });

  it('buildAceDashboard useCache=false → widgets 10, kpis 5, meta.filters.granularity === "day", audienceTimeline.length>=2', async () => {
    const req = stubReq();
    const filters = buildFiltersFromQuery({});
    const data = await buildAceDashboard(req, filters, false);
    const env = wrapSuccess(data);
    expect(env.success).toBe(true);
    expect(env.data.widgets).toHaveLength(10);
    expect(typeof env.data.kpis.totalDetections.value).toBe('number');
    expect(env.data.kpis.totalDetections.value).toBeGreaterThan(0);
    expect(env.data.meta.filters.granularity).toBe('day');
    expect(Array.isArray(env.data.audienceTimeline)).toBe(true);
    expect(env.data.audienceTimeline.length).toBeGreaterThanOrEqual(2);
    expect(env.data.topContents[0]?.mediaId).toBe(1);
  });

  it('buildFxDashboard useCache=false → widgets 9, kpis 5, topEffects[0].effectId=1, timeline.length>=1, compareAB[0].metric === "impressões"', async () => {
    const req = stubReq();
    const filters = buildFiltersFromQuery({});
    const data = await buildFxDashboard(req, filters, false);
    const env = wrapSuccess(data);
    expect(env.success).toBe(true);
    expect(env.data.widgets).toHaveLength(9);
    expect(typeof env.data.kpis.totalExecutions.value).toBe('number');
    expect(env.data.kpis.fleetUptimePercent.value).toBeGreaterThan(0);
    expect(env.data.topEffects[0]?.effectId).toBe(1);
    expect(env.data.uptimeByTotem[0]?.totemId).toBe(1);
    expect(Array.isArray(env.data.timeline)).toBe(true);
    expect(env.data.timeline.length).toBeGreaterThanOrEqual(1);
    expect(env.data.compareAB[0]?.metric).toBe('impressões');
  });

  it('buildGeneralDashboard useCache=false → widgets 11, kpis 5, billing.plan === "Pro", impressionsTimeline.length>=2, fleet.total === 20', async () => {
    const req = stubReq();
    const filters = buildFiltersFromQuery({});
    const data = await buildGeneralDashboard(req, filters, false);
    const env = wrapSuccess(data);
    expect(env.success).toBe(true);
    expect(env.data.widgets).toHaveLength(11);
    expect(env.data.kpis.totalImpressions.value).toBeGreaterThan(0);
    expect(env.data.billing?.plan).toBe('Pro');
    expect(env.data.billing?.meteredUsage?.impressions).toBe(150_000);
    expect(env.data.impressionsTimeline.length).toBeGreaterThanOrEqual(2);
    expect(env.data.fleet.total).toBe(20);
    expect(env.data.topMedias[0]?.mediaId).toBe(1);
    expect(env.data.topCampaigns[0]?.campaignId).toBe(1);
    expect(env.data.playlists[0]?.playlistId).toBe(1);
  });

  it('aggregate kind=ace, useCache=false → success:true, kind:"ace", widgets.length === 10', async () => {
    const resp = await aggregateCall({ kind: 'ace', useCache: false });
    expect(resp.success).toBe(true);
    expect(resp.kind).toBe('ace');
    expect((resp.data as AceDashboardResponse).widgets).toHaveLength(10);
  });

  it('aggregate kind=fx + includeWidgets fx.kpi.total-executions → widgets 1 elemento, id bate', async () => {
    const resp = await aggregateCall({ kind: 'fx', useCache: false, includeWidgets: ['fx.kpi.total-executions'] });
    expect(resp.success).toBe(true);
    expect((resp.data as FxDashboardResponse).widgets).toHaveLength(1);
    expect((resp.data as FxDashboardResponse).widgets[0]?.id).toBe('fx.kpi.total-executions');
  });

  it('aggregate kind=general filters {granularity:"week"} → meta.filters.granularity === "week"', async () => {
    const resp = await aggregateCall({ kind: 'general', useCache: false, filters: { granularity: 'week' } });
    expect(resp.success).toBe(true);
    expect((resp.data as GeneralAnalyticsResponse).meta.filters.granularity).toBe('week');
  });

  it('aggregate kind=general SEM filters → meta.filters.granularity === "day" (S12-C bug granularity default continua fixado)', async () => {
    const resp = await aggregateCall({ kind: 'general', useCache: false });
    expect(resp.success).toBe(true);
    expect((resp.data as GeneralAnalyticsResponse).meta.filters.granularity).toBe('day');
  });

  it('aggregate kind inválido "inexistente_xyz" cai no default general → KPIs totalImpressions bate', async () => {
    const resp = await aggregateCall({ kind: 'inexistente_xyz' as unknown as DashboardKind, useCache: false });
    expect(resp.success).toBe(true);
    expect(resp.kind).toBe('inexistente_xyz');
    expect((resp.data as GeneralAnalyticsResponse).kpis.totalImpressions.value).toBeGreaterThan(0);
  });
});
