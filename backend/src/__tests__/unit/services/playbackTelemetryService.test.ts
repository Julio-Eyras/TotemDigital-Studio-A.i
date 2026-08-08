import {
  normalizePlaybackEventType,
  validatePlaybackBatchEvent,
} from '../../../services/playbackTelemetryService';
import { dispatcherDebugService } from '../../../services/dispatcherDebugService';

describe('playback telemetry contract', () => {
  afterEach(() => dispatcherDebugService.clearLogs());

  it('normaliza nomes v2 e legados, inclusive html_display', () => {
    expect(normalizePlaybackEventType('media.play.started')).toBe('media.play.started');
    expect(normalizePlaybackEventType('video_playback_end')).toBe('media.play.ended');
    expect(normalizePlaybackEventType('video_playback_error')).toBe('media.play.error');
    expect(normalizePlaybackEventType('html_display')).toBe('media.play.started');
  });

  it('valida o contrato com os nomes exatos', () => {
    const result = validatePlaybackBatchEvent(
      {
        eventId: 'evt-1',
        bootId: 'boot-1',
        sequence: 7,
        playbackSessionId: 'session-1',
        eventType: 'media.play.started',
        occurredAt: '2026-08-08T12:00:00.000Z',
        media: { id: 10, name: 'Institucional', type: 'video', durationMs: 15000 },
        playback: { positionMs: 0 },
        context: { planVersion: 'v1' },
      },
      0
    );

    expect(result.rejection).toBeUndefined();
    expect(result.normalizedType).toBe('media.play.started');
  });

  it('aceita amostra de observação sem mídia durante lease ativo', () => {
    const result = validatePlaybackBatchEvent(
      {
        eventId: 'obs-1',
        bootId: 'boot-1',
        sequence: 8,
        playbackSessionId: 'boot-1',
        eventType: 'player.observation.sample',
        occurredAt: '2026-08-08T12:00:05.000Z',
        playback: { source: 'heartbeat_observation' },
        context: {},
        metrics: { memoryAvailableMb: 512 },
      },
      0
    );

    expect(result.rejection).toBeUndefined();
    expect(result.normalizedType).toBe('player.observation.sample');
    expect(result.event?.media).toEqual({ id: null, name: '', type: 'observation' });
  });

  it('rejeita sequência inválida sem rejeitar o lote inteiro', () => {
    const result = validatePlaybackBatchEvent(
      {
        eventId: 'evt-bad',
        bootId: 'boot-1',
        sequence: -1,
        playbackSessionId: 'session-1',
        eventType: 'media.play.started',
        occurredAt: '2026-08-08T12:00:00.000Z',
        media: { id: null, name: 'HTML', type: 'html' },
        playback: {},
        context: {},
      },
      3
    );

    expect(result.rejection).toEqual({
      index: 3,
      eventId: 'evt-bad',
      reason: 'sequence deve ser inteiro não negativo',
    });
  });

  it('filtra debug por trace, evento, mídia e status', () => {
    dispatcherDebugService.logMessage('incoming', {
      traceId: 'trace-1',
      eventType: 'media.play.started',
      mediaName: 'Campanha Verão',
      endpoint: '/api/player/events/batch',
    });
    dispatcherDebugService.logMessage('outgoing', {
      traceId: 'trace-1',
      eventType: 'media.play.started',
      mediaName: 'Campanha Verão',
      endpoint: '/api/player/events/batch',
      statusCode: 200,
      duration: 12,
    });

    const logs = dispatcherDebugService.getMessageLogs(100, undefined, undefined, undefined, {
      traceId: 'trace-1',
      direction: 'outgoing',
      eventType: 'media.play.started',
      mediaName: 'verão',
      statusCode: 200,
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ traceId: 'trace-1', direction: 'outgoing', duration: 12 });
  });
});
