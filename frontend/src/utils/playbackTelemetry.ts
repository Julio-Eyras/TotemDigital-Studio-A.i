export type TotemPlaybackStatus = 'playing' | 'paused' | 'stopped' | 'buffering' | 'error' | string;

export type PlaybackMediaId = number | string;

export interface TotemPlaybackNextMedia {
  id: PlaybackMediaId;
  name: string;
  type?: string;
  durationMs: number;
  order?: number;
}

export interface TotemPlaybackState {
  totemId?: number;
  mediaId?: PlaybackMediaId;
  mediaName: string;
  mediaType?: string;
  durationMs: number;
  startedAt?: string;
  expectedEndAt?: string;
  endedAt?: string;
  playedDurationMs?: number;
  status: TotemPlaybackStatus;
  stale: boolean;
  receivedAt: number;
  nextMedia?: TotemPlaybackNextMedia;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function positiveNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

function mediaId(...values: unknown[]): PlaybackMediaId | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function iso(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Normaliza tanto o contrato novo quanto campos snake_case de players legados. */
export function normalizePlaybackState(payload: unknown, fallbackTotemId?: number): TotemPlaybackState | null {
  const outer = record(payload);
  const data = record(outer.data);
  const runtime = record(data.runtime ?? outer.runtime);
  const media = record(data.media ?? outer.media);
  const playback = record(data.playback ?? outer.playback);
  const context = record(data.context ?? outer.context);
  const nowPlaying = record(
    data.nowPlaying ?? data.now_playing ?? outer.nowPlaying ?? outer.now_playing,
  );
  const source = Object.keys(nowPlaying).length ? nowPlaying : (Object.keys(data).length ? data : outer);
  const nextMediaSource = record(
    context.nextMedia ??
      context.next_media ??
      source.nextMedia ??
      source.next_media ??
      data.nextMedia ??
      data.next_media ??
      outer.nextMedia ??
      outer.next_media,
  );
  const mediaName = String(
    source.mediaName ?? source.media_name ?? source.name ?? media.name ?? '',
  ).trim();
  if (!mediaName) return null;

  const startedAt = iso(
    source.startedAt ??
      source.started_at ??
      playback.startedAt ??
      playback.started_at ??
      runtime.startedAt ??
      runtime.started_at,
  );
  let durationMs = positiveNumber(
    source.durationMs,
    source.duration_ms,
    media.durationMs,
    media.duration_ms,
    runtime.durationMs,
    runtime.duration_ms,
  );
  if (durationMs === undefined) {
    const seconds = positiveNumber(source.durationSeconds, source.duration_seconds, source.duration);
    durationMs = seconds === undefined ? 0 : seconds * 1000;
  }
  let expectedEndAt = iso(
    source.expectedEndAt ??
      source.expected_end_at ??
      playback.expectedEndAt ??
      playback.expected_end_at ??
      runtime.expectedEndAt ??
      runtime.expected_end_at,
  );
  if (!expectedEndAt && startedAt && durationMs > 0) {
    expectedEndAt = new Date(new Date(startedAt).getTime() + durationMs).toISOString();
  }
  const endedAt = iso(source.endedAt ?? source.ended_at ?? playback.endedAt ?? playback.ended_at);
  const playedDurationMs = positiveNumber(
    source.playedDurationMs,
    source.played_duration_ms,
    playback.playedDurationMs,
    playback.played_duration_ms,
  );
  const nextMediaId = mediaId(
    nextMediaSource.id,
    nextMediaSource.mediaId,
    nextMediaSource.media_id,
  );
  const nextMediaName = String(
    nextMediaSource.name ??
      nextMediaSource.mediaName ??
      nextMediaSource.media_name ??
      '',
  ).trim();
  let nextMediaDurationMs = positiveNumber(
    nextMediaSource.durationMs,
    nextMediaSource.duration_ms,
  );
  if (nextMediaDurationMs === undefined) {
    const seconds = positiveNumber(
      nextMediaSource.durationSeconds,
      nextMediaSource.duration_seconds,
      nextMediaSource.duration,
    );
    nextMediaDurationMs = seconds === undefined ? 0 : seconds * 1000;
  }

  return {
    totemId: positiveNumber(
      data.totemId,
      data.totem_id,
      outer.totemId,
      outer.totem_id,
      source.totemId,
      source.totem_id,
      fallbackTotemId,
    ),
    mediaId: mediaId(source.mediaId, source.media_id, source.id, media.id),
    mediaName,
    mediaType:
      String(source.mediaType ?? source.media_type ?? source.type ?? media.type ?? '').trim() ||
      undefined,
    durationMs,
    startedAt,
    expectedEndAt,
    endedAt,
    playedDurationMs,
    status: String(source.status ?? playback.status ?? runtime.status ?? data.status ?? outer.status ?? 'playing'),
    stale: Boolean(source.stale ?? playback.stale ?? runtime.stale ?? data.stale ?? outer.stale ?? false),
    receivedAt: Date.now(),
    nextMedia: nextMediaId !== undefined && nextMediaName
      ? {
          id: nextMediaId,
          name: nextMediaName,
          type:
            String(nextMediaSource.type ?? nextMediaSource.mediaType ?? nextMediaSource.media_type ?? '').trim() ||
            undefined,
          durationMs: nextMediaDurationMs,
          order: positiveNumber(nextMediaSource.order),
        }
      : undefined,
  };
}

export function playbackElapsedMs(state: TotemPlaybackState, nowMs = Date.now()): number {
  if (!state.startedAt) return 0;
  const started = new Date(state.startedAt).getTime();
  if (!Number.isFinite(started)) return 0;
  return Math.min(Math.max(0, nowMs - started), Math.max(0, state.durationMs));
}

export function formatPlaybackClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatPlaybackMedia(mediaId: PlaybackMediaId | undefined, mediaName: string): string {
  return `ID ${mediaId ?? '—'} · ${mediaName}`;
}

export function formatNextMediaLine(nextMedia: TotemPlaybackNextMedia): string {
  return `Próxima: ${formatPlaybackMedia(nextMedia.id, nextMedia.name)} · ${formatPlaybackClock(nextMedia.durationMs)}`;
}

export function formatPlaybackTiming(state: TotemPlaybackState, nowMs = Date.now()): string {
  const started = state.startedAt
    ? new Date(state.startedAt).toLocaleTimeString('pt-BR', { hour12: false })
    : '--:--:--';
  if (state.status === 'ended' || state.status === 'stopped') {
    const ended = state.endedAt
      ? new Date(state.endedAt).toLocaleTimeString('pt-BR', { hour12: false })
      : '--:--:--';
    return `reproduzido ${formatPlaybackClock(
      state.playedDurationMs ?? state.durationMs,
    )} · concluído ${ended}`;
  }
  if (state.status === 'error') {
    return `erro de reprodução · iniciado ${started}`;
  }
  return `${formatPlaybackClock(playbackElapsedMs(state, nowMs))} / ${formatPlaybackClock(state.durationMs)} · iniciado ${started}`;
}

export function formatPlaybackLine(state: TotemPlaybackState, nowMs = Date.now()): string {
  const icon = state.status === 'ended' || state.status === 'stopped'
    ? '✓'
    : state.status === 'error'
      ? '⚠'
      : '▶';
  return `${icon} ${formatPlaybackMedia(state.mediaId, state.mediaName)} · ${formatPlaybackTiming(state, nowMs)}`;
}
