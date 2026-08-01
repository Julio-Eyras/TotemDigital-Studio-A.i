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
import { logError, logInfo, logWarn } from '../utils/loggerHelper';

type DbLike = {
  findFirst: (sql: string, params?: unknown[]) => Promise<Record<string, unknown> | null>;
  findMany?: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  executeRaw?: (sql: string, params?: unknown[]) => Promise<unknown>;
};

const SETTING_BASE = 'portal.base_domain';
const SETTING_MODE = 'portal.dns_mode';
const SETTING_SYNC = 'portal.sync_enabled';

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

export async function getPortalSettings(db: DbLike): Promise<PortalSettings> {
  const baseDomain = ((await readSetting(db, SETTING_BASE)) || '').trim().toLowerCase();
  const modeRaw = ((await readSetting(db, SETTING_MODE)) || 'off').trim().toLowerCase();
  const dnsMode: PortalDnsMode =
    modeRaw === 'public_wildcard' || modeRaw === 'local_dnsmasq' || modeRaw === 'off'
      ? modeRaw
      : 'off';
  const syncRaw = ((await readSetting(db, SETTING_SYNC)) || 'false').trim().toLowerCase();
  const syncEnabled = syncRaw === 'true' || syncRaw === '1';
  return {
    baseDomain,
    dnsMode,
    syncEnabled,
    roleHosts: {
      publisher: buildRolePortalHost({ role: 'publisher', baseDomain }),
      subscriber: buildRolePortalHost({ role: 'subscriber', baseDomain }),
    },
  };
}

export async function savePortalSettings(
  db: DbLike,
  input: { baseDomain?: string; dnsMode?: PortalDnsMode; syncEnabled?: boolean }
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
};

function resolveRuntimeDir(): string {
  return (
    process.env.PORTAL_HOSTS_RUNTIME_DIR ||
    path.join(process.cwd(), 'runtime', 'portal-hosts')
  );
}

export async function syncPortalHosts(db: DbLike): Promise<PortalSyncResult> {
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
      'Certificado: use wildcard LE (DNS-01) ou SAN que cubra *.publisher / *.subscriber'
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
      };
    }
  }

  return {
    ok: true,
    written: [nginxPath, dnsPath, manifestPath],
    syncRan,
    syncOutput: syncOutput || undefined,
    message: syncRan
      ? 'Hosts sincronizados (Nginx/dnsmasq via script).'
      : 'Ficheiros gerados em runtime/portal-hosts. Active portal.sync_enabled ou corra scripts/sync-portal-hosts.sh para aplicar.',
    nginxSnippet,
    dnsmasqSnippet,
    dnsInstructions,
  };
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
