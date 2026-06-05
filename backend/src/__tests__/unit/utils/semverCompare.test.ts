import { compareSemver, isNewerVersion } from '../../../utils/semverCompare';

describe('semverCompare', () => {
  it('compara versões numericamente', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1);
    expect(compareSemver('1.9.0', '1.10.0')).toBe(-1);
    expect(compareSemver('2.0.0', '2.0.0')).toBe(0);
  });

  it('isNewerVersion detecta upgrade', () => {
    expect(isNewerVersion('1.2.0', '1.1.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
  });
});
