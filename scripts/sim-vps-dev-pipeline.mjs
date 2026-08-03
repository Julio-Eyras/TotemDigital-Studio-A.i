#!/usr/bin/env node
/**
 * Emulação L0 do procedimento VPS `dev` + multi-agência.
 * Não precisa Docker/root. Avalia scripts, presets, portal e dry-run do instalador.
 *
 * Uso: node scripts/sim-vps-dev-pipeline.mjs
 * Relatório: runtime/vps-dev-sim/REPORT.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'runtime', 'vps-dev-sim');
const results = [];

function ok(id, msg, detail) {
  results.push({ id, ok: true, msg, detail });
  console.log(`  ✓ [${id}] ${msg}`);
}
function fail(id, msg, detail) {
  results.push({ id, ok: false, msg, detail });
  console.error(`  ✗ [${id}] ${msg}${detail ? ` — ${detail}` : ''}`);
}
function assert(id, cond, msg, detail) {
  if (cond) ok(id, msg, detail);
  else fail(id, msg, detail);
}

function existsRel(rel) {
  return fs.existsSync(path.join(REPO, rel));
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: REPO,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, ...(opts.env || {}) },
    timeout: opts.timeout || 120000,
  });
}

function findBash() {
  const candidates = ['bash', 'C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Windows\\System32\\bash.exe'];
  for (const c of candidates) {
    const r = spawnSync(c, ['-c', 'echo ok'], { encoding: 'utf8' });
    if (r.status === 0 && String(r.stdout || '').includes('ok')) return c;
  }
  return null;
}

/** Espelho mínimo dos presets (L0 sem ts-node). */
function buildCorePreset() {
  return {
    core_publish: true,
    organization: true,
    direct_totem_mode: true,
    simple_totem_mode: true,
    multi_agency: false,
    subscribers: false,
    campaigns: false,
    playlists_advanced: false,
    billing: false,
  };
}
function buildProPreset() {
  return {
    core_publish: true,
    organization: true,
    multi_agency: true,
    direct_totem_mode: false,
    simple_totem_mode: false,
    subscribers: true,
    campaigns: true,
    playlists_advanced: true,
    billing: true,
  };
}

function checkPortalTenantAccess(portalTenant, user) {
  if (!portalTenant || !user) return { ok: true };
  if (user.role === 'owner_system') return { ok: true };
  if (portalTenant.role === 'publisher') {
    return { ok: Number(user.publisherId) === Number(portalTenant.publisherId) };
  }
  const sid = user.subscriberId ?? user.clientId;
  return { ok: Number(sid) === Number(portalTenant.subscriberId) };
}

function buildLitePreset() {
  return {
    core_publish: true,
    organization: true,
    multi_agency: true,
    direct_totem_mode: false,
    subscribers: false,
    billing: false,
    campaigns: false,
    ota: false,
  };
}

async function main() {
  console.log('\n=== sim-vps-dev-pipeline (L0) ===\n');
  fs.mkdirSync(OUT, { recursive: true });

  // T01
  console.log('T01 Artefactos / docs');
  assert('T01a', existsRel('scripts/Instala-TotemDigital-Server.sh'), 'instalador presente');
  assert('T01b', existsRel('docs/VPS-DEV-DO-ZERO-MULTI-AGENCIA.md'), 'guia VPS dev');
  assert('T01c', existsRel('docs/DESENHO-PURGE-DADOS-COMERCIAIS.md'), 'desenho purge');
  assert('T01d', existsRel('docs/PLANO-TESTES-MULTI-AGENCIA-DEV.md'), 'plano de testes');
  assert('T01e', existsRel('scripts/lib/totemdigital-instancia.sh'), 'lib instância');
  assert('T01f', existsRel('scripts/bot-multiagencia-emulate.mjs'), 'bot emulação');

  // T02–T04 presets
  console.log('T02–T04 Presets Direct Totem / Pro / lite / anti-C');
  const off = buildCorePreset();
  const on = buildProPreset();
  const lite = buildLitePreset();
  assert('T02', off.direct_totem_mode && !off.multi_agency && !off.billing, 'OFF = Direct Totem');
  assert('T03', on.multi_agency && !on.direct_totem_mode && on.billing && on.campaigns, 'ON = Pro');
  assert('T03b', lite.multi_agency && !lite.subscribers && !lite.billing && !lite.direct_totem_mode, 'lite sem anunciantes/billing');
  assert('T04', !(on.multi_agency && on.direct_totem_mode), 'D6-C: Pro+DT simultâneo proibido no preset');
  assert('T04b', !(lite.multi_agency && lite.direct_totem_mode), 'D6-C: lite+DT simultâneo proibido');

  // T05 portal
  console.log('T05 Portal pipeline');
  const portal = run(process.execPath, ['scripts/sim-portal-pipeline.mjs']);
  assert(
    'T05',
    portal.status === 0,
    'sim-portal-pipeline exit 0',
    portal.status !== 0 ? (portal.stderr || portal.stdout || '').slice(0, 200) : undefined
  );

  // T06 SSL/DNS scripts --sim
  console.log('T06 Scripts --sim');
  const bash = findBash();
  if (!bash) {
    fail('T06', 'bash não encontrado', 'instale Git Bash ou WSL');
  } else {
    const ssl = run(bash, [
      'scripts/issue-portal-wildcard-cert.sh',
      '--sim',
      '--base-domain',
      'dev.totemdigital.app.br',
      '--email',
      'ops@dev.totemdigital.app.br',
    ]);
    assert('T06a', ssl.status === 0, 'issue-portal-wildcard-cert --sim', ssl.stderr || ssl.stdout);

    // gerar hosts e sync --sim (path relativo POSIX — bash no Windows come \\)
    const hostsRel = 'runtime/vps-dev-sim/portal-hosts';
    const hostsDir = path.join(REPO, ...hostsRel.split('/'));
    fs.mkdirSync(hostsDir, { recursive: true });
    fs.writeFileSync(
      path.join(hostsDir, 'totemdigital-portal-tenants.conf'),
      '# sim\nmap $host $x { default main; }\n'
    );
    const sync = run(bash, ['scripts/sync-portal-hosts.sh', '--sim', hostsRel]);
    assert('T06b', sync.status === 0, 'sync-portal-hosts --sim', sync.stderr || sync.stdout);
  }

  // T07 isolamento
  console.log('T07 Isolamento JWT');
  const tenant = { role: 'publisher', publisherId: 2 };
  assert('T07a', checkPortalTenantAccess(tenant, { publisherId: 2 }).ok, 'JWT match');
  assert('T07b', !checkPortalTenantAccess(tenant, { publisherId: 9 }).ok, 'JWT mismatch');
  assert('T07c', checkPortalTenantAccess(tenant, { role: 'owner_system' }).ok, 'owner bypass');

  // T08 seed lógica
  console.log('T08 Seed 2ª agência');
  const pubs = [{ id: 1, slug: 'org-owner' }];
  assert('T08a', pubs.length === 1, 'pré-condição 1 org');
  pubs.push({ id: 2, slug: 'agencia-demo-2' });
  assert('T08b', pubs.length === 2 && pubs[1].slug === 'agencia-demo-2', 'após seed 2 orgs');

  // T09 instalador dry-run
  console.log('T09 Instalador dry-run --instancia dev');
  if (!bash) {
    fail('T09', 'bash ausente — dry-run instalador saltado');
  } else {
    const dry = run(
      bash,
      [
        'scripts/Instala-TotemDigital-Server.sh',
        '--modo',
        'producao',
        '--instancia',
        'dev',
        '--sim',
        '--dry-run',
        '--email',
        'ops@dev.totemdigital.app.br',
        '--owner-user',
        'Owner',
      ],
      { env: { TDI_GIT_BRANCH: 'TotemDigital-MultiAgencia', NON_INTERACTIVE: 'true' }, timeout: 180000 }
    );
    const out = `${dry.stdout || ''}\n${dry.stderr || ''}`;
    fs.writeFileSync(path.join(OUT, 'install-dry-run.txt'), out);
    assert('T09a', dry.status === 0, 'instalador dry-run exit 0', out.slice(-300));
    assert(
      'T09b',
      /dev\.totemdigital\.app\.br/i.test(out) || /Desenvolvimento/i.test(out),
      'plano menciona domínio/label dev'
    );
    assert('T09c', /3001/.test(out) || /TotemDigital-Studio-dev/i.test(out) || /smartsignage_dev/i.test(out), 'plano menciona porta/clone/BD dev');
  }

  // T10 purge doc
  console.log('T10 Purge desenho');
  const purgeDoc = fs.readFileSync(path.join(REPO, 'docs/DESENHO-PURGE-DADOS-COMERCIAIS.md'), 'utf8');
  assert('T10a', /APAGAR DADOS COMERCIAIS/i.test(purgeDoc), 'frase de confirmação');
  assert('T10b', /billing|campaigns|playlists/i.test(purgeDoc), 'scopes comerciais');
  assert('T10c', /dryRun/i.test(purgeDoc), 'dryRun por defeito');

  // T11 clone branch no script
  console.log('T11 Clone branch');
  const lib = fs.readFileSync(path.join(REPO, 'scripts/lib/totemdigital-instancia.sh'), 'utf8');
  assert('T11a', /TDI_GIT_BRANCH/.test(lib), 'usa TDI_GIT_BRANCH');
  assert('T11b', !/git clone --branch SmartSignage-direc-totem/.test(lib), 'não força direc-totem');
  assert('T11c', /TotemDigital-MultiAgencia/.test(lib), 'fallback MultiAgencia');

  const failed = results.filter((r) => !r.ok);
  const report = {
    level: 'L0',
    ok: failed.length === 0,
    passed: results.filter((r) => r.ok).length,
    failed: failed.length,
    total: results.length,
    at: new Date().toISOString(),
    results,
    next: failed.length
      ? 'Corrigir falhas L0 antes do VPS'
      : 'L0 verde — seguir docs/VPS-DEV-DO-ZERO-MULTI-AGENCIA.md (checklist L2)',
  };
  fs.writeFileSync(path.join(OUT, 'REPORT.json'), JSON.stringify(report, null, 2));
  console.log(
    `\n=== ${report.ok ? 'OK' : 'FALHOU'} — ${report.passed}/${report.total} · ${OUT}/REPORT.json ===\n`
  );
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
