export type TdepFillForm = {
  enabled: boolean;
  killSwitch: boolean;
  capSharePct: number;
};

const DEFAULT_FILL: TdepFillForm = {
  enabled: false,
  killSwitch: false,
  capSharePct: 10,
};

function asCaps(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function readTdepFillFromTotem(totem: Record<string, unknown> | null | undefined): TdepFillForm {
  const caps = asCaps(totem?.capabilities ?? totem?.Capabilities);
  const nested = caps.tdep && typeof caps.tdep === 'object' ? (caps.tdep as Record<string, unknown>) : {};
  const enabled = caps.tdep_fill_enabled === true || nested.fill_enabled === true;
  const killSwitch = caps.tdep_kill_switch === true || nested.kill_switch === true;
  const capRaw = Number(caps.tdep_cap_share_pct ?? nested.cap_share_pct ?? 10);
  const capSharePct = Math.min(10, Math.max(1, Number.isFinite(capRaw) ? Math.round(capRaw) : 10));
  return { enabled, killSwitch, capSharePct };
}

export function tdepFillPayload(form: TdepFillForm): TdepFillForm {
  const capRaw = Math.round(Number(form.capSharePct));
  return {
    enabled: form.enabled === true,
    killSwitch: form.killSwitch === true,
    capSharePct: Math.min(10, Math.max(1, Number.isFinite(capRaw) ? capRaw : 10)),
  };
}

export { DEFAULT_FILL };