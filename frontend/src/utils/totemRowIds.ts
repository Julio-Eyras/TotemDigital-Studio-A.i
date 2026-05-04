/**
 * Leitura estável de IDs vindos da API (PostgreSQL + node-pg podem expor aliases em minúsculas).
 *
 * - Funções `getTotem*`: linhas de totem/player (não usar `id` genérico — seria totem_id).
 * - `getPublisherIdFromRow`: objeto publisher (lista/create); `id` = publisher quando não há snake_case.
 * - `getLocalIdFromRow`: objeto Local; `id` = local_id quando a resposta só traz `id`.
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

/** Resposta de publisher (não passar linha de totem: `id` seria o totem). */
export function getPublisherIdFromRow(row: Record<string, unknown> | null | undefined): number | undefined {
  if (!row) return undefined;
  return firstDefinedNumber(row.publisherId, row.publisher_id, row.publisherid, row.id);
}

/** Objeto Local (rollback, combos). Não passar totem. */
export function getLocalIdFromRow(row: Record<string, unknown> | null | undefined): number | undefined {
  if (!row) return undefined;
  return firstDefinedNumber(row.localId, row.local_id, row.localid, row.id);
}
