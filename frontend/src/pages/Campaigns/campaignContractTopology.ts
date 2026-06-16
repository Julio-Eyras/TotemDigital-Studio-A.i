import type { Contract } from '../../services/api';
import type { PlanTopologyPreviewRow } from '../Subscribers/planTopologyPreview';

type ContractTopologySource = Pick<
  Contract,
  'contract_id' | 'contract_number' | 'title' | 'plan_id'
> & {
  plan_name?: string | null;
};

/**
 * Monta linha de topologia a partir dos totens elegíveis do contrato
 * (mesma regra que GET /subscribers/:id/totems?contractId=).
 */
export function buildContractEligibleTopologyRow(
  contract: ContractTopologySource,
  totems: any[]
): PlanTopologyPreviewRow {
  type PubBucket = {
    publisher_id: number;
    publisher_name: string;
    locals: Map<number, { local_id: number; name: string; address?: string; city?: string; state?: string }>;
    totems: any[];
    smartTvs: any[];
  };

  const pubMap = new Map<string, PubBucket>();

  for (const totem of totems) {
    const publisherName = String(totem.publisher_name || totem.publisherName || '').trim() || 'Organização';
    const bucketKey = publisherName.toLowerCase();
    if (!pubMap.has(bucketKey)) {
      pubMap.set(bucketKey, {
        publisher_id: Number(totem.publisher_id ?? totem.publisherId ?? 0) || 0,
        publisher_name: publisherName,
        locals: new Map(),
        totems: [],
        smartTvs: [],
      });
    }
    const bucket = pubMap.get(bucketKey)!;
    bucket.totems.push(totem);

    const localId = Number(totem.local_id ?? totem.localId);
    if (Number.isFinite(localId) && localId > 0 && !bucket.locals.has(localId)) {
      bucket.locals.set(localId, {
        local_id: localId,
        name: String(totem.local_name ?? totem.localName ?? `Local #${localId}`).trim() || `Local #${localId}`,
        address: totem.local_address ?? totem.address,
        city: totem.local_city ?? totem.city,
        state: totem.local_state ?? totem.state,
      });
    }
  }

  const planId =
    contract.plan_id !== undefined && contract.plan_id !== null ? Number(contract.plan_id) : null;

  return {
    rowKey: `contract-${contract.contract_id}`,
    title: contract.contract_number || contract.title || `Contrato #${contract.contract_id}`,
    contractNumber: contract.contract_number,
    planId: planId && !Number.isNaN(planId) ? planId : null,
    planName: contract.plan_name?.trim() || (planId ? `Plano #${planId}` : null),
    publishers: Array.from(pubMap.values()).map((pub) => ({
      publisher_id: pub.publisher_id,
      publisher_name: pub.publisher_name,
      locals: Array.from(pub.locals.values()),
      totems: pub.totems,
      smartTvs: pub.smartTvs,
    })),
  };
}
