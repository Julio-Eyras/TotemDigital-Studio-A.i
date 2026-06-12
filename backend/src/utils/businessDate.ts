/** Datas de negócio (campanhas, contratos) — calendário em America/Sao_Paulo. */

export const BUSINESS_TZ = 'America/Sao_Paulo';

/**
 * Converte valor para YYYY-MM-DD no fuso informado.
 * Campos DATE puros (yyyy-mm-dd) são preservados sem deslocamento.
 */
/**
 * DATE do Postgres via node-pg costuma vir como meia-noite UTC (ex.: 2026-06-12T00:00:00.000Z).
 * O dia civil pretendido é o prefixo YYYY-MM-DD, sem deslocar para o fuso de negócio.
 */
function parsePgDateMidnightUtc(value: string): string | null {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/);
  return match ? match[1] : null;
}

export function dateToYmd(value: string | Date, timeZone: string = BUSINESS_TZ): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const pgDate = parsePgDateMidnightUtc(trimmed);
    if (pgDate) return pgDate;
    if (trimmed.includes('T') || /:\d{2}/.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return formatDateInTimeZone(parsed, timeZone);
      }
    }
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return formatDateInTimeZone(d, timeZone);
}

export function todayYmd(timeZone: string = BUSINESS_TZ): string {
  return formatDateInTimeZone(new Date(), timeZone);
}

/** Soma dias no calendário civil (fuso de negócio), a partir de uma data base. */
export function addCalendarDaysYmd(
  base: string | Date,
  days: number,
  timeZone: string = BUSINESS_TZ
): string {
  const ymd = dateToYmd(base, timeZone);
  if (!ymd) return todayYmd(timeZone);
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return dateToYmd(anchor, timeZone);
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
