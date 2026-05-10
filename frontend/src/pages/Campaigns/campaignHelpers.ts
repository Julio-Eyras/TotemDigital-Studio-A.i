import { Campaign } from '../../services/api';
import { normalizeCampaignRecord, normalizeCampaignType } from '../../utils/campaignNormalize';

export { normalizeCampaignType };

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

export function normalizeCampaign(campaign: any): Campaign {
  return normalizeCampaignRecord(campaign) as Campaign;
}
