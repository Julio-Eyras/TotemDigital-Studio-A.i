import {
  validatePlayerSyncEnvelope,
  validateSyncCommandResult,
} from '../../../services/playerSyncService';
import {
  mergePlaybackContextPreservingNextMedia,
  validatePlaybackBatchEvent,
} from '../../../services/playbackTelemetryService';
import { shouldPersistHeartbeatSample } from '../../../services/totemService';

describe('contrato POST /api/player/sync', () => {
  it('aceita envelope somente com eventos sem exigir heartbeat', () => {
    const result = validatePlayerSyncEnvelope({
      schemaVersion: '1',
      syncId: 'sync-123',
      events: [],
      knownPlanVersion: 'plan-v2',
    });

    expect(result.errors).toEqual([]);
    expect(result.value).toMatchObject({
      schemaVersion: '1',
      syncId: 'sync-123',
      events: [],
      knownPlanVersion: 'plan-v2',
    });
  });

  it('aceita knownPlanVersion nulo de players compatíveis e omite no valor normalizado', () => {
    const result = validatePlayerSyncEnvelope({
      schemaVersion: 1,
      syncId: 'sync-without-plan',
      heartbeat: { status: 'online' },
      knownPlanVersion: null,
    });

    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      schemaVersion: '1',
      syncId: 'sync-without-plan',
      heartbeat: { status: 'online' },
    });
  });

  it('rejeita lote acima de 50 e heartbeat inválido', () => {
    const result = validatePlayerSyncEnvelope({
      schemaVersion: 1,
      syncId: 'sync-oversized',
      events: Array.from({ length: 51 }, () => ({})),
      heartbeat: [],
    });

    expect(result.errors).toEqual([
      'heartbeat deve ser um objeto',
      'events deve ser um array com até 50 itens',
    ]);
  });

  it('valida commandResults item a item sem invalidar os demais', () => {
    expect(
      validateSyncCommandResult({ requestId: '42', status: 'completed', result: { ok: true } }, 0)
    ).toEqual({
      command: { requestId: 42, status: 'completed', result: { ok: true } },
    });
    expect(validateSyncCommandResult({ requestId: 0, status: 'done' }, 1).rejection).toEqual({
      index: 1,
      requestId: 0,
      reason: 'requestId inválido',
    });
  });

  it('aceita mídia fallback no lote e rejeita evento inválido isoladamente', () => {
    const fallback = validatePlaybackBatchEvent(
      {
        eventId: 'evt-fallback',
        bootId: 'boot-1',
        sequence: 9,
        playbackSessionId: 'session-1',
        eventType: 'image_display',
        occurredAt: '2026-08-08T12:00:00.000Z',
        media: { id: 'fb-house-ad', name: 'House ad', type: 'image' },
        playback: {},
        context: {},
      },
      0
    );
    const invalid = validatePlaybackBatchEvent({ eventId: 'bad' }, 1);

    expect(fallback.rejection).toBeUndefined();
    expect(fallback.normalizedType).toBe('media.play.started');
    expect(invalid.rejection).toMatchObject({ index: 1, eventId: 'bad' });
  });
});

describe('estado e amostragem da telemetria', () => {
  it('preserva context.nextMedia quando o evento seguinte não o informa', () => {
    expect(
      mergePlaybackContextPreservingNextMedia(
        { planVersion: 'v1', nextMedia: { id: 'media-2', name: 'Próxima' } },
        { planVersion: 'v2', screen: 'main' }
      )
    ).toEqual({
      planVersion: 'v2',
      screen: 'main',
      nextMedia: { id: 'media-2', name: 'Próxima' },
    });
  });

  it('persiste heartbeat apenas em transição ou após uma hora', () => {
    const now = new Date('2026-08-08T12:00:00.000Z');
    expect(
      shouldPersistHeartbeatSample('online', 'online', '2026-08-08T11:30:00.000Z', now)
    ).toBe(false);
    expect(
      shouldPersistHeartbeatSample('offline', 'online', '2026-08-08T11:59:00.000Z', now)
    ).toBe(true);
    expect(
      shouldPersistHeartbeatSample('online', 'online', '2026-08-08T10:59:59.000Z', now)
    ).toBe(true);
  });
});
