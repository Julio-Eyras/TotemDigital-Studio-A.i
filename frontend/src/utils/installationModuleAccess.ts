/**
 * Mapa path UI → módulo de instalação (Fase B).
 * Paths sem entrada = núcleo / sempre permitido (sujeito a role).
 */
import type { InstallationModuleId } from '../types/installationCapabilities';
import { getInstallationCapabilities } from '../config/installationCapabilities';

const PATH_MODULE_RULES: Array<{ prefix: string; module: InstallationModuleId }> = [
  { prefix: '/settings/system-modules', module: 'organization' }, // sempre “on” via núcleo; gate por role
  { prefix: '/campaigns', module: 'campaigns' },
  { prefix: '/playlists', module: 'playlists_advanced' },
  { prefix: '/smart-playlist', module: 'playlists_advanced' },
  { prefix: '/playlist-mix', module: 'dispatcher_admin' },
  { prefix: '/quick-publish', module: 'subscribers' },
  { prefix: '/menu-catalog', module: 'subscribers' },
  { prefix: '/publish-board', module: 'subscribers' },
  { prefix: '/publish-templates-admin', module: 'quick_publish' },
  { prefix: '/subscribers', module: 'subscribers' },
  { prefix: '/subscriber-publisher-access', module: 'subscribers' },
  { prefix: '/subscriber-contracts', module: 'contracts' },
  { prefix: '/publisher-contracts', module: 'contracts' },
  { prefix: '/contracts', module: 'contracts' },
  { prefix: '/billing', module: 'billing' },
  { prefix: '/plan-publisher-access', module: 'plans' },
  { prefix: '/plans', module: 'plans' },
  { prefix: '/reports', module: 'commercial_reports' },
  { prefix: '/analytics', module: 'analytics' },
  { prefix: '/smart-tvs', module: 'devices' },
  { prefix: '/players', module: 'devices' },
  { prefix: '/ota-updates', module: 'ota' },
  { prefix: '/smartdisplayfx', module: 'smart_display_fx' },
  { prefix: '/admin-tools', module: 'dispatcher_admin' },
  { prefix: '/dispatcher-manager', module: 'dispatcher_admin' },
  { prefix: '/dispatcher-monitor', module: 'dispatcher_admin' },
  { prefix: '/dispatcher-debug', module: 'dispatcher_admin' },
];

/** Paths do núcleo (não dependem de módulo complementar). */
const CORE_PREFIXES = [
  '/publish-totem',
  '/media',
  '/publishers',
  '/locals',
  '/totems',
  '/users',
  '/settings',
  '/dashboard',
  '/tags',
  '/qr-codes',
];

export function resolveModuleForPath(path: string): InstallationModuleId | null {
  const p = (path || '').split('?')[0] || '/';

  // Complementos: geridos por role, não por módulo comercial
  if (p === '/settings/system-modules' || p.startsWith('/settings/system-modules/')) {
    return null;
  }

  // Regras específicas primeiro (maior prefixo)
  const sorted = [...PATH_MODULE_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of sorted) {
    if (p === rule.prefix || p.startsWith(rule.prefix + '/')) {
      return rule.module;
    }
  }

  for (const core of CORE_PREFIXES) {
    if (p === core || p.startsWith(core + '/')) {
      return null;
    }
  }

  return null;
}

export function isPathAllowedByInstallationModules(path: string): boolean {
  const moduleId = resolveModuleForPath(path);
  if (!moduleId) return true;
  const caps = getInstallationCapabilities();
  if (!caps?.modules) return true;
  // Núcleo locked
  if (moduleId === 'core_publish' || moduleId === 'organization') return true;
  return caps.modules[moduleId] === true;
}

/** True se o módulo de produto está activo nas capabilities actuais. */
export function isInstallationModuleOn(moduleId: InstallationModuleId): boolean {
  if (moduleId === 'core_publish' || moduleId === 'organization') return true;
  const caps = getInstallationCapabilities();
  if (!caps?.modules) return true;
  return caps.modules[moduleId] === true;
}
