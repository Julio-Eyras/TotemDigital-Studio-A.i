import { runLabSystemTick, resetLabPlayerStoreForTests, getLabNowPlaying, listLabProofs } from '../../../services/lab/labSystemTick';
import { verifyLabTdepProof } from '../../../services/lab/labTdepProof';
import { resetAceHintStoreForTests } from '../../../services/ace/aceHintStore';
import { resetAceAuditRingForTests } from '../../../services/ace/aceAudit';
import { putLabAceOptIn, putLabCapabilities } from '../../../services/lab/labCapabilitiesStore';
import { labAceIdentityLeakContext, labAceLowConfidenceContext, labAcePremiumContext, labAceStaleContext } from '../../../services/lab/labEmulation';

const PREMIUM_CTX = {
  schema: 'ace/0.1',
  context_id: '8f42a1e2-4c1a-4b9e-9d3a-0c7e1b2a9f10',
  observed_at: new Date().toISOString(),
  totem_id: 41,
  privacy: { gateway: 'ace/0.1', identity_dropped: true, image_dropped: true },
  presence: true,
  count: 3,
  group: true,
  density: 'medium',
  motion: { approaching: 2, passing: 0, stopped: 1, leaving: 0 },
  attention: 'high',
  dwell_ms: 4200,
  interaction: { touch: false, qr: false, nfc: false },
  clock: { hour_local: 18, day_of_week: 0, store_open: true },
  confidence: 0.91,
};

describe('ciclo de sistema lab (ACE + Maestro mock + TDEP mock)', () => {
  beforeEach(() => {
    resetLabPlayerStoreForTests();
    resetAceHintStoreForTests();
    resetAceAuditRingForTests();
  });

  it('default off: Direct local ganha; cue mock enviado; TDEP nem com fill a 900', () => {
    const r = runLabSystemTick({ totemId: 41 });
    expect(r.mocks.playerAd).toBe(true);
    expect(r.mocks.tvBox).toBe(true);
    expect(r.winnerId).toBe('direct-local');
    expect(r.winnerLane).toBe('local');
    expect(r.tdep.code).toBe('TOTEMNET_OFF');
    expect(r.maestro.cueSent).toBe(true);
    expect(r.nowPlaying?.mock).toBe(true);
    expect(getLabNowPlaying(41)?.itemId).toBe('direct-local');
    expect(r.proof).toBeNull();
  });

  it('ACE on sobe peso mas o cardápio local continua a ganhar ao fill TDEP', () => {
    const r = runLabSystemTick({
      totemId: 41,
      ace: { aceEnabled: true, context: PREMIUM_CTX },
      tdep: { enabled: true, flightAccepted: true },
    });
    expect(r.ace.hint?.category).toBe('PREMIUM');
    expect(r.ace.ranked[0].weight).toBe(135);
    expect(r.winnerLane).toBe('local');
    expect(r.winnerId).toBe('direct-local');
  });

  it('sem local, TDEP fill mock ocupa o idle', () => {
    const r = runLabSystemTick({
      ace: {
        aceEnabled: false,
        candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
      },
      tdep: { enabled: true, flightAccepted: true },
    });
    expect(r.winnerId).toBe('tdep-fill-mock');
    expect(r.winnerLane).toBe('tdep_fill');
    expect(r.maestro.cueSent).toBe(false);
    expect(r.proof).toBeTruthy();
    expect(verifyLabTdepProof(r.proof)).toBe(true);
    expect(JSON.stringify(r.proof)).not.toContain('audience');
    expect(listLabProofs(41).length).toBe(1);
  });

  it('dois totens mock partilham o cue local; fill gera proof por totem', () => {
    const local = runLabSystemTick({ totemIds: [41, 42] });
    expect(local.nowPlayingByTotem.map((p) => p.totemId)).toEqual([41, 42]);
    expect(local.maestro.cueSent).toBe(true);
    expect(getLabNowPlaying(42)?.itemId).toBe('direct-local');

    const fill = runLabSystemTick({
      totemIds: [41, 42],
      ace: {
        aceEnabled: false,
        candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
      },
      tdep: { enabled: true, flightAccepted: true },
    });
    expect(fill.proofs).toHaveLength(2);
    expect(fill.proofs[0].proof_id).not.toBe(fill.proofs[1].proof_id);
    expect(verifyLabTdepProof(fill.proofs[1])).toBe(true);
  });

  it('kill-switch e CLOCK_DRIFT: sem parceiro e sem cue; player mock não é o APK', () => {
    const killed = runLabSystemTick({
      ace: {
        aceEnabled: false,
        candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
      },
      tdep: { enabled: true, flightAccepted: true, killSwitch: true },
    });
    expect(killed.winnerLane).toBe('idle');
    expect(killed.tdep.code).toBe('KILL_SWITCH');

    const drift = runLabSystemTick({
      maestro: { offsetAMs: 480, offsetBMs: 0 },
    });
    expect(drift.maestro.player.code).toBe('CLOCK_DRIFT');
    expect(drift.maestro.cueSent).toBe(false);
    expect(drift.winnerLane).toBe('local');
  });

  it('parceiro TDEP com audience é recusado; SSID da loja recusa o cue', () => {
    const leak = runLabSystemTick({
      ace: {
        aceEnabled: false,
        candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
      },
      tdep: {
        enabled: true,
        flightAccepted: true,
        partnerPayload: { schema: 'tdep/0.1', audience: { count: 1 } },
      },
    });
    expect(leak.tdep.partner.code).toBe('AUDIENCE_FORBIDDEN');
    expect(leak.tdep.code).toBe('AUDIENCE_FORBIDDEN');
    expect(leak.winnerLane).not.toBe('tdep_fill');

    const wifi = runLabSystemTick({
      maestro: {
        ssidB: { role: 'store', ssid: 'loja-wifi', bandGhz: 2.4 },
      },
    });
    expect(wifi.maestro.player.code).toBe('SSID_STORE');
    expect(wifi.maestro.cueSent).toBe(false);
  });

  it('guaranteed, cap e revoke no tick: proof só no guaranteed aceite', () => {
    const idleAce = {
      aceEnabled: false as const,
      candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
    };
    const g = runLabSystemTick({
      ace: idleAce,
      tdep: { enabled: true, flightAccepted: true, flightPriority: 'guaranteed' },
    });
    expect(g.winnerId).toBe('tdep-guaranteed-mock');
    expect(g.winnerLane).toBe('tdep_guaranteed');
    expect(g.proof).toBeTruthy();
    expect(verifyLabTdepProof(g.proof)).toBe(true);

    const cap = runLabSystemTick({
      ace: idleAce,
      tdep: {
        enabled: true,
        flightAccepted: true,
        flightPriority: 'guaranteed',
        capSharePct: 10,
        shareUsedPct: 0,
        wantSharePct: 15,
      },
    });
    expect(cap.tdep.code).toBe('NO_CAPACITY');
    expect(cap.winnerLane).toBe('idle');
    expect(cap.proof).toBeNull();

    const revoked = runLabSystemTick({
      ace: idleAce,
      tdep: { enabled: true, flightAccepted: true, revoked: true },
    });
    expect(revoked.tdep.code).toBe('RIGHTS_REVOKED');
    expect(revoked.winnerLane).not.toBe('tdep_fill');
    expect(revoked.proof).toBeNull();
  });

  it('opt-in mock SQL: store liga ACE; string true não liga; leak recusa IDENTITY_LEAK', () => {
    const ctx = labAcePremiumContext(41);
    const off = runLabSystemTick({ totemId: 41, ace: { context: ctx } });
    expect(off.optIn.source).toBe('default_off');
    expect(off.optIn.aceEnabled).toBe(false);
    expect(off.ace.hint).toBeNull();
    expect(off.ace.ranked[0].weight).toBe(100);
    expect(off.winnerLane).toBe('local');

    putLabAceOptIn(41, true);
    const on = runLabSystemTick({ totemId: 41, ace: { context: labAcePremiumContext(41) } });
    expect(on.optIn.source).toBe('store');
    expect(on.optIn.aceEnabled).toBe(true);
    expect(on.ace.hint?.category).toBe('PREMIUM');
    expect(on.ace.ranked[0].weight).toBe(135);
    expect(on.winnerId).toBe('direct-local');

    putLabCapabilities(42, { ace_enabled: 'true' });
    const str = runLabSystemTick({ totemId: 42, ace: { context: labAcePremiumContext(42) } });
    expect(str.optIn.aceEnabled).toBe(false);
    expect(str.ace.ranked[0].weight).toBe(100);

    const leak = runLabSystemTick({
      totemId: 41,
      ace: { aceEnabled: true, context: labAceIdentityLeakContext(41) },
    });
    expect(leak.ace.gatewayCode).toBe('IDENTITY_LEAK');
    expect(leak.ace.identityLeak).toBe(true);
    expect(leak.ace.hint).toBeNull();
    expect(leak.winnerLane).toBe('local');
  });

  it('STALE_CONTEXT e FORMAT_MISMATCH: sem hint e sem fill', () => {
    const stale = runLabSystemTick({
      totemId: 41,
      ace: { aceEnabled: true, context: labAceStaleContext(41) },
    });
    expect(stale.ace.gatewayCode).toBe('STALE_CONTEXT');
    expect(stale.ace.hint).toBeNull();
    expect(stale.ace.ranked[0].weight).toBe(100);
    expect(stale.winnerLane).toBe('local');

    const mismatch = runLabSystemTick({
      ace: {
        aceEnabled: false,
        candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
      },
      tdep: {
        enabled: true,
        flightAccepted: true,
        partnerPayload: { schema: 'tdep/0.1', refuse_code: 'FORMAT_MISMATCH' },
      },
    });
    expect(mismatch.tdep.partner.code).toBe('FORMAT_MISMATCH');
    expect(mismatch.tdep.code).toBe('FORMAT_MISMATCH');
    expect(mismatch.winnerLane).toBe('idle');
    expect(mismatch.proof).toBeNull();
  });

  it('LOW_CONFIDENCE e POLICY_AUDIO: sem hint e sem fill', () => {
    const low = runLabSystemTick({
      totemId: 41,
      ace: { aceEnabled: true, context: labAceLowConfidenceContext(41) },
    });
    expect(low.ace.gatewayCode).toBe('LOW_CONFIDENCE');
    expect(low.ace.hint).toBeNull();
    expect(low.ace.ranked[0].weight).toBe(100);
    expect(low.winnerLane).toBe('local');

    const audio = runLabSystemTick({
      ace: {
        aceEnabled: false,
        candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
      },
      tdep: {
        enabled: true,
        flightAccepted: true,
        partnerPayload: { schema: 'tdep/0.1', audio: true, face_audio: false },
      },
    });
    expect(audio.tdep.partner.code).toBe('POLICY_AUDIO');
    expect(audio.tdep.code).toBe('POLICY_AUDIO');
    expect(audio.winnerLane).toBe('idle');
    expect(audio.proof).toBeNull();
  });

  it('CATEGORY_BLOCKED e NOT_CEDIBLE: sem fill nem proof', () => {
    const idleAce = {
      aceEnabled: false as const,
      candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
    };
    const blocked = runLabSystemTick({
      ace: idleAce,
      tdep: {
        enabled: true,
        flightAccepted: true,
        partnerPayload: {
          schema: 'tdep/0.1',
          brand_categories: ['alcohol'],
          blocked_categories: ['alcohol'],
        },
      },
    });
    expect(blocked.tdep.code).toBe('CATEGORY_BLOCKED');
    expect(blocked.winnerLane).toBe('idle');
    expect(blocked.proof).toBeNull();

    const notCedible = runLabSystemTick({
      ace: idleAce,
      tdep: {
        enabled: true,
        flightAccepted: true,
        partnerPayload: { schema: 'tdep/0.1', cedible: false },
      },
    });
    expect(notCedible.tdep.code).toBe('NOT_CEDIBLE');
    expect(notCedible.winnerLane).toBe('idle');
    expect(notCedible.proof).toBeNull();
  });

  it('NO_HANDSHAKE e HANDSHAKE_REPLAY: sem fill nem proof', () => {
    const idleAce = {
      aceEnabled: false as const,
      candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
    };
    const noHs = runLabSystemTick({
      ace: idleAce,
      tdep: {
        enabled: true,
        flightAccepted: true,
        partnerPayload: { schema: 'tdep/0.1', handshake_ok: false },
      },
    });
    expect(noHs.tdep.code).toBe('NO_HANDSHAKE');
    expect(noHs.winnerLane).toBe('idle');
    expect(noHs.proof).toBeNull();

    const replay = runLabSystemTick({
      ace: idleAce,
      tdep: {
        enabled: true,
        flightAccepted: true,
        partnerPayload: { schema: 'tdep/0.1', handshake_ts: '2020-01-01T00:00:00.000Z' },
      },
    });
    expect(replay.tdep.code).toBe('HANDSHAKE_REPLAY');
    expect(replay.winnerLane).toBe('idle');
    expect(replay.proof).toBeNull();
  });
});
