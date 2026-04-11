export type DispatchCacheBucket = 'propagandas' | 'vinhetas';

export interface DispatchMediaBucketInput {
  tags?: unknown;
  file_path?: string;
  filePath?: string;
}

export function resolveDispatchCacheBucket(input: DispatchMediaBucketInput): DispatchCacheBucket {
  const tagsRaw = input?.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw
    : typeof tagsRaw === 'string'
      ? tagsRaw.split(',').map((t) => t.trim())
      : [];
  const hasVinhetaTag = tags.some((tag) => String(tag).trim().toLowerCase() === 'vinheta');
  if (hasVinhetaTag) return 'vinhetas';

  const filePath = String(input?.file_path || input?.filePath || '').toLowerCase();
  if (filePath.includes('/vinhetas/') || filePath.includes('\\vinhetas\\')) return 'vinhetas';
  return 'propagandas';
}
