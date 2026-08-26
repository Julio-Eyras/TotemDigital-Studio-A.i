/**
 * Lane TDEP 0.1 no Dispatcher de lab.
 * local > guaranteed > fill > idle. Default off. Sem media_id.
 */

export type TdepLane = 'local' | 'tdep_guaranteed' | 'tdep_fill' | 'idle';

export interface TdepLaneCandidate {
  id: string;
  weight?: number;
  baseWeight?: number;
  commercialTier?: string;
  lane?: TdepLane;
}

export interface TdepLaneState {
  enabled?: boolean;
  killSwitch?: boolean;
  flightAccepted?: boolean;
  flightPriority?: 'fill' | 'guaranteed' | 'preemptible';
  capSharePct?: number;
  shareUsedPct?: number;
  wantSharePct?: number;
}

export interface TdepLaneResult {
  ranked: Array<TdepLaneCandidate & { lane: TdepLane }>;
  winnerId: string | null;
  winnerLane: TdepLane | null;
  code: string | null;
}

const LANE_ORDER: Record<TdepLane, number> = {
  local: 0,
  tdep_guaranteed: 1,
  tdep_fill: 2,
  idle: 3,
};

const TDEP_LANES = new Set<TdepLane>(['tdep_guaranteed', 'tdep_fill']);

export function isTdepFillEnabledInCapabilities(capabilities: unknown): boolean {
  let cap: Record<string, unknown> | null = null;
  if (typeof capabilities === 'string') {
    try {
      cap = JSON.parse(capabilities) as Record<string, unknown>;
    } catch {
      return false;
    }
  } else if (capabilities && typeof capabilities === 'object') {
    cap = capabilities as Record<string, unknown>;
  }
  if (!cap) {
    return false;
  }
  if (cap.tdep_fill_enabled === true) {
    return true;
  }
  const nested = cap.tdep;
  if (nested && typeof nested === 'object' && (nested as { fill_enabled?: unknown }).fill_enabled === true) {
    return true;
  }
  return false;
}

export function inferTdepLane(row: TdepLaneCandidate): TdepLane {
  if (row.lane && row.lane in LANE_ORDER) {
    return row.lane;
  }
  if (row.commercialTier === 'remnant' || row.id === 'idle') {
    return 'idle';
  }
  return 'local';
}

export function applyTdepLane(
  candidates: TdepLaneCandidate[],
  state: TdepLaneState = {}
): TdepLaneResult {
  const rows = candidates.map((c) => ({ ...c, lane: inferTdepLane(c) }));
  const enabled = state.enabled === true;
  const killSwitch = state.killSwitch === true;
  const flightAccepted = state.flightAccepted === true;
  const flightPriority = state.flightPriority || 'fill';
  const capSharePct = state.capSharePct ?? 10;
  const shareUsedPct = state.shareUsedPct ?? 0;
  const wantSharePct = state.wantSharePct ?? 1;

  let code: string | null = null;
  let playable = rows;
  if (!enabled) {
    playable = rows.filter((r) => !TDEP_LANES.has(r.lane));
    code = 'TOTEMNET_OFF';
  } else if (killSwitch) {
    playable = rows.filter((r) => !TDEP_LANES.has(r.lane));
    code = 'KILL_SWITCH';
  } else if (!flightAccepted) {
    playable = rows.filter((r) => !TDEP_LANES.has(r.lane));
    code = 'NO_FLIGHT';
  } else {
    const capHit = shareUsedPct + wantSharePct > capSharePct;
    const drop = new Set<TdepLane>();
    if (capHit) {
      drop.add('tdep_guaranteed');
      if (flightPriority !== 'fill' || shareUsedPct + 1 > capSharePct) {
        drop.add('tdep_fill');
      }
      code = 'NO_CAPACITY';
    }
    if (flightPriority === 'fill') {
      drop.add('tdep_guaranteed');
    } else if (flightPriority === 'guaranteed') {
      drop.add('tdep_fill');
    }
    playable = rows.filter((r) => !drop.has(r.lane));
  }

  playable.sort((a, b) => {
    const laneDelta = LANE_ORDER[a.lane] - LANE_ORDER[b.lane];
    if (laneDelta !== 0) {
      return laneDelta;
    }
    return (b.weight ?? b.baseWeight ?? 0) - (a.weight ?? a.baseWeight ?? 0);
  });
  const winner = playable[0] || null;
  if (winner && TDEP_LANES.has(winner.lane)) {
    code = null;
  }
  return {
    ranked: playable,
    winnerId: winner?.id ?? null,
    winnerLane: winner?.lane ?? null,
    code,
  };
}

export function mergeTdepFillCapabilities(
  existing: unknown,
  patch: { enabled?: boolean; killSwitch?: boolean; capSharePct?: number }
): Record<string, unknown> {
  let cap: Record<string, unknown> = {};
  if (typeof existing === 'string') {
    try {
      const parsed = JSON.parse(existing) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        cap = { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      cap = {};
    }
  } else if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    cap = { ...(existing as Record<string, unknown>) };
  }
  if (patch.enabled !== undefined) {
    cap.tdep_fill_enabled = patch.enabled === true;
  }
  if (patch.killSwitch !== undefined) {
    cap.tdep_kill_switch = patch.killSwitch === true;
  }
  if (patch.capSharePct !== undefined) {
    const n = Math.round(Number(patch.capSharePct));
    cap.tdep_cap_share_pct = Math.min(10, Math.max(1, Number.isFinite(n) ? n : 10));
  }
  return cap;
}
