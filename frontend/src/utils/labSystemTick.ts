/** Payloads do ciclo de sistema lab. Sem Player-AD, TV box ou /tdep/v1 de produto. */

export type LabTickScenarioId =
  | 'default_off'
  | 'fill_idle'
  | 'guaranteed_idle'
  | 'no_capacity'
  | 'revoked'
  | 'clock_drift'
  | 'ssid_store'
  | 'two_totems'
  | 'ace_optin'
  | 'identity_leak'
  | 'stale_context'
  | 'format_mismatch'
  | 'low_confidence'
  | 'policy_audio'
  | 'category_blocked'
  | 'not_cedible'
  | 'no_handshake'
  | 'handshake_replay'
  | 'handshake_rejected'
  | 'sql_ace'
  | 'sql_no_database'
  | 'sql_no_totem';

export type LabTickAceBody = {
  aceEnabled?: boolean;
  candidates?: Array<{ id: string; baseWeight: number; commercialTier: string }>;
  context?: Record<string, unknown>;
  hydrateSql?: boolean;
  sqlConnected?: boolean;
  sqlRow?: Record<string, unknown> | null;
};

export type LabTickTdepBody = {
  enabled?: boolean;
  flightAccepted?: boolean;
  flightPriority?: 'fill' | 'guaranteed';
  revoked?: boolean;
  killSwitch?: boolean;
  capSharePct?: number;
  shareUsedPct?: number;
  wantSharePct?: number;
  partnerPayload?: Record<string, unknown>;
};

export type LabTickMaestroBody = {
  offsetAMs?: number;
  offsetBMs?: number;
  ssidA?: { role: string; ssid: string; bandGhz: number };
  ssidB?: { role: string; ssid: string; bandGhz: number };
};

export type LabSystemTickBody = {
  totemId?: number;
  totemIds?: number[];
  ace?: LabTickAceBody;
  tdep?: LabTickTdepBody;
  maestro?: LabTickMaestroBody;
};

export const IDLE_ACE: LabTickAceBody = {
  aceEnabled: false,
  candidates: [{ id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' }],
};

export const LAB_TICK_SCENARIOS: Array<{ id: LabTickScenarioId; label: string; hint: string }> = [
  { id: 'default_off', label: 'Default off', hint: 'Direct local ganha. TotemNet off. Sem proof.' },
  { id: 'ace_optin', label: 'ACE opt-in', hint: 'Mock SQL RAM. Context PREMIUM. Local continua a ganhar.' },
  { id: 'sql_ace', label: 'SQL ACE', hint: 'SELECT capabilities ace_enabled true. Local continua a ganhar.' },
  { id: 'sql_no_database', label: 'NO_DATABASE', hint: 'Sem Postgres. ACE off. Ar de sempre.' },
  { id: 'sql_no_totem', label: 'NO_TOTEM', hint: 'SELECT sem linha. ACE off. Ar de sempre.' },
  { id: 'identity_leak', label: 'IDENTITY_LEAK', hint: 'person_id no context. Sem hint. Ar de sempre.' },
  { id: 'stale_context', label: 'STALE_CONTEXT', hint: 'observed_at > 3 s. Sem hint. Ar de sempre.' },
  { id: 'format_mismatch', label: 'FORMAT_MISMATCH', hint: 'Parceiro recusa variante. Idle, sem proof.' },
  { id: 'low_confidence', label: 'LOW_CONFIDENCE', hint: 'confidence < 0.50. Sem hint. Ar de sempre.' },
  { id: 'policy_audio', label: 'POLICY_AUDIO', hint: 'Variante com som, face muda. Idle, sem proof.' },
  { id: 'category_blocked', label: 'CATEGORY_BLOCKED', hint: 'Categoria vetada na face. Idle, sem proof.' },
  { id: 'not_cedible', label: 'NOT_CEDIBLE', hint: 'Availability cedible false. Idle, sem proof.' },
  { id: 'no_handshake', label: 'NO_HANDSHAKE', hint: 'handshake_ok false. Idle, sem proof.' },
  { id: 'handshake_replay', label: 'HANDSHAKE_REPLAY', hint: '|ts| > 60 s (passado ou futuro). Idle, sem proof.' },
  { id: 'handshake_rejected', label: 'HANDSHAKE_REJECTED', hint: 'secret_ok false ou ts inválido. Idle, sem proof.' },
  { id: 'fill_idle', label: 'Fill no idle', hint: 'Sem cardápio local. Fill mock + proof HMAC.' },
  { id: 'guaranteed_idle', label: 'Guaranteed', hint: 'Guaranteed no idle + proof.' },
  { id: 'no_capacity', label: 'Cap 10%', hint: 'want 15% → NO_CAPACITY. Sem proof.' },
  { id: 'revoked', label: 'Revoke', hint: 'RIGHTS_REVOKED. Sem proof.' },
  { id: 'clock_drift', label: 'NTP drift', hint: '480 ms → CLOCK_DRIFT. Cue recusado.' },
  { id: 'ssid_store', label: 'SSID loja', hint: 'Wi-Fi da loja → SSID_STORE. Cue recusado.' },
  { id: 'two_totems', label: 'Dois totens', hint: '41 e 42. Fill + um proof por totem.' },
];

export function parseLabTotemId(raw: unknown, fallback = 41): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
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

export function buildLabTickBody(id: LabTickScenarioId, totemId = 41): LabSystemTickBody {
  const tid = parseLabTotemId(totemId, 41);
  switch (id) {
    case 'default_off':
      return { totemId: tid };
    case 'ace_optin':
      return { totemId: tid, ace: { context: labAcePremiumContext(tid) } };
    case 'sql_ace':
      return {
        totemId: tid,
        ace: {
          hydrateSql: true,
          sqlRow: { ace_enabled: true },
          context: labAcePremiumContext(tid),
        },
      };
    case 'sql_no_database':
      return {
        totemId: tid,
        ace: { hydrateSql: true, sqlConnected: false, context: labAcePremiumContext(tid) },
      };
    case 'sql_no_totem':
      return {
        totemId: tid,
        ace: {
          hydrateSql: true,
          sqlConnected: true,
          sqlRow: null,
          context: labAcePremiumContext(tid),
        },
      };
    case 'identity_leak':
      return {
        totemId: tid,
        ace: { aceEnabled: true, context: labAceIdentityLeakContext(tid) },
      };
    case 'stale_context':
      return {
        totemId: tid,
        ace: { aceEnabled: true, context: labAceStaleContext(tid) },
      };
    case 'format_mismatch':
      return {
        totemId: tid,
        ace: IDLE_ACE,
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: { schema: 'tdep/0.1', refuse_code: 'FORMAT_MISMATCH' },
        },
      };
    case 'low_confidence':
      return {
        totemId: tid,
        ace: { aceEnabled: true, context: labAceLowConfidenceContext(tid) },
      };
    case 'policy_audio':
      return {
        totemId: tid,
        ace: IDLE_ACE,
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: { schema: 'tdep/0.1', audio: true, face_audio: false },
        },
      };
    case 'category_blocked':
      return {
        totemId: tid,
        ace: IDLE_ACE,
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: {
            schema: 'tdep/0.1',
            brand_categories: ['alcohol'],
            blocked_categories: ['alcohol'],
          },
        },
      };
    case 'not_cedible':
      return {
        totemId: tid,
        ace: IDLE_ACE,
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: { schema: 'tdep/0.1', cedible: false },
        },
      };
    case 'no_handshake':
      return {
        totemId: tid,
        ace: IDLE_ACE,
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: { schema: 'tdep/0.1', handshake_ok: false },
        },
      };
    case 'handshake_replay':
      return {
        totemId: tid,
        ace: IDLE_ACE,
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: { schema: 'tdep/0.1', handshake_ts: '2020-01-01T00:00:00.000Z' },
        },
      };
    case 'handshake_rejected':
      return {
        totemId: tid,
        ace: IDLE_ACE,
        tdep: {
          enabled: true,
          flightAccepted: true,
          partnerPayload: { schema: 'tdep/0.1', secret_ok: false },
        },
      };
    case 'fill_idle':
      return { totemId: tid, ace: IDLE_ACE, tdep: { enabled: true, flightAccepted: true } };
    case 'guaranteed_idle':
      return {
        totemId: tid,
        ace: IDLE_ACE,
        tdep: { enabled: true, flightAccepted: true, flightPriority: 'guaranteed' },
      };
    case 'no_capacity':
      return {
        totemId: tid,
        ace: IDLE_ACE,
        tdep: {
          enabled: true,
          flightAccepted: true,
          flightPriority: 'guaranteed',
          capSharePct: 10,
          shareUsedPct: 0,
          wantSharePct: 15,
        },
      };
    case 'revoked':
      return {
        totemId: tid,
        ace: IDLE_ACE,
        tdep: { enabled: true, flightAccepted: true, revoked: true },
      };
    case 'clock_drift':
      return { totemId: tid, maestro: { offsetAMs: 480, offsetBMs: 0 } };
    case 'ssid_store':
      return {
        totemId: tid,
        maestro: {
          ssidA: { role: 'store', ssid: 'loja-wifi', bandGhz: 2.4 },
          ssidB: { role: 'players', ssid: 'totem-players', bandGhz: 5 },
        },
      };
    case 'two_totems':
      return {
        totemIds: [tid, tid === 41 ? 42 : tid + 1],
        ace: IDLE_ACE,
        tdep: { enabled: true, flightAccepted: true },
      };
    default:
      return { totemId: tid };
  }
}

export type LabSystemTickResponse = {
  success?: boolean;
  winnerId?: string | null;
  winnerLane?: string | null;
  tdep?: { code?: string | null };
  maestro?: { cueSent?: boolean; player?: { code?: string | null } };
  proof?: { seller_sig?: string } | null;
  nowPlayingByTotem?: Array<{ totemId: number }>;
  mocks?: { playerAd?: boolean };
  optIn?: { aceEnabled?: boolean; source?: string; sqlCode?: string | null };
  ace?: { gatewayCode?: string | null; identityLeak?: boolean; hint?: { category?: string } | null };
};

export type LabTickSummary = {
  winnerId: string | null;
  winnerLane: string | null;
  tdepCode: string | null;
  cueSent: boolean;
  maestroCode: string | null;
  proofSig: string | null;
  totemCount: number;
  aceEnabled: boolean;
  optInSource: string | null;
  sqlCode: string | null;
  gatewayCode: string | null;
  hintCategory: string | null;
  identityLeak: boolean;
};

export function summarizeLabTick(result: LabSystemTickResponse | null | undefined): LabTickSummary {
  const proof = result?.proof && typeof result.proof === 'object' ? result.proof : null;
  const sig = typeof proof?.seller_sig === 'string' ? proof.seller_sig : null;
  return {
    winnerId: result?.winnerId ?? null,
    winnerLane: result?.winnerLane ?? null,
    tdepCode: result?.tdep?.code ?? null,
    cueSent: result?.maestro?.cueSent === true,
    maestroCode: result?.maestro?.player?.code ?? null,
    proofSig: sig,
    totemCount: Array.isArray(result?.nowPlayingByTotem) ? result.nowPlayingByTotem.length : 0,
    aceEnabled: result?.optIn?.aceEnabled === true,
    optInSource: result?.optIn?.source ?? null,
    sqlCode: result?.optIn?.sqlCode ?? null,
    gatewayCode: result?.ace?.gatewayCode ?? null,
    hintCategory: result?.ace?.hint?.category ?? null,
    identityLeak: result?.ace?.identityLeak === true,
  };
}
