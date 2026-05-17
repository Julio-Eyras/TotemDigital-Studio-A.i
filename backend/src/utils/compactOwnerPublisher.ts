import { isStudioRuntime } from '../config/installationRuntime';

let cachedOwnerPublisherId: number | null | undefined;

export function resetCompactOwnerPublisherCache(): void {
  cachedOwnerPublisherId = undefined;
}

export async function resolveCompactOwnerPublisherId(db: any): Promise<number | undefined> {
  if (!isStudioRuntime()) return undefined;
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

export async function assertCompactOwnerPublisher(db: any, publisherId: number, context: string): Promise<void> {
  if (!isStudioRuntime()) return;

  const ownerPublisherId = await resolveCompactOwnerPublisherId(db);
  if (!ownerPublisherId) {
    throw new Error('Modo Studio: publisher do owner não encontrado para validar ownership.');
  }
  if (Number(publisherId) !== Number(ownerPublisherId)) {
    throw new Error(`Modo Studio: ${context} deve pertencer ao publisher do owner (publisher_id=${ownerPublisherId}).`);
  }
}
