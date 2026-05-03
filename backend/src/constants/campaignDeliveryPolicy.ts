/**
 * Política de entrega de campanhas ao totem (indoor / DOOH).
 * Centraliza fragmentos SQL e textos para alinhar dispatcher, mix e UI.
 */

/** Condição SQL: cadastro do totem ativo no painel (`totems.is_active`). */
export function sqlTotemRegistryActive(alias: string): string {
  return `COALESCE(${alias}.is_active, true) = true`;
}

/** Mensagem curta para operadores quando a forma 2 (campaign_totems) está desligada no servidor. */
export const DIRECT_CAMPAIGN_TOTEM_DISABLED_HINT =
  'Neste servidor a associação direta campanha → totens (aba Totens) está desligada. ' +
  'A entrega segue contrato/plano e publicadores (locais); confira plano, campaign_publishers e totens ativos no cadastro.';
