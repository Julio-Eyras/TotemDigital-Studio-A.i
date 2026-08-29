import { getOTAUpdateService } from './otaUpdateService';
import { logError } from '../utils/loggerHelper';

export interface HeartbeatOtaPayload {
  id: number;
  version: string;
  platform: string;
  fileSize: number;
  checksum: string;
  description?: string;
  changelog?: string;
  isMandatory: boolean;
  downloadUrl: string;
}

/** OTA no heartbeat: Player-AD (`android`) e Player-Linux (`linux`). Smart TV / web = N/D. */
export async function resolveOtaUpdateForHeartbeat(
  totemId: number,
  body?: Record<string, unknown>
): Promise<HeartbeatOtaPayload | null> {
  const platform = String(body?.platform || 'android').toLowerCase();
  if (platform !== 'android' && platform !== 'linux') {
    return null;
  }

  const currentVersion = String(body?.version || body?.appVersion || '1.0.0');

  try {
    const otaService = getOTAUpdateService();
    const otaUpdate = await otaService.getAvailableUpdate(totemId, currentVersion, platform);

    if (otaUpdate) {
      await otaService.updateTotemStatus(totemId, {
        totemId,
        currentVersion,
        availableVersion: otaUpdate.version,
        updateStatus: 'update_available',
        lastCheck: new Date(),
      });
      return {
        id: otaUpdate.id,
        version: otaUpdate.version,
        platform: otaUpdate.platform,
        fileSize: otaUpdate.fileSize,
        checksum: otaUpdate.checksum,
        description: otaUpdate.description,
        changelog: otaUpdate.changelog,
        isMandatory: otaUpdate.isMandatory,
        downloadUrl: `/api/player/ota-download/${otaUpdate.id}`,
      };
    }

    await otaService.updateTotemStatus(totemId, {
      totemId,
      currentVersion,
      updateStatus: 'up_to_date',
      lastCheck: new Date(),
    });
    return null;
  } catch (error: any) {
    await logError('Erro ao verificar OTA no heartbeat', error, { totemId });
    return null;
  }
}
