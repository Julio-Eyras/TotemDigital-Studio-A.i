import { formatTotemMediaCountLabel } from './totemMediaCountLabel';

describe('formatTotemMediaCountLabel', () => {
  it('mostra singular/plural quando active === total', () => {
    expect(formatTotemMediaCountLabel(1, 1)).toBe('1 mídia');
    expect(formatTotemMediaCountLabel(3, 3)).toBe('3 mídias');
  });

  it('mostra formato duplo quando há desabilitadas', () => {
    expect(formatTotemMediaCountLabel(2, 3)).toBe('2 ativas · 3 no totem');
    expect(formatTotemMediaCountLabel(1, 3)).toBe('1 ativa · 3 no totem');
    expect(formatTotemMediaCountLabel(0, 2)).toBe('0 ativas · 2 no totem');
  });

  it('sem total usa só active', () => {
    expect(formatTotemMediaCountLabel(2)).toBe('2 mídias');
  });
});
