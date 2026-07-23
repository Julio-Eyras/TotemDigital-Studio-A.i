/**
 * Compatibilidade idempotente de schema — alinhado a database/smartchannel-db-v2-compat-remote-command-types.sql
 */
import { logInfoSync, logWarnSync } from '../utils/loggerHelper';

export const REMOTE_COMMAND_TYPES = [
  'restart',
  'restart_app',
  'reboot',
  'reset_board',
  'screenshot',
  'capture_screen',
  'invalidate_media',
  'invalidate_playlist',
  'invalidate_campaign',
  'refresh_dispatch',
  'sync_now',
  'content_version_check',
  'purge_cache',
  'clear_cache',
  'update',
  'config',
  'apply_player_config',
  'ota_rollback',
  'display_force_on',
  'display_force_off',
  'display_force_clear',
  'custom',
  'play',
  'pause',
  'load_playlist',
  'request_playlist',
  'ping',
] as const;

const REMOTE_COMMAND_TYPES_SQL = REMOTE_COMMAND_TYPES.map((t) => `'${t}'`).join(', ');

export async function ensureRemoteCommandTypesConstraint(
  pool: {
    query: (text: string) => Promise<unknown>;
  },
  options?: { strict?: boolean }
): Promise<boolean> {
  try {
    const exists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'remote_commands'
      ) AS exists
    `);
    const tableExists = Boolean((exists as { rows?: Array<{ exists?: boolean }> }).rows?.[0]?.exists);
    if (!tableExists) {
      return true;
    }

    await pool.query(`
      ALTER TABLE remote_commands DROP CONSTRAINT IF EXISTS chk_remote_command_type;
    `);
    await pool.query(`
      ALTER TABLE remote_commands ADD CONSTRAINT chk_remote_command_type
        CHECK (command_type IN (${REMOTE_COMMAND_TYPES_SQL}));
    `);

    logInfoSync('Schema compat: chk_remote_command_type atualizado', {
      types: REMOTE_COMMAND_TYPES.length,
    });
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (options?.strict) {
      throw error;
    }
    logWarnSync('Schema compat: falha ao atualizar chk_remote_command_type', {
      error: message,
    });
    return false;
  }
}

export function isRemoteCommandTypeConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('chk_remote_command_type');
}

/**
 * Garante tabela remote_screenshots + colunas player_settings/now_playing em totems.
 * Alinhado a database/smartchannel-db-v2-compat-remote-screenshots.sql
 */
export async function ensureRemoteScreenshotsSchema(
  pool: {
    query: (text: string) => Promise<unknown>;
  },
  options?: { strict?: boolean }
): Promise<boolean> {
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS totems ADD COLUMN IF NOT EXISTS player_settings JSONB DEFAULT '{}'::jsonb;
    `);
    await pool.query(`
      ALTER TABLE IF EXISTS totems ADD COLUMN IF NOT EXISTS now_playing JSONB;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS remote_screenshots (
        id SERIAL PRIMARY KEY,
        totem_id INTEGER NOT NULL,
        command_id INTEGER,
        file_path TEXT NOT NULL,
        file_size BIGINT DEFAULT 0,
        width INTEGER DEFAULT 0,
        height INTEGER DEFAULT 0,
        format TEXT DEFAULT 'png',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_remote_screenshots_totem_created
        ON remote_screenshots (totem_id, created_at DESC);
    `);
    logInfoSync('Schema compat: remote_screenshots / player_settings OK');
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (options?.strict) throw error;
    logWarnSync('Schema compat: falha remote_screenshots/player_settings', { error: message });
    return false;
  }
}
