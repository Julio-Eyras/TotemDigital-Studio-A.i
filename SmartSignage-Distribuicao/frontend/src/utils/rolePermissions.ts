/**
 * Role Permissions Utility
 * Define quais recursos cada role pode acessar
 */

export type UserRole = 'admin_sql' | 'operator' | 'admin' | 'gerente_marketing' | 'editoracao' | 'visualizador' | 'client';

export interface MenuItemPermission {
  path: string;
  roles: UserRole[];
  requiresClientAccess?: boolean; // Se true, só pode acessar dados do próprio cliente
}

/**
 * Mapeamento de rotas e roles permitidas
 */
export const menuPermissions: MenuItemPermission[] = [
  // Dashboard - Todos exceto client
  { path: '/dashboard', roles: ['admin_sql', 'operator', 'admin', 'gerente_marketing', 'editoracao', 'visualizador'] },
  
  // Mídia - Todos exceto operator e client
  { path: '/media', roles: ['admin_sql', 'admin', 'gerente_marketing', 'editoracao', 'visualizador'], requiresClientAccess: true },
  
  // Playlists - Todos exceto operator, editoracao e client
  { path: '/playlists', roles: ['admin_sql', 'admin', 'gerente_marketing', 'visualizador'], requiresClientAccess: true },
  
  // Smart Playlist - admin_sql, admin, gerente_marketing
  { path: '/smart-playlist', roles: ['admin_sql', 'admin', 'gerente_marketing'], requiresClientAccess: true },
  
  // Campanhas - Todos exceto operator, editoracao e client
  { path: '/campaigns', roles: ['admin_sql', 'admin', 'gerente_marketing', 'visualizador'], requiresClientAccess: true },
  
  // Players - admin_sql, operator, admin
  { path: '/players', roles: ['admin_sql', 'operator', 'admin'] },
  
  // Totems - Todos exceto editoracao (operator só vê dados técnicos)
  { path: '/totems', roles: ['admin_sql', 'operator', 'admin', 'gerente_marketing', 'visualizador'] },
  
  // Usuários - admin_sql, admin (próprio cliente)
  { path: '/users', roles: ['admin_sql', 'admin'] },
  
  // Clientes - admin_sql, admin
  { path: '/clients', roles: ['admin_sql', 'admin'] },
  
  // Analytics - Todos exceto operator, editoracao e client
  { path: '/analytics', roles: ['admin_sql', 'admin', 'gerente_marketing', 'visualizador'], requiresClientAccess: true },
  
  // Relatórios - Todos exceto operator, editoracao e client
  { path: '/reports', roles: ['admin_sql', 'admin', 'gerente_marketing', 'visualizador'], requiresClientAccess: true },
  
  // QR Codes - admin_sql, admin, gerente_marketing
  { path: '/qr-codes', roles: ['admin_sql', 'admin', 'gerente_marketing'], requiresClientAccess: true },
  
  // Faturamento - admin_sql, admin (próprio cliente)
  { path: '/billing', roles: ['admin_sql', 'admin'], requiresClientAccess: true },
  
  // IA - admin_sql, admin, gerente_marketing
  { path: '/ai', roles: ['admin_sql', 'admin', 'gerente_marketing'], requiresClientAccess: true },
  
  // Admin Tools - admin_sql, operator
  { path: '/admin-tools', roles: ['admin_sql', 'operator'] },
  
  // OTA Updates - admin_sql, operator
  { path: '/ota-updates', roles: ['admin_sql', 'operator'] },
  
  // Tags - admin_sql, admin, gerente_marketing, editoracao
  { path: '/tags', roles: ['admin_sql', 'admin', 'gerente_marketing', 'editoracao'], requiresClientAccess: true },
  
  // SmartDisplayFX - Todos exceto editoracao (operator só vê logs/config)
  { path: '/smartdisplayfx', roles: ['admin_sql', 'operator', 'admin', 'gerente_marketing', 'visualizador'] },
  
  // Configurações - admin_sql, operator, admin
  { path: '/settings', roles: ['admin_sql', 'operator', 'admin'] },
];

/**
 * Verifica se uma role pode acessar um recurso
 */
export function canAccess(userRole: UserRole | string, path: string): boolean {
  const permission = menuPermissions.find(p => p.path === path);
  if (!permission) {
    // Se não encontrar permissão, permitir por padrão (compatibilidade)
    return true;
  }
  return permission.roles.includes(userRole as UserRole);
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

