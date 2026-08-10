import { isStudioMode } from '../config/studioMode';
import { isPathAllowedByInstallationModules } from './installationModuleAccess';
/**
 * Role Permissions Utility
 * Define quais recursos cada role pode acessar
 */


export type UserRole = 
  | 'owner_system' 
  | 'admin_sql' 
  | 'admin' 
  | 'operador_tecnico' 
  | 'operador_faturamento' 
  | 'operador_comercial' 
  | 'operator' 
  | 'gerente_marketing' 
  | 'editoracao' 
  | 'visualizador' 
  | 'client'
  | 'publisher_user'
  | 'subscriber_user'
  ;

export interface UserFlags {
  flag_smart_0: boolean;
  flag_smart_1: boolean;
  flag_smart_2: boolean;
  flag_smart_3: boolean;
  flag_smart_4: boolean;
  flag_smart_5: boolean;
  flag_smart_6: boolean;
  flag_smart_7: boolean;
  flag_smart_8: boolean;
  flag_smart_9: boolean;
}

export interface MenuItemPermission {
  path: string;
  roles: UserRole[];
  requiresClientAccess?: boolean; // Se true, só pode acessar dados do próprio cliente
  requiredFlag?: `flag_smart_${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`; // Flag necessária para acessar
}

/**
 * Mapeamento de rotas e roles permitidas
 */
export const menuPermissions: MenuItemPermission[] = [
  // Dashboard - Todos exceto client
  { path: '/dashboard', roles: ['owner_system', 'admin_sql', 'operator', 'admin', 'operador_tecnico', 'operador_faturamento', 'operador_comercial', 'gerente_marketing', 'editoracao', 'visualizador', 'publisher_user', 'subscriber_user'] },

  { path: '/publish-totem', roles: ['owner_system', 'admin_sql', 'operator', 'admin', 'operador_tecnico', 'gerente_marketing', 'visualizador', 'publisher_user'] },
  
  // Mídia - Todos exceto operator e client
  { path: '/media', roles: ['admin_sql', 'admin', 'gerente_marketing', 'editoracao', 'visualizador', 'owner_system', 'operador_tecnico', 'publisher_user'], requiresClientAccess: true },
  { path: '/vinhetas', roles: ['admin_sql', 'admin', 'gerente_marketing', 'editoracao', 'visualizador'], requiresClientAccess: true },
  { path: '/quick-publish', roles: ['admin_sql', 'admin', 'gerente_marketing', 'editoracao', 'subscriber_user'], requiresClientAccess: true },
  { path: '/menu-catalog', roles: ['admin_sql', 'admin', 'gerente_marketing', 'editoracao', 'subscriber_user'], requiresClientAccess: true },
  { path: '/publish-board', roles: ['admin_sql', 'admin', 'gerente_marketing', 'editoracao', 'subscriber_user'], requiresClientAccess: true },
  { path: '/publish-templates-admin', roles: ['owner_system', 'admin_sql', 'admin'], requiredFlag: 'flag_smart_1' },
  
  // Playlists - Todos exceto operator, editoracao e client
  { path: '/playlists', roles: ['admin_sql', 'admin', 'gerente_marketing', 'visualizador'], requiresClientAccess: true },
  
  // Smart Playlist - admin_sql, admin, gerente_marketing
  { path: '/smart-playlist', roles: ['admin_sql', 'admin', 'gerente_marketing'], requiresClientAccess: true },
  
  // Campanhas - Todos exceto operator, editoracao e client
  { path: '/campaigns', roles: ['admin_sql', 'admin', 'gerente_marketing', 'visualizador'], requiresClientAccess: true },
  
  // Players - admin_sql, operator, admin, operador_tecnico
  { path: '/players', roles: ['owner_system', 'admin_sql', 'operator', 'admin', 'operador_tecnico'], requiredFlag: 'flag_smart_0' },
  
  // Totems - Todos exceto editoracao (operator só vê dados técnicos)
  { path: '/totems', roles: ['owner_system', 'admin_sql', 'operator', 'admin', 'operador_tecnico', 'gerente_marketing', 'visualizador'], requiredFlag: 'flag_smart_0' },
  
  // Smart TVs - Hierárquico: Totens → Smart TVs
  { path: '/smart-tvs', roles: ['owner_system', 'admin_sql', 'operator', 'admin', 'operador_tecnico', 'gerente_marketing', 'visualizador', 'publisher_user'], requiredFlag: 'flag_smart_0' },
  
  // Locais — organizações e admins
  { path: '/locals', roles: ['owner_system', 'admin_sql', 'admin', 'publisher_user'] },
  
  // Usuários - admin_sql, admin (próprio cliente)
  { path: '/users', roles: ['owner_system', 'admin_sql', 'admin'] },
  
  // Organizações — admin_sql, admin, operador_comercial (visualização)
  { path: '/publishers', roles: ['owner_system', 'admin_sql', 'admin', 'operador_comercial'] },
  
  // Subscribers - admin_sql, admin, operador_comercial; gerente_marketing edita campanhas no contexto do anunciante
  { path: '/subscribers', roles: ['owner_system', 'admin_sql', 'admin', 'operador_comercial', 'gerente_marketing'] },
  
  // Analytics - Todos exceto operator, editoracao e client
  { path: '/analytics', roles: ['admin_sql', 'admin', 'gerente_marketing', 'visualizador'], requiresClientAccess: true },
  
  // Relatórios - Todos exceto operator, editoracao e client
  { path: '/reports', roles: ['admin_sql', 'admin', 'gerente_marketing', 'visualizador'], requiresClientAccess: true },
  
  // QR Codes - admin_sql, admin, gerente_marketing
  { path: '/qr-codes', roles: ['admin_sql', 'admin', 'gerente_marketing'], requiresClientAccess: true },
  
  // Faturamento — organização vê faturas próprias (API filtra por publisher_id)
  { path: '/billing', roles: ['owner_system', 'admin_sql', 'admin', 'operador_faturamento', 'publisher_user', 'subscriber_user'], requiresClientAccess: true, requiredFlag: 'flag_smart_3' },
  
  // IA - admin_sql, admin, gerente_marketing
  { path: '/ai', roles: ['admin_sql', 'admin', 'gerente_marketing'], requiresClientAccess: true },
  
  // Admin Tools - admin_sql, operator, operador_tecnico
  { path: '/admin-tools', roles: ['owner_system', 'admin_sql', 'admin', 'operator', 'operador_tecnico'], requiredFlag: 'flag_smart_2' },
  
  // Rede Visual — topologia organizações + anunciantes + grafo (API: publishers/subscribers)
  { path: '/network-topology', roles: ['owner_system', 'admin_sql', 'admin', 'operador_tecnico', 'operator', 'publisher_user', 'subscriber_user'] },
  
  // Dispatcher-Totem - owner_system, admin_sql, admin, operador_tecnico
  { path: '/dispatcher-manager', roles: ['owner_system', 'admin_sql', 'operator', 'admin', 'operador_tecnico'], requiredFlag: 'flag_smart_2' },
  { path: '/dispatcher-monitor', roles: ['owner_system', 'admin_sql', 'operator', 'admin', 'operador_tecnico'], requiredFlag: 'flag_smart_2' },
  { path: '/dispatcher-debug', roles: ['owner_system', 'admin_sql', 'operator', 'admin', 'operador_tecnico'], requiredFlag: 'flag_smart_2' },
  /** Playlist Mix — resultado final por totem (debug junto ao dispatcher) */
  { path: '/playlist-mix', roles: ['owner_system', 'admin_sql', 'operator', 'admin', 'operador_tecnico'], requiredFlag: 'flag_smart_2' },
  
  // OTA Updates - admin_sql, operator, operador_tecnico
  { path: '/ota-updates', roles: ['owner_system', 'admin_sql', 'admin'], requiredFlag: 'flag_smart_1' },
  
  // Tags - admin_sql, admin, gerente_marketing, editoracao
  { path: '/tags', roles: ['admin_sql', 'admin', 'gerente_marketing', 'editoracao'], requiresClientAccess: true },
  
  // SmartDisplayFX - Todos exceto editoracao (operator só vê logs/config)
  { path: '/smartdisplayfx', roles: ['admin_sql', 'operator', 'admin', 'gerente_marketing', 'visualizador'] },
  
  // Configurações - disponível para perfis de operação do produto
  { path: '/settings', roles: ['owner_system', 'admin_sql', 'operator', 'admin', 'publisher_user', 'subscriber_user'] },
  { path: '/settings/system-modules', roles: ['owner_system', 'admin_sql'] },
  
  // Planos → organizações — admin_sql, admin
  { path: '/plan-publisher-access', roles: ['admin_sql', 'admin'] },
  
  // Anunciante → organização — admin_sql, admin
  { path: '/subscriber-publisher-access', roles: ['owner_system', 'admin_sql', 'admin'] },
  
  // Rotas de subitens (herdam permissões do path pai) — só paths com UI real
  { path: '/users/new', roles: ['owner_system', 'admin_sql', 'admin'] },
  { path: '/smart-tvs/by-totem', roles: ['owner_system', 'admin_sql', 'admin', 'operador_tecnico', 'publisher_user'], requiredFlag: 'flag_smart_0' },
  { path: '/smart-tvs/config', roles: ['owner_system', 'admin_sql', 'admin', 'operador_tecnico'], requiredFlag: 'flag_smart_0' },
  { path: '/players/status', roles: ['owner_system', 'admin_sql', 'admin', 'operador_tecnico'], requiredFlag: 'flag_smart_0' },
  { path: '/ota-updates/history', roles: ['owner_system', 'admin_sql', 'admin'], requiredFlag: 'flag_smart_1' },
  { path: '/subscriber-publisher-access/new', roles: ['admin_sql', 'admin'] },
  { path: '/plan-publisher-access/config', roles: ['admin_sql', 'admin'] },
  { path: '/subscribers/details', roles: ['owner_system', 'admin_sql', 'admin', 'operador_comercial'] },
  { path: '/plans', roles: ['admin_sql', 'admin'] },
];

/**
 * Verifica se uma role pode acessar um recurso
 * @param userRole - Role do usuário
 * @param path - Caminho da rota
 * @param userFlags - Flags do usuário (opcional)
 */
export function canAccess(
  userRole: UserRole | string, 
  path: string,
  userFlags?: UserFlags | Record<string, boolean> | null
): boolean {
  const pathForPermission = (path || '').split('?')[0] || '/';

  // Módulo de produto (instalação) — aplica a todos, incluindo owner
  if (!isPathAllowedByInstallationModules(pathForPermission)) {
    return false;
  }

  // Owner system sempre tem acesso (exceto se explicitamente negado)
  if (userRole === 'owner_system') {
    return true;
  }

  // Modo compacto: operador de faturamento usa o menu administrativo completo (paridade com dono na navegação)
  if (isStudioMode() && userRole === 'operador_faturamento') {
    return true;
  }

  // Modo compacto mono: a organização dona acede ao dispatcher/monitorização sem depender de flag_smart_2
  if (isStudioMode() && userRole === 'publisher_user') {
    if (
      pathForPermission === '/dispatcher-manager' ||
      pathForPermission === '/dispatcher-monitor' ||
      pathForPermission === '/dispatcher-debug' ||
      pathForPermission.startsWith('/dispatcher-manager')
    ) {
      return true;
    }
    if (pathForPermission === '/playlist-mix' || pathForPermission.startsWith('/playlist-mix/')) {
      return true;
    }
    if (pathForPermission === '/billing' || pathForPermission.startsWith('/billing/')) {
      return true;
    }
  }

  // Buscar permissão exata
  let permission = menuPermissions.find(p => p.path === pathForPermission);
  
  // Se não encontrar permissão exata, tentar encontrar path pai
  if (!permission) {
    // Ordenar por tamanho do path (maior primeiro) para pegar o path pai mais específico
    const sortedPermissions = [...menuPermissions].sort((a, b) => b.path.length - a.path.length);
    permission = sortedPermissions.find(p => pathForPermission.startsWith(p.path + '/'));
  }

  if (!permission) {
    // Se não encontrar permissão, permitir por padrão (compatibilidade)
    return true;
  }
  
  // Verificar role
  const hasRole = permission.roles.includes(userRole as UserRole);
  if (!hasRole) {
    return false;
  }
  
  // Verificar flag se necessário
  // Para roles administrativas (owner_system, admin_sql, admin), não bloquear por flag
  const isAdminRole = userRole === 'owner_system' || userRole === 'admin_sql' || userRole === 'admin';
  if (permission.requiredFlag && userFlags && !isAdminRole) {
    // Converter UserFlags para Record<string, boolean> se necessário
    const flagsRecord = userFlags as Record<string, boolean>;
    const flagValue = flagsRecord[permission.requiredFlag];
    // Se flag não estiver definida ou for false, negar acesso (apenas para não-admin)
    if (flagValue !== true) {
      return false;
    }
  }
  
  return true;
}

/**
 * Filtra itens do menu baseado na role do usuário
 */
export function filterMenuItemsByRole(
  menuItems: Array<{ path: string; [key: string]: any }>,
  userRole: UserRole | string
): Array<{ path: string; [key: string]: any }> {
  return menuItems.filter(item => canAccess(userRole, item.path));
}

/**
 * Verifica se usuário requer acesso apenas ao próprio cliente
 */
export function requiresClientAccess(path: string): boolean {
  const permission = menuPermissions.find(p => p.path === path);
  return permission?.requiresClientAccess || false;
}

