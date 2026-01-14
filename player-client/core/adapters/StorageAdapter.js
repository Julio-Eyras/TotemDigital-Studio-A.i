/**
 * Storage Adapter - Core
 * Adaptadores de armazenamento para metadados em diferentes plataformas
 * 
 * Fornece interface unificada para:
 * - localStorage (browser, webOS, Tizen)
 * - IndexedDB (browser, webOS, Tizen)
 * - FileSystem (Node.js, Android)
 * - SharedPreferences (Android via bridge)
 */

/**
 * Factory para criar adaptador apropriado para a plataforma
 */
function createStorageAdapter(platform, options = {}) {
  switch (platform) {
    case 'node':
    case 'linux':
    case 'windows':
    case 'electron':
      return new FileStorageAdapter(options);
    
    case 'android':
      return new AndroidStorageAdapter(options);
    
    case 'webos':
    case 'tizen':
    case 'browser':
    default:
      return new LocalStorageAdapter(options);
  }
}

/**
 * Adaptador usando localStorage (browser, webOS, Tizen)
 */
class LocalStorageAdapter {
  constructor(options = {}) {
    this.prefix = options.prefix || 'smartsignage_';
    this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    
    if (!this.storage) {
      console.warn('[StorageAdapter] localStorage não disponível, usando memória');
      this.storage = new Map();
      this.isMemory = true;
    } else {
      this.isMemory = false;
    }
  }

  async get(key) {
    const fullKey = this.prefix + key;
    
    if (this.isMemory) {
      return this.storage.get(fullKey) || null;
    }

    try {
      const value = this.storage.getItem(fullKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[StorageAdapter] Erro ao ler ${key}:`, error);
      return null;
    }
  }

  async set(key, value) {
    const fullKey = this.prefix + key;
    
    if (this.isMemory) {
      this.storage.set(fullKey, value);
      return;
    }

    try {
      this.storage.setItem(fullKey, JSON.stringify(value));
    } catch (error) {
      // Pode falhar se storage estiver cheio
      console.error(`[StorageAdapter] Erro ao salvar ${key}:`, error);
      throw error;
    }
  }

  async delete(key) {
    const fullKey = this.prefix + key;
    
    if (this.isMemory) {
      this.storage.delete(fullKey);
      return;
    }

    try {
      this.storage.removeItem(fullKey);
    } catch (error) {
      console.error(`[StorageAdapter] Erro ao deletar ${key}:`, error);
    }
  }

  async getAll(prefix = '') {
    const fullPrefix = this.prefix + prefix;
    const result = {};

    if (this.isMemory) {
      for (const [key, value] of this.storage.entries()) {
        if (key.startsWith(fullPrefix)) {
          const shortKey = key.replace(fullPrefix, '');
          result[shortKey] = value;
        }
      }
      return result;
    }

    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(fullPrefix)) {
          const shortKey = key.replace(fullPrefix, '');
          const value = this.storage.getItem(key);
          if (value) {
            try {
              result[shortKey] = JSON.parse(value);
            } catch {
              // Ignorar valores inválidos
            }
          }
        }
      }
    } catch (error) {
      console.error('[StorageAdapter] Erro ao listar:', error);
    }

    return result;
  }

  async clear(prefix = '') {
    const fullPrefix = this.prefix + prefix;
    const keysToDelete = [];

    if (this.isMemory) {
      for (const key of this.storage.keys()) {
        if (key.startsWith(fullPrefix)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.storage.delete(key));
      return;
    }

    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(fullPrefix)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.storage.removeItem(key));
    } catch (error) {
      console.error('[StorageAdapter] Erro ao limpar:', error);
    }
  }
}

/**
 * Adaptador usando arquivo JSON (Node.js, Electron)
 */
class FileStorageAdapter {
  constructor(options = {}) {
    this.fs = require('fs').promises;
    this.path = require('path');
    this.storageFile = options.storageFile || './cache/metadata.json';
    this.cache = null;
  }

  async _loadCache() {
    if (this.cache !== null) {
      return this.cache;
    }

    try {
      const data = await this.fs.readFile(this.storageFile, 'utf8');
      this.cache = JSON.parse(data);
    } catch (error) {
      // Arquivo não existe, criar novo
      this.cache = {};
    }

    return this.cache;
  }

  async _saveCache() {
    try {
      const dir = this.path.dirname(this.storageFile);
      await this.fs.mkdir(dir, { recursive: true });
      await this.fs.writeFile(this.storageFile, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.error('[StorageAdapter] Erro ao salvar cache:', error);
      throw error;
    }
  }

  async get(key) {
    const cache = await this._loadCache();
    return cache[key] || null;
  }

  async set(key, value) {
    const cache = await this._loadCache();
    cache[key] = value;
    await this._saveCache();
  }

  async delete(key) {
    const cache = await this._loadCache();
    delete cache[key];
    await this._saveCache();
  }

  async getAll(prefix = '') {
    const cache = await this._loadCache();
    const result = {};

    for (const key in cache) {
      if (key.startsWith(prefix)) {
        const shortKey = key.replace(prefix, '');
        result[shortKey] = cache[key];
      }
    }

    return result;
  }

  async clear(prefix = '') {
    const cache = await this._loadCache();
    const keysToDelete = Object.keys(cache).filter(key => key.startsWith(prefix));
    keysToDelete.forEach(key => delete cache[key]);
    await this._saveCache();
  }
}

/**
 * Adaptador para Android (via SharedPreferences bridge)
 */
class AndroidStorageAdapter {
  constructor(options = {}) {
    this.androidBridge = options.androidBridge || null;
    this.prefix = options.prefix || 'smartsignage_';
    
    // Fallback para localStorage se bridge não disponível
    if (!this.androidBridge && typeof localStorage !== 'undefined') {
      this.fallback = new LocalStorageAdapter(options);
    }
  }

  async get(key) {
    if (this.androidBridge) {
      try {
        const value = await this.androidBridge.call('getPreference', [this.prefix + key]);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.error(`[StorageAdapter] Erro ao ler ${key}:`, error);
        return null;
      }
    }

    if (this.fallback) {
      return await this.fallback.get(key);
    }

    return null;
  }

  async set(key, value) {
    if (this.androidBridge) {
      try {
        await this.androidBridge.call('setPreference', [this.prefix + key, JSON.stringify(value)]);
        return;
      } catch (error) {
        console.error(`[StorageAdapter] Erro ao salvar ${key}:`, error);
        throw error;
      }
    }

    if (this.fallback) {
      return await this.fallback.set(key, value);
    }

    throw new Error('Android Storage não disponível');
  }

  async delete(key) {
    if (this.androidBridge) {
      try {
        await this.androidBridge.call('removePreference', [this.prefix + key]);
        return;
      } catch (error) {
        console.error(`[StorageAdapter] Erro ao deletar ${key}:`, error);
      }
    }

    if (this.fallback) {
      return await this.fallback.delete(key);
    }
  }

  async getAll(prefix = '') {
    if (this.androidBridge) {
      try {
        const all = await this.androidBridge.call('getAllPreferences', [this.prefix + prefix]);
        const result = {};
        for (const [key, value] of Object.entries(all)) {
          const shortKey = key.replace(this.prefix + prefix, '');
          result[shortKey] = JSON.parse(value);
        }
        return result;
      } catch (error) {
        console.error('[StorageAdapter] Erro ao listar:', error);
        return {};
      }
    }

    if (this.fallback) {
      return await this.fallback.getAll(prefix);
    }

    return {};
  }

  async clear(prefix = '') {
    if (this.androidBridge) {
      try {
        await this.androidBridge.call('clearPreferences', [this.prefix + prefix]);
        return;
      } catch (error) {
        console.error('[StorageAdapter] Erro ao limpar:', error);
      }
    }

    if (this.fallback) {
      return await this.fallback.clear(prefix);
    }
  }
}

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createStorageAdapter,
    LocalStorageAdapter,
    FileStorageAdapter,
    AndroidStorageAdapter
  };
} else {
  window.StorageAdapter = {
    create: createStorageAdapter,
    LocalStorage: LocalStorageAdapter,
    File: FileStorageAdapter,
    Android: AndroidStorageAdapter
  };
}
