import type { PublishBoardPresetType } from '../publishBoardRenderService';

export type AiVideoProviderId = 'none' | 'http';

export interface AiVideoGenerateInput {
  subscriberId: number;
  preset: PublishBoardPresetType;
  briefSummary?: string;
  userId: number;
}

export interface AiVideoGenerateOutput {
  status: 'completed' | 'failed' | 'queued';
  message: string;
  videoUrl?: string;
  provider: AiVideoProviderId;
}

export interface AiVideoJobResult {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message: string;
  mediaId?: number;
  mediaName?: string;
  premiumRequired?: boolean;
  provider?: AiVideoProviderId;
}
