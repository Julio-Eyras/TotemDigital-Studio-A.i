import { transaction } from '../config/database-pg';
import { getDatabase } from '../config/database';
import { getWebSocketService } from './websocketService';

export type PlaybackEventType =
  | 'media.play.started'
  | 'media.play.ended'
  | 'media.play.error';

export type TelemetryEventType = PlaybackEventType | 'player.observation.sample';

export interface PlaybackBatchEvent {
  eventId: string;
  bootId: string;
  sequence: number;
  playbackSessionId: string;
  eventType: string;
  occurredAt: string;
  media: {
    id: string | number | null;
    name: string;
    type: string;
    durationMs?: number | null;
  };
  playback: Record<string, unknown>;
  context: Record<string, unknown>;
  metrics?: Record<string, unknown>;
}

export interface PlaybackState {
  totemId: number;
  bootId: string;
  highestSequence: number;
  playbackSessionId: string;
  eventId: string;
  eventType: PlaybackEventType;
  status: 'playing' | 'ended' | 'error';
  occurredAt: string;
  media: {
    id: string | null;
    name: string | null;
    type: string | null;
    durationMs: number | null;
  };
  playback: Record<string, unknown>;
  context: Record<string, unknown>;
  updatedAt: string;
}

const EVENT_TYPE_ALIASES: Record<string, TelemetryEventType> = {
  'media.play.started': 'media.play.started',
  'media.play.ended': 'media.play.ended',
  'media.play.error': 'media.play.error',
  video_playback_start: 'media.play.started',
  video_playback_end: 'media.play.ended',
  video_playback_error: 'media.play.error',
  image_display: 'media.play.started',
  html_display: 'media.play.started',
  audio_playback: 'media.play.started',
  ad_display_start: 'media.play.started',
  ad_display_end: 'media.play.ended',
  playlist_start: 'media.play.started',
  playlist_end: 'media.play.ended',
  playlist_item_play: 'media.play.started',
  'player.observation.sample': 'player.observation.sample',
};

export function normalizePlaybackEventType(value: unknown): TelemetryEventType | null {
  return typeof value === 'string' ? EVENT_TYPE_ALIASES[value] || null : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function mergePlaybackContextPreservingNextMedia(
  previous: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  if (Object.prototype.hasOwnProperty.call(incoming, 'nextMedia')) return { ...incoming };
  if (Object.prototype.hasOwnProperty.call(previous, 'nextMedia')) {
    return { ...incoming, nextMedia: previous.nextMedia };
  }
  return { ...incoming };
}

export function validatePlaybackBatchEvent(
  value: unknown,
  index: number
): { event?: PlaybackBatchEvent; normalizedType?: TelemetryEventType; rejection?: any } {
  const reject = (reason: string, eventId?: unknown) => ({
    rejection: {
      index,
      eventId: typeof eventId === 'string' ? eventId : null,
      reason,
    },
  });
  if (!isObject(value)) return reject('evento deve ser um objeto');
  const eventId = value.eventId;
  if (typeof eventId !== 'string' || !eventId.trim() || eventId.length > 200) {
    return reject('eventId inválido', eventId);
  }
  if (typeof value.bootId !== 'string' || !value.bootId.trim() || value.bootId.length > 200) {
    return reject('bootId inválido', eventId);
  }
  if (!Number.isSafeInteger(value.sequence) || Number(value.sequence) < 0) {
    return reject('sequence deve ser inteiro não negativo', eventId);
  }
  if (
    typeof value.playbackSessionId !== 'string' ||
    !value.playbackSessionId.trim() ||
    value.playbackSessionId.length > 200
  ) {
    return reject('playbackSessionId inválido', eventId);
  }
  const normalizedType = normalizePlaybackEventType(value.eventType);
  if (!normalizedType) return reject('eventType inválido', eventId);
  if (typeof value.occurredAt !== 'string' || Number.isNaN(Date.parse(value.occurredAt))) {
    return reject('occurredAt deve ser uma data ISO válida', eventId);
  }
  const isObservation = normalizedType === 'player.observation.sample';
  const media = isObject(value.media)
    ? value.media
    : isObservation
      ? { id: null, name: '', type: 'observation' }
      : null;
  if (!media) return reject('media deve ser um objeto', eventId);
  if (
    media.id !== null &&
    typeof media.id !== 'string' &&
    typeof media.id !== 'number'
  ) {
    return reject('media.id inválido', eventId);
  }
  if (typeof media.name !== 'string' || typeof media.type !== 'string') {
    return reject('media.name e media.type são obrigatórios', eventId);
  }
  if (
    media.durationMs !== undefined &&
    media.durationMs !== null &&
    (!Number.isFinite(media.durationMs) || Number(media.durationMs) < 0)
  ) {
    return reject('media.durationMs inválido', eventId);
  }
  if (!isObject(value.playback)) return reject('playback deve ser um objeto', eventId);
  if (!isObject(value.context)) return reject('context deve ser um objeto', eventId);
  if (value.metrics !== undefined && !isObject(value.metrics)) {
    return reject('metrics deve ser um objeto', eventId);
  }

  return {
    event: { ...value, media } as unknown as PlaybackBatchEvent,
    normalizedType,
  };
}

function stateFromRow(row: any): PlaybackState {
  return {
    totemId: Number(row.totem_id),
    bootId: row.boot_id,
    highestSequence: Number(row.highest_sequence),
    playbackSessionId: row.playback_session_id,
    eventId: row.event_uid,
    eventType: row.event_type,
    status: row.playback_status,
    occurredAt: new Date(row.occurred_at).toISOString(),
    media: {
      id: row.media_id,
      name: row.media_name,
      type: row.media_type,
      durationMs: row.media_duration_ms == null ? null : Number(row.media_duration_ms),
    },
    playback: row.playback || {},
    context: row.context || {},
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class PlaybackTelemetryService {
  async getCurrentState(totemId: number): Promise<PlaybackState | null> {
    const row = await getDatabase().findFirst(
      `SELECT * FROM totem_playback_state WHERE totem_id = $1`,
      [totemId]
    );
    return row ? stateFromRow(row) : null;
  }

  async ingestBatch(totemId: number, values: unknown[]): Promise<{
    accepted: string[];
    duplicates: string[];
    rejected: Array<{ index: number; eventId: string | null; reason: string }>;
    highestSequence: number | null;
    serverTime: string;
  }> {
    const accepted: string[] = [];
    const duplicates: string[] = [];
    const rejected: Array<{ index: number; eventId: string | null; reason: string }> = [];
    const valid = values.flatMap((value, index) => {
      const result = validatePlaybackBatchEvent(value, index);
      if (result.rejection) {
        rejected.push(result.rejection);
        return [];
      }
      return [{ event: result.event!, eventType: result.normalizedType! }];
    });

    const transactionResult = await transaction(async (client) => {
      const states: PlaybackState[] = [];
      const observationSamples: Array<Record<string, unknown>> = [];
      for (const { event, eventType } of valid) {
        const insert = await client.query(
          `
            INSERT INTO playback_events (
              totem_id, event_uid, boot_id, sequence, playback_session_id,
              event_type, occurred_at, media_id, media_name, media_type,
              media_duration_ms, playback, context, metrics
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb)
            ON CONFLICT DO NOTHING
            RETURNING playback_event_id
          `,
          [
            totemId,
            event.eventId,
            event.bootId,
            event.sequence,
            event.playbackSessionId,
            eventType,
            event.occurredAt,
            event.media.id == null ? null : String(event.media.id),
            event.media.name,
            event.media.type,
            event.media.durationMs ?? null,
            JSON.stringify(event.playback),
            JSON.stringify(event.context),
            JSON.stringify(event.metrics || {}),
          ]
        );
        if (insert.rowCount === 0) {
          duplicates.push(event.eventId);
          continue;
        }
        accepted.push(event.eventId);

        if (eventType === 'player.observation.sample') {
          observationSamples.push({
            totemId,
            eventId: event.eventId,
            bootId: event.bootId,
            sequence: event.sequence,
            occurredAt: event.occurredAt,
            metrics: event.metrics || {},
          });
          continue;
        }

        const status =
          eventType === 'media.play.started'
            ? 'playing'
            : eventType === 'media.play.ended'
              ? 'ended'
              : 'error';
        const stateResult = await client.query(
          `
            INSERT INTO totem_playback_state (
              totem_id, boot_id, highest_sequence, playback_session_id,
              event_uid, event_type, playback_status, occurred_at,
              media_id, media_name, media_type, media_duration_ms, playback, context
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)
            ON CONFLICT (totem_id) DO UPDATE SET
              boot_id = EXCLUDED.boot_id,
              highest_sequence = EXCLUDED.highest_sequence,
              playback_session_id = EXCLUDED.playback_session_id,
              event_uid = EXCLUDED.event_uid,
              event_type = EXCLUDED.event_type,
              playback_status = EXCLUDED.playback_status,
              occurred_at = EXCLUDED.occurred_at,
              media_id = EXCLUDED.media_id,
              media_name = EXCLUDED.media_name,
              media_type = EXCLUDED.media_type,
              media_duration_ms = EXCLUDED.media_duration_ms,
              playback = EXCLUDED.playback,
              context = CASE
                WHEN EXCLUDED.context ? 'nextMedia' THEN EXCLUDED.context
                WHEN totem_playback_state.context ? 'nextMedia'
                  THEN EXCLUDED.context || jsonb_build_object(
                    'nextMedia',
                    totem_playback_state.context->'nextMedia'
                  )
                ELSE EXCLUDED.context
              END,
              updated_at = CURRENT_TIMESTAMP
            WHERE (
              totem_playback_state.boot_id = EXCLUDED.boot_id
              AND EXCLUDED.highest_sequence > totem_playback_state.highest_sequence
            ) OR (
              totem_playback_state.boot_id <> EXCLUDED.boot_id
              AND EXCLUDED.occurred_at >= totem_playback_state.occurred_at
            )
            RETURNING *
          `,
          [
            totemId,
            event.bootId,
            event.sequence,
            event.playbackSessionId,
            event.eventId,
            eventType,
            status,
            event.occurredAt,
            event.media.id == null ? null : String(event.media.id),
            event.media.name,
            event.media.type,
            event.media.durationMs ?? null,
            JSON.stringify(event.playback),
            JSON.stringify(event.context),
          ]
        );
        if (stateResult.rowCount) {
          const state = stateFromRow(stateResult.rows[0]);
          states.push(state);
          await client.query(
            `UPDATE totems SET now_playing = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE totem_id = $1`,
            [totemId, JSON.stringify(state)]
          );
        }
      }
      return { states, observationSamples };
    });

    for (const state of transactionResult.states) {
      getWebSocketService().broadcastPlaybackState(totemId, state);
    }
    for (const sample of transactionResult.observationSamples) {
      getWebSocketService().broadcastObservationSample(totemId, sample);
    }
    const current = await getDatabase().findFirst(
      `SELECT highest_sequence FROM totem_playback_state WHERE totem_id = $1`,
      [totemId]
    );
    return {
      accepted,
      duplicates,
      rejected,
      highestSequence: current ? Number(current.highest_sequence) : null,
      serverTime: new Date().toISOString(),
    };
  }

  async getObservation(totemId: number): Promise<{
    active: boolean;
    expiresAt: string | null;
    intervalSeconds: number;
  }> {
    const row = await getDatabase().findFirst(
      `SELECT expires_at, interval_seconds
       FROM telemetry_observation_leases
       WHERE totem_id = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [totemId]
    );
    return {
      active: Boolean(row),
      expiresAt: row ? new Date(row.expires_at).toISOString() : null,
      intervalSeconds: row ? Number(row.interval_seconds) : 30,
    };
  }

  async startOrRenewObservation(
    totemId: number,
    userId: number,
    ttlSeconds: number,
    intervalSeconds: number
  ) {
    await getDatabase().executeRaw(
      `
        INSERT INTO telemetry_observation_leases (
          totem_id, observer_user_id, expires_at, interval_seconds
        )
        VALUES ($1, $2, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 second'), $4)
        ON CONFLICT (totem_id) DO UPDATE SET
          observer_user_id = EXCLUDED.observer_user_id,
          expires_at = EXCLUDED.expires_at,
          interval_seconds = EXCLUDED.interval_seconds,
          renewed_at = CURRENT_TIMESTAMP
      `,
      [totemId, userId, ttlSeconds, intervalSeconds]
    );
    return this.getObservation(totemId);
  }

  async stopObservation(totemId: number): Promise<void> {
    await getDatabase().executeRaw(
      `DELETE FROM telemetry_observation_leases WHERE totem_id = $1`,
      [totemId]
    );
  }
}

let instance: PlaybackTelemetryService | null = null;
export function getPlaybackTelemetryService(): PlaybackTelemetryService {
  if (!instance) instance = new PlaybackTelemetryService();
  return instance;
}
