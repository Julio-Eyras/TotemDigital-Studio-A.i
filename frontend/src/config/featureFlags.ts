const parseBoolean = (value?: string): boolean =>
  typeof value === 'string' && value.toLowerCase() === 'true';

/**
 * Modo compacto do TotemDigital (frontend).
 * Use REACT_APP_TOTEMDIGITAL_COMPACT=true para ativar.
 */
export const TOTEMDIGITAL_COMPACT = parseBoolean(
  process.env.REACT_APP_TOTEMDIGITAL_COMPACT
);

