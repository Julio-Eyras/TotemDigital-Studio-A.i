/**
 * Normalização de objeto campanha vindo da API (snake/camel) — sem depender de `services/api`
 * (evita import circular quando usado em `api/index.ts`).
 */
export function normalizeCampaignType(raw: unknown): string {
  const v = String(raw ?? '').trim().toLowerCase();
  if (['general', 'scheduled', 'interactive', 'recurring'].includes(v)) return v;
  if (['standard', 'promotional', 'informational'].includes(v)) return 'general';
  return 'general';
}

/** Mesma regra de `pages/Campaigns/campaignHelpers.normalizeCampaign`, retorno genérico. */
export function normalizeCampaignRecord(campaign: any): any {
  if (!campaign) return campaign;
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
  };
}
