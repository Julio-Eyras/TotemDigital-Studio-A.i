# Arquitetura de Mensageria para Players - Smart Signage Pro

## 🎯 Objetivos

1. **Comunicação em Tempo Real** entre backend e players
2. **Comandos Remotos** para controle dos players
3. **Atualizações de Playlist** sem reiniciar o player
4. **Monitoramento** do status dos players
5. **Sincronização** para efeitos visuais (FX)

---

## 🏗️ Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  REST API   │  │  WebSocket   │  │  MQTT Broker │      │
│  │   Server    │  │   Server     │  │  (Mosquitto) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          │ HTTP/HTTPS        │ WebSocket        │ MQTT
          │                  │                  │
    ┌─────┴──────┐    ┌──────┴──────┐    ┌─────┴──────┐
    │            │    │              │    │            │
┌───▼────────┐  │ ┌──▼──────────┐  │ ┌──▼──────────┐ │
│  Player 1  │  │ │  Player 2   │  │ │  Player 3   │ │
│ (webOS)    │  │ │ (Tizen)     │  │ │ (Android)   │ │
└────────────┘  │ └──────────────┘  │ └─────────────┘ │
                │                  │                  │
            ┌───▼──────────────────▼──────────────────▼───┐
            │         Rede (Internet/Local)                │
            └──────────────────────────────────────────────┘
```

---

## 📡 Protocolos de Comunicação

### 1. HTTP/HTTPS (REST API) - Base

**Uso:**
- Autenticação inicial
- Download de playlists
- Download de mídias
- Upload de logs/telemetria
- Configurações iniciais

**Vantagens:**
- ✅ Funciona em todas as plataformas
- ✅ Fácil de implementar
- ✅ Suporta autenticação (JWT)
- ✅ Cacheável

**Desvantagens:**
- ❌ Não é tempo real
- ❌ Requer polling para atualizações
- ❌ Overhead de requisições

**Exemplo:**
```javascript
// Obter playlist
GET /api/player/playlist?totemId=123
Authorization: Bearer <token>

// Enviar heartbeat
POST /api/player/heartbeat
{
  "totemId": "123",
  "status": "playing",
  "currentMedia": "media-456"
}
```

---

### 2. WebSockets - Tempo Real (Recomendado)

**Uso:**
- Comandos remotos instantâneos
- Atualizações de playlist em tempo real
- Status do player em tempo real
- Notificações

**Vantagens:**
- ✅ Comunicação bidirecional
- ✅ Baixa latência
- ✅ Eficiente (uma conexão persistente)
- ✅ Suporta reconexão automática

**Desvantagens:**
- ⚠️ Requer suporte na plataforma
- ⚠️ Pode ser bloqueado por firewall/proxy
- ⚠️ Precisa gerenciar reconexão

**Implementação:**

#### Backend (Node.js)
```javascript
// Usando Socket.IO ou ws
const io = require('socket.io')(server);

io.on('connection', (socket) => {
  // Autenticar
  socket.on('authenticate', async (token) => {
    const user = await verifyToken(token);
    socket.totemId = user.totemId;
    socket.join(`totem:${user.totemId}`);
  });

  // Heartbeat
  socket.on('heartbeat', (data) => {
    // Atualizar status do totem
    updateTotemStatus(socket.totemId, data);
  });

  // Desconexão
  socket.on('disconnect', () => {
    markTotemOffline(socket.totemId);
  });
});

// Enviar comando para totem
function sendCommandToTotem(totemId, command) {
  io.to(`totem:${totemId}`).emit('command', command);
}
```

#### Player (webOS/Tizen/Android)
```javascript
class WebSocketService {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl;
    this.token = token;
    this.socket = null;
    this.reconnectInterval = 5000;
  }

  connect() {
    this.socket = new WebSocket(`${this.apiUrl}?token=${this.token}`);

    this.socket.onopen = () => {
      console.log('WebSocket conectado');
      this.authenticate();
      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.socket.onclose = () => {
      console.log('WebSocket desconectado, tentando reconectar...');
      setTimeout(() => this.connect(), this.reconnectInterval);
    };
  }

  authenticate() {
    this.send({
      type: 'authenticate',
      token: this.token
    });
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  startHeartbeat() {
    setInterval(() => {
      this.send({
        type: 'heartbeat',
        totemId: this.totemId,
        status: this.getCurrentStatus(),
        timestamp: new Date().toISOString()
      });
    }, 30000); // 30 segundos
  }

  handleMessage(message) {
    switch (message.type) {
      case 'command':
        this.handleCommand(message.command);
        break;
      case 'update_playlist':
        this.updatePlaylist(message.playlist);
        break;
      case 'restart':
        this.restart();
        break;
    }
  }
}
```

---

### 3. MQTT - Para FX e Sincronização

**Uso:**
- Efeitos visuais sincronizados (SmartDisplayFX)
- Telemetria de múltiplos totens
- Sincronização de tempo entre totens
- Pub/Sub para eventos

**Vantagens:**
- ✅ Pub/Sub eficiente
- ✅ Ideal para múltiplos subscribers
- ✅ Sincronização precisa
- ✅ Baixo overhead

**Desvantagens:**
- ⚠️ Requer broker MQTT (Mosquitto)
- ⚠️ Configuração adicional
- ⚠️ Pode não estar disponível em todas as plataformas

**Implementação:**

#### Backend
```javascript
const mqtt = require('mqtt');
const broker = mqtt.connect('mqtt://localhost:1883');

// Publicar efeito para um site
function publishEffect(siteId, effect) {
  broker.publish(
    `smartdisplay/${siteId}/effect`,
    JSON.stringify(effect)
  );
}

// Publicar timeline
function publishTimeline(siteId, timeline) {
  broker.publish(
    `smartdisplay/${siteId}/timeline`,
    JSON.stringify(timeline)
  );
}
```

#### Player
```javascript
class MQTTService {
  constructor(brokerUrl, siteId) {
    this.brokerUrl = brokerUrl;
    this.siteId = siteId;
    this.client = null;
  }

  connect() {
    this.client = mqtt.connect(this.brokerUrl);

    this.client.on('connect', () => {
      console.log('MQTT conectado');
      
      // Subscrever em tópicos do site
      this.client.subscribe(`smartdisplay/${this.siteId}/effect`);
      this.client.subscribe(`smartdisplay/${this.siteId}/timeline`);
      this.client.subscribe(`smartdisplay/${this.siteId}/sync_time`);
    });

    this.client.on('message', (topic, message) => {
      const data = JSON.parse(message.toString());
      this.handleMessage(topic, data);
    });
  }

  handleMessage(topic, data) {
    if (topic.includes('/effect')) {
      this.applyEffect(data);
    } else if (topic.includes('/timeline')) {
      this.updateTimeline(data);
    } else if (topic.includes('/sync_time')) {
      this.syncTime(data);
    }
  }
}
```

---

## 🔄 Fluxo de Comunicação

### Inicialização do Player

```
1. Player inicia
   ↓
2. Carrega configuração (UIN, API URL)
   ↓
3. Autentica via REST API
   GET /api/player/validate?uin=xxx
   ↓
4. Recebe token JWT
   ↓
5. Conecta WebSocket com token
   ↓
6. Envia heartbeat inicial
   ↓
7. Recebe playlist atual
   ↓
8. Inicia reprodução
```

### Atualização de Playlist

```
1. Admin atualiza playlist no backend
   ↓
2. Backend valida e salva
   ↓
3. Backend envia comando via WebSocket
   {
     type: "update_playlist",
     playlist: { ... }
   }
   ↓
4. Player recebe comando
   ↓
5. Player baixa novas mídias (se necessário)
   ↓
6. Player atualiza playlist local
   ↓
7. Player continua reprodução (ou reinicia)
   ↓
8. Player confirma atualização via heartbeat
```

### Comando Remoto

```
1. Admin envia comando (ex: screenshot)
   POST /api/totems/123/command
   {
     command: "screenshot"
   }
   ↓
2. Backend valida e envia via WebSocket
   {
     type: "command",
     command: "screenshot"
   }
   ↓
3. Player recebe comando
   ↓
4. Player executa comando
   ↓
5. Player envia resultado
   {
     type: "command_result",
     command: "screenshot",
     result: { url: "..." }
   }
   ↓
6. Backend armazena resultado
```

---

## 💓 Sistema de Heartbeat

### Frequência

| Estado | Intervalo | Razão |
|--------|-----------|-------|
| Reproduzindo | 10 segundos | Monitoramento ativo |
| Pausado | 30 segundos | Monitoramento normal |
| Standby | 60 segundos | Economia de recursos |
| Erro | 5 segundos | Alertas rápidos |

### Dados Enviados

```json
{
  "type": "heartbeat",
  "totemId": "123",
  "timestamp": "2025-12-19T18:00:00Z",
  "status": {
    "state": "playing",  // playing, paused, stopped, error
    "currentMedia": {
      "id": "media-456",
      "name": "video.mp4",
      "type": "video",
      "position": 120.5,  // segundos
      "duration": 300.0
    },
    "playlist": {
      "id": "playlist-789",
      "name": "Campanha Verão",
      "currentIndex": 2,
      "totalItems": 10
    },
    "system": {
      "uptime": 3600,  // segundos
      "memory": 512,    // MB
      "cpu": 25.5,      // %
      "temperature": 45 // °C (se disponível)
    },
    "network": {
      "connected": true,
      "latency": 50,    // ms
      "bandwidth": 10   // Mbps
    },
    "errors": []  // Lista de erros recentes
  }
}
```

### Tratamento no Backend

```javascript
// Marcar totem como offline se não receber heartbeat
const HEARTBEAT_TIMEOUT = 120000; // 2 minutos

const totemStatus = new Map();

function updateHeartbeat(totemId, data) {
  totemStatus.set(totemId, {
    ...data,
    lastHeartbeat: Date.now(),
    online: true
  });
}

// Verificar totens offline periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [totemId, status] of totemStatus.entries()) {
    if (now - status.lastHeartbeat > HEARTBEAT_TIMEOUT) {
      status.online = false;
      // Notificar admin
      notifyTotemOffline(totemId);
    }
  }
}, 30000); // Verificar a cada 30 segundos
```

---

## 🛡️ Segurança

### Autenticação

1. **Token JWT** para REST API
2. **Token JWT** passado no WebSocket (query string ou header)
3. **Validação** de origem (IP whitelist opcional)
4. **Rate limiting** para prevenir abuso

### Criptografia

- **HTTPS/WSS** obrigatório em produção
- **Certificados SSL** válidos
- **TLS 1.2+** mínimo

### Validação

- **Validação de UIN** (Unique Identification Number)
- **Vinculação MAC address** (opcional)
- **Assinatura digital** de comandos críticos

---

## 📊 Monitoramento e Logs

### Métricas Coletadas

- Latência de comunicação
- Taxa de sucesso de comandos
- Frequência de reconexões
- Uso de banda
- Erros e exceções

### Alertas

- Totem offline (> 2 minutos sem heartbeat)
- Erro crítico no player
- Falha de comunicação
- Playlist vazia ou inválida

---

## 🔧 Implementação por Plataforma

### LG webOS

```javascript
// webOS suporta WebSocket nativo
const ws = new WebSocket('wss://api.example.com/ws');

// Para MQTT, usar biblioteca JavaScript
import mqtt from 'mqtt';
const client = mqtt.connect('ws://mqtt.example.com:9001');
```

### Samsung Tizen

```javascript
// Tizen Web API suporta WebSocket
const ws = new WebSocket('wss://api.example.com/ws');

// MQTT via biblioteca JavaScript
```

### Android TV

```kotlin
// Usar OkHttp WebSocket
val client = OkHttpClient()
val request = Request.Builder()
    .url("wss://api.example.com/ws")
    .build()
val ws = client.newWebSocket(request, object : WebSocketListener() {
    // ...
})

// MQTT via Paho MQTT Client
val client = MqttAndroidClient(context, "tcp://mqtt.example.com:1883", "clientId")
```

---

## 📝 Próximos Passos

- [ ] Implementar WebSocket server no backend
- [ ] Criar SDK de mensageria para players
- [ ] Implementar sistema de heartbeat
- [ ] Testar em cada plataforma
- [ ] Documentar protocolo completo
- [ ] Implementar reconexão automática
- [ ] Adicionar métricas e monitoramento

---

**Última atualização:** 2025-12-19
**Versão:** 1.0

