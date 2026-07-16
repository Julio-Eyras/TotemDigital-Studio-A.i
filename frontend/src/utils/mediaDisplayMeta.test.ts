import {
  buildMediaMetaSummary,
  formatMediaApprovalLine,
  formatMediaDuration,
  formatMediaFileSize,
  formatMediaOrientation,
  formatMediaResolution,
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

  it('formata aprovação', () => {
    expect(formatMediaApprovalLine('ismael', '2026-07-15T12:00:00.000Z')).toMatch(
      /^Aprovado por ismael em /
    );
    expect(formatMediaApprovalLine('', null)).toBe('');
  });
});
