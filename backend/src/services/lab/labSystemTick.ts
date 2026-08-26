/**
 * Ciclo de sistema lab 0.1 — ACE + Maestro (mock) + TDEP (mock).
 * Sem Player-AD, TV box, câmara, Postgres ou /tdep/v1 de produto.
 */

import {
  LabAceTickInput,
  LabAceTickResult,
  LabCandidate,
  LabSsidBox,
  measureMaestroPair,
  measureSsidPair,
  mockMaestroPlayerAcceptsCue,
  mockTdepPartnerAccepts,
  runLabAceTick,
} from './labEmulation';
import { isAceEnabledInCapabilities } from '../ace/aceRuleEngine';
import {
  getLabCapabilities,
  resetLabCapabilitiesStoreForTests,
} from './labCapabilitiesStore';
import {
  applyTdepLane,
  TdepLane,
  TdepLaneCandidate,
  TdepLaneResult,
  TdepLaneState,
} from './tdepDispatchLane';
import {
  LabTdepProof,
  LAB_FLIGHT_ID,
  signLabTdepProof,
  verifyLabTdepProof,
} from './labTdepProof';

export const DEFAULT_LAB_CANDIDATES: LabCandidate[] = [
  { id: 'direct-local', baseWeight: 100, commercialTier: 'premium' },
  { id: 'network-std', baseWeight: 40, commercialTier: 'standard' },
  { id: 'fill-night', baseWeight: 10, commercialTier: 'remnant' },
];

const PLAYERS_BOX: LabSsidBox = { role: 'players', ssid: 'totem-players', bandGhz: 5 };

export interface LabMaestroTickInput {
  offsetAMs?: number;
  offsetBMs?: number;
  ntpOkA?: boolean;
  ntpOkB?: boolean;
  ssidA?: LabSsidBox;
  ssidB?: LabSsidBox;
  itemId?: string;
}

export interface LabTdepTickInput extends TdepLaneState {
  extraCandidates?: TdepLaneCandidate[];
  partnerPayload?: Record<string, unknown>;
  injectMockFill?: boolean;
}

export interface LabSystemTickInput {
  totemId?: number;
  totemIds?: number[];
  ace?: Omit<LabAceTickInput, 'candidates' | 'aceEnabled'> & {
    aceEnabled?: boolean;
    candidates?: LabCandidate[];
  };
  maestro?: LabMaestroTickInput;
  tdep?: LabTdepTickInput;
}

export interface LabNowPlaying {
  totemId: number;
  itemId: string;
  lane: TdepLane;
  mock: true;
  maestroCueSent: boolean;
  at: string;
}

export type LabAceOptInSource = 'body' | 'store' | 'default_off';

export interface LabAceOptInTick {
  aceEnabled: boolean;
  source: LabAceOptInSource;
  capabilities: Record<string, unknown>;
  mockSql: true;
}

export interface LabSystemTickResult {
  mocks: {
    playerAd: true;
    tvBox: true;
    camera: true;
    partnerCms: true;
  };
  optIn: LabAceOptInTick;
  ace: LabAceTickResult;
  maestro: {
    ntp: ReturnType<typeof measureMaestroPair>;
    ssid: ReturnType<typeof measureSsidPair>;
    player: { accepted: boolean; code: string | null };
    cueSent: boolean;
    itemId: string;
  };
  tdep: TdepLaneResult & { partner: { accepted: boolean; code: string | null } };
  winnerId: string | null;
  winnerLane: TdepLane | null;
  nowPlaying: LabNowPlaying | null;
  nowPlayingByTotem: LabNowPlaying[];
  proof: LabTdepProof | null;
  proofs: LabTdepProof[];
}

const nowPlaying = new Map<number, LabNowPlaying>();
const proofs = new Map<number, LabTdepProof[]>();
const revokedFlights = new Set<string>();

export function resetLabPlayerStoreForTests(): void {
  nowPlaying.clear();
  proofs.clear();
  revokedFlights.clear();
  resetLabCapabilitiesStoreForTests();
}

export function revokeLabFlight(flightId: string = LAB_FLIGHT_ID): string {
  revokedFlights.add(flightId);
  return flightId;
}

export function isLabFlightRevoked(flightId: string = LAB_FLIGHT_ID): boolean {
  return revokedFlights.has(flightId);
}

export function getLabNowPlaying(totemId: number): LabNowPlaying | null {
  return nowPlaying.get(totemId) || null;
}

export function listLabProofs(totemId: number): LabTdepProof[] {
  return proofs.get(totemId) || [];
}

function mapAceSlateToTdep(
  ranked: LabAceTickResult['ranked'],
  extra: TdepLaneCandidate[],
  injectMockFill: boolean,
  flightPriority: TdepLaneState['flightPriority']
): TdepLaneCandidate[] {
  const mapped: TdepLaneCandidate[] = ranked.map((c) => ({
    id: c.id,
    weight: c.weight,
    commercialTier: c.commercialTier,
    lane: c.commercialTier === 'remnant' || c.id === 'idle' ? 'idle' : 'local',
  }));
  if (!mapped.some((c) => c.lane === 'idle')) {
    mapped.push({ id: 'idle', weight: 1, lane: 'idle' });
  }
  const hasTdep = mapped.some((c) => c.lane === 'tdep_fill' || c.lane === 'tdep_guaranteed');
  if (injectMockFill && !hasTdep) {
    if (flightPriority === 'guaranteed') {
      mapped.push({ id: 'tdep-guaranteed-mock', weight: 900, lane: 'tdep_guaranteed' });
    } else {
      mapped.push({ id: 'tdep-fill-mock', weight: 900, lane: 'tdep_fill' });
    }
  }
  return [...mapped, ...extra];
}

function resolveAceOptIn(
  totemId: number,
  bodyEnabled: boolean | undefined
): LabAceOptInTick {
  const capabilities = getLabCapabilities(totemId);
  if (bodyEnabled === true) {
    return { aceEnabled: true, source: 'body', capabilities, mockSql: true };
  }
  if (bodyEnabled === false) {
    return { aceEnabled: false, source: 'body', capabilities, mockSql: true };
  }
  const aceEnabled = isAceEnabledInCapabilities(capabilities);
  return {
    aceEnabled,
    source: aceEnabled ? 'store' : 'default_off',
    capabilities,
    mockSql: true,
  };
}

export function runLabSystemTick(input: LabSystemTickInput = {}): LabSystemTickResult {
  const ids = (input.totemIds || [])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1);
  const totemId = ids[0] || Number(input.totemId || input.ace?.context?.totem_id || 41) || 41;
  const totemIds = ids.length ? ids : [totemId];
  const candidates = input.ace?.candidates?.length ? input.ace.candidates : DEFAULT_LAB_CANDIDATES;
  const optIn = resolveAceOptIn(totemId, input.ace?.aceEnabled);
  const ace = runLabAceTick({
    aceEnabled: optIn.aceEnabled,
    context: input.ace?.context,
    interaction: input.ace?.interaction,
    fxInteraction: input.ace?.fxInteraction,
    fxAi: input.ace?.fxAi,
    fxRule: input.ace?.fxRule,
    candidates,
  });

  const maestroIn = input.maestro || {};
  const ntp = measureMaestroPair(maestroIn.offsetAMs ?? 18, maestroIn.offsetBMs ?? 0, {
    ntpOkA: maestroIn.ntpOkA,
    ntpOkB: maestroIn.ntpOkB,
  });
  const ssid = measureSsidPair(maestroIn.ssidA || PLAYERS_BOX, maestroIn.ssidB || PLAYERS_BOX);
  const itemId = String(maestroIn.itemId || ace.winnerId || 'direct-local');
  const player = mockMaestroPlayerAcceptsCue(
    { clock: { ntp_ok: ntp.ntpOk, drift_ms: ntp.driftMs } },
    ssid
  );

  const tdepIn = input.tdep || {};
  const partner = mockTdepPartnerAccepts(tdepIn.partnerPayload || { schema: 'tdep/0.1', face_id: 'mock' });
  const injectMockFill = tdepIn.injectMockFill !== false;
  const flightPriority = tdepIn.flightPriority === 'guaranteed' ? 'guaranteed' : 'fill';
  const flightId = LAB_FLIGHT_ID;
  const revoked = tdepIn.revoked === true || isLabFlightRevoked(flightId);
  const tdep = applyTdepLane(
    mapAceSlateToTdep(ace.ranked, tdepIn.extraCandidates || [], injectMockFill, flightPriority),
    {
      enabled: tdepIn.enabled === true,
      killSwitch: tdepIn.killSwitch === true,
      revoked,
      flightAccepted: tdepIn.flightAccepted === true && partner.accepted,
      flightPriority,
      capSharePct: tdepIn.capSharePct,
      shareUsedPct: tdepIn.shareUsedPct,
      wantSharePct: tdepIn.wantSharePct,
    }
  );
  if (!partner.accepted && partner.code && tdep.code === 'NO_FLIGHT') {
    tdep.code = partner.code;
  }

  const winnerLane = tdep.winnerLane;
  const winnerId = tdep.winnerId;
  const cueSent = player.accepted === true && winnerLane === 'local';
  const tdepWon = winnerLane === 'tdep_fill' || winnerLane === 'tdep_guaranteed';
  const at = new Date().toISOString();

  const played: LabNowPlaying[] = [];
  const issued: LabTdepProof[] = [];
  if (winnerId && winnerLane) {
    for (const id of totemIds) {
      const row: LabNowPlaying = {
        totemId: id,
        itemId: winnerLane === 'local' ? itemId : winnerId,
        lane: winnerLane,
        mock: true,
        maestroCueSent: cueSent,
        at,
      };
      nowPlaying.set(id, row);
      played.push(row);
      if (tdepWon) {
        const signed = signLabTdepProof(winnerId, at);
        if (!verifyLabTdepProof(signed)) {
          throw new Error('lab proof HMAC invalido');
        }
        issued.push(signed);
        const list = proofs.get(id) || [];
        list.push(signed);
        proofs.set(id, list);
      }
    }
  }
  const playing = played[0] || null;
  const proof = issued[0] || null;

  return {
    mocks: { playerAd: true, tvBox: true, camera: true, partnerCms: true },
    optIn,
    ace,
    maestro: { ntp, ssid, player, cueSent, itemId },
    tdep: { ...tdep, partner },
    winnerId,
    winnerLane,
    nowPlaying: playing,
    nowPlayingByTotem: played,
    proof,
    proofs: issued,
  };
}
