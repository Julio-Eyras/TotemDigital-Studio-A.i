import { isStudioRuntime } from '../config/installationRuntime';
import { isDirectTotemMode } from '../config/directTotemMode';
import type { DatabaseWrapper } from '../config/database-pg';

let cachedOwnerPublisherId: number | null | undefined;

export function resetCompactOwnerPublisherCache(): void {
  cachedOwnerPublisherId = undefined;
}

/** Direct Totem ou Studio (single_publisher): inventário limitado ao system owner. */
export function isOwnerInventoryMode(): boolean {
  return isDirectTotemMode() || isStudioRuntime();
}

export async function resolveCompactOwnerPublisherId(db: DatabaseWrapper): Promise<number | undefined> {
  if (!isOwnerInventoryMode()) return undefined;
  if (cachedOwnerPublisherId !== undefined) return cachedOwnerPublisherId ?? undefined;

  const systemOwner = await db.findFirst(
    `
      SELECT publisher_id
      FROM publishers
      WHERE is_active = true AND is_system_owner = true
      ORDER BY publisher_id ASC
      LIMIT 1
    `
  );

  if (systemOwner?.publisher_id) {
    cachedOwnerPublisherId = Number(systemOwner.publisher_id);
    return cachedOwnerPublisherId;
  }

  const ownerName = (process.env.SYSTEM_OWNER_NAME || 'Totem Digital').trim();
  const ownerEmail = (process.env.SYSTEM_OWNER_EMAIL || 'contato@totemdigital.local').trim();

  const exact = await db.findFirst(
    `
      SELECT publisher_id
      FROM publishers
      WHERE is_active = true
        AND (
          LOWER(name) = LOWER($1)
          OR LOWER(COALESCE(email, '')) = LOWER($2)
        )
      ORDER BY publisher_id ASC
      LIMIT 1
    `,
    [ownerName, ownerEmail]
  );

  if (exact?.publisher_id) {
    cachedOwnerPublisherId = Number(exact.publisher_id);
    return cachedOwnerPublisherId;
  }

  const fallback = await db.findFirst(
    `
      SELECT publisher_id
      FROM publishers
      WHERE is_active = true
      ORDER BY publisher_id ASC
      LIMIT 1
    `
  );

  cachedOwnerPublisherId = fallback?.publisher_id ? Number(fallback.publisher_id) : null;
  return cachedOwnerPublisherId ?? undefined;
}

/**
 * Escopo de inventário (locais/totens): em Direct/Studio sempre o owner,
 * inclusive para admin. Fora disso, admin vê tudo; demais users o publisher do token.
 */
export async function resolveInventoryPublisherScope(
  db: DatabaseWrapper,
  requestPublisherId?: number,
  isAdmin: boolean = false
): Promise<number | undefined> {
  if (isOwnerInventoryMode()) {
    const ownerPublisherId = await resolveCompactOwnerPublisherId(db);
    if (!ownerPublisherId) {
      throw new Error('Direct/Studio: publisher do owner não encontrado para aplicar escopo.');
    }
    return ownerPublisherId;
  }
  if (isAdmin) return undefined;
  if (!requestPublisherId) {
    throw new Error('Acesso negado: escopo de publisher ausente para o usuário autenticado.');
  }
  return requestPublisherId;
}

export async function assertCompactOwnerPublisher(db: DatabaseWrapper, publisherId: number, context: string): Promise<void> {
  if (!isOwnerInventoryMode()) return;

  const ownerPublisherId = await resolveCompactOwnerPublisherId(db);
  if (!ownerPublisherId) {
    throw new Error('Direct/Studio: publisher do owner não encontrado para validar ownership.');
  }
  if (Number(publisherId) !== Number(ownerPublisherId)) {
    throw new Error(
      `Direct/Studio: ${context} deve pertencer ao publisher do owner (publisher_id=${ownerPublisherId}).`
    );
  }
}
