/** Rótulos PT para tipos de contrato (valores da API inalterados). */

export type PublisherContractType = 'revenue_share' | 'subscription' | 'partnership' | 'hybrid';

export type SubscriberContractType =
  | 'advertising'
  | 'subscription'
  | 'partnership'
  | 'revenue_share'
  | 'hybrid';

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  advertising: 'Publicidade',
  subscription: 'Assinatura',
  partnership: 'Parceria',
  revenue_share: 'Participação na receita',
  hybrid: 'Híbrido',
};

/** Opções do select — contratos da organização (publisher_contracts). */
export const PUBLISHER_CONTRACT_TYPE_OPTIONS: ReadonlyArray<{
  value: PublisherContractType;
  label: string;
}> = [
  { value: 'revenue_share', label: CONTRACT_TYPE_LABELS.revenue_share },
  { value: 'subscription', label: CONTRACT_TYPE_LABELS.subscription },
  { value: 'partnership', label: CONTRACT_TYPE_LABELS.partnership },
  { value: 'hybrid', label: CONTRACT_TYPE_LABELS.hybrid },
];

/** Opções do select — contratos do anunciante (subscriber_contracts). */
export const SUBSCRIBER_CONTRACT_TYPE_OPTIONS: ReadonlyArray<{
  value: SubscriberContractType;
  label: string;
}> = [
  { value: 'advertising', label: CONTRACT_TYPE_LABELS.advertising },
  { value: 'subscription', label: CONTRACT_TYPE_LABELS.subscription },
  { value: 'partnership', label: CONTRACT_TYPE_LABELS.partnership },
  { value: 'revenue_share', label: CONTRACT_TYPE_LABELS.revenue_share },
  { value: 'hybrid', label: CONTRACT_TYPE_LABELS.hybrid },
];

export function getContractTypeLabel(type: string | undefined | null): string {
  if (!type) return '—';
  return CONTRACT_TYPE_LABELS[type] ?? type;
}

export const REVENUE_SHARE_PERCENT_LABEL = 'Percentual de participação na receita (%)';

export function formatRevenueSharePercent(value: number | string | undefined | null): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '';
  return `Participação na receita: ${n}%`;
}
