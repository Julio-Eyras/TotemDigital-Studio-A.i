/**
 * Modo Publicar em Totem — branch SmartSignage-direc-totem.
 * UI simplificada: totens + mídias por totem, uma organização.
 */
export function isDirectTotemMode(): boolean {
  return process.env.DIRECT_TOTEM_MODE !== 'false';
}
