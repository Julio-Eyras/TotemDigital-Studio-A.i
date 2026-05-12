import { normalizeTotemUin } from '../../../utils/normalizeTotemUin';

describe('normalizeTotemUin', () => {
  it('formata variante compacta TD + 8 alfanuméricos', () => {
    expect(normalizeTotemUin('td1234abcd')).toBe('TD-1234-ABCD');
    expect(normalizeTotemUin('TD-1234-ABCD')).toBe('TD-1234-ABCD');
  });

  it('remove espaços e usa hífen ASCII a partir de travessão', () => {
    expect(normalizeTotemUin('  td\u20131234\u2014abcd  ')).toBe('TD-1234-ABCD');
  });

  it('preserva identificadores que não casam o padrão TD', () => {
    expect(normalizeTotemUin('tot001')).toBe('TOT001');
    expect(normalizeTotemUin('  my-totem  ')).toBe('MY-TOTEM');
  });
});
