/**
 * Helpers para erros de banco (PostgreSQL)
 * Usado para retornar respostas amigáveis quando tabelas/views não existem
 */

/** Código PostgreSQL para "undefined_table" (tabela/relação não existe) */
const PG_UNDEFINED_TABLE = '42P01';

export function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const code = error.code || (error as any).errno;
  const message = String(error.message || '').toLowerCase();
  return code === PG_UNDEFINED_TABLE || message.includes('does not exist') || message.includes('relation ');
}
