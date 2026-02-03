# Arquitetura de Players e Rede Estrela - Smart Signage Pro

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Sistema de Registro e UIN](#sistema-de-registro-e-uin)
3. [Conexão e Operação dos Players](#conexão-e-operação-dos-players)
4. [Rede Estrela (Star Network)](#rede-estrela-star-network)
5. [Fluxos de Comunicação](#fluxos-de-comunicação)
6. [Segurança e Certificação](#segurança-e-certificação)

---

## 🎯 Visão Geral

O Smart Signage Pro utiliza uma arquitetura distribuída onde:

- **Servidor Central**: Gerencia todos os players, campanhas, mídias e configurações
- **Players (Totens)**: Dispositivos que reproduzem conteúdo (Smart TVs, SBCs, Players em C, etc.)
- **Rede Estrela**: Topologia de rede onde um broker MQTT central coordena múltiplos players
- **UIN (Unique Identification Number)**: Identificador único gerado baseado em hardware para cada player

### Arquitetura Geral

```
┌─────────────────────────────────────────────────────────┐
│              SERVIDOR CENTRAL (Backend)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │   API    │  │ Database │  │   MQTT   │  │  WebUI   │ │
│  │  REST    │  │PostgreSQL│  │  Broker  │  │  React   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
    ┌────┴────┐          ┌────┴────┐         ┌────┴────┐
    │        │          │        │         │        │
┌───▼───┐ ┌──▼───┐  ┌───▼───┐ ┌──▼───┐  ┌───▼───┐ ┌──▼───┐
│Player │ │Player│  │Player │ │Player│  │Player │ │Player│
│  #1   │ │  #2  │  │  #3   │ │  #4  │  │  #5   │ │  #6  │
│(UIN)  │ │(UIN) │  │(UIN)  │ │(UIN) │  │(UIN)  │ │(UIN) │
└───────┘ └──────┘  └───────┘ └──────┘  └───────┘ └──────┘
```

---

## 🔐 Sistema de Registro e UIN

### O que é UIN?

**UIN (Unique Identification Number)** é um identificador único gerado para cada player baseado nas características do hardware. Ele garante que cada dispositivo tenha uma identidade única e rastreável.

### Geração do UIN

O UIN é gerado usando informações do hardware:

```javascript
// Exemplo de geração de UIN (Player)
const hardwareInfo = {
  mac: "aa:bb:cc:dd:ee:ff",        // MAC Address da primeira interface de rede
  cpuId: "CPU-123456",             // ID/Serial da CPU (se disponível)
  hostname: "player-001",          // Hostname da máquina
  platform: "linux",               // Sistema operacional
  arch: "arm64",                   // Arquitetura
  serial: "SERIAL-789"              // Serial number (se disponível)
};

// UIN gerado via hash SHA256
UIN = SHA256(MAC + CPU_ID + HOSTNAME + PLATFORM + ARCH)
// Exemplo: "SSP-3a8f9b2c1d4e5f6a7b8c9d0e1f2a3b4c"
```

### Fluxo de Auto-Registro

#### 1. Primeira Instalação do Player

```
┌─────────────┐
│   Player    │
│ (Primeira   │
│  Execução)  │
└──────┬──────┘
       │
       │ 1. Coleta informações de hardware
       ▼
┌─────────────────────────┐
│ collectHardwareInfo()   │
│ - MAC Address           │
│ - CPU ID                │
│ - Hostname              │
│ - Platform              │
│ - Architecture          │
└──────┬──────────────────┘
       │
       │ 2. Gera UIN baseado em hardware
       ▼
┌─────────────────────────┐
│ generateUIN()           │
│ UIN = SHA256(hardware)   │
└──────┬──────────────────┘
       │
       │ 3. Encripta dados
       ▼
┌─────────────────────────┐
│ encryptRegistration()   │
│ Payload = {             │
│   uin, hardware,        │
│   timestamp             │
│ }                       │
└──────┬──────────────────┘
       │
       │ 4. Envia para servidor
       ▼
┌─────────────────────────┐
│ POST /api/player/register│
│ Body: {                   │
│   encryptedData,         │
│   publicHash            │
│ }                       │
└──────┬──────────────────┘
       │
       │ 5. Servidor processa
       ▼
┌─────────────────────────┐
│ Servidor:               │
│ - Decodifica payload    │
│ - Valida UIN            │
│ - Verifica hardware     │
│ - Cria totem no BD      │
│ - Status: pending_approval│
└──────┬──────────────────┘
       │
       │ 6. Resposta
       ▼
┌─────────────────────────┐
│ {                       │
│   success: true,        │
│   totem: {              │
│     id: 123,            │
│     uin: "SSP-...",     │
│     status: "pending"   │
│   },                    │
│   token: "..."          │
│ }                       │
└─────────────────────────┘
```

#### 2. Validação Subsequente

Após o registro inicial, o player valida sua identidade periodicamente:

```javascript
// Player envia validação
GET /api/player/validate?uin=SSP-3a8f9b2c...&token=...

// Servidor valida:
// - UIN existe no banco
// - Hardware info corresponde
// - Token é válido
// - Retorna status e playlist
```

### Armazenamento do UIN

O UIN é armazenado localmente no player em múltiplos locais para redundância:

1. **LocalStorage** (navegador): `localStorage.setItem('totem_uin', uin)`
2. **Arquivo de Configuração**: `config.json.enc` (encriptado)
3. **Banco de Dados do Servidor**: Tabela `totems` campo `identifier` ou `device_id`

### Validação de Hardware

O servidor valida o hardware a cada conexão para prevenir clonagem:

```sql
-- Estrutura no banco de dados
totems.config = {
  "hardware": {
    "mac": "aa:bb:cc:dd:ee:ff",
    "cpuId": "CPU-123456",
    "hostname": "player-001",
    "platform": "linux",
    "arch": "arm64",
    "serial": "SERIAL-789",
    "registeredAt": "2025-11-04T02:00:00Z",
    "hardwareHash": "hash_do_hardware"
  }
}
```

**Detecção de Mudanças:**
- Se hardware mudar → Servidor detecta e pode:
  - Bloquear totem (hardware não corresponde)
  - Solicitar re-registro
  - Alertar administrador

---

## 🔌 Conexão e Operação dos Players

### Fluxo de Conexão Inicial

```
┌──────────┐
│  Player  │
└────┬─────┘
     │
     │ 1. Player inicia
     ▼
┌─────────────────────┐
│ Carrega UIN local   │
│ (localStorage ou    │
│  config.json.enc)   │
└──────┬──────────────┘
       │
       │ 2. Valida com servidor
       ▼
┌─────────────────────┐
│ GET /api/player/     │
│ validate?uin=...     │
│ &token=...          │
└──────┬──────────────┘
       │
       │ 3. Servidor responde
       ▼
┌─────────────────────┐
│ {                   │
│   status: "online", │
│   playlist: {...},  │
│   commands: [...],  │
│   config: {...}    │
│ }                   │
└──────┬──────────────┘
       │
       │ 4. Player inicia reprodução
       ▼
┌─────────────────────┐
│ - Carrega playlist  │
│ - Baixa mídias      │
│ - Inicia heartbeat  │
│ - Processa comandos│
└─────────────────────┘
```

### Sistema de Heartbeat

O **heartbeat** é o mecanismo que mantém a conexão viva entre player e servidor.

#### Como Funciona

```javascript
// Player envia heartbeat periodicamente (padrão: 30 segundos)
POST /api/player/heartbeat
Body: {
  uin: "SSP-3a8f9b2c...",
  executedCommands: [123, 456],  // IDs de comandos executados
  metrics: {
    uptime: 3600,
    memoryUsage: 512,
    cpuUsage: 25,
    diskUsage: 60
  },
  status: "playing",
  version: "2.1.0",
  firmwareVersion: "1.0.0",
  ipAddress: "192.168.1.100",
  config: {
    resolution: "1920x1080",
    orientation: "landscape"
  }
}
```

#### Processamento no Servidor

```sql
-- Servidor atualiza:
UPDATE totems 
SET 
  last_heartbeat = CURRENT_TIMESTAMP,
  last_heartbeat = CURRENT_TIMESTAMP,
  status = 'online',
  ip_address = ?,
  version = ?,
  firmware_version = ?
WHERE identifier = ? OR device_id = ?
```

#### Benefícios do Heartbeat

1. **Monitoramento em Tempo Real**: Servidor sabe quais players estão online
2. **Detecção de Falhas**: Se heartbeat parar, player é marcado como offline
3. **Sincronização de Comandos**: Player confirma execução de comandos remotos
4. **Coleta de Métricas**: Servidor recebe estatísticas de performance

### Comandos Remotos

O servidor pode enviar comandos para os players:

```javascript
// Servidor cria comando
POST /api/remote-commands
{
  totem_id: 123,
  command_type: "restart" | "update" | "change_playlist" | "execute_script",
  command_data: {...},
  priority: "high" | "normal" | "low"
}

// Player busca comandos pendentes
GET /api/player/validate?uin=...
Response: {
  commands: [
    {
      request_id: 456,
      command_type: "restart",
      command_data: {...},
      priority: "high"
    }
  ]
}

// Player executa e confirma
POST /api/player/heartbeat
{
  executedCommands: [456]  // Confirma execução
}
```

### Sincronização de Playlist

```javascript
// 1. Player solicita playlist
GET /api/player/validate?uin=...
Response: {
  playlist: {
    playlist_id: 10,
    name: "Playlist Principal",
    items: [
      {
        item_id: 1,
        media_id: 100,
        order_index: 1,
        duration: 30,
        media: {
          name: "video.mp4",
          file_path: "/assets/uploads/video.mp4",
          media_type: "video"
        }
      }
    ]
  }
}

// 2. Player baixa mídias (se necessário)
GET /assets/uploads/video.mp4

// 3. Player armazena em cache local
localStorage.setItem('playlist_10', JSON.stringify(playlist))

// 4. Player reproduz conteúdo
```

---

## ⭐ Rede Estrela (Star Network)

### Conceito

A **Rede Estrela** é uma topologia de rede onde:

- **1 Site (Centro)** = Broker MQTT central
- **N Totens (Raios)** = Players conectados ao broker
- **Comunicação**: Todos os totens se comunicam via broker central (não diretamente entre si)

### Diagrama da Arquitetura

```
                    ┌─────────────────┐
                    │  Broker MQTT    │
                    │   (Centro)      │
                    │  Site: site-01  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │ Totem 1 │          │ Totem 2 │          │ Totem 3 │
   │(Master) │          │(Participant)│      │(Participant)│
   └─────────┘          └─────────┘          └─────────┘
```

### Componentes da Rede Estrela

#### 1. Site (Centro da Estrela)

```sql
-- Tabela: fx_sites
CREATE TABLE fx_sites (
    site_id TEXT PRIMARY KEY,              -- 'site-01', 'loja-centro', etc.
    name TEXT NOT NULL,                    -- 'Loja Centro - Andar 1'
    description TEXT,
    client_id INTEGER,                     -- Cliente dono do site
    broker_url TEXT,                       -- 'ws://mqtt-broker.local:9001'
    broker_type TEXT DEFAULT 'mqtt',       -- 'mqtt', 'websocket', 'hybrid'
    broker_config JSONB DEFAULT '{}',      -- Config do broker (auth, topics)
    sync_interval_ms INTEGER DEFAULT 2000, -- Intervalo de sincronização
    time_sync_enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true
);
```

#### 2. Relação Totem-Site

```sql
-- Tabela: fx_totem_sites
CREATE TABLE fx_totem_sites (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,             -- FK totems
    site_id TEXT NOT NULL,                 -- FK fx_sites
    role TEXT DEFAULT 'participant',       -- 'master', 'participant', 'observer'
    position_x INTEGER,                    -- Posição X na visualização
    position_y INTEGER,                    -- Posição Y na visualização
    is_active BOOLEAN DEFAULT true
);
```

**Roles (Papéis):**
- **`master`**: Totem principal (pode coordenar efeitos)
- **`participant`**: Totem participante (recebe e executa efeitos)
- **`observer`**: Totem observador (apenas recebe, não executa)

### Como Funciona a Rede Estrela

#### 1. Criação da Rede

```bash
# 1. Criar site (centro da estrela)
POST /api/smartdisplayfx/sites
{
  "site_id": "loja-centro-01",
  "name": "Loja Centro - Andar 1",
  "broker_url": "ws://mqtt-broker.local:9001",
  "client_id": 1
}

# 2. Adicionar totens ao site
POST /api/smartdisplayfx/sites/loja-centro-01/totems
{
  "totem_id": 100,
  "role": "master",
  "position_x": 0,
  "position_y": 0
}

POST /api/smartdisplayfx/sites/loja-centro-01/totems
{
  "totem_id": 101,
  "role": "participant",
  "position_x": 100,
  "position_y": 0
}
```

#### 2. Conexão dos Players ao Broker

```javascript
// Player se conecta ao broker MQTT
const mqtt = require('mqtt');
const client = mqtt.connect('ws://mqtt-broker.local:9001', {
  username: 'smartdisplay',
  password: 'secure_password'
});

// Subscrever em tópicos do site
const siteId = 'loja-centro-01';
client.subscribe(`smartdisplay/${siteId}/effect`);
client.subscribe(`smartdisplay/${siteId}/timeline`);
client.subscribe(`smartdisplay/${siteId}/sync_time`);

// Receber mensagens
client.on('message', (topic, message) => {
  const data = JSON.parse(message.toString());
  
  if (topic.includes('/effect')) {
    // Executar efeito FX
    executeEffect(data);
  } else if (topic.includes('/timeline')) {
    // Atualizar timeline
    updateTimeline(data);
  } else if (topic.includes('/sync_time')) {
    // Sincronizar tempo
    syncTime(data);
  }
});
```

#### 3. Orquestração de Efeitos

```javascript
// Servidor orquestra efeito entre totens
POST /api/smartdisplayfx/effects/orchestrate
{
  "from_totem_id": 100,
  "effect_type": "transfer",
  "target_site_id": "loja-centro-01"
}

// Servidor:
// 1. Busca totens do site (fx_totem_sites)
// 2. Prioriza totem "master" se houver
// 3. Escolhe totem de destino
// 4. Publica mensagem MQTT
mqtt.publish(`smartdisplay/loja-centro-01/effect`, {
  from_totem: 100,
  to_totem: 101,
  effect: "transfer",
  content_id: 50
});
```

### Tópicos MQTT

A rede estrela usa tópicos MQTT estruturados:

```
smartdisplay/{site_id}/effect          # Efeitos FX entre totens
smartdisplay/{site_id}/timeline         # Atualizações de timeline
smartdisplay/{site_id}/sync_time        # Sincronização de tempo
smartdisplay/{site_id}/telemetry        # Telemetria dos totens
```

### Sincronização

#### Sincronização de Tempo

```javascript
// Broker publica tempo de sincronização
mqtt.publish(`smartdisplay/${siteId}/sync_time`, {
  timestamp: Date.now(),
  server_time: new Date().toISOString()
});

// Players recebem e ajustam relógio interno
client.on('message', (topic, message) => {
  if (topic.includes('/sync_time')) {
    const { timestamp, server_time } = JSON.parse(message.toString());
    adjustLocalClock(server_time);
  }
});
```

#### Sincronização de Timeline

```javascript
// Quando timeline é gerada, broker notifica todos os totens
mqtt.publish(`smartdisplay/${siteId}/timeline`, {
  timeline_id: 123,
  items: [...],
  start_time: "2025-01-15T10:00:00Z"
});
```

### Vantagens da Rede Estrela

1. **Centralização**: Um único ponto de controle (broker)
2. **Escalabilidade**: Fácil adicionar novos totens
3. **Sincronização**: Todos os totens recebem mesmas mensagens
4. **Isolamento**: Falha em um totem não afeta outros
5. **Orquestração**: Efeitos coordenados entre múltiplos totens

### Exemplo Prático

**Cenário**: 3 totens em uma loja precisam mostrar efeito visual sincronizado

```
1. Admin cria site "loja-centro-01" com broker MQTT
2. Adiciona 3 totens ao site (1 master, 2 participants)
3. Players se conectam ao broker MQTT
4. Servidor orquestra efeito:
   - Totem 1 (master) inicia efeito
   - Broker publica mensagem para todos
   - Totem 2 e 3 recebem e executam simultaneamente
5. Efeito visual sincronizado em todos os totens
```

---

## 🔄 Fluxos de Comunicação

### Fluxo Completo: Player → Servidor

```
┌──────────┐                    ┌──────────┐
│  Player   │                    │ Servidor│
└────┬─────┘                    └────┬─────┘
     │                              │
     │ 1. GET /api/player/validate  │
     │    ?uin=SSP-...&token=...    │
     ├─────────────────────────────>│
     │                              │
     │                              │ 2. Valida UIN
     │                              │    Busca totem
     │                              │    Verifica hardware
     │                              │
     │ 3. Response:                │
     │    {status, playlist,        │
     │     commands, config}        │
     │<─────────────────────────────┤
     │                              │
     │ 4. POST /api/player/heartbeat│
     │    {uin, metrics, ...}      │
     ├─────────────────────────────>│
     │                              │
     │                              │ 5. Atualiza last_heartbeat
     │                              │    Processa comandos
     │                              │
     │ 6. Response: {success}       │
     │<─────────────────────────────┤
     │                              │
     │ [Repete heartbeat a cada 30s] │
     │                              │
```

### Fluxo: Rede Estrela (MQTT)

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│ Totem 1  │      │  Broker  │      │ Totem 2  │
│ (Master) │      │   MQTT   │      │(Participant)│
└────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │
     │ 1. Connect      │                 │
     ├────────────────>│                 │
     │                 │                 │
     │                 │ 2. Connect      │
     │                 │<────────────────┤
     │                 │                 │
     │ 3. Subscribe    │                 │
     │    /effect       │                 │
     ├────────────────>│                 │
     │                 │                 │
     │                 │ 4. Subscribe    │
     │                 │    /effect      │
     │                 │<────────────────┤
     │                 │
     │ 5. Publish      │                 │
     │    effect data  │                 │
     ├────────────────>│                 │
     │                 │                 │
     │                 │ 6. Broadcast   │
     │                 │    to all       │
     │                 ├────────────────>│
     │                 │                 │
     │                 │                 │ 7. Receive
     │                 │                 │    Execute effect
```

---

## 🔒 Segurança e Certificação

### Token de Validação

O servidor gera tokens HMAC para validar players:

```javascript
// Servidor gera token
function generateTotemToken(uin: string): string {
  const timestamp = Date.now();
  const data = `${uin}:${timestamp}`;
  const token = crypto
    .createHmac('sha256', TOTEM_SECRET_KEY)
    .update(data)
    .digest('hex');
  return `${timestamp}:${token}`;
}

// Player valida token
function validateTotemToken(uin: string, token: string): boolean {
  const [timestamp, receivedToken] = token.split(':');
  const expectedToken = crypto
    .createHmac('sha256', TOTEM_SECRET_KEY)
    .update(`${uin}:${timestamp}`)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(receivedToken),
    Buffer.from(expectedToken)
  );
}
```

### Encriptação de Dados

- **Registro**: Dados de hardware são encriptados antes de envio
- **Comunicação**: HTTPS/WSS para todas as comunicações
- **Armazenamento**: UIN e configurações armazenadas localmente de forma segura

### Prevenção de Clonagem

1. **Validação de Hardware**: Servidor valida hardware a cada conexão
2. **UIN Único**: Baseado em características físicas do hardware
3. **Rastreamento**: Mudanças de hardware são detectadas e alertadas
4. **Aprovação Manual**: Totens novos ficam `pending_approval` até admin aprovar

---

## 📊 Resumo

### Componentes Principais

| Componente | Função |
|------------|--------|
| **UIN** | Identificador único baseado em hardware |
| **Heartbeat** | Mantém conexão viva (30s intervalo) |
| **Rede Estrela** | Topologia MQTT com broker central |
| **Site** | Centro da rede estrela (broker MQTT) |
| **Totem** | Player conectado ao servidor |
| **Token** | Validação HMAC para segurança |

### Fluxos Principais

1. **Registro**: Player gera UIN → Envia para servidor → Cria totem
2. **Conexão**: Player valida UIN → Recebe playlist → Inicia heartbeat
3. **Operação**: Player reproduz → Envia heartbeat → Recebe comandos
4. **Rede Estrela**: Players conectam ao broker → Recebem mensagens → Executam efeitos

### Benefícios da Arquitetura

✅ **Auto-Registro**: Players se registram automaticamente  
✅ **Rastreamento**: Hardware é validado e rastreado  
✅ **Escalabilidade**: Fácil adicionar novos players  
✅ **Sincronização**: Rede estrela permite efeitos coordenados  
✅ **Segurança**: Tokens HMAC e validação de hardware  
✅ **Monitoramento**: Heartbeat permite monitoramento em tempo real  

---

**Documentação criada em:** 2025-12-13  
**Versão:** 2.1.0  
**Status:** ✅ Completo

