/**
 * Helper functions para normalização e determinação de subscriberId
 * Centraliza lógica duplicada de subscriberId
 */

import { getDatabase } from '../config/database';
import { logError, logDebug } from './loggerHelper';
import { normalizeError } from './errors';

/**
 * Determina subscriberId a partir do request
 * Usado para normalizar lógica repetida em múltiplas rotas
 */
export async function determineSubscriberId(options: {
  bodySubscriberId?: number | string;
  userSubscriberId?: number;
  userClientId?: number;
  requestSubscriberId?: number;
  isAdmin: boolean;
  fallbackToFirstActive?: boolean;
}): Promise<number | undefined> {
  const {
    bodySubscriberId,
    userSubscriberId,
    userClientId,
    requestSubscriberId,
    isAdmin,
    fallbackToFirstActive = false
  } = options;

  // 1. Se fornecido explicitamente no body, usar
  if (bodySubscriberId) {
    const parsed = typeof bodySubscriberId === 'string' ? parseInt(bodySubscriberId) : bodySubscriberId;
    if (parsed && parsed > 0) {
      return parsed;
    }
  }

  // 2. Se não é admin, usar subscriberId do usuário
  if (!isAdmin) {
    const finalId = requestSubscriberId || userSubscriberId || userClientId;
    if (finalId && finalId > 0) {
      return finalId;
    }
    return undefined; // Não-admin sem subscriberId - retornar undefined para erro
  }

  // 3. Admin pode usar subscriberId do request ou buscar primeiro ativo
  if (requestSubscriberId || userSubscriberId || userClientId) {
    const finalId = requestSubscriberId || userSubscriberId || userClientId;
    if (finalId && finalId > 0) {
      return finalId;
    }
  }

  // 4. Se admin e fallback permitido, buscar primeiro subscriber ativo
  if (isAdmin && fallbackToFirstActive) {
    try {
      const db = getDatabase();
      const firstSubscriber = await db.findFirst(`
        SELECT subscriber_id FROM subscribers WHERE is_active = true LIMIT 1
      `);
      if (firstSubscriber?.subscriber_id) {
        await logDebug('[SubscriberHelper] Admin usando primeiro subscriber ativo', {
          subscriberId: firstSubscriber.subscriber_id
        });
        return firstSubscriber.subscriber_id;
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar primeiro subscriber ativo', e.error);
    }
  }

  return undefined;
}

/**
 * Normaliza dados de campanha (snake_case → camelCase)
 */
export function normalizeCampaignData<T extends Record<string, unknown>>(data: T): {
  subscriberId?: number;
  contractId?: number;
  title?: string;
  categorySegment?: string;
  description?: string;
  campaignType?: string;
  priority?: number;
  commercialTier?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: string[];
  timezone?: string;
  status?: string;
  isActive?: boolean;
  publisherIds?: number[];
  totemIds?: number[];
  playlistIds?: number[];
  mediaIds?: number[];
} {
  const d = data as Record<string, unknown>;
  return {
    subscriberId: (d.subscriberId as number | undefined) || (d.subscriber_id as number | undefined) || (d.clientId as number | undefined),
    contractId: (d.contractId as number | undefined) || (d.contract_id as number | undefined),
    title: d.title as string | undefined,
    categorySegment: (d.categorySegment as string | undefined) || (d.category_segment as string | undefined),
    description: d.description as string | undefined,
    campaignType: (d.campaignType as string | undefined) || (d.campaign_type as string | undefined) || 'general',
    priority: d.priority as number | undefined,
    commercialTier: (d.commercialTier as string | undefined) || (d.commercial_tier as string | undefined),
    startDate: (d.startDate as string | undefined) || (d.start_date as string | undefined),
    endDate: (d.endDate as string | undefined) || (d.end_date as string | undefined),
    startTime: (d.startTime as string | undefined) || (d.start_time as string | undefined),
    endTime: (d.endTime as string | undefined) || (d.end_time as string | undefined),
    daysOfWeek: (d.daysOfWeek as string[] | undefined) || (d.days_of_week as string[] | undefined),
    timezone: d.timezone as string | undefined,
    status: (d.status as string | undefined) || 'draft',
    isActive: d.isActive !== undefined ? (d.isActive as boolean) : (d.is_active !== undefined ? (d.is_active as boolean) : true),
    publisherIds: d.publisherIds !== undefined ? (d.publisherIds as number[]) : undefined,
    totemIds: (() => {
      const raw = d.totemIds !== undefined ? d.totemIds : d.totem_ids;
      if (raw === undefined) return undefined;
      if (!Array.isArray(raw)) return undefined;
      return raw
        .map((x: unknown) => Number(x))
        .filter((n: number) => Number.isInteger(n) && n > 0);
    })(),
    playlistIds: d.playlistIds !== undefined ? (d.playlistIds as number[]) : undefined,
    mediaIds: d.mediaIds !== undefined ? (d.mediaIds as number[]) : undefined,
  };
}
