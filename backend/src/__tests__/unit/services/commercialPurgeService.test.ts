/**
 * @jest-environment node
 */
import {
  previewCommercialPurge,
  runCommercialPurge,
  PURGE_CONFIRM_PHRASE,
} from '../../../services/commercialPurgeService';

function makeDb() {
  return {
    findFirst: jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) return { t: 'ok' };
      if (sql.includes('COUNT(*)')) return { c: 2 };
      return null;
    }),
    findMany: jest.fn(async () => []),
    executeRaw: jest.fn(async () => undefined),
    tableExists: jest.fn(async () => true),
  };
}

describe('commercialPurgeService', () => {
  it('preview não escreve', async () => {
    const db = makeDb();
    const result = await previewCommercialPurge(db as any, { keepMediaFiles: true });
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(db.executeRaw).not.toHaveBeenCalled();
    expect(result.scopes).not.toContain('media_files');
  });

  it('dryRun default não executa DELETE', async () => {
    const db = makeDb();
    const result = await runCommercialPurge(db as any, {});
    expect(result.dryRun).toBe(true);
    expect(db.executeRaw).not.toHaveBeenCalled();
  });

  it('frase inválida bloqueia execução', async () => {
    const db = makeDb();
    const result = await runCommercialPurge(db as any, {
      dryRun: false,
      confirmPhrase: 'errada',
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain(PURGE_CONFIRM_PHRASE);
  });
});
