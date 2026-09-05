/**
 * Modo simples por totem ou instalação (mix round-robin, UI sem agendamento).
 */

import { getDatabase } from '../config/database';
import { TOTEMDIGITAL_COMPACT } from '../config/featureFlags';
import {
  getInstallationProfileFromEnv,
  isSinglePublisherInstallation,
} from '../policy/installationPolicy';

export const TOTEM_SIMPLE_MODE_SETTING_KEY = 'totem.simple_mode_enabled';

function parseBooleanSetting(value: unknown): boolean | undefined {
  if (value == null) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

function parseCapabilities(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as unknown as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? (parsed as unknown as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function resolveSimpleTotemModeDefault(): boolean {
  const env = process.env.SIMPLE_TOTEM_MODE_DEFAULT?.trim().toLowerCase();
  if (env === 'true' || env === '1') return true;
  if (env === 'false' || env === '0') return false;
  return TOTEMDIGITAL_COMPACT || isSinglePublisherInstallation(getInstallationProfileFromEnv());
}

export async function isTotemSimpleModeEnabled(totemId: number): Promise<boolean> {
  const db = getDatabase();

  const totemRow = await db.findFirst(
    `SELECT capabilities FROM totems WHERE totem_id = $1 LIMIT 1`,
    [totemId]
  );
  const caps = parseCapabilities(totemRow?.capabilities);
  if (caps?.simpleMode === false) return false;
  if (caps?.simpleMode === true) return true;

  const settingRow = await db.findFirst(
    `SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1`,
    [TOTEM_SIMPLE_MODE_SETTING_KEY]
  );
  const fromSetting = parseBooleanSetting(settingRow?.setting_value);
  if (fromSetting !== undefined) return fromSetting;

  return resolveSimpleTotemModeDefault();
}

export async function resolveInstallationSimpleTotemMode(db?: {
  findFirst: (sql: string, params?: unknown[]) => Promise<{ setting_value?: string } | null>;
}): Promise<boolean> {
  if (!db) {
    return resolveSimpleTotemModeDefault();
  }
  try {
    const row = await db.findFirst(
      `SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1`,
      [TOTEM_SIMPLE_MODE_SETTING_KEY]
    );
    const fromSetting = parseBooleanSetting(row?.setting_value);
    if (fromSetting !== undefined) return fromSetting;
  } catch {
    // ignore
  }
  return resolveSimpleTotemModeDefault();
}
