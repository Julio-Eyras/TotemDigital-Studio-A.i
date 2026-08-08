/**
 * Formato canônico para Device ID em todas as fronteiras do sistema.
 * Mantém separadores/conteúdo e elimina diferenças apenas de caixa/espaço externo.
 */
export function normalizeDeviceId(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase();
}
