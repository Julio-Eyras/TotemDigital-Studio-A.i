import { OTAUpdateService } from '../../../services/otaUpdateService';

const findMany = jest.fn();
const findFirst = jest.fn();
const executeRaw = jest.fn();

jest.mock('../../../config/database', () => ({
  getDatabase: () => ({ findMany, findFirst, executeRaw }),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn(async () => undefined),
  logError: jest.fn(async () => undefined),
}));

const sampleRow = {
  id: 1,
  version: '2.0.0',
  platform: 'android',
  file_path: '/tmp/update.apk',
  file_size: 1024,
  checksum: 'abc',
  description: 'Test',
  changelog: null,
  is_mandatory: false,
  min_version: null,
  max_version: null,
  rollout_percentage: 100,
  status: 'draft',
  created_at: '2026-05-01T00:00:00.000Z',
  released_at: null,
};

describe('OTAUpdateService', () => {
  let svc: OTAUpdateService;

  beforeEach(() => {
    findMany.mockReset();
    findFirst.mockReset();
    executeRaw.mockReset();
    svc = new OTAUpdateService();
  });

  describe('getUpdateHistory', () => {
    it('mapeia linhas do banco para OTAUpdate', async () => {
      findMany.mockResolvedValueOnce([sampleRow]);

      const updates = await svc.getUpdateHistory(10);

      expect(findMany).toHaveBeenCalledWith(expect.stringContaining('FROM ota_updates'), [10]);
      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({
        id: 1,
        version: '2.0.0',
        platform: 'android',
        filePath: '/tmp/update.apk',
        status: 'draft',
      });
      expect(updates[0].createdAt).toBeInstanceOf(Date);
    });

    it('propaga erro do banco', async () => {
      findMany.mockRejectedValueOnce(new Error('db down'));
      await expect(svc.getUpdateHistory()).rejects.toThrow('db down');
    });
  });

  describe('activateUpdate', () => {
    it('ativa atualização inexistente lança erro', async () => {
      findFirst.mockResolvedValueOnce(null);
      await expect(svc.activateUpdate(99, 1)).rejects.toThrow('Atualização não encontrada');
    });

    it('não duplica update quando já está active', async () => {
      findFirst.mockResolvedValueOnce({ ...sampleRow, status: 'active' });

      await svc.activateUpdate(1, 1);

      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('executa UPDATE quando status não é active', async () => {
      findFirst.mockResolvedValueOnce({ ...sampleRow, status: 'draft' });
      executeRaw.mockResolvedValueOnce({ rows: [] });

      await svc.activateUpdate(1, 1);

      expect(executeRaw).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'active'"),
        [1]
      );
    });
  });

  describe('pauseUpdate', () => {
    it('marca status paused', async () => {
      executeRaw.mockResolvedValueOnce({ rows: [] });

      await svc.pauseUpdate(5);

      expect(executeRaw).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'paused'"),
        [5]
      );
    });
  });

  describe('getUpdateStats', () => {
    it('agrega contagens de updates e totens', async () => {
      findFirst
        .mockResolvedValueOnce({
          active_count: '2',
          testing_count: '1',
          completed_count: '3',
          platform_count: '4',
        })
        .mockResolvedValueOnce({
          up_to_date_count: '10',
          update_available_count: '2',
          downloading_count: '0',
          installing_count: '1',
          failed_count: '0',
        });

      const stats = await svc.getUpdateStats();

      expect(stats).toEqual({
        updates: { active: '2', testing: '1', completed: '3', platforms: '4' },
        totems: {
          upToDate: '10',
          updateAvailable: '2',
          downloading: '0',
          installing: '1',
          failed: '0',
        },
      });
    });
  });
});
