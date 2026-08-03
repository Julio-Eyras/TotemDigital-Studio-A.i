#!/usr/bin/env node
/**
 * Bot orquestrador — emulação Multi-agência (L0 / L1 Docker / L2 SSH opcional).
 *
 * Uso:
 *   node scripts/bot-multiagencia-emulate.mjs
 *   node scripts/bot-multiagencia-emulate.mjs --level l0
 *   node scripts/bot-multiagencia-emulate.mjs --level l1
 *   node scripts/bot-multiagencia-emulate.mjs --level l2   # precisa TDI_EMU_SSH_HOST
 *   node scripts/bot-multiagencia-emulate.mjs --level all
 *
 * Env L2:
 *   TDI_EMU_SSH_HOST=contabo-totem   (ou user@ip)
 *   TDI_EMU_SSH_BASE_URL=https://dev.totemdigital.app.br
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const OUT = path.join(REPO, 'runtime', 'multiagencia-emu');
const args = process.argv.slice(2);
const levelArg = (() => {
  const i = args.indexOf('--level');
  if (i >= 0 && args[i + 1]) return String(args[i + 1]).toLowerCase();
  return 'all';
})();

const report = {
  at: new Date().toISOString(),
  levelRequested: levelArg,
  steps: [],
  ok: true,
};

function log(msg) {
  console.log(msg);
}

function record(id, ok, msg, detail) {
  report.steps.push({ id, ok, msg, detail: detail || null });
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} [${id}] ${msg}${detail && !ok ? ` — ${String(detail).slice(0, 180)}` : ''}`);
  if (!ok) report.ok = false;
}

function run(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, {
    cwd: opts.cwd || REPO,
    encoding: 'utf8',
    shell: opts.shell === true,
    env: { ...process.env, ...(opts.env || {}) },
    timeout: opts.timeout || 600000,
  });
}

function hasDocker() {
  const r = run('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 15000 });
  return r.status === 0 && String(r.stdout || '').trim().length > 0;
}

function hasCompose() {
  let r = run('docker', ['compose', 'version'], { timeout: 15000 });
  if (r.status === 0) return { bin: 'docker', prefix: ['compose'] };
  r = run('docker-compose', ['version'], { timeout: 15000 });
  if (r.status === 0) return { bin: 'docker-compose', prefix: [] };
  return null;
}

function findBash() {
  const candidates = [
    'bash',
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Windows\\System32\\bash.exe',
  ];
  for (const c of candidates) {
    const r = spawnSync(c, ['-c', 'echo ok'], { encoding: 'utf8' });
    if (r.status === 0 && String(r.stdout || '').includes('ok')) return c;
  }
  return null;
}

function runL0() {
  log('\n═══ L0 — harness estático / dry-run ═══');
  const r = run(process.execPath, ['scripts/sim-vps-dev-pipeline.mjs'], { timeout: 300000 });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'l0-console.txt'), out);
  record('L0', r.status === 0, 'sim-vps-dev-pipeline', r.status !== 0 ? out.slice(-400) : undefined);
  return r.status === 0;
}

function runL1() {
  log('\n═══ L1 — Docker Ubuntu + Postgres ═══');
  if (!hasDocker()) {
    record('L1', false, 'Docker não disponível', 'Instale Docker Desktop e volte a correr --level l1');
    return false;
  }
  const compose = hasCompose();
  if (!compose) {
    record('L1', false, 'docker compose indisponível');
    return false;
  }

  const file = 'docker-compose.multiagencia-emu.yml';
  const downArgs = [...compose.prefix, '-f', file, 'down', '-v', '--remove-orphans'];
  run(compose.bin, downArgs, { timeout: 120000 });

  const upArgs = [
    ...compose.prefix,
    '-f',
    file,
    'up',
    '--build',
    '--abort-on-container-exit',
    '--exit-code-from',
    'ubuntu-runner',
  ];
  log(`  → ${compose.bin} ${upArgs.join(' ')}`);
  const r = run(compose.bin, upArgs, { timeout: 1800000 });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'l1-console.txt'), out);
  const l1Report = path.join(OUT, 'L1-REPORT.txt');
  const okFile = fs.existsSync(l1Report);
  record(
    'L1',
    r.status === 0 && okFile,
    'ubuntu-runner + schema + jest + L0 + dry-run install',
    r.status !== 0 ? out.slice(-500) : undefined
  );

  run(compose.bin, [...compose.prefix, '-f', file, 'down', '-v'], { timeout: 120000 });
  return r.status === 0 && okFile;
}

function runL2() {
  log('\n═══ L2 — smoke VPS remoto (SSH) ═══');
  const host = process.env.TDI_EMU_SSH_HOST || '';
  const baseUrl = process.env.TDI_EMU_SSH_BASE_URL || 'https://dev.totemdigital.app.br';
  if (!host) {
    record(
      'L2',
      false,
      'TDI_EMU_SSH_HOST não definido',
      'Ex.: set TDI_EMU_SSH_HOST=contabo-totem (Host do ~/.ssh/config)'
    );
    return false;
  }

  const healthLocal = run('curl', ['-fsS', '--max-time', '20', `${baseUrl}/api/health`], {
    timeout: 30000,
  });
  // Windows may need curl.exe
  let health = healthLocal;
  if (health.status !== 0) {
    health = run('curl.exe', ['-fsS', '--max-time', '20', `${baseUrl}/api/health`], {
      timeout: 30000,
    });
  }
  record(
    'L2a',
    health.status === 0,
    `GET ${baseUrl}/api/health`,
    health.status !== 0 ? health.stderr || health.stdout : (health.stdout || '').slice(0, 120)
  );

  const sshCmd = [
    host,
    'bash -lc "git -C ~/TotemDigital-Studio-dev rev-parse --abbrev-ref HEAD 2>/dev/null; systemctl is-active smart-signage-dev 2>/dev/null || true"',
  ];
  const ssh = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', ...sshCmd], {
    timeout: 60000,
  });
  const sshOut = `${ssh.stdout || ''}\n${ssh.stderr || ''}`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'l2-ssh.txt'), sshOut);
  record(
    'L2b',
    ssh.status === 0 && /TotemDigital-MultiAgencia/i.test(sshOut),
    'SSH: branch clone-dev = MultiAgencia',
    ssh.status !== 0 ? sshOut.slice(0, 300) : sshOut.trim().slice(0, 200)
  );
  record(
    'L2c',
    /active/.test(sshOut),
    'SSH: smart-signage-dev active (se systemd reportar)',
    /active/.test(sshOut) ? undefined : 'serviço inactivo ou sem systemctl no path'
  );

  return report.steps.filter((s) => s.id.startsWith('L2') && !s.ok).length === 0;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  log(`\n🤖 bot-multiagencia-emulate · level=${levelArg}\n`);

  const wantL0 = levelArg === 'all' || levelArg === 'l0';
  const wantL1 = levelArg === 'l1' || (levelArg === 'all' && hasDocker());
  const wantL2 =
    levelArg === 'l2' || (levelArg === 'all' && Boolean(process.env.TDI_EMU_SSH_HOST));

  if (wantL0) runL0();

  if (levelArg === 'all' && !hasDocker()) {
    record('L1', true, 'Docker ausente — L1 saltado em --level all', 'instale Docker e use --level l1');
  } else if (wantL1 || levelArg === 'l1') {
    runL1();
  }

  if (levelArg === 'all' && !process.env.TDI_EMU_SSH_HOST) {
    record('L2', true, 'TDI_EMU_SSH_HOST ausente — L2 saltado em --level all');
  } else if (wantL2 || levelArg === 'l2') {
    runL2();
  }

  if (levelArg === 'l1' && !hasDocker()) report.ok = false;
  if (levelArg === 'l2' && !process.env.TDI_EMU_SSH_HOST) report.ok = false;

  const bash = findBash();
  report.environment = {
    platform: process.platform,
    docker: hasDocker(),
    bash: Boolean(bash),
    sshHost: process.env.TDI_EMU_SSH_HOST || null,
  };

  fs.writeFileSync(path.join(OUT, 'BOT-REPORT.json'), JSON.stringify(report, null, 2));
  log(
    `\n═══ ${report.ok ? 'BOT OK' : 'BOT COM FALHAS'} — ${OUT}/BOT-REPORT.json ═══\n`
  );
  if (!report.ok) process.exit(1);
}

main();
