# 📋 Plano de Desenvolvimento - SmartSignage-LG-PLAYER-HLS

## 🎯 Objetivo do Módulo

Desenvolver um player completo e otimizado para **LG Smart TVs (webOS)** que:
1. Utilize **HLS (HTTP Live Streaming)** nativo do webOS
2. Se integre perfeitamente com o backend Smart Signage Pro
3. Suporte todas as funcionalidades do sistema (playlists, campanhas, analytics)
4. Seja robusto, performático e fácil de manter

---

## 📊 Análise do Contexto Atual

### Situação Atual

**O que temos:**
- ✅ Backend completo (Node.js/Express)
- ✅ Sistema de playlists e campanhas funcionando
- ✅ API REST para comunicação
- ✅ Estrutura básica do player webOS criada
- ✅ Media Player básico implementado (vídeo/imagem/HTML)

**O que falta:**
- ❌ Integração completa com backend
- ❌ Suporte nativo a HLS
- ❌ Módulos core (API Client, Playlist Manager, Heartbeat)
- ❌ Sistema de mensageria (WebSocket/MQTT)
- ❌ Otimizações específicas do webOS
- ❌ Testes em TV real

### Por que HLS?

**Vantagens do HLS para Smart Signage:**
1. ✅ **Nativo no webOS** - Suporte built-in, melhor performance
2. ✅ **Adaptive Bitrate** - Ajusta qualidade baseado na conexão
3. ✅ **Cache eficiente** - Segmentos podem ser cacheados
4. ✅ **Interrupção e retomada** - Melhor tratamento de erros de rede
5. ✅ **Padrão da indústria** - Compatível com CDNs e infraestrutura de streaming

**Considerações:**
- HLS funciona melhor com vídeos longos ou streaming ao vivo
- Para imagens e conteúdo estático, podemos manter HTTP direto
- Backend precisa servir arquivos HLS (.m3u8 + segmentos .ts)

---

## 🏗️ Arquitetura Proposta

### Visão Geral

```
┌─────────────────────────────────────────────────────────┐
│              Backend Smart Signage Pro                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   REST API   │  │  WebSocket   │  │  HLS Server  │  │
│  │  (Playlists) │  │  (Commands)  │  │  (Streaming) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          │ HTTP/HTTPS        │ WebSocket        │ HLS (.m3u8)
          │                  │                  │
    ┌─────┴──────────────────┴──────────────────┴─────┐
    │          SmartSignage-LG-PLAYER-HLS              │
    │  ┌──────────────────────────────────────────┐   │
    │  │  Core Modules                            │   │
    │  │  ├─ APIClient (REST)                    │   │
    │  │  ├─ WebSocketClient                     │   │
    │  │  ├─ PlaylistManager                     │   │
    │  │  ├─ HLSPlayer (webOS native)            │   │
    │  │  ├─ MediaPlayer (fallback)              │   │
    │  │  ├─ HeartbeatService                    │   │
    │  │  └─ ConfigManager                       │   │
    │  └──────────────────────────────────────────┘   │
    │  ┌──────────────────────────────────────────┐   │
    │  │  webOS Specific                          │   │
    │  │  ├─ webOS APIs (brightness, power)      │   │
    │  │  ├─ Device Info                         │   │
    │  │  └─ System Integration                  │   │
    │  └──────────────────────────────────────────┘   │
    └──────────────────────────────────────────────────┘
```

### Estrutura de Diretórios Proposta

```
SmartSignage-LG-PLAYER-HLS/
├── app/                           # webOS app metadata
│   ├── appinfo.json              # App manifest
│   └── info.json                 # App info
│
├── src/                           # Código fonte
│   ├── index.html                # Entry point
│   ├── css/
│   │   └── styles.css            # Estilos
│   │
│   └── js/
│       ├── app.js                # Aplicação principal
│       │
│       ├── core/                 # Módulos core (sem dependências webOS)
│       │   ├── api/
│       │   │   └── APIClient.js          # Cliente REST
│       │   ├── websocket/
│       │   │   └── WebSocketClient.js    # Cliente WebSocket
│       │   ├── playlist/
│       │   │   └── PlaylistManager.js    # Gerenciador de playlist
│       │   ├── heartbeat/
│       │   │   └── HeartbeatService.js   # Serviço de heartbeat
│       │   ├── config/
│       │   │   └── ConfigManager.js      # Gerenciador de configuração
│       │   └── utils/
│       │       ├── Logger.js             # Sistema de logs
│       │       ├── Cache.js              # Cache local
│       │       └── ErrorHandler.js       # Tratamento de erros
│       │
│       ├── player/               # Players de mídia
│       │   ├── HLSPlayer.js             # Player HLS (webOS native)
│       │   ├── MediaPlayer.js           # Player genérico (fallback)
│       │   └── PlayerFactory.js         # Factory para escolher player
│       │
│       └── webos/                # Específico do webOS
│           ├── WebOSAPI.js              # Wrapper para APIs webOS
│           ├── DeviceInfo.js            # Informações do dispositivo
│           └── SystemIntegration.js     # Integração com sistema
│
├── config/                        # Configurações
│   └── config.json               # Configuração do player
│
├── assets/                        # Assets estáticos
│   ├── icons/                    # Ícones
│   └── fonts/                    # Fontes (se necessário)
│
├── build/                         # Scripts de build
│   ├── build.sh                  # Script de build
│   └── deploy.sh                 # Script de deploy
│
├── docs/                          # Documentação
│   ├── README.md                 # Documentação principal
│   ├── API.md                    # Documentação da API
│   ├── DEPLOYMENT.md             # Guia de deployment
│   └── TROUBLESHOOTING.md        # Troubleshooting
│
├── tests/                         # Testes (se implementarmos)
│   └── unit/                     # Testes unitários
│
├── package.json                  # Dependências (se necessário)
├── .gitignore
└── README.md                     # Overview do projeto
```

---

## 🎨 Decisões de Design

### 1. HLS vs HTTP Direto

**Estratégia Híbrida Proposta:**

```javascript
// Pseudocódigo
class PlayerFactory {
  static createPlayer(mediaItem) {
    if (mediaItem.type === 'video' && mediaItem.format === 'hls') {
      return new HLSPlayer(); // Usa <video> com src HLS
    } else if (mediaItem.type === 'video') {
      // Converter para HLS ou usar fallback
      if (supportsHLSConversion()) {
        return new HLSPlayer(convertToHLS(mediaItem.url));
      } else {
        return new MediaPlayer(); // Fallback HTTP direto
      }
    } else if (mediaItem.type === 'image') {
      return new ImagePlayer(); // HTTP direto (imagens não precisam HLS)
    } else if (mediaItem.type === 'html') {
      return new HTMLPlayer(); // HTTP direto (iframe)
    }
  }
}
```

**Pergunta para discussão:**
- Backend deve converter automaticamente todos os vídeos para HLS?
- Ou player detecta e converte sob demanda?
- Ou ambos (conversão no backend + fallback no player)?

### 2. Comunicação com Backend

**Abordagem Proposta:**

1. **REST API (HTTP/HTTPS)**
   - Autenticação inicial
   - Buscar playlist
   - Upload de logs/telemetria
   - Download de configurações

2. **WebSocket (Tempo Real)**
   - Comandos remotos
   - Atualizações de playlist
   - Status do player

3. **HLS (Streaming)**
   - Apenas para reprodução de vídeo
   - URLs servidas pelo backend

**Pergunta para discussão:**
- Usar WebSocket ou HTTP Polling para atualizações?
- WebSocket é mais eficiente, mas pode ter problemas em alguns ambientes corporativos

### 3. Cache e Offline

**Estratégia Proposta:**

```javascript
// Níveis de cache
1. Playlist Cache (IndexedDB)
   - Última playlist baixada
   - Metadata das mídias
   - Timestamps de validade

2. Media Cache (Browser Cache + IndexedDB)
   - Segmentos HLS cacheados
   - Imagens baixadas
   - Configurações

3. Offline Mode
   - Reproduzir última playlist conhecida
   - Tentar reconectar periodicamente
   - Logar eventos para upload posterior
```

**Pergunta para discussão:**
- Quanto espaço reservar para cache?
- Estratégia de eviction (LRU? TTL? Híbrido?)

### 4. Heartbeat e Monitoramento

**Frequência Proposta:**

| Estado | Intervalo | Dados Enviados |
|--------|-----------|----------------|
| Reproduzindo | 10s | Status, mídia atual, posição |
| Pausado | 30s | Status básico |
| Standby | 60s | Apenas "online" |
| Erro | 5s | Detalhes do erro |

**Dados do Heartbeat:**
```javascript
{
  totemId: string,
  timestamp: ISO8601,
  status: {
    state: 'playing' | 'paused' | 'stopped' | 'error',
    currentMedia: {
      id: string,
      type: string,
      position: number,
      duration: number
    },
    playlist: {
      id: string,
      currentIndex: number,
      totalItems: number
    },
    system: {
      uptime: number,
      memory: number,
      network: {
        latency: number,
        bandwidth: number
      }
    },
    errors: Array<ErrorInfo>
  }
}
```

**Pergunta para discussão:**
- Que métricas são mais importantes?
- Enviar telemetria detalhada ou apenas o essencial?

---

## 🔧 Componentes Principais

### 1. APIClient

**Responsabilidades:**
- Autenticação do totem
- Buscar playlist do backend
- Enviar heartbeat
- Upload de logs/telemetria
- Buscar configurações

**Interface Proposta:**
```javascript
class APIClient {
  constructor(apiUrl, totemUIN, totemSecret) {}
  
  // Autenticação
  async authenticate() : Promise<AuthResult>
  
  // Playlist
  async getPlaylist() : Promise<Playlist>
  async getPlaylistVersion() : Promise<number>
  
  // Heartbeat
  async sendHeartbeat(data: HeartbeatData) : Promise<void>
  
  // Logs/Telemetria
  async sendLog(log: LogEntry) : Promise<void>
  async sendTelemetry(telemetry: TelemetryData) : Promise<void>
  
  // Configurações
  async getConfig() : Promise<Config>
  
  // Mídias
  async getMediaUrl(mediaId: string) : Promise<string>
}
```

**Pergunta para discussão:**
- Usar token JWT ou autenticação por UIN/Secret?
- Backend já suporta qual método?

### 2. PlaylistManager

**Responsabilidades:**
- Gerenciar playlist atual
- Controlar ordem de reprodução
- Filtrar por agendamento
- Cache de playlist

**Interface Proposta:**
```javascript
class PlaylistManager {
  constructor(apiClient: APIClient, scheduler: Scheduler, cache: Cache) {}
  
  // Carregamento
  async loadPlaylist() : Promise<void>
  async reloadPlaylist() : Promise<void>
  
  // Navegação
  getCurrentItem() : PlaylistItem | null
  getNextItem() : PlaylistItem | null
  getPreviousItem() : PlaylistItem | null
  
  // Estado
  getCurrentIndex() : number
  getTotalItems() : number
  needsUpdate(interval: number) : boolean
  
  // Agendamento
  filterBySchedule(items: PlaylistItem[]) : PlaylistItem[]
}
```

**Pergunta para discussão:**
- Como lidar com itens que não devem ser exibidos no momento atual (agendamento)?
- Pular automaticamente ou pausar?

### 3. HLSPlayer

**Responsabilidades:**
- Reproduzir conteúdo HLS usando recursos nativos do webOS
- Gerenciar ciclo de vida do player
- Tratamento de erros de rede
- Eventos de reprodução

**Interface Proposta:**
```javascript
class HLSPlayer {
  constructor(container: HTMLElement) {}
  
  // Controle
  async play(item: PlaylistItem) : Promise<void>
  pause() : void
  stop() : void
  seek(position: number) : void
  
  // Estado
  getCurrentTime() : number
  getDuration() : number
  getState() : 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'
  
  // Eventos
  on(event: string, callback: Function) : void
  // Events: 'play', 'pause', 'ended', 'error', 'buffering', 'buffered'
}
```

**Considerações Técnicas:**
- webOS suporta HLS nativamente via `<video>` element
- Basta usar: `<video src="playlist.m3u8"></video>`
- webOS automaticamente gerencia segmentos e bitrate

**Pergunta para discussão:**
- Implementar player customizado ou usar apenas `<video>` nativo?
- Native é mais simples e performático, mas menos controle

### 4. WebSocketClient

**Responsabilidades:**
- Conectar ao backend via WebSocket
- Enviar/receber comandos
- Reconexão automática
- Manter conexão viva

**Interface Proposta:**
```javascript
class WebSocketClient {
  constructor(wsUrl: string, token: string) {}
  
  // Conexão
  connect() : Promise<void>
  disconnect() : void
  isConnected() : boolean
  
  // Comunicação
  send(command: Command) : void
  on(event: string, callback: Function) : void
  // Events: 'command', 'update_playlist', 'restart', 'config_update'
  
  // Reconexão
  setReconnectStrategy(strategy: ReconnectStrategy) : void
}
```

**Pergunta para discussão:**
- Backend já tem WebSocket server implementado?
- Qual protocolo usar (Socket.IO, ws nativo, outros)?

### 5. HeartbeatService

**Responsabilidades:**
- Enviar heartbeat periódico
- Coletar métricas do sistema
- Gerenciar frequência baseado no estado

**Interface Proposta:**
```javascript
class HeartbeatService {
  constructor(apiClient: APIClient, interval: number) {}
  
  start() : void
  stop() : void
  sendHeartbeat() : Promise<void>
  getSystemMetrics() : SystemMetrics
}
```

### 6. WebOSAPI (Wrapper)

**Responsabilidades:**
- Abstrair APIs específicas do webOS
- Controle de brilho
- Informações do dispositivo
- Integração com sistema

**Interface Proposta:**
```javascript
class WebOSAPI {
  // Brilho
  async setBrightness(level: number) : Promise<void>
  async getBrightness() : Promise<number>
  
  // Dispositivo
  async getDeviceInfo() : Promise<DeviceInfo>
  async getSystemInfo() : Promise<SystemInfo>
  
  // Sistema
  async keepScreenOn(timeout: number) : Promise<void>
  async reboot() : Promise<void>
}
```

---

## 🔄 Fluxos Principais

### Fluxo 1: Inicialização

```
1. App inicia
   ↓
2. Carregar configuração (UIN, API URL)
   ↓
3. Inicializar Logger, ErrorHandler, Cache
   ↓
4. Inicializar APIClient
   ↓
5. Autenticar totem (REST API)
   ↓
6. Conectar WebSocket (se habilitado)
   ↓
7. Inicializar PlaylistManager
   ↓
8. Carregar playlist do backend
   ↓
9. Inicializar Player (HLS ou fallback)
   ↓
10. Iniciar HeartbeatService
   ↓
11. Reproduzir primeiro item da playlist
```

### Fluxo 2: Reprodução de Mídia

```
1. PlaylistManager.getNextItem()
   ↓
2. Verificar agendamento (Scheduler)
   ↓
3. PlayerFactory.createPlayer(item)
   ↓
4. Se vídeo → HLSPlayer
   Se imagem → ImagePlayer
   Se HTML → HTMLPlayer
   ↓
5. Player.play(item)
   ↓
6. HLSPlayer: Carregar .m3u8 → Reproduzir
   ImagePlayer: Carregar imagem → Exibir X segundos
   HTMLPlayer: Carregar iframe → Exibir X segundos
   ↓
7. Aguardar fim da mídia
   ↓
8. Evento 'ended' → Próximo item
```

### Fluxo 3: Atualização de Playlist

```
1. WebSocket recebe 'update_playlist'
   OU
   Timer periódico dispara
   ↓
2. PlaylistManager.needsUpdate() → true
   ↓
3. APIClient.getPlaylist()
   ↓
4. PlaylistManager.loadPlaylist(newPlaylist)
   ↓
5. Filtrar por agendamento
   ↓
6. Se item atual não está mais na playlist:
   → Próximo item
   Caso contrário:
   → Continuar reprodução atual
```

### Fluxo 4: Comando Remoto

```
1. WebSocket recebe comando
   {
     type: "command",
     command: "screenshot" | "restart" | "update_config" | ...
   }
   ↓
2. Processar comando
   ↓
3. Executar ação
   - screenshot → Capturar tela → Upload
   - restart → Recarregar app
   - update_config → Recarregar configuração
   ↓
4. Enviar resultado via WebSocket ou REST
```

---

## 🛡️ Tratamento de Erros

### Estratégia Proposta

**Níveis de Erro:**

1. **Erros Críticos** (App não pode continuar)
   - Falha de autenticação
   - Playlist vazia/inválida
   - Player não consegue reproduzir nada
   
   **Ação:** Mostrar tela de erro, tentar reconectar

2. **Erros de Mídia** (Item específico falha)
   - Vídeo não carrega
   - Formato não suportado
   - Erro de rede durante streaming
   
   **Ação:** Pular para próximo item, logar erro

3. **Erros de Comunicação** (Backend inacessível)
   - Falha de conexão REST
   - WebSocket desconecta
   - Timeout de requisições
   
   **Ação:** Modo offline, usar cache, tentar reconectar

4. **Avisos** (Funcionalidade degradada)
   - Heartbeat falha (mas continua tentando)
   - Cache cheio
   - Latência alta
   
   **Ação:** Logar, continuar funcionamento normal

**Pergunta para discussão:**
- Quanto tempo tentar reconectar antes de entrar em modo offline?
- Estratégia de retry (exponencial backoff)?

---

## 📊 Performance e Otimização

### Otimizações Propostas

1. **Cache Inteligente**
   - Pré-carregar próximo item enquanto atual reproduz
   - Cache de segmentos HLS frequentes
   - Limpar cache de mídias antigas

2. **Lazy Loading**
   - Carregar playlist apenas quando necessário
   - Carregar mídias sob demanda
   - Não carregar tudo de uma vez

3. **Throttling**
   - Throttle de eventos de heartbeat
   - Debounce de atualizações de UI
   - Limitar frequência de logs

4. **Memory Management**
   - Limpar elementos DOM não utilizados
   - Liberar recursos de vídeo quando não necessário
   - Monitorar uso de memória

**Pergunta para discussão:**
- Quais métricas de performance são mais importantes?
- Tempo de carregamento? Uso de memória? CPU?

---

## 🔐 Segurança

### Considerações

1. **Autenticação**
   - Token JWT ou UIN/Secret
   - Refresh automático de tokens
   - Validação de origem (se possível)

2. **HTTPS/WSS**
   - Forçar HTTPS em produção
   - Validar certificados SSL
   - Não permitir certificados auto-assinados em produção

3. **Configuração**
   - Não expor secrets no código
   - Usar appinfo.json ou arquivo de config seguro
   - Validação de configuração

**Pergunta para discussão:**
- Como distribuir credenciais de forma segura?
- Certificados para instalação em múltiplas TVs?

---

## 📝 Plano de Implementação (Fases)

### Fase 1: Fundamentos (Semana 1-2)
- [ ] Estrutura de diretórios
- [ ] ConfigManager
- [ ] Logger
- [ ] ErrorHandler
- [ ] Cache básico

### Fase 2: Comunicação (Semana 2-3)
- [ ] APIClient (REST)
- [ ] WebSocketClient (se necessário)
- [ ] Autenticação

### Fase 3: Playlist (Semana 3-4)
- [ ] PlaylistManager
- [ ] Scheduler (agendamento)
- [ ] Integração com API

### Fase 4: Player (Semana 4-5)
- [ ] HLSPlayer (webOS native)
- [ ] MediaPlayer (fallback)
- [ ] PlayerFactory
- [ ] Suporte a imagens e HTML

### Fase 5: Integração (Semana 5-6)
- [ ] HeartbeatService
- [ ] WebOSAPI wrapper
- [ ] Integração completa

### Fase 6: Testes e Refinamento (Semana 6-7)
- [ ] Testes em emulador
- [ ] Testes em TV real
- [ ] Otimizações
- [ ] Bug fixes

### Fase 7: Documentação (Semana 7)
- [ ] README completo
- [ ] Guia de deployment
- [ ] Troubleshooting
- [ ] API documentation

---

## ❓ Perguntas para Discussão

### Técnicas

1. **HLS Conversion**
   - Backend converte todos os vídeos para HLS automaticamente?
   - Ou player detecta e converte sob demanda?
   - Ambos (conversão no backend + fallback no player)?

2. **Comunicação**
   - WebSocket ou HTTP Polling para atualizações?
   - Backend já tem WebSocket server?
   - Qual protocolo (Socket.IO, ws nativo)?

3. **Player**
   - Usar `<video>` nativo do webOS ou player customizado?
   - Native é mais simples, mas menos controle

4. **Cache**
   - Quanto espaço reservar?
   - Estratégia de eviction (LRU, TTL, híbrido)?

5. **Offline**
   - Quanto tempo tentar reconectar antes de offline?
   - Estratégia de retry?

### Funcionalidades

6. **Agendamento**
   - Pular itens fora do horário ou pausar?

7. **Heartbeat**
   - Que métricas são mais importantes?
   - Telemetria detalhada ou apenas essencial?

8. **Erros**
   - Estratégia de retry (exponencial backoff)?
   - Tempo limite de reconexão?

### Deployment

9. **Credenciais**
   - Como distribuir credenciais de forma segura?
   - Certificados para múltiplas TVs?

10. **Build/Deploy**
    - Processo automatizado de build?
    - CI/CD para deployment?

---

## 💡 Ideias e Sugestões

### Features Adicionais (Futuro)

1. **Analytics Avançado**
   - Tracking de atenção visual
   - Tempo de exibição por mídia
   - Interações do usuário (se houver)

2. **Modo Kiosk**
   - Bloquear saída do app
   - Desabilitar controles remotos
   - Auto-restart em caso de erro

3. **Multi-Tela**
   - Sincronização entre múltiplas TVs
   - Configurações por zona

4. **A/B Testing**
   - Testar diferentes playlists
   - Coletar métricas de engajamento

---

## 📚 Próximos Passos

1. **Revisar este documento**
   - Validar arquitetura proposta
   - Responder perguntas de discussão
   - Adicionar/corrigir informações

2. **Validar com Backend**
   - Confirmar endpoints disponíveis
   - Validar formato de dados
   - Testar autenticação

3. **Criar Protótipo**
   - Implementar módulos core básicos
   - Testar em emulador
   - Validar conceitos

4. **Iterar**
   - Feedback constante
   - Ajustes conforme necessário
   - Testes incrementais

---

**Status:** 📝 **PLANEJAMENTO - AGUARDANDO FEEDBACK**

**Última atualização:** 2025-12-19
**Versão:** 0.1 (Draft)

