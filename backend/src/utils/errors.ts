/**
 * errors.ts — Helpers globais de tipagem de erro SPRINT 6.
 *
 * Centraliza toda a lógica de "cast seguro de unknown → Error + extras" para
 * eliminar `catch (e: unknown)` do código. Substitui o padrão espalhado:
 *
 *   catch (rawErr: unknown) {
 const e = normalizeError(rawErr);
 *     const message = e?.message || 'erro';
 *     const code = e?.code;
 *     await logError('...', e);
 *   }
 *
 * por:
 *
 *   catch (error: unknown) {
 *     const e = const e = normalizeError(r);
 *     await logError('...', e);
 *     // e.message: string, e.code: string | undefined
 *   }
 */

export interface NormalizedError {
  /** Erro original (para stack trace completo). */
  raw: unknown;
  /** Instância Error (garantida, nunca null/undefined). */
  error: Error;
  /** Mensagem segura (string sempre presente). */
  message: string;
  /** Código opcional (erros do sistema, Postgres `42P01` / `23505` etc.). */
  code?: string;
  /** statusCode opcional (HTTP). */
  statusCode?: number;
}

const STRING_FALLBACK = 'Erro interno do servidor';

/**
 * Converte qualquer valor capturado em um catch em um objeto NormalizedError
 * com todas as propriedades tipadas com segurança.
 */
export function normalizeError(raw: unknown): NormalizedError {
  if (raw instanceof Error) {
    const code = typeof (raw as unknown as { code?: unknown }).code === 'string'
      ? ((raw as unknown as { code: string }).code)
      : undefined;
    const statusCode =
      typeof (raw as unknown as { statusCode?: unknown }).statusCode === 'number'
        ? ((raw as unknown as { statusCode: number }).statusCode)
        : undefined;
    return {
      raw,
      error: raw,
      message: raw.message || STRING_FALLBACK,
      code,
      statusCode,
    };
  }

  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    const message =
      typeof o.message === 'string' && o.message.trim()
        ? o.message
        : typeof o.error === 'string' && o.error.trim()
        ? o.error
        : STRING_FALLBACK;
    const code = typeof o.code === 'string' ? o.code : undefined;
    const statusCode = typeof o.statusCode === 'number' ? o.statusCode : undefined;
    return {
      raw,
      error: new Error(message),
      message,
      code,
      statusCode,
    };
  }

  const message = typeof raw === 'string' && raw.trim() ? raw : STRING_FALLBACK;
  return {
    raw,
    error: new Error(message),
    message,
    code: undefined,
    statusCode: undefined,
  };
}

/**
 * Verifica se o erro é uma violação de unicidade do Postgres (23505)
 * ou qualquer mensagem equivalente. Retorna { unique: boolean, constraint?: string }.
 * Aceita `unknown` (não `any`).
 */
export function detectUniqueViolation(raw: unknown): {
  unique: boolean;
  constraint?: string;
  message?: string;
} {
  const n = normalizeError(raw);
  if (n.code === '23505') {
    const detail =
      typeof (n.raw as Record<string, unknown> | null)?.detail === 'string'
        ? ((n.raw as Record<string, unknown>).detail as string)
        : undefined;
    return { unique: true, constraint: n.code, message: detail || n.message };
  }
  const lower = n.message.toLowerCase();
  if (lower.includes('duplicate key') || lower.includes('unique constraint')) {
    return { unique: true, message: n.message };
  }
  return { unique: false };
}

/**
 * Detecta "tabela não existe" no Postgres (42P01). Aceita unknown.
 */
export function detectMissingTable(raw: unknown): boolean {
  const n = normalizeError(raw);
  if (n.code === '42P01') return true;
  const lower = n.message.toLowerCase();
  return lower.includes('does not exist') || lower.includes('relation ') || lower.includes('undefined_table');
}

/**
 * Detecta erro de permissão / acesso negado (incluindo "Modo compacto" do Lab).
 */
export function detectAccessDenied(raw: unknown): boolean {
  const n = normalizeError(raw);
  const lower = n.message.toLowerCase();
  return (
    n.message.includes('Acesso negado') ||
    n.message.includes('Modo compacto') ||
    lower.includes('permission denied') ||
    lower.includes('forbidden')
  );
}
