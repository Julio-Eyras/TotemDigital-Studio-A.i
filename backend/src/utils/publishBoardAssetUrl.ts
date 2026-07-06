import fs from 'fs';
import path from 'path';
import { getStoragePath } from '../config/mediaConfig';
import { normalizeDownloadUrl } from './pathHelper';

/**
 * Resolve logoUrl / asset local para URL pública servida pelo Nginx.
 * Retorna string vazia se o ficheiro não existir (evita img 404 no totem).
 */
export function resolvePublishBoardAssetUrl(raw?: string): string {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;

  const publicUrl = normalizeDownloadUrl(v.startsWith('/') ? v : `/${v}`);
  if (!publicUrl) return '';

  const fsPath = publicAssetUrlToFsPath(publicUrl);
  if (fsPath && fs.existsSync(fsPath)) {
    return publicUrl;
  }
  return '';
}

function publicAssetUrlToFsPath(publicUrl: string): string | null {
  if (!publicUrl.startsWith('/assets/')) return null;
  const suffix = publicUrl.slice('/assets/'.length);
  const storage = getStoragePath();
  const assetsBase = path.dirname(storage);
  return path.join(assetsBase, suffix);
}
