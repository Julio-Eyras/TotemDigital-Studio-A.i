/**
 * IDs de totem vindos da API (PostgreSQL + node-pg podem expor aliases em minúsculas:
 * publisherid, localid). Centraliza leitura para o painel.
 */

function firstDefinedNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/** publisher_id do join local → publisher (camelCase, snake ou chave minúscula do PG). */
export function getTotemPublisherIdFromRow(row: Record<string, unknown> | null | undefined): number | undefined {
  if (!row) return undefined;
  return firstDefinedNumber(row.publisherId, row.publisher_id, row.publisherid);
}

/** local_id do totem + variantes aninhadas em `local` quando a listagem embute o objeto. */
export function getTotemLocalIdFromRow(row: Record<string, unknown> | null | undefined): number | undefined {
  if (!row) return undefined;
  const direct = firstDefinedNumber(row.localId, row.local_id, row.localid);
  if (direct !== undefined) return direct;
  const nested = row.local;
  if (nested && typeof nested === 'object') {
    const L = nested as Record<string, unknown>;
    return firstDefinedNumber(L.local_id, L.localId, L.localid, L.id);
  }
  return undefined;
}
