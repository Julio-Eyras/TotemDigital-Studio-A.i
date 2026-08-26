/**
 * Tabela lab no formato totems.capabilities (SELECT / UPDATE).
 * Default desligada (NO_DATABASE). HTTP do tick não escreve Postgres real.
 * UPDATE ao vivo só no script humano optin-totem-lab.sql.
 */

import { isAceEnabledInCapabilities } from '../ace/aceRuleEngine';
import { sqlDisableAce, sqlEnableAce, type LabCapabilities } from './labCapabilitiesStore';

export type LabAceSqlCode = 'OK' | 'NO_DATABASE' | 'NO_TOTEM';

export type LabAceSqlSelect = {
  code: LabAceSqlCode;
  capabilities: LabCapabilities;
  aceEnabled: boolean;
};

export type LabAceSqlApply = LabAceSqlSelect & { applied: boolean };

const rows = new Map<number, LabCapabilities>();
let connected = false;

export function resetLabAceSqlForTests(): void {
  rows.clear();
  connected = false;
}

export function setLabAceSqlConnected(value: boolean): void {
  connected = value === true;
}

export function isLabAceSqlConnected(): boolean {
  return connected;
}

export function putLabAceSqlRow(totemId: number, capabilities: LabCapabilities = {}): LabCapabilities {
  const next = { ...capabilities };
  rows.set(totemId, next);
  connected = true;
  return { ...next };
}

export function getLabAceSqlRow(totemId: number): LabCapabilities | null {
  const row = rows.get(totemId);
  return row ? { ...row } : null;
}

export function selectLabAceSql(
  totemId: number,
  override?: { connected?: boolean; row?: LabCapabilities | null }
): LabAceSqlSelect {
  const on = override?.connected ?? connected;
  if (on !== true) {
    return { code: 'NO_DATABASE', capabilities: {}, aceEnabled: false };
  }
  const row = override && 'row' in override ? override.row : getLabAceSqlRow(totemId);
  if (row == null) {
    return { code: 'NO_TOTEM', capabilities: {}, aceEnabled: false };
  }
  const capabilities = { ...row };
  return {
    code: 'OK',
    capabilities,
    aceEnabled: isAceEnabledInCapabilities(capabilities),
  };
}

export function applyLabAceSql(
  totemId: number,
  enabled: boolean,
  opts?: { apply?: boolean }
): LabAceSqlApply {
  const selected = selectLabAceSql(totemId);
  if (selected.code !== 'OK') {
    return { ...selected, applied: false };
  }
  const capabilities = enabled === true ? sqlEnableAce(selected.capabilities) : sqlDisableAce(selected.capabilities);
  if (opts?.apply !== true) {
    return {
      code: 'OK',
      applied: false,
      capabilities,
      aceEnabled: isAceEnabledInCapabilities(capabilities),
    };
  }
  rows.set(totemId, capabilities);
  return {
    code: 'OK',
    applied: true,
    capabilities: { ...capabilities },
    aceEnabled: isAceEnabledInCapabilities(capabilities),
  };
}
