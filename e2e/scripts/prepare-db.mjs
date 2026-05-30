/**
 * Garante credenciais conhecidas para login E2E (admin seed v6).
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://smartsignage:smartsignage123@127.0.0.1:5433/smartsignage';

const username = process.env.E2E_USERNAME || 'totemdigital.admin';
const password = process.env.E2E_PASSWORD || 'admin123';

async function main() {
  const pool = new pg.Pool({ connectionString });

  const tableCheck = await pool.query(`SELECT to_regclass('public.users') AS users_table`);
  if (!tableCheck.rows[0]?.users_table) {
    throw new Error(
      'Tabela users não existe. Verifique se o Postgres E2E aplicou o schema (docker-compose.e2e.yml).'
    );
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `UPDATE users SET password_hash = $1, is_active = true WHERE username = $2 RETURNING id, username, role`,
    [hash, username]
  );

  if (result.rowCount === 0) {
    throw new Error(`Utilizador E2E "${username}" não encontrado no seed v6.`);
  }

  console.log(`[e2e] Credenciais E2E prontas: ${username} / ${password} (role=${result.rows[0].role})`);
  await pool.end();
}

main().catch((err) => {
  console.error('[e2e] prepare-db falhou:', err.message);
  process.exit(1);
});
