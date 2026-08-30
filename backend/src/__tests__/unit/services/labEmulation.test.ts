import {
  runLabAceTick,
  mockMaestroPlayerAcceptsCue,
  mockTdepPartnerAccepts,
  measureMaestroPair,
  simulateNtpExchange,
  measureSsidPair,
} from '../../../services/lab/labEmulation';
import { resetAceHintStoreForTests } from '../../../services/ace/aceHintStore';
import { resetAceAuditRingForTests } from '../../../services/ace/aceAudit';
import { AudienceContext } from '../../../services/ace/aceTypes';

function freshContext(overrides: Partial<AudienceContext> = {}): AudienceContext {
  return {
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
    session_id: 'ephemeral-8f42a1',
    ...overrides,
  };
}

const CANDIDATES = [
  { id: 'direct-local', baseWeight: 100, commercialTier: 'premium' },
  { id: 'network-std', baseWeight: 40, commercialTier: 'standard' },
  { id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' },
];

describe('emulação lab ACE → Dispatcher → FX', () => {
  beforeEach(() => {
    resetAceHintStoreForTests();
    resetAceAuditRingForTests();
  });

  it('ACE off: pesos iguais ao Direct, sem bus FX', () => {
    const r = runLabAceTick({
      aceEnabled: false,
      context: freshContext() as unknown as Record<string, unknown>,
      candidates: CANDIDATES,
    });
    expect(r.gatewayStatus).toBe('accepted');
    expect(r.hint).toBeNull();
    expect(r.fxBus).toBeNull();
    expect(r.ranked[0].id).toBe('direct-local');
    expect(r.ranked[0].weight).toBe(100);
    expect(r.auditCode).toBe('ACE_DISABLED');
  });

  it('ACE on + grupo atenção alta: PREMIUM sobe o peso; Direct continua a ganhar', () => {
    const r = runLabAceTick({
      aceEnabled: true,
      context: freshContext() as unknown as Record<string, unknown>,
      candidates: CANDIDATES,
      fxRule: { ace_category: 'PREMIUM' },
    });
    expect(r.hint?.category).toBe('PREMIUM');
    expect(r.ranked[0].id).toBe('direct-local');
    expect(r.ranked[0].weight).toBe(135);
    expect(r.fxBus?.msg_type).toBe('ace.hint');
    expect(JSON.stringify(r.fxBus)).not.toContain('ephemeral');
    expect(r.fxRuleMatched).toBe(true);
    expect(r.identityLeak).toBe(false);
  });

  it('IDENTITY_LEAK não altera ranking nem publica FX', () => {
    const r = runLabAceTick({
      aceEnabled: true,
      context: { ...freshContext(), person_id: 9 } as unknown as Record<string, unknown>,
      candidates: CANDIDATES,
    });
    expect(r.gatewayCode).toBe('IDENTITY_LEAK');
    expect(r.identityLeak).toBe(true);
    expect(r.fxBus).toBeNull();
    expect(r.ranked[0].weight).toBe(100);
  });

  it('NFC anónimo sozinho: STANDARD +20 no remnant não o faz ganhar ao Direct', () => {
    const r = runLabAceTick({
      aceEnabled: true,
      interaction: { totem_id: 41, nfc: true },
      candidates: CANDIDATES,
    });
    expect(r.interactionStatus).toBe('accepted');
    expect(r.hint?.category).toBe('STANDARD');
    expect(r.ranked.find((c) => c.id === 'fill-night')?.weight).toBe(30);
    expect(r.winnerId).toBe('direct-local');
  });

  it('FX facial/mood recusados; tag_id vira NFC sem UID no bus', () => {
    const r = runLabAceTick({
      aceEnabled: true,
      fxInteraction: {
        siteId: 'loja',
        totemId: '41',
        interactionType: 'tag_id',
        extra: { tagId: '04:LEAK' },
      },
      fxAi: { totemId: '41', eventType: 'attention', payload: { mood: 'happy' } },
      candidates: CANDIDATES,
    });
    expect(r.fxMappedStatus).toBe('ok');
    expect(r.fxAiStatus).toBe('refuse');
    expect(r.identityLeak).toBe(true);
    expect(JSON.stringify(r.fxBus)).not.toContain('04:LEAK');
    expect(r.hint?.priority_delta).toBe(20);
  });
});

describe('mocks Maestro + TDEP (sem Player-AD)', () => {
  it('player mock recusa CLOCK_DRIFT > 200 ms', () => {
    expect(mockMaestroPlayerAcceptsCue({ clock: { ntp_ok: true, drift_ms: 18 } }).accepted).toBe(
      true
    );
    expect(mockMaestroPlayerAcceptsCue({ clock: { ntp_ok: true, drift_ms: 480 } }).code).toBe(
      'CLOCK_DRIFT'
    );
  });

  it('NTP medido em 2 boxes virtuais: 18 ms aceita, 480 ms recusa, medicao ganha ao JSON', () => {
    expect(Math.round(simulateNtpExchange(18).offsetMs)).toBe(-18);
    const aligned = measureMaestroPair(18, 0);
    expect(aligned.accepted).toBe(true);
    expect(Math.abs(aligned.driftMs)).toBe(18);
    expect(
      mockMaestroPlayerAcceptsCue({
        clock: { ntp_ok: aligned.ntpOk, drift_ms: aligned.driftMs },
      }).accepted
    ).toBe(true);

    const drifted = measureMaestroPair(480, 0);
    expect(drifted.code).toBe('CLOCK_DRIFT');
    expect(
      mockMaestroPlayerAcceptsCue({
        clock: { ntp_ok: true, drift_ms: 18 },
      }).accepted
    ).toBe(true);
    expect(
      mockMaestroPlayerAcceptsCue({
        clock: { ntp_ok: drifted.ntpOk, drift_ms: drifted.driftMs },
      }).code
    ).toBe('CLOCK_DRIFT');

    expect(measureMaestroPair(0, 0, { ntpOkA: false }).code).toBe('CLOCK_DRIFT');
  });

  it('SSID de players: 5 GHz isolado aceita; Wi-Fi da loja recusa mesmo com NTP ok', () => {
    const players = { role: 'players', ssid: 'totem-players', bandGhz: 5 };
    const store = { role: 'store', ssid: 'loja-wifi', bandGhz: 2.4 };
    const ok = measureSsidPair(players, players);
    expect(ok.ok).toBe(true);
    expect(
      mockMaestroPlayerAcceptsCue({ clock: { ntp_ok: true, drift_ms: 18 } }, ok).accepted
    ).toBe(true);
    const blocked = measureSsidPair(players, store);
    expect(blocked.code).toBe('SSID_STORE');
    expect(
      mockMaestroPlayerAcceptsCue({ clock: { ntp_ok: true, drift_ms: 18 } }, blocked).code
    ).toBe('SSID_STORE');
    expect(measureSsidPair(players, { ...players, ssid: 'outro' }).code).toBe('SSID_MIXED');
    expect(measureSsidPair({ ...players, bandGhz: 2.4 }, { ...players, bandGhz: 2.4 }).code).toBe(
      'SSID_BAND'
    );
  });

  it('parceiro TDEP recusa audience/ace/mood; aceita face sem audiência', () => {
    expect(mockTdepPartnerAccepts({ schema: 'tdep/0.1', face_id: 'a' }).accepted).toBe(true);
    expect(mockTdepPartnerAccepts({ schema: 'tdep/0.1', audience: { count: 3 } }).code).toBe(
      'AUDIENCE_FORBIDDEN'
    );
    expect(mockTdepPartnerAccepts({ schema: 'tdep/0.1', ace: { hint: 'x' } }).accepted).toBe(false);
    expect(
      mockTdepPartnerAccepts({ schema: 'tdep/0.1', refuse_code: 'FORMAT_MISMATCH' }).code
    ).toBe('FORMAT_MISMATCH');
    expect(
      mockTdepPartnerAccepts({ schema: 'tdep/0.1', audio: true, face_audio: false }).code
    ).toBe('POLICY_AUDIO');
    expect(
      mockTdepPartnerAccepts({
        schema: 'tdep/0.1',
        brand_categories: ['alcohol'],
        blocked_categories: ['alcohol'],
      }).code
    ).toBe('CATEGORY_BLOCKED');
    expect(mockTdepPartnerAccepts({ schema: 'tdep/0.1', cedible: false }).code).toBe('NOT_CEDIBLE');
    expect(mockTdepPartnerAccepts({ schema: 'tdep/0.1', handshake_ok: false }).code).toBe(
      'NO_HANDSHAKE'
    );
    expect(
      mockTdepPartnerAccepts({ schema: 'tdep/0.1', handshake_ts: '2020-01-01T00:00:00.000Z' }).code
    ).toBe('HANDSHAKE_REPLAY');
    expect(
      mockTdepPartnerAccepts({
        schema: 'tdep/0.1',
        handshake_ts: new Date(Date.now() + 120_000).toISOString(),
      }).code
    ).toBe('HANDSHAKE_REPLAY');
    expect(mockTdepPartnerAccepts({ schema: 'tdep/0.1', handshake_ts: 'not-a-date' }).code).toBe(
      'HANDSHAKE_REJECTED'
    );
    expect(mockTdepPartnerAccepts({ schema: 'tdep/0.1', secret_ok: false }).code).toBe(
      'HANDSHAKE_REJECTED'
    );
    expect(mockTdepPartnerAccepts({ schema: 'tdep/0.1', handshake: 'none' }).code).toBe(
      'HANDSHAKE_REJECTED'
    );
    expect(
      mockTdepPartnerAccepts({
        schema: 'tdep/0.1',
        audio: true,
        face_audio: false,
        brand_categories: ['alcohol'],
        blocked_categories: ['alcohol'],
      }).code
    ).toBe('CATEGORY_BLOCKED');
    expect(
      mockTdepPartnerAccepts({
        schema: 'tdep/0.1',
        cedible: false,
        brand_categories: ['alcohol'],
        blocked_categories: ['alcohol'],
      }).code
    ).toBe('NOT_CEDIBLE');
  });
});
