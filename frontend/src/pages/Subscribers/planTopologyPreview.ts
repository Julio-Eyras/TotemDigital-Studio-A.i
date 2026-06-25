/**
 * Pré-visualização da rede do plano (publicadores → locais/totens/TVs), só leitura.
 */

import { planApi } from '../../services/api';

export interface PlanTopologyPreviewRow {
  rowKey: string;
  title: string;
  contractNumber?: string;
  planId: number | null;
  planName: string | null;
  publishers: Array<{
    publisher_id: number;
    publisher_name: string;
    locals: any[];
    totems: any[];
    smartTvs: any[];
  }>;
}

type PlanTopologyData = Pick<PlanTopologyPreviewRow, 'planId' | 'planName' | 'publishers'>;

const planTopologyCache = new Map<number, Promise<PlanTopologyData>>();

/** Limpa cache (útil após alterar locais/totens do plano no admin). */
export function clearPlanTopologyPreviewCache(planId?: number): void {
  if (planId != null) {
    planTopologyCache.delete(planId);
    return;
  }
  planTopologyCache.clear();
}

async function loadPlanTopologyData(planId: number): Promise<PlanTopologyData> {
  const topology = await planApi.getNetworkTopology(planId);
  return {
    planId: topology.planId,
    planName: topology.planName ?? null,
    publishers: topology.publishers ?? [],
  };
}

function getCachedPlanTopology(planId: number): Promise<PlanTopologyData> {
  const cached = planTopologyCache.get(planId);
  if (cached) return cached;

  const promise = loadPlanTopologyData(planId).catch((err) => {
    planTopologyCache.delete(planId);
    throw err;
  });
  planTopologyCache.set(planId, promise);
  return promise;
}

export async function loadPlanTopologyPreviewRows(
  items: Array<{
    plan_id?: number | null;
    title?: string;
    contract_number?: string;
    tempId?: string;
    contract_id?: number;
  }>
): Promise<PlanTopologyPreviewRow[]> {
  const uniquePlanIds = [
    ...new Set(
      items
        .map((c) => (c.plan_id != null ? Number(c.plan_id) : NaN))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];

  const planDataById = new Map<number, PlanTopologyData>();
  await Promise.all(
    uniquePlanIds.map(async (planId) => {
      planDataById.set(planId, await getCachedPlanTopology(planId));
    })
  );

  return items.map((c) => {
    const title = c.title || c.contract_number || 'Contrato';
    const rowKey =
      c.tempId ??
      (c.contract_id != null ? `contract-${c.contract_id}` : `${title}-${String(c.contract_number ?? '')}`);

    if (!c.plan_id) {
      return {
        rowKey,
        title,
        contractNumber: c.contract_number,
        planId: null,
        planName: null,
        publishers: [],
      };
    }

    const planId = Number(c.plan_id);
    const data = planDataById.get(planId);
    if (!data) {
      return {
        rowKey,
        title,
        contractNumber: c.contract_number,
        planId,
        planName: `Plano #${planId}`,
        publishers: [],
      };
    }

    return {
      rowKey,
      title,
      contractNumber: c.contract_number,
      planId: data.planId,
      planName: data.planName,
      publishers: data.publishers,
    };
  });
}

export function countTopologyInRows(rows: PlanTopologyPreviewRow[]): { lc: number; tt: number; st: number } {
  let lc = 0;
  let tt = 0;
  let st = 0;
  for (const r of rows) {
    for (const p of r.publishers) {
      lc += p.locals?.length ?? 0;
      tt += p.totems?.length ?? 0;
      st += p.smartTvs?.length ?? 0;
    }
  }
  return { lc, tt, st };
}
