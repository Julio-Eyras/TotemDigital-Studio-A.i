# Rede Estrela SmartDisplayFX Plus - Documentação Completa

## 📐 Arquitetura de Rede Estrela

A rede estrela no SmartDisplayFX Plus é uma topologia onde:
- **1 Site (Centro)** = Broker MQTT central
- **N Totens (Raios)** = Players conectados ao broker
- **Comunicação**: Todos os totens se comunicam via broker central (não diretamente entre si)

```
                    [Broker MQTT]
                    (Site: site-01)
                         |
        +----------------+----------------+
        |                |                |
    [Totem 1]       [Totem 2]        [Totem 3]
   (Master)      (Participant)    (Participant)
```

---

## 🗄️ Modelo ER (Entidade-Relacionamento)

### 1. Tabela `fx_sites` (Centro da Estrela)

Define o **site** (centro da rede estrela) que agrupa totens:

```sql
CREATE TABLE IF NOT EXISTS fx_sites (
    site_id TEXT PRIMARY KEY,              -- ID único: 'site-01', 'loja-centro', etc.
    name TEXT NOT NULL,                    -- Nome: 'Loja Centro - Andar 1'
    description TEXT,                      -- Descrição opcional
    client_id INTEGER,                     -- Cliente dono do site (FK clients)
    broker_url TEXT,                       -- URL do broker MQTT: 'ws://localhost:9001'
    broker_type TEXT DEFAULT 'mqtt',       -- 'mqtt', 'websocket', 'hybrid'
    broker_config JSONB DEFAULT '{}',      -- Config do broker (auth, topics, etc.)
    sync_interval_ms INTEGER DEFAULT 2000, -- Intervalo de sincronização (ms)
    time_sync_enabled BOOLEAN DEFAULT true,-- Habilitar sync de tempo
    config JSONB DEFAULT '{}',            -- Configurações gerais do site
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL
);
```

**Campos JSONB:**

- **`broker_config`** (JSON):
```json
{
  "username": "admin",
  "password": "secret",
  "topics": {
    "effect": "smartdisplay/{site_id}/effect",
    "timeline": "smartdisplay/{site_id}/timeline",
    "sync_time": "smartdisplay/{site_id}/sync_time"
  },
  "qos": {
    "effect": 0,
    "timeline": 1,
    "sync_time": 1
  }
}
```

- **`config`** (JSON):
```json
{
  "max_totems": 10,
  "sync_tolerance_ms": 100,
  "heartbeat_interval_ms": 5000,
  "visualization": {
    "layout": "grid",
    "columns": 3,
    "spacing": 50
  }
}
```

### 2. Tabela `fx_totem_sites` (Relação Totem ↔ Site)

Define quais totens pertencem a qual site e seus papéis:

```sql
CREATE TABLE IF NOT EXISTS fx_totem_sites (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,             -- FK totems
    site_id TEXT NOT NULL,                 -- FK fx_sites
    role TEXT DEFAULT 'participant',       -- 'master', 'participant', 'observer'
    position_x INTEGER,                    -- Posição X na visualização
    position_y INTEGER,                    -- Posição Y na visualização
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES fx_sites(site_id) ON DELETE CASCADE,
    UNIQUE(totem_id, site_id)              -- Um totem só pode estar em um site por vez
);
```

**Roles (Papéis):**
- **`master`**: Totem principal (pode coordenar efeitos)
- **`participant`**: Totem participante (recebe e executa efeitos)
- **`observer`**: Totem observador (apenas recebe, não executa)

**Posições (Opcional):**
- `position_x`, `position_y`: Coordenadas para visualização da rede
- Útil para interfaces gráficas que mostram a topologia

### 3. Tabela `totem_network` (Legado - Rede Genérica)

Tabela existente para redes genéricas de totens (não específica do SmartDisplayFX):

```sql
CREATE TABLE IF NOT EXISTS totem_network (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    network_id TEXT NOT NULL,              -- ID da rede/grupo
    nearby_totems INTEGER[],               -- Array de IDs de totens próximos
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);
```

**Uso:** Usada como fallback quando `fx_totem_sites` não tem totens suficientes.

---

## 📋 Estruturas JSON

### 1. Estrutura de Site (fx_sites)

**Exemplo de criação:**
```json
{
  "site_id": "loja-centro-01",
  "name": "Loja Centro - Andar 1",
  "description": "Rede de totens do andar térreo",
  "client_id": 1,
  "broker_url": "ws://mqtt-broker.local:9001",
  "broker_type": "mqtt",
  "broker_config": {
    "username": "smartdisplay",
    "password": "secure_password",
    "topics": {
      "effect": "smartdisplay/loja-centro-01/effect",
      "timeline": "smartdisplay/loja-centro-01/timeline",
      "sync_time": "smartdisplay/loja-centro-01/sync_time",
      "telemetry": "smartdisplay/loja-centro-01/telemetry"
    },
    "qos": {
      "effect": 0,
      "timeline": 1,
      "sync_time": 1,
      "telemetry": 0
    }
  },
  "sync_interval_ms": 2000,
  "time_sync_enabled": true,
  "config": {
    "max_totems": 10,
    "sync_tolerance_ms": 100,
    "heartbeat_interval_ms": 5000,
    "visualization": {
      "layout": "grid",
      "columns": 3,
      "spacing": 50
    }
  },
  "is_active": true
}
```

### 2. Estrutura de Relação Totem-Site (fx_totem_sites)

**Exemplo:**
```json
{
  "id": 1,
  "totem_id": 100,
  "site_id": "loja-centro-01",
  "role": "master",
  "position_x": 0,
  "position_y": 0,
  "is_active": true,
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

### 3. Estrutura de Resposta Completa (Site + Totens)

**Exemplo de resposta da API:**
```json
{
  "data": {
    "site_id": "loja-centro-01",
    "name": "Loja Centro - Andar 1",
    "description": "Rede de totens do andar térreo",
    "client_id": 1,
    "broker_url": "ws://mqtt-broker.local:9001",
    "broker_type": "mqtt",
    "broker_config": { ... },
    "sync_interval_ms": 2000,
    "time_sync_enabled": true,
    "config": { ... },
    "is_active": true,
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z",
    "totems": [
      {
        "id": 1,
        "totem_id": 100,
        "site_id": "loja-centro-01",
        "role": "master",
        "position_x": 0,
        "position_y": 0,
        "is_active": true
      },
      {
        "id": 2,
        "totem_id": 101,
        "site_id": "loja-centro-01",
        "role": "participant",
        "position_x": 100,
        "position_y": 0,
        "is_active": true
      }
    ]
  }
}
```

---

## 🔧 CRUDs - Gerenciamento de Conexões

### Serviço: `FxSiteService`

Localização: `backend/src/services/fxSiteService.ts`

### 1. **CREATE - Criar Site**

**Método:** `createSite(data: CreateFxSiteRequest)`

**Rota API:** `POST /api/smartdisplayfx/sites`

**Exemplo de requisição:**
```bash
curl -X POST http://localhost:3000/api/smartdisplayfx/sites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "loja-centro-01",
    "name": "Loja Centro - Andar 1",
    "description": "Rede de totens do andar térreo",
    "client_id": 1,
    "broker_url": "ws://mqtt-broker.local:9001",
    "broker_type": "mqtt",
    "broker_config": {
      "username": "smartdisplay",
      "password": "secure_password"
    },
    "sync_interval_ms": 2000,
    "time_sync_enabled": true,
    "config": {
      "max_totems": 10
    },
    "is_active": true
  }'
```

**Resposta:**
```json
{
  "data": {
    "site_id": "loja-centro-01",
    "name": "Loja Centro - Andar 1",
    ...
  }
}
```

### 2. **READ - Listar Sites**

**Método:** `getAllSites(params)`

**Rota API:** `GET /api/smartdisplayfx/sites`

**Query Parameters:**
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 20, máx: 100)
- `search` (opcional): Busca por nome, site_id ou description
- `client_id` (opcional): Filtrar por cliente
- `isActive` (opcional): Filtrar por status (true/false)

**Exemplo:**
```bash
curl "http://localhost:3000/api/smartdisplayfx/sites?page=1&limit=10&client_id=1" \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta:**
```json
{
  "data": [
    {
      "site_id": "loja-centro-01",
      "name": "Loja Centro - Andar 1",
      ...
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 10
}
```

### 3. **READ - Buscar Site por ID**

**Método:** `getSiteById(siteId: string)`

**Rota API:** `GET /api/smartdisplayfx/sites/:siteId`

**Exemplo:**
```bash
curl "http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01" \
  -H "Authorization: Bearer $TOKEN"
```

### 4. **UPDATE - Atualizar Site**

**Método:** `updateSite(siteId: string, data: UpdateFxSiteRequest)`

**Rota API:** `PUT /api/smartdisplayfx/sites/:siteId`

**Exemplo:**
```bash
curl -X PUT http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Loja Centro - Andar 1 (Atualizado)",
    "sync_interval_ms": 3000,
    "config": {
      "max_totems": 15
    }
  }'
```

### 5. **DELETE - Deletar Site (Soft Delete)**

**Método:** `deleteSite(siteId: string)`

**Rota API:** `DELETE /api/smartdisplayfx/sites/:siteId`

**Exemplo:**
```bash
curl -X DELETE http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01 \
  -H "Authorization: Bearer $TOKEN"
```

**Nota:** Soft delete - apenas marca `is_active = false`

---

## 🔗 CRUDs - Gerenciamento de Totens no Site

### 1. **READ - Listar Totens de um Site**

**Método:** `getTotemsForSite(siteId: string)`

**Rota API:** `GET /api/smartdisplayfx/sites/:siteId/totems`

**Exemplo:**
```bash
curl "http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01/totems" \
  -H "Authorization: Bearer $TOKEN"
```

**Resposta:**
```json
{
  "data": [
    {
      "id": 1,
      "totem_id": 100,
      "site_id": "loja-centro-01",
      "role": "master",
      "position_x": 0,
      "position_y": 0,
      "is_active": true,
      "created_at": "2025-01-15T10:00:00Z"
    },
    {
      "id": 2,
      "totem_id": 101,
      "site_id": "loja-centro-01",
      "role": "participant",
      "position_x": 100,
      "position_y": 0,
      "is_active": true,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### 2. **CREATE - Adicionar Totem a um Site**

**Método:** `addTotemToSite(siteId, totemId, role, positionX?, positionY?)`

**Rota API:** `POST /api/smartdisplayfx/sites/:siteId/totems`

**Exemplo:**
```bash
curl -X POST http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01/totems \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "totem_id": 102,
    "role": "participant",
    "position_x": 200,
    "position_y": 0
  }'
```

**Parâmetros:**
- `totem_id` (obrigatório): ID do totem
- `role` (opcional): 'master', 'participant' ou 'observer' (padrão: 'participant')
- `position_x` (opcional): Posição X para visualização
- `position_y` (opcional): Posição Y para visualização

**Comportamento:**
- Se o totem já estiver no site, atualiza os dados (role, posição)
- Se não estiver, cria nova relação
- Usa `ON CONFLICT` para evitar duplicatas

### 3. **DELETE - Remover Totem de um Site**

**Método:** `removeTotemFromSite(siteId: string, totemId: number)`

**Rota API:** `DELETE /api/smartdisplayfx/sites/:siteId/totems/:totemId`

**Exemplo:**
```bash
curl -X DELETE http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01/totems/102 \
  -H "Authorization: Bearer $TOKEN"
```

**Nota:** Soft delete - apenas marca `is_active = false`

---

## 🔄 Fluxo de Funcionamento

### 1. **Criação de Rede Estrela**

```
1. Criar Site (POST /api/smartdisplayfx/sites)
   └─> Define broker MQTT, configurações, etc.

2. Adicionar Totens ao Site (POST /api/smartdisplayfx/sites/:siteId/totems)
   └─> Associa totens ao site
   └─> Define roles (master, participant, observer)
   └─> Define posições (opcional)

3. Totens se conectam ao broker MQTT
   └─> URL: broker_url do site
   └─> Topics: smartdisplay/{site_id}/*

4. Sistema orquestra efeitos
   └─> FxOrchestratorService usa fx_totem_sites para encontrar totens
   └─> Publica mensagens via FxMessageBridge
```

### 2. **Busca de Totem de Destino**

O `FxOrchestratorService.findTargetTotem()` funciona assim:

```typescript
// 1. Busca totens do mesmo site (fx_totem_sites)
const siteTotems = await this.siteService.getTotemsForSite(siteId);
const otherTotems = siteTotems.filter(t => t.totem_id !== fromTotemId && t.is_active);

// 2. Prioriza totem "master" se houver
const masterTotem = otherTotems.find(t => t.role === 'master');
if (masterTotem) {
  return String(masterTotem.totem_id);
}

// 3. Escolhe aleatoriamente entre participantes
return String(otherTotems[Math.floor(Math.random() * otherTotems.length)].totem_id);

// 4. Fallback: usa totem_network (rede genérica)
// 5. Último fallback: retorna o próprio fromTotemId
```

### 3. **Sincronização**

- **Tempo**: Broker publica `sync_time` periodicamente
- **Timelines**: Broker publica `timeline_update` quando gerada
- **Efeitos**: Broker publica `effect_transfer` quando orquestrado

---

## 📊 Exemplos Práticos

### Exemplo 1: Criar Rede Completa

```bash
# 1. Criar site
SITE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/smartdisplayfx/sites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "loja-centro-01",
    "name": "Loja Centro",
    "broker_url": "ws://mqtt.local:9001",
    "client_id": 1
  }')

# 2. Adicionar totens
curl -X POST http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01/totems \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"totem_id": 100, "role": "master", "position_x": 0, "position_y": 0}'

curl -X POST http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01/totems \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"totem_id": 101, "role": "participant", "position_x": 100, "position_y": 0}'

curl -X POST http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01/totems \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"totem_id": 102, "role": "participant", "position_x": 200, "position_y": 0}'
```

### Exemplo 2: Consultar Rede

```bash
# Listar todos os sites
curl "http://localhost:3000/api/smartdisplayfx/sites" \
  -H "Authorization: Bearer $TOKEN"

# Ver totens de um site
curl "http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01/totems" \
  -H "Authorization: Bearer $TOKEN"
```

### Exemplo 3: Atualizar Configuração

```bash
# Atualizar intervalo de sincronização
curl -X PUT http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_interval_ms": 1000,
    "config": {
      "max_totems": 20,
      "sync_tolerance_ms": 50
    }
  }'
```

---

## 🔐 Autorização

### Roles com Acesso

- **Admin SQL**: Acesso total
- **Admin**: Acesso total (próprio cliente)
- **Gerente Marketing**: Apenas leitura
- **Outros**: Sem acesso

### Middleware

Todas as rotas usam:
- `authMiddleware` - Autenticação JWT
- `authorizeRole(['admin', 'admin_sql'])` - Autorização por role

---

## 📝 Notas Importantes

1. **Um totem pode estar em apenas um site por vez** (UNIQUE constraint)
2. **Soft delete**: Totens removidos ficam `is_active = false` (não são deletados)
3. **Posições são opcionais**: Úteis apenas para visualização
4. **Role "master"**: Priorizado na escolha de totem de destino
5. **Fallback**: Se não houver totens no site, usa `totem_network` (rede genérica)

---

## 🚀 Próximos Passos

Para o player cliente:
1. Conectar ao broker MQTT usando `broker_url` do site
2. Subscrever em `smartdisplay/{site_id}/*`
3. Processar mensagens `effect_transfer`, `timeline_update`, `sync_time`
4. Executar efeitos FX conforme mensagens recebidas

---

**Documentação criada em:** 2025-01-XX  
**Versão:** 1.0  
**Status:** ✅ Completo

