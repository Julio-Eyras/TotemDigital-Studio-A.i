import {
  buildMediaMetaSummary,
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
      extras: ['desabilitada neste totem'],
    });
    expect(line).toContain('#1');
    expect(line).toContain('VIDEO');
    expect(line).toContain('0:05');
    expect(line).toContain('1080×1920');
    expect(line).toContain('retrato');
    expect(line).toContain('1.02 MB');
    expect(line).toContain('desabilitada neste totem');
  });
});
