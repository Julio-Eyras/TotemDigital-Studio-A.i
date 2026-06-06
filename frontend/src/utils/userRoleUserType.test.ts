import {
  applyRoleToCreateUser,
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
