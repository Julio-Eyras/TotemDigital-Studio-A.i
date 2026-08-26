/** Store in-memory da UI/lab TDEP fill. Sem Postgres. */

export interface TdepFillRecord {
  enabled: boolean;
  killSwitch: boolean;
  capSharePct: number;
}

const store = new Map<number, TdepFillRecord>();

export function resetTdepFillStoreForTests(): void {
  store.clear();
}

export function getTdepFillStore() {
  return {
    get(totemId: number): TdepFillRecord {
      return store.get(totemId) || { enabled: false, killSwitch: false, capSharePct: 10 };
    },
    put(totemId: number, patch: Partial<TdepFillRecord>): TdepFillRecord {
      const prev = store.get(totemId) || { enabled: false, killSwitch: false, capSharePct: 10 };
      const capRaw = patch.capSharePct ?? prev.capSharePct;
      const capN = Math.round(Number(capRaw));
      const next: TdepFillRecord = {
        enabled: patch.enabled ?? prev.enabled,
        killSwitch: patch.killSwitch ?? prev.killSwitch,
        capSharePct: Math.min(10, Math.max(1, Number.isFinite(capN) ? capN : 10)),
      };
      store.set(totemId, next);
      return next;
    },
  };
}