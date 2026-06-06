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

/** Grupos do dropdown de função (criar/editar/filtrar). */
export function getUserRoleOptionGroups(organizationLabel = 'organização'): UserRoleOptionGroup[] {
  const org = organizationLabel.toLowerCase();
  return [
    {
      title: 'Sistema — acesso global à plataforma',
      roles: SYSTEM_ROLE_OPTIONS,
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
  const userType = userTypeForRole(role);

  if (userType === 'publisher_user') {
    return {
      ...user,
      role: role as CreateUserRequest['role'],
      userType,
      subscriberId: undefined,
      isTenantUser: false,
    };
  }

  if (userType === 'subscriber_user') {
    return {
      ...user,
      role: role as CreateUserRequest['role'],
      userType,
      publisherId: undefined,
      isTenantUser: false,
    };
  }

  return {
    ...user,
    role: role as CreateUserRequest['role'],
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
  const userType = userTypeForRole(role);

  if (userType === 'publisher_user') {
    return {
      ...user,
      role,
      user_type: userType,
      subscriber_id: undefined,
      is_tenant_user: false,
    };
  }

  if (userType === 'subscriber_user') {
    return {
      ...user,
      role,
      user_type: userType,
      publisher_id: undefined,
      is_tenant_user: false,
    };
  }

  return {
    ...user,
    role,
    user_type: 'system_user',
    publisher_id: undefined,
    subscriber_id: undefined,
    is_tenant_user: true,
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
