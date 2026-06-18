/**
 * Tipos lógicos de mídia (video, image, audio, html) — fonte única para playlist, dispatch e validações.
 */

export function normalizeMediaTypeLabel(raw: string | null | undefined): string {
  return String(raw || '').trim().toLowerCase();
}

export function isVideoOrAudioMediaType(mediaType: string | null | undefined): boolean {
  const t = normalizeMediaTypeLabel(mediaType);
  if (t === 'video' || t === 'audio') return true;
  return t.startsWith('video/') || t.startsWith('audio/');
}

export function isHtmlMediaType(mediaType: string | null | undefined): boolean {
  const t = normalizeMediaTypeLabel(mediaType);
  return t === 'html' || t === 'web' || t === 'widget' || t === 'iframe';
}

export function isImageMediaType(mediaType: string | null | undefined): boolean {
  const t = normalizeMediaTypeLabel(mediaType);
  return t === 'image' || t.startsWith('image/');
}

/** Resolve tipo lógico a partir de media_type, MIME e nome/caminho do ficheiro. */
export function resolveLogicalMediaType(params: {
  mediaType?: string | null;
  mimeType?: string | null;
  filePath?: string | null;
  fileName?: string | null;
}): string {
  const mime = normalizeMediaTypeLabel(params.mimeType);
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';

  const name = `${params.fileName || ''} ${params.filePath || ''}`.toLowerCase();
  if (/\.(mp4|webm|mov|mkv|m4v)(\?|#|$)/.test(name)) return 'video';
  if (/\.(mp3|aac|wav|ogg|m4a)(\?|#|$)/.test(name)) return 'audio';
  if (/\.(jpe?g|png|gif|webp)(\?|#|$)/.test(name)) return 'image';
  if (/\.(html?)(\?|#|$)/.test(name)) return 'html';

  const t = normalizeMediaTypeLabel(params.mediaType);
  if (t === 'video' || t === 'audio' || t === 'image') return t;
  if (isHtmlMediaType(t)) return t;
  if (t.startsWith('video/') || t.startsWith('audio/') || t.startsWith('image/')) {
    if (t.startsWith('video/')) return 'video';
    if (t.startsWith('audio/')) return 'audio';
    return 'image';
  }

  return t || 'image';
}
