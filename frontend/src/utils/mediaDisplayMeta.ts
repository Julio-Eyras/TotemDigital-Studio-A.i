/**
 * Formatação compartilhada de metadados de mídia (lista totem + biblioteca).
 */

export function formatMediaFileSize(bytes?: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMediaDuration(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatMediaResolution(width?: number | null, height?: number | null): string {
  const w = Number(width ?? 0);
  const h = Number(height ?? 0);
  if (w <= 0 || h <= 0) return '';
  return `${w}×${h}`;
}

/** Orientação útil para totens verticais. */
export function formatMediaOrientation(width?: number | null, height?: number | null): string {
  const w = Number(width ?? 0);
  const h = Number(height ?? 0);
  if (w <= 0 || h <= 0) return '';
  if (h > w) return 'retrato';
  if (w > h) return 'paisagem';
  return 'quadrado';
}

export interface MediaDisplayMetaInput {
  mediaType?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
  /** Índice 0-based da ordem no totem; exibido como #1, #2… */
  orderIndex?: number | null;
  /** Partes extras (ex.: “desabilitada neste totem”). */
  extras?: Array<string | null | undefined>;
  includeOrientation?: boolean;
}

/**
 * Linha compacta: `#2 · VIDEO · 0:05 · 1080×1920 · retrato · 1.02 MB`
 */
export function buildMediaMetaSummary(input: MediaDisplayMetaInput): string {
  const parts: string[] = [];

  if (input.orderIndex != null && Number.isFinite(input.orderIndex)) {
    parts.push(`#${Number(input.orderIndex) + 1}`);
  }

  const type = String(input.mediaType || '').trim();
  if (type) parts.push(type.toUpperCase());

  const duration = formatMediaDuration(input.durationSeconds);
  if (duration) parts.push(duration);

  const resolution = formatMediaResolution(input.width, input.height);
  if (resolution) parts.push(resolution);

  if (input.includeOrientation !== false) {
    const orientation = formatMediaOrientation(input.width, input.height);
    if (orientation) parts.push(orientation);
  }

  const size = formatMediaFileSize(input.sizeBytes);
  if (size) parts.push(size);

  for (const extra of input.extras || []) {
    const t = String(extra || '').trim();
    if (t) parts.push(t);
  }

  return parts.join(' · ');
}
