/**
 * Datas de negócio — calendário America/Sao_Paulo (campanhas, contratos, faturas).
 * Campos DATE (yyyy-mm-dd) nunca são deslocados; timestamps ISO são convertidos para o dia civil BR.
 */

export const BUSINESS_TZ = 'America/Sao_Paulo';

function formatDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * DATE do Postgres via node-pg costuma vir como meia-noite UTC (ex.: 2026-06-12T00:00:00.000Z).
 * O dia civil pretendido é o prefixo YYYY-MM-DD, sem deslocar para o fuso de negócio.
 */
function parsePgDateMidnightUtc(value: string): string | null {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/);
  return match ? match[1] : null;
}

/** Converte valor para YYYY-MM-DD no fuso de negócio. */
export function dateToYmd(
  value?: string | Date | null,
  timeZone: string = BUSINESS_TZ
): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
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
    return '';
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return formatDateInTimeZone(value, timeZone);
  }
  return '';
}

/** Hoje no calendário de negócio (Brasil). */
export function todayYmd(timeZone: string = BUSINESS_TZ): string {
  return formatDateInTimeZone(new Date(), timeZone);
}

/** Alias para inputs HTML type="date". */
export function formatDateForInput(dateValue?: string | Date | null): string {
  return dateToYmd(dateValue);
}

/** Início padrão de contrato / formulário = hoje (Brasil). */
export function getDefaultContractStartDate(): string {
  return todayYmd();
}

/**
 * Envia data para a API preservando o dia civil (meio-dia no fuso Brasil).
 * Evita `T00:00:00.000Z` que desloca o dia ao reexibir.
 */
export function formatDateForApi(dateValue?: string | Date | null): string | undefined {
  const ymd = dateToYmd(dateValue);
  if (!ymd) return undefined;
  return `${ymd}T12:00:00-03:00`;
}

/** @deprecated use dateToYmd */
export const toDateOnlyYmd = dateToYmd;
