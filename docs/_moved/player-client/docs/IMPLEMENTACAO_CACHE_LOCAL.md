# Implementação de Cache Local - Guia de Implementação

## 📋 Resumo

Este documento descreve como implementar o sistema de cache local nos players clientes para garantir operação offline.

## 🎯 Objetivos

1. **Armazenar playlists localmente** para acesso rápido
2. **Baixar e armazenar mídias** para reprodução offline
3. **Sincronizar com servidor** quando online
4. **Continuar operação** mesmo sem conexão
5. **Gerenciar espaço em disco** automaticamente

## 📦 Arquivos Criados

### 1. `core/cache/mediaCache.js`
- Gerenciamento de cache de mídias
- Download em background
- Verificação de integridade
- Limpeza automática

### 2. `core/cache/playlistCache.js`
- Cache de playlists
- Versionamento
- Comparação de playlists
- Detecção de mudanças

## 🔧 Integração

### 1. Atualizar PlaylistManager

```javascript
// core/playlist/manager.js
const PlaylistCache = require('./cache/playlistCache');
const MediaCache = require('./cache/mediaCache');

class PlaylistManager {
  constructor(apiClient, storage, fileSystem) {
    this.apiClient = apiClient;
    this.playlistCache = new PlaylistCache(storage);
    this.mediaCache = new MediaCache(storage, fileSystem);
    this.currentPlaylist = null;
  }

  async loadPlaylist() {
    try {
      // Tentar obter do servidor
      const serverPlaylist = await this.apiClient.getPlaylist();
      
      // Verificar se precisa atualizar
      const needsUpdate = await this.playlistCache.needsUpdate(
        serverPlaylist.version
      );

      if (needsUpdate) {
        // Comparar playlists
        const localPlaylist = await this.playlistCache.getPlaylist();
        const diff = await this.playlistCache.comparePlaylists(
          localPlaylist,
          serverPlaylist
        );

        // Baixar novas/atualizadas mídias
        await this.syncMedia(diff);

        // Salvar playlist atualizada
        await this.playlistCache.savePlaylist(serverPlaylist);
        this.currentPlaylist = serverPlaylist;
      } else {
        // Usar cache local
        this.currentPlaylist = await this.playlistCache.getPlaylist();
      }

      // Garantir que todas as mídias estão em cache
      await this.ensureMediaCached();

      return this.currentPlaylist;
    } catch (error) {
      // Se falhar, tentar usar cache local
      console.warn('Failed to load playlist from server, using cache:', error);
      this.currentPlaylist = await this.playlistCache.getPlaylist();
      if (!this.currentPlaylist) {
        throw new Error('No playlist available (online or cached)');
      }
      return this.currentPlaylist;
    }
  }

  async syncMedia(diff) {
    // Baixar novas mídias
    for (const item of diff.newItems) {
      if (item.media) {
        await this.mediaCache.downloadMedia(item.media, this.apiClient);
      }
    }

    // Baixar mídias atualizadas
    for (const item of diff.updatedItems) {
      if (item.media) {
        await this.mediaCache.downloadMedia(item.media, this.apiClient);
      }
    }

    // Remover mídias não usadas
    const currentItems = [
      ...diff.newItems,
      ...diff.updatedItems,
      ...diff.unchangedItems
    ];
    await this.mediaCache.cleanupUnusedMedia(currentItems);
  }

  async ensureMediaCached() {
    if (!this.currentPlaylist || !this.currentPlaylist.items) {
      return;
    }

    // Verificar e baixar mídias que faltam
    for (const item of this.currentPlaylist.items) {
      if (item.media && item.media.media_id) {
        const localPath = await this.mediaCache.getLocalPath(item.media.media_id);
        if (!localPath) {
          // Baixar em background (não bloqueia)
          this.mediaCache.downloadMedia(item.media, this.apiClient)
            .catch(err => console.warn('Failed to download media:', err));
        }
      }
    }
  }

  async getMediaPath(mediaId) {
    // Primeiro tentar cache local
    const localPath = await this.mediaCache.getLocalPath(mediaId);
    if (localPath) {
      return localPath;
    }

    // Se não estiver em cache, retornar URL do servidor
    // (player tentará baixar em background)
    const mediaItem = this.currentPlaylist?.items?.find(
      item => item.media_id === mediaId
    );
    return mediaItem?.media?.url || null;
  }
}
```

### 2. Atualizar Heartbeat Service

```javascript
// core/heartbeat/service.js
class HeartbeatService {
  constructor(apiClient, playlistManager) {
    this.apiClient = apiClient;
    this.playlistManager = playlistManager;
    // ... resto do código
  }

  async sendHeartbeat() {
    try {
      const data = {
        status: 'online',
        timestamp: new Date().toISOString(),
        playlistVersion: await this.playlistManager.playlistCache.getVersion(),
        metrics: this.getSystemMetrics(),
      };

      const response = await this.apiClient.sendHeartbeat(data);
      
      // Verificar se há atualizações de playlist
      if (response.playlist) {
        await this.playlistManager.loadPlaylist();
      }

      // Processar comandos remotos
      if (response.pendingCommands && response.pendingCommands.length > 0) {
        await this.processRemoteCommands(response.pendingCommands);
      }

      this.lastHeartbeat = new Date();
      this.consecutiveFailures = 0;
    } catch (error) {
      // ... tratamento de erro
    }
  }
}
```

## 🗄️ Implementação de Storage

### Para WebOS/Tizen (IndexedDB)

```javascript
class IndexedDBStorage {
  constructor(dbName = 'smartsignage_player') {
    this.dbName = dbName;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Store para dados gerais
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data');
        }

        // Store para mídias
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' });
        }
      };
    });
  }

  async set(key, value) {
    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    return store.put(value, key);
  }

  async get(key) {
    const transaction = this.db.transaction(['data'], 'readonly');
    const store = transaction.objectStore('data');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key) {
    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    return store.delete(key);
  }

  async getAll(prefix) {
    const transaction = this.db.transaction(['data'], 'readonly');
    const store = transaction.objectStore('data');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result;
        const filtered = results.filter(item => 
          item.key && item.key.startsWith(prefix)
        );
        resolve(filtered.map(item => item.value));
      };
      request.onerror = () => reject(request.error);
    });
  }
}
```

### Para Electron (FileSystem)

```javascript
const fs = require('fs').promises;
const path = require('path');

class FileSystemStorage {
  constructor(basePath) {
    this.basePath = basePath;
  }

  async init() {
    await fs.mkdir(this.basePath, { recursive: true });
    await fs.mkdir(path.join(this.basePath, 'media'), { recursive: true });
  }

  async set(key, value) {
    const filePath = path.join(this.basePath, `${key}.json`);
    await fs.writeFile(filePath, JSON.stringify(value));
  }

  async get(key) {
    const filePath = path.join(this.basePath, `${key}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(key) {
    const filePath = path.join(this.basePath, `${key}.json`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
```

## ✅ Checklist de Implementação

- [ ] Criar `MediaCache` class
- [ ] Criar `PlaylistCache` class
- [ ] Implementar storage (IndexedDB/FileSystem)
- [ ] Integrar com `PlaylistManager`
- [ ] Atualizar `HeartbeatService`
- [ ] Implementar download em background
- [ ] Adicionar verificação de integridade
- [ ] Implementar limpeza automática
- [ ] Adicionar monitoramento de espaço
- [ ] Testar operação offline
- [ ] Testar sincronização

## 📝 Notas Importantes

1. **Espaço em Disco**: Monitorar e limpar automaticamente
2. **Integridade**: Sempre verificar checksum após download
3. **Performance**: Downloads não devem bloquear reprodução
4. **Resiliência**: Player deve funcionar mesmo com cache parcial
5. **Sincronização**: Incremental para economizar banda

