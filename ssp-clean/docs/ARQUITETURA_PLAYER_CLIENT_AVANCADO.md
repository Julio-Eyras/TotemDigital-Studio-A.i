# Arquitetura Avançada do Player Client - Smart Signage Pro

## 🎯 Visão Geral

Sistema de player client inteligente com:
- **Cache Local Inteligente** - Lista personalizada no Local Storage
- **Priorização Dinâmica** - Sinais de propaganda mais importante/interativa
- **Reconhecimento de Rosto** - Detecção facial para interação
- **Tag ID** - Identificação via RFID/NFC/QR Code
- **Interrupção Inteligente** - Conteúdo interativo interrompe conteúdo normal
- **Rede de Interação Visual** - Totens interconectados

---

## 📋 1. Sistema de Cache Local (Local Storage)

### 1.1 Estrutura de Dados

```typescript
interface LocalPlaylistCache {
  // Metadados
  playlistId: number;
  version: number;
  lastSync: string;
  expiresAt: string;
  
  // Conteúdo
  items: PlaylistItem[];
  
  // Prioridades
  priorityRules: PriorityRule[];
  
  // Configuração
  config: {
    autoSync: boolean;
    syncInterval: number; // segundos
    offlineMode: boolean;
  };
}

interface PlaylistItem {
  id: number;
  mediaId: number;
  order: number;
  duration: number;
  priority: 'normal' | 'high' | 'critical' | 'interactive';
  interruptible: boolean; // Pode ser interrompido?
  media: {
    id: number;
    path: string;
    type: 'video' | 'image' | 'html' | 'interactive';
    size: number;
    checksum: string;
  };
  triggers?: Trigger[]; // Gatilhos para exibição
}

interface PriorityRule {
  type: 'facial_recognition' | 'tag_id' | 'time' | 'event';
  condition: any;
  action: 'interrupt' | 'overlay' | 'queue_next';
  contentId: number;
}
```

### 1.2 Estratégia de Cache

```typescript
class LocalPlaylistManager {
  private storage: Storage;
  private currentPlaylist: LocalPlaylistCache | null = null;
  private mediaCache: Map<number, Blob> = new Map();
  
  /**
   * Carrega playlist do servidor e armazena localmente
   */
  async syncPlaylist(playlistId: number): Promise<void> {
    // 1. Buscar playlist do servidor
    const serverPlaylist = await this.fetchPlaylist(playlistId);
    
    // 2. Verificar se precisa atualizar
    const localVersion = this.getLocalVersion(playlistId);
    if (serverPlaylist.version <= localVersion) {
      return; // Já está atualizado
    }
    
    // 3. Baixar mídias que não estão em cache
    await this.downloadMissingMedia(serverPlaylist.items);
    
    // 4. Salvar no Local Storage
    await this.saveToLocalStorage(playlistId, serverPlaylist);
    
    // 5. Atualizar cache de mídia
    await this.updateMediaCache(serverPlaylist.items);
  }
  
  /**
   * Carrega playlist do Local Storage (modo offline)
   */
  async loadFromLocalStorage(playlistId: number): Promise<LocalPlaylistCache | null> {
    const key = `playlist_${playlistId}`;
    const data = this.storage.getItem(key);
    if (!data) return null;
    
    const playlist = JSON.parse(data);
    
    // Verificar se expirou
    if (new Date(playlist.expiresAt) < new Date()) {
      // Tentar sincronizar
      await this.syncPlaylist(playlistId);
      return this.loadFromLocalStorage(playlistId);
    }
    
    return playlist;
  }
  
  /**
   * Baixa mídias que não estão em cache
   */
  private async downloadMissingMedia(items: PlaylistItem[]): Promise<void> {
    for (const item of items) {
      const cached = await this.isMediaCached(item.media.id);
      if (!cached) {
        await this.downloadMedia(item.media);
      }
    }
  }
  
  /**
   * Verifica se mídia está em cache
   */
  private async isMediaCached(mediaId: number): Promise<boolean> {
    // Verificar IndexedDB ou File System API
    const cacheKey = `media_${mediaId}`;
    return await this.storage.getItem(cacheKey) !== null;
  }
}
```

### 1.3 Estrutura no Local Storage

```
Local Storage:
├── playlist_{id}
│   ├── metadata (version, lastSync, expiresAt)
│   ├── items (array de itens)
│   └── priorityRules (regras de priorização)
│
├── media_{id}
│   └── blob (dados binários da mídia)
│
└── config
    ├── syncInterval
    ├── offlineMode
    └── cacheSize
```

---

## 📋 2. Sistema de Priorização e Interrupção

### 2.1 Níveis de Prioridade

```typescript
enum ContentPriority {
  NORMAL = 0,      // Conteúdo padrão da playlist
  HIGH = 1,        // Conteúdo importante (pode interromper normal)
  CRITICAL = 2,    // Conteúdo crítico (interrompe tudo)
  INTERACTIVE = 3  // Conteúdo interativo (reconhecimento, tag, etc)
}

interface InterruptSignal {
  type: 'facial_recognition' | 'tag_id' | 'remote_command' | 'scheduled';
  priority: ContentPriority;
  contentId: number;
  duration?: number; // Duração da interrupção
  metadata?: any;
}
```

### 2.2 Gerenciador de Interrupções

```typescript
class InterruptionManager {
  private currentContent: PlaylistItem | null = null;
  private interruptionQueue: InterruptSignal[] = [];
  private isInterrupted: boolean = false;
  
  /**
   * Processa sinal de interrupção
   */
  async handleInterrupt(signal: InterruptSignal): Promise<void> {
    // 1. Verificar prioridade
    if (!this.canInterrupt(signal.priority)) {
      // Adicionar à fila se não pode interromper agora
      this.interruptionQueue.push(signal);
      return;
    }
    
    // 2. Pausar conteúdo atual
    if (this.currentContent) {
      await this.pauseCurrentContent();
    }
    
    // 3. Carregar conteúdo interativo
    const interactiveContent = await this.loadInteractiveContent(signal.contentId);
    
    // 4. Exibir conteúdo interativo
    await this.displayContent(interactiveContent, signal);
    
    // 5. Marcar como interrompido
    this.isInterrupted = true;
    
    // 6. Agendar retorno ao conteúdo normal
    if (signal.duration) {
      setTimeout(() => {
        this.resumeNormalContent();
      }, signal.duration);
    }
  }
  
  /**
   * Verifica se pode interromper conteúdo atual
   */
  private canInterrupt(newPriority: ContentPriority): boolean {
    if (!this.currentContent) return true;
    
    const currentPriority = this.getContentPriority(this.currentContent);
    
    // Regras de interrupção:
    // - INTERACTIVE sempre interrompe
    // - CRITICAL interrompe HIGH e NORMAL
    // - HIGH interrompe apenas NORMAL
    // - NORMAL nunca interrompe
    
    if (newPriority === ContentPriority.INTERACTIVE) return true;
    if (newPriority === ContentPriority.CRITICAL && currentPriority < ContentPriority.CRITICAL) return true;
    if (newPriority === ContentPriority.HIGH && currentPriority === ContentPriority.NORMAL) return true;
    
    return false;
  }
  
  /**
   * Retoma conteúdo normal após interrupção
   */
  async resumeNormalContent(): Promise<void> {
    this.isInterrupted = false;
    
    // Verificar se há mais interrupções na fila
    if (this.interruptionQueue.length > 0) {
      const nextSignal = this.interruptionQueue.shift()!;
      await this.handleInterrupt(nextSignal);
      return;
    }
    
    // Retomar conteúdo normal
    if (this.currentContent) {
      await this.resumeContent(this.currentContent);
    }
  }
}
```

---

## 📋 3. Reconhecimento de Rosto

### 3.1 Integração com Câmera

```typescript
class FacialRecognitionService {
  private camera: MediaStream | null = null;
  private recognitionActive: boolean = false;
  private faceDetector: any; // ML Kit, TensorFlow.js, etc
  
  /**
   * Inicializa detecção facial
   */
  async initialize(): Promise<void> {
    // 1. Solicitar acesso à câmera
    this.camera = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'user', // Câmera frontal
        width: 640,
        height: 480
      }
    });
    
    // 2. Inicializar detector de faces
    this.faceDetector = await this.loadFaceDetector();
    
    // 3. Iniciar detecção contínua
    this.startDetection();
  }
  
  /**
   * Loop de detecção
   */
  private async startDetection(): Promise<void> {
    this.recognitionActive = true;
    
    while (this.recognitionActive && this.camera) {
      // 1. Capturar frame
      const frame = await this.captureFrame();
      
      // 2. Detectar faces
      const faces = await this.faceDetector.detect(frame);
      
      // 3. Processar detecções
      if (faces.length > 0) {
        await this.processFaces(faces);
      }
      
      // 4. Aguardar próximo frame (30 FPS)
      await this.sleep(33);
    }
  }
  
  /**
   * Processa faces detectadas
   */
  private async processFaces(faces: Face[]): Promise<void> {
    for (const face of faces) {
      // 1. Extrair características
      const features = await this.extractFeatures(face);
      
      // 2. Comparar com banco de dados (opcional)
      const match = await this.matchFace(features);
      
      // 3. Enviar sinal de interrupção
      if (match || this.shouldInterruptOnAnyFace()) {
        await this.triggerInterrupt({
          type: 'facial_recognition',
          priority: ContentPriority.INTERACTIVE,
          contentId: match?.contentId || this.getDefaultInteractiveContent(),
          metadata: {
            faceCount: faces.length,
            confidence: match?.confidence,
            age: face.age, // se disponível
            gender: face.gender, // se disponível
            emotion: face.emotion // se disponível
          }
        });
      }
    }
  }
  
  /**
   * Envia sinal de interrupção
   */
  private async triggerInterrupt(signal: InterruptSignal): Promise<void> {
    // Enviar para InterruptionManager
    await interruptionManager.handleInterrupt(signal);
    
    // Notificar servidor (opcional)
    await this.notifyServer(signal);
  }
}
```

### 3.2 Conteúdo Personalizado por Rosto

```typescript
interface FaceMatch {
  personId?: number;
  contentId: number;
  confidence: number;
  personalization: {
    name?: string;
    preferences?: string[];
    history?: any[];
  };
}

// Exemplo: Se reconhecer pessoa específica, mostrar conteúdo personalizado
if (match.personId) {
  const personalizedContent = await loadPersonalizedContent(match.personId);
  await displayContent(personalizedContent);
}
```

---

## 📋 4. Sistema de Tag ID (RFID/NFC/QR Code)

### 4.1 Leitor de Tags

```typescript
class TagReaderService {
  private readers: TagReader[] = [];
  private activeTags: Map<string, TagInfo> = new Map();
  
  /**
   * Inicializa leitores disponíveis
   */
  async initialize(): Promise<void> {
    // Verificar se há leitor RFID/NFC disponível
    if (await this.hasRFIDReader()) {
      this.readers.push(await this.initRFIDReader());
    }
    
    // Verificar se há leitor NFC disponível
    if (await this.hasNFCReader()) {
      this.readers.push(await this.initNFCReader());
    }
    
    // Iniciar leitura contínua
    this.startReading();
  }
  
  /**
   * Loop de leitura
   */
  private async startReading(): Promise<void> {
    while (true) {
      for (const reader of this.readers) {
        const tags = await reader.read();
        
        for (const tag of tags) {
          await this.processTag(tag);
        }
      }
      
      await this.sleep(100); // 10 leituras por segundo
    }
  }
  
  /**
   * Processa tag detectada
   */
  private async processTag(tag: Tag): Promise<void> {
    // 1. Verificar se tag já está ativa (evitar duplicatas)
    if (this.activeTags.has(tag.id)) {
      return;
    }
    
    // 2. Registrar tag como ativa
    this.activeTags.set(tag.id, {
      id: tag.id,
      type: tag.type,
      detectedAt: new Date(),
      data: tag.data
    });
    
    // 3. Buscar conteúdo associado à tag
    const contentId = await this.getContentForTag(tag.id);
    
    // 4. Enviar sinal de interrupção
    await this.triggerInterrupt({
      type: 'tag_id',
      priority: ContentPriority.INTERACTIVE,
      contentId: contentId,
      duration: 10000, // 10 segundos
      metadata: {
        tagId: tag.id,
        tagType: tag.type,
        tagData: tag.data
      }
    });
    
    // 5. Remover tag após timeout (evitar repetição)
    setTimeout(() => {
      this.activeTags.delete(tag.id);
    }, 5000);
  }
  
  /**
   * Busca conteúdo associado à tag
   */
  private async getContentForTag(tagId: string): Promise<number> {
    // 1. Verificar cache local
    const cached = await this.getCachedContent(tagId);
    if (cached) return cached;
    
    // 2. Buscar no servidor
    const response = await fetch(`/api/tags/${tagId}/content`);
    const data = await response.json();
    
    // 3. Cachear resultado
    await this.cacheContent(tagId, data.contentId);
    
    return data.contentId;
  }
}
```

### 4.2 Tipos de Tags Suportadas

```typescript
enum TagType {
  RFID = 'rfid',
  NFC = 'nfc',
  QR_CODE = 'qr_code',
  BARCODE = 'barcode',
  BLUETOOTH = 'bluetooth'
}

interface Tag {
  id: string;
  type: TagType;
  data: any;
  timestamp: Date;
}
```

---

## 📋 5. Rede de Interação Visual

### 5.1 Comunicação entre Totens

```typescript
class VisualNetworkService {
  private peers: Map<string, PeerConnection> = new Map();
  private networkId: string;
  
  /**
   * Conecta totem à rede
   */
  async connectToNetwork(): Promise<void> {
    // 1. Obter ID do totem
    this.networkId = await this.getTotemId();
    
    // 2. Conectar ao servidor de sinalização (WebSocket)
    await this.connectToSignalingServer();
    
    // 3. Descobrir totens próximos
    const nearbyTotems = await this.discoverNearbyTotems();
    
    // 4. Estabelecer conexões P2P
    for (const totem of nearbyTotems) {
      await this.connectToPeer(totem);
    }
  }
  
  /**
   * Compartilha evento de interação
   */
  async broadcastInteraction(interaction: InteractionEvent): Promise<void> {
    // 1. Enviar para servidor central
    await this.sendToServer(interaction);
    
    // 2. Broadcast para totens próximos
    for (const [peerId, peer] of this.peers) {
      await peer.send(interaction);
    }
  }
  
  /**
   * Recebe interação de outro totem
   */
  async onInteractionReceived(interaction: InteractionEvent): Promise<void> {
    // Exemplo: Se pessoa foi detectada no totem A, totem B pode mostrar conteúdo relacionado
    if (interaction.type === 'facial_recognition') {
      await this.showRelatedContent(interaction);
    }
  }
}
```

### 5.2 Tipos de Interação em Rede

```typescript
interface InteractionEvent {
  totemId: string;
  type: 'facial_recognition' | 'tag_id' | 'touch' | 'gesture';
  timestamp: Date;
  metadata: {
    personId?: number;
    tagId?: string;
    location?: string;
    contentId?: number;
  };
}

// Exemplo de uso:
// Totem A detecta rosto → Envia evento
// Totem B recebe evento → Mostra conteúdo relacionado
// Totem C recebe evento → Atualiza estatísticas
```

---

## 📋 6. Fluxo Completo de Interação

### 6.1 Cenário: Reconhecimento de Rosto

```
1. Pessoa se aproxima do totem
   ↓
2. Câmera detecta rosto
   ↓
3. FacialRecognitionService processa
   ↓
4. Envia InterruptSignal (priority: INTERACTIVE)
   ↓
5. InterruptionManager verifica prioridade
   ↓
6. Pausa conteúdo atual (se permitido)
   ↓
7. Carrega conteúdo interativo do cache local
   ↓
8. Exibe conteúdo interativo
   ↓
9. Broadcast para rede (opcional)
   ↓
10. Após duração, retoma conteúdo normal
```

### 6.2 Cenário: Tag ID

```
1. Pessoa aproxima tag (RFID/NFC/QR)
   ↓
2. TagReaderService detecta tag
   ↓
3. Busca conteúdo associado (cache ou servidor)
   ↓
4. Envia InterruptSignal
   ↓
5. InterruptionManager interrompe conteúdo
   ↓
6. Exibe conteúdo da tag
   ↓
7. Notifica servidor (analytics)
   ↓
8. Retoma conteúdo normal
```

---

## 📋 7. Estrutura de Arquivos

```
player-client/
├── src/
│   ├── core/
│   │   ├── LocalPlaylistManager.ts
│   │   ├── InterruptionManager.ts
│   │   └── ContentPlayer.ts
│   │
│   ├── services/
│   │   ├── FacialRecognitionService.ts
│   │   ├── TagReaderService.ts
│   │   ├── VisualNetworkService.ts
│   │   └── SyncService.ts
│   │
│   ├── storage/
│   │   ├── LocalStorageAdapter.ts
│   │   ├── IndexedDBAdapter.ts
│   │   └── CacheManager.ts
│   │
│   └── network/
│       ├── WebSocketClient.ts
│       ├── PeerConnection.ts
│       └── SignalingServer.ts
│
└── config/
    └── player.config.json
```

---

## 📋 8. Configuração

```json
{
  "playlist": {
    "syncInterval": 300,
    "cacheExpiration": 3600,
    "offlineMode": true
  },
  "interruption": {
    "enabled": true,
    "minPriority": "high",
    "queueSize": 10
  },
  "facialRecognition": {
    "enabled": true,
    "camera": "front",
    "detectionInterval": 33,
    "minConfidence": 0.7
  },
  "tagReader": {
    "enabled": true,
    "types": ["rfid", "nfc", "qr_code"],
    "readInterval": 100
  },
  "network": {
    "enabled": true,
    "maxPeers": 5,
    "broadcastRadius": 50
  }
}
```

---

## ✅ Próximos Passos

1. Implementar LocalPlaylistManager
2. Implementar InterruptionManager
3. Integrar FacialRecognitionService
4. Integrar TagReaderService
5. Implementar VisualNetworkService
6. Testes e validação

