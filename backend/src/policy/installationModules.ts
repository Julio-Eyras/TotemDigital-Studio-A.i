/**
 * Catálogo de módulos de produto (instalação) — distinto de flag_smart_* (permissão por utilizador).
 * Fase A: persistência + UI admin; Fase B: gates de menu/API.
 */

export type InstallationModuleId =
  | 'core_publish'
  | 'organization'
  | 'multi_agency'
  | 'subscribers'
  | 'campaigns'
  | 'playlists_advanced'
  | 'quick_publish'
  | 'contracts'
  | 'billing'
  | 'plans'
  | 'commercial_reports'
  | 'devices'
  | 'ota'
  | 'dispatcher_admin'
  | 'smart_display_fx'
  | 'analytics'
  | 'subscriber_portal'
  | 'direct_totem_mode'
  | 'simple_totem_mode';

export type InstallationModuleFlags = Record<InstallationModuleId, boolean>;

export type InstallationModuleDefinition = {
  id: InstallationModuleId;
  title: string;
  description: string;
  /** Não pode ser desligado na UI (núcleo). */
  locked?: boolean;
  /** Módulos que devem estar ativos para ligar este. */
  requires?: InstallationModuleId[];
  /** Grupo visual no painel. */
  group: 'core' | 'content' | 'commercial' | 'ops' | 'ux';
};

export const INSTALLATION_MODULE_CATALOG: InstallationModuleDefinition[] = [
  {
    id: 'core_publish',
    title: 'Publicar em Totem (núcleo)',
    description: 'Biblioteca de mídias e publicação direta em totens.',
    locked: true,
    group: 'core',
  },
  {
    id: 'organization',
    title: 'Organização, locais e totens',
    description: 'Gestão da organização, locais e ecrãs.',
    locked: true,
    group: 'core',
  },
  {
    id: 'direct_totem_mode',
    title: 'Modo Direct Totem (UI mínima)',
    description: 'Menu focado em Publicar em Totem, mídias, organização, utilizadores e definições.',
    group: 'ux',
  },
  {
    id: 'simple_totem_mode',
    title: 'Modo totem simples',
    description: 'Simplifica operação (ex.: esconde campanhas avançadas no menu).',
    group: 'ux',
  },
  {
    id: 'multi_agency',
    title: 'Multi-agência (várias organizações)',
    description: 'Várias organizações (publishers) na mesma instalação.',
    group: 'commercial',
  },
  {
    id: 'subscribers',
    title: 'Anunciantes',
    description: 'Gestão de anunciantes (subscribers) e vínculos com organizações.',
    group: 'commercial',
  },
  {
    id: 'subscriber_portal',
    title: 'Portal do anunciante + subdomínios',
    description: 'Portal self-service e tenancy por subdomínio.',
    requires: ['subscribers', 'multi_agency'],
    group: 'commercial',
  },
  {
    id: 'campaigns',
    title: 'Campanhas',
    description: 'Campanhas de publicidade e elegibilidade por totem.',
    group: 'content',
  },
  {
    id: 'playlists_advanced',
    title: 'Playlists avançadas / mix',
    description: 'Playlists compostas e mix de conteúdo.',
    group: 'content',
  },
  {
    id: 'quick_publish',
    title: 'Quick-publish / cardápio',
    description: 'Publicação rápida, templates e cardápio.',
    group: 'content',
  },
  {
    id: 'contracts',
    title: 'Contratos',
    description: 'Contratos de organizações e anunciantes.',
    requires: ['subscribers'],
    group: 'commercial',
  },
  {
    id: 'plans',
    title: 'Planos e acessos',
    description: 'Planos comerciais e restrições por local/totem.',
    group: 'commercial',
  },
  {
    id: 'billing',
    title: 'Financeiro / faturamento',
    description: 'Faturas, cobranças e integração de billing.',
    requires: ['plans'],
    group: 'commercial',
  },
  {
    id: 'commercial_reports',
    title: 'Relatórios comerciais',
    description: 'Relatórios e visão comercial avançada.',
    requires: ['billing'],
    group: 'commercial',
  },
  {
    id: 'devices',
    title: 'Smart TVs e players',
    description: 'Gestão técnica de Smart TVs e players.',
    group: 'ops',
  },
  {
    id: 'ota',
    title: 'Atualizações OTA',
    description: 'Atualização remota de dispositivos.',
    requires: ['devices'],
    group: 'ops',
  },
  {
    id: 'dispatcher_admin',
    title: 'Dispatcher e ferramentas admin',
    description: 'Monitorização do dispatcher, mix e Admin Tools.',
    group: 'ops',
  },
  {
    id: 'smart_display_fx',
    title: 'SmartDisplayFX',
    description: 'Efeitos e regras visuais avançadas.',
    group: 'ops',
  },
  {
    id: 'analytics',
    title: 'Analytics / IA / smart playlist',
    description: 'Analytics, sugestões e playlists inteligentes.',
    group: 'ops',
  },
];

export const INSTALLATION_MODULE_IDS: InstallationModuleId[] =
  INSTALLATION_MODULE_CATALOG.map((m) => m.id);

export function emptyModuleFlags(value = false): InstallationModuleFlags {
  return INSTALLATION_MODULE_IDS.reduce((acc, id) => {
    acc[id] = value;
    return acc;
  }, {} as InstallationModuleFlags);
}

/** Defaults alinhados ao perfil/capabilities actuais (Fase A). */
export function buildDefaultInstallationModules(input: {
  multiAgency: boolean;
  directTotemMode: boolean;
  simpleTotemMode: boolean;
  smartDisplayFx: boolean;
  subscriberPortal: boolean;
}): InstallationModuleFlags {
  const dt = input.directTotemMode;
  return {
    core_publish: true,
    organization: true,
    direct_totem_mode: dt,
    simple_totem_mode: input.simpleTotemMode,
    multi_agency: input.multiAgency,
    subscribers: !dt,
    subscriber_portal: input.subscriberPortal,
    campaigns: !dt && !input.simpleTotemMode,
    playlists_advanced: !dt,
    quick_publish: !dt,
    contracts: !dt,
    plans: !dt,
    billing: !dt,
    commercial_reports: !dt && input.multiAgency,
    devices: !dt,
    ota: !dt,
    dispatcher_admin: !dt,
    smart_display_fx: input.smartDisplayFx,
    analytics: !dt,
  };
}

export function mergeInstallationModules(
  defaults: InstallationModuleFlags,
  overrides: Partial<Record<string, boolean>> | null | undefined
): InstallationModuleFlags {
  const merged = { ...defaults };
  if (!overrides || typeof overrides !== 'object') {
    return healStaleMultiAgencyLiteModules(enforceLockedModules(merged));
  }

  for (const id of INSTALLATION_MODULE_IDS) {
    if (typeof overrides[id] === 'boolean') {
      merged[id] = overrides[id] as boolean;
    }
  }
  return healStaleMultiAgencyLiteModules(enforceLockedModules(merged));
}

/**
 * Lite antigo (antes da correção de produto) gravava `subscribers: false`.
 * Lite correcto exige anunciantes + publicar/campanhas/devices.
 * Reaplica o preset lite sem promover a Pro.
 */
export function healStaleMultiAgencyLiteModules(
  modules: InstallationModuleFlags
): InstallationModuleFlags {
  if (resolveMultiAgencyMode(modules) !== 'lite') {
    return modules;
  }
  if (
    modules.subscribers === true &&
    modules.quick_publish === true &&
    modules.campaigns === true &&
    modules.devices === true
  ) {
    return modules;
  }
  return buildMultiAgencyLitePreset({
    subscriber_portal: modules.subscriber_portal === true,
    smart_display_fx: modules.smart_display_fx === true,
  });
}

export function enforceLockedModules(flags: InstallationModuleFlags): InstallationModuleFlags {
  const next = { ...flags };
  for (const def of INSTALLATION_MODULE_CATALOG) {
    if (def.locked) next[def.id] = true;
  }
  return next;
}

/**
 * Valida dependências: se um módulo está on, todos os `requires` devem estar on.
 * Retorna lista de erros em português.
 */
export function validateInstallationModuleDependencies(
  flags: InstallationModuleFlags
): string[] {
  const errors: string[] = [];
  for (const def of INSTALLATION_MODULE_CATALOG) {
    if (!flags[def.id] || !def.requires?.length) continue;
    for (const req of def.requires) {
      if (!flags[req]) {
        const reqTitle = INSTALLATION_MODULE_CATALOG.find((m) => m.id === req)?.title || req;
        errors.push(`«${def.title}» requer «${reqTitle}» activo.`);
      }
    }
  }
  return errors;
}

export function isInstallationModuleEnabled(
  flags: InstallationModuleFlags | undefined,
  moduleId: InstallationModuleId
): boolean {
  if (!flags) return false;
  return flags[moduleId] === true;
}

/** Módulos ligados automaticamente pelo master switch multi-agência (sem portal/FX). */
export const MULTI_AGENCY_PRESET_MODULE_IDS: InstallationModuleId[] = [
  'multi_agency',
  'subscribers',
  'campaigns',
  'playlists_advanced',
  'quick_publish',
  'contracts',
  'plans',
  'billing',
  'commercial_reports',
  'devices',
  'ota',
  'dispatcher_admin',
  'analytics',
];

/**
 * Preset núcleo (multi-agência OFF): Direct Totem + simple on; comercial off.
 * Dados existentes não são apagados — só ficam inacessíveis na UI/API.
 */
export function buildCoreOperationPreset(): InstallationModuleFlags {
  return enforceLockedModules({
    ...emptyModuleFlags(false),
    core_publish: true,
    organization: true,
    direct_totem_mode: true,
    simple_totem_mode: true,
    multi_agency: false,
    subscriber_portal: false,
    smart_display_fx: false,
  });
}

/**
 * Preset multi-agência ON: Direct Totem off; pacote comercial/ops on.
 * Portal e SmartDisplayFX ficam só se já estavam on (avançado) — não entram no botão.
 */
export function buildMultiAgencyOperationPreset(preserveAdvanced?: {
  subscriber_portal?: boolean;
  smart_display_fx?: boolean;
}): InstallationModuleFlags {
  return enforceLockedModules({
    ...emptyModuleFlags(false),
    core_publish: true,
    organization: true,
    multi_agency: true,
    direct_totem_mode: false,
    simple_totem_mode: false,
    subscribers: true,
    campaigns: true,
    playlists_advanced: true,
    quick_publish: true,
    contracts: true,
    plans: true,
    billing: true,
    commercial_reports: true,
    devices: true,
    ota: true,
    dispatcher_admin: true,
    analytics: true,
    subscriber_portal: preserveAdvanced?.subscriber_portal === true,
    smart_display_fx: preserveAdvanced?.smart_display_fx === true,
  });
}

/**
 * Preset multi-agência lite (D6-B):
 * várias orgs + anunciantes/clientes + publicar/mídias/devices/campanhas leves.
 * Sem billing, planos, contratos, reports, OTA, dispatcher, analytics (isso é Pro).
 * Direct Totem continua OFF (D6-C).
 */
export function buildMultiAgencyLitePreset(preserveAdvanced?: {
  subscriber_portal?: boolean;
  smart_display_fx?: boolean;
}): InstallationModuleFlags {
  return enforceLockedModules({
    ...emptyModuleFlags(false),
    core_publish: true,
    organization: true,
    multi_agency: true,
    direct_totem_mode: false,
    simple_totem_mode: false,
    subscribers: true,
    quick_publish: true,
    campaigns: true,
    devices: true,
    playlists_advanced: false,
    contracts: false,
    plans: false,
    billing: false,
    commercial_reports: false,
    ota: false,
    dispatcher_admin: false,
    analytics: false,
    subscriber_portal: preserveAdvanced?.subscriber_portal === true,
    smart_display_fx: preserveAdvanced?.smart_display_fx === true,
  });
}

export type MultiAgencyMode = 'off' | 'lite' | 'full';

export function applyMultiAgencyMasterSwitch(
  enabled: boolean,
  current?: InstallationModuleFlags | null
): InstallationModuleFlags {
  return applyMultiAgencyMode(enabled ? 'full' : 'off', current);
}

export function applyMultiAgencyMode(
  mode: MultiAgencyMode,
  current?: InstallationModuleFlags | null
): InstallationModuleFlags {
  if (mode === 'full') {
    return buildMultiAgencyOperationPreset({
      subscriber_portal: current?.subscriber_portal === true,
      smart_display_fx: current?.smart_display_fx === true,
    });
  }
  if (mode === 'lite') {
    return buildMultiAgencyLitePreset({
      subscriber_portal: current?.subscriber_portal === true,
      smart_display_fx: current?.smart_display_fx === true,
    });
  }
  return buildCoreOperationPreset();
}

/** Infere off | lite | full a partir das flags actuais.
 * Pro = stack administrativa/ERP (billing, planos, contratos, reports…).
 * Lite = multi-agência com anunciantes/publicação, sem esse ERP.
 */
export function resolveMultiAgencyMode(modules: InstallationModuleFlags): MultiAgencyMode {
  if (!modules.multi_agency) return 'off';
  const isPro =
    modules.billing === true ||
    modules.plans === true ||
    modules.contracts === true ||
    modules.commercial_reports === true ||
    modules.ota === true ||
    modules.dispatcher_admin === true ||
    modules.analytics === true ||
    modules.playlists_advanced === true;
  return isPro ? 'full' : 'lite';
}

/**
 * Lite (sem módulo plans): o vínculo anunciante→org/totem é via
 * `subscriber_publisher_access` directo (access_type override), não via plano/contrato.
 * Pro continua a usar planos; SPA directo também é aceite como caminho paralelo.
 */
export function usesDirectSubscriberOrgAccess(modules: InstallationModuleFlags): boolean {
  return modules.multi_agency === true && modules.plans !== true;
}
