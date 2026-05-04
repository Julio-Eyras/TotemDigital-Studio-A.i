/**
 * Duração (segundos) enviada no DispatchPlan por item.
 *
 * Regras:
 * - Vídeo/áudio: ignorar `display_seconds` (exposição de playlist); usar duração do ficheiro (`duration_seconds`), mínimo 10 se inválida.
 * - Imagem e restantes: usar `display_seconds` só se > 0; caso contrário default (não usar `duration_seconds` de vídeo como tempo de slide).
 */

export const DEFAULT_IMAGE_DISPLAY_SECONDS = 10;
export const DEFAULT_MEDIA_FALLBACK_SECONDS = 10;

function isVideoOrAudio(mediaType: string | null | undefined): boolean {
  const t = String(mediaType || '').toLowerCase();
  return t === 'video' || t === 'audio';
}

function positiveIntOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function resolveDispatchItemDurationSeconds(params: {
  displaySeconds: number | null | undefined;
  mediaType: string | null | undefined;
  mediaDurationSeconds: number | null | undefined;
}): number {
  if (isVideoOrAudio(params.mediaType)) {
    return positiveIntOrNull(params.mediaDurationSeconds) ?? DEFAULT_MEDIA_FALLBACK_SECONDS;
  }

  return positiveIntOrNull(params.displaySeconds) ?? DEFAULT_IMAGE_DISPLAY_SECONDS;
}
