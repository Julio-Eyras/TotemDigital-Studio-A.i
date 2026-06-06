import {
  applyRoleToCreateUser,
  getRoleLabel,
  getUserRoleOptionGroups,
  normalizeAppRole,
  sanitizeCreateUserPayload,
  sanitizeUpdateUserPayload,
  userTypeForRole,
  validateCreateUserPayload,
} from './userRoleUserType';
import type { CreateUserRequest } from '../services/api';

const baseUser = (): CreateUserRequest => ({
  username: 'julio',
  email: 'a@b.com',
  password: 'secret',
  name: 'Julio',
  role: 'user',
  userType: 'system_user',
  isTenantUser: true,
});

describe('getUserRoleOptionGroups', () => {
  it('agrupa funções em Sistema, Organização e Anunciante', () => {
    const groups = getUserRoleOptionGroups('Organização');
    expect(groups).toHaveLength(3);
    expect(groups[0].title).toMatch(/Sistema/i);
    expect(groups[1].roles[0].value).toBe('publisher_user');
    expect(groups[2].roles[0].value).toBe('subscriber_user');
  });
});

describe('userTypeForRole', () => {
  it('funções de sistema exigem system_user', () => {
    expect(userTypeForRole('owner_system')).toBe('system_user');
    expect(userTypeForRole('admin')).toBe('system_user');
  });

  it('publisher_user e subscriber_user mapeiam para si', () => {
    expect(userTypeForRole('publisher_user')).toBe('publisher_user');
    expect(userTypeForRole('subscriber_user')).toBe('subscriber_user');
  });
});

describe('applyRoleToCreateUser', () => {
  it('limpa organização ao escolher owner_system', () => {
    const next = applyRoleToCreateUser(
      { ...baseUser(), userType: 'publisher_user', publisherId: 1, isTenantUser: false },
      'owner_system'
    );
    expect(next.userType).toBe('system_user');
    expect(next.publisherId).toBeUndefined();
    expect(next.isTenantUser).toBe(true);
  });

  it('mantém publisherId para publisher_user', () => {
    const next = applyRoleToCreateUser(
      { ...baseUser(), publisherId: 2, isTenantUser: false },
      'publisher_user'
    );
    expect(next.userType).toBe('publisher_user');
    expect(next.publisherId).toBe(2);
  });
});

describe('sanitizeCreateUserPayload', () => {
  it('remove email vazio para evitar 400 do validador', () => {
    const payload = sanitizeCreateUserPayload({
      ...baseUser(),
      email: '   ',
      role: 'owner_system',
    });
    expect(payload.email).toBeUndefined();
    expect(payload.userType).toBe('system_user');
  });
});

describe('normalizeAppRole', () => {
  it('normaliza role em maiúsculas', () => {
    expect(normalizeAppRole('USER')).toBe('user');
    expect(normalizeAppRole('ADMIN')).toBe('admin');
  });
});

describe('sanitizeUpdateUserPayload', () => {
  it('marca tenant para funções de sistema', () => {
    const payload = sanitizeUpdateUserPayload({
      username: 'julio',
      name: 'Julio',
      role: 'user',
      is_tenant_user: true,
      is_active: true,
    });
    expect(payload.userType).toBe('system_user');
    expect(payload.isTenantUser).toBe(true);
  });
});

describe('getRoleLabel', () => {
  it('resolve rótulo da função selecionada', () => {
    expect(getRoleLabel('operador_faturamento')).toBe('Operador Faturamento');
  });
});

describe('validateCreateUserPayload', () => {
  it('rejeita publisher_user sem organização', () => {
    const err = validateCreateUserPayload({
      ...baseUser(),
      role: 'publisher_user',
      userType: 'publisher_user',
      isTenantUser: false,
    });
    expect(err).toMatch(/organização/i);
  });

  it('aceita owner_system com system_user', () => {
    const err = validateCreateUserPayload({
      ...baseUser(),
      role: 'owner_system',
      userType: 'system_user',
    });
    expect(err).toBeNull();
  });
});
