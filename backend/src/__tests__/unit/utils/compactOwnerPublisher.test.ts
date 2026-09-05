/**
 * Escopo Direct/Studio ao system owner (também para admin).
 */

jest.mock('../../../config/installationRuntime', () => ({
  isStudioRuntime: jest.fn(),
}));

jest.mock('../../../config/directTotemMode', () => ({
  isDirectTotemMode: jest.fn(),
}));

import { isStudioRuntime } from '../../../config/installationRuntime';
import { isDirectTotemMode } from '../../../config/directTotemMode';
import {
  resetCompactOwnerPublisherCache,
  resolveCompactOwnerPublisherId,
  resolveInventoryPublisherScope,
} from '../../../utils/compactOwnerPublisher';

describe('resolveCompactOwnerPublisherId', () => {
  const findFirst = jest.fn();
  const db = { findFirst } as unknown as Parameters<typeof resolveCompactOwnerPublisherId>[0];

  beforeEach(() => {
    jest.clearAllMocks();
    resetCompactOwnerPublisherCache();
    (isStudioRuntime as jest.Mock).mockReturnValue(false);
    (isDirectTotemMode as jest.Mock).mockReturnValue(false);
  });

  it('não resolve fora de Direct/Studio', async () => {
    await expect(resolveCompactOwnerPublisherId(db)).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('em Direct resolve is_system_owner', async () => {
    (isDirectTotemMode as jest.Mock).mockReturnValue(true);
    findFirst.mockResolvedValueOnce({ publisher_id: 7 });
    await expect(resolveCompactOwnerPublisherId(db)).resolves.toBe(7);
    expect(String(findFirst.mock.calls[0][0])).toMatch(/is_system_owner/i);
  });
});

describe('resolveInventoryPublisherScope', () => {
  const findFirst = jest.fn();
  const db = { findFirst } as unknown as Parameters<typeof resolveInventoryPublisherScope>[0];

  beforeEach(() => {
    jest.clearAllMocks();
    resetCompactOwnerPublisherCache();
    (isStudioRuntime as jest.Mock).mockReturnValue(false);
    (isDirectTotemMode as jest.Mock).mockReturnValue(false);
  });

  it('em Direct força owner mesmo para admin', async () => {
    (isDirectTotemMode as jest.Mock).mockReturnValue(true);
    findFirst.mockResolvedValueOnce({ publisher_id: 7 });
    await expect(resolveInventoryPublisherScope(db, 99, true)).resolves.toBe(7);
  });

  it('fora de Direct admin não tem escopo (vê todas as orgs)', async () => {
    await expect(resolveInventoryPublisherScope(db, 99, true)).resolves.toBeUndefined();
  });
});
