import {
  buildLabTickBody,
  parseLabTotemId,
  summarizeLabTick,
} from './labSystemTick';

describe('labSystemTick payloads (lab UI)', () => {
  it('parseLabTotemId recusa 0 e lixo', () => {
    expect(parseLabTotemId(41)).toBe(41);
    expect(parseLabTotemId('42')).toBe(42);
    expect(parseLabTotemId(0)).toBe(41);
    expect(parseLabTotemId('x')).toBe(41);
  });

  it('default off não liga TDEP', () => {
    const body = buildLabTickBody('default_off', 41);
    expect(body.totemId).toBe(41);
    expect(body.tdep).toBeUndefined();
  });

  it('fill e guaranteed no idle', () => {
    const fill = buildLabTickBody('fill_idle', 7);
    expect(fill.tdep?.enabled).toBe(true);
    expect(fill.tdep?.flightPriority).toBeUndefined();
    expect(fill.ace?.candidates[0].commercialTier).toBe('remnant');

    const g = buildLabTickBody('guaranteed_idle', 7);
    expect(g.tdep?.flightPriority).toBe('guaranteed');
  });

  it('cap, revoke, drift e dois totens', () => {
    const cap = buildLabTickBody('no_capacity');
    expect(cap.tdep?.wantSharePct).toBe(15);
    expect(cap.tdep?.capSharePct).toBe(10);

    expect(buildLabTickBody('revoked').tdep?.revoked).toBe(true);
    expect(buildLabTickBody('clock_drift').maestro?.offsetAMs).toBe(480);

    const pair = buildLabTickBody('two_totems', 41);
    expect(pair.totemIds).toEqual([41, 42]);
    expect(pair.tdep?.enabled).toBe(true);
  });

  it('ACE opt-in e IDENTITY_LEAK no payload', () => {
    const optin = buildLabTickBody('ace_optin', 41);
    expect(optin.ace?.aceEnabled).toBeUndefined();
    expect(optin.ace?.context?.person_id).toBeUndefined();
    expect(optin.ace?.context?.schema).toBe('ace/0.1');

    const leak = buildLabTickBody('identity_leak', 41);
    expect(leak.ace?.aceEnabled).toBe(true);
    expect(leak.ace?.context?.person_id).toBe(123);
  });

  it('STALE_CONTEXT e FORMAT_MISMATCH no payload', () => {
    const stale = buildLabTickBody('stale_context', 41);
    expect(stale.ace?.aceEnabled).toBe(true);
    const observed = Date.parse(String(stale.ace?.context?.observed_at || ''));
    expect(Date.now() - observed).toBeGreaterThan(3000);

    const mismatch = buildLabTickBody('format_mismatch', 41);
    expect(mismatch.tdep?.partnerPayload?.refuse_code).toBe('FORMAT_MISMATCH');
    expect(mismatch.ace?.candidates?.[0].commercialTier).toBe('remnant');
  });

  it('LOW_CONFIDENCE e POLICY_AUDIO no payload', () => {
    const low = buildLabTickBody('low_confidence', 41);
    expect(low.ace?.aceEnabled).toBe(true);
    expect(Number(low.ace?.context?.confidence)).toBeLessThan(0.5);

    const audio = buildLabTickBody('policy_audio', 41);
    expect(audio.tdep?.partnerPayload?.audio).toBe(true);
    expect(audio.tdep?.partnerPayload?.face_audio).toBe(false);
  });

  it('CATEGORY_BLOCKED e NOT_CEDIBLE no payload', () => {
    const blocked = buildLabTickBody('category_blocked', 41);
    expect(blocked.tdep?.partnerPayload?.brand_categories).toEqual(['alcohol']);
    expect(blocked.tdep?.partnerPayload?.blocked_categories).toEqual(['alcohol']);

    const notCedible = buildLabTickBody('not_cedible', 41);
    expect(notCedible.tdep?.partnerPayload?.cedible).toBe(false);
  });

  it('NO_HANDSHAKE e HANDSHAKE_REPLAY no payload', () => {
    const noHs = buildLabTickBody('no_handshake', 41);
    expect(noHs.tdep?.partnerPayload?.handshake_ok).toBe(false);

    const replay = buildLabTickBody('handshake_replay', 41);
    expect(replay.tdep?.partnerPayload?.handshake_ts).toBe('2020-01-01T00:00:00.000Z');
  });

  it('summarizeLabTick extrai proof e códigos', () => {
    const s = summarizeLabTick({
      winnerId: 'tdep-fill-mock',
      winnerLane: 'tdep_fill',
      tdep: { code: null },
      maestro: { cueSent: false, player: { code: null } },
      proof: { seller_sig: 'abc' },
      nowPlayingByTotem: [{ totemId: 41 }, { totemId: 42 }],
      optIn: { aceEnabled: true, source: 'store' },
      ace: { gatewayCode: null, identityLeak: false, hint: { category: 'PREMIUM' } },
    });
    expect(s.proofSig).toBe('abc');
    expect(s.totemCount).toBe(2);
    expect(s.aceEnabled).toBe(true);
    expect(s.hintCategory).toBe('PREMIUM');
    expect(summarizeLabTick(null).winnerId).toBeNull();
  });
});
