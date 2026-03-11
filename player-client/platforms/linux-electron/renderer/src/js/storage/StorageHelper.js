/**
 * StorageHelper - Linux Electron
 * Storage EXTERNO por defeito (configurável na opção administrativa).
 * Deteção de storage (interno + USB); path fixo /propagandas.
 * Por defeito: usar externo (USB) primeiro para não comprometer espaço do dispositivo.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const PROPAGANDAS_DIR = 'propagandas';
const DEFAULT_USE_EXTERNAL_FIRST = true;

/**
 * Obtém path base interno (configurável ou padrão)
 */
function getDefaultInternalPath() {
  if (process.env.STORAGE_PATH) {
    return process.env.STORAGE_PATH;
  }
  if (process.env.HOME) {
    return path.join(process.env.HOME, '.cache', 'smartsignage');
  }
  return path.join(os.tmpdir(), 'smartsignage');
}

/**
 * Lista pontos de montagem USB no Linux (/media, /mnt)
 */
async function getUsbMountPoints() {
  const roots = [];
  try {
    const content = await fs.readFile('/proc/mounts', 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      const mountPath = parts[1];
      if ((mountPath.startsWith('/media/') || mountPath.startsWith('/mnt/')) && mountPath !== '/media' && mountPath !== '/mnt') {
        try {
          await fs.access(mountPath);
          roots.push(mountPath);
        } catch (_) {}
      }
    }
  } catch (e) {
    // Fallback: verificar pastas comuns
    for (const base of ['/media', '/mnt']) {
      try {
        const entries = await fs.readdir(base, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.isDirectory()) {
            const full = path.join(base, ent.name);
            roots.push(full);
          }
        }
      } catch (_) {}
    }
  }
  return roots;
}

class StorageHelper {
  constructor(options = {}) {
    this.internalPathBase = options.pathBase || getDefaultInternalPath();
    this.usbRoots = [];
    this._init = null;
    /** Por defeito usar storage externo (configurável na opção administrativa) */
    this.useExternalFirst = options.useExternalFirst !== undefined ? options.useExternalFirst : DEFAULT_USE_EXTERNAL_FIRST;
  }

  async _ensureInit() {
    if (this._init) return this._init;
    this._init = (async () => {
      this.usbRoots = await getUsbMountPoints();
    })();
    return this._init;
  }

  /** Ordem de roots: por defeito [externo (USB) primeiro, depois interno]; senão [interno, ...usb] */
  async getStorageRoots() {
    await this._ensureInit();
    if (this.useExternalFirst && this.usbRoots.length > 0) {
      return [...this.usbRoots, this.internalPathBase];
    }
    return [this.internalPathBase, ...this.usbRoots];
  }

  getInternalPropagandasDir() {
    return path.join(this.internalPathBase, PROPAGANDAS_DIR);
  }

  async ensurePropagandasDirs() {
    const roots = await this.getStorageRoots();
    for (const root of roots) {
      const prop = path.join(root, PROPAGANDAS_DIR);
      await fs.mkdir(prop, { recursive: true });
    }
  }

  /**
   * Resolve path do ficheiro para reprodução (ordem = getStorageRoots: por defeito externo primeiro)
   */
  async resolveMediaPath(mediaId, extension) {
    const roots = await this.getStorageRoots();
    const exts = extension ? [extension] : ['mp4', 'webm', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'mov', 'bin'];
    const mediaIdStr = String(mediaId);
    for (const root of roots) {
      const propDir = path.join(root, PROPAGANDAS_DIR);
      for (const ext of exts) {
        const filePath = path.join(propDir, `${mediaIdStr}.${ext}`);
        try {
          await fs.access(filePath);
          return filePath;
        } catch (_) {}
      }
    }
    return null;
  }

  /** Path para gravar: por defeito EXTERNO (USB) quando disponível, senão interno. Configurável. */
  async getWritePropagandasDir() {
    const roots = await this.getStorageRoots();
    const first = roots[0];
    const dir = path.join(first, PROPAGANDAS_DIR);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async getFreeSpaceBytes(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) {
        dirPath = path.dirname(dirPath);
      }
      // Node não tem getFreeSpace; aproximação por stat do volume
      const statfs = await fs.stat(path.join(dirPath, '.'));
      return 0; // placeholder - em Node puro não há statvfs; pode usar 'df' ou deixar 0
    } catch (e) {
      return 0;
    }
  }

  async listPropagandasFiles(rootPath) {
    const propDir = path.join(rootPath, PROPAGANDAS_DIR);
    try {
      const entries = await fs.readdir(propDir, { withFileTypes: true });
      return entries.filter(e => e.isFile()).map(e => e.name);
    } catch (e) {
      return [];
    }
  }

  /**
   * Info para o painel Debug (mostra storage em uso e ordem)
   */
  async getDebugStorageInfo() {
    await this._ensureInit();
    const roots = await this.getStorageRoots();
    const entries = [];
    for (let i = 0; i < roots.length; i++) {
      const root = roots[i];
      const isInternal = root === this.internalPathBase;
      const label = isInternal ? 'Interno' : `Externo/USB${this.usbRoots.indexOf(root) + 1}`;
      const files = await this.listPropagandasFiles(root);
      entries.push({
        label,
        path: root,
        freeSpaceBytes: 0,
        fileCount: files.length,
        fileNames: files.slice(0, 20)
      });
    }
    const orderDesc = this.useExternalFirst && this.usbRoots.length > 0 ? 'externo → interno' : 'interno → externo';
    return {
      resolutionOrder: orderDesc,
      entries
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageHelper, PROPAGANDAS_DIR, getDefaultInternalPath };
} else {
  window.StorageHelper = StorageHelper;
  window.PROPAGANDAS_DIR = PROPAGANDAS_DIR;
}
