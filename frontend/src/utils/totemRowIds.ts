/**
 * Leitura estável de IDs vindos da API (PostgreSQL + node-pg podem expor aliases em minúsculas).
 *
 * - Funções `getTotem*`: linhas de totem/player.
 * - `getTotemIdFromRow`: `totem_id` / `id` / `player_id` (API normalizada); só valores finitos > 0.
 * - `getForeignTotemIdFromRow`: FK `totem_id` noutro registo (ex. Smart TV), sem `id` genérico
 * (em Smart TV `id` costuma ser o próprio smart_tv_id).
 * - `getPublisherIdFromRow`: objeto publisher (lista/create); `id` = publisher quando não há snake_case.
 * - `getLocalIdFromRow`: objeto Local; `id` = local_id quando a resposta só traz `id`.
 *
 * Parâmetros tipados como `unknown` para aceitar `Player`, `MixRule`, etc., sem casts nos componentes.
 */

function firstDefinedNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function rowAsRecord(row: unknown): Record<string, unknown> | undefined {
  if (row === undefined || row === null || typeof row !== 'object') return undefined;
  return row as Record<string, unknown>;
}

/** ID do totem na listagem/detalhe (inclui `id` quando a API só normaliza para `id`). */
export function getTotemIdFromRow(row: unknown): number | undefined {
  const r = rowAsRecord(row);
  if (!r) return undefined;
  const n = firstDefinedNumber(r.totem_id, r.totemId, r.id, r.player_id, r.playerId);
  if (n === undefined || !Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/**
 * FK para totem noutro registo (ex.: Smart TV). Só `totem_id` / variantes — não usa `id` genérico
 * (em Smart TV `id` costuma ser o próprio smart_tv_id).
 */
export function getForeignTotemIdFromRow(row: unknown): number | undefined {
  const r = rowAsRecord(row);
  if (!r) return undefined;
  const n = firstDefinedNumber(r.totem_id, r.totemId, r.totemid);
  if (n === undefined || !Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** publisher_id do join local → publisher (camelCase, snake ou chave minúscula do PG). */
export function getTotemPublisherIdFromRow(row: unknown): number | undefined {
  const r = rowAsRecord(row);
  if (!r) return undefined;
  return firstDefinedNumber(r.publisherId, r.publisher_id, r.publisherid);
}

/** local_id do totem + variantes aninhadas em `local` quando a listagem embute o objeto. */
export function getTotemLocalIdFromRow(row: unknown): number | undefined {
  const r = rowAsRecord(row);
  if (!r) return undefined;
  const direct = firstDefinedNumber(r.localId, r.local_id, r.localid);
  if (direct !== undefined) return direct;
  const nested = r.local;
  if (nested && typeof nested === 'object') {
    const L = nested as Record<string, unknown>;
    return firstDefinedNumber(L.local_id, L.localId, L.localid, L.id);
  }
  return undefined;
}

/** Resposta de publisher (não passar linha de totem: `id` seria o totem). */
export function getPublisherIdFromRow(row: unknown): number | undefined {
  const r = rowAsRecord(row);
  if (!r) return undefined;
  return firstDefinedNumber(r.publisherId, r.publisher_id, r.publisherid, r.id);
}

/** Objeto Local (rollback, combos). Não passar totem. */
export function getLocalIdFromRow(row: unknown): number | undefined {
  const r = rowAsRecord(row);
  if (!r) return undefined;
  return firstDefinedNumber(r.localId, r.local_id, r.localid, r.id);
}
