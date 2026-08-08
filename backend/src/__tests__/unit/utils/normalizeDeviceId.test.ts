import { normalizeDeviceId } from '../../../utils/normalizeDeviceId';

describe('normalizeDeviceId', () => {
  it('remove espaço externo e converte para maiúsculas', () => {
    expect(normalizeDeviceId('  tvBox-a1b2  ')).toBe('TVBOX-A1B2');
  });

  it('preserva separadores e espaços internos', () => {
    expect(normalizeDeviceId('player ad-01')).toBe('PLAYER AD-01');
  });

  it('normaliza valores ausentes para vazio', () => {
    expect(normalizeDeviceId(null)).toBe('');
    expect(normalizeDeviceId(undefined)).toBe('');
  });

  it('é idempotente', () => {
    const canonical = normalizeDeviceId(' tv-box-01 ');
    expect(normalizeDeviceId(canonical)).toBe(canonical);
  });

  it('usa uppercase Unicode de forma determinística', () => {
    expect(normalizeDeviceId('straße-01')).toBe('STRASSE-01');
  });
});
