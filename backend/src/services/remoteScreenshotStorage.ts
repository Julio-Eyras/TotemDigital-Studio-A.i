/**
 * Persistência de screenshots remotos no disco do servidor.
 */
import fs from 'fs';
import path from 'path';
import { logError, logInfo } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

function resolveScreenshotsRoot(): string {
  try {
    const { getStoragePath } = require('../config/mediaConfig');
    const storagePath = String(getStoragePath() || '');
    const base = storagePath.replace(/\/uploads\/?$/, '') || '/opt/smart-signage/public/assets';
    return path.join(base, 'remote-screenshots');
  } catch {
    return path.join('/opt/smart-signage/public/assets', 'remote-screenshots');
  }
}

export async function saveRemoteScreenshotFile(options: {
  totemId: number;
  commandId?: number | null;
  buffer: Buffer;
  format?: string;
}): Promise<{ filePath: string; fileSize: number; format: string }> {
  const format = (options.format || 'jpg').replace(/^\./, '').toLowerCase() || 'jpg';
  const root = resolveScreenshotsRoot();
  const dir = path.join(root, `totem-${options.totemId}`);
  await fs.promises.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const cmd = options.commandId != null ? `cmd${options.commandId}-` : '';
  const filePath = path.join(dir, `${cmd}${stamp}.${format}`);
  await fs.promises.writeFile(filePath, options.buffer);
  await logInfo('Screenshot remoto gravado no servidor', {
    totemId: options.totemId,
    commandId: options.commandId,
    filePath,
    fileSize: options.buffer.length,
  });
  return { filePath, fileSize: options.buffer.length, format };
}

export function decodeScreenshotPayload(result: unknown): {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
} | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  const b64 =
    r.imageBase64 ||
    r.image_base64 ||
    r.screenshotBase64 ||
    r.data;
  if (typeof b64 !== 'string' || b64.length < 32) return null;
  const cleaned = b64.replace(/^data:image\/\w+;base64,/, '');
  try {
    const buffer = Buffer.from(cleaned, 'base64');
    if (buffer.length < 64) return null;
    const format = String(r.format || 'jpg').toLowerCase();
    return {
      buffer,
      format: format === 'jpeg' ? 'jpg' : format,
      width: Number(r.width) || 0,
      height: Number(r.height) || 0,
    };
} catch (rawErr: unknown) {
    const e = normalizeError(rawErr);
    void logError('Falha ao decodificar imageBase64 do screenshot', e.error);
    return null;
  }
}
