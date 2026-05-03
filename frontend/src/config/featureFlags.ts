const parseBoolean = (value?: string): boolean =>
  typeof value === 'string' && value.toLowerCase() === 'true';

/**
 * Modo compacto do TotemDigital (frontend).
 * Use REACT_APP_TOTEMDIGITAL_COMPACT=true para ativar.
 */
export const TOTEMDIGITAL_COMPACT = parseBoolean(
  process.env.REACT_APP_TOTEMDIGITAL_COMPACT
);

/** Alinhar com `DISABLE_DIRECT_CAMPAIGN_TOTEM` no backend (.env); usado se a API ui-context falhar. */
export const DISABLE_DIRECT_CAMPAIGN_TOTEM = parseBoolean(
  process.env.REACT_APP_DISABLE_DIRECT_CAMPAIGN_TOTEM
);

/** Nome exibido no cabeçalho, login e separador do browser (build compacto vs Pro). */
export const APP_DISPLAY_NAME = TOTEMDIGITAL_COMPACT
  ? 'Smart Signage Compact'
  : 'Smart Signage Pro';

