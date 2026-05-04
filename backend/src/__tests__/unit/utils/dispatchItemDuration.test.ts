import {
  resolveDispatchItemDurationSeconds,
  DEFAULT_IMAGE_DISPLAY_SECONDS,
  DEFAULT_MEDIA_FALLBACK_SECONDS,
} from '../../../utils/dispatchItemDuration';

describe('resolveDispatchItemDurationSeconds', () => {
  it('vídeo ignora display_seconds e usa duration_seconds', () => {
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: 5,
        mediaType: 'video',
        mediaDurationSeconds: 42,
      })
    ).toBe(42);
  });

  it('vídeo sem duration_seconds válida usa fallback', () => {
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: 99,
        mediaType: 'video',
        mediaDurationSeconds: 0,
      })
    ).toBe(DEFAULT_MEDIA_FALLBACK_SECONDS);
  });

  it('áudio trata como vídeo', () => {
    expect(
      resolveDispatchItemDurationSeconds({
        displaySeconds: 1,
        mediaType: 'audio',
        mediaDurationSeconds: 120,
      })
    ).toBe(120);
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
