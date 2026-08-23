/**
 * Emulação lab 0.1 — ACE + Dispatcher + FX sem Player-AD, MQTT, Postgres ou face.
 * Maestro/TDEP ficam nos validadores Python (schemas isolados).
 */

import { aceGatewayDecide } from '../ace/aceGateway';
import { applyAceHintToWeight, aceContextToHint } from '../ace/aceRuleEngine';
import { getAceHintStore } from '../ace/aceHintStore';
import { parseAnonymousInteraction } from '../ace/aceInteraction';
import { listAceAudit, recordAceAudit } from '../ace/aceAudit';
import {
  ingestFxInteractionForAce,
  mapFxInteractionToAce,
  reviewFxAiEventForAce,
} from '../ace/aceFxBridge';
import { fxRuleMatchesAceHint, toAceHintWire, AceHintWire } from '../ace/aceFxPublish';
import { AceHint, AudienceContext } from '../ace/aceTypes';

export interface LabCandidate {
  id: string;
  baseWeight: number;
  commercialTier?: string;
}

export interface LabRankedCandidate extends LabCandidate {
  weight: number;
}

export interface LabAceTickInput {
  aceEnabled: boolean;
  context?: Record<string, unknown>;
  interaction?: Record<string, unknown>;
  fxInteraction?: {
    siteId: string;
    totemId: string;
    interactionType: string;
    extra?: Record<string, unknown> | null;
  };
  fxAi?: {
    totemId: string;
    eventType: string;
    payload?: Record<string, unknown> | null;
  };
  candidates: LabCandidate[];
  fxRule?: Record<string, unknown>;
}

export interface LabAceTickResult {
  gatewayStatus: 'accepted' | 'refused' | 'skipped';
  gatewayCode: string | null;
  interactionStatus: 'accepted' | 'refused' | 'skipped';
  fxMappedStatus: 'ok' | 'refuse' | 'skip' | 'skipped';
  fxAiStatus: 'ok' | 'refuse' | 'skip' | 'skipped';
  hint: AceHint | null;
  ranked: LabRankedCandidate[];
  winnerId: string | null;
  fxBus: AceHintWire | null;
  fxRuleMatched: boolean;
  auditCode: string | null;
  auditRing: ReturnType<typeof listAceAudit>;
  identityLeak: boolean;
}

function asContext(payload: Record<string, unknown>): AudienceContext {
  return payload as unknown as AudienceContext;
}

function rankCandidates(
  candidates: LabCandidate[],
  hint: AceHint | null,
  aceEnabled: boolean
): LabRankedCandidate[] {
  return candidates
    .map((c) => ({
      ...c,
      weight: applyAceHintToWeight(c.baseWeight, hint, aceEnabled, c.commercialTier),
    }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Um ciclo de lab: gateway → store → pesos do Dispatcher → bus FX (in-memory).
 * Não escolhe media_id. Sem hint ou ACE off, os pesos ficam iguais.
 */
export function runLabAceTick(input: LabAceTickInput): LabAceTickResult {
  const store = getAceHintStore();
  let gatewayStatus: LabAceTickResult['gatewayStatus'] = 'skipped';
  let gatewayCode: string | null = null;
  let interactionStatus: LabAceTickResult['interactionStatus'] = 'skipped';
  let fxMappedStatus: LabAceTickResult['fxMappedStatus'] = 'skipped';
  let fxAiStatus: LabAceTickResult['fxAiStatus'] = 'skipped';
  let identityLeak = false;
  let hint: AceHint | null = null;
  let totemId = 0;

  if (input.context) {
    const decision = aceGatewayDecide(input.context, { aceEnabled: true });
    gatewayStatus = decision.status;
    gatewayCode = decision.code;
    if (decision.status !== 'accepted') {
      identityLeak = decision.code === 'IDENTITY_LEAK';
      recordAceAudit({
        source: 'refuse',
        totemId: Number(input.context.totem_id) || null,
        code: decision.code,
        errors: decision.errors,
      });
    } else {
      const ctx = asContext(decision.payload);
      totemId = ctx.totem_id;
      hint = store.put(ctx);
      recordAceAudit({
        source: 'context',
        totemId,
        code: hint ? 'HINT_APPLIED' : 'NO_HINT',
        hint,
        context: ctx,
      });
    }
  }

  if (input.interaction) {
    const parsed = parseAnonymousInteraction(input.interaction);
    interactionStatus = parsed.status === 'accepted' ? 'accepted' : 'refused';
    if (parsed.status !== 'accepted' || !parsed.totemId || !parsed.interaction) {
      identityLeak = identityLeak || parsed.code === 'IDENTITY_LEAK';
      recordAceAudit({
        source: 'refuse',
        totemId: Number(input.interaction.totem_id) || null,
        code: parsed.code,
        errors: parsed.errors,
      });
    } else {
      totemId = parsed.totemId;
      hint = store.mergeInteraction(parsed.totemId, parsed.interaction);
      recordAceAudit({
        source: 'interaction',
        totemId,
        code: hint ? 'HINT_APPLIED' : 'NO_HINT',
        hint,
        context: store.get(totemId)?.context ?? null,
      });
    }
  }

  if (input.fxInteraction) {
    const mapped = mapFxInteractionToAce(input.fxInteraction);
    fxMappedStatus = mapped.status;
    if (mapped.status === 'refuse') {
      identityLeak = true;
    }
    const ingested = ingestFxInteractionForAce(input.fxInteraction);
    if (ingested) {
      hint = ingested;
      totemId = Number(input.fxInteraction.totemId) || totemId;
    }
  }

  if (input.fxAi) {
    const reviewed = reviewFxAiEventForAce(input.fxAi);
    fxAiStatus = reviewed.status;
    if (reviewed.status === 'refuse') {
      identityLeak = true;
    }
  }

  if (!hint && totemId > 0) {
    const stored = store.get(totemId);
    hint = stored?.hint ?? (stored?.context ? aceContextToHint(stored.context) : null);
  }

  const ranked = rankCandidates(input.candidates, hint, input.aceEnabled);
  const winnerId = ranked[0]?.id ?? null;
  const audit =
    totemId > 0
      ? store.audit(totemId, input.aceEnabled)
      : { enabled: input.aceEnabled, code: 'NO_CONTEXT' as const, hint: null };

  const fxBus =
    input.aceEnabled && hint && totemId > 0 ? toAceHintWire(totemId, hint, 'lab') : null;
  const fxRuleMatched = fxRuleMatchesAceHint(input.fxRule, input.aceEnabled ? hint : null);

  return {
    gatewayStatus,
    gatewayCode,
    interactionStatus,
    fxMappedStatus,
    fxAiStatus,
    hint: input.aceEnabled ? hint : null,
    ranked,
    winnerId,
    fxBus,
    fxRuleMatched,
    auditCode: audit.code,
    auditRing: totemId > 0 ? listAceAudit(totemId) : [],
    identityLeak,
  };
}

export const LAB_MAESTRO_CLOCK_DRIFT_MAX_MS = 200;

export function mockMaestroPlayerAcceptsCue(cue: {
  clock?: { ntp_ok?: boolean; drift_ms?: number };
}): { accepted: boolean; code: string | null } {
  const ntpOk = cue.clock?.ntp_ok === true;
  const drift = Number(cue.clock?.drift_ms ?? 0);
  if (!ntpOk || Math.abs(drift) > LAB_MAESTRO_CLOCK_DRIFT_MAX_MS) {
    return { accepted: false, code: 'CLOCK_DRIFT' };
  }
  return { accepted: true, code: null };
}

export function mockTdepPartnerAccepts(payload: Record<string, unknown>): {
  accepted: boolean;
  code: string | null;
} {
  const leakKeys = ['audience', 'person_id', 'ace', 'mood'];
  if (leakKeys.some((k) => k in payload)) {
    return { accepted: false, code: 'AUDIENCE_FORBIDDEN' };
  }
  if (payload.refuse_code === 'FORMAT_MISMATCH' || payload.status === 'rejected') {
    return { accepted: false, code: 'FORMAT_MISMATCH' };
  }
  return { accepted: true, code: null };
}
