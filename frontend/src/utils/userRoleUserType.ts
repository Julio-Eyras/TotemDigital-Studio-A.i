import type { CreateUserRequest } from '../services/api';

export type AppUserType = 'system_user' | 'publisher_user' | 'subscriber_user';

export interface UserRoleOption {
  value: string;
  label: string;
}

export interface UserRoleOptionGroup {
  title: string;
  roles: UserRoleOption[];
}

export const APP_USER_ROLES = [
  'owner_system',
  'admin_sql',
  'admin',
  'operador_tecnico',
  'operador_faturamento',
  'operador_comercial',
  'gerente_marketing',
  'editoracao',
  'visualizador',
  'user',
  'publisher_user',
  'subscriber_user',
] as const;

export type AppUserRole = (typeof APP_USER_ROLES)[number];

export function normalizeAppRole(role: string | null | undefined): AppUserRole {
  const normalized = String(role ?? 'user')
    .trim()
    .toLowerCase();
  if ((APP_USER_ROLES as readonly string[]).includes(normalized)) {
    return normalized as AppUserRole;
  }
  return 'user';
}

const SYSTEM_ROLE_OPTIONS: UserRoleOption[] = [
  { value: 'owner_system', label: 'Owner System' },
  { value: 'admin_sql', label: 'Admin SQL' },
  { value: 'admin', label: 'Administrador' },
  { value: 'operador_tecnico', label: 'Operador Técnico' },
  { value: 'operador_faturamento', label: 'Operador Faturamento' },
  { value: 'operador_comercial', label: 'Operador Comercial' },
  { value: 'gerente_marketing', label: 'Gerente Marketing' },
  { value: 'editoracao', label: 'Edição' },
  { value: 'visualizador', label: 'Visualizador' },
  { value: 'user', label: 'Usuário' },
];

const ROLE_HEADER_SX = {
  opacity: '1 !important',
  fontWeight: 600,
  fontSize: '0.75rem',
  color: 'text.secondary',
  cursor: 'default',
  py: 0.75,
  '&.Mui-disabled': { opacity: '1 !important' },
} as const;

/** Cabeçalho visual de grupo (não selecionável) para Select. */
export function roleGroupHeaderSx() {
  return ROLE_HEADER_SX;
}

/** Rótulo legível da função no campo fechado do Select. */
export function getRoleLabel(role: string, organizationLabel = 'organização'): string {
  for (const group of getUserRoleOptionGroups(organizationLabel)) {
    const match = group.roles.find((r) => r.value === role);
    if (match) return match.label;
  }
  return role;
}

/** Grupos do dropdown de função (criar/editar/filtrar). */
export function getUserRoleOptionGroups(
  organizationLabel = 'organização',
  opts?: { actorRole?: string; directTotem?: boolean }
): UserRoleOptionGroup[] {
  const org = organizationLabel.toLowerCase();
  let systemRoles = [...SYSTEM_ROLE_OPTIONS];
  const actor = opts?.actorRole ? normalizeAppRole(opts.actorRole) : undefined;
  if (opts?.directTotem && actor === 'admin') {
    systemRoles = systemRoles.filter(
      (r) => r.value !== 'owner_system' && r.value !== 'admin_sql'
    );
  }
  return [
    {
      title: 'Sistema — acesso global à plataforma',
      roles: systemRoles,
    },
    {
      title: `Organização — portal da ${org}`,
      roles: [
        {
          value: 'publisher_user',
          label: `Usuário do portal (${organizationLabel})`,
        },
      ],
    },
    {
      title: 'Anunciante — portal do anunciante',
      roles: [{ value: 'subscriber_user', label: 'Usuário do portal (anunciante)' }],
    },
  ];
}

/** Tipo de usuário exigido pelo backend para cada função (role). */
export function userTypeForRole(role: string): AppUserType {
  if (role === 'publisher_user') return 'publisher_user';
  if (role === 'subscriber_user') return 'subscriber_user';
  return 'system_user';
}

export function isPublisherScopedRole(role: string): boolean {
  return role === 'publisher_user';
}

export function isSubscriberScopedRole(role: string): boolean {
  return role === 'subscriber_user';
}

export function isSystemScopedRole(role: string): boolean {
  return !isPublisherScopedRole(role) && !isSubscriberScopedRole(role);
}

/** Alinha userType e vínculos ao mudar a função no formulário de criação. */
export function applyRoleToCreateUser(user: CreateUserRequest, role: string): CreateUserRequest {
  const normalizedRole = normalizeAppRole(role);
  const userType = userTypeForRole(normalizedRole);

  if (userType === 'publisher_user') {
    return {
      ...user,
      role: normalizedRole,
      userType,
      subscriberId: undefined,
      isTenantUser: false,
    };
  }

  if (userType === 'subscriber_user') {
    return {
      ...user,
      role: normalizedRole,
      userType,
      publisherId: undefined,
      isTenantUser: false,
    };
  }

  return {
    ...user,
    role: normalizedRole,
    userType: 'system_user',
    publisherId: undefined,
    subscriberId: undefined,
    isTenantUser: true,
  };
}

export function applyRoleToUserRecord<
  T extends {
    role: string;
    user_type?: string;
    publisher_id?: number;
    subscriber_id?: number;
    is_tenant_user?: boolean;
  },
>(user: T, role: string): T {
  const normalizedRole = normalizeAppRole(role);
  const userType = userTypeForRole(normalizedRole);

  if (userType === 'publisher_user') {
    return {
      ...user,
      role: normalizedRole,
      user_type: userType,
      subscriber_id: undefined,
      is_tenant_user: false,
    };
  }

  if (userType === 'subscriber_user') {
    return {
      ...user,
      role: normalizedRole,
      user_type: userType,
      publisher_id: undefined,
      is_tenant_user: false,
    };
  }

  return {
    ...user,
    role: normalizedRole,
    user_type: 'system_user',
    publisher_id: undefined,
    subscriber_id: undefined,
    is_tenant_user: true,
  };
}

/** Payload limpo para POST /api/users (evita email vazio e campos incoerentes). */
export function sanitizeUpdateUserPayload(user: {
  username?: string;
  email?: string | null;
  name?: string;
  role: string;
  publisher_id?: number | null;
  subscriber_id?: number | null;
  is_active?: boolean;
  is_tenant_user?: boolean;
  isTenantUser?: boolean;
}): {
  username: string;
  email?: string;
  name: string;
  role: AppUserRole;
  userType: AppUserType;
  publisherId?: number;
  subscriberId?: number;
  isTenantUser: boolean;
  isActive: boolean;
} {
  const role = normalizeAppRole(user.role);
  const email = user.email?.trim();
  const isTenant =
    isSystemScopedRole(role) &&
    Boolean(user.isTenantUser ?? user.is_tenant_user ?? true);

  return {
    username: (user.username ?? '').trim(),
    name: (user.name ?? '').trim(),
    email: email ? email : undefined,
    role: role as CreateUserRequest['role'],
    userType: userTypeForRole(role),
    publisherId: isPublisherScopedRole(role) ? user.publisher_id ?? undefined : undefined,
    subscriberId: isSubscriberScopedRole(role) ? user.subscriber_id ?? undefined : undefined,
    isTenantUser: isTenant,
    isActive: user.is_active ?? true,
  };
}

export function sanitizeCreateUserPayload(user: CreateUserRequest): CreateUserRequest {
  const role = normalizeAppRole(user.role);
  const email = user.email?.trim();
  return {
    username: user.username.trim(),
    name: user.name.trim(),
    password: user.password,
    role: role as CreateUserRequest['role'],
    userType: userTypeForRole(role),
    email: email ? email : undefined,
    publisherId: isPublisherScopedRole(role) ? user.publisherId : undefined,
    subscriberId: isSubscriberScopedRole(role) ? user.subscriberId : undefined,
    isTenantUser: isSystemScopedRole(role) ? user.isTenantUser ?? true : false,
    flags: user.flags,
  };
}

export function validateCreateUserPayload(user: CreateUserRequest): string | null {
  if (isPublisherScopedRole(user.role) && !user.publisherId) {
    return 'Selecione uma organização para usuários da organização.';
  }
  if (isSubscriberScopedRole(user.role) && !user.subscriberId) {
    return 'Selecione um anunciante para usuários anunciantes.';
  }
  if (user.userType !== userTypeForRole(user.role)) {
    return `A função "${user.role}" exige tipo "${userTypeForRole(user.role)}".`;
  }
  return null;
}

/** Utilizador logado na sidebar: username (login) → first_name → name. */
export function resolveLoggedUserDisplayName(
  user: Record<string, unknown> | null | undefined
): string {
  if (!user) return '—';
  const username = String(user.username ?? '').trim();
  if (username) return username;
  const firstName = String(user.first_name ?? user.firstName ?? '').trim();
  if (firstName) return firstName;
  const name = String(user.name ?? '').trim();
  if (name) return name;
  return '—';
}
