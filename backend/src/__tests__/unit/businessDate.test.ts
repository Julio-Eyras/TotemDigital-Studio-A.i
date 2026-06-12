import { addCalendarDaysYmd, dateToYmd, todayYmd } from '../../utils/businessDate';

describe('businessDate (America/Sao_Paulo)', () => {
  it('preserva DATE puro', () => {
    expect(dateToYmd('2026-06-11')).toBe('2026-06-11');
  });

  it('converte timestamp UTC para calendário Brasil', () => {
    expect(dateToYmd('2026-06-12T01:12:00.000Z')).toBe('2026-06-11');
  });

  it('start_date anterior a created_at no mesmo dia civil não falha na comparação', () => {
    const createdYmd = dateToYmd('2026-06-12T01:12:00.000Z');
    const startYmd = dateToYmd('2026-06-11');
    expect(startYmd >= createdYmd).toBe(true);
  });

  it('todayYmd retorna formato válido', () => {
    expect(todayYmd()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('addCalendarDaysYmd soma dias no calendário', () => {
    expect(addCalendarDaysYmd('2026-06-11', 7)).toBe('2026-06-18');
  });
});
