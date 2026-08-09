/** Leitura/formatação de horário de tela e relógio reportado pelo Player-AD. */

export type DisplayScheduleInfo = {
  enabled: boolean;
  timezone: string;
  daysOfWeek: number[];
  onTime: string;
  offTime: string;
  keepAliveWhileOff: boolean;
  keepAliveIntervalMinutes: number;
};

export type DeviceClockInfo = {
  localFormatted: string;
  timezoneId: string;
  epochMs: number;
  reportedAtMs: number;
  serverReceivedAtMs: number;
  clockDriftMs: number;
};

export const DISPLAY_SCHEDULE_DAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

export const DEFAULT_DISPLAY_SCHEDULE: DisplayScheduleInfo = {
  enabled: false,
  timezone: 'America/Sao_Paulo',
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  onTime: '08:00',
  offTime: '22:00',
  keepAliveWhileOff: true,
  keepAliveIntervalMinutes: 10,
};

function playerSettingsOf(totem: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return (totem?.playerSettings || totem?.player_settings || {}) as Record<string, unknown>;
}

export function normalizeHmInput(raw: string, fallback = '08:00'): string {
  const s = String(raw || '').trim();
  const m = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(s);
  if (!m) return fallback;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function readScheduleFromTotem(
  totem: Record<string, unknown> | null | undefined
): DisplayScheduleInfo {
  const settings = playerSettingsOf(totem);
  const raw = (settings.displaySchedule || {}) as Record<string, unknown>;
  const days = Array.isArray(raw.daysOfWeek)
    ? raw.daysOfWeek.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6)
    : DEFAULT_DISPLAY_SCHEDULE.daysOfWeek;
  return {
    enabled: raw.enabled === true,
    timezone: String(raw.timezone || DEFAULT_DISPLAY_SCHEDULE.timezone),
    daysOfWeek: days.length ? days : DEFAULT_DISPLAY_SCHEDULE.daysOfWeek,
    onTime: normalizeHmInput(String(raw.onTime || ''), DEFAULT_DISPLAY_SCHEDULE.onTime),
    offTime: normalizeHmInput(String(raw.offTime || ''), DEFAULT_DISPLAY_SCHEDULE.offTime),
    keepAliveWhileOff: raw.keepAliveWhileOff !== false,
    keepAliveIntervalMinutes: Math.min(
      30,
      Math.max(5, Number(raw.keepAliveIntervalMinutes) || DEFAULT_DISPLAY_SCHEDULE.keepAliveIntervalMinutes)
    ),
  };
}

export function readDeviceClockFromTotem(
  totem: Record<string, unknown> | null | undefined
): DeviceClockInfo | null {
  const settings = playerSettingsOf(totem);
  const raw = (settings.reportedDeviceClock || settings.deviceClock || null) as Record<
    string,
    unknown
  > | null;
  if (!raw || typeof raw !== 'object') return null;
  const epochMs = Number(raw.epochMs || raw.reportedAtMs || 0);
  const localFormatted = String(raw.localFormatted || '').trim();
  const timezoneId = String(raw.timezoneId || raw.timezone || '').trim();
  if (!localFormatted && !epochMs) return null;
  return {
    localFormatted: localFormatted || (epochMs ? new Date(epochMs).toLocaleString('pt-BR') : '—'),
    timezoneId: timezoneId || '—',
    epochMs,
    reportedAtMs: Number(raw.reportedAtMs || epochMs || 0),
    serverReceivedAtMs: Number(raw.serverReceivedAtMs || raw.server_received_at_ms || 0),
    clockDriftMs: Number(raw.clockDriftMs || raw.clock_drift_ms || 0),
  };
}

export function formatScheduleDaysLabel(daysOfWeek: number[]): string {
  const set = new Set(daysOfWeek);
  if (set.size >= 7) return 'Todos os dias';
  const labels = DISPLAY_SCHEDULE_DAY_OPTIONS.filter((d) => set.has(d.value)).map((d) => d.label);
  return labels.length ? labels.join(', ') : '—';
}

/** Data/hora do Player-AD (heartbeat), ou placeholder. */
export function formatDeviceClockDisplay(
  totem: Record<string, unknown> | null | undefined,
  nowMs = Date.now(),
): string {
  const clock = readDeviceClockFromTotem(totem);
  return clock ? formatEstimatedDeviceClock(clock, nowMs) : '— aguardando heartbeat —';
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(Math.abs(milliseconds) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}min ${remainder}s` : `${minutes}min`;
}

function formatEstimatedDeviceClock(clock: DeviceClockInfo, nowMs: number): string {
  if (!clock.epochMs || !clock.serverReceivedAtMs) return clock.localFormatted;
  const estimatedEpochMs = clock.epochMs + Math.max(0, nowMs - clock.serverReceivedAtMs);
  try {
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone: clock.timezoneId === '—' ? undefined : clock.timezoneId,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(estimatedEpochMs));
    return `${formatted}${clock.timezoneId !== '—' ? ` (${clock.timezoneId})` : ''}`;
  } catch {
    return clock.localFormatted;
  }
}

/** Texto curto para cards / listagens. */
export function formatTotemScheduleCardLines(
  totem: Record<string, unknown> | null | undefined,
  nowMs = Date.now(),
): {
  deviceClockLine: string;
  deviceClockWarningLine: string;
  scheduleLine: string;
  daysLine: string;
} {
  const clock = readDeviceClockFromTotem(totem);
  const schedule = readScheduleFromTotem(totem);
  const reportAgeMs =
    clock?.serverReceivedAtMs && nowMs >= clock.serverReceivedAtMs
      ? nowMs - clock.serverReceivedAtMs
      : null;

  const deviceClockLine = clock
    ? `Horário da tela: ${formatEstimatedDeviceClock(clock, nowMs)}${
      reportAgeMs !== null ? ` · reportado há ${formatDuration(reportAgeMs)}` : ''
    }`
    : 'Horário da tela: — aguardando heartbeat —';
  const deviceClockWarningLine =
    clock && Math.abs(clock.clockDriftMs) >= 120_000
      ? `⚠ TV Box ${clock.clockDriftMs > 0 ? 'adiantado' : 'atrasado'} ${formatDuration(
        clock.clockDriftMs,
      )} em relação ao servidor`
      : '';

  if (!schedule.enabled) {
    return {
      deviceClockLine,
      deviceClockWarningLine,
      scheduleLine: 'Ligar/desligar: desativado (sempre ligada)',
      daysLine: '',
    };
  }

  return {
    deviceClockLine,
    deviceClockWarningLine,
    scheduleLine: `Liga ${schedule.onTime} · Desliga ${schedule.offTime}`,
    daysLine: `Dias: ${formatScheduleDaysLabel(schedule.daysOfWeek)}`,
  };
}

export type PollAdaptiveInfo = {
  enabled: boolean;
  unchangedStreakBeforeSleep: number;
  sleepGrowthFactor: number;
  maxHeartbeatSeconds: number;
  maxDispatchSeconds: number;
  idleHeartbeatSeconds: number;
  idleDispatchSeconds: number;
};

export const DEFAULT_POLL_ADAPTIVE: PollAdaptiveInfo = {
  enabled: true,
  unchangedStreakBeforeSleep: 2,
  sleepGrowthFactor: 2,
  maxHeartbeatSeconds: 600,
  maxDispatchSeconds: 1800,
  idleHeartbeatSeconds: 120,
  idleDispatchSeconds: 600,
};

export function readPollAdaptiveFromTotem(
  totem: Record<string, unknown> | null | undefined
): PollAdaptiveInfo {
  const settings = playerSettingsOf(totem);
  const raw = (settings.pollAdaptive || {}) as Record<string, unknown>;
  return {
    enabled: raw.enabled !== false,
    unchangedStreakBeforeSleep: Math.min(
      20,
      Math.max(1, Number(raw.unchangedStreakBeforeSleep) || DEFAULT_POLL_ADAPTIVE.unchangedStreakBeforeSleep)
    ),
    sleepGrowthFactor: Math.min(
      4,
      Math.max(1.1, Number(raw.sleepGrowthFactor) || DEFAULT_POLL_ADAPTIVE.sleepGrowthFactor)
    ),
    maxHeartbeatSeconds: Math.min(
      3600,
      Math.max(60, Number(raw.maxHeartbeatSeconds) || DEFAULT_POLL_ADAPTIVE.maxHeartbeatSeconds)
    ),
    maxDispatchSeconds: Math.min(
      7200,
      Math.max(120, Number(raw.maxDispatchSeconds) || DEFAULT_POLL_ADAPTIVE.maxDispatchSeconds)
    ),
    idleHeartbeatSeconds: Math.min(
      3600,
      Math.max(30, Number(raw.idleHeartbeatSeconds) || DEFAULT_POLL_ADAPTIVE.idleHeartbeatSeconds)
    ),
    idleDispatchSeconds: Math.min(
      7200,
      Math.max(60, Number(raw.idleDispatchSeconds) || DEFAULT_POLL_ADAPTIVE.idleDispatchSeconds)
    ),
  };
}

