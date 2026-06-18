/** Tag principal de vinheta na biblioteca de mídias (`medias.tags`). */
export const VINHETA_TAG = 'vinheta';

/**
 * Vinheta global: incluída automaticamente no dispatch de todas as campanhas do anunciante.
 * Requer também a tag `vinheta`.
 */
export const VINHETA_GLOBAL_TAG = 'vinheta_global';

export function normalizeTagList(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

export function hasVinhetaTag(tags: unknown): boolean {
  return normalizeTagList(tags).includes(VINHETA_TAG);
}

export function hasVinhetaGlobalTag(tags: unknown): boolean {
  return normalizeTagList(tags).includes(VINHETA_GLOBAL_TAG);
}

export function mergeVinhetaTags(existing: unknown, global: boolean): string[] {
  const base = new Set(normalizeTagList(existing));
  base.add(VINHETA_TAG);
  if (global) base.add(VINHETA_GLOBAL_TAG);
  else base.delete(VINHETA_GLOBAL_TAG);
  return Array.from(base);
}
