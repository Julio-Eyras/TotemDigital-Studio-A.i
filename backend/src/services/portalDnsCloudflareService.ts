/**
 * Cloudflare DNS API — sync de wildcards do portal.
 * Token NUNCA em BD: só env CLOUDFLARE_API_TOKEN / PORTAL_CLOUDFLARE_API_TOKEN.
 */
import { logError, logInfo, logWarn } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export type PortalDnsProvider = 'off' | 'manual' | 'cloudflare';

export type CloudflareDnsSettings = {
  provider: PortalDnsProvider;
  zoneId: string;
  /** IPv4 alvo dos registos A (wildcard + role portals). Vazio = só planear. */
  targetIpv4: string;
};

export type DnsRecordPlan = {
  type: 'A' | 'CNAME';
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  comment: string;
};

export type CloudflareSyncResult = {
  ok: boolean;
  dryRun: boolean;
  planned: DnsRecordPlan[];
  applied: Array<{ name: string; action: 'created' | 'updated' | 'skipped' | 'planned' }>;
  message: string;
  errors: string[];
};

type FetchLike = typeof fetch;

function getCloudflareToken(): string {
  return (
    process.env.PORTAL_CLOUDFLARE_API_TOKEN ||
    process.env.CLOUDFLARE_API_TOKEN ||
    ''
  ).trim();
}

export function buildPortalWildcardDnsPlan(
  baseDomain: string,
  targetIpv4: string
): DnsRecordPlan[] {
  const base = String(baseDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const ip = String(targetIpv4 || '').trim();
  if (!base || !ip) return [];

  const names = [
    `*.publisher.${base}`,
    `*.subscriber.${base}`,
    `publisher.${base}`,
    `subscriber.${base}`,
  ];

  return names.map((name) => ({
    type: 'A' as const,
    name,
    content: ip,
    proxied: false, // wildcard LE DNS-01 exige DNS directo (não orange-cloud)
    ttl: 300,
    comment: 'TotemDigital portal wildcard',
  }));
}

async function cfApi(
  path: string,
  opts: { method?: string; body?: unknown; token: string; fetchImpl?: FetchLike }
): Promise<{ ok: boolean; result?: any; errors?: any[]; status: number }> {
  const fetchImpl = opts.fetchImpl || fetch;
  const res = await fetchImpl(`https://api.cloudflare.com/client/v4${path}`, {
    method: opts.method || 'GET',
    headers: {
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'application/json',
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as any;
  return {
    ok: Boolean(json.success) && res.ok,
    result: json.result,
    errors: json.errors,
    status: res.status,
  };
}

/**
 * Sincroniza registos DNS do portal na zona Cloudflare.
 * dryRun=true → só planeia (ambiente simulado / pré-visualização).
 */
export async function syncCloudflarePortalDns(opts: {
  baseDomain: string;
  zoneId: string;
  targetIpv4: string;
  dryRun?: boolean;
  fetchImpl?: FetchLike;
  token?: string;
}): Promise<CloudflareSyncResult> {
  const planned = buildPortalWildcardDnsPlan(opts.baseDomain, opts.targetIpv4);
  const dryRun = opts.dryRun === true || process.env.PORTAL_DNS_DRY_RUN === 'true';
  const errors: string[] = [];
  const applied: CloudflareSyncResult['applied'] = [];

  if (!planned.length) {
    return {
      ok: false,
      dryRun,
      planned,
      applied,
      message: 'Falta portal.base_domain ou portal.dns_target_ipv4 para planear DNS.',
      errors: ['missing_base_or_ip'],
    };
  }

  if (dryRun) {
    for (const r of planned) {
      applied.push({ name: r.name, action: 'planned' });
    }
    return {
      ok: true,
      dryRun: true,
      planned,
      applied,
      message: `Simulação: ${planned.length} registo(s) A planeados (não enviados à Cloudflare).`,
      errors: [],
    };
  }

  const token = (opts.token || getCloudflareToken()).trim();
  const zoneId = String(opts.zoneId || '').trim();
  if (!token) {
    return {
      ok: false,
      dryRun: false,
      planned,
      applied,
      message:
        'Token Cloudflare ausente. Defina CLOUDFLARE_API_TOKEN ou PORTAL_CLOUDFLARE_API_TOKEN no ambiente.',
      errors: ['missing_token'],
    };
  }
  if (!zoneId) {
    return {
      ok: false,
      dryRun: false,
      planned,
      applied,
      message: 'portal.cloudflare_zone_id em falta.',
      errors: ['missing_zone'],
    };
  }

  try {
    for (const record of planned) {
      const list = await cfApi(
        `/zones/${zoneId}/dns_records?type=${record.type}&name=${encodeURIComponent(record.name)}`,
        { token, fetchImpl: opts.fetchImpl }
      );
      if (!list.ok) {
        const msg = JSON.stringify(list.errors || list.status);
        errors.push(`list ${record.name}: ${msg}`);
        continue;
      }
      const existing = Array.isArray(list.result) ? list.result[0] : null;
      if (existing?.id) {
        const upd = await cfApi(`/zones/${zoneId}/dns_records/${existing.id}`, {
          method: 'PUT',
          token,
          fetchImpl: opts.fetchImpl,
          body: {
            type: record.type,
            name: record.name,
            content: record.content,
            proxied: record.proxied,
            ttl: record.ttl,
            comment: record.comment,
          },
        });
        if (upd.ok) {
          applied.push({ name: record.name, action: 'updated' });
        } else {
          errors.push(`update ${record.name}: ${JSON.stringify(upd.errors || upd.status)}`);
        }
      } else {
        const cre = await cfApi(`/zones/${zoneId}/dns_records`, {
          method: 'POST',
          token,
          fetchImpl: opts.fetchImpl,
          body: {
            type: record.type,
            name: record.name,
            content: record.content,
            proxied: record.proxied,
            ttl: record.ttl,
            comment: record.comment,
          },
        });
        if (cre.ok) {
          applied.push({ name: record.name, action: 'created' });
        } else {
          errors.push(`create ${record.name}: ${JSON.stringify(cre.errors || cre.status)}`);
        }
      }
    }

    const ok = errors.length === 0 && applied.length > 0;
    if (ok) {
      await logInfo('Cloudflare portal DNS sincronizado', {
        zoneId,
        count: applied.length,
      });
    } else {
      await logWarn('Cloudflare portal DNS com erros', { errors, applied });
    }

    return {
      ok,
      dryRun: false,
      planned,
      applied,
      message: ok
        ? `Cloudflare: ${applied.length} registo(s) aplicados.`
        : `Cloudflare sync incompleto (${errors.length} erro(s)).`,
      errors,
    };} catch (error: unknown) {
      const e = normalizeError(error);
    await logError('Falha Cloudflare portal DNS', e.error);
    return {
      ok: false,
      dryRun: false,
      planned,
      applied,
      message: ((e.raw as { message?: string })?.message) || 'Falha na API Cloudflare',
      errors: [((e.raw as { message?: string })?.message) || String(e.error)],
    };
  }
}

export function hasCloudflareTokenConfigured(): boolean {
  return Boolean(getCloudflareToken());
}
