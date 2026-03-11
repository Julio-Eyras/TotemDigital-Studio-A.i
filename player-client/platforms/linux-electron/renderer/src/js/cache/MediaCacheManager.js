/**
 * MediaCacheManager - Linux Electron
 * Cache em {pathBase}/propagandas/{mediaId}.{ext}; resolução interno → USB
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const EXT_MAP = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp'
};

function getExtension(mimeType) {
  return EXT_MAP[mimeType] || 'bin';
}

class MediaCacheManager {
  constructor(storageHelper) {
    this.storageHelper = storageHelper;
    this.metadataPath = path.join(storageHelper.internalPathBase, 'cache', 'metadata.json');
    this.dispatchPlanPath = path.join(storageHelper.internalPathBase, 'cache', 'dispatch_plan.json');
    this._metadata = null;
  }

  async _ensureCacheDir() {
    const dir = path.dirname(this.metadataPath);
    await fs.mkdir(dir, { recursive: true });
    await this.storageHelper.ensurePropagandasDirs();
  }

  async _loadMetadata() {
    if (this._metadata) return this._metadata;
    try {
      await this._ensureCacheDir();
      const raw = await fs.readFile(this.metadataPath, 'utf8');
      this._metadata = JSON.parse(raw);
    } catch (e) {
      this._metadata = {};
    }
    return this._metadata;
  }

  async _saveMetadata() {
    await fs.mkdir(path.dirname(this.metadataPath), { recursive: true });
    await fs.writeFile(this.metadataPath, JSON.stringify(this._metadata || {}));
  }

  async processDispatchPlan(dispatchPlan, apiClient) {
    const stats = { success: 0, failed: 0, skipped: 0 };
    await this._ensureCacheDir();
    await this._loadMetadata();
    await this.storageHelper.ensurePropagandasDirs();

    await fs.writeFile(this.dispatchPlanPath, JSON.stringify(dispatchPlan));

    for (const item of dispatchPlan.mediaItems || []) {
      try {
        const mediaIdStr = String(item.mediaId);
        const ext = getExtension(item.metadata?.mimeType || '');
        const resolved = await this.storageHelper.resolveMediaPath(item.mediaId, ext);
        if (resolved) {
          const meta = this._metadata[item.mediaId];
          if (meta && item.metadata?.checksum && meta.checksum === item.metadata.checksum) {
            stats.skipped++;
            continue;
          }
        }

        await this._downloadMedia(item, apiClient, stats);
      } catch (e) {
        console.error('[MediaCacheManager] Erro ao processar mídia', item.mediaId, e);
        stats.failed++;
      }
    }

    return stats;
  }

  async _downloadMedia(mediaItem, apiClient, stats) {
    const mediaIdStr = String(mediaItem.mediaId);
    const ext = getExtension(mediaItem.metadata?.mimeType || '');
    const fileName = `${mediaIdStr}.${ext}`;
    const propDir = await this.storageHelper.getWritePropagandasDir();
    const localPath = path.join(propDir, fileName);

    let response;
    if (mediaItem.url && (mediaItem.url.startsWith('http') || mediaItem.url.startsWith('/'))) {
      response = await apiClient.downloadFromUrl(mediaItem.url);
    } else {
      response = await apiClient.downloadMedia(mediaItem.mediaId);
    }

    const buf = Buffer.from(await response.arrayBuffer());
    const checksum = crypto.createHash('sha256').update(buf).digest('hex');
    if (mediaItem.metadata?.checksum && checksum !== mediaItem.metadata.checksum) {
      throw new Error('Checksum inválido');
    }

    await fs.writeFile(localPath, buf);

    this._metadata[mediaItem.mediaId] = {
      mediaId: mediaItem.mediaId,
      url: mediaItem.url,
      localPath,
      checksum,
      size: buf.length,
      mimeType: mediaItem.metadata?.mimeType || '',
      extension: ext,
      downloadedAt: Date.now(),
      lastAccessed: Date.now(),
      valid: true
    };
    await this._saveMetadata();
    stats.success++;
  }

  async getLocalPath(mediaId) {
    await this._loadMetadata();
    const meta = this._metadata[mediaId];
    const ext = meta?.extension || null;
    return this.storageHelper.resolveMediaPath(mediaId, ext);
  }

  async loadLastDispatchPlan() {
    try {
      const raw = await fs.readFile(this.dispatchPlanPath, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  getStorageHelper() {
    return this.storageHelper;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MediaCacheManager;
} else {
  window.MediaCacheManager = MediaCacheManager;
}
