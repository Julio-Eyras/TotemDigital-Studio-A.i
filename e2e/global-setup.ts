import { execSync } from 'child_process';
import path from 'path';

async function waitForPostgres(connectionString: string, maxAttempts = 40): Promise<void> {
  const { default: pg } = await import('pg');
  for (let i = 0; i < maxAttempts; i++) {
    const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 3000 });
    try {
      await pool.query('SELECT 1');
      await pool.end();
      return;
    } catch {
      await pool.end().catch(() => undefined);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Postgres E2E não respondeu a tempo (porta 5433).');
}

async function globalSetup(): Promise<void> {
  if (process.env.E2E_SKIP_DOCKER === '1') {
    console.log('[e2e] E2E_SKIP_DOCKER=1 — assumindo Postgres já disponível.');
  } else {
    const root = path.resolve(__dirname, '..');
    const composeFile = path.join(root, 'docker-compose.e2e.yml');
    try {
      execSync('docker compose version', { stdio: 'ignore' });
    } catch {
      throw new Error('Modo full requer Docker Desktop (docker compose).');
    }
    console.log('[e2e] Subindo Postgres (docker-compose.e2e.yml)...');
    execSync(`docker compose -f "${composeFile}" up -d`, { cwd: root, stdio: 'inherit' });
  }

  const dbUrl =
    process.env.DATABASE_URL ||
    'postgresql://smartsignage:smartsignage123@127.0.0.1:5433/smartsignage';

  await waitForPostgres(dbUrl);

  execSync('node scripts/prepare-db.mjs', {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: dbUrl },
  });

  console.log('[e2e] Stack full pronta (Postgres + credenciais E2E).');
}

export default globalSetup;
