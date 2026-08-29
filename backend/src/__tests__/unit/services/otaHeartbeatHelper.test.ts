import { resolveOtaUpdateForHeartbeat } from '../../../services/otaHeartbeatHelper';
import { getOTAUpdateService } from '../../../services/otaUpdateService';

jest.mock('../../../services/otaUpdateService', () => ({
  getOTAUpdateService: jest.fn(),
}));

jest.mock('../../../utils/loggerHelper', () => ({
  logError: jest.fn(async () => undefined),
  logInfo: jest.fn(async () => undefined),
}));

describe('resolveOtaUpdateForHeartbeat', () => {
  const getAvailableUpdate = jest.fn();
  const updateTotemStatus = jest.fn();

  beforeEach(() => {
    getAvailableUpdate.mockReset();
    updateTotemStatus.mockReset();
    (getOTAUpdateService as jest.Mock).mockReturnValue({
      getAvailableUpdate,
      updateTotemStatus,
    });
  });

  it('ignora plataformas N/D (webos/tizen/web)', async () => {
    await expect(resolveOtaUpdateForHeartbeat(1, { platform: 'webos' })).resolves.toBeNull();
    await expect(resolveOtaUpdateForHeartbeat(1, { platform: 'tizen' })).resolves.toBeNull();
    await expect(resolveOtaUpdateForHeartbeat(1, { platform: 'web' })).resolves.toBeNull();
    expect(getAvailableUpdate).not.toHaveBeenCalled();
  });

  it('consulta OTA linux com a plataforma do heartbeat', async () => {
    getAvailableUpdate.mockResolvedValueOnce(null);
    await expect(
      resolveOtaUpdateForHeartbeat(9, { platform: 'linux', version: '0.1.0' })
    ).resolves.toBeNull();
    expect(getAvailableUpdate).toHaveBeenCalledWith(9, '0.1.0', 'linux');
  });

  it('consulta OTA android como antes', async () => {
    getAvailableUpdate.mockResolvedValueOnce({
      id: 3,
      version: '2.16.0',
      platform: 'android',
      fileSize: 10,
      checksum: 'abc',
      isMandatory: false,
    });
    const payload = await resolveOtaUpdateForHeartbeat(2, { platform: 'android', appVersion: '2.15.0' });
    expect(getAvailableUpdate).toHaveBeenCalledWith(2, '2.15.0', 'android');
    expect(payload).toMatchObject({
      id: 3,
      version: '2.16.0',
      downloadUrl: '/api/player/ota-download/3',
    });
  });
});
