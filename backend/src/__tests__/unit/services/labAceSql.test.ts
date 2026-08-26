import {
  applyLabAceSql,
  putLabAceSqlRow,
  resetLabAceSqlForTests,
  selectLabAceSql,
  setLabAceSqlConnected,
} from '../../../services/lab/labAceSql';

describe('lab ACE SQL (tabela totems.capabilities, sem Postgres real)', () => {
  beforeEach(() => {
    resetLabAceSqlForTests();
  });

  it('SELECT sem ligação → NO_DATABASE', () => {
    expect(selectLabAceSql(41).code).toBe('NO_DATABASE');
    expect(selectLabAceSql(41).aceEnabled).toBe(false);
  });

  it('SELECT sem linha → NO_TOTEM; ace_enabled true liga; string true não', () => {
    setLabAceSqlConnected(true);
    expect(selectLabAceSql(41).code).toBe('NO_TOTEM');

    putLabAceSqlRow(41, { ace_enabled: true, wifi: true });
    const on = selectLabAceSql(41);
    expect(on.code).toBe('OK');
    expect(on.aceEnabled).toBe(true);
    expect(on.capabilities.wifi).toBe(true);

    putLabAceSqlRow(41, { ace_enabled: 'true' });
    expect(selectLabAceSql(41).aceEnabled).toBe(false);
  });

  it('UPDATE só com apply=true; sem linha não inventa totem', () => {
    putLabAceSqlRow(41, { wifi: true });
    const preview = applyLabAceSql(41, true, { apply: false });
    expect(preview.applied).toBe(false);
    expect(preview.aceEnabled).toBe(true);
    expect(selectLabAceSql(41).aceEnabled).toBe(false);

    const written = applyLabAceSql(41, true, { apply: true });
    expect(written.applied).toBe(true);
    expect(selectLabAceSql(41).aceEnabled).toBe(true);
    expect(selectLabAceSql(41).capabilities.wifi).toBe(true);

    resetLabAceSqlForTests();
    setLabAceSqlConnected(true);
    const missing = applyLabAceSql(41, true, { apply: true });
    expect(missing.code).toBe('NO_TOTEM');
    expect(missing.applied).toBe(false);
  });
});
