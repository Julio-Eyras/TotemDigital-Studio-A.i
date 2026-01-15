# Arquitetura de Comunicação e Sincronização - Player Client

## 📋 Visão Geral

Este documento descreve como funciona a comunicação entre o servidor (backend) e o Player Client, incluindo o armazenamento local de mídias e playlists para garantir operação offline.

## 🔄 Fluxo de Comunicação

### 1. Inicialização e Autenticação

```
┌─────────────┐                    ┌──────────────┐
│ Player      │                    │   Backend    │
│ Client      │                    │              │
└──────┬──────┘                    └──────┬───────┘
       │                                 │
       │ 1. POST /api/player/register   │
       │    { uin: "TOTEM_UIN" }        │
       ├────────────────────────────────>│
       │                                 │
       │ 2. Response:                   │
       │    { token, refreshToken,      │
       │      totem: {...},              │
       │      playlist: {...},           │
       │      pendingCommands: [...] }   │
       │<────────────────────────────────┤
       │                                 │
       │ 3. Salvar token e config       │
       │    no localStorage/IndexedDB    │
       │                                 │
```

**O que acontece:**
- Player envia UIN para autenticação
- Backend valida e retorna:
  - Token JWT para autenticação
  - Dados do totem
  - **Playlist completa** (estrutura + metadados)
  - **Comandos remotos pendentes**
  - Configurações do player

### 2. Sincronização de Playlist e Mídias

```
┌─────────────┐                    ┌──────────────┐
│ Player      │                    │   Backend    │
│ Client      │                    │              │
└──────┬──────┘                    └──────┬───────┘
       │                                 │
       │ 1. POST /api/player/heartbeat   │
       │    { status, metrics, ... }     │
       ├────────────────────────────────>│
       │                                 │
       │ 2. Response:                   │
       │    {                            │
       │      playlist: {                │
       │        id, version,              │
       │        items: [...]             │
       │      },                          │
       │      pendingCommands: [...],    │
       │      mediaUpdates: [...]       │
       │    }                             │
       │<────────────────────────────────┤
       │                                 │
       │ 3. Comparar versão da playlist │
       │    Se diferente:                │
       │    - Baixar novas mídias        │
       │    - Remover mídias antigas     │
       │    - Atualizar cache local      │
       │                                 │
```

**Estratégia de Sincronização:**

1. **Versionamento de Playlist**
   - Cada playlist tem um `version` (timestamp ou hash)
   - Player compara versão local vs servidor
   - Só sincroniza se houver mudanças

2. **Download de Mídias**
   - Player identifica mídias novas/atualizadas
   - Baixa mídias em background (não bloqueia reprodução)
   - Armazena em cache local com metadados

3. **Limpeza Automática**
   - Remove mídias não mais usadas
   - Mantém apenas mídias da playlist atual
   - Respeita limite de espaço em disco

## 💾 Armazenamento Local

### Estrutura de Dados

```
Player Client Storage:
├── IndexedDB (ou localStorage/FileSystem)
│   ├── config/
│   │   ├── totem.json          # Configuração do totem
│   │   ├── player.json         # Configurações do player
│   │   └── auth.json           # Tokens de autenticação
│   │
│   ├── playlists/
│   │   ├── current.json        # Playlist atual
│   │   ├── version.txt         # Versão da playlist
│   │   └── metadata.json       # Metadados (última atualização, etc)
│   │
│   └── media/
│       ├── metadata/
│       │   ├── {mediaId}.json  # Metadados de cada mídia
│       │   └── index.json      # Índice de todas as mídias
│       │
│       └── files/
│           ├── {mediaId}.mp4   # Arquivos de mídia
│           ├── {mediaId}.jpg
│           └── ...
│
└── Cache/
    └── temp/                    # Arquivos temporários durante download
```

### Implementação de Cache

#### 1. Cache de Playlist

```javascript
class PlaylistCache {
  constructor(storage) {
    this.storage = storage; // IndexedDB ou localStorage
  }

  async savePlaylist(playlist) {
    await this.storage.set('playlist', {
      data: playlist,
      version: playlist.version || Date.now(),
      timestamp: new Date().toISOString(),
      checksum: this.calculateChecksum(playlist)
    });
  }

  async getPlaylist() {
    return await this.storage.get('playlist');
  }

  async needsUpdate(serverVersion) {
    const local = await this.getPlaylist();
    if (!local) return true;
    return local.version !== serverVersion;
  }

  calculateChecksum(playlist) {
    // Hash simples para detectar mudanças
    return btoa(JSON.stringify(playlist)).substring(0, 32);
  }
}
```

#### 2. Cache de Mídias

```javascript
class MediaCache {
  constructor(storage, fileSystem) {
    this.storage = storage;
    this.fileSystem = fileSystem; // FileSystem API ou similar
    this.maxCacheSize = 5 * 1024 * 1024 * 1024; // 5GB padrão
  }

  async downloadMedia(mediaItem) {
    const { id, url, size, mimeType } = mediaItem;
    
    // Verificar se já existe
    const existing = await this.getMedia(id);
    if (existing && existing.version === mediaItem.version) {
      return existing.localPath;
    }

    // Baixar em background
    const localPath = await this.fileSystem.download(url, `media/${id}`);
    
    // Salvar metadados
    await this.storage.set(`media:${id}`, {
      id,
      localPath,
      url,
      size,
      mimeType,
      version: mediaItem.version,
      downloadedAt: new Date().toISOString(),
      checksum: mediaItem.checksum
    });

    // Atualizar índice
    await this.updateIndex(id, { localPath, size });

    return localPath;
  }

  async getMedia(mediaId) {
    return await this.storage.get(`media:${mediaId}`);
  }

  async cleanupUnusedMedia(currentPlaylistItems) {
    const allMedia = await this.storage.getAll('media:');
    const usedIds = new Set(currentPlaylistItems.map(item => item.media_id));
    
    for (const media of allMedia) {
      if (!usedIds.has(media.id)) {
        // Remover arquivo
        await this.fileSystem.delete(media.localPath);
        // Remover metadados
        await this.storage.delete(`media:${media.id}`);
      }
    }
  }

  async getCacheSize() {
    const allMedia = await this.storage.getAll('media:');
    return allMedia.reduce((sum, media) => sum + (media.size || 0), 0);
  }
}
```

## 🔌 Operação Offline

### Modo Offline

Quando o player perde comunicação com o servidor:

1. **Detecção de Offline**
   ```javascript
   class ConnectionMonitor {
     constructor(heartbeatService) {
       this.heartbeatService = heartbeatService;
       this.isOnline = true;
       this.offlineSince = null;
     }

     checkConnection() {
       const lastHeartbeat = this.heartbeatService.lastHeartbeat;
       if (!lastHeartbeat) {
         this.setOffline();
         return;
       }

       const now = Date.now();
       const timeSinceLastHeartbeat = now - lastHeartbeat.getTime();
       
       // Considera offline se não recebeu heartbeat em 2 minutos
       if (timeSinceLastHeartbeat > 120000) {
         this.setOffline();
       } else {
         this.setOnline();
       }
     }

     setOffline() {
       if (this.isOnline) {
         this.isOnline = false;
         this.offlineSince = new Date();
         console.warn('Connection lost. Switching to offline mode.');
         this.onOfflineMode();
       }
     }

     setOnline() {
       if (!this.isOnline) {
         this.isOnline = true;
         console.log('Connection restored.');
         this.onOnlineMode();
       }
     }

     onOfflineMode() {
       // Continuar reprodução com cache local
       // Exibir indicador de offline (opcional)
     }

     onOnlineMode() {
       // Sincronizar com servidor
       // Verificar atualizações
     }
   }
   ```

2. **Reprodução Offline**
   - Player continua usando playlist e mídias do cache local
   - Não interrompe a reprodução
   - Tenta reconectar em background

3. **Sincronização ao Reconectar**
   - Quando conexão é restaurada:
     - Envia heartbeat imediatamente
     - Verifica atualizações de playlist
     - Baixa mídias novas/atualizadas
     - Reporta eventos que ocorreram offline (se houver)

## 📡 Processo de Sincronização Detalhado

### Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. INICIALIZAÇÃO                                            │
└─────────────────────────────────────────────────────────────┘
│
│ Player inicia
│ ├─ Carrega config local (se existir)
│ ├─ Tenta autenticar no servidor
│ └─ Se falhar: usa cache local e tenta reconectar
│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. SINCRONIZAÇÃO INICIAL                                    │
└─────────────────────────────────────────────────────────────┘
│
│ Após autenticação:
│ ├─ Recebe playlist do servidor
│ ├─ Compara versão com cache local
│ │  ├─ Se diferente:
│ │  │  ├─ Identifica mídias novas/atualizadas
│ │  │  ├─ Inicia download em background
│ │  │  └─ Atualiza cache de playlist
│ │  └─ Se igual: usa cache local
│ └─ Inicia reprodução
│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. HEARTBEAT PERIÓDICO (a cada 30-60 segundos)              │
└─────────────────────────────────────────────────────────────┘
│
│ Player envia heartbeat
│ ├─ Status atual
│ ├─ Métricas do sistema
│ ├─ Eventos de reprodução (se houver)
│ └─ Versão da playlist local
│
│ Servidor responde:
│ ├─ Playlist atualizada (se houver mudanças)
│ ├─ Comandos remotos pendentes
│ ├─ Atualizações de mídia
│ └─ Configurações atualizadas
│
│ Player processa resposta:
│ ├─ Se playlist mudou:
│ │  ├─ Compara itens
│ │  ├─ Identifica diferenças
│ │  ├─ Baixa novas mídias
│ │  ├─ Remove mídias não usadas
│ │  └─ Atualiza cache
│ ├─ Processa comandos remotos
│ └─ Atualiza configurações
│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 4. DOWNLOAD DE MÍDIAS                                       │
└─────────────────────────────────────────────────────────────┘
│
│ Estratégia de Download:
│ ├─ Prioridade:
│ │  ├─ 1. Mídias da playlist atual (ordem de reprodução)
│ │  ├─ 2. Mídias atualizadas (nova versão)
│ │  └─ 3. Mídias novas
│ │
│ ├─ Controle de Concorrência:
│ │  ├─ Máximo 2-3 downloads simultâneos
│ │  └─ Não bloqueia reprodução
│ │
│ ├─ Verificação de Integridade:
│ │  ├─ Checksum/MD5 após download
│ │  └─ Re-download se corrompido
│ │
│ └─ Gerenciamento de Espaço:
│    ├─ Monitora espaço disponível
│    ├─ Remove mídias antigas se necessário
│    └─ Notifica se espaço insuficiente
│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 5. OPERAÇÃO OFFLINE                                         │
└─────────────────────────────────────────────────────────────┘
│
│ Quando conexão é perdida:
│ ├─ Player detecta falha de heartbeat
│ ├─ Alterna para modo offline
│ ├─ Continua reprodução com cache local
│ ├─ Tenta reconectar periodicamente (a cada 30s)
│ └─ Quando reconecta:
│    ├─ Sincroniza imediatamente
│    ├─ Baixa atualizações pendentes
│    └─ Reporta eventos offline (se houver)
│
└─────────────────────────────────────────────────────────────┘
```

## 🗂️ Estrutura de Dados Detalhada

### Playlist (Cache Local)

```json
{
  "id": 123,
  "version": "2024-01-15T10:30:00Z",
  "name": "Playlist Principal",
  "campaignId": 45,
  "campaignTitle": "Campanha Q1 2024",
  "items": [
    {
      "item_id": 1,
      "media_id": 100,
      "order_index": 0,
      "duration": 30000,
      "media": {
        "id": 100,
        "name": "Video Promocional",
        "type": "video",
        "mime_type": "video/mp4",
        "size_bytes": 52428800,
        "duration_seconds": 30,
        "version": "2024-01-10T08:00:00Z",
        "checksum": "abc123...",
        "localPath": "media/100.mp4",
        "downloaded": true,
        "downloadedAt": "2024-01-15T09:00:00Z"
      }
    }
  ],
  "metadata": {
    "lastSync": "2024-01-15T10:30:00Z",
    "totalSize": 52428800,
    "itemCount": 1
  }
}
```

### Metadados de Mídia

```json
{
  "id": 100,
  "name": "Video Promocional",
  "type": "video",
  "mime_type": "video/mp4",
  "size_bytes": 52428800,
  "duration_seconds": 30,
  "version": "2024-01-10T08:00:00Z",
  "checksum": "abc123def456...",
  "url": "https://api.example.com/api/player/media/100/download",
  "localPath": "media/100.mp4",
  "downloaded": true,
  "downloadedAt": "2024-01-15T09:00:00Z",
  "lastVerified": "2024-01-15T10:00:00Z",
  "integrityCheck": true
}
```

## 🔐 Segurança e Integridade

### 1. Verificação de Integridade

- **Checksum/MD5**: Cada mídia tem checksum calculado no servidor
- **Validação após Download**: Player verifica checksum após download
- **Re-download Automático**: Se checksum não corresponder, re-baixa

### 2. Autenticação

- **Token JWT**: Renovado automaticamente via refresh token
- **Token de Totem**: Gerado localmente com HMAC-SHA256
- **Validação de UIN**: Servidor valida UIN do totem

### 3. Criptografia (Opcional)

- Mídias podem ser criptografadas no servidor
- Player descriptografa usando chave do totem
- Armazenamento local pode ser criptografado

## 📊 Monitoramento e Logs

### Métricas Coletadas

```javascript
{
  "connection": {
    "isOnline": true,
    "lastHeartbeat": "2024-01-15T10:30:00Z",
    "uptime": 3600,
    "reconnectCount": 0
  },
  "playlist": {
    "currentVersion": "2024-01-15T10:30:00Z",
    "itemCount": 10,
    "totalDuration": 300000
  },
  "media": {
    "cachedCount": 10,
    "totalCacheSize": 524288000,
    "downloadQueue": 0,
    "downloadProgress": {}
  },
  "system": {
    "memory": {},
    "disk": {
      "used": 524288000,
      "available": 10737418240,
      "total": 11261706240
    }
  }
}
```

## 🎯 Resumo: Operação Offline

### ✅ O que é armazenado localmente:

1. **Playlist completa** (estrutura + metadados)
2. **Todas as mídias** da playlist atual
3. **Configurações** do totem e player
4. **Tokens de autenticação** (com renovação automática)
5. **Metadados** de sincronização

### ✅ Como funciona offline:

1. **Reprodução contínua** usando cache local
2. **Sem interrupção** quando conexão é perdida
3. **Reconexão automática** em background
4. **Sincronização** quando conexão é restaurada
5. **Logs de eventos** offline são enviados quando reconecta

### ✅ Vantagens:

- **Resiliência**: Player continua funcionando mesmo sem internet
- **Performance**: Mídias locais carregam mais rápido
- **Economia de banda**: Download uma vez, reproduz múltiplas vezes
- **Experiência contínua**: Sem interrupções na reprodução

## 🔄 Próximos Passos de Implementação

1. **Implementar MediaCache completo**
2. **Sistema de versionamento de playlist**
3. **Download em background com fila**
4. **Limpeza automática de cache**
5. **Monitoramento de espaço em disco**
6. **Verificação de integridade (checksum)**
7. **Sincronização incremental**
8. **Logs de eventos offline**

