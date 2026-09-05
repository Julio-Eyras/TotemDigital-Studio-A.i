/**
 * Testes unitários ACE Rule Engine + Gateway + FX timeline stable hash — SPRINT 4.
 *
 * Todos são PUROS (sem DB, sem Redis, sem Bull). Cobrem:
 *  A1-A6    aceContextToHint regras
 *  W1-W3    applyAceHintToWeight (incl. tiers PREMIUM / remnant)
 *  C1-C2    shouldUseDispatchPlanCache e isAceEnabledInCapabilities
 *  G1-G5    aceGatewayDecide (privacy gates LGPD + TOTEM local policy)
 *  F1-F2    computeFxTimelineVersionHash (estabilidade vs transient fields)
 */

import {
  aceContextToHint,
  applyAceHintToWeight,
  isAceEnabledInCapabilities,
  shouldUseDispatchPlanCache,
} from '../../../services/ace/aceRuleEngine';
import { aceGatewayDecide } from '../../../services/ace/aceGateway';
import { AudienceContext } from '../../../services/ace/aceTypes';
import {
  computeFxTimelineVersionHash,
  type FxEvent,
} from '../../../services/fxTimelineService';

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

const BASE_CTX: AudienceContext = {
  schema: 'ace/0.1',
  context_id: 'c1',
  observed_at: new Date().toISOString(),
  totem_id: 1,
  privacy: { gateway: 'lgpd', identity_dropped: true, image_dropped: true, lgpd_consent_given: true },
  presence: true,
  count: 1,
  group: false,
  density: 'low',
  motion: { approaching: 0, passing: 0, stopped: 0, leaving: 0 },
  attention: 'low',
  dwell_ms: 500,
  interaction: { touch: false, qr: false, nfc: false },
  clock: { hour_local: 14, day_of_week: 3, store_open: true },
  confidence: 0.9,
  session_id: 's1',
};

const BASE_GATEWAY_PAYLOAD: Record<string, unknown> = {
  schema: 'ace/0.1',
  context_id: 'c1',
  observed_at: new Date().toISOString(),
  totem_id: 1,
  privacy: { gateway: 'lgpd', identity_dropped: true, image_dropped: true, lgpd_consent_given: true },
  presence: true,
  count: 1,
  group: false,
  density: 'low',
  motion: { approaching: 0, passing: 0, stopped: 0, leaving: 0 },
  attention: 'low',
  dwell_ms: 500,
  interaction: { touch: false, qr: false, nfc: false },
  clock: { hour_local: 14, day_of_week: 3, store_open: true },
  confidence: 0.9,
  session_id: 's1',
};

// -----------------------------------------------------------------------------
// A: aceContextToHint — regras de hinting
// -----------------------------------------------------------------------------

describe('aceRuleEngine: aceContextToHint', () => {
  test('A1. Ausência de audiência → null', () => {
    expect(aceContextToHint({ ...BASE_CTX, presence: false })).toBeNull();
    expect(aceContextToHint({ ...BASE_CTX, count: 0 })).toBeNull();
  });

  test('A2. Attention HIGH + dwell≥4000ms → PREMIUM +30', () => {
    const h = aceContextToHint({ ...BASE_CTX, attention: 'high', dwell_ms: 5000 });
    expect(h).not.toBeNull();
    expect(h!.category).toBe('PREMIUM');
    expect(h!.priority_delta).toBe(30);
  });

  test('A3. Interação NFC OU QR → STANDARD +20', () => {
    const hNfc = aceContextToHint({ ...BASE_CTX, interaction: { ...BASE_CTX.interaction, nfc: true } });
    const hQr = aceContextToHint({ ...BASE_CTX, interaction: { ...BASE_CTX.interaction, qr: true } });
    expect(hNfc).toMatchObject({ category: 'STANDARD', priority_delta: 20 });
    expect(hQr).toMatchObject({ category: 'STANDARD', priority_delta: 20 });
  });

  test('A4. Grupo (count≥2) + attention≥medium → STANDARD +10', () => {
    const h = aceContextToHint({ ...BASE_CTX, count: 3, attention: 'medium' });
    expect(h).toMatchObject({ category: 'STANDARD', priority_delta: 10 });
  });

  test('A5. Touch → STANDARD +8', () => {
    const h = aceContextToHint({ ...BASE_CTX, interaction: { ...BASE_CTX.interaction, touch: true } });
    expect(h).toMatchObject({ category: 'STANDARD', priority_delta: 8 });
  });

  test('A6. approaching≥1 → STANDARD +5', () => {
    const h = aceContextToHint({
      ...BASE_CTX,
      motion: { ...BASE_CTX.motion, approaching: 2 },
    });
    expect(h).toMatchObject({ category: 'STANDARD', priority_delta: 5 });
  });
});

// -----------------------------------------------------------------------------
// W: applyAceHintToWeight + tiers
// -----------------------------------------------------------------------------

describe('aceRuleEngine: applyAceHintToWeight', () => {
  const hint = aceContextToHint({ ...BASE_CTX, attention: 'high', dwell_ms: 5000 })!;

  test('W1. aceEnabled=false → mesmo hint não altera weight', () => {
    expect(applyAceHintToWeight(10, hint, false)).toBe(10);
  });

  test('W2. PREMIUM category + commercialTier=premium → delta (30) + bonus (5) = 35, nunca negativo', () => {
    expect(applyAceHintToWeight(0, hint, true, 'premium')).toBe(35);
  });

  test('W3. FILL category + tier=remnant → +3 sobre o delta', () => {
    const fillHint = aceContextToHint({
      ...BASE_CTX,
      clock: { ...BASE_CTX.clock, store_open: false },
    })!;
    expect(fillHint.category).toBe('FILL');
    expect(applyAceHintToWeight(10, fillHint, true, 'remnant')).toBe(10 + 2 + 3);
  });
});

// -----------------------------------------------------------------------------
// C: isAceEnabledInCapabilities + shouldUseDispatchPlanCache
// -----------------------------------------------------------------------------

describe('aceRuleEngine: capabilities + cache conditional', () => {
  test('C1. isAceEnabledInCapabilities detecta ace_enabled:true e ace:{enabled:true}', () => {
    expect(isAceEnabledInCapabilities(null)).toBe(false);
    expect(isAceEnabledInCapabilities(undefined)).toBe(false);
    expect(isAceEnabledInCapabilities({ ace_enabled: true })).toBe(true);
    expect(isAceEnabledInCapabilities({ ace: { enabled: true } })).toBe(true);
    expect(isAceEnabledInCapabilities({ ace: { enabled: false } })).toBe(false);
    expect(isAceEnabledInCapabilities('{ "ace_enabled": true }')).toBe(true);
    expect(isAceEnabledInCapabilities('{ "ace_enabled": true, ')).toBe(false); // JSON inválido
  });

  test('C2. shouldUseDispatchPlanCache: ACE ON → cache OFF; ACE OFF → cache ON', () => {
    expect(shouldUseDispatchPlanCache(true)).toBe(false);
    expect(shouldUseDispatchPlanCache(false)).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// G: aceGatewayDecide (SPRINT-4 novos gates)
// -----------------------------------------------------------------------------

describe('aceGateway: aceGatewayDecide privacy gates (Sprint 4)', () => {
  test('G1. ace_disabled_locally → ACE_DISABLED não é o code correto, é TOTEM_PRIVACY_DISABLED', () => {
    const dec = aceGatewayDecide(BASE_GATEWAY_PAYLOAD, {
      totemPolicy: { ace_disabled_locally: true },
    });
    expect(dec.status).toBe('refused');
    expect(dec.code).toBe('TOTEM_PRIVACY_DISABLED');
  });

  test('G2. require_lgpd_consent:true E payload.sem lgpd → LGPD_CONSENT_REQUIRED', () => {
    const withoutConsent: Record<string, unknown> = {
      ...BASE_GATEWAY_PAYLOAD,
      privacy: { gateway: 'lgpd', identity_dropped: true, image_dropped: true },
    };
    const dec = aceGatewayDecide(withoutConsent, {
      totemPolicy: { require_lgpd_consent: true },
    });
    expect(dec.status).toBe('refused');
    expect(dec.code).toBe('LGPD_CONSENT_REQUIRED');
  });

  test('G3. require_lgpd_consent:true E payload.lgpd_consent_given=true → ACCEPTED', () => {
    const dec = aceGatewayDecide(BASE_GATEWAY_PAYLOAD, {
      totemPolicy: { require_lgpd_consent: true },
    });
    expect(dec.status).toBe('accepted');
    expect(dec.code).toBeNull();
  });

  test('G4. Policy vazio e payload ok → ACCEPTED (backwards compat: não requer LGPD por default)', () => {
    const noConsent: Record<string, unknown> = {
      ...BASE_GATEWAY_PAYLOAD,
      privacy: { gateway: 'lgpd', identity_dropped: true, image_dropped: true },
    };
    const dec = aceGatewayDecide(noConsent, { totemPolicy: {} });
    expect(dec.status).toBe('accepted');
  });

  test('G5. observed_at stale 10s → STALE_CONTEXT', () => {
    const stale = new Date(Date.now() - 10_000);
    const dec = aceGatewayDecide(
      { ...BASE_GATEWAY_PAYLOAD, observed_at: stale.toISOString() },
      { staleMaxSeconds: 3 }
    );
    expect(dec.status).toBe('refused');
    expect(dec.code).toBe('STALE_CONTEXT');
  });
});

// -----------------------------------------------------------------------------
// F: computeFxTimelineVersionHash — SPRINT-4 SmartDisplayFX stable-hash
// -----------------------------------------------------------------------------

describe('fxTimelineService: computeFxTimelineVersionHash', () => {
  const ev1: FxEvent = {
    effect_type: 'fade',
    target_scope: 'single_totem',
    trigger_type: 'dispatch',
    duration_ms: 500,
    payload: { alpha: 0.8 },
    dispatch_version_hash: 'abc123',
  };
  const ev2: FxEvent = {
    effect_type: 'split',
    target_scope: 'site_all',
    trigger_type: 'schedule',
    at_ms: 1000,
  };

  test('F1. Hash determinístico: mesma lista mesmo hash', () => {
    const h1 = computeFxTimelineVersionHash([ev1, ev2]);
    const h2 = computeFxTimelineVersionHash([{ ...ev1 }, { ...ev2 }]);
    expect(h1).toEqual(h2);
    expect(h1).toMatch(/^[0-9a-f]{16}$/);
  });

  test('F2. transient fields (event_id, generated_at) não alteram o hash', () => {
    const a = computeFxTimelineVersionHash([ev1, ev2]);
    const b = computeFxTimelineVersionHash([
      { ...ev1, event_id: 'unique-123', generated_at: new Date().toISOString() as unknown as undefined },
      { ...ev2, trace_id: 'abc' as unknown as undefined },
    ]);
    expect(a).toEqual(b);
  });

  test('F3. Ordem diferente → hash DIFERENTE (FX timeline é order-sensitive)', () => {
    const a = computeFxTimelineVersionHash([ev1, ev2]);
    const b = computeFxTimelineVersionHash([ev2, ev1]);
    expect(a).not.toEqual(b);
  });
});
