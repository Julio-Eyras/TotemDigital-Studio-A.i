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
    onTime: String(raw.onTime || DEFAULT_DISPLAY_SCHEDULE.onTime),
    offTime: String(raw.offTime || DEFAULT_DISPLAY_SCHEDULE.offTime),
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
  totem: Record<string, unknown> | null | undefined
): string {
  const clock = readDeviceClockFromTotem(totem);
  return clock?.localFormatted || '— aguardando heartbeat —';
}

/** Texto curto para cards / listagens. */
export function formatTotemScheduleCardLines(totem: Record<string, unknown> | null | undefined): {
  deviceClockLine: string;
  scheduleLine: string;
  daysLine: string;
} {
  const clock = readDeviceClockFromTotem(totem);
  const schedule = readScheduleFromTotem(totem);

  const deviceClockLine = clock
    ? `Horário da tela: ${clock.localFormatted}`
    : 'Horário da tela: — aguardando heartbeat —';

  if (!schedule.enabled) {
    return {
      deviceClockLine,
      scheduleLine: 'Ligar/desligar: desativado (sempre ligada)',
      daysLine: '',
    };
  }

  return {
    deviceClockLine,
    scheduleLine: `Liga ${schedule.onTime} · Desliga ${schedule.offTime}`,
    daysLine: `Dias: ${formatScheduleDaysLabel(schedule.daysOfWeek)}`,
  };
}
