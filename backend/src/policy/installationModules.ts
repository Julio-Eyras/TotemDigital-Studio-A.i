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
  if (!overrides || typeof overrides !== 'object') return enforceLockedModules(merged);

  for (const id of INSTALLATION_MODULE_IDS) {
    if (typeof overrides[id] === 'boolean') {
      merged[id] = overrides[id] as boolean;
    }
  }
  return enforceLockedModules(merged);
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
