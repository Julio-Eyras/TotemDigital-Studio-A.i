/**
 * Filtro Direct Totem: system_owner_only e contagem de resíduos.
 */

jest.mock('../../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn().mockResolvedValue(undefined),
}));

import { getDatabase } from '../../../config/database';
import { PublisherService } from '../../../services/publisherService';

describe('PublisherService — filtro Direct / system owner', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getDatabase as jest.Mock).mockReturnValue({ findMany, findFirst });
  });

  it('getAllPublishers com system_owner_only inclui is_system_owner no WHERE', async () => {
    findMany.mockResolvedValue([]);
    findFirst.mockResolvedValue({ total: '0' });

    const svc = new PublisherService();
    await svc.getAllPublishers({ system_owner_only: true, active_only: true });

    const sql = String(findMany.mock.calls[0][0]);
    expect(sql).toMatch(/is_system_owner/i);
    expect(sql).toMatch(/COALESCE\(p\.is_system_owner,\s*false\)\s*=\s*true/i);
  });

  it('getAllPublishers sem system_owner_only não filtra por owner', async () => {
    findMany.mockResolvedValue([]);
    findFirst.mockResolvedValue({ total: '0' });

    const svc = new PublisherService();
    await svc.getAllPublishers({ active_only: true });

    const sql = String(findMany.mock.calls[0][0]);
    expect(sql).not.toMatch(/is_system_owner/i);
  });

  it('countActiveNonOwnerPublishers devolve total de não-owner activos', async () => {
    findFirst.mockResolvedValue({ total: 2 });
    const svc = new PublisherService();
    await expect(svc.countActiveNonOwnerPublishers()).resolves.toBe(2);
    const sql = String(findFirst.mock.calls[0][0]);
    expect(sql).toMatch(/is_system_owner/i);
    expect(sql).toMatch(/=\s*false/i);
  });

  it('isSystemOwnerPublisher true/false conforme linha', async () => {
    findFirst.mockResolvedValueOnce({ publisher_id: 1 });
    const svc = new PublisherService();
    await expect(svc.isSystemOwnerPublisher(1)).resolves.toBe(true);

    findFirst.mockResolvedValueOnce(null);
    await expect(svc.isSystemOwnerPublisher(99)).resolves.toBe(false);
  });
});
