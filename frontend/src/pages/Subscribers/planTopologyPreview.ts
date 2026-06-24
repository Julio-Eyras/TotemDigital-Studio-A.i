/**
 * Pré-visualização da rede do plano (publicadores → locais/totens/TVs), só leitura.
 */

import { Local, planApi, publisherApi, subscriberAccessApi } from '../../services/api';

export interface PlanTopologyPreviewRow {
  rowKey: string;
  title: string;
  contractNumber?: string;
  planId: number | null;
  planName: string | null;
  publishers: Array<{
    publisher_id: number;
    publisher_name: string;
    locals: Local[];
    totems: any[];
    smartTvs: any[];
  }>;
}

type PlanTopologyData = Pick<PlanTopologyPreviewRow, 'planId' | 'planName' | 'publishers'>;

const planTopologyCache = new Map<number, Promise<PlanTopologyData>>();

/** Limpa cache (útil após alterar plan_publisher_access no admin). */
export function clearPlanTopologyPreviewCache(planId?: number): void {
  if (planId != null) {
    planTopologyCache.delete(planId);
    return;
  }
  planTopologyCache.clear();
}

async function loadPlanTopologyData(planId: number): Promise<PlanTopologyData> {
  let planName: string | null = null;
  try {
    const plan = await planApi.getById(planId);
    planName = plan?.name ?? null;
  } catch {
    planName = null;
  }

  const accessList = await subscriberAccessApi.getPlanPublisherAccess({ planId });
  const allowed = (accessList || []).filter((a: any) => a.is_allowed !== false);
  const publishers = await Promise.all(
    allowed.map(async (a: any) => {
      const pid = a.publisher_id;
      const [locals, totems, smartTvs] = await Promise.all([
        publisherApi.getLocals(pid),
        publisherApi.getTotems(pid),
        publisherApi.getSmartTvs(pid),
      ]);
      return {
        publisher_id: pid,
        publisher_name: a.publisher_name || `Publisher ${pid}`,
        locals: Array.isArray(locals) ? locals : [],
        totems: Array.isArray(totems) ? totems : [],
        smartTvs: Array.isArray(smartTvs) ? smartTvs : [],
      };
    })
  );

  return {
    planId,
    planName: planName || `Plano #${planId}`,
    publishers,
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
