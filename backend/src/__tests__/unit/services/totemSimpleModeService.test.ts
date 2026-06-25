import {
  resolveSimpleTotemModeDefault,
  TOTEM_SIMPLE_MODE_SETTING_KEY,
} from '../../../services/totemSimpleModeService';

describe('totemSimpleModeService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SIMPLE_TOTEM_MODE_DEFAULT;
    delete process.env.TOTEMDIGITAL_COMPACT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('exporta chave de setting esperada', () => {
    expect(TOTEM_SIMPLE_MODE_SETTING_KEY).toBe('totem.simple_mode_enabled');
  });

  it('default true em instalação compacta', () => {
    process.env.TOTEMDIGITAL_COMPACT = 'true';
    expect(resolveSimpleTotemModeDefault()).toBe(true);
  });

  it('respeita SIMPLE_TOTEM_MODE_DEFAULT=false', () => {
    process.env.TOTEMDIGITAL_COMPACT = 'true';
    process.env.SIMPLE_TOTEM_MODE_DEFAULT = 'false';
    expect(resolveSimpleTotemModeDefault()).toBe(false);
  });
});
