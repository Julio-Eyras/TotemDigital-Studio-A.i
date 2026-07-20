/**
 * Formatação compartilhada de metadados de mídia (lista totem + biblioteca).
 */

const TOTEM_DELIVERY_PENDING_TAG = '_totem_delivery_pending';

export function isTotemDeliveryPendingTag(tags?: string[] | null): boolean {
  return (tags || []).some((tag) => String(tag) === TOTEM_DELIVERY_PENDING_TAG);
}

/** Dimensões do ficheiro que o player/UI reproduzem (colunas width/height após bake = canvas de entrega). */
export function resolveMediaPlaybackDimensions(input: {
  width?: number | null;
  height?: number | null;
  tags?: string[] | null;
}): { width?: number; height?: number; pendingDelivery: boolean } {
  const pendingDelivery = isTotemDeliveryPendingTag(input.tags);
  const w = Number(input.width ?? 0);
  const h = Number(input.height ?? 0);
  if (w <= 0 || h <= 0) {
    return { pendingDelivery };
  }
  return { width: w, height: h, pendingDelivery };
}

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

export function formatMediaApprovalLine(
  approvedByName?: string | null,
  approvedAt?: string | Date | null
): string {
  const name = String(approvedByName || '').trim();
  if (!name) return '';
  let datePart = '';
  if (approvedAt) {
    const d = approvedAt instanceof Date ? approvedAt : new Date(approvedAt);
    if (!Number.isNaN(d.getTime())) {
      datePart = ` em ${d.toLocaleDateString('pt-BR')}`;
    }
  }
  return `Aprovado por ${name}${datePart}`;
}

export function formatMediaDate(value?: string | Date | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
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
  /** Inclui retrato/paisagem (desligado por omissão — alinhado à biblioteca/dialog). */
  includeOrientation?: boolean;
  /** Omite só o tamanho em bytes (mantém duração na linha compacta). */
  omitFileSize?: boolean;
  /** Omite tamanho e duração (úteis na 2.ª linha no mobile). */
  omitSizeAndDuration?: boolean;
  tags?: string[] | null;
}

/**
 * Linha compacta alinhada à biblioteca: `VIDEO · 1920×1080 · 4.54 MB · 0:25`
 * (opcional: `#2 · … · paisagem · desabilitada neste totem`)
 */
export function buildMediaMetaSummary(input: MediaDisplayMetaInput): string {
  const parts: string[] = [];

  if (input.orderIndex != null && Number.isFinite(input.orderIndex)) {
    parts.push(`#${Number(input.orderIndex) + 1}`);
  }

  const type = String(input.mediaType || '').trim();
  if (type) parts.push(type.toUpperCase());

  const playback = resolveMediaPlaybackDimensions({
    width: input.width,
    height: input.height,
    tags: input.tags,
  });
  const resolution = formatMediaResolution(playback.width, playback.height);
  if (resolution) parts.push(resolution);

  if (input.includeOrientation === true) {
    const orientation = formatMediaOrientation(playback.width, playback.height);
    if (orientation) parts.push(orientation);
  }

  const skipSize = input.omitSizeAndDuration === true || input.omitFileSize === true;
  const skipDuration = input.omitSizeAndDuration === true;

  if (!skipSize) {
    const size = formatMediaFileSize(input.sizeBytes);
    if (size) parts.push(size);
  }

  if (!skipDuration) {
    const duration = formatMediaDuration(input.durationSeconds);
    if (duration) parts.push(duration);
  }

  for (const extra of input.extras || []) {
    const t = String(extra || '').trim();
    if (t) parts.push(t);
  }

  return parts.join(' · ');
}

/** 2.ª linha mobile/lista totem: `769.6 KB · 0:06 · 16/07/2026` */
export function buildMediaSizeDurationDateLine(input: {
  sizeBytes?: number | null;
  durationSeconds?: number | null;
  uploadedAt?: string | Date | null;
}): string {
  const parts: string[] = [];
  const size = formatMediaFileSize(input.sizeBytes);
  if (size) parts.push(size);
  const duration = formatMediaDuration(input.durationSeconds);
  if (duration) parts.push(duration);
  const date = formatMediaDate(input.uploadedAt);
  if (date) parts.push(date);
  return parts.join(' · ');
}
