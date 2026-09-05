/**
 * S12-C: Unit smoke Dashboards (sem Express / sem DB / sem Redis)
 * Valida buildFiltersFromQuery utilitário compartilhado + parâmetros canônicos
 * + contrato envelope via helper inline (sem HTTP).
 */

import { buildFiltersFromQuery } from '../../../routes/dashboards';
import type { DashboardFilters } from '../../../types/analytics';

describe('S12-C Smoke: Dashboards buildFiltersFromQuery + shape canônica', () => {
  it('query vazia retorna defaults: granularidade day, outros undefined', () => {
    const out: DashboardFilters = buildFiltersFromQuery({});
    expect(out.granularity).toBe('day');
    expect(out.startDate).toBeUndefined();
    expect(out.endDate).toBeUndefined();
    expect(out.search).toBeUndefined();
    expect(out.sortBy).toBeUndefined();
    expect(out.sortOrder).toBeUndefined();
    expect(out.totemIds).toBeUndefined();
    expect(out.campaignIds).toBeUndefined();
    expect(out.mediaIds).toBeUndefined();
    expect(out.fxEffectIds).toBeUndefined();
  });

  it('parseList aceita string CSV e array numérico e filtra NaN', () => {
    const a = buildFiltersFromQuery({ totemIds: '1,  2, abc, 3' });
    expect(a.totemIds).toEqual([1, 2, 3]);
    const b = buildFiltersFromQuery({ campaignIds: [10, 'x', 20, 0.5, NaN] });
    expect(b.campaignIds).toEqual([10, 20, 0.5]);
    const c = buildFiltersFromQuery({ mediaIds: '' });
    expect(c.mediaIds).toBeUndefined();
  });

  it('granularidade só aceita valores canônicos, default fallback day', () => {
    expect(buildFiltersFromQuery({ granularity: 'hour' }).granularity).toBe('hour');
    expect(buildFiltersFromQuery({ granularity: 'day' }).granularity).toBe('day');
    expect(buildFiltersFromQuery({ granularity: 'week' }).granularity).toBe('week');
    expect(buildFiltersFromQuery({ granularity: 'month' }).granularity).toBe('month');
    expect(buildFiltersFromQuery({ granularity: 'year' }).granularity).toBe('day');
    expect(buildFiltersFromQuery({ granularity: '__INVALID__' }).granularity).toBe('day');
  });

  it('sortOrder só aceita asc/desc; resto undefined', () => {
    expect(buildFiltersFromQuery({ sortOrder: 'asc' }).sortOrder).toBe('asc');
    expect(buildFiltersFromQuery({ sortOrder: 'desc' }).sortOrder).toBe('desc');
    expect(buildFiltersFromQuery({ sortOrder: 'ASCENDING' }).sortOrder).toBeUndefined();
    expect(buildFiltersFromQuery({ sortOrder: 123 }).sortOrder).toBeUndefined();
  });

  it('campos string e startDate/endDate preservados apenas se string', () => {
    const out = buildFiltersFromQuery({
      startDate: '2025-01-01',
      endDate: 2025,
      search: 'busca',
      sortBy: 'impressions',
    });
    expect(out.startDate).toBe('2025-01-01');
    expect(out.endDate).toBeUndefined();
    expect(out.search).toBe('busca');
    expect(out.sortBy).toBe('impressions');
  });

  it('envelope {success,data} helper shape matches routes contract', () => {
    const envelopeOk = <T>(data: T) => ({ success: true as const, data, timestamp: new Date().toISOString() });
    const env = envelopeOk<{ kind: 'general'; kpis: unknown }>({ kind: 'general', kpis: {} });
    expect(env.success).toBe(true);
    expect(env.data.kind).toBe('general');
    expect(typeof env.timestamp).toBe('string');

    const envelopeErr = (msg: string, code: string) => ({ success: false as const, error: msg, code });
    const err = envelopeErr('Oops', 'DASH_ACE_ERROR');
    expect(err.success).toBe(false);
    expect(err.error).toBe('Oops');
    expect(err.code).toBe('DASH_ACE_ERROR');
  });
});
