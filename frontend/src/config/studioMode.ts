import { TOTEMDIGITAL_COMPACT } from './featureFlags';
import { getInstallationCapabilities } from './installationCapabilities';

/**
 * Modo Studio / single_publisher (instalação única).
 * Capabilities da API têm prioridade sobre o flag de build: um front
 * compilado com REACT_APP_TOTEMDIGITAL_COMPACT=true em instalação
 * Multi-Agência (Lite/Pro) NÃO deve omitir publisher_id nem esconder selects.
 */
export function isStudioMode(): boolean {
  const caps = getInstallationCapabilities();
  // Direct Totem = instalação única (mesmo se o build for Studio compacto).
  if (caps.directTotemMode) {
    return true;
  }
  if (caps.multiAgency || caps.profile === 'multi_agency') {
    return false;
  }
  if (caps.totemDigitalCompact || caps.profile === 'single_publisher') {
    return true;
  }
  // Fallback de boot (antes do ui-context / defaults)
  return TOTEMDIGITAL_COMPACT;
}

export function isMultiAgencyMode(): boolean {
  return getInstallationCapabilities().multiAgency && !isStudioMode();
}
