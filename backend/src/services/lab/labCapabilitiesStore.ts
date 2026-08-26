/**
 * Capabilities de totem em RAM — mock do SQL ACE opt-in.
 * Mesmo merge que scripts/lab-ace/optin-totem-lab.sql. Sem Postgres.
 */

import { isAceEnabledInCapabilities } from '../ace/aceRuleEngine';

export type LabCapabilities = Record<string, unknown>;

const store = new Map<number, LabCapabilities>();

export function resetLabCapabilitiesStoreForTests(): void {
  store.clear();
}

export function sqlEnableAce(caps: LabCapabilities = {}): LabCapabilities {
  return { ...caps, ace_enabled: true };
}

export function sqlDisableAce(caps: LabCapabilities = {}): LabCapabilities {
  const next: LabCapabilities = { ...caps };
  delete next.ace_enabled;
  return { ...next, ace_enabled: false };
}

export function getLabCapabilities(totemId: number): LabCapabilities {
  return { ...(store.get(totemId) || {}) };
}

export function putLabCapabilities(totemId: number, caps: LabCapabilities): LabCapabilities {
  store.set(totemId, { ...caps });
  return getLabCapabilities(totemId);
}

export function putLabAceOptIn(totemId: number, enabled: boolean): LabCapabilities {
  const prev = getLabCapabilities(totemId);
  const next = enabled === true ? sqlEnableAce(prev) : sqlDisableAce(prev);
  store.set(totemId, next);
  return next;
}

export function labAceOptInSnapshot(totemId: number): {
  totemId: number;
  capabilities: LabCapabilities;
  aceEnabled: boolean;
  mock: true;
  sql: 'optin-totem-lab.sql';
} {
  const capabilities = getLabCapabilities(totemId);
  return {
    totemId,
    capabilities,
    aceEnabled: isAceEnabledInCapabilities(capabilities),
    mock: true,
    sql: 'optin-totem-lab.sql',
  };
}
