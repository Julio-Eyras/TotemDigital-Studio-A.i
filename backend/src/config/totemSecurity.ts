/**
 * Segredo HMAC / encriptação de totens (player).
 * Em produção TOTEM_SECRET_KEY é obrigatório.
 */

import { logWarnSync } from '../utils/loggerHelper';
import { serverConfig } from './env';

const DEV_FALLBACK = 'dev-only-totem-secret-not-for-production';

export function getTotemSecretKey(): string {
  const value = process.env.TOTEM_SECRET_KEY?.trim();
  if (value) {
    return value;
  }
  if (serverConfig.isProduction) {
    throw new Error(
      'TOTEM_SECRET_KEY não definido. Configure no .env antes de iniciar em produção.'
    );
  }
  logWarnSync(
    'TOTEM_SECRET_KEY ausente — usando segredo de desenvolvimento (não use em produção)',
    {}
  );
  return DEV_FALLBACK;
}

export function validateTotemSecretConfig(): void {
  if (serverConfig.isProduction && !process.env.TOTEM_SECRET_KEY?.trim()) {
    throw new Error('TOTEM_SECRET_KEY deve estar definido em produção');
  }
  const key = process.env.TOTEM_SECRET_KEY?.trim();
  if (
    key &&
    (key === 'smart-signage-totem-secret-key-2025-change-in-production' ||
      key === DEV_FALLBACK)
  ) {
    const msg = 'TOTEM_SECRET_KEY está usando valor padrão inseguro';
    if (serverConfig.isProduction) {
      throw new Error(msg);
    }
    logWarnSync(`${msg} — altere no .env`, {});
  }
}
