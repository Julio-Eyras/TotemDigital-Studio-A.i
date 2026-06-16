import {
  resolveDispatchItemDurationSeconds,
  resolvePlanTotalItemSeconds,
  sumDispatchMediaItemsPlanDuration,
  DEFAULT_IMAGE_DISPLAY_SECONDS,
  DEFAULT_HTML_DISPLAY_SECONDS,
  DEFAULT_MEDIA_FALLBACK_SECONDS,
} from '../../../utils/dispatchItemDuration';

describe('resolveDispatchItemDurationSeconds', () => {
  it('vídeo retorna null (duração real no player)', () => {
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: 5,
        mediaType: 'video',
        mediaDurationSeconds: 42,
      })
    ).toBeNull();
  });

  it('vídeo sem duration_seconds também retorna null', () => {
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: 99,
        mediaType: 'video',
        mediaDurationSeconds: 0,
      })
    ).toBeNull();
  });

  it('áudio retorna null', () => {
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: 1,
        mediaType: 'audio',
        mediaDurationSeconds: 120,
      })
    ).toBeNull();
  });

  it('imagem usa display_seconds quando > 0', () => {
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: 8,
        mediaType: 'image',
        mediaDurationSeconds: 3600,
      })
    ).toBe(8);
  });

  it('html usa 60s por padrão para permitir poll do cardápio ao vivo', () => {
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: 0,
        mediaType: 'html',
        mediaDurationSeconds: null,
      })
    ).toBe(DEFAULT_HTML_DISPLAY_SECONDS);
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: 12,
        mediaType: 'html',
        mediaDurationSeconds: null,
      })
    ).toBe(DEFAULT_HTML_DISPLAY_SECONDS);
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: 90,
        mediaType: 'html',
        mediaDurationSeconds: null,
      })
    ).toBe(90);
  });

  it('imagem com display_seconds 0 ou null usa default (ignora duration_seconds)', () => {
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: 0,
        mediaType: 'image',
        mediaDurationSeconds: 3600,
      })
    ).toBe(DEFAULT_IMAGE_DISPLAY_SECONDS);
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: undefined,
        mediaType: 'image',
        mediaDurationSeconds: 99,
      })
    ).toBe(DEFAULT_IMAGE_DISPLAY_SECONDS);
  });
});

describe('resolvePlanTotalItemSeconds', () => {
  it('vídeo usa duration_seconds do ficheiro para total do plano', () => {
    expect(
      resolvePlanTotalItemSeconds({
        displaySeconds: 5,
        mediaType: 'video',
        mediaDurationSeconds: 42,
      })
    ).toBe(42);
  });

  it('vídeo sem duration_seconds usa fallback no total', () => {
    expect(
      resolvePlanTotalItemSeconds({
        displaySeconds: undefined,
        mediaType: 'video',
        mediaDurationSeconds: 0,
      })
    ).toBe(DEFAULT_MEDIA_FALLBACK_SECONDS);
  });
});

describe('sumDispatchMediaItemsPlanDuration', () => {
  it('soma exposure em imagem e durationSeconds em metadata para vídeo', () => {
    expect(
      sumDispatchMediaItemsPlanDuration([
        { duration: 15, mediaType: 'image' },
        { duration: null, mediaType: 'video', metadata: { durationSeconds: 120 } },
      ])
    ).toBe(135);
  });
});
