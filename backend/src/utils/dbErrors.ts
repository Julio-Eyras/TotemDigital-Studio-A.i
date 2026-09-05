/**
 * Helpers para erros de banco (PostgreSQL)
 * Usado para retornar respostas amigáveis quando tabelas/views não existem
 * e para distinguir erros de validação (400) de erros de banco/procedure (500)
 */

/** Código PostgreSQL para "undefined_table" (tabela/relação não existe) */
const PG_UNDEFINED_TABLE = '42P01';

export function isMissingTableError(error: unknown): boolean {
  if (!error) return false;
  const err = error as Record<string, unknown>;
  const code = (err.code as string | undefined) || (err.errno as string | number | undefined);
  const message = String(err.message || '').toLowerCase();
  return code === PG_UNDEFINED_TABLE || message.includes('does not exist') || message.includes('relation ');
}

/**
 * Violação de unicidade (nome/email duplicado) — erro de validação, não 500.
 */
export function isUniqueViolationError(error: unknown): boolean {
  if (!error) return false;
  const err = error as Record<string, unknown>;
  const code = (err.code as string | undefined) ?? (err.errno as string | number | undefined);
  if (code === '23505') return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('duplicate key') || msg.includes('unique constraint');
}

/**
 * Indica se o erro é do PostgreSQL/banco (constraint, procedure, etc.).
 * Usado para devolver 500 em vez de 400 em falhas de procedure/constraint.
 */
export function isDatabaseError(error: unknown): boolean {
  if (isUniqueViolationError(error)) return false;
  if (!error) return false;
  const err = error as Record<string, unknown>;
  const code = (err.code as string | undefined) ?? (err.errno as string | number | undefined);
  if (code != null && typeof code === 'string' && /^[0-9A-Z]{2,5}$/.test(code)) return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('violates') ||
    msg.includes('constraint') ||
    msg.includes('duplicate key') ||
    msg.includes('unique constraint') ||
    msg.includes('falha ao inserir') ||
    msg.includes('does not exist') ||
    msg.includes('permission denied')
  );
}
