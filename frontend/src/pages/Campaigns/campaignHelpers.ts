import { Campaign } from '../../services/api';

export const compareByDisplayName = (a?: string, b?: string) =>
  String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base', numeric: true });

/** Nome do local onde o totem está alocado (API publisher/totems, /totems ou /players). */
export function getTotemAllocatedLocalName(t: any): string {
  const raw = t?.local_name ?? t?.localName ?? t?.local?.name ?? '';
  const s = String(raw || '').trim();
  if (s) return s;
  const loc = String(t?.location || '').trim();
  return loc;
}

/** Rótulo do combo de totens na campanha: Nome [identifier] (#id) (Local). */
export function campaignTotemOptionLabel(t: any): string {
  const name = String(t?.name || '').trim();
  const identifier = String(t?.identifier || '').trim();
  const uin = String(t?.uin || '').trim();
  const base = name || identifier || uin || 'Totem';
  const identPart = identifier && identifier !== name ? `[${identifier}]` : '';
  const id = Number(t?.totem_id ?? t?.id ?? 0);
  const idPart = id > 0 ? `(#${id})` : '';
  const local = getTotemAllocatedLocalName(t);
  const localPart = local ? `(${local})` : '';
  return [base, identPart, idPart, localPart].filter(Boolean).join(' ');
}

export function normalizeCampaignType(raw: any): string {
  const v = String(raw ?? '').trim().toLowerCase();
  if (['general', 'scheduled', 'interactive', 'recurring'].includes(v)) return v;
  if (['standard', 'promotional', 'informational'].includes(v)) return 'general';
  return 'general';
}

export function normalizeCampaign(campaign: any): Campaign {
  if (!campaign) return campaign as Campaign;
  const rawContract = campaign.contract_id ?? campaign.contractId;
  const cid =
    rawContract !== undefined &&
    rawContract !== null &&
    String(rawContract).trim() !== '' &&
    !Number.isNaN(Number(rawContract))
      ? Number(rawContract)
      : undefined;
  return {
    ...campaign,
    campaign_id: campaign.campaign_id ?? campaign.campaignId ?? campaign.id,
    subscriber_id: campaign.subscriber_id ?? campaign.subscriberId ?? campaign.clientId,
    contract_id: cid,
    contractId: cid,
    start_date: campaign.start_date ?? campaign.startDate,
    end_date: campaign.end_date ?? campaign.endDate,
    totemIds: (() => {
      const raw = campaign.totemIds ?? campaign.totem_ids ?? [];
      const arr = Array.isArray(raw) ? raw : [];
      return arr.map((x: any) => Number(x)).filter((n) => !Number.isNaN(n) && n > 0);
    })(),
    campaign_type: normalizeCampaignType(campaign.campaign_type ?? campaign.campaignType),
    status: campaign.status ?? 'draft',
    is_active:
      campaign.is_active !== undefined
        ? campaign.is_active
        : campaign.isActive !== undefined
          ? campaign.isActive
          : true,
    created_at: campaign.created_at ?? campaign.createdAt,
    updated_at: campaign.updated_at ?? campaign.updatedAt,
  } as Campaign;
}
