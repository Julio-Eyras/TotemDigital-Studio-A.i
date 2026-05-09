import {
  getTotemCreateRolesForProfile,
  roleMatchesTotemCreatePolicy,
} from '../../../utils/totemCreateRoles';

describe('totemCreateRoles', () => {
  describe('getTotemCreateRolesForProfile', () => {
    it('compact: apenas admin, admin_sql e owner_system', () => {
      expect(getTotemCreateRolesForProfile(true)).toEqual(['admin', 'admin_sql', 'owner_system']);
    });

    it('PRO: inclui operadores, publisher_user, gerente_marketing e subscriber_user', () => {
      const roles = getTotemCreateRolesForProfile(false);
      expect(roles).toContain('publisher_user');
      expect(roles).toContain('subscriber_user');
      expect(roles).toContain('gerente_marketing');
      expect(roles).toContain('operador_tecnico');
    });
  });

  describe('roleMatchesTotemCreatePolicy', () => {
    const compactList = getTotemCreateRolesForProfile(true);
    const proList = getTotemCreateRolesForProfile(false);

    it('owner_system sempre permitido', () => {
      expect(roleMatchesTotemCreatePolicy('owner_system', [])).toBe(true);
      expect(roleMatchesTotemCreatePolicy('owner_system', compactList)).toBe(true);
    });

    it('admin_sql permitido quando a lista inclui admin ou admin_sql', () => {
      expect(roleMatchesTotemCreatePolicy('admin_sql', compactList)).toBe(true);
      expect(roleMatchesTotemCreatePolicy('admin_sql', ['operador_tecnico'])).toBe(false);
    });

    it('publisher_user só na lista PRO', () => {
      expect(roleMatchesTotemCreatePolicy('publisher_user', compactList)).toBe(false);
      expect(roleMatchesTotemCreatePolicy('publisher_user', proList)).toBe(true);
    });

    it('subscriber_user só na lista PRO', () => {
      expect(roleMatchesTotemCreatePolicy('subscriber_user', compactList)).toBe(false);
      expect(roleMatchesTotemCreatePolicy('subscriber_user', proList)).toBe(true);
    });
  });
});
