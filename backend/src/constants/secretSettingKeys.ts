/** Chaves sensíveis em system_settings — mascaradas na API e preservadas se o admin deixar em branco. */
export const SECRET_SETTING_KEYS = new Set<string>([
  'financial.smtp_pass',
  'financial.whatsapp_api_token',
]);

export function isSecretSettingKey(key: string): boolean {
  return SECRET_SETTING_KEYS.has(key);
}

export function maskSecretSettingValue(key: string, value: unknown): unknown {
  if (!isSecretSettingKey(key)) return value;
  const str = String(value ?? '').trim();
  return str ? '********' : '';
}
