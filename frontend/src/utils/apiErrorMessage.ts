/**
 * Extrai mensagem legível de erros axios/fetch comuns (`response.data` string ou objeto).
 */
export function pickApiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: unknown }; message?: string };
  const d = e?.response?.data;
  if (typeof d === 'string' && d.trim()) return d.trim();
  if (d && typeof d === 'object' && d !== null) {
    const o = d as { error?: string; message?: string };
    if (typeof o.error === 'string' && o.error.trim()) return o.error.trim();
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
  }
  if (typeof e?.message === 'string' && e.message.trim()) return e.message.trim();
  return fallback;
}
