/**
 * Slugs e hosts de portal (publisher / anunciante).
 * Formato público: {slug}.publisher.{base} | {slug}.subscriber.{base}
 * Formato local:    {slug}.publisher.local | {slug}.subscriber.local
 * Portais de papel: publisher.{base} | subscriber.{base}
 */

export const PORTAL_RESERVED_SLUGS = new Set([
  'www',
  'api',
  'mqtt',
  'player',
  'admin',
  'app',
  'mail',
  'ftp',
  'static',
  'assets',
  'publisher',
  'subscriber',
  'portal',
  'dev',
  'teste',
  'test',
  'staging',
]);

export type PortalDnsMode = 'off' | 'public_wildcard' | 'local_dnsmasq';
export type PortalRole = 'publisher' | 'subscriber';

export function normalizePortalSlug(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  return s;
}

export function validatePortalSlug(slug: string | null): string | null {
  if (slug == null) return null;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
    throw new Error(
      'portal_slug inválido: use 2–63 caracteres (a-z, 0-9, hífen), sem começar/terminar com hífen.'
    );
  }
  if (PORTAL_RESERVED_SLUGS.has(slug)) {
    throw new Error(`portal_slug «${slug}» é reservado.`);
  }
  return slug;
}

export function buildPortalHost(opts: {
  slug: string;
  role: PortalRole;
  baseDomain?: string | null;
  dnsMode?: PortalDnsMode;
}): string {
  const base = (opts.baseDomain || '').trim().toLowerCase();
  const mode = opts.dnsMode || (base ? 'public_wildcard' : 'local_dnsmasq');
  if (mode === 'local_dnsmasq' || !base) {
    return `${opts.slug}.${opts.role}.local`;
  }
  return `${opts.slug}.${opts.role}.${base}`;
}

export function buildRolePortalHost(opts: {
  role: PortalRole;
  baseDomain?: string | null;
}): string | null {
  const base = (opts.baseDomain || '').trim().toLowerCase();
  if (!base) return null;
  return `${opts.role}.${base}`;
}

export type DetectedPortalHost = {
  subdomainType: 'publisher' | 'subscriber' | 'main';
  tenantSlug?: string;
  rolePortal: boolean;
};

/**
 * Interpreta hostname:
 * - publisher.exemplo.com / subscriber.exemplo.com → portal de papel
 * - slug.publisher.exemplo.com / slug.subscriber.exemplo.com → tenant
 * - slug.publisher.local / slug.subscriber.local → tenant local
 * - publisher1.local (legado) → publisher role, slug=publisher1 (best-effort)
 */
export function detectPortalFromHostname(hostname: string): DetectedPortalHost {
  const host = (hostname || '').split(':')[0].toLowerCase().trim();
  if (!host) return { subdomainType: 'main', rolePortal: false };

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return { subdomainType: 'main', rolePortal: false };

  // slug.role.base...  (mín. 3 labels) ou slug.role.local
  if (parts.length >= 3) {
    const [a, b] = parts;
    if (b === 'publisher' || b === 'subscriber') {
      if (a === 'api' || a === 'mqtt' || a === 'player') {
        return { subdomainType: b, rolePortal: true };
      }
      return {
        subdomainType: b,
        tenantSlug: a,
        rolePortal: false,
      };
    }
    if (a === 'publisher' || a === 'subscriber') {
      return { subdomainType: a, rolePortal: true };
    }
  }

  // Legado: publisherN.local / subscriberN.local
  if (parts.length === 2 && parts[1] === 'local') {
    const mPub = /^publisher(\d+)$/.exec(parts[0]);
    if (mPub) {
      return { subdomainType: 'publisher', tenantSlug: parts[0], rolePortal: false };
    }
    const mSub = /^subscriber(\d+)$/.exec(parts[0]);
    if (mSub) {
      return { subdomainType: 'subscriber', tenantSlug: parts[0], rolePortal: false };
    }
  }

  return { subdomainType: 'main', rolePortal: false };
}
