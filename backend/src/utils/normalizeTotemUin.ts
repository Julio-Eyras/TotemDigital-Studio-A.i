/**
 * Normaliza código de ativação / UIN para o mesmo formato que o Player-AD
 * (`PlayerConfigLoader.normalizeActivationCode`). Manter em sincronia com
 * `player-web/js/activationCode.js`.
 */
export function normalizeTotemUin(raw: string | null | undefined): string {
  const normalized = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, '');
  const compact = normalized.replace(/-/g, '');
  if (/^TD[A-Z0-9]{8}$/.test(compact)) {
    return `TD-${compact.slice(2, 6)}-${compact.slice(6, 10)}`;
  }
  return normalized;
}
