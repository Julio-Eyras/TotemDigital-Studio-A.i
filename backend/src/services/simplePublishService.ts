/**
 * Publicação modo simples — fila + totem(s), sem agendamento na superfície.
 * Reutiliza quickPublish com metadata e campanha de vigência aberta.
 */

import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { getQuickPublishService, QuickPublishResult } from './quickPublishService';

export interface SimplePublishRequest {
  subscriberId: number;
  contractId: number;
  totemIds: number[];
  mediaIds: number[];
  title?: string;
  description?: string;
}

export class SimplePublishService {
  private get db() {
    return getDatabase();
  }

  async publish(
    input: SimplePublishRequest,
    userId: number,
    options?: { userRole?: string }
  ): Promise<QuickPublishResult> {
    const title = String(input.title || 'Publicação na tela').trim();
    const result = await getQuickPublishService().publish(
      {
        subscriberId: input.subscriberId,
        contractId: input.contractId,
        totemIds: input.totemIds,
        mediaIds: input.mediaIds,
        preset: 'ad',
        title,
        description: input.description,
        publishNow: true,
      },
      userId,
      options
    );

    const simpleMeta = {
      source: 'simple_publish',
      simpleMode: true,
      preset: 'ad',
    };

    try {
      await this.db.executeRaw(
        `
        UPDATE campaigns
        SET
          metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
          start_date = NULL,
          end_date = NULL,
          start_time = NULL,
          end_time = NULL,
          days_of_week = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE campaign_id = $2
      `,
        [JSON.stringify(simpleMeta), result.campaignId]
      );

      await this.db.executeRaw(
        `
        UPDATE playlists
        SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE playlist_id = $2
      `,
        [JSON.stringify(simpleMeta), result.playlistId]
      );
} catch (error: unknown) {
      await logError('Erro ao marcar campanha/playlist como simple_publish', error, {
        campaignId: result.campaignId,
        playlistId: result.playlistId,
      });
    }

    return {
      ...result,
      message: result.message || 'Conteúdo publicado na(s) tela(s) selecionada(s).',
    };
  }
}

let instance: SimplePublishService | null = null;

export function getSimplePublishService(): SimplePublishService {
  if (!instance) {
    instance = new SimplePublishService();
  }
  return instance;
}
