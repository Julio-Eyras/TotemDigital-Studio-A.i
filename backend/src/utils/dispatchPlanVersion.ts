import { createHash } from 'crypto';

export type PlanVersionItem = {
  mediaId: number | string;
  order: number;
  contentVersion?: string | null;
};

/**
 * Versão estável do plano (conteúdo). Alinhada à assinatura do Player-AD
 * (`mediaId:order:contentVersion`), depois SHA-1 curto para o heartbeat.
 */
export function buildDispatchPlanVersion(
  items: PlanVersionItem[],
  meta?: { playlistId?: number | string | null; source?: string | null; mixVersion?: string | number | null }
): string {
  const body = (items || [])
    .map((i) => `${i.mediaId}:${Number(i.order) || 0}:${String(i.contentVersion || '')}`)
    .join('|');
  const head = `${meta?.source || ''}:${meta?.playlistId ?? ''}:${meta?.mixVersion ?? ''}`;
  return createHash('sha1').update(`${head}#${body}`).digest('hex').slice(0, 20);
}

export function buildDispatchPlanVersionFromPlan(plan: {
  mediaItems?: Array<{
    mediaId: number | string;
    order?: number;
    metadata?: { contentVersion?: string | null } | null;
    contentVersion?: string | null;
  }>;
  playlistId?: number | string | null;
  source?: string | null;
  metadata?: { mixVersion?: string | number | null } | null;
}): string {
  const items = (plan.mediaItems || []).map((i) => ({
    mediaId: i.mediaId,
    order: Number(i.order) || 0,
    contentVersion: i.metadata?.contentVersion ?? i.contentVersion ?? '',
  }));
  return buildDispatchPlanVersion(items, {
    playlistId: plan.playlistId,
    source: plan.source,
    mixVersion: plan.metadata?.mixVersion,
  });
}

export function planVersionCacheKey(totemId: number): string {
  return `dispatcher:totem:${totemId}:planVersion`;
}
