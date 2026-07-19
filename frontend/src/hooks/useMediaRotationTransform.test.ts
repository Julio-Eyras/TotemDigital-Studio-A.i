import {
  filterUserVisibleMediaTags,
  getMediaUiPreviewUndoRotation,
  isThumbnailApiUrl,
  isTotemDeliveryMedia,
  mediaLibraryPreviewSx,
  mediaTotemHoverVideoSx,
  mediaThumbnailPortraitPreviewSx,
  normalizeMediaRotation,
  parseDeliveryRotationFromTags,
  resolveTotemDeliveryUiRotation,
} from './useMediaRotationTransform';

describe('normalizeMediaRotation', () => {
  it('normaliza graus para 0–359', () => {
    expect(normalizeMediaRotation(270)).toBe(270);
    expect(normalizeMediaRotation(-90)).toBe(270);
    expect(normalizeMediaRotation(450)).toBe(90);
  });
});

describe('parseDeliveryRotationFromTags', () => {
  it('lê tag _delivery_rotation', () => {
    expect(parseDeliveryRotationFromTags(['foo', '_delivery_rotation:90'])).toBe(90);
    expect(parseDeliveryRotationFromTags(['_delivery_rotation:180'])).toBe(180);
    expect(parseDeliveryRotationFromTags(['foo'])).toBeNull();
  });
});

describe('filterUserVisibleMediaTags', () => {
  it('oculta metadados técnicos de entrega', () => {
    expect(
      filterUserVisibleMediaTags(['promo', '_delivery_rotation:90', '_totem_delivery_pending'])
    ).toEqual(['promo']);
  });
});

describe('getMediaUiPreviewUndoRotation', () => {
  it('usa deliveryPreviewRotation da API quando presente', () => {
    expect(getMediaUiPreviewUndoRotation({ deliveryPreviewRotation: 270 })).toBe(270);
  });

  it('calcula undo a partir de deliveryRotation', () => {
    expect(getMediaUiPreviewUndoRotation({ deliveryRotation: 90 })).toBe(270);
  });

  it('calcula undo a partir da tag', () => {
    expect(getMediaUiPreviewUndoRotation({ tags: ['_delivery_rotation:180'] })).toBe(180);
  });
});

describe('mediaLibraryPreviewSx', () => {
  const deliveryMedia = {
    width: 1920,
    height: 1080,
    deliveryRotation: 90,
    deliveryPreviewRotation: 270,
  };

  it('thumbnail blob não aplica undo de entrega totem', () => {
    const sx = mediaLibraryPreviewSx(0, deliveryMedia, {
      previewUrl: 'blob:thumb',
      previewSource: 'thumbnail',
    });
    expect(sx).toEqual(mediaThumbnailPortraitPreviewSx(0));
    expect(sx.objectFit).toBe('contain');
    expect(sx.maxWidth).toBe('100%');
    expect(sx.maxHeight).toBe('100%');
    expect(String(sx.transform || '')).not.toContain('rotate');
  });

  it('ficheiro de entrega aplica rotação CSS de undo', () => {
    const sx = mediaLibraryPreviewSx(0, deliveryMedia, {
      previewUrl: '/assets/video.mp4',
      previewSource: 'delivery',
    });
    expect(sx.transform).toContain('rotate(270deg)');
    expect(sx.width).toBe('177.778%');
    expect(sx.height).toBe('56.25%');
  });
});

describe('mediaTotemHoverVideoSx', () => {
  it('vídeo entrega usa contain + caixa 16:9 lateral (sem quadrado esticado)', () => {
    const sx = mediaTotemHoverVideoSx(0, {
      width: 1920,
      height: 1080,
      deliveryPreviewRotation: 270,
    });
    expect(sx.objectFit).toBe('contain');
    expect(sx.transform).toContain('rotate(270deg)');
    expect(sx.width).toBe('177.778%');
    expect(sx.height).toBe('56.25%');
  });

  it('bake v3+ landscape fica contain centrado sem rotação de undo', () => {
    const sx = mediaTotemHoverVideoSx(0, {
      width: 1920,
      height: 1080,
      tags: ['_delivery_bake:4', '_delivery_rotation:0'],
      deliveryRotation: 0,
    });
    expect(sx.objectFit).toBe('contain');
    expect(sx.maxWidth).toBe('100%');
    expect(sx.maxHeight).toBe('100%');
    expect(String(sx.transform || '')).not.toContain('rotate');
  });
});

describe('isTotemDeliveryMedia', () => {
  it('identifica entrega 1920×1080 e 1080×1920; landscape genérico só com tag', () => {
    expect(isTotemDeliveryMedia({ width: 1920, height: 1080 })).toBe(true);
    expect(isTotemDeliveryMedia({ width: 1280, height: 720 })).toBe(false);
    expect(
      isTotemDeliveryMedia({ width: 1280, height: 720, tags: ['_delivery_rotation:90'] })
    ).toBe(true);
    expect(isTotemDeliveryMedia({ width: 1080, height: 1920 })).toBe(true);
    expect(
      isTotemDeliveryMedia({
        width: 1920,
        height: 1080,
        tags: ['_totem_delivery_pending'],
      })
    ).toBe(false);
  });
});

describe('isThumbnailApiUrl', () => {
  it('distingue URL de thumbnail da API', () => {
    expect(isThumbnailApiUrl('/api/media/4/thumbnail')).toBe(true);
    expect(isThumbnailApiUrl('/assets/x_thumb.jpg')).toBe(false);
  });
});

describe('resolveTotemDeliveryUiRotation', () => {
  it('soma draft do utilizador com undo de entrega', () => {
    expect(
      resolveTotemDeliveryUiRotation(90, {
        width: 1920,
        height: 1080,
        deliveryPreviewRotation: 270,
      }),
    ).toBe(0);
  });
});
