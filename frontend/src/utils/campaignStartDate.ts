/** Regras de data de início da campanha — calendário America/Sao_Paulo. */

import { dateToYmd, todayYmd } from './businessDate';

export const CAMPAIGN_BUSINESS_TZ = 'America/Sao_Paulo';

export const CAMPAIGN_START_DATE_MIN_HELPER =
  'A data de início não pode ser anterior à data de criação da campanha (fuso Brasil).';

export function toDateOnlyYmd(dateValue?: string | Date | null): string {
  return dateToYmd(dateValue);
}

/** @deprecated use toDateOnlyYmd ou dateToYmd */
export function toDateInputYmd(dateValue?: string | Date | null): string {
  return toDateOnlyYmd(dateValue);
}

export function getTodayYmd(): string {
  return todayYmd();
}

export function getCampaignCreatedYmd(
  campaign?: { created_at?: string; createdAt?: string } | null
): string {
  const raw = campaign?.created_at ?? campaign?.createdAt;
  return toDateOnlyYmd(raw) || getTodayYmd();
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

/** Valor gravado / digitado para exibição (sem clamp). */
export function getCampaignStartYmdForDisplay(
  campaign?: { start_date?: string; startDate?: string } | null,
  explicitStart?: string | null
): string {
  const raw =
    explicitStart ??
    campaign?.start_date ??
    (campaign as { startDate?: string } | undefined)?.startDate;
  return toDateOnlyYmd(raw);
}

/** Data de fim para exibição (sem clamp). */
export function getCampaignEndYmdForDisplay(
  campaign?: { end_date?: string; endDate?: string } | null,
  explicitEnd?: string | null
): string {
  const raw =
    explicitEnd ??
    campaign?.end_date ??
    (campaign as { endDate?: string } | undefined)?.endDate;
  return toDateOnlyYmd(raw);
}

/** Normaliza antes de gravar (respeita mínimo = data de criação no fuso Brasil). */
export function resolveCampaignStartYmdForSave(
  campaign?: {
    created_at?: string;
    createdAt?: string;
    start_date?: string;
    startDate?: string;
  } | null,
  explicitStart?: string | null
): string {
  const min = getMinCampaignStartYmd(campaign ?? undefined);
  const ymd = getCampaignStartYmdForDisplay(campaign, explicitStart) || min;
  return clampCampaignStartYmd(ymd, min);
}

/** Alias legado — usar resolveCampaignStartYmdForSave ao persistir. */
export function resolveCampaignStartYmd(
  campaign?: {
    created_at?: string;
    createdAt?: string;
    start_date?: string;
    startDate?: string;
  } | null,
  explicitStart?: string | null
): string {
  return resolveCampaignStartYmdForSave(campaign, explicitStart);
}

export function isCampaignStartBeforeCreated(
  startYmd: string,
  campaign?: { created_at?: string; createdAt?: string } | null
): boolean {
  if (!startYmd) return false;
  const min = getMinCampaignStartYmd(campaign ?? undefined);
  return startYmd < min;
}
