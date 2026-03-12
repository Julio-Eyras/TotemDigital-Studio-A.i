/**
 * Feature flags - opções de comportamento.
 *
 * Forma 2 (vínculo direto Campanha ↔ Totem via campaign_totems):
 * A aba "Totens" restringe a campanha a totens específicos entre os dos publicadores selecionados.
 * Quando false (padrão), a forma 2 está ativa: campaign_totems é considerado; destino final = totens dos
 * publicadores (aba Publicadores), opcionalmente restritos aos totens marcados na aba Totens.
 * Para desabilitar a forma 2: DISABLE_DIRECT_CAMPAIGN_TOTEM=true no .env.
 */
export const DISABLE_DIRECT_CAMPAIGN_TOTEM =
  process.env.DISABLE_DIRECT_CAMPAIGN_TOTEM === 'true'; // default: false (form 2 enabled)
