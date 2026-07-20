import {
  buildMediaMetaSummary,
  buildMediaSizeDurationDateLine,
  formatMediaApprovalLine,
  formatMediaDate,
  formatMediaDuration,
  formatMediaFileSize,
  formatMediaOrientation,
  formatMediaResolution,
  isTotemDeliveryPendingTag,
  resolveMediaPlaybackDimensions,
} from './mediaDisplayMeta';

describe('mediaDisplayMeta', () => {
  it('formata tamanho e duração', () => {
    expect(formatMediaFileSize(1024 * 1024)).toBe('1.00 MB');
    expect(formatMediaDuration(65)).toBe('1:05');
    expect(formatMediaResolution(1080, 1920)).toBe('1080×1920');
    expect(formatMediaOrientation(1080, 1920)).toBe('retrato');
  });

  it('monta resumo com ordem e extras', () => {
    const line = buildMediaMetaSummary({
      orderIndex: 0,
      mediaType: 'video',
      durationSeconds: 5,
      width: 1080,
      height: 1920,
      sizeBytes: 1.02 * 1024 * 1024,
      includeOrientation: true,
      extras: ['desabilitada neste totem'],
    });
    expect(line).toBe('#1 · VIDEO · 1080×1920 · retrato · 1.02 MB · 0:05 · desabilitada neste totem');
  });

  it('monta linha no formato da biblioteca (sem orientação)', () => {
    expect(
      buildMediaMetaSummary({
        mediaType: 'video',
        width: 1920,
        height: 1080,
        sizeBytes: 4.54 * 1024 * 1024,
        durationSeconds: 25,
      })
    ).toBe('VIDEO · 1920×1080 · 4.54 MB · 0:25');
  });

  it('omite tamanho mas mantém duração na 1.ª linha (lista totem mobile)', () => {
    expect(
      buildMediaMetaSummary({
        mediaType: 'video',
        width: 1920,
        height: 1080,
        sizeBytes: 769.6 * 1024,
        durationSeconds: 6,
        omitFileSize: true,
      })
    ).toBe('VIDEO · 1920×1080 · 0:06');
  });

  it('omite tamanho e duração na 1.ª linha quando omitSizeAndDuration', () => {
    expect(
      buildMediaMetaSummary({
        mediaType: 'video',
        width: 1920,
        height: 1080,
        sizeBytes: 769.6 * 1024,
        durationSeconds: 6,
        omitSizeAndDuration: true,
      })
    ).toBe('VIDEO · 1920×1080');
  });

  it('resolve dimensões de playback a partir da API (source antes do bake)', () => {
    expect(
      resolveMediaPlaybackDimensions({
        width: 720,
        height: 544,
        tags: ['_totem_delivery_pending'],
      })
    ).toEqual({ width: 720, height: 544, pendingDelivery: true });
  });

  it('detecta tag de entrega pendente', () => {
    expect(isTotemDeliveryPendingTag(['_totem_delivery_pending'])).toBe(true);
    expect(isTotemDeliveryPendingTag(['promo'])).toBe(false);
  });

  it('monta 2.ª linha com tamanho, duração e data', () => {
    expect(
      buildMediaSizeDurationDateLine({
        sizeBytes: 769.6 * 1024,
        durationSeconds: 6,
        uploadedAt: '2026-07-16T12:00:00.000Z',
      })
    ).toMatch(/^769\.6 KB · 0:06 · /);
    expect(formatMediaDate('2026-07-16T12:00:00.000Z')).toMatch(/\d{2}\/\d{2}\/2026/);
  });

  it('formata aprovação', () => {
    expect(formatMediaApprovalLine('ismael', '2026-07-15T12:00:00.000Z')).toMatch(
      /^Aprovado por ismael em /
    );
    expect(formatMediaApprovalLine('', null)).toBe('');
  });
});
