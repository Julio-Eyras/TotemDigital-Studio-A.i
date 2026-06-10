/**
 * Onda C: processamento de vídeo IA Premium (adapter HTTP configurável; fallback fila informativa).
 */

import { aiVideoConfig } from '../../config/env';
import { getDatabase } from '../../config/database';
import { getMediaService } from '../mediaService';
import { subscriberHasPremiumAiVideo } from '../../utils/publishPlanFeatures';
import { logError } from '../../utils/loggerHelper';
import type { PublishBoardPresetType } from '../publishBoardRenderService';
import { generateVideoViaHttp } from './httpAiVideoAdapter';
import type { AiVideoJobResult, AiVideoProviderId } from './aiVideoTypes';

export interface VideoAiProcessInput {
  subscriberId: number;
  preset: PublishBoardPresetType;
  briefSummary?: string;
  userId: number;
}

function resolveProvider(): AiVideoProviderId {
  const raw = String(aiVideoConfig.provider || 'none').trim().toLowerCase();
  if (raw === 'http' && String(aiVideoConfig.apiUrl || '').trim()) {
    return 'http';
  }
  return 'none';
}

export class PublishVideoAiProcessorService {
  private get db() {
    return getDatabase();
  }

  async run(input: VideoAiProcessInput): Promise<AiVideoJobResult> {
    const isPremium = await subscriberHasPremiumAiVideo(input.subscriberId);
    if (!isPremium) {
      return {
        jobId: '',
        status: 'failed',
        message: 'Geração de vídeo por IA disponível apenas no plano Premium.',
        premiumRequired: true,
        provider: 'none',
      };
    }

    const jobId = `vai-${input.subscriberId}-${Date.now()}`;
    const provider = resolveProvider();

    await this.persistJob(jobId, input, provider, 'processing');

    if (provider === 'none') {
      const message =
        'Pedido registrado. Configure AI_VIDEO_PROVIDER=http e AI_VIDEO_API_URL para geração real; use animação HTML no plano base.';
      await this.persistJob(jobId, input, provider, 'queued', { message });
      return { jobId, status: 'queued', message, provider };
    }

    const generated = await generateVideoViaHttp({
      subscriberId: input.subscriberId,
      preset: input.preset,
      briefSummary: input.briefSummary,
      userId: input.userId,
    });

    if (generated.status !== 'completed' || !generated.videoUrl) {
      await this.persistJob(jobId, input, provider, 'failed', { message: generated.message });
      return { jobId, status: 'failed', message: generated.message, provider };
    }

    try {
      const media = await this.importVideoFromUrl(
        generated.videoUrl,
        input.subscriberId,
        input.userId,
        input.preset,
        input.briefSummary
      );
      const message = 'Vídeo IA importado e aprovado para publicação.';
      await this.persistJob(jobId, input, provider, 'completed', {
        message,
        mediaId: media.id,
        mediaName: media.name,
        videoUrl: generated.videoUrl,
      });
      return {
        jobId,
        status: 'completed',
        message,
        mediaId: media.id,
        mediaName: media.name,
        provider,
      };
    } catch (error: any) {
      const message = error?.message || 'Erro ao importar vídeo gerado.';
      await logError('publishVideoAiProcessor: importação falhou', error);
      await this.persistJob(jobId, input, provider, 'failed', { message });
      return { jobId, status: 'failed', message, provider };
    }
  }

  async getJobStatus(jobId: string, subscriberId: number): Promise<AiVideoJobResult | null> {
    const rows = await this.db.findMany(`
      SELECT metadata, timestamp
      FROM audit_logs
      WHERE action IN ('publish_video_ai_queued', 'publish_video_ai_job')
        AND entity = 'subscriber'
        AND entity_id = $1
      ORDER BY timestamp DESC
      LIMIT 50
    `, [subscriberId]);

    for (const row of rows) {
      let meta: Record<string, unknown> = {};
      try {
        meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      } catch {
        continue;
      }
      if (String(meta.jobId) !== jobId) continue;
      return {
        jobId,
        status: (meta.status as AiVideoJobResult['status']) || 'queued',
        message: String(meta.message || 'Job de vídeo IA'),
        mediaId: meta.mediaId != null ? Number(meta.mediaId) : undefined,
        mediaName: meta.mediaName != null ? String(meta.mediaName) : undefined,
        provider: (meta.provider as AiVideoProviderId) || 'none',
      };
    }
    return null;
  }

  private async importVideoFromUrl(
    videoUrl: string,
    subscriberId: number,
    userId: number,
    preset: PublishBoardPresetType,
    briefSummary?: string
  ) {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Falha ao baixar vídeo (${response.status})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const maxBytes = 200 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      throw new Error('Vídeo IA excede limite de 200MB para importação.');
    }

    const mediaService = getMediaService();
    const isAdmin = true;
    const media = await mediaService.createMedia(
      {
        name: `Vídeo IA — ${preset}${briefSummary ? ` — ${briefSummary.slice(0, 40)}` : ''}`,
        description: 'Vídeo gerado por IA (Premium) — Publicar em Tela',
        tags: ['publish-board', preset, 'ai-video', 'auto-generated'],
        file: {
          buffer,
          originalname: `ai-video-${subscriberId}-${Date.now()}.mp4`,
          mimetype: 'video/mp4',
          size: buffer.length,
        },
        subscriberId,
        createdBy: userId,
      },
      subscriberId,
      isAdmin
    );

    await this.db.executeRaw(`
      UPDATE medias
      SET status = 'approved',
          approval_status = 'approved',
          approved_by = $2,
          approved_at = CURRENT_TIMESTAMP,
          media_type = 'video'
      WHERE media_id = $1
    `, [media.id, userId > 0 ? userId : null]);

    return media;
  }

  private async persistJob(
    jobId: string,
    input: VideoAiProcessInput,
    provider: AiVideoProviderId,
    status: string,
    extra?: Record<string, unknown>
  ): Promise<void> {
    const metadata = {
      jobId,
      subscriberId: input.subscriberId,
      preset: input.preset,
      briefSummary: input.briefSummary || null,
      status,
      provider,
      message: extra?.message || null,
      mediaId: extra?.mediaId ?? null,
      mediaName: extra?.mediaName ?? null,
      videoUrl: extra?.videoUrl ?? null,
      updatedAt: new Date().toISOString(),
    };

    try {
      await this.db.executeRaw(`
        INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, timestamp)
        VALUES ($1, 'publish_video_ai_job', 'subscriber', $2, $3::jsonb, CURRENT_TIMESTAMP)
      `, [input.userId || null, input.subscriberId, JSON.stringify(metadata)]);
    } catch {
      /* audit opcional */
    }
  }
}

let instance: PublishVideoAiProcessorService | null = null;

export function getPublishVideoAiProcessorService(): PublishVideoAiProcessorService {
  if (!instance) instance = new PublishVideoAiProcessorService();
  return instance;
}
