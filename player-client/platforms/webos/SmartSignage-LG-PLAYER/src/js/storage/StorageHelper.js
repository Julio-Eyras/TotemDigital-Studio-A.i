/**
 * StorageHelper - webOS
 * Storage EXTERNO por defeito (configurável na opção administrativa).
 * Path fixo /propagandas; interno + externo (quando disponível).
 * Por defeito: usar externo primeiro para não comprometer espaço do dispositivo.
 * Ref.: DESIGN_PLAYER_PLATAFORMAS_STORAGE_E_DOWNLOAD.md secção 3.3
 */

const PROPAGANDAS_DIR = 'propagandas';
const DEFAULT_USE_EXTERNAL_FIRST = true;

/** Path base interno típico webOS (app sandbox) */
const DEFAULT_INTERNAL_BASE = '/media/internal/smartsignage';
/** Path base externo (USB) quando montado */
const DEFAULT_EXTERNAL_BASE = '/media/external/smartsignage';

class StorageHelper {
  constructor(options = {}) {
    this.internalPathBase = options.pathBase || options.internalPathBase || DEFAULT_INTERNAL_BASE;
    this.externalPathBase = options.externalPathBase || DEFAULT_EXTERNAL_BASE;
    this.useExternalFirst = options.useExternalFirst !== undefined ? options.useExternalFirst : DEFAULT_USE_EXTERNAL_FIRST;
    this._externalAvailable = null;
  }

  /**
   * Verifica se o storage externo está disponível (webOS FileSystem)
   */
  async _checkExternalAvailable() {
    if (this._externalAvailable !== null) return this._externalAvailable;
    try {
      if (typeof webOS !== 'undefined' && webOS.service && webOS.service.request) {
        const exists = await new Promise((resolve) => {
          webOS.service.request('luna://com.webos.service.file', {
            method: 'exists',
            params: { path: this.externalPathBase },
            onSuccess: (r) => resolve(r.exists === true),
            onFailure: () => resolve(false)
          });
        });
        this._externalAvailable = exists;
      } else {
        this._externalAvailable = false;
      }
    } catch (e) {
      this._externalAvailable = false;
    }
    return this._externalAvailable;
  }

  /**
   * Ordem de roots: por defeito [externo primeiro, depois interno]; senão [interno, externo].
   */
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

  getExternalPropagandasDir() {
    return `${this.externalPathBase}/${PROPAGANDAS_DIR}`;
  }

  /**
   * Garante que a pasta propagandas existe em todos os roots. Chamar ao arranque do player.
   */
  async ensurePropagandasDirs() {
    const roots = await this.getStorageRoots();
    for (const root of roots) {
      await this._ensureDir(root);
      await this._ensureDir(`${root}/${PROPAGANDAS_DIR}`);
    }
  }

  _ensureDir(dirPath) {
    return new Promise((resolve) => {
      if (typeof webOS === 'undefined' || !webOS.service || !webOS.service.request) {
        resolve();
        return;
      }
      webOS.service.request('luna://com.webos.service.file', {
        method: 'makeDir',
        params: { path: dirPath },
        onSuccess: () => resolve(),
        onFailure: () => {
          webOS.service.request('luna://com.webos.service.file', {
            method: 'write',
            params: { path: dirPath + '/.keep', data: '', mode: 'w' },
            onSuccess: () => resolve(),
            onFailure: () => resolve()
          });
        }
      });
    });
  }

  /**
   * Path para gravar: por defeito EXTERNO quando disponível, senão interno.
   */
  async getWritePropagandasDir() {
    const roots = await this.getStorageRoots();
    const first = roots[0];
    return `${first}/${PROPAGANDAS_DIR}`;
  }

  /**
   * Resolve path do ficheiro para reprodução (ordem = getStorageRoots).
   */
  async resolveMediaPath(mediaId, extension) {
    const roots = await this.getStorageRoots();
    const exts = extension ? [extension] : ['mp4', 'webm', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mov', 'bin'];
    const mediaIdStr = String(mediaId);
    for (const root of roots) {
      const propDir = `${root}/${PROPAGANDAS_DIR}`;
      for (const ext of exts) {
        const filePath = `${propDir}/${mediaIdStr}.${ext}`;
        const exists = await this._fileExists(filePath);
        if (exists) return filePath;
      }
    }
    return null;
  }

  _fileExists(path) {
    return new Promise((resolve) => {
      if (typeof webOS === 'undefined' || !webOS.service || !webOS.service.request) {
        resolve(false);
        return;
      }
      webOS.service.request('luna://com.webos.service.file', {
        method: 'exists',
        params: { path: path },
        onSuccess: (r) => resolve(r.exists === true),
        onFailure: () => resolve(false)
      });
    });
  }

  /**
   * Info para o painel Debug (storage em uso, ordem).
   */
  async getDebugStorageInfo() {
    const extAvailable = await this._checkExternalAvailable();
    const roots = await this.getStorageRoots();
    const entries = [];
    for (let i = 0; i < roots.length; i++) {
      const root = roots[i];
      const label = root === this.internalPathBase ? 'Interno' : 'Externo/USB';
      entries.push({
        label,
        path: root,
        freeSpaceBytes: 0,
        fileCount: 0,
        fileNames: []
      });
    }
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
