/** Regras de data de início da campanha: nunca anterior à data de criação. */

export const CAMPAIGN_START_DATE_MIN_HELPER =
  'A data de início não pode ser anterior à data de criação da campanha.';

export function getTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toDateInputYmd(dateValue?: string | Date | null): string {
  if (!dateValue) return '';
  try {
    if (dateValue instanceof Date) {
      if (Number.isNaN(dateValue.getTime())) return '';
      const y = dateValue.getFullYear();
      const m = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    const s = typeof dateValue === 'string' ? dateValue.trim() : '';
    if (!s) return '';
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

export function getCampaignCreatedYmd(
  campaign?: { created_at?: string; createdAt?: string } | null
): string {
  const raw = campaign?.created_at ?? campaign?.createdAt;
  return toDateInputYmd(raw) || getTodayYmd();
}

export function getMinCampaignStartYmd(
  campaign?: { created_at?: string; createdAt?: string } | null
): string {
  return campaign ? getCampaignCreatedYmd(campaign) : getTodayYmd();
}

export function clampCampaignStartYmd(startYmd: string, minYmd: string): string {
  if (!startYmd) return minYmd;
  return startYmd < minYmd ? minYmd : startYmd;
}

export function resolveCampaignStartYmd(
  campaign?: {
    created_at?: string;
    createdAt?: string;
    start_date?: string;
    startDate?: string;
  } | null,
  explicitStart?: string | null
): string {
  const min = getMinCampaignStartYmd(campaign ?? undefined);
  const raw =
    explicitStart ??
    campaign?.start_date ??
    (campaign as { startDate?: string } | undefined)?.startDate;
  const ymd = toDateInputYmd(raw);
  if (!ymd) return min;
  return clampCampaignStartYmd(ymd, min);
}
