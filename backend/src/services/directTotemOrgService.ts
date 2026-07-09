import { getDatabase } from '../config/database';

const DEFAULT_LOCAL_NAME = 'Padrão';

/**
 * Resolve publisher único (modo uma organização).
 */
export async function resolveSinglePublisherId(preferredPublisherId?: number): Promise<number> {
  const db = getDatabase();
  if (preferredPublisherId) {
    const row = await db.findFirst(
      `SELECT publisher_id FROM publishers WHERE publisher_id = $1 AND is_active = true LIMIT 1`,
      [preferredPublisherId]
    );
    if (row?.publisher_id) return Number(row.publisher_id);
  }
  const first = await db.findFirst(
    `SELECT publisher_id FROM publishers WHERE is_active = true ORDER BY publisher_id ASC LIMIT 1`
  );
  if (!first?.publisher_id) {
    throw new Error('Nenhuma organização ativa encontrada');
  }
  return Number(first.publisher_id);
}

/**
 * Garante local padrão para cadastro de totem sem escolher local na UI.
 */
export async function ensureDefaultLocalForPublisher(publisherId: number): Promise<number> {
  const db = getDatabase();
  const existing = await db.findFirst(
    `SELECT local_id FROM locals
     WHERE publisher_id = $1 AND is_active = true
       AND LOWER(TRIM(name)) = LOWER($2)
     ORDER BY local_id ASC LIMIT 1`,
    [publisherId, DEFAULT_LOCAL_NAME]
  );
  if (existing?.local_id) return Number(existing.local_id);

  const created = await db.executeRaw(
    `INSERT INTO locals (publisher_id, name, timezone, is_active, created_at, updated_at)
     VALUES ($1, $2, 'America/Sao_Paulo', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING local_id`,
    [publisherId, DEFAULT_LOCAL_NAME]
  );
  const localId = created?.rows?.[0]?.local_id;
  if (!localId) throw new Error('Falha ao criar local padrão');
  return Number(localId);
}

/**
 * Subscriber padrão para biblioteca de mídias no modo direto.
 */
export async function resolveDefaultSubscriberId(): Promise<number> {
  const db = getDatabase();
  const row = await db.findFirst(
    `SELECT subscriber_id FROM subscribers WHERE is_active = true ORDER BY subscriber_id ASC LIMIT 1`
  );
  if (!row?.subscriber_id) {
    throw new Error(
      'Nenhum assinante ativo no banco. Crie ao menos um registro em subscribers para a biblioteca de mídias.'
    );
  }
  return Number(row.subscriber_id);
}
