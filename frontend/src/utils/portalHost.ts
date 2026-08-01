/**
 * Detecção de portal no browser (espelha backend/utils/portalHost.ts).
 */

export type FrontendPortalHost = {
  subdomainType: 'publisher' | 'subscriber' | 'main';
  tenantSlug?: string;
  rolePortal: boolean;
};

const STORAGE_KEY = 'ssp.portalHost';

export function detectPortalFromHostname(hostname?: string): FrontendPortalHost {
  const host = (hostname || (typeof window !== 'undefined' ? window.location.hostname : ''))
    .toLowerCase()
    .split(':')[0];
  const parts = host.split('.').filter(Boolean);

  if (parts.length >= 3) {
    const [a, b] = parts;
    if (b === 'publisher' || b === 'subscriber') {
      return {
        subdomainType: b,
        tenantSlug: a,
        rolePortal: false,
      };
    }
    if (a === 'publisher' || a === 'subscriber') {
      return {
        subdomainType: a,
        rolePortal: true,
      };
    }
  }

  if (parts.length === 2 && parts[1] === 'local') {
    if (/^publisher\d+$/.test(parts[0])) {
      return { subdomainType: 'publisher', rolePortal: true };
    }
    if (/^subscriber\d+$/.test(parts[0])) {
      return { subdomainType: 'subscriber', rolePortal: true };
    }
  }

  return { subdomainType: 'main', rolePortal: false };
}

export function persistPortalHost(info: FrontendPortalHost): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch {
    /* ignore */
  }
}

export function readPersistedPortalHost(): FrontendPortalHost | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FrontendPortalHost;
  } catch {
    return null;
  }
}
