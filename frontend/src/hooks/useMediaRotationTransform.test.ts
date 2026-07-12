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
    expect(filterUserVisibleMediaTags(['promo', '_delivery_rotation:90'])).toEqual(['promo']);
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

describe('isTotemDeliveryMedia', () => {
  it('identifica ficheiro 1920×1080 e landscape genérico', () => {
    expect(isTotemDeliveryMedia({ width: 1920, height: 1080 })).toBe(true);
    expect(isTotemDeliveryMedia({ width: 1280, height: 720 })).toBe(true);
    expect(isTotemDeliveryMedia({ width: 1080, height: 1920 })).toBe(false);
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
    expect(sx.transform).toBeUndefined();
  });

  it('ficheiro de entrega aplica rotação CSS de undo', () => {
    const sx = mediaLibraryPreviewSx(0, deliveryMedia, {
      previewUrl: '/assets/video.mp4',
      previewSource: 'delivery',
    });
    expect(sx.transform).toContain('rotate(270deg)');
  });
});

describe('mediaTotemHoverVideoSx', () => {
  it('vídeo entrega usa contain + rotação lateral', () => {
    const sx = mediaTotemHoverVideoSx(0, {
      width: 1920,
      height: 1080,
      deliveryPreviewRotation: 270,
    });
    expect(sx.objectFit).toBe('contain');
    expect(sx.transform).toContain('rotate(270deg)');
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
