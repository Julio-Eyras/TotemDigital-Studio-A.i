import { AceDispatchAudit, AceHint, AceInteraction, AudienceContext } from './aceTypes';
import { mergeInteractionIntoContext, seedContextFromInteraction } from './aceInteraction';
import { aceContextToHint } from './aceRuleEngine';

interface StoredAce {
  context: AudienceContext;
  hint: AceHint | null;
  storedAtMs: number;
}

const DEFAULT_TTL_MS = 3000;

class AceHintStore {
  private byTotem = new Map<number, StoredAce>();
  private ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  put(context: AudienceContext): AceHint | null {
    const hint = aceContextToHint(context);
    this.byTotem.set(context.totem_id, {
      context,
      hint,
      storedAtMs: Date.now(),
    });
    return hint;
  }

  mergeInteraction(
    totemId: number,
    interaction: AceInteraction,
    siteId?: string
  ): AceHint | null {
    const row = this.get(totemId);
    const next = row
      ? mergeInteractionIntoContext(row.context, interaction)
      : seedContextFromInteraction(totemId, interaction, siteId);
    return this.put(next);
  }

  get(totemId: number, nowMs = Date.now()): StoredAce | null {
    const row = this.byTotem.get(totemId);
    if (!row) return null;
    if (nowMs - row.storedAtMs > this.ttlMs) {
      this.byTotem.delete(totemId);
      return null;
    }
    return row;
  }

  audit(totemId: number, enabled: boolean): AceDispatchAudit {
    if (!enabled) {
      return { enabled: false, code: 'ACE_DISABLED', hint: null };
    }
    const row = this.get(totemId);
    if (!row) {
      return { enabled: true, code: 'NO_CONTEXT', hint: null };
    }
    if (!row.hint) {
      return { enabled: true, code: 'NO_HINT', hint: null };
    }
    return { enabled: true, code: 'HINT_APPLIED', hint: row.hint };
  }

  clear(totemId?: number): void {
    if (totemId == null) {
      this.byTotem.clear();
      return;
    }
    this.byTotem.delete(totemId);
  }
}

let instance: AceHintStore | null = null;

export function getAceHintStore(): AceHintStore {
  if (!instance) {
    instance = new AceHintStore();
  }
  return instance;
}

export function resetAceHintStoreForTests(): void {
  instance = new AceHintStore();
}
