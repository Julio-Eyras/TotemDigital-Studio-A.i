import { transaction } from '../config/database-pg';
import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { getCacheService } from './cacheService';
import { getSubscriberService } from './subscriberService';
import { getPlaylistEngineServiceInstance } from './playlistEngineService';

export type QuickPublishPreset = 'menu' | 'promotion' | 'ad' | 'announcement' | 'institutional';

export interface QuickPublishRequest {
  subscriberId: number;
  contractId: number;
  totemIds: number[];
  mediaIds: number[];
  preset: QuickPublishPreset;
  title?: string;
  description?: string;
  publishNow?: boolean;
  durationMs?: number;
}

export interface QuickPublishResult {
  success: boolean;
  playlistId: number;
  campaignId: number;
  publishedTotemIds: number[];
  regeneratedTotemIds: number[];
  failedTotemIds?: number[];
  partialRegeneration?: boolean;
  message: string;
}

const PRESET_LABELS: Record<QuickPublishPreset, string> = {
  menu: 'Cardápio Digital',
  promotion: 'Promoção',
  ad: 'Anúncio',
  announcement: 'Comunicado',
  institutional: 'Institucional',
};

const PRESET_CATEGORY: Record<QuickPublishPreset, string> = {
  menu: 'cardapio',
  promotion: 'promocao',
  ad: 'anuncio',
  announcement: 'comunicado',
  institutional: 'institucional',
};

function normalizePositiveIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  )];
}

function normalizePreset(value: unknown): QuickPublishPreset {
  const preset = String(value || '').trim() as QuickPublishPreset;
  if (preset && Object.prototype.hasOwnProperty.call(PRESET_LABELS, preset)) {
    return preset;
  }
  return 'ad';
}

function normalizeDurationMs(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 10000;
  }
  return Math.max(1000, Math.min(300000, Math.floor(numeric)));
}

function formatTimestampForName(date = new Date()): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '');
}

export class QuickPublishService {
  private get db() {
    return getDatabase();
  }

  async publish(input: QuickPublishRequest, userId: number): Promise<QuickPublishResult> {
    const subscriberId = Number(input.subscriberId);
    const contractId = Number(input.contractId);
    const totemIds = normalizePositiveIds(input.totemIds);
    const mediaIds = normalizePositiveIds(input.mediaIds);
    const preset = normalizePreset(input.preset);
    const durationMs = normalizeDurationMs(input.durationMs);
    const publishNow = input.publishNow !== false;
    const title = String(input.title || PRESET_LABELS[preset]).trim();
    const description = String(input.description || '').trim() || null;
    const categorySegment = PRESET_CATEGORY[preset];

    if (!Number.isInteger(subscriberId) || subscriberId <= 0) {
      throw new Error('subscriberId é obrigatório');
    }
    if (!Number.isInteger(contractId) || contractId <= 0) {
      throw new Error('contractId é obrigatório para publicação rápida');
    }
    if (!title) {
      throw new Error('Título da publicação é obrigatório');
    }
    if (totemIds.length === 0) {
      throw new Error('Selecione ao menos uma tela/totem');
    }
    if (mediaIds.length === 0) {
      throw new Error('Selecione ao menos uma mídia');
    }

    try {
      const subscriberService = getSubscriberService();
      await subscriberService.validatePlanLimits(subscriberId, 'playlist');
      await subscriberService.validatePlanLimits(subscriberId, 'campaign');

      const subscriber = await subscriberService.getSubscriberById(subscriberId);
      if (!subscriber || subscriber.is_active === false) {
        throw new Error('Anunciante não encontrado ou inativo');
      }

      const contracts = await subscriberService.getSubscriberContracts(subscriberId, true);
      const contract = contracts.find((item: any) => Number(item.contract_id) === contractId);
      if (!contract) {
        throw new Error('Contrato ativo não encontrado para este anunciante');
      }

      const eligibleTotems = await subscriberService.getTotemsBySubscriberContract(subscriberId, contractId);
      const eligibleTotemIds = new Set(eligibleTotems.map((item: any) => Number(item.totem_id)));
      const invalidTotemIds = totemIds.filter((id) => !eligibleTotemIds.has(id));
      if (invalidTotemIds.length > 0) {
        throw new Error(`Totens fora do contrato/plano selecionado: ${invalidTotemIds.join(', ')}`);
      }

      const mediaRows = await this.db.findMany(`
        SELECT media_id, subscriber_id, name, media_type, duration_seconds, status, approval_status
        FROM medias
        WHERE media_id = ANY($1::int[])
          AND COALESCE(is_active, true) = true
      `, [mediaIds]);

      if (mediaRows.length !== mediaIds.length) {
        const foundIds = mediaRows.map((item: any) => Number(item.media_id));
        const missing = mediaIds.filter((id) => !foundIds.includes(id));
        throw new Error(`Mídias não encontradas ou inativas: ${missing.join(', ')}`);
      }

      const invalidMediaOwners = mediaRows.filter((item: any) => Number(item.subscriber_id) !== subscriberId);
      if (invalidMediaOwners.length > 0) {
        throw new Error('Todas as mídias devem pertencer ao anunciante selecionado');
      }

      const notApproved = mediaRows.filter((item: any) => {
        const status = String(item.status || '').toLowerCase();
        const approvalStatus = String(item.approval_status || '').toLowerCase();
        return status !== 'approved' || approvalStatus !== 'approved';
      });
      if (notApproved.length > 0) {
        throw new Error(
          `A publicação rápida exige mídias aprovadas: ${notApproved.map((item: any) => item.name).join(', ')}`
        );
      }

      const totemRows = await this.db.findMany(`
        SELECT t.totem_id, l.publisher_id
        FROM totems t
        JOIN locals l ON l.local_id = t.local_id
        WHERE t.totem_id = ANY($1::int[])
          AND COALESCE(t.is_active, true) = true
          AND COALESCE(l.is_active, true) = true
      `, [totemIds]);
      const publisherIds = [...new Set(totemRows.map((item: any) => Number(item.publisher_id)).filter(Boolean))];
      if (publisherIds.length === 0) {
        throw new Error('Não foi possível identificar as organizações (publishers) dos totens selecionados');
      }

      const result = await transaction(async (client) => {
        const playlistName = `${PRESET_LABELS[preset]} - ${title} - ${formatTimestampForName()}`;
        const playlistResult = await client.query(`
          INSERT INTO playlists (subscriber_id, name, category_segment, description, is_active, metadata)
          VALUES ($1, $2, $3, $4, true, $5::jsonb)
          RETURNING playlist_id
        `, [
          subscriberId,
          playlistName,
          categorySegment,
          description,
          JSON.stringify({ source: 'quick_publish', preset }),
        ]);

        const playlistId = Number(playlistResult.rows[0]?.playlist_id);
        if (!playlistId) {
          throw new Error('Erro ao criar playlist da publicação rápida');
        }

        for (let index = 0; index < mediaIds.length; index++) {
          const mediaId = mediaIds[index];
          const media = mediaRows.find((item: any) => Number(item.media_id) === mediaId);
          const mediaType = String(media?.media_type || '').toLowerCase();
          const displaySeconds =
            mediaType === 'video' || mediaType === 'audio'
              ? 0
              : Math.max(1, Math.floor(durationMs / 1000));

          await client.query(`
            INSERT INTO playlist_items (playlist_id, media_id, order_index, display_seconds, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, CURRENT_TIMESTAMP)
          `, [
            playlistId,
            mediaId,
            index + 1,
            displaySeconds,
            JSON.stringify({ source: 'quick_publish', preset }),
          ]);
        }

        const campaignResult = await client.query(`
          INSERT INTO campaigns (
            subscriber_id, contract_id, title, category_segment, description,
            campaign_type, priority, commercial_tier, timezone, status, is_active, metadata
          )
          VALUES ($1, $2, $3, $4, $5, 'general', 1, 'standard', 'America/Sao_Paulo', $6, $7, $8::jsonb)
          RETURNING campaign_id
        `, [
          subscriberId,
          contractId,
          title,
          categorySegment,
          description,
          publishNow ? 'active' : 'draft',
          publishNow,
          JSON.stringify({ source: 'quick_publish', preset }),
        ]);

        const campaignId = Number(campaignResult.rows[0]?.campaign_id);
        if (!campaignId) {
          throw new Error('Erro ao criar campanha da publicação rápida');
        }

        await client.query(`
          INSERT INTO campaign_playlists (campaign_id, playlist_id, priority, is_active, metadata)
          VALUES ($1, $2, 1, true, $3::jsonb)
        `, [campaignId, playlistId, JSON.stringify({ source: 'quick_publish', preset })]);

        for (const publisherId of publisherIds) {
          await client.query(`
            INSERT INTO campaign_publishers (campaign_id, publisher_id, is_active, metadata)
            VALUES ($1, $2, true, $3::jsonb)
            ON CONFLICT (campaign_id, publisher_id)
            DO UPDATE SET is_active = true, metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP
          `, [campaignId, publisherId, JSON.stringify({ source: 'quick_publish', preset })]);
        }

        for (const totemId of totemIds) {
          await client.query(`
            INSERT INTO campaign_totems (campaign_id, totem_id, priority, is_active)
            VALUES ($1, $2, 1, $3)
            ON CONFLICT (campaign_id, totem_id)
            DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = CURRENT_TIMESTAMP
          `, [campaignId, totemId, publishNow]);
        }

        await client.query(`
          INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, timestamp)
          VALUES ($1, 'quick_publish', 'campaign', $2, $3::jsonb, CURRENT_TIMESTAMP)
        `, [
          userId,
          campaignId,
          JSON.stringify({ subscriberId, contractId, totemIds, mediaIds, playlistId, preset, publishNow }),
        ]);

        return { playlistId, campaignId };
      });

      await getCacheService().invalidateEntity('subscriber', subscriberId).catch(() => {});
      await getCacheService().invalidateEntity('playlist', result.playlistId).catch(() => {});
      await getCacheService().invalidateEntity('campaign', result.campaignId).catch(() => {});

      const engine = getPlaylistEngineServiceInstance();
      const regeneratedTotemIds: number[] = [];
      for (const totemId of totemIds) {
        try {
          await engine.generatePlaylistForTotem(totemId, undefined, true);
          regeneratedTotemIds.push(totemId);
        } catch (error) {
          await logError('Erro ao regenerar playlist após publicação rápida', error, { totemId });
        }
      }

      const partialRegen = regeneratedTotemIds.length < totemIds.length;
      const failedTotemIds = totemIds.filter((id) => !regeneratedTotemIds.includes(id));

      return {
        success: !partialRegen || regeneratedTotemIds.length > 0,
        playlistId: result.playlistId,
        campaignId: result.campaignId,
        publishedTotemIds: totemIds,
        regeneratedTotemIds,
        failedTotemIds: partialRegen ? failedTotemIds : [],
        partialRegeneration: partialRegen,
        message: partialRegen
          ? `Publicação criada, mas ${failedTotemIds.length} tela(s) não atualizaram a playlist automaticamente`
          : publishNow
            ? 'Conteúdo publicado com sucesso'
            : 'Publicação criada como rascunho',
      };
    } catch (error: any) {
      await logError('Erro na publicação rápida', error, { subscriberId, contractId, totemIds, mediaIds, preset });
      throw error;
    }
  }
}

let quickPublishServiceInstance: QuickPublishService | null = null;

export function getQuickPublishService(): QuickPublishService {
  if (!quickPublishServiceInstance) {
    quickPublishServiceInstance = new QuickPublishService();
  }
  return quickPublishServiceInstance;
}
