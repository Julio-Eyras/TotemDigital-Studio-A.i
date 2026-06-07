/** Normaliza ID de mídia (backend pode retornar `id` ou `media_id`). */

export function resolveMediaId(
  source: { media_id?: number; id?: number } | null | undefined
): number | null {
  if (!source) return null;
  const n = Number(source.media_id ?? source.id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function sanitizeMediaIdList(
  ids: Iterable<number | string | null | undefined>
): number[] {
  const out: number[] = [];
  for (const item of ids) {
    const n = Number(item);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) {
      out.push(n);
    }
  }
  return out;
}

/** Normaliza resposta bruta de upload/transform/getById para MediaItem consistente. */
export function normalizeMediaItem(raw: Record<string, unknown>): {
  media_id: number;
  id: number;
  [key: string]: unknown;
} {
  const mid = resolveMediaId(raw as { media_id?: number; id?: number }) ?? 0;
  return {
    ...raw,
    media_id: mid,
    id: mid,
    media_type: raw.media_type ?? raw.mediaType ?? 'video',
    approvalStatus: raw.approvalStatus ?? raw.approvalstatus ?? raw.status,
  };
}
