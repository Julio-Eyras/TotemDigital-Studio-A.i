/**
 * StorageHelper - Tizen
 * Storage EXTERNO por defeito (configurável na opção administrativa).
 * Path fixo .../propagandas; interno + externo (removable) quando disponível.
 * Ref.: DESIGN_PLAYER_PLATAFORMAS_STORAGE_E_DOWNLOAD.md secção 3.3
 * Paths relativos ao virtual root 'documents' (Tizen FileSystem API).
 */

const PROPAGANDAS_DIR = 'propagandas';
const DEFAULT_USE_EXTERNAL_FIRST = true;

/** Path base interno (relativo a documents) */
const DEFAULT_INTERNAL_BASE = 'smartsignage';
/** Path base externo (removable/USB) quando disponível */
const DEFAULT_EXTERNAL_BASE = 'removable/smartsignage';

class StorageHelper {
  constructor(options = {}) {
    this.internalPathBase = options.pathBase || options.internalPathBase || DEFAULT_INTERNAL_BASE;
    this.externalPathBase = options.externalPathBase || DEFAULT_EXTERNAL_BASE;
    this.useExternalFirst = options.useExternalFirst !== undefined ? options.useExternalFirst : DEFAULT_USE_EXTERNAL_FIRST;
    this._externalAvailable = null;
  }

  async _checkExternalAvailable() {
    if (this._externalAvailable !== null) return this._externalAvailable;
    try {
      if (typeof tizen !== 'undefined' && tizen.filesystem) {
        try {
          const root = tizen.filesystem.resolve('removable');
          this._externalAvailable = !!root;
        } catch (e) {
          this._externalAvailable = false;
        }
      } else {
        this._externalAvailable = false;
      }
    } catch (e) {
      this._externalAvailable = false;
    }
    return this._externalAvailable;
  }

  async getStorageRoots() {
    const extAvailable = await this._checkExternalAvailable();
    if (this.useExternalFirst && extAvailable) {
      return [this.externalPathBase, this.internalPathBase];
    }
    return [this.internalPathBase, this.externalPathBase].filter((p, i) => p === this.internalPathBase || extAvailable);
  }

  getInternalPropagandasDir() {
    return `${this.internalPathBase}/${PROPAGANDAS_DIR}`;
  }

  /**
   * Garante que a pasta propagandas existe em todos os roots. Chamar ao arranque do player.
   */
  async ensurePropagandasDirs() {
    const roots = await this.getStorageRoots();
    for (const root of roots) {
      await this._ensureDirRecursive(root);
      await this._ensureDirRecursive(`${root}/${PROPAGANDAS_DIR}`);
    }
  }

  _ensureDirRecursive(relativePath) {
    if (typeof tizen === 'undefined' || !tizen.filesystem) return Promise.resolve();
    try {
      const documentsDir = tizen.filesystem.resolve('documents');
      const parts = relativePath.split('/').filter(Boolean);
      let current = documentsDir;
      for (const name of parts) {
        try {
          const next = current.resolve(name);
          if (next.exists() && next.isDirectory) {
            current = next;
          } else {
            current.createDirectory(name);
            current = current.resolve(name);
          }
        } catch (e) {
          try {
            current.createDirectory(name);
          } catch (_) {}
          try {
            current = current.resolve(name);
          } catch (_) {
            break;
          }
        }
      }
    } catch (e) {
      console.warn('[StorageHelper] ensurePropagandasDirs:', e);
    }
    return Promise.resolve();
  }

  async getWritePropagandasDir() {
    const roots = await this.getStorageRoots();
    const first = roots[0];
    return `${first}/${PROPAGANDAS_DIR}`;
  }

  async _fileExists(relativePath) {
    if (typeof tizen === 'undefined' || !tizen.filesystem) return false;
    try {
      const documentsDir = tizen.filesystem.resolve('documents');
      const file = documentsDir.resolve(relativePath);
      return file.exists();
    } catch (e) {
      return false;
    }
  }

  async resolveMediaPath(mediaId, extension) {
    const roots = await this.getStorageRoots();
    const exts = extension ? [extension] : ['mp4', 'webm', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mov', 'bin'];
    const mediaIdStr = String(mediaId);
    for (const root of roots) {
      const propDir = `${root}/${PROPAGANDAS_DIR}`;
      for (const ext of exts) {
        const relativePath = `${propDir}/${mediaIdStr}.${ext}`;
        const exists = await this._fileExists(relativePath);
        if (exists) return relativePath;
      }
    }
    return null;
  }

  async getDebugStorageInfo() {
    const extAvailable = await this._checkExternalAvailable();
    const roots = await this.getStorageRoots();
    const entries = roots.map((root, i) => ({
      label: root === this.internalPathBase ? 'Interno' : 'Externo/USB',
      path: root,
      freeSpaceBytes: 0,
      fileCount: 0,
      fileNames: []
    }));
    const orderDesc = this.useExternalFirst && extAvailable ? 'externo → interno' : 'interno → externo';
    return { resolutionOrder: orderDesc, entries };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageHelper, PROPAGANDAS_DIR };
} else {
  window.StorageHelper = StorageHelper;
  window.PROPAGANDAS_DIR = PROPAGANDAS_DIR;
}
