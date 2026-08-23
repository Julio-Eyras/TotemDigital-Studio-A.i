import { aceGatewayDecide } from '../../../services/ace/aceGateway';
import {
  applyAceHintToWeight,
  aceContextToHint,
  isAceEnabledInCapabilities,
  shouldUseDispatchPlanCache,
} from '../../../services/ace/aceRuleEngine';
import { getAceHintStore, resetAceHintStoreForTests } from '../../../services/ace/aceHintStore';
import { parseAnonymousInteraction } from '../../../services/ace/aceInteraction';
import { listAceAudit, recordAceAudit, resetAceAuditRingForTests, sanitizeAceForLog } from '../../../services/ace/aceAudit';
import { ingestFxInteractionForAce, mapFxInteractionToAce, reviewFxAiEventForAce } from '../../../services/ace/aceFxBridge';
import { fxRuleMatchesAceHint, toAceHintWire } from '../../../services/ace/aceFxPublish';
import { AudienceContext } from '../../../services/ace/aceTypes';

function baseContext(overrides: Partial<AudienceContext> = {}): AudienceContext {
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

describe('ACE 0.1 gateway', () => {
  it('recusa ACE_DISABLED quando opt-in off', () => {
    const d = aceGatewayDecide(baseContext() as unknown as Record<string, unknown>, {
      aceEnabled: false,
    });
    expect(d.code).toBe('ACE_DISABLED');
  });

  it('recusa IDENTITY_LEAK com person_id', () => {
    const d = aceGatewayDecide(
      { ...baseContext(), person_id: 123 } as unknown as Record<string, unknown>
    );
    expect(d.code).toBe('IDENTITY_LEAK');
  });

  it('recusa IDENTITY_LEAK com tag_id', () => {
    const d = aceGatewayDecide(
      { ...baseContext(), tag_id: '04:A3:11' } as unknown as Record<string, unknown>
    );
    expect(d.code).toBe('IDENTITY_LEAK');
  });

  it('recusa STALE_CONTEXT', () => {
    const d = aceGatewayDecide(
      baseContext({ observed_at: '2020-01-01T00:00:00.000Z' }) as unknown as Record<string, unknown>
    );
    expect(d.code).toBe('STALE_CONTEXT');
  });

  it('aceita snapshot fresco e anónimo', () => {
    const d = aceGatewayDecide(baseContext() as unknown as Record<string, unknown>);
    expect(d.status).toBe('accepted');
  });
});

describe('ACE 0.1 rule engine + dispatcher hint', () => {
  it('não aplica hint se ACE off (default)', () => {
    const hint = aceContextToHint(baseContext());
    expect(applyAceHintToWeight(10, hint, false, 'premium')).toBe(10);
  });

  it('PREMIUM +30 quando atenção alta e dwell >= 4s', () => {
    const hint = aceContextToHint(baseContext());
    expect(hint?.category).toBe('PREMIUM');
    expect(hint?.priority_delta).toBe(30);
    expect(applyAceHintToWeight(10, hint, true, 'premium')).toBe(45);
  });

  it('capabilities.ace_enabled default false', () => {
    expect(isAceEnabledInCapabilities(null)).toBe(false);
    expect(isAceEnabledInCapabilities({})).toBe(false);
    expect(isAceEnabledInCapabilities({ ace_enabled: false })).toBe(false);
    expect(isAceEnabledInCapabilities({ ace_enabled: 'true' })).toBe(false);
    expect(isAceEnabledInCapabilities('{not-json')).toBe(false);
    expect(isAceEnabledInCapabilities({ ace: { enabled: false } })).toBe(false);
    expect(isAceEnabledInCapabilities({ ace_enabled: true })).toBe(true);
    expect(isAceEnabledInCapabilities('{"ace":{"enabled":true}}')).toBe(true);
  });

  it('cache de plano só quando ACE off', () => {
    expect(shouldUseDispatchPlanCache(false)).toBe(true);
    expect(shouldUseDispatchPlanCache(true)).toBe(false);
  });

  it('store TTL: sem contexto depois de expirar', () => {
    resetAceHintStoreForTests();
    const store = getAceHintStore();
    store.put(baseContext());
    expect(store.audit(41, true).code).toBe('HINT_APPLIED');
    expect(store.get(41, Date.now() + 4000)).toBeNull();
  });

  it('NFC/QR dá STANDARD +20 sem tag_id', () => {
    const hint = aceContextToHint(
      baseContext({
        attention: 'low',
        dwell_ms: 400,
        count: 1,
        group: false,
        interaction: { touch: false, qr: false, nfc: true },
      })
    );
    expect(hint?.category).toBe('STANDARD');
    expect(hint?.priority_delta).toBe(20);
    expect(applyAceHintToWeight(10, hint, true)).toBe(30);
  });

  it('PREMIUM ganha a NFC', () => {
    const hint = aceContextToHint(
      baseContext({ interaction: { touch: false, qr: false, nfc: true } })
    );
    expect(hint?.category).toBe('PREMIUM');
  });
});

describe('ACE 0.1 interaction bus (anónimo)', () => {
  it('aceita NFC sem UID', () => {
    const d = parseAnonymousInteraction({ totem_id: 41, nfc: true });
    expect(d.status).toBe('accepted');
    expect(d.interaction).toEqual({ touch: false, qr: false, nfc: true });
  });

  it('mapeia interactionType tag_id para nfc, sem guardar o id', () => {
    const d = parseAnonymousInteraction({ totem_id: 41, interactionType: 'tag_id' });
    expect(d.status).toBe('accepted');
    expect(d.interaction?.nfc).toBe(true);
  });

  it('recusa tag_id / face', () => {
    expect(parseAnonymousInteraction({ totem_id: 41, nfc: true, tag_id: 'AA' }).code).toBe(
      'IDENTITY_LEAK'
    );
    expect(
      parseAnonymousInteraction({ totem_id: 41, interactionType: 'facial_recognition' }).code
    ).toBe('IDENTITY_LEAK');
  });

  it('merge no store: NFC sozinho gera hint STANDARD', () => {
    resetAceHintStoreForTests();
    const hint = getAceHintStore().mergeInteraction(41, { touch: false, qr: false, nfc: true });
    expect(hint?.priority_delta).toBe(20);
    expect(getAceHintStore().audit(41, true).code).toBe('HINT_APPLIED');
  });
});

describe('ACE 0.1 audit log (sem PII)', () => {
  it('sanitize remove person_id, tag_id e session_id', () => {
    const dirty = {
      ...baseContext(),
      person_id: 99,
      tag_id: '04:AA',
      session_id: 'ephemeral-secret',
      extra: 'drop',
    } as AudienceContext & Record<string, unknown>;
    const clean = sanitizeAceForLog(dirty)!;
    const blob = JSON.stringify(clean);
    expect(clean.person_id).toBeUndefined();
    expect(clean.tag_id).toBeUndefined();
    expect(clean.session_id).toBeUndefined();
    expect(clean.context_id).toBeUndefined();
    expect(blob).not.toContain('04:AA');
    expect(blob).not.toContain('ephemeral-secret');
    expect(clean.count).toBe(3);
    expect(clean.privacy).toEqual({
      gateway: 'ace/0.1',
      identity_dropped: true,
      image_dropped: true,
    });
  });

  it('refuse não guarda snapshot; context entra no ring sanitizado', () => {
    resetAceAuditRingForTests();
    recordAceAudit({
      source: 'refuse',
      totemId: 41,
      code: 'IDENTITY_LEAK',
      context: { ...baseContext(), person_id: 1 } as unknown as Record<string, unknown>,
      errors: ['campo de identidade: person_id'],
    });
    recordAceAudit({
      source: 'context',
      totemId: 41,
      code: 'HINT_APPLIED',
      hint: { category: 'PREMIUM', priority_delta: 30, reason: 'x' },
      context: baseContext(),
    });
    const rows = listAceAudit(41);
    expect(rows).toHaveLength(2);
    const refuse = rows.find((r) => r.source === 'refuse');
    const ok = rows.find((r) => r.source === 'context');
    expect(refuse?.snapshot).toBeNull();
    expect(ok?.snapshot?.count).toBe(3);
    expect(JSON.stringify(ok?.snapshot)).not.toContain('ephemeral-8f42a1');
  });
});

describe('ACE 0.1 FILL + ponte FX', () => {
  it('loja fechada sem outro sinal → FILL', () => {
    const hint = aceContextToHint(
      baseContext({
        attention: 'low',
        dwell_ms: 200,
        count: 1,
        group: false,
        motion: { approaching: 0, passing: 0, stopped: 1, leaving: 0 },
        clock: { hour_local: 23, day_of_week: 0, store_open: false },
      })
    );
    expect(hint?.category).toBe('FILL');
    expect(applyAceHintToWeight(10, hint, true, 'remnant')).toBe(15);
  });

  it('FX tag_id com UID vira NFC anónimo; face e mood recusados', () => {
    resetAceHintStoreForTests();
    resetAceAuditRingForTests();
    const mapped = mapFxInteractionToAce({
      siteId: 'loja',
      totemId: '41',
      interactionType: 'tag_id',
      extra: {},
    });
    expect(mapped.status).toBe('ok');
    if (mapped.status === 'ok') {
      expect(mapped.interactionType).toBe('nfc');
    }

    const hint = ingestFxInteractionForAce({
      siteId: 'loja',
      totemId: '41',
      interactionType: 'tag_id',
      extra: { tagId: '04:SHOULD-NOT-LEAK' } as Record<string, unknown>,
    });
    expect(hint?.priority_delta).toBe(20);
    const stored = getAceHintStore().get(41);
    expect(JSON.stringify(stored?.context)).not.toContain('04:SHOULD-NOT-LEAK');

    expect(
      mapFxInteractionToAce({
        siteId: 'loja',
        totemId: '41',
        interactionType: 'facial_recognition',
      }).status
    ).toBe('refuse');
    expect(
      reviewFxAiEventForAce({
        totemId: '41',
        eventType: 'attention',
        payload: { mood: 'happy', attention_ms: 3000 },
      }).status
    ).toBe('refuse');
  });

  it('fx_rules.ace_category casa com hint; wire MQTT não leva UID', () => {
    const hint = { category: 'STANDARD' as const, priority_delta: 20, reason: 'x' };
    expect(fxRuleMatchesAceHint({ ace_category: 'STANDARD' }, hint)).toBe(true);
    expect(fxRuleMatchesAceHint({ ace_category: 'PREMIUM' }, hint)).toBe(false);
    expect(fxRuleMatchesAceHint({}, hint)).toBe(true);
    const wire = toAceHintWire(41, hint, 'loja');
    expect(wire.msg_type).toBe('ace.hint');
    expect(JSON.stringify(wire)).not.toContain('tag');
    expect(wire.totem_id).toBe(41);
  });
});
