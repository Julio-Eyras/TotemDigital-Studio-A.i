import { getInstallationCapabilities } from './installationCapabilities';

/** Rótulos de produto em PT — fonte única (Pro + Studio unificados). */
export interface ProductTerminology {
  organization: string;
  organizationPlural: string;
  yourOrganization: string;
  units: string;
  devices: string;
  totems: string;
  smartTvs: string;
  organizationContracts: string;
  billingPublisherTab: string;
  billingPublisherLabel: string;
  subscriberToOrgAccess: string;
  plansForOrganization: string;
  maintainPlansAndOrganizations: string;
  organizationContractMaintenance: string;
  campaignOrganizationsTab: string;
  networkTopology: string;
  totemPlaylists: string;
}

const MULTI_LABELS: ProductTerminology = {
  organization: 'Organização',
  organizationPlural: 'Organizações',
  yourOrganization: 'Sua organização',
  units: 'Unidades (Locais)',
  devices: 'Dispositivos',
  totems: 'Totens',
  smartTvs: 'Smart TVs',
  organizationContracts: 'Contratos da organização',
  billingPublisherTab: 'Organizações',
  billingPublisherLabel: 'Organização',
  subscriberToOrgAccess: 'Acessos (Anunciante → Organização)',
  plansForOrganization: 'Planos da organização',
  maintainPlansAndOrganizations: 'Manter planos e organizações',
  organizationContractMaintenance: 'Contratos da organização',
  campaignOrganizationsTab: 'Organizações',
  networkTopology: 'Rede visual',
  totemPlaylists: 'Playlists por totem',
};

const SINGLE_LABELS: ProductTerminology = {
  ...MULTI_LABELS,
  organizationPlural: 'Sua organização',
  billingPublisherTab: 'Organização',
  maintainPlansAndOrganizations: 'Planos & acessos',
  organizationContractMaintenance: 'Contratos da organização',
};

/** Instalação mono: uma organização implícita (Studio / single_publisher). */
export function isSingleOrganizationProfile(): boolean {
  const caps = getInstallationCapabilities();
  return caps.profile === 'single_publisher' || caps.totemDigitalCompact;
}

export function getProductTerminology(): ProductTerminology {
  return isSingleOrganizationProfile() ? SINGLE_LABELS : MULTI_LABELS;
}

/** Título da página /publishers conforme perfil. */
export function getPublishersPageTitle(): string {
  const t = getProductTerminology();
  return isSingleOrganizationProfile() ? t.yourOrganization : t.organizationPlural;
}
