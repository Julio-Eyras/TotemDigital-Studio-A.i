/**
 * Modo Direct Totem — fonte de verdade: installation.modules / capabilities.
 * Env DIRECT_TOTEM_MODE só como fallback de boot (antes do cache aquecer).
 */
let capabilitiesOverride: boolean | undefined;

/** Actualizado por `resolveInstallationCapabilities` / reset de cache. */
export function setDirectTotemModeFromCapabilities(value: boolean | undefined): void {
  capabilitiesOverride = value;
}

export function isDirectTotemMode(): boolean {
  if (typeof capabilitiesOverride === 'boolean') {
    return capabilitiesOverride;
  }
  return process.env.DIRECT_TOTEM_MODE !== 'false';
}
