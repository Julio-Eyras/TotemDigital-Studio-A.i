/**
 * Chaves em system_settings para limites padrão (assinante/plano).
 * Valor numérico 0 = ilimitado (sem teto) no runtime.
 */
export const LIMITS_DEFAULT_SETTING_KEYS = {
  storage_gb: 'limits.defaults.storage_gb',
  campaigns: 'limits.defaults.campaigns',
  totems: 'limits.defaults.totems',
  medias: 'limits.defaults.medias',
  playlists: 'limits.defaults.playlists',
} as const;
