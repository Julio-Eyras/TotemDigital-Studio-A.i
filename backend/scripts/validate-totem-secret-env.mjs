#!/usr/bin/env node
/**
 * Valida TOTEM_SECRET_KEY e NODE_ENV antes de deploy/restart em staging/produção.
 * Uso: node backend/scripts/validate-totem-secret-env.mjs [--env-file /path/.env]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const INSECURE_VALUES = new Set([
  'smart-signage-totem-secret-key-2025-change-in-production',
  'dev-only-totem-secret-not-for-production',
]);

function parseArgs(argv) {
  let envFile = path.join(repoRoot, '.env');
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--env-file' && argv[i + 1]) {
      envFile = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return { envFile };
}

function loadEnvFile(envFile) {
  if (!fs.existsSync(envFile)) {
    return { ok: false, error: `.env não encontrado: ${envFile}` };
  }
  const env = {};
  const raw = fs.readFileSync(envFile, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return { ok: true, env };
}

function validate(env) {
  const errors = [];
  const warnings = [];
  const nodeEnv = (env.NODE_ENV || 'development').trim();
  const isProduction = nodeEnv === 'production';
  const totemKey = (env.TOTEM_SECRET_KEY || '').trim();

  if (isProduction && !totemKey) {
    errors.push('TOTEM_SECRET_KEY ausente — obrigatório com NODE_ENV=production');
  }

  if (totemKey && totemKey.length < 16) {
    errors.push('TOTEM_SECRET_KEY muito curta (mínimo recomendado: 16 caracteres)');
  }

  if (totemKey && INSECURE_VALUES.has(totemKey)) {
    const msg = 'TOTEM_SECRET_KEY usa valor padrão inseguro conhecido';
    if (isProduction) errors.push(msg);
    else warnings.push(`${msg} (aceitável só em desenvolvimento)`);
  }

  if (!isProduction && !totemKey) {
    warnings.push(
      'TOTEM_SECRET_KEY ausente — em development o backend usa fallback interno (não use em staging público)'
    );
  }

  if (isProduction && !env.TOTEMDIGITAL_COMPACT?.trim()) {
    warnings.push('TOTEMDIGITAL_COMPACT não definido — recomendado true para Smart Signage Studio');
  }

  return { errors, warnings, nodeEnv, hasKey: Boolean(totemKey) };
}

function main() {
  const { envFile } = parseArgs(process.argv);
  const loaded = loadEnvFile(envFile);
  if (!loaded.ok) {
    console.error(`ERRO: ${loaded.error}`);
    process.exit(1);
  }

  const { errors, warnings, nodeEnv, hasKey } = validate(loaded.env);

  console.log('== Validação TOTEM_SECRET_KEY ==');
  console.log(`Arquivo: ${envFile}`);
  console.log(`NODE_ENV: ${nodeEnv}`);
  console.log(`TOTEM_SECRET_KEY: ${hasKey ? 'definida (valor oculto)' : 'AUSENTE'}`);

  for (const w of warnings) {
    console.log(`AVISO: ${w}`);
  }
  for (const e of errors) {
    console.error(`ERRO: ${e}`);
  }

  if (errors.length > 0) {
    console.error('');
    console.error('Corrija o .env antes do deploy. Exemplo:');
    console.error('  openssl rand -base64 32');
    console.error('  echo "TOTEM_SECRET_KEY=<valor>" | sudo tee -a /opt/smart-signage/.env');
    process.exit(1);
  }

  console.log('OK: configuração aceite para arranque do backend.');
  process.exit(0);
}

main();
