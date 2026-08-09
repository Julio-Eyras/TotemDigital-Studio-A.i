import {
  formatDeviceClockDisplay,
  formatTotemScheduleCardLines,
  readDeviceClockFromTotem,
} from './totemDisplaySchedule';

describe('totemDisplaySchedule', () => {
  const receivedAt = Date.parse('2026-08-09T03:00:00.000Z');
  const totem = {
    playerSettings: {
      reportedDeviceClock: {
        localFormatted: '08/08/2026 23:57:00',
        timezoneId: 'America/Sao_Paulo',
        epochMs: receivedAt - 3 * 60_000,
        reportedAtMs: receivedAt - 3 * 60_000,
        serverReceivedAtMs: receivedAt,
        clockDriftMs: -3 * 60_000,
      },
      displaySchedule: {
        enabled: true,
        onTime: '08:00',
        offTime: '22:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
    },
  };

  it('avança o relógio reportado pelo tempo transcorrido no navegador', () => {
    const initial = formatDeviceClockDisplay(totem, receivedAt);
    const tenSecondsLater = formatDeviceClockDisplay(totem, receivedAt + 10_000);

    expect(initial).not.toBe(tenSecondsLater);
    expect(tenSecondsLater).toContain('23:57:10');
  });

  it('informa idade da amostra e alerta divergência acima de dois minutos', () => {
    const lines = formatTotemScheduleCardLines(totem, receivedAt + 5_000);
    const clock = readDeviceClockFromTotem(totem);

    expect(clock?.serverReceivedAtMs).toBe(receivedAt);
    expect(lines.deviceClockLine).toContain('reportado há 5s');
    expect(lines.deviceClockWarningLine).toContain('TV Box atrasado 3min');
  });
});
