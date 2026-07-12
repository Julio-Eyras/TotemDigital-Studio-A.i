import {
  buildMediaThumbnailApiPath,
  isProtectedMediaThumbnailUrl,
  normalizePublicMediaAssetUrl,
  resolveMediaThumbnailDisplayUrl,
  resolveMediaListThumbnailUrl,
} from './mediaPreviewUrl';

describe('isProtectedMediaThumbnailUrl', () => {
  it('detecta URLs da API de thumbnail', () => {
    expect(isProtectedMediaThumbnailUrl('/api/media/12/thumbnail')).toBe(true);
    expect(isProtectedMediaThumbnailUrl('/api/media/12/thumbnail?v=3')).toBe(true);
    expect(isProtectedMediaThumbnailUrl('https://host/api/media/5/thumbnail')).toBe(true);
    expect(isProtectedMediaThumbnailUrl('/assets/foo_thumb.jpg')).toBe(false);
  });
});

describe('resolveMediaThumbnailDisplayUrl', () => {
  it('prefere blob em cache', () => {
    expect(
      resolveMediaThumbnailDisplayUrl(
        { media_id: 1, thumbnailUrl: '/api/media/1/thumbnail' },
        'blob:cached',
      ),
    ).toBe('blob:cached');
  });

  it('não expõe URL protegida da API enquanto blob não carrega', () => {
    expect(
      resolveMediaThumbnailDisplayUrl({
        media_id: 7,
        thumbnailUrl: '/api/media/7/thumbnail',
      }),
    ).toBeUndefined();
  });

  it('usa URL pública quando disponível', () => {
    expect(
      resolveMediaThumbnailDisplayUrl({
        media_id: 3,
        thumbnailUrl: '/assets/subscriber-1/video_thumb.jpg',
      }),
    ).toBe('/assets/subscriber-1/video_thumb.jpg');
  });

  it('fallback em file_path público sem media_id', () => {
    expect(
      resolveMediaThumbnailDisplayUrl({
        file_path: '/opt/smart-signage/public/assets/demo.jpg',
      }),
    ).toBe('/assets/demo.jpg');
  });
});

describe('resolveMediaListThumbnailUrl', () => {
  it('mantém compatibilidade com versão e blob', () => {
    expect(
      resolveMediaListThumbnailUrl({ media_id: 9 }, 'blob:9', 2),
    ).toBe('blob:9');
    expect(
      resolveMediaListThumbnailUrl({ media_id: 9 }, undefined, 2),
    ).toBe(buildMediaThumbnailApiPath(9, 2));
  });
});

describe('normalizePublicMediaAssetUrl', () => {
  it('normaliza caminhos legacy do servidor', () => {
    expect(normalizePublicMediaAssetUrl('/opt/smart-signage/public/assets/a.jpg')).toBe(
      '/assets/a.jpg',
    );
  });
});
