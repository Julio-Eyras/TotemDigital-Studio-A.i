import {
  getLabCapabilities,
  labAceOptInSnapshot,
  putLabAceOptIn,
  putLabCapabilities,
  resetLabCapabilitiesStoreForTests,
  sqlDisableAce,
  sqlEnableAce,
} from '../../../services/lab/labCapabilitiesStore';
import { isAceEnabledInCapabilities } from '../../../services/ace/aceRuleEngine';

describe('lab ACE opt-in (mock SQL, sem Postgres)', () => {
  beforeEach(() => {
    resetLabCapabilitiesStoreForTests();
  });

  it('merge JSONB liga e desliga sem apagar outras keys', () => {
    const on = sqlEnableAce({ wifi: true, ace_enabled: false });
    expect(on.wifi).toBe(true);
    expect(isAceEnabledInCapabilities(on)).toBe(true);

    const off = sqlDisableAce({ ace_enabled: true, wifi: true });
    expect(off.wifi).toBe(true);
    expect(isAceEnabledInCapabilities(off)).toBe(false);
  });

  it('string true e 1 não ligam', () => {
    expect(isAceEnabledInCapabilities({ ace_enabled: 'true' })).toBe(false);
    expect(isAceEnabledInCapabilities({ ace_enabled: 1 })).toBe(false);
    putLabCapabilities(41, { ace_enabled: 'true' });
    expect(labAceOptInSnapshot(41).aceEnabled).toBe(false);
  });

  it('store default off; PATCH true persiste por totem', () => {
    expect(getLabCapabilities(41)).toEqual({});
    expect(labAceOptInSnapshot(41).aceEnabled).toBe(false);
    putLabAceOptIn(41, true);
    expect(labAceOptInSnapshot(41).aceEnabled).toBe(true);
    expect(labAceOptInSnapshot(42).aceEnabled).toBe(false);
    putLabAceOptIn(41, false);
    expect(labAceOptInSnapshot(41).aceEnabled).toBe(false);
  });
});
