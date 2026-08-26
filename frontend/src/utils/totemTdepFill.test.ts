import { readTdepFillFromTotem, tdepFillPayload } from './totemTdepFill';

describe('totemTdepFill', () => {
  it('default off quando capabilities vazias', () => {
    expect(readTdepFillFromTotem(null).enabled).toBe(false);
    expect(readTdepFillFromTotem({}).enabled).toBe(false);
    expect(readTdepFillFromTotem({ capabilities: { tdep_fill_enabled: 'true' } }).enabled).toBe(false);
  });

  it('lê tdep_fill_enabled true', () => {
    expect(readTdepFillFromTotem({ capabilities: { tdep_fill_enabled: true } }).enabled).toBe(true);
  });

  it('lê kill-switch aninhado', () => {
    expect(
      readTdepFillFromTotem({ capabilities: { tdep: { fill_enabled: true, kill_switch: true } } }).killSwitch
    ).toBe(true);
  });

  it('payload clamp do cap a 1–10', () => {
    expect(tdepFillPayload({ enabled: true, killSwitch: false, capSharePct: 99 }).capSharePct).toBe(10);
    expect(tdepFillPayload({ enabled: false, killSwitch: true, capSharePct: 0 }).capSharePct).toBe(1);
  });
});
