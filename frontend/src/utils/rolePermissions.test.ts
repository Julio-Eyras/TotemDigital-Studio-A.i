import { canAccess, canAccessDispatcherHub, requiresClientAccess } from './rolePermissions';

jest.mock('./installationModuleAccess', () => ({
  isPathAllowedByInstallationModules: () => true,
}));

const allFlagsFalse = {
  flag_smart_0: false,
  flag_smart_1: false,
  flag_smart_2: false,
  flag_smart_3: false,
  flag_smart_4: false,
  flag_smart_5: false,
  flag_smart_6: false,
  flag_smart_7: false,
  flag_smart_8: false,
  flag_smart_9: false,
};

const withFlag = (flag: keyof typeof allFlagsFalse) => ({
  ...allFlagsFalse,
  [flag]: true,
});

const mockIsStudioMode = jest.fn(() => false);

jest.mock('../config/studioMode', () => ({
  isStudioMode: () => mockIsStudioMode(),
}));

describe('rolePermissions.canAccess', () => {
  beforeEach(() => {
    mockIsStudioMode.mockReturnValue(false);
  });

  it('owner_system acede a qualquer rota registada', () => {
    expect(canAccess('owner_system', '/ota-updates')).toBe(true);
    expect(canAccess('owner_system', '/billing')).toBe(true);
  });

  it('OWNER_SYSTEM (maiúsculas) acede Complementos e dispatcher', () => {
    expect(canAccess('OWNER_SYSTEM', '/settings/system-modules')).toBe(true);
    expect(canAccess('OWNER_SYSTEM', '/dispatcher-monitor', allFlagsFalse)).toBe(true);
    expect(canAccessDispatcherHub('OWNER_SYSTEM', allFlagsFalse)).toBe(true);
    expect(canAccessDispatcherHub('admin', allFlagsFalse)).toBe(true);
  });

  it('operador_tecnico sem flag_smart_2 não acede hub dispatcher', () => {
    expect(canAccessDispatcherHub('operador_tecnico', allFlagsFalse)).toBe(false);
    expect(canAccessDispatcherHub('operador_tecnico', withFlag('flag_smart_2'))).toBe(true);
  });

  it('admin acede a OTA e admin-tools sem depender de flag_smart_1/2', () => {
    expect(canAccess('admin', '/ota-updates', allFlagsFalse)).toBe(true);
    expect(canAccess('admin', '/ota-updates/history', allFlagsFalse)).toBe(true);
    expect(canAccess('admin', '/admin-tools', allFlagsFalse)).toBe(true);
  });

  it('operator com flag_smart_1 acede OTA; sem flag nega', () => {
    expect(canAccess('operator', '/ota-updates', withFlag('flag_smart_1'))).toBe(false);
    expect(canAccess('operator', '/ota-updates', allFlagsFalse)).toBe(false);
  });

  it('operador_tecnico sem flag nega OTA', () => {
    expect(canAccess('operador_tecnico', '/ota-updates', allFlagsFalse)).toBe(false);
    expect(canAccess('operador_tecnico', '/ota-updates', withFlag('flag_smart_1'))).toBe(false);
  });

  it('publisher_user não acede OTA fora do Studio', () => {
    expect(canAccess('publisher_user', '/ota-updates', withFlag('flag_smart_1'))).toBe(false);
    expect(canAccess('publisher_user', '/settings')).toBe(true);
  });

  it('ignora query string ao validar path', () => {
    expect(canAccess('admin', '/billing?view=plans&type=subscriber')).toBe(true);
  });

  it('subscriber_user não acede rotas administrativas', () => {
    expect(canAccess('subscriber_user', '/users')).toBe(false);
    expect(canAccess('subscriber_user', '/ota-updates')).toBe(false);
  });

  it('lab /lab/system é consola de lab, não menu Direct', () => {
    expect(canAccess('admin', '/lab/system')).toBe(true);
    expect(canAccess('visualizador', '/lab/system')).toBe(false);
    expect(canAccess('subscriber_user', '/lab/system')).toBe(false);
  });
});

describe('rolePermissions.canAccess (Studio)', () => {
  beforeEach(() => {
    mockIsStudioMode.mockReturnValue(true);
  });

  it('operador_faturamento tem paridade de navegação no Studio', () => {
    expect(canAccess('operador_faturamento', '/ota-updates', allFlagsFalse)).toBe(true);
    expect(canAccess('operador_faturamento', '/plan-publisher-access')).toBe(true);
  });

  it('publisher_user acede dispatcher, billing e lab system sem flag_smart_2/3', () => {
    expect(canAccess('publisher_user', '/dispatcher-manager', allFlagsFalse)).toBe(true);
    expect(canAccess('publisher_user', '/billing', allFlagsFalse)).toBe(true);
    expect(canAccess('publisher_user', '/playlist-mix', allFlagsFalse)).toBe(true);
    expect(canAccess('publisher_user', '/lab/system', allFlagsFalse)).toBe(true);
  });

  it('publisher_user no Studio continua sem OTA', () => {
    expect(canAccess('publisher_user', '/ota-updates', withFlag('flag_smart_1'))).toBe(false);
  });
});

describe('rolePermissions.requiresClientAccess', () => {
  it('marca rotas de conteúdo do anunciante', () => {
    expect(requiresClientAccess('/media')).toBe(true);
    expect(requiresClientAccess('/campaigns')).toBe(true);
    expect(requiresClientAccess('/settings')).toBe(false);
  });
});
