/**
 * Emulação lab 0.1 — ACE + Dispatcher + FX sem Player-AD, MQTT, Postgres ou face.
 * Ciclo completo (ACE + Maestro mock + TDEP mock): labSystemTick.ts
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

export function ntpOffsetFromExchangeMs(t1: number, t2: number, t3: number, t4: number): number {
  return ((t2 - t1) + (t3 - t4)) / 2;
}

export function simulateNtpExchange(
  clientOffsetMs: number,
  serverOffsetMs = 0,
  rttMs = 4,
  procMs = 0,
  refMs = 1_000_000
): { t1: number; t2: number; t3: number; t4: number; offsetMs: number } {
  const t1 = refMs + clientOffsetMs;
  const t2 = refMs + Math.floor(rttMs / 2) + serverOffsetMs;
  const t3 = refMs + Math.floor(rttMs / 2) + procMs + serverOffsetMs;
  const t4 = refMs + rttMs + procMs + clientOffsetMs;
  return { t1, t2, t3, t4, offsetMs: ntpOffsetFromExchangeMs(t1, t2, t3, t4) };
}

export function measureMaestroPair(
  offsetAMs: number,
  offsetBMs: number,
  opts?: { ntpOkA?: boolean; ntpOkB?: boolean }
): {
  driftMs: number;
  ntpOk: boolean;
  accepted: boolean;
  code: 'CLOCK_DRIFT' | null;
} {
  const a = simulateNtpExchange(offsetAMs, 0);
  const b = simulateNtpExchange(offsetBMs, 0);
  const driftMs = Math.round(a.offsetMs - b.offsetMs);
  const ntpOk = (opts?.ntpOkA ?? true) && (opts?.ntpOkB ?? true);
  const accepted = ntpOk && Math.abs(driftMs) <= LAB_MAESTRO_CLOCK_DRIFT_MAX_MS;
  return { driftMs, ntpOk, accepted, code: accepted ? null : 'CLOCK_DRIFT' };
}

export type LabSsidBox = {
  role?: string;
  ssid?: string;
  bandGhz?: number;
  storeClients?: boolean;
};

export function measureSsidPair(
  boxA: LabSsidBox,
  boxB: LabSsidBox
): { ok: boolean; code: string | null; ssid: string | null } {
  const roleA = String(boxA.role || 'unknown').toLowerCase();
  const roleB = String(boxB.role || 'unknown').toLowerCase();
  const bandA = Number(boxA.bandGhz || 0);
  const bandB = Number(boxB.bandGhz || 0);
  const ssidA = String(boxA.ssid || '');
  const ssidB = String(boxB.ssid || '');
  const storeClients = Boolean(boxA.storeClients || boxB.storeClients);
  if (roleA === 'store' || roleB === 'store') {
    return { ok: false, code: 'SSID_STORE', ssid: ssidA || ssidB || null };
  }
  if (roleA !== 'players' || roleB !== 'players') {
    return { ok: false, code: 'SSID_UNKNOWN', ssid: ssidA || ssidB || null };
  }
  if (!ssidA || ssidA !== ssidB) {
    return { ok: false, code: 'SSID_MIXED', ssid: null };
  }
  if (![5, 6].includes(bandA) || ![5, 6].includes(bandB)) {
    return { ok: false, code: 'SSID_BAND', ssid: ssidA };
  }
  if (storeClients) {
    return { ok: false, code: 'SSID_SHARED', ssid: ssidA };
  }
  return { ok: true, code: null, ssid: ssidA };
}

export function mockMaestroPlayerAcceptsCue(
  cue: {
    clock?: { ntp_ok?: boolean; drift_ms?: number };
  },
  ssid?: { ok?: boolean; code?: string | null } | null
): { accepted: boolean; code: string | null } {
  const ntpOk = cue.clock?.ntp_ok === true;
  const drift = Number(cue.clock?.drift_ms ?? 0);
  if (!ntpOk || Math.abs(drift) > LAB_MAESTRO_CLOCK_DRIFT_MAX_MS) {
    return { accepted: false, code: 'CLOCK_DRIFT' };
  }
  if (ssid != null && !ssid.ok) {
    return { accepted: false, code: ssid.code || 'SSID_FORBIDDEN' };
  }
  return { accepted: true, code: null };
}

export const LAB_TDEP_HANDSHAKE_MAX_MS = 60_000;

/** Espelho de `tdep_nodes.handshake` + `seller_decide`. Ausência de handshake_ok = fill de lab já com nós ok. */
function handshakeInstantMs(payload: Record<string, unknown>): number | null | 'invalid' {
  const raw = payload.handshake_ts ?? payload.ts;
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  let at = NaN;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    at = raw;
  } else if (typeof raw === 'string') {
    at = Date.parse(raw);
  }
  return Number.isFinite(at) ? at : 'invalid';
}

export function mockTdepPartnerAccepts(payload: Record<string, unknown>): {
  accepted: boolean;
  code: string | null;
} {
  const leakKeys = ['audience', 'person_id', 'ace', 'mood'];
  if (leakKeys.some((k) => k in payload)) {
    return { accepted: false, code: 'AUDIENCE_FORBIDDEN' };
  }
  const handshakeKind = payload.handshake;
  const instant = handshakeInstantMs(payload);
  if (
    payload.refuse_code === 'HANDSHAKE_REJECTED' ||
    payload.secret_ok === false ||
    (typeof handshakeKind === 'string' && handshakeKind !== 'hmac') ||
    instant === 'invalid'
  ) {
    return { accepted: false, code: 'HANDSHAKE_REJECTED' };
  }
  if (payload.refuse_code === 'NO_HANDSHAKE' || payload.handshake_ok === false) {
    return { accepted: false, code: 'NO_HANDSHAKE' };
  }
  if (
    payload.refuse_code === 'HANDSHAKE_REPLAY' ||
    (typeof instant === 'number' && Math.abs(Date.now() - instant) > LAB_TDEP_HANDSHAKE_MAX_MS)
  ) {
    return { accepted: false, code: 'HANDSHAKE_REPLAY' };
  }
  if (payload.refuse_code === 'NOT_CEDIBLE' || payload.cedible === false) {
    return { accepted: false, code: 'NOT_CEDIBLE' };
  }
  const brands = Array.isArray(payload.brand_categories) ? payload.brand_categories.map(String) : [];
  const blocked = Array.isArray(payload.blocked_categories) ? payload.blocked_categories.map(String) : [];
  if (payload.refuse_code === 'CATEGORY_BLOCKED' || brands.some((c) => blocked.includes(c))) {
    return { accepted: false, code: 'CATEGORY_BLOCKED' };
  }
  if (payload.refuse_code === 'POLICY_AUDIO' || (payload.audio === true && payload.face_audio === false)) {
    return { accepted: false, code: 'POLICY_AUDIO' };
  }
  if (payload.refuse_code === 'FORMAT_MISMATCH' || payload.status === 'rejected') {
    return { accepted: false, code: 'FORMAT_MISMATCH' };
  }
  return { accepted: true, code: null };
}

export function labAcePremiumContext(totemId = 41): Record<string, unknown> {
  return {
    schema: 'ace/0.1',
    context_id: '8f42a1e2-4c1a-4b9e-9d3a-0c7e1b2a9f10',
    observed_at: new Date().toISOString(),
    totem_id: totemId,
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
    session_id: 'ephemeral-lab',
  };
}

export function labAceIdentityLeakContext(totemId = 41): Record<string, unknown> {
  return {
    ...labAcePremiumContext(totemId),
    person_id: 123,
    age_bucket: '26-40',
    mood: 'happy',
  };
}

export function labAceStaleContext(totemId = 41, ageMs = 10_000): Record<string, unknown> {
  return {
    ...labAcePremiumContext(totemId),
    observed_at: new Date(Date.now() - ageMs).toISOString(),
  };
}

export function labAceLowConfidenceContext(totemId = 41, confidence = 0.12): Record<string, unknown> {
  return {
    ...labAcePremiumContext(totemId),
    confidence,
  };
}
