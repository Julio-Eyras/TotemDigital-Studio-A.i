/**
 * Fila de geração de vídeo por IA (Premium) — delega ao processador Onda C.
 */

import { getPublishVideoAiProcessorService } from './aiVideo/publishVideoAiProcessorService';
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
  mediaId?: number;
  mediaName?: string;
  provider?: string;
}

export class PublishVideoAiQueueService {
  async enqueue(input: VideoAiQueueRequest): Promise<VideoAiQueueResult> {
    const result = await getPublishVideoAiProcessorService().run({
      subscriberId: input.subscriberId,
      preset: input.preset,
      briefSummary: input.briefSummary,
      userId: input.userId,
    });

    return {
      jobId: result.jobId,
      status: result.status,
      message: result.message,
      premiumRequired: result.premiumRequired,
      mediaId: result.mediaId,
      mediaName: result.mediaName,
      provider: result.provider,
    };
  }

  async getStatus(jobId: string, subscriberId: number): Promise<VideoAiQueueResult | null> {
    const result = await getPublishVideoAiProcessorService().getJobStatus(jobId, subscriberId);
    if (!result) return null;
    return {
      jobId: result.jobId,
      status: result.status,
      message: result.message,
      mediaId: result.mediaId,
      mediaName: result.mediaName,
      provider: result.provider,
    };
  }
}

let instance: PublishVideoAiQueueService | null = null;

export function getPublishVideoAiQueueService(): PublishVideoAiQueueService {
  if (!instance) instance = new PublishVideoAiQueueService();
  return instance;
}
