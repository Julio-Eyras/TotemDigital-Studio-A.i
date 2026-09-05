/**
 * Let's Encrypt wildcard (DNS-01) para portais *.publisher / *.subscriber.
 * Emissão real via scripts/issue-portal-wildcard-cert.sh (--sim para dry-run).
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logError, logInfo, logWarn } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export type PortalSslPlan = {
  domains: string[];
  challenge: 'dns-01';
  pluginHint: 'certbot-dns-cloudflare' | 'manual';
  certName: string;
  email: string;
  livePath: string;
  notes: string[];
};

export type PortalSslIssueResult = {
  ok: boolean;
  dryRun: boolean;
  plan: PortalSslPlan;
  scriptRan: boolean;
  output?: string;
  message: string;
};

export function buildPortalWildcardSslPlan(opts: {
  baseDomain: string;
  email?: string;
}): PortalSslPlan {
  const base = String(opts.baseDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  const email = (opts.email || process.env.PORTAL_SSL_EMAIL || process.env.LETSENCRYPT_EMAIL || '')
    .trim()
    .toLowerCase();

  const domains = base
    ? [
        `*.publisher.${base}`,
        `*.subscriber.${base}`,
        `publisher.${base}`,
        `subscriber.${base}`,
        base,
      ]
    : [];

  const certName = base ? `portal-wildcard-${base.replace(/\./g, '-')}` : 'portal-wildcard';
  const notes: string[] = [];
  if (!base) notes.push('Defina portal.base_domain antes de emitir o certificado.');
  if (!email) notes.push('Defina portal.ssl_email ou LETSENCRYPT_EMAIL.');
  notes.push('DNS-01: wildcards exigem desafio DNS (não HTTP-01).');
  notes.push('Cloudflare: use credentials.ini com token de Zone:DNS:Edit; proxied=false nos wildcards.');
  notes.push('Após emitir, recarregue Nginx apontando ssl_certificate para /etc/letsencrypt/live/<certName>/');

  return {
    domains,
    challenge: 'dns-01',
    pluginHint:
      process.env.CLOUDFLARE_API_TOKEN || process.env.PORTAL_CLOUDFLARE_API_TOKEN
        ? 'certbot-dns-cloudflare'
        : 'manual',
    certName,
    email,
    livePath: `/etc/letsencrypt/live/${certName}/`,
    notes,
  };
}

function resolveIssueScript(): string {
  return (
    process.env.PORTAL_SSL_ISSUE_SCRIPT ||
    path.join(process.cwd(), 'scripts', 'issue-portal-wildcard-cert.sh')
  );
}

function runScript(scriptPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath, ...args], {
      env: process.env,
      windowsHide: true,
    });
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => {
      out += String(d);
    });
    child.stderr?.on('data', (d) => {
      err += String(d);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out || err);
      else reject(new Error(err || out || `exit ${code}`));
    });
  });
}

/**
 * Emite (ou simula) certificado wildcard do portal.
 * dryRun / PORTAL_SSL_DRY_RUN / --sim no script → não chama certbot real.
 */
export async function issuePortalWildcardCertificate(opts: {
  baseDomain: string;
  email?: string;
  dryRun?: boolean;
  zoneId?: string;
}): Promise<PortalSslIssueResult> {
  const plan = buildPortalWildcardSslPlan({
    baseDomain: opts.baseDomain,
    email: opts.email,
  });
  const dryRun =
    opts.dryRun === true ||
    process.env.PORTAL_SSL_DRY_RUN === 'true' ||
    process.env.PORTAL_DNS_DRY_RUN === 'true';

  if (!plan.domains.length) {
    return {
      ok: false,
      dryRun,
      plan,
      scriptRan: false,
      message: 'portal.base_domain em falta — não é possível planear o certificado.',
    };
  }

  if (dryRun) {
    const simDir =
      process.env.PORTAL_SSL_SIM_DIR ||
      path.join(process.cwd(), 'runtime', 'portal-ssl-sim', plan.certName);
    fs.mkdirSync(simDir, { recursive: true });
    fs.writeFileSync(
      path.join(simDir, 'plan.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), plan, dryRun: true }, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(simDir, 'README.txt'),
      [
        'SIMULAÇÃO — certificado NÃO emitido',
        `Domínios: ${plan.domains.join(', ')}`,
        `Cert name: ${plan.certName}`,
        `Plugin: ${plan.pluginHint}`,
        ...plan.notes,
      ].join('\n'),
      'utf8'
    );
    await logInfo('Portal SSL wildcard simulado', { certName: plan.certName, simDir });
    return {
      ok: true,
      dryRun: true,
      plan,
      scriptRan: false,
      message: `Simulação SSL: plano escrito em ${simDir} (certbot não executado).`,
      output: simDir,
    };
  }

  const scriptPath = resolveIssueScript();
  if (!fs.existsSync(scriptPath)) {
    return {
      ok: false,
      dryRun: false,
      plan,
      scriptRan: false,
      message: `Script ausente: ${scriptPath}`,
    };
  }

  const args = [
    '--base-domain',
    opts.baseDomain,
    '--email',
    plan.email || 'admin@localhost',
    '--cert-name',
    plan.certName,
  ];
  if (opts.zoneId) {
    args.push('--zone-id', opts.zoneId);
  }

  try {
    const output = await runScript(scriptPath, args);
    await logInfo('Portal SSL wildcard emitido', { certName: plan.certName });
    return {
      ok: true,
      dryRun: false,
      plan,
      scriptRan: true,
      output,
      message: `Certificado ${plan.certName} emitido/renovado via DNS-01.`,
    };} catch (error: unknown) {
      const e = normalizeError(error);
    await logWarn('Falha ao emitir wildcard portal', { error: ((e.raw as { message?: string })?.message) });
    await logError('issuePortalWildcardCertificate', e.error);
    return {
      ok: false,
      dryRun: false,
      plan,
      scriptRan: true,
      output: ((e.raw as { message?: string })?.message),
      message: ((e.raw as { message?: string })?.message) || 'Falha no script de certificado',
    };
  }
}
