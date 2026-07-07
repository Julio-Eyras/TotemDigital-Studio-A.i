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
