/**
 * Portal DNS/Nginx — settings + inventário de hosts + sync opcional.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  PortalDnsMode,
  buildPortalHost,
  buildRolePortalHost,
  normalizePortalSlug,
  validatePortalSlug,
} from '../utils/portalHost';
import {
  PortalDnsProvider,
  hasCloudflareTokenConfigured,
  syncCloudflarePortalDns,
} from './portalDnsCloudflareService';
import { buildPortalWildcardSslPlan, issuePortalWildcardCertificate } from './portalSslService';
import { logError, logInfo, logWarn } from '../utils/loggerHelper';

type DbLike = {
  findFirst: (sql: string, params?: unknown[]) => Promise<Record<string, unknown> | null>;
  findMany?: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  executeRaw?: (sql: string, params?: unknown[]) => Promise<unknown>;
};

const SETTING_BASE = 'portal.base_domain';
const SETTING_MODE = 'portal.dns_mode';
const SETTING_SYNC = 'portal.sync_enabled';
const SETTING_DNS_PROVIDER = 'portal.dns_provider';
const SETTING_CF_ZONE = 'portal.cloudflare_zone_id';
const SETTING_DNS_IP = 'portal.dns_target_ipv4';
const SETTING_SSL_ENABLED = 'portal.ssl_wildcard_enabled';
const SETTING_SSL_EMAIL = 'portal.ssl_email';
const SETTING_SEED_SECOND = 'portal.seed_second_agency';

async function readSetting(db: DbLike, key: string): Promise<string | null> {
  try {
    const row = await db.findFirst(
      `SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1`,
      [key]
    );
    const v = row?.setting_value;
    return v == null ? null : String(v);
  } catch {
    return null;
  }
}

async function upsertSetting(
  db: DbLike,
  key: string,
  value: string,
  settingType: string,
  description: string
): Promise<void> {
  if (!db.executeRaw) throw new Error('Base sem escrita');
  await db.executeRaw(
    `
    INSERT INTO system_settings (
      setting_key, setting_value, setting_type, category, description,
      is_public, is_editable, default_value, updated_at
    ) VALUES (
      $1, $2, $3, 'portal', $4,
      false, true, $5, CURRENT_TIMESTAMP
    )
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      setting_type = EXCLUDED.setting_type,
      description = EXCLUDED.description,
      updated_at = CURRENT_TIMESTAMP
  `,
    [key, value, settingType, description, value]
  );
}

export type PortalSettings = {
  baseDomain: string;
  dnsMode: PortalDnsMode;
  syncEnabled: boolean;
  dnsProvider: PortalDnsProvider;
  cloudflareZoneId: string;
  dnsTargetIpv4: string;
  sslWildcardEnabled: boolean;
  sslEmail: string;
  seedSecondAgency: boolean;
  cloudflareTokenConfigured: boolean;
  roleHosts: { publisher: string | null; subscriber: string | null };
};

export type PortalHostEntry = {
  role: 'publisher' | 'subscriber';
  id: number;
  name: string;
  slug: string;
  host: string;
  active: boolean;
};

function parseBool(raw: string | null, defaultValue = false): boolean {
  if (raw == null || raw === '') return defaultValue;
  const v = raw.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export async function getPortalSettings(db: DbLike): Promise<PortalSettings> {
  const baseDomain = ((await readSetting(db, SETTING_BASE)) || '').trim().toLowerCase();
  const modeRaw = ((await readSetting(db, SETTING_MODE)) || 'off').trim().toLowerCase();
  const dnsMode: PortalDnsMode =
    modeRaw === 'public_wildcard' || modeRaw === 'local_dnsmasq' || modeRaw === 'off'
      ? modeRaw
      : 'off';
  const syncEnabled = parseBool(await readSetting(db, SETTING_SYNC), false);
  const providerRaw = ((await readSetting(db, SETTING_DNS_PROVIDER)) || 'off').trim().toLowerCase();
  const dnsProvider: PortalDnsProvider =
    providerRaw === 'cloudflare' || providerRaw === 'manual' || providerRaw === 'off'
      ? providerRaw
      : 'off';
  const cloudflareZoneId = ((await readSetting(db, SETTING_CF_ZONE)) || '').trim();
  const dnsTargetIpv4 = ((await readSetting(db, SETTING_DNS_IP)) || '').trim();
  const sslWildcardEnabled = parseBool(await readSetting(db, SETTING_SSL_ENABLED), false);
  const sslEmail = ((await readSetting(db, SETTING_SSL_EMAIL)) || '').trim().toLowerCase();
  const seedSecondAgency = parseBool(await readSetting(db, SETTING_SEED_SECOND), true);
  return {
    baseDomain,
    dnsMode,
    syncEnabled,
    dnsProvider,
    cloudflareZoneId,
    dnsTargetIpv4,
    sslWildcardEnabled,
    sslEmail,
    seedSecondAgency,
    cloudflareTokenConfigured: hasCloudflareTokenConfigured(),
    roleHosts: {
      publisher: buildRolePortalHost({ role: 'publisher', baseDomain }),
      subscriber: buildRolePortalHost({ role: 'subscriber', baseDomain }),
    },
  };
}

export async function savePortalSettings(
  db: DbLike,
  input: {
    baseDomain?: string;
    dnsMode?: PortalDnsMode;
    syncEnabled?: boolean;
    dnsProvider?: PortalDnsProvider;
    cloudflareZoneId?: string;
    dnsTargetIpv4?: string;
    sslWildcardEnabled?: boolean;
    sslEmail?: string;
    seedSecondAgency?: boolean;
  }
): Promise<PortalSettings> {
  if (input.baseDomain !== undefined) {
    const base = String(input.baseDomain || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (base && !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(base)) {
      throw new Error('portal.base_domain inválido');
    }
    await upsertSetting(
      db,
      SETTING_BASE,
      base,
      'string',
      'Domínio base dos portais (ex.: totemdigital.app.br)'
    );
  }
  if (input.dnsMode !== undefined) {
    if (!['off', 'public_wildcard', 'local_dnsmasq'].includes(input.dnsMode)) {
      throw new Error('portal.dns_mode inválido');
    }
    await upsertSetting(
      db,
      SETTING_MODE,
      input.dnsMode,
      'string',
      'Modo DNS/Nginx: off | public_wildcard | local_dnsmasq'
    );
  }
  if (input.syncEnabled !== undefined) {
    await upsertSetting(
      db,
      SETTING_SYNC,
      input.syncEnabled ? 'true' : 'false',
      'boolean',
      'Se true, tenta sync-portal-hosts.sh após alterar slugs'
    );
  }
  if (input.dnsProvider !== undefined) {
    if (!['off', 'manual', 'cloudflare'].includes(input.dnsProvider)) {
      throw new Error('portal.dns_provider inválido');
    }
    await upsertSetting(
      db,
      SETTING_DNS_PROVIDER,
      input.dnsProvider,
      'string',
      'Provedor DNS: off | manual | cloudflare'
    );
  }
  if (input.cloudflareZoneId !== undefined) {
    await upsertSetting(
      db,
      SETTING_CF_ZONE,
      String(input.cloudflareZoneId || '').trim(),
      'string',
      'Cloudflare Zone ID (token só via env)'
    );
  }
  if (input.dnsTargetIpv4 !== undefined) {
    const ip = String(input.dnsTargetIpv4 || '').trim();
    if (ip && !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
      throw new Error('portal.dns_target_ipv4 inválido');
    }
    await upsertSetting(
      db,
      SETTING_DNS_IP,
      ip,
      'string',
      'IPv4 alvo dos wildcards A no DNS público'
    );
  }
  if (input.sslWildcardEnabled !== undefined) {
    await upsertSetting(
      db,
      SETTING_SSL_ENABLED,
      input.sslWildcardEnabled ? 'true' : 'false',
      'boolean',
      'Se true, permite emitir/planear LE wildcard DNS-01'
    );
  }
  if (input.sslEmail !== undefined) {
    await upsertSetting(
      db,
      SETTING_SSL_EMAIL,
      String(input.sslEmail || '').trim().toLowerCase(),
      'string',
      'Email Let\'s Encrypt para wildcard do portal'
    );
  }
  if (input.seedSecondAgency !== undefined) {
    await upsertSetting(
      db,
      SETTING_SEED_SECOND,
      input.seedSecondAgency ? 'true' : 'false',
      'boolean',
      'Ao activar multi-agência, criar 2ª organização demo se só existir owner'
    );
  }
  return getPortalSettings(db);
}

export async function listPortalHosts(db: DbLike): Promise<PortalHostEntry[]> {
  const settings = await getPortalSettings(db);
  const findMany =
    db.findMany ||
    (async (sql: string, params?: unknown[]) => {
      // fallback: some wrappers only have findFirst
      void sql;
      void params;
      return [] as Record<string, unknown>[];
    });

  const pubs = await findMany.call(
    db,
    `
    SELECT publisher_id AS id, name, portal_slug AS slug, COALESCE(is_active, true) AS active
    FROM publishers
    WHERE portal_slug IS NOT NULL AND btrim(portal_slug) <> ''
    ORDER BY portal_slug ASC
  `
  );
  const subs = await findMany.call(
    db,
    `
    SELECT subscriber_id AS id, name, portal_slug AS slug, COALESCE(is_active, true) AS active
    FROM subscribers
    WHERE portal_slug IS NOT NULL AND btrim(portal_slug) <> ''
    ORDER BY portal_slug ASC
  `
  );

  const out: PortalHostEntry[] = [];
  for (const row of pubs || []) {
    const slug = String(row.slug);
    out.push({
      role: 'publisher',
      id: Number(row.id),
      name: String(row.name || ''),
      slug,
      host: buildPortalHost({
        slug,
        role: 'publisher',
        baseDomain: settings.baseDomain,
        dnsMode: settings.dnsMode,
      }),
      active: Boolean(row.active),
    });
  }
  for (const row of subs || []) {
    const slug = String(row.slug);
    out.push({
      role: 'subscriber',
      id: Number(row.id),
      name: String(row.name || ''),
      slug,
      host: buildPortalHost({
        slug,
        role: 'subscriber',
        baseDomain: settings.baseDomain,
        dnsMode: settings.dnsMode,
      }),
      active: Boolean(row.active),
    });
  }
  return out;
}

export function renderPortalNginxSnippet(
  settings: PortalSettings,
  hosts: PortalHostEntry[]
): string {
  const lines: string[] = [
    '# Gerado por TotemDigital portalHostService — não editar à mão',
    '# Incluir via: include /etc/nginx/snippets/totemdigital-portal-tenants.conf;',
    '',
  ];

  const mapName = 'td_portal_sd_type';
  lines.push(`map $host $${mapName} {`);
  lines.push('    default main;');
  if (settings.roleHosts.publisher) {
    lines.push(`    ${settings.roleHosts.publisher} publisher;`);
  }
  if (settings.roleHosts.subscriber) {
    lines.push(`    ${settings.roleHosts.subscriber} subscriber;`);
  }
  for (const h of hosts) {
    lines.push(`    ${h.host} ${h.role};`);
  }
  // Wildcard patterns (Nginx map exact hosts above; regex for catch-all)
  if (settings.baseDomain && settings.dnsMode === 'public_wildcard') {
    lines.push(
      `    ~^(?<td_slug>[a-z0-9-]+)\\.publisher\\.${escapeRegexDots(settings.baseDomain)}$ publisher;`
    );
    lines.push(
      `    ~^(?<td_slug>[a-z0-9-]+)\\.subscriber\\.${escapeRegexDots(settings.baseDomain)}$ subscriber;`
    );
  }
  lines.push('}');
  lines.push('');
  lines.push(`map $host $td_portal_tenant_slug {`);
  lines.push('    default "";');
  for (const h of hosts) {
    lines.push(`    ${h.host} ${h.slug};`);
  }
  if (settings.baseDomain && settings.dnsMode === 'public_wildcard') {
    lines.push(
      `    ~^(?<td_slug>[a-z0-9-]+)\\.(publisher|subscriber)\\.${escapeRegexDots(settings.baseDomain)}$ $td_slug;`
    );
  }
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

function escapeRegexDots(domain: string): string {
  return domain.replace(/\./g, '\\.');
}

export function renderPortalDnsmasqSnippet(hosts: PortalHostEntry[]): string {
  const lines = [
    '# Gerado por TotemDigital portalHostService',
    '# Incluir em /etc/dnsmasq.d/totemdigital-portal-tenants.conf',
    '',
  ];
  for (const h of hosts) {
    // Prefer .local style for dnsmasq; also map the public host to 127.0.0.1 for LAN testing
    const localHost = `${h.slug}.${h.role}.local`;
    lines.push(`# ${h.role} ${h.id} ${h.name}`);
    lines.push(`address=/${localHost}/127.0.0.1`);
    if (h.host !== localHost) {
      lines.push(`address=/${h.host}/127.0.0.1`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export type PortalSyncResult = {
  ok: boolean;
  written: string[];
  syncRan: boolean;
  syncOutput?: string;
  message: string;
  nginxSnippet: string;
  dnsmasqSnippet: string;
  dnsInstructions: string[];
  cloudflare?: Awaited<ReturnType<typeof syncCloudflarePortalDns>>;
  sslPlan?: ReturnType<typeof buildPortalWildcardSslPlan>;
};

function resolveRuntimeDir(): string {
  return (
    process.env.PORTAL_HOSTS_RUNTIME_DIR ||
    path.join(process.cwd(), 'runtime', 'portal-hosts')
  );
}

export async function syncPortalHosts(
  db: DbLike,
  opts?: { dryRunDns?: boolean; applyCloudflare?: boolean }
): Promise<PortalSyncResult> {
  const settings = await getPortalSettings(db);
  const hosts = await listPortalHosts(db);
  const nginxSnippet = renderPortalNginxSnippet(settings, hosts);
  const dnsmasqSnippet = renderPortalDnsmasqSnippet(hosts);

  const dir = resolveRuntimeDir();
  fs.mkdirSync(dir, { recursive: true });
  const nginxPath = path.join(dir, 'totemdigital-portal-tenants.conf');
  const dnsPath = path.join(dir, 'totemdigital-portal-tenants.dnsmasq');
  const manifestPath = path.join(dir, 'manifest.json');
  fs.writeFileSync(nginxPath, nginxSnippet, 'utf8');
  fs.writeFileSync(dnsmasqSnippet ? dnsPath : dnsPath, dnsmasqSnippet, 'utf8');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), settings, hosts }, null, 2),
    'utf8'
  );

  const dnsInstructions: string[] = [];
  if (settings.dnsMode === 'public_wildcard' && settings.baseDomain) {
    dnsInstructions.push(
      `No DNS público, crie wildcard: *.publisher.${settings.baseDomain} e *.subscriber.${settings.baseDomain} → IP do VPS`
    );
    dnsInstructions.push(
      `Opcional: publisher.${settings.baseDomain} e subscriber.${settings.baseDomain} → mesmo IP`
    );
    dnsInstructions.push(
      'Certificado: use wildcard LE (DNS-01) via POST /api/installation/portal/ssl/issue (--sim / dryRun)'
    );
  } else if (settings.dnsMode === 'local_dnsmasq') {
    dnsInstructions.push(
      `Copie ${dnsPath} para /etc/dnsmasq.d/ e reinicie dnsmasq (ou use scripts/sync-portal-hosts.sh)`
    );
  } else {
    dnsInstructions.push('portal.dns_mode=off — só gera ficheiros; não aplica DNS automaticamente');
  }
  dnsInstructions.push(
    `Nginx: include o snippet ${nginxPath} (ou copie para /etc/nginx/snippets/) e faça nginx -t && reload`
  );

  let cloudflare: PortalSyncResult['cloudflare'];
  const wantCf =
    opts?.applyCloudflare === true ||
    (settings.dnsProvider === 'cloudflare' && settings.dnsMode === 'public_wildcard');
  if (wantCf) {
    cloudflare = await syncCloudflarePortalDns({
      baseDomain: settings.baseDomain,
      zoneId: settings.cloudflareZoneId,
      targetIpv4: settings.dnsTargetIpv4,
      dryRun:
        opts?.dryRunDns === true ||
        process.env.PORTAL_DNS_DRY_RUN === 'true',
    });
    if (cloudflare.dryRun) {
      dnsInstructions.push(`Cloudflare (sim): ${cloudflare.message}`);
    } else if (cloudflare.ok) {
      dnsInstructions.push(`Cloudflare: ${cloudflare.message}`);
    } else {
      dnsInstructions.push(`Cloudflare falhou: ${cloudflare.message}`);
    }
  }

  const sslPlan =
    settings.sslWildcardEnabled && settings.baseDomain
      ? buildPortalWildcardSslPlan({
          baseDomain: settings.baseDomain,
          email: settings.sslEmail,
        })
      : undefined;

  let syncRan = false;
  let syncOutput = '';
  const syncEnabled =
    settings.syncEnabled || process.env.PORTAL_SYNC_ENABLED === 'true';
  const scriptPath =
    process.env.PORTAL_SYNC_SCRIPT ||
    path.join(process.cwd(), 'scripts', 'sync-portal-hosts.sh');

  if (syncEnabled && fs.existsSync(scriptPath)) {
    try {
      syncOutput = await runSyncScript(scriptPath, dir);
      syncRan = true;
      await logInfo('Portal hosts sync executado', { scriptPath, dir });
    } catch (error: any) {
      await logWarn('Portal hosts sync falhou', { error: error?.message, scriptPath });
      return {
        ok: false,
        written: [nginxPath, dnsPath, manifestPath],
        syncRan: true,
        syncOutput: error?.message || String(error),
        message:
          'Ficheiros gerados, mas sync-portal-hosts.sh falhou. Aplique manualmente ou corrija sudoers.',
        nginxSnippet,
        dnsmasqSnippet,
        dnsInstructions,
        cloudflare,
        sslPlan,
      };
    }
  }

  const cfOk = !cloudflare || cloudflare.ok;
  return {
    ok: cfOk,
    written: [nginxPath, dnsPath, manifestPath],
    syncRan,
    syncOutput: syncOutput || undefined,
    message: syncRan
      ? 'Hosts sincronizados (Nginx/dnsmasq via script).'
      : 'Ficheiros gerados em runtime/portal-hosts. Active portal.sync_enabled ou corra scripts/sync-portal-hosts.sh para aplicar.',
    nginxSnippet,
    dnsmasqSnippet,
    dnsInstructions,
    cloudflare,
    sslPlan,
  };
}

export async function syncPortalCloudflareDns(
  db: DbLike,
  opts?: { dryRun?: boolean }
) {
  const settings = await getPortalSettings(db);
  return syncCloudflarePortalDns({
    baseDomain: settings.baseDomain,
    zoneId: settings.cloudflareZoneId,
    targetIpv4: settings.dnsTargetIpv4,
    dryRun: opts?.dryRun,
  });
}

export async function issuePortalSsl(
  db: DbLike,
  opts?: { dryRun?: boolean }
) {
  const settings = await getPortalSettings(db);
  if (!settings.sslWildcardEnabled && opts?.dryRun !== true) {
    // still allow dry-run for preview
  }
  return issuePortalWildcardCertificate({
    baseDomain: settings.baseDomain,
    email: settings.sslEmail,
    dryRun: opts?.dryRun ?? !settings.sslWildcardEnabled,
    zoneId: settings.cloudflareZoneId,
  });
}

function runSyncScript(scriptPath: string, runtimeDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath, runtimeDir], {
      env: process.env,
      timeout: 120000,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += String(d);
    });
    child.stderr.on('data', (d) => {
      err += String(d);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out || err);
      else reject(new Error(err || out || `exit ${code}`));
    });
  });
}

export type ResolvedPortalTenant = {
  role: 'publisher' | 'subscriber';
  slug: string;
  publisherId?: number;
  subscriberId?: number;
  name?: string;
  active: boolean;
};

/**
 * Resolve portal_slug → publisher_id ou subscriber_id (ativo).
 * Retorna null se o slug não existir no papel pedido.
 */
export async function resolvePortalTenantBySlug(
  db: DbLike,
  slug: string,
  role: 'publisher' | 'subscriber'
): Promise<ResolvedPortalTenant | null> {
  const normalized = normalizePortalSlug(slug);
  if (!normalized) return null;

  if (role === 'publisher') {
    const row = await db.findFirst(
      `
      SELECT publisher_id AS id, name, portal_slug AS slug, COALESCE(is_active, true) AS active
      FROM publishers
      WHERE portal_slug = $1
      LIMIT 1
    `,
      [normalized]
    );
    if (!row || row.active === false) return null;
    return {
      role: 'publisher',
      slug: String(row.slug || normalized),
      publisherId: Number(row.id),
      name: row.name != null ? String(row.name) : undefined,
      active: true,
    };
  }

  const row = await db.findFirst(
    `
    SELECT subscriber_id AS id, name, portal_slug AS slug, COALESCE(is_active, true) AS active
    FROM subscribers
    WHERE portal_slug = $1
    LIMIT 1
  `,
    [normalized]
  );
  if (!row || row.active === false) return null;
  return {
    role: 'subscriber',
    slug: String(row.slug || normalized),
    subscriberId: Number(row.id),
    name: row.name != null ? String(row.name) : undefined,
    active: true,
  };
}

export async function assertPortalSlugAvailable(
  db: DbLike,
  slug: string | null,
  opts: { role: 'publisher' | 'subscriber'; excludeId?: number }
): Promise<string | null> {
  const normalized = validatePortalSlug(normalizePortalSlug(slug));
  if (!normalized) return null;

  const pub = await db.findFirst(
    `
    SELECT publisher_id FROM publishers
    WHERE portal_slug = $1
      AND ($2::int IS NULL OR publisher_id <> $2)
    LIMIT 1
  `,
    [normalized, opts.excludeId && opts.role === 'publisher' ? opts.excludeId : null]
  );
  const sub = await db.findFirst(
    `
    SELECT subscriber_id FROM subscribers
    WHERE portal_slug = $1
      AND ($2::int IS NULL OR subscriber_id <> $2)
    LIMIT 1
  `,
    [normalized, opts.excludeId && opts.role === 'subscriber' ? opts.excludeId : null]
  );
  if (pub || sub) {
    throw new Error(`portal_slug «${normalized}» já está em uso`);
  }
  return normalized;
}

export async function maybeSyncPortalHostsAfterSlugChange(db: DbLike): Promise<void> {
  try {
    const settings = await getPortalSettings(db);
    if (!settings.syncEnabled && process.env.PORTAL_SYNC_ENABLED !== 'true') return;
    await syncPortalHosts(db);
  } catch (error) {
    await logError('Falha ao sincronizar portal hosts após alteração de slug', error);
  }
}
