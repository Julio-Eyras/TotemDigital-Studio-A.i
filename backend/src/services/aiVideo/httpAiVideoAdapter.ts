/**
 * Adapter HTTP genérico para provedor externo de vídeo IA (Onda C).
 * POST AI_VIDEO_API_URL com { brief, preset, subscriberId } → { videoUrl | url }
 */

import { aiVideoConfig } from '../../config/env';
import type { AiVideoGenerateInput, AiVideoGenerateOutput } from './aiVideoTypes';

export async function generateVideoViaHttp(input: AiVideoGenerateInput): Promise<AiVideoGenerateOutput> {
  const apiUrl = String(aiVideoConfig.apiUrl || '').trim();
  if (!apiUrl) {
    return {
      status: 'failed',
      message: 'AI_VIDEO_API_URL não configurada no servidor.',
      provider: 'http',
    };
  }

  const apiKey = String(aiVideoConfig.apiKey || '').trim();
  const timeoutMs = Math.max(5000, Math.min(300000, aiVideoConfig.timeoutMs));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        brief: input.briefSummary || '',
        preset: input.preset,
        subscriberId: input.subscriberId,
      }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const errMsg = String(body.error || body.message || `HTTP ${response.status}`);
      return { status: 'failed', message: errMsg, provider: 'http' };
    }

    const videoUrl = String(body.videoUrl || body.url || '').trim();
    if (!videoUrl) {
      return {
        status: 'failed',
        message: 'Provedor de vídeo não retornou videoUrl.',
        provider: 'http',
      };
    }

    return {
      status: 'completed',
      message: 'Vídeo gerado pelo provedor externo.',
      videoUrl,
      provider: 'http',
    };
  } catch (error: any) {
    const msg = error?.name === 'AbortError'
      ? 'Timeout ao aguardar geração de vídeo IA.'
      : (error?.message || 'Erro ao chamar provedor de vídeo IA');
    return { status: 'failed', message: msg, provider: 'http' };
  } finally {
    clearTimeout(timer);
  }
}
