/**
 * Query Optimizer - Smart Signage Pro v3.1
 * Utilitários para otimizar queries SQL e prevenir N+1
 */

import { getDatabase } from '../config/database';

export interface QueryOptions {
  include?: string[];
  select?: string[];
  where?: Record<string, unknown>;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

/**
 * Busca múltiplas entidades com relacionamentos em uma única query
 * Previne queries N+1 usando JOINs
 */
export async function findManyWithRelations<T = Record<string, unknown>>(
  table: string,
  relations: Record<string, { table: string; foreignKey: string; localKey: string; select?: string[] }>,
  options: QueryOptions = {}
): Promise<T[]> {
  const db = getDatabase();
  
  // Construir SELECT com campos das tabelas relacionadas
  const selects: string[] = options.select || [`${table}.*`];
  
  // Adicionar campos das relações
  for (const [alias, relation] of Object.entries(relations)) {
    const relationSelects = relation.select || [`${relation.table}.*`];
    relationSelects.forEach(field => {
      selects.push(`${relation.table}.${field} as ${alias}_${field}`);
    });
  }
  
  // Construir JOINs
  let joins = '';
  for (const [, relation] of Object.entries(relations)) {
    joins += ` LEFT JOIN ${relation.table} ON ${table}.${relation.localKey} = ${relation.table}.${relation.foreignKey}`;
  }
  
  // Construir WHERE
  let whereClause = '';
  const params: unknown[] = [];
  if (options.where) {
    const conditions = Object.entries(options.where).map(([key, value], index) => {
      params.push(value);
      return `${table}.${key} = $${index + 1}`;
    });
    whereClause = `WHERE ${conditions.join(' AND ')}`;
  }
  
  // Construir ORDER BY
  const orderBy = options.orderBy ? `ORDER BY ${options.orderBy}` : '';
  
  // Construir LIMIT e OFFSET
  const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
  const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';
  
  const query = `
    SELECT ${selects.join(', ')}
    FROM ${table}
    ${joins}
    ${whereClause}
    ${orderBy}
    ${limitClause}
    ${offsetClause}
  `;
  
  const result = await db.findMany(query, params);
  return result as T[];
}

/**
 * Busca uma entidade com relacionamentos
 */
export async function findOneWithRelations<T = Record<string, unknown>>(
  table: string,
  relations: Record<string, { table: string; foreignKey: string; localKey: string; select?: string[] }>,
  where: Record<string, unknown>
): Promise<T | null> {
  const results = await findManyWithRelations<T>(table, relations, { where, limit: 1 });
  return results[0] || null;
}

/**
 * Batch load relacionamentos para prevenir N+1
 */
export async function batchLoadRelations<T extends Record<string, unknown>>(
  items: T[],
  relationTable: string,
  foreignKey: string,
  localKey: string
): Promise<Map<number | string, unknown[]>> {
  if (items.length === 0) {
    return new Map();
  }
  
  const db = getDatabase();
  const ids = items.map(item => item[localKey]).filter(Boolean);
  
  if (ids.length === 0) {
    return new Map();
  }
  
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const query = `
    SELECT *
    FROM ${relationTable}
    WHERE ${foreignKey} IN (${placeholders})
  `;
  
  const result = await db.findMany(query, ids);
  const map = new Map<number | string, unknown[]>();
  
  for (const row of result) {
    const key = row[foreignKey];
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(row);
  }
  
  return map;
}

