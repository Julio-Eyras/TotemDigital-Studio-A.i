/**
 * Duração (segundos) no DispatchPlan por item.
 *
 * Regras de exposição (campo `duration` no JSON enviado ao player):
 * - Vídeo/áudio: `null` — o player usa a duração real do ficheiro.
 * - Imagem: `display_seconds` se > 0; senão default.
 * - HTML: regra própria (mín. 30s na playlist ou 60s default).
 *
 * Para `totalDuration` do plano (estimativa), usar [resolvePlanTotalItemSeconds].
 */

export const DEFAULT_IMAGE_DISPLAY_SECONDS = 10;
export const DEFAULT_HTML_DISPLAY_SECONDS = 60;
export const DEFAULT_MEDIA_FALLBACK_SECONDS = 10;

import {
  isHtmlMediaType as isHtmlMedia,
  isVideoOrAudioMediaType as isVideoOrAudio,
} from './mediaTypeUtils';

export function positiveIntOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Duração de exposição no DispatchPlan (`duration` no JSON). `null` para vídeo/áudio. */
export function resolveDispatchItemDurationSeconds(params: {
  displaySeconds: number | null | undefined;
  mediaType: string | null | undefined;
  mediaDurationSeconds: number | null | undefined;
}): number | null {
  if (isVideoOrAudio(params.mediaType)) {
    return null;
  }

  if (isHtmlMedia(params.mediaType)) {
    const fromPlaylist = positiveIntOrNull(params.displaySeconds);
    if (fromPlaylist != null && fromPlaylist >= 30) return fromPlaylist;
    return DEFAULT_HTML_DISPLAY_SECONDS;
  }

  return positiveIntOrNull(params.displaySeconds) ?? DEFAULT_IMAGE_DISPLAY_SECONDS;
}

/** Estimativa de duração para `totalDuration` do plano / mix (inclui ficheiro em vídeo). */
export function resolvePlanTotalItemSeconds(params: {
  displaySeconds: number | null | undefined;
  mediaType: string | null | undefined;
  mediaDurationSeconds: number | null | undefined;
}): number {
  const exposure = resolveDispatchItemDurationSeconds(params);
  if (exposure != null) return exposure;
  if (isVideoOrAudio(params.mediaType)) {
    return positiveIntOrNull(params.mediaDurationSeconds) ?? DEFAULT_MEDIA_FALLBACK_SECONDS;
  }
  return DEFAULT_IMAGE_DISPLAY_SECONDS;
}

export function sumDispatchMediaItemsPlanDuration(
  items: Array<{ duration: number | null; mediaType?: string; metadata?: { durationSeconds?: number } }>
): number {
  return items.reduce((sum, item) => {
    if (item.duration != null) return sum + item.duration;
    const t = String(item.mediaType || '').toLowerCase();
    if (t === 'video' || t === 'audio') {
      return sum + (positiveIntOrNull(item.metadata?.durationSeconds) ?? 0);
    }
    return sum;
  }, 0);
}
