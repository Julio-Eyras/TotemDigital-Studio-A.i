/**
 * FileSystem Adapter - Core
 * Adaptadores de sistema de arquivos para diferentes plataformas
 * 
 * Fornece interface unificada para:
 * - Node.js (fs/promises)
 * - Android (Java/Kotlin via JNI ou WebView)
 * - webOS/Tizen (FileSystem API)
 * - Browser (IndexedDB + Blob URLs)
 */

/**
 * Factory para criar adaptador apropriado para a plataforma
 */
function createFileSystemAdapter(platform, options = {}) {
  switch (platform) {
    case 'node':
    case 'linux':
    case 'windows':
    case 'electron':
      return new NodeFileSystemAdapter(options);
    
    case 'android':
      return new AndroidFileSystemAdapter(options);
    
    case 'webos':
      return new WebOSFileSystemAdapter(options);
    
    case 'tizen':
      return new TizenFileSystemAdapter(options);
    
    case 'browser':
    default:
      return new BrowserFileSystemAdapter(options);
  }
}

/**
 * Adaptador para Node.js (Linux, Windows, Electron)
 */
class NodeFileSystemAdapter {
  constructor(options = {}) {
    this.fs = require('fs').promises;
    this.path = require('path');
    this.baseDir = options.baseDir || './cache';
  }

  async ensureDir(dirPath) {
    const fullPath = this.path.join(this.baseDir, dirPath);
    await this.fs.mkdir(fullPath, { recursive: true });
  }

  async writeFile(filePath, data) {
    const fullPath = this.path.join(this.baseDir, filePath);
    await this.ensureDir(this.path.dirname(filePath));
    await this.fs.writeFile(fullPath, data);
  }

  async readFile(filePath) {
    const fullPath = this.path.join(this.baseDir, filePath);
    return await this.fs.readFile(fullPath);
  }

  async exists(filePath) {
    try {
      const fullPath = this.path.join(this.baseDir, filePath);
      await this.fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(filePath) {
    const fullPath = this.path.join(this.baseDir, filePath);
    await this.fs.unlink(fullPath);
  }

  async stat(filePath) {
    const fullPath = this.path.join(this.baseDir, filePath);
    return await this.fs.stat(fullPath);
  }

  async listFiles(dirPath) {
    const fullPath = this.path.join(this.baseDir, dirPath);
    const files = await this.fs.readdir(fullPath);
    return files.map(f => this.path.join(dirPath, f));
  }
}

/**
 * Adaptador para Android (via WebView ou JNI)
 */
class AndroidFileSystemAdapter {
  constructor(options = {}) {
    this.baseDir = options.baseDir || '/sdcard/SmartSignage/cache';
    this.androidBridge = options.androidBridge || null;
  }

  async ensureDir(dirPath) {
    if (this.androidBridge) {
      return await this.androidBridge.call('ensureDir', [this.getFullPath(dirPath)]);
    }
    
    // Fallback: usar FileSystem API se disponível
    if (window.requestFileSystem || window.webkitRequestFileSystem) {
      return await this._ensureDirWebView(dirPath);
    }
    
    throw new Error('Android FileSystem não disponível');
  }

  async writeFile(filePath, data) {
    if (this.androidBridge) {
      const base64 = this._bufferToBase64(data);
      return await this.androidBridge.call('writeFile', [this.getFullPath(filePath), base64]);
    }
    
    throw new Error('Android FileSystem não disponível');
  }

  async readFile(filePath) {
    if (this.androidBridge) {
      const base64 = await this.androidBridge.call('readFile', [this.getFullPath(filePath)]);
      return this._base64ToBuffer(base64);
    }
    
    throw new Error('Android FileSystem não disponível');
  }

  async exists(filePath) {
    if (this.androidBridge) {
      return await this.androidBridge.call('fileExists', [this.getFullPath(filePath)]);
    }
    
    return false;
  }

  async delete(filePath) {
    if (this.androidBridge) {
      return await this.androidBridge.call('deleteFile', [this.getFullPath(filePath)]);
    }
    
    throw new Error('Android FileSystem não disponível');
  }

  async stat(filePath) {
    if (this.androidBridge) {
      return await this.androidBridge.call('fileStat', [this.getFullPath(filePath)]);
    }
    
    throw new Error('Android FileSystem não disponível');
  }

  async listFiles(dirPath) {
    if (this.androidBridge) {
      const files = await this.androidBridge.call('listFiles', [this.getFullPath(dirPath)]);
      return files.map(f => this.path.join(dirPath, f));
    }
    
    return [];
  }

  getFullPath(relativePath) {
    const path = require('path');
    return path.join(this.baseDir, relativePath);
  }

  _bufferToBase64(buffer) {
    if (buffer instanceof Buffer) {
      return buffer.toString('base64');
    }
    if (buffer instanceof ArrayBuffer) {
      const bytes = new Uint8Array(buffer);
      return btoa(String.fromCharCode(...bytes));
    }
    return buffer;
  }

  _base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async _ensureDirWebView(dirPath) {
    return new Promise((resolve, reject) => {
      const requestFS = window.requestFileSystem || window.webkitRequestFileSystem;
      requestFS(window.PERSISTENT, 0, (fs) => {
        fs.root.getDirectory(dirPath, { create: true, exclusive: false }, resolve, reject);
      }, reject);
    });
  }
}

/**
 * Adaptador para webOS (FileSystem API)
 */
class WebOSFileSystemAdapter {
  constructor(options = {}) {
    this.baseDir = options.baseDir || '/media/developer/smartsignage/cache';
  }

  async ensureDir(dirPath) {
    return new Promise((resolve, reject) => {
      const requestFS = window.webkitRequestFileSystem || window.requestFileSystem;
      if (!requestFS) {
        reject(new Error('FileSystem API não disponível no webOS'));
        return;
      }

      requestFS(window.PERSISTENT, 0, (fs) => {
        const parts = dirPath.split('/').filter(p => p);
        let currentDir = fs.root;

        const createDir = (index) => {
          if (index >= parts.length) {
            resolve();
            return;
          }

          currentDir.getDirectory(parts[index], { create: true, exclusive: false }, (dir) => {
            currentDir = dir;
            createDir(index + 1);
          }, reject);
        };

        createDir(0);
      }, reject);
    });
  }

  async writeFile(filePath, data) {
    return new Promise((resolve, reject) => {
      const requestFS = window.webkitRequestFileSystem || window.requestFileSystem;
      if (!requestFS) {
        reject(new Error('FileSystem API não disponível'));
        return;
      }

      requestFS(window.PERSISTENT, 0, (fs) => {
        const parts = filePath.split('/').filter(p => p);
        const fileName = parts.pop();
        const dirPath = parts.join('/');

        const getDir = (path) => {
          if (!path) return Promise.resolve(fs.root);
          return new Promise((res, rej) => {
            fs.root.getDirectory(path, { create: true }, res, rej);
          });
        };

        getDir(dirPath).then((dir) => {
          dir.getFile(fileName, { create: true, exclusive: false }, (fileEntry) => {
            fileEntry.createWriter((writer) => {
              const blob = data instanceof Blob ? data : new Blob([data]);
              writer.write(blob);
              writer.onwriteend = resolve;
              writer.onerror = reject;
            }, reject);
          }, reject);
        }, reject);
      }, reject);
    });
  }

  async readFile(filePath) {
    return new Promise((resolve, reject) => {
      const requestFS = window.webkitRequestFileSystem || window.requestFileSystem;
      if (!requestFS) {
        reject(new Error('FileSystem API não disponível'));
        return;
      }

      requestFS(window.PERSISTENT, 0, (fs) => {
        fs.root.getFile(filePath, {}, (fileEntry) => {
          fileEntry.file((file) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          }, reject);
        }, reject);
      }, reject);
    });
  }

  async exists(filePath) {
    return new Promise((resolve) => {
      const requestFS = window.webkitRequestFileSystem || window.requestFileSystem;
      if (!requestFS) {
        resolve(false);
        return;
      }

      requestFS(window.PERSISTENT, 0, (fs) => {
        fs.root.getFile(filePath, {}, () => resolve(true), () => resolve(false));
      }, () => resolve(false));
    });
  }

  async delete(filePath) {
    return new Promise((resolve, reject) => {
      const requestFS = window.webkitRequestFileSystem || window.requestFileSystem;
      if (!requestFS) {
        reject(new Error('FileSystem API não disponível'));
        return;
      }

      requestFS(window.PERSISTENT, 0, (fs) => {
        fs.root.getFile(filePath, {}, (fileEntry) => {
          fileEntry.remove(resolve, reject);
        }, reject);
      }, reject);
    });
  }

  async stat(filePath) {
    return new Promise((resolve, reject) => {
      const requestFS = window.webkitRequestFileSystem || window.requestFileSystem;
      if (!requestFS) {
        reject(new Error('FileSystem API não disponível'));
        return;
      }

      requestFS(window.PERSISTENT, 0, (fs) => {
        fs.root.getFile(filePath, {}, (fileEntry) => {
          fileEntry.file((file) => {
            resolve({
              size: file.size,
              lastModified: file.lastModified
            });
          }, reject);
        }, reject);
      }, reject);
    });
  }

  async listFiles(dirPath) {
    return new Promise((resolve, reject) => {
      const requestFS = window.webkitRequestFileSystem || window.requestFileSystem;
      if (!requestFS) {
        reject(new Error('FileSystem API não disponível'));
        return;
      }

      requestFS(window.PERSISTENT, 0, (fs) => {
        const getDir = (path) => {
          if (!path) return Promise.resolve(fs.root);
          return new Promise((res, rej) => {
            fs.root.getDirectory(path, {}, res, rej);
          });
        };

        getDir(dirPath).then((dir) => {
          const reader = dir.createReader();
          const files = [];

          const readEntries = () => {
            reader.readEntries((entries) => {
              if (entries.length === 0) {
                resolve(files.map(e => e.fullPath));
                return;
              }

              files.push(...entries);
              readEntries();
            }, reject);
          };

          readEntries();
        }, reject);
      }, reject);
    });
  }
}

/**
 * Adaptador para Tizen (similar ao webOS)
 */
class TizenFileSystemAdapter extends WebOSFileSystemAdapter {
  constructor(options = {}) {
    super(options);
    this.baseDir = options.baseDir || '/home/owner/smartsignage/cache';
  }
}

/**
 * Adaptador para Browser (IndexedDB + Blob URLs)
 */
class BrowserFileSystemAdapter {
  constructor(options = {}) {
    this.dbName = options.dbName || 'smartsignage_cache';
    this.dbVersion = 1;
    this.db = null;
  }

  async _initDB() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'path' });
        }
      };
    });
  }

  async ensureDir(dirPath) {
    // No browser, diretórios são virtuais
    await this._initDB();
    return Promise.resolve();
  }

  async writeFile(filePath, data) {
    await this._initDB();
    const blob = data instanceof Blob ? data : new Blob([data]);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put({
        path: filePath,
        blob: blob,
        size: blob.size,
        lastModified: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async readFile(filePath) {
    await this._initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(filePath);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.blob) {
          resolve(result.blob);
        } else {
          reject(new Error('File not found'));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async exists(filePath) {
    await this._initDB();

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(filePath);

      request.onsuccess = () => {
        resolve(!!request.result);
      };

      request.onerror = () => resolve(false);
    });
  }

  async delete(filePath) {
    await this._initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(filePath);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async stat(filePath) {
    await this._initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(filePath);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({
            size: result.size,
            lastModified: result.lastModified
          });
        } else {
          reject(new Error('File not found'));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async listFiles(dirPath) {
    await this._initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result
          .filter(f => f.path.startsWith(dirPath))
          .map(f => f.path);
        resolve(files);
      };

      request.onerror = () => reject(request.error);
    });
  }
}

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createFileSystemAdapter,
    NodeFileSystemAdapter,
    AndroidFileSystemAdapter,
    WebOSFileSystemAdapter,
    TizenFileSystemAdapter,
    BrowserFileSystemAdapter
  };
} else {
  window.FileSystemAdapter = {
    create: createFileSystemAdapter,
    Node: NodeFileSystemAdapter,
    Android: AndroidFileSystemAdapter,
    WebOS: WebOSFileSystemAdapter,
    Tizen: TizenFileSystemAdapter,
    Browser: BrowserFileSystemAdapter
  };
}
