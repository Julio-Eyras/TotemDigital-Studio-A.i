import {
  isDisplayActiveNow,
  mergePlayerSettingsWithDisplaySchedule,
  normalizeDisplaySchedule,
  validateDisplayScheduleInput,
} from '../../utils/displaySchedule';

describe('displaySchedule', () => {
  it('valida onTime/offTime', () => {
    expect(validateDisplayScheduleInput({ onTime: '25:00' })).toMatch(/onTime/);
    expect(validateDisplayScheduleInput({ onTime: '08:00', offTime: '08:00' })).toMatch(/iguais/);
    expect(validateDisplayScheduleInput({ onTime: '08:00', offTime: '22:00' })).toBeNull();
  });

  it('merge preserva campos e normaliza', () => {
    const next = mergePlayerSettingsWithDisplaySchedule(
      { displayRotation: 1 },
      { enabled: true, onTime: '09:00', offTime: '18:00', daysOfWeek: [1, 2, 3] }
    );
    expect(next.displayRotation).toBe(1);
    const ds = normalizeDisplaySchedule(next.displaySchedule);
    expect(ds.enabled).toBe(true);
    expect(ds.onTime).toBe('09:00');
    expect(ds.daysOfWeek).toEqual([1, 2, 3]);
  });

  it('intervalo diurno e overnight', () => {
    const day = normalizeDisplaySchedule({
      enabled: true,
      timezone: 'UTC',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      onTime: '08:00',
      offTime: '22:00',
    });
    // 12:00 UTC
    expect(isDisplayActiveNow(day, new Date('2026-07-22T12:00:00Z'))).toBe(true);
    // 23:00 UTC
    expect(isDisplayActiveNow(day, new Date('2026-07-22T23:00:00Z'))).toBe(false);

    const night = normalizeDisplaySchedule({
      enabled: true,
      timezone: 'UTC',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      onTime: '22:00',
      offTime: '06:00',
    });
    expect(isDisplayActiveNow(night, new Date('2026-07-22T23:00:00Z'))).toBe(true);
    expect(isDisplayActiveNow(night, new Date('2026-07-22T03:00:00Z'))).toBe(true);
    expect(isDisplayActiveNow(night, new Date('2026-07-22T12:00:00Z'))).toBe(false);
  });

  it('forceMode prevalece', () => {
    const off = normalizeDisplaySchedule({
      enabled: true,
      forceMode: 'off',
      onTime: '00:00',
      offTime: '23:59',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      timezone: 'UTC',
    });
    expect(isDisplayActiveNow(off, new Date('2026-07-22T12:00:00Z'))).toBe(false);
  });
});
