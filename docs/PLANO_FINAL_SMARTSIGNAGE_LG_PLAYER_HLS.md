# 📋 Plano Final - SmartSignage-LG-PLAYER-HLS

## 🎯 Objetivo do Módulo

Desenvolver um player completo, otimizado e profissional para **LG Smart TVs (webOS)** especificamente para operação **24/7** em Smart Display, baseado nas melhores práticas e diretrizes técnicas validadas.

**Nome do módulo:** `SmartSignage-LG-PLAYER-HLS`

---

## 📊 Análise do Contexto e Diretrizes

### ✅ Informações Técnicas Validadas (do README compartilhado)

#### 1. HLS (m3u8) é OBRIGATÓRIO para LG webOS
- ✅ **Suporte nativo** - webOS suporta HLS nativamente via `<video>` HTML5
- ✅ **Hardware decoding automático** - GPU decodifica, não CPU
- ✅ **Adaptive Bitrate** - Troca automática de qualidade baseado na conexão
- ✅ **Ideal para 24/7** - Mais estável que DASH ou HTTP direto
- ✅ **Padrão da indústria** - Compatível com CDNs

**Implementação:**
```html
<video autoplay muted loop playsinline webkit-playsinline>
  <source src="http://servidor/stream/playlist.m3u8" type="application/x-mpegURL">
</video>
```

#### 2. Hardware Decoding é ESSENCIAL
- ✅ webOS usa hardware decoding automaticamente quando:
  - Codec é suportado (H.264/H.265)
  - Perfil correto (H.264 High/Main, H.265 Main)
  - Usa `<video>` nativo (não Canvas, não JS)

**Codecs Recomendados:**
- **H.264 (AVC)** - Mais compatível (perfil High/Main)
- **H.265 (HEVC)** - Melhor compressão (modelos novos, perfil Main)

#### 3. Baixo Consumo de CPU é CRÍTICO
**Evitar:**
- ❌ Players JS pesados (dash.js, hls.js desnecessário no webOS)
- ❌ Canvas para vídeo
- ❌ WebGL para renderização
- ❌ Decodificação via JavaScript
- ❌ Animações CSS complexas

**Usar:**
- ✅ `<video>` nativo HTML5
- ✅ HLS direto
- ✅ Zero bibliotecas JS pesadas
- ✅ CSS mínimo (sem animações)

#### 4. Operação 24/7 Requer
- ✅ Estabilidade contínua
- ✅ Watchdog em múltiplas camadas
- ✅ Fallback offline
- ✅ Recuperação automática
- ✅ Modo kiosk

#### 5. Comparação de Plataformas
| Recurso | LG webOS | Android TV | Samsung Tizen |
|---------|----------|------------|---------------|
| HLS nativo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| DASH | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Estabilidade 24/7 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| CPU baixo | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Kiosk real | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Ideal p/ Smart Display** | 🏆 | ❌ | 🥈 |

**Conclusão:** LG webOS é a melhor escolha para Smart Display 24/7.

---

## 🏗️ Arquitetura Proposta (Baseada nas Diretrizes)

### Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│              Backend Smart Signage Pro                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   REST API   │  │  WebSocket   │  │  HLS Server  │      │
│  │ (Comandos)   │  │  (Opcional)  │  │  (Streaming) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          │ HTTP Polling      │ WebSocket        │ HLS (.m3u8)
          │ (15s intervalo)   │ (opcional)       │ (streaming)
          │                  │                  │
    ┌─────┴──────────────────┴──────────────────┴─────┐
    │    SmartSignage-LG-PLAYER-HLS (webOS App)       │
    │  ┌──────────────────────────────────────────┐   │
    │  │  Core Player                             │   │
    │  │  ├─ HTML5 <video> (nativo)              │   │
    │  │  ├─ HLS (.m3u8) suporte nativo          │   │
    │  │  └─ Hardware decoding automático        │   │
    │  └──────────────────────────────────────────┘   │
    │  ┌──────────────────────────────────────────┐   │
    │  │  Control Layer                           │   │
    │  │  ├─ Command Fetcher (HTTP polling)      │   │
    │  │  ├─ Watchdog (anti-freeze)              │   │
    │  │  ├─ Fallback Manager                    │   │
    │  │  └─ Heartbeat Service                   │   │
    │  └──────────────────────────────────────────┘   │
    │  ┌──────────────────────────────────────────┐   │
    │  │  webOS Integration                       │   │
    │  │  ├─ Kiosk Mode                          │   │
    │  │  ├─ Auto-launch                         │   │
    │  │  └─ System APIs (opcional)              │   │
    │  └──────────────────────────────────────────┘   │
    └──────────────────────────────────────────────────┘
```

### Estrutura de Diretórios Proposta

```
SmartSignage-LG-PLAYER-HLS/
├── README.md                          # Documentação principal
├── LICENSE                            # Licença (MIT recomendado)
│
├── lg-app/                            # Aplicativo webOS
│   ├── appinfo.json                  # Manifesto webOS (kiosk mode)
│   ├── index.html                    # Entry point (minimal)
│   ├── app.js                        # Lógica principal
│   ├── styles.css                    # CSS minimal (sem animações)
│   └── icon.png                      # Ícone do app
│
├── config/                            # Configurações
│   └── config.example.json           # Exemplo de configuração
│
├── docs/                              # Documentação
│   ├── ARCHITECTURE.md               # Arquitetura detalhada
│   ├── INSTALLATION.md               # Guia de instalação
│   ├── DEPLOYMENT.md                 # Guia de deployment
│   ├── PRODUCTION-24x7.md            # Boas práticas 24/7
│   ├── TROUBLESHOOTING.md            # Troubleshooting
│   └── API.md                        # Documentação da API
│
├── scripts/                           # Scripts auxiliares
│   ├── build.sh                      # Build do app
│   ├── deploy.sh                     # Deploy para TV
│   └── package.sh                    # Empacotar .ipk
│
└── .gitignore
```

---

## 🎨 Decisões de Design (Baseadas nas Diretrizes)

### 1. Player de Mídia - APENAS HTML5 Nativo

**Decisão:** ✅ **Usar EXCLUSIVAMENTE `<video>` HTML5 nativo do webOS** 

**Por quê:**
- ✅ Hardware decoding automático
- ✅ Zero overhead de JavaScript
- ✅ Máxima estabilidade
- ✅ CPU baixíssimo (< 10%)

**NÃO usar:**
- ❌ hls.js (desnecessário no webOS)
- ❌ dash.js (não recomendado)
- ❌ Canvas para renderização
- ❌ WebGL
- ❌ Qualquer biblioteca JS para vídeo

**Implementação:**
```javascript
// Mínimo absoluto necessário
const video = document.getElementById('player');
video.src = 'http://servidor/playlist.m3u8';
video.play();
```

### 2. Comunicação com Backend - HTTP Polling (Simples e Robusto)

**Decisão:** Usar **HTTP Polling** ao invés de WebSocket para comandos.

**Por quê:**
- ✅ CPU quase zero (fetch simples)
- ✅ Funciona em qualquer ambiente corporativo
- ✅ Não tem problemas de firewall/proxy
- ✅ Reconexão automática (cada requisição é independente)
- ✅ Mais robusto para operação 24/7

**Intervalo:** 15 segundos (balance entre responsividade e eficiência)

**Implementação:**
```javascript
setInterval(async () => {
  const cmd = await fetch(`${API_URL}/tv/${TV_ID}/command`);
  const command = await cmd.json();
  processCommand(command);
}, 15000);
```

**WebSocket opcional:** Ambos implementados. WebSocket será ativado quando integração com IAs estiver pronta, permitindo atualizações dinâmicas de playlists conforme eventos em tempo real.

### 3. HLS - Backend Serve, Player Consome

**Decisão:** Backend converte vídeos para HLS e serve `.m3u8`. Player apenas reproduz.

**Por quê:**
- ✅ TV não precisa processar/converter nada
- ✅ CPU zero no player
- ✅ Escalável (backend pode usar CDN)
- ✅ Playlist pode ser gerada dinamicamente

**Backend deve:**
- Converter vídeos para HLS (FFmpeg)
- Servir `.m3u8` + segmentos `.ts`
- Gerar playlists dinâmicas (vinhetas + anúncios)

**Player apenas:**
- Faz fetch do `.m3u8`
- Reproduz via `<video>` nativo

### 4. Cache e Offline

**Estratégia:**
- **Não cachear HLS** (é streaming, não precisa)
- **Fallback offline:** Vídeo local (pendrive/USB) quando stream falha
- **Playlist config:** Cache local da última playlist válida

**Fallback offline:**
```javascript
video.addEventListener('error', () => {
  // Tentar stream novamente após delay
  setTimeout(() => {
    video.src = STREAM_URL;
    video.play();
  }, 3000);
  
  // Se falhar novamente, usar fallback local
  if (fallbackCount++ > 3) {
    video.src = '/media/usb/fallback.mp4';
    video.loop = true;
  }
});
```

### 5. Watchdog em 3 Camadas

**Camada 1 - JavaScript (Player)**
```javascript
setInterval(() => {
  if (video.readyState < 3 || video.paused) {
    console.warn('Watchdog: reiniciando player');
    video.load();
    video.play().catch(() => {});
  }
}, 20000); // A cada 20 segundos
```

**Camada 2 - App (Auto-reload)**
```javascript
// Se watchdog JS falhar, reload completo após timeout maior
let lastActivity = Date.now();
setInterval(() => {
  if (Date.now() - lastActivity > 300000) { // 5 minutos sem atividade
    location.reload();
  }
}, 60000);
```

**Camada 3 - Hardware (Tomada inteligente)**
- Reinício físico diário (ex: 04:00)
- Monitoramento externo (opcional)

### 6. Heartbeat e Monitoramento

**Frequência:** 30 segundos (balance entre monitoramento e eficiência)

**Dados enviados:**
```javascript
{
  tv_id: "LG_001",
  status: "PLAYING", // PLAYING, PAUSED, ERROR, OFFLINE
  current_stream: "http://.../playlist.m3u8",
  uptime: 86400, // segundos
  last_error: null // se houver erro recente
}
```

**Backend endpoint:** `POST /api/player/heartbeat` (já existe)

---

## 🔧 Componentes Principais

### 1. Core Player (app.js)

**Responsabilidades:**
- Gerenciar elemento `<video>` HTML5
- Reproduzir HLS streams
- Detectar erros e falhas
- Gerenciar ciclo de vida

**Interface:**
```javascript
class HLSPlayer {
  constructor(containerId) {
    this.video = document.getElementById(containerId);
    this.currentStream = null;
    this.watchdogInterval = null;
  }
  
  play(streamUrl) {
    // Trocar stream apenas se diferente
    if (this.currentStream === streamUrl) return;
    
    this.currentStream = streamUrl;
    this.video.src = streamUrl;
    this.video.load();
    return this.video.play();
  }
  
  startWatchdog() {
    // Verificar a cada 20s se player está travado
  }
  
  stop() {
    this.video.pause();
    this.video.src = '';
  }
}
```

### 2. Command Fetcher

**Responsabilidades:**
- Buscar comandos do backend periodicamente
- Processar comandos (PLAY, RESTART, etc.)
- Gerenciar reconexão

**Interface:**
```javascript
class CommandFetcher {
  constructor(apiUrl, tvId, interval = 15000) {
    this.apiUrl = apiUrl;
    this.tvId = tvId;
    this.interval = interval;
  }
  
  start() {
    setInterval(async () => {
      const command = await this.fetchCommand();
      if (command) this.processCommand(command);
    }, this.interval);
  }
  
  async fetchCommand() {
    try {
      const res = await fetch(`${this.apiUrl}/tv/${this.tvId}/command`);
      return await res.json();
    } catch (error) {
      console.warn('Erro ao buscar comando:', error);
      return null;
    }
  }
  
  processCommand(command) {
    switch (command.action) {
      case 'PLAY':
        player.play(command.stream);
        break;
      case 'RESTART':
        location.reload();
        break;
      // outros comandos...
    }
  }
}
```

### 3. Heartbeat Service

**Responsabilidades:**
- Enviar status periódico para backend
- Coletar métricas básicas
- Indicar que TV está online

**Interface:**
```javascript
class HeartbeatService {
  constructor(apiUrl, tvId, interval = 30000) {
    this.apiUrl = apiUrl;
    this.tvId = tvId;
    this.interval = interval;
    this.startTime = Date.now();
  }
  
  start() {
    setInterval(() => {
      this.sendHeartbeat();
    }, this.interval);
  }
  
  async sendHeartbeat() {
    const data = {
      tv_id: this.tvId,
      status: this.getCurrentStatus(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      current_stream: player.currentStream
    };
    
    try {
      await fetch(`${this.apiUrl}/player/heartbeat?uin=${this.tvId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.warn('Erro ao enviar heartbeat:', error);
    }
  }
  
  getCurrentStatus() {
    if (video.paused) return 'PAUSED';
    if (video.ended) return 'ENDED';
    if (video.error) return 'ERROR';
    return 'PLAYING';
  }
}
```

### 4. Fallback Manager

**Responsabilidades:**
- Detectar falhas no stream principal
- Ativar fallback local quando necessário
- Retornar ao stream principal quando recuperar

**Interface:**
```javascript
class FallbackManager {
  constructor(primaryStream, fallbackUrl) {
    this.primaryStream = primaryStream;
    this.fallbackUrl = fallbackUrl;
    this.fallbackActive = false;
    this.retryCount = 0;
    this.maxRetries = 3;
  }
  
  handleError() {
    this.retryCount++;
    
    if (this.retryCount > this.maxRetries) {
      this.activateFallback();
    } else {
      // Tentar stream principal novamente
      setTimeout(() => {
        player.play(this.primaryStream);
      }, 3000);
    }
  }
  
  activateFallback() {
    this.fallbackActive = true;
    player.play(this.fallbackUrl);
    player.video.loop = true;
    
    // Tentar retornar ao stream principal periodicamente
    setInterval(() => {
      this.tryPrimaryStream();
    }, 60000);
  }
  
  async tryPrimaryStream() {
    // Testar se stream principal voltou
    try {
      const test = await fetch(this.primaryStream);
      if (test.ok) {
        this.fallbackActive = false;
        this.retryCount = 0;
        player.play(this.primaryStream);
      }
    } catch (e) {
      // Stream ainda indisponível
    }
  }
}
```

### 5. Device Info Service (Coleta de Hardware)

**Responsabilidades:**
- Coletar informações únicas do hardware (MAC, Device ID, Serial)
- Gerar UIN único baseado no hardware
- Gerenciar registro inicial no backend

**Interface:**
```javascript
class DeviceInfoService {
  constructor() {
    this.uin = null;
    this.hardwareInfo = null;
  }
  
  async collectHardwareInfo() {
    // Coletar informações via webOS APIs
    const info = {
      macAddress: await this.getMacAddress(),
      deviceId: await this.getDeviceId(),
      serialNumber: await this.getSerialNumber(),
      platform: 'webOS',
      hostname: await this.getHostname()
    };
    
    // Gerar hardware hash
    info.hardwareHash = this.generateHardwareHash(info);
    
    this.hardwareInfo = info;
    return info;
  }
  
  async getMacAddress() {
    // Via webOS network API ou system info
    // Tentar diferentes métodos conforme disponibilidade
    try {
      // webOS pode fornecer via SystemInfo ou Network API
      return await this.getNetworkInfo().then(net => net.macAddress);
    } catch (e) {
      console.warn('Não foi possível obter MAC Address');
      return 'unknown';
    }
  }
  
  async getDeviceId() {
    // Device ID do webOS
    // Pode estar em systeminfo.json ou via API
    try {
      return await this.getSystemInfo().then(sys => sys.deviceId);
    } catch (e) {
      return 'unknown';
    }
  }
  
  async getSerialNumber() {
    // Serial number da TV (se disponível)
    try {
      return await this.getSystemInfo().then(sys => sys.serialNumber);
    } catch (e) {
      return 'unknown';
    }
  }
  
  generateUIN(hardwareInfo) {
    // Gerar UIN único baseado no hardware
    // Formato: LG_{MAC}_{DEVICEID} ou similar
    const parts = [
      'LG',
      hardwareInfo.macAddress.replace(/:/g, ''),
      hardwareInfo.deviceId.substring(0, 8)
    ].filter(p => p !== 'unknown');
    
    return parts.join('_');
  }
  
  generateHardwareHash(hardwareInfo) {
    // Hash único do hardware (SHA256 ou similar)
    const data = [
      hardwareInfo.macAddress,
      hardwareInfo.deviceId,
      hardwareInfo.serialNumber
    ].join(':');
    
    // Usar crypto API do browser ou algoritmo simples
    return this.simpleHash(data);
  }
  
  async registerWithBackend(apiUrl) {
    // Primeiro registro no backend
    const hardwareInfo = await this.collectHardwareInfo();
    const uin = this.generateUIN(hardwareInfo);
    
    try {
      const response = await fetch(`${apiUrl}/player/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uin: uin,
          hardware: hardwareInfo
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        this.uin = uin;
        // Salvar UIN localmente
        this.saveUIN(uin);
        return { success: true, uin, result };
      } else {
        throw new Error(result.error || 'Registro falhou');
      }
    } catch (error) {
      console.error('Erro ao registrar no backend:', error);
      throw error;
    }
  }
  
  saveUIN(uin) {
    // Salvar em localStorage ou config.json
    localStorage.setItem('smartsignage_uin', uin);
  }
  
  getUIN() {
    // Obter UIN salvo ou coletar novo
    if (this.uin) return this.uin;
    
    const saved = localStorage.getItem('smartsignage_uin');
    if (saved) {
      this.uin = saved;
      return saved;
    }
    
    return null;
  }
}
```

**Nota:** Implementação específica depende das APIs disponíveis no webOS. Algumas informações podem não estar disponíveis em todas as versões do webOS, então o código deve ser defensivo e usar fallbacks.

---

## 🔄 Fluxos Principais

### Fluxo 1: Inicialização

```
1. App inicia (webOS auto-launch)
   ↓
2. DeviceInfoService verifica se UIN existe
   ├─ Se existe (localStorage/config.json):
   │  └─ Usa UIN existente → vai para passo 5
   └─ Se não existe:
      ↓
3. DeviceInfoService coleta informações do hardware
   - MAC Address
   - Device ID
   - Serial Number (se disponível)
   - Gera UIN único
   ↓
4. Registro no backend
   - POST /api/player/register
   - Envia UIN + hardware info
   - Backend valida e registra totem
   - Salva UIN localmente
   ↓
5. Carregar configuração (config.json ou appinfo.json)
   - UIN (já coletado)
   - API_URL
   - STREAM_URL (inicial - pode vir do backend)
   - FALLBACK_URL (opcional)
   ↓
6. Obter token de autenticação
   - GET /api/player/token?uin={UIN}
   - Salvar token para requisições
   ↓
7. Validar totem no backend
   - GET /api/player/validate?uin={UIN}&token={token}
   - Recebe playlist inicial e comandos pendentes
   ↓
8. Inicializar Player
   - Criar elemento <video>
   - Configurar eventos
   - Iniciar watchdog
   ↓
9. Inicializar CommandFetcher
   - Conectar ao backend
   - Começar polling (15s)
   ↓
10. Inicializar HeartbeatService
    - Começar enviar status (30s)
    ↓
11. Reproduzir stream inicial
    - player.play(STREAM_URL do backend ou config)
    ↓
12. App rodando 24/7
```

### Fluxo 2: Comando Remoto (Trocar Stream)

```
1. Admin envia comando no backend
   POST /api/tv/{id}/command
   { action: "PLAY", stream: "http://.../novo.m3u8" }
   ↓
2. CommandFetcher busca comando (próximo polling)
   GET /api/tv/{id}/command
   ↓
3. Recebe comando PLAY
   ↓
4. Player.processCommand(command)
   ↓
5. player.play(novo_stream_url)
   ↓
6. Vídeo troca automaticamente (HLS nativo)
   ↓
7. Continua reprodução normal
```

### Fluxo 3: Fallback Offline

```
1. Stream principal falha (erro de rede, servidor down)
   ↓
2. video.addEventListener('error') dispara
   ↓
3. FallbackManager.handleError()
   ↓
4. Tentar stream principal novamente (até maxRetries)
   ↓
5. Se todas tentativas falharem:
   - FallbackManager.activateFallback()
   - player.play(fallback_local.mp4)
   - video.loop = true
   ↓
6. FallbackManager tenta stream principal periodicamente
   ↓
7. Quando stream principal volta:
   - FallbackManager detecta
   - player.play(stream_principal)
   - Continua normal
```

### Fluxo 4: Watchdog Anti-Freeze

```
1. Watchdog verifica periodicamente (20s)
   ↓
2. Verifica: video.readyState < 3 OU video.paused
   ↓
3. Se detectado problema:
   - video.load()
   - video.play()
   - Log do evento
   ↓
4. Se watchdog falhar (player JS travado):
   - Auto-reload após 5 minutos sem atividade
   - location.reload()
   ↓
5. Se app inteiro travar:
   - Watchdog hardware reinicia TV (físico)
```

---

## 📝 Integração com Backend Smart Signage Pro

### Endpoints Utilizados

#### 1. Autenticação/Validação
```
GET /api/player/validate?uin={TV_ID}&token={token}
```
**Resposta esperada:**
```json
{
  "valid": true,
  "totem": { ... },
  "playlist": { ... },
  "pendingCommands": [ ... ]
}
```

#### 2. Heartbeat
```
POST /api/player/heartbeat?uin={TV_ID}&token={token}
Body: {
  status: "PLAYING",
  uptime: 86400,
  current_stream: "http://.../playlist.m3u8",
  metrics: { ... }
}
```

#### 3. Buscar Comandos (Polling)
```
GET /api/tv/{id}/command
```
**Resposta esperada:**
```json
{
  "action": "PLAY",
  "stream": "http://servidor/hls/playlist.m3u8",
  "volume": 0
}
```

**Ações suportadas:**
- `PLAY` - Reproduzir stream específico
- `RESTART` - Reiniciar app (location.reload())
- `STOP` - Parar reprodução
- `PAUSE` - Pausar (raro em 24/7)

#### 4. Buscar Playlist do Totem
```
GET /api/totems/{id}/playlist
```
**Resposta esperada:**
```json
{
  "playlist": {
    "id": 123,
    "name": "Campanha Verão",
    "items": [
      {
        "id": 1,
        "type": "video",
        "url": "http://servidor/hls/item1.m3u8",
        "duration": 30
      },
      ...
    ]
  }
}
```

### Formato de Stream HLS

**Backend deve servir:**
- Arquivo `.m3u8` (playlist HLS)
- Segmentos `.ts` (vídeo) ou `.mp4` (se HLS fMP4)

**Exemplo de playlist.m3u8:**
```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXTINF:4.0,
segment001.ts
#EXTINF:4.0,
segment002.ts
#EXTINF:4.0,
segment003.ts
#EXT-X-ENDLIST
```

---

## 🛡️ Segurança e Configuração

### appinfo.json (Manifesto webOS)

```json
{
  "id": "com.smartsignage.lgplayer.hls",
  "version": "1.0.0",
  "vendor": "Smart Signage Pro",
  "type": "web",
  "main": "index.html",
  "title": "SmartSignage LG Player HLS",
  "icon": "icon.png",
  "largeIcon": "icon.png",
  "visible": false,
  "supportTouchMode": "none",
  "noSplashOnLaunch": true,
  "requiredPermissions": [
    "network.operation",
    "media.operation",
    "media.read"
  ],
  "disableBackHistoryAPI": true,
  "trustLevel": "trusted"
}
```

**Importante:**
- `visible: false` - Modo kiosk (app não aparece na lista)
- `noSplashOnLaunch: true` - Sem tela de splash
- `supportTouchMode: "none"` - Não precisa de toque

### Configuração (config.json)

```json
{
  "tv_id": "LG_001",
  "api_base_url": "http://192.168.1.100:3000/api",
  "stream_url": "http://192.168.1.100:3000/hls/canal01/playlist.m3u8",
  "fallback_url": "/media/usb/fallback.mp4",
  "heartbeat_interval": 30000,
  "command_poll_interval": 15000,
  "watchdog_interval": 20000,
  "auto_reload_timeout": 300000
}
```

### Autenticação

**Método:** Token HMAC (já implementado no backend)
- Player obtém token via `/api/player/token?uin={TV_ID}`
- Usa token em requisições subsequentes
- Token expira em 1 hora, renovado automaticamente

---

## 📊 Performance e Otimização

### Métricas Esperadas

| Métrica | Valor Esperado | Como Medir |
|---------|---------------|------------|
| CPU Usage | < 10% | webOS Developer Tools |
| Memory | < 100MB | webOS Developer Tools |
| Network | ~2-5 Mbps (HD) | Monitor de rede |
| Battery (se aplicável) | N/A | N/A (TV sempre ligada) |

### Otimizações Aplicadas

1. **Zero bibliotecas JS pesadas**
   - Apenas JavaScript vanilla
   - Sem frameworks
   - Sem bundlers desnecessários

2. **CSS mínimo**
   - Sem animações
   - Sem transições complexas
   - Apenas layout básico

3. **HTTP Polling eficiente**
   - Intervalo otimizado (15s)
   - Requisições leves
   - Cache de comandos quando possível

4. **HLS nativo**
   - Browser/OS gerencia tudo
   - Hardware decoding
   - Zero processamento JS

---

## 🔄 Plano de Implementação (Fases)

### Fase 1: Fundamentos (Semana 1)
- [ ] Estrutura de diretórios
- [ ] `appinfo.json` configurado
- [ ] `index.html` minimal
- [ ] `app.js` básico (apenas video element)
- [ ] Teste de reprodução HLS simples

### Fase 2: Player Core (Semana 1-2)
- [ ] Classe `HLSPlayer`
- [ ] Gerenciamento de streams
- [ ] Eventos de erro
- [ ] Watchdog básico
- [ ] Testes em emulador

### Fase 3: Comunicação (Semana 2)
- [ ] `CommandFetcher` (HTTP polling)
- [ ] Integração com backend
- [ ] Processamento de comandos
- [ ] Testes de comandos remotos

### Fase 4: Monitoramento (Semana 2-3)
- [ ] `HeartbeatService`
- [ ] Coleta de métricas
- [ ] Integração com backend
- [ ] Dashboard de monitoramento (visualizar)

### Fase 5: Fallback e Robustez (Semana 3)
- [ ] `FallbackManager`
- [ ] Fallback offline
- [ ] Watchdog em múltiplas camadas
- [ ] Auto-reload
- [ ] Testes de falhas

### Fase 6: Kiosk e Produção (Semana 3-4)
- [ ] Modo kiosk completo
- [ ] Auto-launch
- [ ] Configurações de TV (energia, screensaver)
- [ ] Documentação de deployment
- [ ] Testes em TV real

### Fase 7: Otimização e Documentação (Semana 4)
- [ ] Otimizações de performance
- [ ] Testes de stress (24h+)
- [ ] Documentação completa
- [ ] Guias de troubleshooting
- [ ] README profissional

---




-----------------  RESPOSTAS  ------------------





## ✅ Decisões Validadas e Consolidadas

### 1. Identificação Única do Hardware (UIN)

**Decisão:** ✅ **Player coleta informações do hardware para gerar UIN único**

**Implementação:**
- Player coleta identificadores únicos do hardware:
  - MAC Address (rede)
  - CPU ID (se disponível via webOS APIs)
  - Serial Number da TV (via webOS System APIs)
  - Device ID (webOS)
- Monta uma string única combinando esses identificadores
- Formato: `{MAC}:{DEVICE_ID}:{SERIAL}` ou similar
- Envia para backend via `/api/player/register` para validação e registro
- Backend valida e pode aprovar automaticamente ou requerer aprovação manual

**Fluxo:**
```
1. App inicia pela primeira vez
   ↓
2. DeviceInfoService coleta:
   - MAC Address (via webOS network API)
   - Device ID (webOS system info)
   - Serial Number (se disponível)
   ↓
3. Gera UIN: hash ou concatenação dos identificadores
   ↓
4. POST /api/player/register
   Body: { uin: "LG_AA:BB:CC:DD:EE:FF_DEV123", hardware: {...} }
   ↓
5. Backend valida e registra (ou aprova automaticamente)
   ↓
6. Player salva UIN localmente (config.json ou localStorage)
   ↓
7. Usa UIN em todas as requisições subsequentes
```

**Configuração:** appinfo.json + config.json (config.json gerado após primeiro registro)

### 2. Fallback Offline

**Decisão:** ✅ **Suporte a múltiplas fontes de fallback (Pendrive/USB, SSD, Cache)**

**Prioridade:**
1. Pendrive/USB (mais confiável para produção)
2. SSD interno (se disponível)
3. Cache local (último recurso)

**Implementação:**
```javascript
const FALLBACK_PATHS = [
  '/media/usb/fallback.mp4',      // Pendrive/USB (prioritário)
  '/media/internal/fallback.mp4', // SSD interno
  '/tmp/cache/fallback.mp4'       // Cache local
];
```

### 3. Playlist Dinâmica

**Decisão:** ✅ **Backend gera playlist HLS única, player apenas reproduz**

**Por quê:**
- Compatível com IAs que geram playlists dinamicamente
- Backend pode ajustar conteúdo baseado em:
  - Horário do dia
  - Parâmetros de IA
  - Campanhas ativas
  - Analytics e métricas
- Player não precisa processar lógica de playlist
- Máxima eficiência e CPU baixo

### 4. Comunicação: HTTP Polling + WebSocket

**Decisão:** ✅ **Ambos implementados**

**Estratégia:**
- **HTTP Polling (primário):** Simples, robusto, CPU baixo
- **WebSocket (opcional/futuro):** Para atualizações instantâneas quando IAs alterarem playlists dinamicamente

**Quando usar WebSocket:**
- Após implementação de integração com IAs
- Quando playlist precisa mudar instantaneamente baseado em eventos
- Para feedback em tempo real de analytics

### 5. Volume

**Decisão:** ✅ **Seguir padrão signage (muted por padrão, controlável via API)**

**Implementação:**
- Padrão: `muted = true` (sempre sem som inicialmente)
- API permite controlar: `{ action: "SET_VOLUME", volume: 0.5 }`
- Configurável por totem no backend
- Respeita políticas de signage (geralmente sem som)

### 6. Logs

**Decisão:** ✅ **Enviar logs ao backend conforme rotinas já definidas**

**Implementação:**
- Console.log local (para debug)
- Envio periódico via heartbeat: `POST /api/player/heartbeat`
- Envio via endpoint específico se necessário: `POST /api/player/debug`
- Backend processa conforme sistema de logs existente (EventLogService, PlayerDebugService)

### 7. Atualizações (OTA)

**Decisão:** ✅ **OTA update via backend + auto-install**

**Fluxo:**
```
1. Backend detecta nova versão disponível
   ↓
2. Envia comando via polling/websocket:
   { action: "UPDATE", version: "1.1.0", url: "http://..." }
   ↓
3. Player baixa novo .ipk
   ↓
4. Valida assinatura/integridade
   ↓
5. Instala automaticamente (via ares-install)
   ↓
6. Reinicia app
```

### 8. Certificados e Configuração

**Decisão:** ✅ **Config file gerado pelo backend + script de instalação**

**Processo:**
- Backend gera config.json customizado por TV
- Script de instalação baixa config.json durante setup
- Config.json contém:
  - UIN (após registro)
  - API_URL
  - Token inicial
  - Configurações específicas do totem

### 9. Build/Deploy

**Decisão:** ✅ **Scripts automatizados (build.sh, deploy.sh)**

**Scripts necessários:**
- `build.sh` - Compilar e empacotar .ipk
- `deploy.sh` - Instalar em TV específica
- `package.sh` - Criar pacote distribuível
- `setup.sh` - Setup inicial (baixa config do backend) 

---

## 💡 Melhorias Futuras (Fase 2)

### 1. Multi-Stream / VideoWall ✅ CONFIRMADO

**Conceito:** Suporte a múltiplos streams simultâneos na mesma tela (split screen / zonas)

**Caso de Uso:**
- Montar uma video wall distribuindo um ou vários vídeos entre as telas
- Dividir tela em zonas independentes (ex: vídeo principal + banner lateral)
- Sincronização entre múltiplas TVs para criar uma experiência unificada

**Implementação Futura:**
- Suporte a múltiplos elementos `<video>` simultâneos
- Layout manager para gerenciar zonas
- Sincronização via backend (comandos coordenados)
- Cada zona pode ter seu próprio stream HLS

### 2. Analytics Avançado ✅ CONFIRMADO

**Features:**
- Tracking de atenção (detecção de pessoas na frente da tela - se houver câmera)
- Métricas de engajamento
- Análise de audiência
- Relatórios em tempo real

**Integração:** Backend já possui sistema de analytics (AnalyticsService), player envia métricas

### 3. IA Integration ✅ CONFIRMADO

**Features:**
- Geração automática de playlists via IA
- Otimização de conteúdo baseado em:
  - Horário do dia
  - Localização
  - Perfil de audiência
  - Eventos em tempo real
- Personalização dinâmica de conteúdo

**Integração:** Backend já possui SmartPlaylistService e AIService, player consome playlists geradas

### 4. Multi-Plataforma ✅ CONFIRMADO

**Estratégia:**
- Versões para Samsung Tizen (próxima após LG)
- Versões para Android TV (se necessário)
- Arquitetura modular permite reutilização de código core

**Benefício:** Base de código comum, apenas adaptações específicas de plataforma 

---

## 📚 Documentação Necessária

1. **README.md**
   - Visão geral do projeto
   - Quick start
   - Features principais
   - Links para outras docs

2. **docs/ARCHITECTURE.md**
   - Arquitetura detalhada
   - Diagramas
   - Fluxos principais
   - Decisões técnicas

3. **docs/INSTALLATION.md**
   - Pré-requisitos
   - Instalação do webOS SDK
   - Configuração do ambiente
   - Primeiro build

4. **docs/DEPLOYMENT.md**
   - Build do app
   - Instalação na TV
   - Configuração de kiosk
   - Auto-launch

5. **docs/PRODUCTION-24x7.md**
   - Configurações da TV
   - Watchdog físico
   - Monitoramento
   - Manutenção

6. **docs/TROUBLESHOOTING.md**
   - Problemas comuns
   - Soluções
   - Logs e debug
   - Contato/suporte

7. **docs/API.md**
   - Endpoints do backend
   - Formato de dados
   - Exemplos
   - Autenticação

---

## ✅ Checklist de Validação

Antes de considerar completo:

- [ ] Player reproduz HLS corretamente
- [ ] CPU < 10% durante reprodução
- [ ] Hardware decoding ativo
- [ ] Watchdog funciona (testado)
- [ ] Fallback offline funciona
- [ ] Comandos remotos funcionam
- [ ] Heartbeat funciona
- [ ] Modo kiosk ativo
- [ ] Auto-launch funciona
- [ ] Testado 24h+ sem interrupção
- [ ] Documentação completa
- [ ] Scripts de build/deploy funcionam
- [ ] README profissional

---

## 🎯 Próximos Passos Imediatos

1. **Revisar este documento**
   - Validar decisões técnicas
   - Responder perguntas pendentes
   - Ajustar conforme necessário

2. **Validar com backend**
   - Confirmar endpoints disponíveis
   - Testar formato de dados
   - Validar autenticação

3. **Criar estrutura inicial**
   - Diretórios
   - Arquivos básicos
   - Configurações

4. **Implementar fase por fase**
   - Seguir plano de implementação
   - Testar incrementalmente
   - Documentar progresso

---

---

## 🔗 Integração Total com Smart Signage Pro

**IMPORTANTE:** Este módulo será o **cliente oficial LG Player** do sistema Smart Signage Pro.

### Princípios de Integração

1. **Uso Exclusivo dos Endpoints Existentes**
   - Todos os endpoints já implementados no backend serão utilizados
   - Nenhuma modificação no backend será necessária (exceto melhorias futuras)
   - Player se adapta ao formato de dados existente

2. **Conformidade com Regras do Backend**
   - Sistema de UIN e validação
   - Autenticação via tokens HMAC
   - Heartbeat e monitoramento
   - Sistema de logs e debug
   - Auto-registro quando necessário

3. **Compatibilidade com Funcionalidades Existentes**
   - Playlists e campanhas
   - Analytics e relatórios
   - Sistema de comandos remotos
   - Notificações e alertas
   - Gerenciamento de totens

4. **Preparado para Expansões Futuras**
   - Integração com IAs (quando implementadas)
   - WebSocket para atualizações dinâmicas
   - Multi-stream / VideoWall
   - Analytics avançado

---

**Status:** ✅ **PLANEJAMENTO VALIDADO E CONSOLIDADO - PRONTO PARA IMPLEMENTAÇÃO**

**Última atualização:** 2025-12-19
**Versão:** 1.1 (Validações e decisões consolidadas pelo usuário)

