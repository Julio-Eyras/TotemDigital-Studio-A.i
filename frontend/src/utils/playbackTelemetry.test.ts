import {
  formatPlaybackClock,
  formatPlaybackLine,
  normalizePlaybackState,
  playbackElapsedMs,
} from './playbackTelemetry';

describe('playbackTelemetry', () => {
  it('normaliza evento websocket com runtime', () => {
    const state = normalizePlaybackState({
      type: 'totem_playback_state',
      data: {
        totemId: 12,
        nowPlaying: {
          mediaName: 'Campanha verão',
          mediaType: 'video',
          durationMs: 30000,
          startedAt: '2026-08-08T12:00:00.000Z',
          status: 'playing',
          stale: false,
        },
      },
    });
    expect(state).toMatchObject({
      totemId: 12,
      mediaName: 'Campanha verão',
      mediaType: 'video',
      durationMs: 30000,
      status: 'playing',
      stale: false,
      expectedEndAt: '2026-08-08T12:00:30.000Z',
    });
  });

  it('aceita fallback legado em snake_case', () => {
    const state = normalizePlaybackState({
      media_name: 'Imagem institucional',
      media_type: 'image',
      duration_seconds: 10,
      started_at: '2026-08-08T12:00:00Z',
    }, 5);
    expect(state?.totemId).toBe(5);
    expect(state?.durationMs).toBe(10000);
  });

  it('normaliza o estado quente emitido pelo backend', () => {
    const state = normalizePlaybackState({
      type: 'totem_playback_state',
      data: {
        totemId: 7,
        status: 'playing',
        media: {
          id: '42',
          name: 'Institucional',
          type: 'video',
          durationMs: 45000,
        },
        playback: {
          startedAt: '2026-08-08T12:00:00.000Z',
          expectedEndAt: '2026-08-08T12:00:45.000Z',
        },
      },
    });

    expect(state).toMatchObject({
      totemId: 7,
      mediaName: 'Institucional',
      mediaType: 'video',
      durationMs: 45000,
      status: 'playing',
      expectedEndAt: '2026-08-08T12:00:45.000Z',
    });
  });

  it('calcula e limita o progresso somente pelo relógio local', () => {
    const state = normalizePlaybackState({
      mediaName: 'Vídeo',
      durationMs: 30000,
      startedAt: '2026-08-08T12:00:00Z',
    })!;
    expect(playbackElapsedMs(state, Date.parse('2026-08-08T12:00:12Z'))).toBe(12000);
    expect(playbackElapsedMs(state, Date.parse('2026-08-08T12:01:00Z'))).toBe(30000);
    expect(formatPlaybackClock(12000)).toBe('00:12');
    expect(formatPlaybackLine(state, Date.parse('2026-08-08T12:00:12Z'))).toContain(
      '▶ Vídeo · 00:12/00:30 · iniciado',
    );
  });

  it('apresenta objetivamente o término da reprodução', () => {
    const state = normalizePlaybackState({
      mediaName: 'Vídeo concluído',
      durationMs: 30000,
      status: 'ended',
      playback: {
        playedDurationMs: 29500,
        endedAt: '2026-08-08T12:00:30Z',
      },
    })!;

    expect(formatPlaybackLine(state)).toContain('✓ Vídeo concluído · reproduzido 00:29 · concluído');
  });
});
