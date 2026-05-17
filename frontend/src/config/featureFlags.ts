const parseBoolean = (value?: string): boolean =>
  typeof value === 'string' && value.toLowerCase() === 'true';

/**
 * Modo compacto do TotemDigital (frontend).
 * Use REACT_APP_TOTEMDIGITAL_COMPACT=true para ativar.
 * O dono (`owner_system` / admins) deve ver a mesma navegação Pro que o backend expõe em paridade compacta.
 */
export const TOTEMDIGITAL_COMPACT = parseBoolean(
  process.env.REACT_APP_TOTEMDIGITAL_COMPACT
);

export { isStudioMode, isMultiAgencyMode } from './studioMode';

/**
 * Dashboard com foco comercial (menos blocos técnicos na primeira vista).
 * No modo Pro, ative com REACT_APP_DASHBOARD_COMMERCIAL_FOCUS=true.
 * O modo compacto já usa este layout por defeito.
 */
export const DASHBOARD_COMMERCIAL_FOCUS = parseBoolean(
  process.env.REACT_APP_DASHBOARD_COMMERCIAL_FOCUS
);

/** Alinhar com `DISABLE_DIRECT_CAMPAIGN_TOTEM` no backend (.env); usado se a API ui-context falhar. */
export const DISABLE_DIRECT_CAMPAIGN_TOTEM = parseBoolean(
  process.env.REACT_APP_DISABLE_DIRECT_CAMPAIGN_TOTEM
);

/** Nome exibido no cabeçalho, login e separador do browser (build compacto vs Pro). */
export const APP_DISPLAY_NAME = TOTEMDIGITAL_COMPACT
  ? 'Smart Signage Studio'
  : 'Smart Signage Pro';

/**
 * SmartDisplayFX — fallback de build; preferir `useInstallationCapabilities().smartDisplayFx`
 * após o provider carregar `/api/dashboard/ui-context`.
 */
/** Fallback de build; após ui-context usar capabilities.smartDisplayFx */
export const SMARTDISPLAYFX_ENABLED = !TOTEMDIGITAL_COMPACT;

