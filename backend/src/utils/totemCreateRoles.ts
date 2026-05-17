import { isStudioRuntime } from '../config/installationRuntime';

const norm = (r: string | undefined) => String(r || '').trim().toLowerCase();

/**
 * Listas por perfil de instalação (testável sem depender de env em runtime).
 */
export function getTotemCreateRolesForProfile(compact: boolean): string[] {
  if (compact) {
    return ['admin', 'admin_sql', 'owner_system'];
  }
  return [
    'admin',
    'admin_sql',
    'owner_system',
    'operador_tecnico',
    'operador_faturamento',
    'operador_comercial',
    'publisher_user',
    'gerente_marketing',
    'subscriber_user',
  ];
}

/**
 * Papéis autorizados a criar totem via API (POST /api/totems; POST /api/players legado).
 * Compacto: só administradores de sistema (admin/admin_sql) e owner_system.
 * PRO: operadores, publisher_user, gerente_marketing e subscriber_user (integrações legadas).
 */
export function getTotemCreateRoles(): string[] {
  return getTotemCreateRolesForProfile(isStudioRuntime());
}

/**
 * Espelha a lógica de authorizeRole para a lista de criação (owner_system e admin_sql).
 */
export function roleMatchesTotemCreatePolicy(userRole: string | undefined, allowedRoles: string[]): boolean {
  const userRoleNorm = norm(userRole);
  const normalizedRoles = allowedRoles.map((r) => norm(r));

  if (userRoleNorm === 'owner_system') {
    return true;
  }

  if (
    userRoleNorm === 'admin_sql' &&
    (normalizedRoles.includes('admin') || normalizedRoles.includes('admin_sql'))
  ) {
    return true;
  }

  return normalizedRoles.includes(userRoleNorm);
}

/** Verificação na camada de serviço (defesa além da rota). */
export function userMayCreateTotem(userRole: string | undefined): boolean {
  return roleMatchesTotemCreatePolicy(userRole, getTotemCreateRoles());
}
