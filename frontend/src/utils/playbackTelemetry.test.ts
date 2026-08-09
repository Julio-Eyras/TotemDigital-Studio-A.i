import {
  formatPlaybackClock,
  formatPlaybackLine,
  formatNextMediaLine,
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
          id: 42,
          name: 'Institucional',
          type: 'video',
          durationMs: 45000,
        },
        playback: {
          startedAt: '2026-08-08T12:00:00.000Z',
          expectedEndAt: '2026-08-08T12:00:45.000Z',
        },
        context: {
          nextMedia: {
            id: 43,
            name: 'Oferta do dia',
            type: 'image',
            durationMs: 10000,
            order: 2,
          },
        },
      },
    });

    expect(state).toMatchObject({
      totemId: 7,
      mediaId: 42,
      mediaName: 'Institucional',
      mediaType: 'video',
      durationMs: 45000,
      status: 'playing',
      expectedEndAt: '2026-08-08T12:00:45.000Z',
      nextMedia: {
        id: 43,
        name: 'Oferta do dia',
        type: 'image',
        durationMs: 10000,
        order: 2,
      },
    });
    expect(formatNextMediaLine(state!.nextMedia!)).toBe('Próxima: ID 43 · Oferta do dia · 00:10');
  });

  it('normaliza IDs e próxima mídia no contrato legado snake_case', () => {
    const state = normalizePlaybackState({
      now_playing: {
        media_id: 'legacy-9',
        media_name: 'Legado atual',
        duration_seconds: 20,
        started_at: '2026-08-08T12:00:00Z',
        next_media: {
          media_id: 'legacy-10',
          media_name: 'Legado seguinte',
          media_type: 'html',
          duration_seconds: 15,
          order: 4,
        },
      },
    });

    expect(state).toMatchObject({
      mediaId: 'legacy-9',
      mediaName: 'Legado atual',
      durationMs: 20000,
      nextMedia: {
        id: 'legacy-10',
        name: 'Legado seguinte',
        type: 'html',
        durationMs: 15000,
        order: 4,
      },
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
      '▶ ID — · Vídeo · 00:12 / 00:30 · iniciado',
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

    expect(formatPlaybackLine(state)).toContain('✓ ID — · Vídeo concluído · reproduzido 00:29 · concluído');
  });

  it('prioriza o estado de tela desligada recebido no heartbeat', () => {
    const state = normalizePlaybackState({
      totemId: 9,
      playbackState: {
        status: 'ended',
        media: { id: 3, name: 'Mídia anterior', durationMs: 10000 },
      },
      displayIdle: true,
    });

    expect(state).toMatchObject({
      totemId: 9,
      mediaName: 'Tela desligada por agenda',
      status: 'display_off',
      durationMs: 0,
      stale: false,
    });
    expect(formatPlaybackLine(state!)).toContain('Aguardando o próximo horário de funcionamento');
  });

  it('remove o estado off quando a tela acorda antes da primeira mídia', () => {
    const state = normalizePlaybackState({
      totemId: 9,
      playbackState: null,
      displayIdle: false,
    });

    expect(state).toMatchObject({
      mediaName: 'Tela ligada · aguardando mídia',
      status: 'idle',
      stale: false,
    });
  });
});
