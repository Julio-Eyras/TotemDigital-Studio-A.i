/**
 * Horário de tela por totem (displaySchedule em totems.player_settings).
 */

export type DisplayForceMode = 'on' | 'off' | null;

export interface DisplaySchedule {
  enabled: boolean;
  timezone: string;
  /** 0=domingo … 6=sábado (Date.getDay) */
  daysOfWeek: number[];
  onTime: string;
  offTime: string;
  keepAliveWhileOff: boolean;
  keepAliveIntervalMinutes: number;
  forceMode: DisplayForceMode;
}

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HH_MM_FLEX = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export const DEFAULT_DISPLAY_SCHEDULE: DisplaySchedule = {
  enabled: false,
  timezone: 'America/Sao_Paulo',
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  onTime: '08:00',
  offTime: '22:00',
  keepAliveWhileOff: true,
  keepAliveIntervalMinutes: 10,
  forceMode: null,
};

/** Aceita HH:mm ou HH:mm:ss (browsers/mobile) e devolve HH:mm. */
export function normalizeHmString(raw: unknown, fallback = '00:00'): string {
  const s = String(raw ?? '').trim();
  const m = HH_MM_FLEX.exec(s);
  if (!m) return fallback;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function parseHm(value: string): number {
  const normalized = normalizeHmString(value, '');
  const m = HH_MM.exec(normalized);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function normalizeDisplaySchedule(raw: unknown): DisplaySchedule {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const daysRaw = Array.isArray(src.daysOfWeek) ? src.daysOfWeek : DEFAULT_DISPLAY_SCHEDULE.daysOfWeek;
  const days = Array.from(
    new Set(
      daysRaw
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    )
  ).sort((a, b) => a - b);

  const onTime = normalizeHmString(src.onTime ?? DEFAULT_DISPLAY_SCHEDULE.onTime, DEFAULT_DISPLAY_SCHEDULE.onTime);
  const offTime = normalizeHmString(src.offTime ?? DEFAULT_DISPLAY_SCHEDULE.offTime, DEFAULT_DISPLAY_SCHEDULE.offTime);
  const forceRaw = src.forceMode;
  const forceMode: DisplayForceMode =
    forceRaw === 'on' || forceRaw === 'off' ? forceRaw : null;

  const keepAliveIntervalMinutes = Math.min(
    30,
    Math.max(5, Number(src.keepAliveIntervalMinutes ?? DEFAULT_DISPLAY_SCHEDULE.keepAliveIntervalMinutes) || 10)
  );

  return {
    enabled: src.enabled === true,
    timezone: String(src.timezone || DEFAULT_DISPLAY_SCHEDULE.timezone).trim() || DEFAULT_DISPLAY_SCHEDULE.timezone,
    daysOfWeek: days.length > 0 ? days : [...DEFAULT_DISPLAY_SCHEDULE.daysOfWeek],
    onTime: HH_MM.test(onTime) ? onTime : DEFAULT_DISPLAY_SCHEDULE.onTime,
    offTime: HH_MM.test(offTime) ? offTime : DEFAULT_DISPLAY_SCHEDULE.offTime,
    keepAliveWhileOff: src.keepAliveWhileOff !== false,
    keepAliveIntervalMinutes,
    forceMode,
  };
}

export function validateDisplayScheduleInput(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return 'displaySchedule deve ser um objeto';
  }
  const s = raw as Record<string, unknown>;
  if (s.onTime != null) {
    const n = normalizeHmString(s.onTime, '');
    if (!HH_MM.test(n)) return 'onTime inválido (use HH:mm)';
  }
  if (s.offTime != null) {
    const n = normalizeHmString(s.offTime, '');
    if (!HH_MM.test(n)) return 'offTime inválido (use HH:mm)';
  }
  if (s.onTime != null && s.offTime != null) {
    const on = normalizeHmString(s.onTime);
    const off = normalizeHmString(s.offTime);
    if (on === off) return 'onTime e offTime não podem ser iguais';
  }
  if (s.daysOfWeek != null) {
    if (!Array.isArray(s.daysOfWeek)) return 'daysOfWeek deve ser um array';
    for (const d of s.daysOfWeek) {
      const n = Number(d);
      if (!Number.isInteger(n) || n < 0 || n > 6) {
        return 'daysOfWeek deve conter inteiros 0–6';
      }
    }
  }
  if (s.forceMode != null && s.forceMode !== 'on' && s.forceMode !== 'off') {
    return 'forceMode deve ser null, "on" ou "off"';
  }
  if (s.keepAliveIntervalMinutes != null) {
    const n = Number(s.keepAliveIntervalMinutes);
    if (!Number.isFinite(n) || n < 5 || n > 30) {
      return 'keepAliveIntervalMinutes deve estar entre 5 e 30';
    }
  }
  return null;
}

/** Merge parcial de displaySchedule dentro de player_settings. */
export function mergePlayerSettingsWithDisplaySchedule(
  existingSettings: unknown,
  displaySchedulePatch: unknown
): Record<string, unknown> {
  const base =
    existingSettings && typeof existingSettings === 'object' && !Array.isArray(existingSettings)
      ? { ...(existingSettings as Record<string, unknown>) }
      : {};
  const prev = normalizeDisplaySchedule(base.displaySchedule);
  const patch =
    displaySchedulePatch && typeof displaySchedulePatch === 'object' && !Array.isArray(displaySchedulePatch)
      ? (displaySchedulePatch as Record<string, unknown>)
      : {};
  const merged = normalizeDisplaySchedule({ ...prev, ...patch });
  return { ...base, displaySchedule: merged };
}

export function extractDisplayScheduleFromPlayerSettings(settings: unknown): DisplaySchedule {
  const obj =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  return normalizeDisplaySchedule(obj.displaySchedule);
}

/**
 * true = tela deve exibir conteúdo; false = idle (preto).
 */
export function isDisplayActiveNow(schedule: DisplaySchedule, now: Date = new Date()): boolean {
  if (schedule.forceMode === 'on') return true;
  if (schedule.forceMode === 'off') return false;
  if (!schedule.enabled) return true;

  let local: Date;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: schedule.timezone || 'UTC',
      hour12: false,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = fmt.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const day = weekdayMap[get('weekday')] ?? now.getDay();
    if (!schedule.daysOfWeek.includes(day)) return false;

    const hour = Number(get('hour') === '24' ? '0' : get('hour'));
    const minute = Number(get('minute'));
    const nowMins = hour * 60 + minute;
    const onMins = parseHm(schedule.onTime);
    const offMins = parseHm(schedule.offTime);
    if (!Number.isFinite(onMins) || !Number.isFinite(offMins)) return true;

    if (onMins === offMins) return true;
    if (offMins > onMins) {
      return nowMins >= onMins && nowMins < offMins;
    }
    // Cruza meia-noite (ex.: 22:00 → 06:00)
    return nowMins >= onMins || nowMins < offMins;
  } catch {
    local = now;
    const day = local.getDay();
    if (!schedule.daysOfWeek.includes(day)) return false;
    const nowMins = local.getHours() * 60 + local.getMinutes();
    const onMins = parseHm(schedule.onTime);
    const offMins = parseHm(schedule.offTime);
    if (!Number.isFinite(onMins) || !Number.isFinite(offMins) || onMins === offMins) return true;
    if (offMins > onMins) return nowMins >= onMins && nowMins < offMins;
    return nowMins >= onMins || nowMins < offMins;
  }
}
