/**
 * Fila stub para geração de vídeo por IA (Premium).
 * Registra pedido e retorna status pendente até integração com provedor externo.
 */

import { getDatabase } from '../config/database';
import { subscriberHasPremiumAiVideo } from '../utils/publishPlanFeatures';
import type { PublishBoardPresetType } from './publishBoardRenderService';

export interface VideoAiQueueRequest {
  subscriberId: number;
  preset: PublishBoardPresetType;
  briefSummary?: string;
  userId: number;
}

export interface VideoAiQueueResult {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message: string;
  premiumRequired?: boolean;
}

export class PublishVideoAiQueueService {
  private get db() {
    return getDatabase();
  }

  async enqueue(input: VideoAiQueueRequest): Promise<VideoAiQueueResult> {
    const isPremium = await subscriberHasPremiumAiVideo(input.subscriberId);
    if (!isPremium) {
      return {
        jobId: '',
        status: 'failed',
        message: 'Geração de vídeo por IA disponível apenas no plano Premium.',
        premiumRequired: true,
      };
    }

    const jobId = `vai-${input.subscriberId}-${Date.now()}`;
    const metadata = {
      jobId,
      subscriberId: input.subscriberId,
      preset: input.preset,
      briefSummary: input.briefSummary || null,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    try {
      await this.db.executeRaw(`
        INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, timestamp)
        VALUES ($1, 'publish_video_ai_queued', 'subscriber', $2, $3::jsonb, CURRENT_TIMESTAMP)
      `, [input.userId || null, input.subscriberId, JSON.stringify(metadata)]);
    } catch {
      /* audit opcional */
    }

    return {
      jobId,
      status: 'queued',
      message:
        'Pedido de vídeo IA registrado. A integração com o provedor de vídeo será concluída em etapa Premium; use animação HTML ao vivo no plano base.',
    };
  }
}

let instance: PublishVideoAiQueueService | null = null;

export function getPublishVideoAiQueueService(): PublishVideoAiQueueService {
  if (!instance) instance = new PublishVideoAiQueueService();
  return instance;
}
