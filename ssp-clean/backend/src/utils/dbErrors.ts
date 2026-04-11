/**
 * Helpers para erros de banco (PostgreSQL)
 * Usado para retornar respostas amigáveis quando tabelas/views não existem
 * e para distinguir erros de validação (400) de erros de banco/procedure (500)
 */

/** Código PostgreSQL para "undefined_table" (tabela/relação não existe) */
const PG_UNDEFINED_TABLE = '42P01';

export function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const code = error.code || (error as any).errno;
  const message = String(error.message || '').toLowerCase();
  return code === PG_UNDEFINED_TABLE || message.includes('does not exist') || message.includes('relation ');
}

/**
 * Indica se o erro é do PostgreSQL/banco (constraint, procedure, etc.).
 * Usado para devolver 500 em vez de 400 em falhas de procedure/constraint.
 */
export function isDatabaseError(error: any): boolean {
  if (!error) return false;
  const code = error.code ?? (error as any).errno;
  if (code != null && typeof code === 'string' && /^[0-9A-Z]{2,5}$/.test(code)) return true;
  const msg = String(error.message || '').toLowerCase();
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
