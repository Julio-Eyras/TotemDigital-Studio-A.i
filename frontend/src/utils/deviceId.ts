/** Formato canônico compartilhado pelos formulários antes de enviar à API. */
export function normalizeDeviceId(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase();
}
