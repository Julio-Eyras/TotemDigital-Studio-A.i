/**
 * Helper functions para normalização e determinação de subscriberId
 * Centraliza lógica duplicada de subscriberId
 */

import { getDatabase } from '../config/database';
import { logError, logDebug } from './loggerHelper';

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
      }
    } catch (error: any) {
      await logError('Erro ao buscar primeiro subscriber ativo', error);
    }
  }

  return undefined;
}

/**
 * Normaliza dados de campanha (snake_case → camelCase)
 */
export function normalizeCampaignData(data: any): {
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
  return {
    subscriberId: data.subscriberId || data.subscriber_id || data.clientId,
    contractId: data.contractId || data.contract_id,
    title: data.title,
    categorySegment: data.categorySegment || data.category_segment,
    description: data.description,
    campaignType: data.campaignType || data.campaign_type || 'general',
    priority: data.priority,
    commercialTier: data.commercialTier || data.commercial_tier,
    startDate: data.startDate || data.start_date,
    endDate: data.endDate || data.end_date,
    startTime: data.startTime || data.start_time,
    endTime: data.endTime || data.end_time,
    daysOfWeek: data.daysOfWeek || data.days_of_week,
    timezone: data.timezone,
    status: data.status || 'draft',
    isActive: data.isActive !== undefined ? data.isActive : (data.is_active !== undefined ? data.is_active : true),
    publisherIds: data.publisherIds !== undefined ? data.publisherIds : undefined,
    totemIds: data.totemIds !== undefined ? data.totemIds : undefined,
    // Manter undefined quando não enviados, para não sobrescrever associações no update
    playlistIds: data.playlistIds !== undefined ? data.playlistIds : undefined,
    mediaIds: data.mediaIds !== undefined ? data.mediaIds : undefined,
  };
}
