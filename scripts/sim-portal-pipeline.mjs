#!/usr/bin/env node
/**
 * Pipeline simulado: DNS Cloudflare (dry-run) + SSL LE plan + seed 2ª agência + Nginx snippets.
 * Não chama APIs reais nem certbot. Corre em Windows/Linux sem root.
 *
 * Uso: node scripts/sim-portal-pipeline.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'runtime', 'portal-pipeline-sim');
const results = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  results.push({ ok: true, msg });
  console.log('  ✓', msg);
}

function buildPortalWildcardDnsPlan(baseDomain, targetIpv4) {
  const base = String(baseDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const ip = String(targetIpv4 || '').trim();
  if (!base || !ip) return [];
  return [
    `*.publisher.${base}`,
    `*.subscriber.${base}`,
    `publisher.${base}`,
    `subscriber.${base}`,
  ].map((name) => ({
    type: 'A',
    name,
    content: ip,
    proxied: false,
    ttl: 300,
  }));
}

function buildPortalWildcardSslPlan(baseDomain, email) {
  const base = String(baseDomain || '').trim().toLowerCase();
  const domains = base
    ? [
        `*.publisher.${base}`,
        `*.subscriber.${base}`,
        `publisher.${base}`,
        `subscriber.${base}`,
        base,
      ]
    : [];
  return {
    domains,
    challenge: 'dns-01',
    certName: base ? `portal-wildcard-${base.replace(/\./g, '-')}` : 'portal-wildcard',
    email: email || '',
  };
}

function renderNginxSnippet(baseDomain, hosts) {
  const lines = [
    '# SIM portal tenants',
    'map $host $td_portal_sd_type {',
    '    default main;',
    `    publisher.${baseDomain} publisher;`,
    `    subscriber.${baseDomain} subscriber;`,
  ];
  for (const h of hosts) {
    lines.push(`    ${h.host} ${h.role};`);
  }
  lines.push(
    `    ~^(?<td_slug>[a-z0-9-]+)\\.publisher\\.${baseDomain.replace(/\./g, '\\.')}$ publisher;`
  );
  lines.push('}');
  return lines.join('\n') + '\n';
}

function checkPortalTenantAccess(portalTenant, user) {
  if (!portalTenant) return { ok: true };
  if (!user) return { ok: true };
  if (user.role === 'owner_system') return { ok: true };
  if (portalTenant.role === 'publisher') {
    if (Number(user.publisherId) !== Number(portalTenant.publisherId)) {
      return { ok: false, code: 'TENANT_HOST_MISMATCH' };
    }
  } else {
    const sid = user.subscriberId ?? user.clientId;
    if (Number(sid) !== Number(portalTenant.subscriberId)) {
      return { ok: false, code: 'TENANT_HOST_MISMATCH' };
    }
  }
  return { ok: true };
}

async function main() {
  console.log('\n=== sim-portal-pipeline ===\n');
  fs.mkdirSync(OUT, { recursive: true });

  const baseDomain = 'sim.totemdigital.test';
  const ipv4 = '203.0.113.10';

  console.log('1) Cloudflare DNS plan (dry-run)');
  const dnsPlan = buildPortalWildcardDnsPlan(baseDomain, ipv4);
  assert(dnsPlan.length === 4, `4 registos A planeados (${dnsPlan.length})`);
  assert(
    dnsPlan.every((r) => r.proxied === false),
    'wildcards com proxied=false (DNS-01)'
  );
  fs.writeFileSync(path.join(OUT, 'cloudflare-plan.json'), JSON.stringify(dnsPlan, null, 2));

  console.log('2) LE wildcard SSL plan');
  const sslPlan = buildPortalWildcardSslPlan(baseDomain, 'ops@sim.totemdigital.test');
  assert(sslPlan.domains.length === 5, `5 SANs no plano SSL (${sslPlan.domains.length})`);
  assert(sslPlan.challenge === 'dns-01', 'challenge dns-01');
  const sslDir = path.join(OUT, 'ssl', sslPlan.certName);
  fs.mkdirSync(path.join(sslDir, 'live'), { recursive: true });
  fs.writeFileSync(path.join(sslDir, 'plan.json'), JSON.stringify(sslPlan, null, 2));
  fs.writeFileSync(path.join(sslDir, 'live', 'fullchain.pem'), 'SIM-CERT\n');
  fs.writeFileSync(path.join(sslDir, 'live', 'privkey.pem'), 'SIM-KEY\n');

  console.log('3) Seed 2ª agência (simulado)');
  const pubs = [{ id: 1, name: 'Owner', slug: 'org-owner', is_system_owner: true }];
  assert(pubs.length === 1, 'pré-condição: 1 org owner');
  const agency = {
    id: 2,
    name: 'Agência Demo 2',
    slug: 'agencia-demo-2',
    is_system_owner: false,
  };
  const subscriber = { id: 1, name: 'Anunciante Demo', slug: 'anunciante-demo' };
  pubs.push(agency);
  assert(pubs.length === 2, 'após seed: 2 organizações');
  assert(agency.slug === 'agencia-demo-2', 'slug 2ª agência');
  fs.writeFileSync(
    path.join(OUT, 'seed-second-agency.json'),
    JSON.stringify({ publishers: pubs, subscriber }, null, 2)
  );

  console.log('4) Nginx snippet + sync sim');
  const hosts = [
    {
      role: 'publisher',
      host: `${agency.slug}.publisher.${baseDomain}`,
      slug: agency.slug,
    },
    {
      role: 'subscriber',
      host: `${subscriber.slug}.subscriber.${baseDomain}`,
      slug: subscriber.slug,
    },
  ];
  const nginx = renderNginxSnippet(baseDomain, hosts);
  assert(nginx.includes('agencia-demo-2.publisher'), 'snippet inclui host 2ª agência');
  const runtimeDir = path.join(OUT, 'portal-hosts');
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(path.join(runtimeDir, 'totemdigital-portal-tenants.conf'), nginx);
  fs.writeFileSync(
    path.join(runtimeDir, 'manifest.json'),
    JSON.stringify({ baseDomain, hosts, generatedAt: new Date().toISOString() }, null, 2)
  );

  console.log('5) Isolamento JWT ↔ tenantSlug');
  const tenant = { role: 'publisher', slug: 'agencia-demo-2', publisherId: 2 };
  assert(
    checkPortalTenantAccess(tenant, { role: 'publisher', publisherId: 2 }).ok === true,
    'JWT matching → ok'
  );
  assert(
    checkPortalTenantAccess(tenant, { role: 'publisher', publisherId: 99 }).ok === false,
    'JWT mismatch → 403'
  );
  assert(
    checkPortalTenantAccess(tenant, { role: 'owner_system' }).ok === true,
    'owner_system bypass'
  );

  const summary = {
    ok: true,
    steps: results.length,
    out: OUT,
    at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, 'SUMMARY.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== OK —', results.length, 'checks · artefactos em', OUT, '===\n');
  return runtimeDir;
}

const runtimeDir = await main().catch((e) => {
  console.error('\n=== FALHOU ===\n', e.message || e);
  process.exit(1);
});
