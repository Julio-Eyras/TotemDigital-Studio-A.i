import {
  applyTdepLane,
  isTdepFillEnabledInCapabilities,
  mergeTdepFillCapabilities,
} from '../../../services/lab/tdepDispatchLane';

const SLATE = [
  { id: 'direct-local', weight: 100, lane: 'local' as const },
  { id: 'tdep-fill', weight: 900, lane: 'tdep_fill' as const },
  { id: 'idle', weight: 1, lane: 'idle' as const },
];

describe('TDEP fill lane (lab)', () => {
  it('capabilities default off', () => {
    expect(isTdepFillEnabledInCapabilities(undefined)).toBe(false);
    expect(isTdepFillEnabledInCapabilities({})).toBe(false);
    expect(isTdepFillEnabledInCapabilities({ tdep_fill_enabled: 'true' })).toBe(false);
    expect(isTdepFillEnabledInCapabilities({ tdep_fill_enabled: true })).toBe(true);
  });

  it('off: local ganha mesmo com fill a 900', () => {
    const r = applyTdepLane(SLATE, { enabled: false, flightAccepted: true });
    expect(r.winnerId).toBe('direct-local');
    expect(r.code).toBe('TOTEMNET_OFF');
  });

  it('on: prioridade local > fill', () => {
    const r = applyTdepLane(SLATE, { enabled: true, flightAccepted: true, flightPriority: 'fill' });
    expect(r.winnerLane).toBe('local');
    expect(r.winnerId).toBe('direct-local');
  });

  it('sem local: fill ocupa idle', () => {
    const r = applyTdepLane(SLATE.filter((c) => c.id !== 'direct-local'), {
      enabled: true,
      flightAccepted: true,
    });
    expect(r.winnerLane).toBe('tdep_fill');
  });

  it('kill-switch remove o parceiro', () => {
    const r = applyTdepLane(SLATE.filter((c) => c.id !== 'direct-local'), {
      enabled: true,
      flightAccepted: true,
      killSwitch: true,
    });
    expect(r.winnerId).toBe('idle');
    expect(r.code).toBe('KILL_SWITCH');
  });

  it('mergeTdepFillCapabilities não liga com string true e preserva outras keys', () => {
    const next = mergeTdepFillCapabilities({ ace_enabled: true }, { enabled: true, capSharePct: 8 });
    expect(next.ace_enabled).toBe(true);
    expect(next.tdep_fill_enabled).toBe(true);
    expect(next.tdep_cap_share_pct).toBe(8);
    expect(mergeTdepFillCapabilities({}, { enabled: false }).tdep_fill_enabled).toBe(false);
  });
});
