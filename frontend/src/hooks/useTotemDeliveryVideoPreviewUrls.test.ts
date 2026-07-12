import {
  shouldUseTotemDeliveryVideoPreview,
  TOTEM_VIDEO_PREVIEW_MAX_BYTES,
} from './useTotemDeliveryVideoPreviewUrls';

describe('shouldUseTotemDeliveryVideoPreview', () => {
  it('aceita vídeo landscape / 1920×1080 dentro do limite', () => {
    expect(
      shouldUseTotemDeliveryVideoPreview({
        media_type: 'video',
        width: 1920,
        height: 1080,
        size_bytes: 5_000_000,
      }),
    ).toBe(true);
  });

  it('aceita vídeo entrega totem mesmo sem size_bytes na API', () => {
    expect(
      shouldUseTotemDeliveryVideoPreview({
        media_type: 'video',
        width: 1920,
        height: 1080,
      }),
    ).toBe(true);
  });

  it('rejeita imagem, portrait e ficheiros grandes', () => {
    expect(
      shouldUseTotemDeliveryVideoPreview({
        media_type: 'image',
        width: 1920,
        height: 1080,
      }),
    ).toBe(false);
    expect(
      shouldUseTotemDeliveryVideoPreview({
        media_type: 'video',
        width: 1080,
        height: 1920,
      }),
    ).toBe(false);
    expect(
      shouldUseTotemDeliveryVideoPreview({
        media_type: 'video',
        width: 1920,
        height: 1080,
        size_bytes: TOTEM_VIDEO_PREVIEW_MAX_BYTES + 1,
      }),
    ).toBe(false);
  });
});
