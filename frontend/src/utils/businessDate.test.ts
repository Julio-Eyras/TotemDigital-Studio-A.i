import {
  dateToYmd,
  formatDateForApi,
  formatDateForInput,
  getDefaultContractStartDate,
  todayYmd,
} from './businessDate';

describe('businessDate (frontend, America/Sao_Paulo)', () => {
  it('preserva DATE puro', () => {
    expect(dateToYmd('2026-06-11')).toBe('2026-06-11');
  });

  it('converte timestamp UTC para dia civil Brasil', () => {
    expect(dateToYmd('2026-06-12T01:12:00.000Z')).toBe('2026-06-11');
  });

  it('preserva DATE Postgres serializado como meia-noite UTC', () => {
    expect(dateToYmd('2026-06-12T00:00:00.000Z')).toBe('2026-06-12');
    expect(formatDateForInput('2026-06-12T00:00:00.000Z')).toBe('2026-06-12');
  });

  it('formatDateForInput espelha dateToYmd', () => {
    expect(formatDateForInput('2026-06-11')).toBe('2026-06-11');
  });

  it('getDefaultContractStartDate retorna yyyy-mm-dd', () => {
    expect(getDefaultContractStartDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formatDateForApi preserva dia civil', () => {
    expect(formatDateForApi('2026-06-11')).toBe('2026-06-11T12:00:00-03:00');
    expect(formatDateForApi('2026-06-12T01:12:00.000Z')).toBe('2026-06-11T12:00:00-03:00');
  });

  it('todayYmd retorna formato válido', () => {
    expect(todayYmd()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
