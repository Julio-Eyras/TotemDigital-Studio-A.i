# Manual Completo - SmartDisplayFX Plus & SmartSignage Pro v2.1

## 📚 Índice

1. [Visão Geral](#visão-geral)
2. [Autenticação e Autorização](#autenticação-e-autorização)
3. [SmartDisplayFX Plus](#smartdisplayfx-plus)
4. [Gestão de Usuários e Roles](#gestão-de-usuários-e-roles)
5. [Gestão de Clientes](#gestão-de-clientes)
6. [Gestão de Totens](#gestão-de-totens)
7. [Gestão de Mídia](#gestão-de-mídia)
8. [Gestão de Playlists](#gestão-de-playlists)
9. [Gestão de Campanhas](#gestão-de-campanhas)
10. [Analytics e Relatórios](#analytics-e-relatórios)
11. [QR Codes](#qr-codes)
12. [Tags e Interações](#tags-e-interações)
13. [Reconhecimento Facial](#reconhecimento-facial)
14. [Rede de Totens](#rede-de-totens)
15. [IA e Smart Playlists](#ia-e-smart-playlists)
16. [Faturamento e Assinaturas](#faturamento-e-assinaturas)
17. [Configurações do Sistema](#configurações-do-sistema)
18. [Exportação de Dados](#exportação-de-dados)
19. [Atualizações OTA](#atualizações-ota)
20. [Logs e Debug](#logs-e-debug)
21. [Dashboard](#dashboard)

---

## 🔐 Autenticação e Autorização

### Base URL
```
http://localhost:3000/api
```

### 1. Login

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "username": "admin",
  "password": "senha123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin_sql"
  }
}
```

**Uso:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"senha123"}' | jq -r '.accessToken')
```

### 2. Refresh Token

**Endpoint:** `POST /api/auth/refresh`

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Verificar Token

**Endpoint:** `GET /api/auth/verify`

**Headers:**
```
Authorization: Bearer {token}
```

### 4. Logout

**Endpoint:** `POST /api/auth/logout`

---

## 🎨 SmartDisplayFX Plus

### Efeitos FX

#### Listar Efeitos
**Endpoint:** `GET /api/smartdisplayfx/effects`

**Query Parameters:**
- `page` (opcional): Página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 20)
- `search` (opcional): Busca por nome/descrição
- `effect_type` (opcional): Filtrar por tipo
- `isActive` (opcional): true/false

**Exemplo:**
```bash
curl "http://localhost:3000/api/smartdisplayfx/effects?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "data": [
    {
      "effect_id": 1,
      "name": "Neon Warp Flow",
      "effect_type": "neon_warp",
      "description": "Efeito de propagandas fluindo entre totens",
      "default_params": {
        "color_a": "#00ffd5",
        "color_b": "#6b00ff",
        "intensity": 0.8,
        "duration_ms": 1600
      },
      "is_active": true
    }
  ],
  "total": 6,
  "page": 1,
  "limit": 10
}
```

#### Criar Efeito
**Endpoint:** `POST /api/smartdisplayfx/effects`

**Request:**
```json
{
  "name": "Custom Effect",
  "effect_type": "custom",
  "description": "Efeito personalizado",
  "default_params": {
    "color": "#ff0000",
    "duration_ms": 2000
  },
  "is_active": true
}
```

#### Atualizar Efeito
**Endpoint:** `PUT /api/smartdisplayfx/effects/:id`

#### Deletar Efeito
**Endpoint:** `DELETE /api/smartdisplayfx/effects/:id`

#### Listar Tipos de Efeitos
**Endpoint:** `GET /api/smartdisplayfx/effects/types`

---

### Regras Inteligentes

#### Listar Regras
**Endpoint:** `GET /api/smartdisplayfx/rules`

**Query Parameters:**
- `page`, `limit`, `search`
- `site_id` (opcional): Filtrar por site
- `isActive` (opcional)

**Exemplo:**
```bash
curl "http://localhost:3000/api/smartdisplayfx/rules?site_id=loja-centro-01" \
  -H "Authorization: Bearer $TOKEN"
```

#### Criar Regra
**Endpoint:** `POST /api/smartdisplayfx/rules`

**Request:**
```json
{
  "name": "Jovem - Promo Games",
  "description": "Mostrar promo de games para jovens",
  "site_id": "loja-centro-01",
  "conditions": {
    "age_bucket": ["14-25", "18-25"],
    "mood": ["happy", "neutral"]
  },
  "actions": {
    "effect_type": "neon_warp",
    "content_category": "games",
    "priority": "high"
  },
  "priority": 10,
  "is_active": true
}
```

**Estrutura de Conditions:**
```json
{
  "age_bucket": ["14-25", "18-25"],           // Faixas etárias
  "mood": ["happy", "neutral"],               // Humores
  "attention_ms": { "min": 2000 },            // Atenção mínima
  "interaction_type": "tag_id",               // Tipo de interação
  "tag_id": "tag-123",                        // Tag específica
  "tag_category": ["vip", "premium"]          // Categoria de tag
}
```

**Estrutura de Actions:**
```json
{
  "effect_type": "neon_warp",                 // Tipo de efeito
  "content_id": 123,                           // ID do conteúdo (opcional)
  "content_category": "games",                // Categoria de conteúdo
  "priority": "high",                          // Prioridade: low, normal, high, critical
  "params": {                                 // Parâmetros adicionais
    "intensity": 0.9,
    "color": "#ff00ff"
  }
}
```

#### Buscar Regras Ativas de um Site
**Endpoint:** `GET /api/smartdisplayfx/rules/site/:siteId`

#### Atualizar Regra
**Endpoint:** `PUT /api/smartdisplayfx/rules/:id`

#### Deletar Regra
**Endpoint:** `DELETE /api/smartdisplayfx/rules/:id`

---

### Timelines FX

#### Listar Timelines
**Endpoint:** `GET /api/smartdisplayfx/timelines`

**Query Parameters:**
- `page`, `limit`, `search`
- `site_id` (opcional)
- `isActive` (opcional)

#### Criar Timeline
**Endpoint:** `POST /api/smartdisplayfx/timelines`

**Request:**
```json
{
  "site_id": "loja-centro-01",
  "name": "Timeline Manhã",
  "version": 1,
  "events": [
    {
      "eventId": "evt_001",
      "startTs": "2025-01-15T10:00:00Z",
      "effectType": "neon_warp",
      "fromTotem": "100",
      "toTotems": ["101", "102"],
      "contentId": 123,
      "durationMs": 1600,
      "params": {}
    }
  ],
  "starts_at": "2025-01-15T10:00:00Z",
  "ends_at": "2025-01-15T18:00:00Z",
  "is_active": true
}
```

#### Gerar Timeline Automaticamente
**Endpoint:** `POST /api/smartdisplayfx/timelines/generate`

**Request:**
```json
{
  "siteId": "loja-centro-01",
  "durationMinutes": 60
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "siteId": "loja-centro-01",
    "timelineId": "tl_loja-centro-01_1705315200000",
    "version": 1,
    "generatedAt": "2025-01-15T10:00:00Z",
    "events": [...]
  }
}
```

#### Buscar Timeline Ativa
**Endpoint:** `GET /api/smartdisplayfx/timelines/site/:siteId/active`

#### Atualizar Timeline
**Endpoint:** `PUT /api/smartdisplayfx/timelines/:id`

#### Deletar Timeline
**Endpoint:** `DELETE /api/smartdisplayfx/timelines/:id`

---

### Sites (Rede Estrela)

#### Listar Sites
**Endpoint:** `GET /api/smartdisplayfx/sites`

**Query Parameters:**
- `page`, `limit`, `search`
- `client_id` (opcional)
- `isActive` (opcional)

#### Criar Site
**Endpoint:** `POST /api/smartdisplayfx/sites`

**Request:**
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
      "sync_time": "smartdisplay/loja-centro-01/sync_time"
    }
  },
  "sync_interval_ms": 2000,
  "time_sync_enabled": true,
  "config": {
    "max_totems": 10,
    "sync_tolerance_ms": 100
  }
}
```

#### Buscar Site
**Endpoint:** `GET /api/smartdisplayfx/sites/:siteId`

#### Atualizar Site
**Endpoint:** `PUT /api/smartdisplayfx/sites/:siteId`

#### Deletar Site
**Endpoint:** `DELETE /api/smartdisplayfx/sites/:siteId`

#### Listar Totens de um Site
**Endpoint:** `GET /api/smartdisplayfx/sites/:siteId/totems`

**Response:**
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
      "is_active": true
    }
  ]
}
```

#### Adicionar Totem a um Site
**Endpoint:** `POST /api/smartdisplayfx/sites/:siteId/totems`

**Request:**
```json
{
  "totem_id": 101,
  "role": "participant",
  "position_x": 100,
  "position_y": 0
}
```

#### Remover Totem de um Site
**Endpoint:** `DELETE /api/smartdisplayfx/sites/:siteId/totems/:totemId`

---

### Telemetria

#### Listar Telemetria
**Endpoint:** `GET /api/smartdisplayfx/telemetry`

**Query Parameters:**
- `page`, `limit`
- `totem_id` (opcional)
- `effect_id` (opcional)
- `status` (opcional): success, failed, timeout, cancelled
- `startDate` (opcional): ISO 8601
- `endDate` (opcional): ISO 8601

**Exemplo:**
```bash
curl "http://localhost:3000/api/smartdisplayfx/telemetry?totem_id=100&startDate=2025-01-15T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN"
```

#### Estatísticas de Telemetria
**Endpoint:** `GET /api/smartdisplayfx/telemetry/stats`

**Query Parameters:**
- `totem_id` (opcional)
- `effect_id` (opcional)
- `startDate`, `endDate` (opcional)

**Response:**
```json
{
  "data": {
    "total_executions": 150,
    "successful": 142,
    "failed": 5,
    "timeout": 2,
    "cancelled": 1,
    "avg_duration_ms": 1650.5,
    "avg_fps": 59.8,
    "success_rate": 94.67
  }
}
```

#### Buscar Telemetria por ID
**Endpoint:** `GET /api/smartdisplayfx/telemetry/:id`

---

### Eventos e Orquestração

#### Disparar Efeito Manualmente (Debug)
**Endpoint:** `POST /api/smartdisplayfx/debug/trigger-effect`

**Request:**
```json
{
  "siteId": "loja-centro-01",
  "fromTotemId": "100",
  "toTotemId": "101",
  "effectId": "neon_warp",
  "contentId": 123,
  "durationMs": 1600,
  "params": {
    "intensity": 0.8
  }
}
```

#### Enviar Evento de Interação
**Endpoint:** `POST /api/smartdisplayfx/events/interaction`

**Request:**
```json
{
  "siteId": "loja-centro-01",
  "totemId": "100",
  "interactionType": "tag_id",
  "tagId": "tag-123",
  "contentId": 123,
  "timestamp": "2025-01-15T10:00:00Z",
  "extra": {}
}
```

**Tipos de Interação:**
- `tag_id` - Interação via tag RFID/NFC/QR
- `touch` - Toque na tela
- `gesture` - Gesto detectado
- `facial_recognition` - Reconhecimento facial

#### Enviar Evento de IA
**Endpoint:** `POST /api/smartdisplayfx/events/ai`

**Request:**
```json
{
  "siteId": "loja-centro-01",
  "totemId": "100",
  "eventId": "ai_evt_001",
  "eventType": "facial_estimate",
  "payload": {
    "age_bucket": "18-25",
    "mood": "happy",
    "attention_ms": 2500,
    "gender": "male"
  },
  "timestamp": "2025-01-15T10:00:00Z"
}
```

**Tipos de Evento de IA:**
- `facial_estimate` - Estimativa facial (idade, gênero, humor)
- `attention` - Mapa de atenção
- `gesture` - Detecção de gestos
- `behavior_classification` - Classificação de comportamento

#### Sincronizar Tempo
**Endpoint:** `POST /api/smartdisplayfx/sync-time`

**Request:**
```json
{
  "siteId": "loja-centro-01"
}
```

#### Logs SmartDisplayFX
**Endpoint:** `GET /api/smartdisplayfx/logs`

**Query Parameters:**
- `siteId` (opcional)
- `type` (opcional): rule, effect
- `limit` (opcional): Padrão 50, máx 200

---

## 👥 Gestão de Usuários e Roles

### Usuários

#### Listar Usuários
**Endpoint:** `GET /api/users`

**Query Parameters:**
- `page`, `limit`, `search`
- `role` (opcional): admin_sql, operator, admin, gerente_marketing, editoracao, visualizador, client
- `clientId` (opcional)
- `isActive` (opcional)

#### Criar Usuário
**Endpoint:** `POST /api/users`

**Request:**
```json
{
  "username": "novo_usuario",
  "email": "usuario@example.com",
  "password": "senha123",
  "name": "Novo Usuário",
  "role": "gerente_marketing",
  "client_id": 1,
  "is_active": true
}
```

#### Atualizar Usuário
**Endpoint:** `PUT /api/users/:id`

#### Deletar Usuário
**Endpoint:** `DELETE /api/users/:id`

#### Buscar Usuário por ID
**Endpoint:** `GET /api/users/:id`

---

### Roles (RBAC)

#### Listar Roles
**Endpoint:** `GET /api/roles`

**Query Parameters:**
- `page`, `limit`, `search`
- `isActive` (opcional)

#### Criar Role
**Endpoint:** `POST /api/roles`

**Request:**
```json
{
  "name": "custom_role",
  "description": "Role personalizada",
  "is_active": true
}
```

#### Atualizar Role
**Endpoint:** `PUT /api/roles/:id`

#### Deletar Role
**Endpoint:** `DELETE /api/roles/:id`

#### Listar Permissões de uma Role
**Endpoint:** `GET /api/roles/:id/permissions`

#### Atribuir Permissão a Role
**Endpoint:** `POST /api/roles/:id/permissions`

**Request:**
```json
{
  "permission_id": 10
}
```

#### Remover Permissão de Role
**Endpoint:** `DELETE /api/roles/:id/permissions/:permissionId`

#### Definir Todas as Permissões de uma Role
**Endpoint:** `PUT /api/roles/:id/permissions`

**Request:**
```json
{
  "permission_ids": [1, 2, 3, 10, 15]
}
```

---

### Permissões

#### Listar Permissões
**Endpoint:** `GET /api/permissions`

**Query Parameters:**
- `page`, `limit`, `search`
- `resource` (opcional)
- `action` (opcional)

#### Criar Permissão
**Endpoint:** `POST /api/permissions`

**Request:**
```json
{
  "name": "custom.resource.action",
  "resource": "custom",
  "action": "action",
  "description": "Permissão personalizada"
}
```

#### Atualizar Permissão
**Endpoint:** `PUT /api/permissions/:id`

#### Deletar Permissão
**Endpoint:** `DELETE /api/permissions/:id`

#### Listar Recursos Únicos
**Endpoint:** `GET /api/permissions/resources`

#### Listar Ações Únicas
**Endpoint:** `GET /api/permissions/actions`

---

### Associação Usuário-Role

#### Listar Roles de um Usuário
**Endpoint:** `GET /api/users/:id/roles`

#### Atribuir Role a Usuário
**Endpoint:** `POST /api/users/:id/roles`

**Request:**
```json
{
  "role_id": 3
}
```

#### Remover Role de Usuário
**Endpoint:** `DELETE /api/users/:id/roles/:roleId`

#### Definir Todas as Roles de um Usuário
**Endpoint:** `PUT /api/users/:id/roles`

**Request:**
```json
{
  "role_ids": [2, 3, 4]
}
```

---

## 🏢 Gestão de Clientes

#### Listar Clientes
**Endpoint:** `GET /api/clients`

**Query Parameters:**
- `page`, `limit`, `search`
- `isActive` (opcional)

#### Criar Cliente
**Endpoint:** `POST /api/clients`

**Request:**
```json
{
  "name": "Cliente Exemplo",
  "contact_name": "João Silva",
  "email": "cliente@example.com",
  "phone": "+55 11 99999-9999",
  "address": "Rua Exemplo, 123",
  "is_active": true
}
```

#### Atualizar Cliente
**Endpoint:** `PUT /api/clients/:id`

#### Deletar Cliente
**Endpoint:** `DELETE /api/clients/:id`

#### Buscar Cliente por ID
**Endpoint:** `GET /api/clients/:id`

---

## 📺 Gestão de Totens

#### Listar Totens
**Endpoint:** `GET /api/totems`

**Query Parameters:**
- `page`, `limit`, `search`
- `clientId` (opcional)
- `status` (opcional): online, offline, error
- `localId` (opcional)

#### Criar Totem
**Endpoint:** `POST /api/totems`

**Request:**
```json
{
  "name": "Totem 001",
  "identifier": "TOTEM_001",
  "device_id": "device-123",
  "local_id": "local-01",
  "location": "Entrada Principal",
  "client_id": 1,
  "description": "Totem da entrada",
  "config": {
    "resolution": "1920x1080",
    "orientation": "landscape"
  }
}
```

#### Atualizar Totem
**Endpoint:** `PUT /api/totems/:id`

#### Deletar Totem
**Endpoint:** `DELETE /api/totems/:id`

#### Buscar Totem por ID
**Endpoint:** `GET /api/totems/:id`

#### Enviar Heartbeat
**Endpoint:** `POST /api/totems/:id/heartbeat`

**Request:**
```json
{
  "status": "online",
  "uptime": 3600,
  "memoryUsage": 42.5,
  "cpuUsage": 15.2
}
```

#### Reiniciar Totem
**Endpoint:** `POST /api/totems/:id/restart`

#### Capturar Screenshot
**Endpoint:** `POST /api/totems/:id/screenshot`

#### Obter Logs do Totem
**Endpoint:** `GET /api/totems/:id/logs`

**Query Parameters:**
- `level` (opcional): info, warn, error, debug
- `limit` (opcional)
- `startDate`, `endDate` (opcional)

---

## 🎬 Gestão de Mídia

#### Listar Mídias
**Endpoint:** `GET /api/media`

**Query Parameters:**
- `page`, `limit`, `search`
- `clientId` (opcional)
- `mediaType` (opcional): image, video, audio, html
- `status` (opcional): active, inactive

#### Upload de Mídia
**Endpoint:** `POST /api/media/upload`

**Form Data:**
- `file` (obrigatório): Arquivo
- `name` (obrigatório): Nome da mídia
- `description` (opcional)
- `tags` (opcional): Tags separadas por vírgula
- `clientId` (opcional)

**Exemplo:**
```bash
curl -X POST http://localhost:3000/api/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@video.mp4" \
  -F "name=Video Promocional" \
  -F "description=Video de promoção" \
  -F "tags=promo,video" \
  -F "clientId=1"
```

#### Atualizar Mídia
**Endpoint:** `PUT /api/media/:id`

#### Deletar Mídia
**Endpoint:** `DELETE /api/media/:id`

#### Download de Mídia
**Endpoint:** `GET /api/media/:id/download`

#### Buscar Mídia por ID
**Endpoint:** `GET /api/media/:id`

---

## 📋 Gestão de Playlists

#### Listar Playlists
**Endpoint:** `GET /api/playlists`

**Query Parameters:**
- `page`, `limit`, `search`
- `clientId` (opcional)
- `totemId` (opcional)
- `campaignId` (opcional)

#### Criar Playlist
**Endpoint:** `POST /api/playlists`

**Request:**
```json
{
  "name": "Playlist Manhã",
  "description": "Playlist para período da manhã",
  "client_id": 1,
  "totem_id": 100,
  "campaign_id": 1,
  "items": [
    {
      "media_id": 10,
      "order_index": 1,
      "duration_seconds": 30
    },
    {
      "media_id": 11,
      "order_index": 2,
      "duration_seconds": 45
    }
  ],
  "is_active": true
}
```

#### Atualizar Playlist
**Endpoint:** `PUT /api/playlists/:id`

#### Deletar Playlist
**Endpoint:** `DELETE /api/playlists/:id`

#### Buscar Playlist por ID
**Endpoint:** `GET /api/playlists/:id`

#### Adicionar Item à Playlist
**Endpoint:** `POST /api/playlists/:id/items`

**Request:**
```json
{
  "media_id": 12,
  "order_index": 3,
  "duration_seconds": 60
}
```

#### Atualizar Item da Playlist
**Endpoint:** `PUT /api/playlists/:id/items/:itemId`

#### Remover Item da Playlist
**Endpoint:** `DELETE /api/playlists/:id/items/:itemId`

#### Reordenar Itens da Playlist
**Endpoint:** `PUT /api/playlists/:id/items/reorder`

**Request:**
```json
{
  "item_ids": [1, 3, 2, 4]
}
```

---

## 🎯 Gestão de Campanhas

#### Listar Campanhas
**Endpoint:** `GET /api/campaigns`

**Query Parameters:**
- `page`, `limit`, `search`
- `clientId` (opcional)
- `status` (opcional): active, paused, finished, scheduled
- `startDate`, `endDate` (opcional)

#### Criar Campanha
**Endpoint:** `POST /api/campaigns`

**Request:**
```json
{
  "title": "Campanha Verão 2025",
  "description": "Promoções de verão",
  "client_id": 1,
  "campaign_type": "general",
  "start_date": "2025-12-01",
  "end_date": "2026-01-15",
  "priority": 10,
  "is_active": true
}
```

#### Atualizar Campanha
**Endpoint:** `PUT /api/campaigns/:id`

#### Deletar Campanha
**Endpoint:** `DELETE /api/campaigns/:id`

#### Ativar Campanha
**Endpoint:** `POST /api/campaigns/:id/activate`

#### Pausar Campanha
**Endpoint:** `POST /api/campaigns/:id/pause`

#### Finalizar Campanha
**Endpoint:** `POST /api/campaigns/:id/finish`

#### Adicionar Totem à Campanha
**Endpoint:** `POST /api/campaigns/:id/totems`

**Request:**
```json
{
  "totem_id": 100,
  "scheduled_start": "2025-12-01T08:00:00Z",
  "scheduled_end": "2026-01-15T20:00:00Z"
}
```

#### Estatísticas de Campanha
**Endpoint:** `GET /api/campaigns/:id/stats`

#### Buscar Campanha por ID
**Endpoint:** `GET /api/campaigns/:id`

---

## 📊 Analytics e Relatórios

### Analytics

#### Dashboard Analytics
**Endpoint:** `GET /api/analytics/dashboard`

**Query Parameters:**
- `clientId` (opcional)
- `startDate`, `endDate` (opcional)

**Response:**
```json
{
  "totalViews": 15000,
  "totalInteractions": 3200,
  "avgViewTime": 45.5,
  "topContent": [...],
  "totemStats": [...],
  "campaignStats": [...]
}
```

#### Estatísticas de Conteúdo
**Endpoint:** `GET /api/analytics/content`

#### Estatísticas de Totem
**Endpoint:** `GET /api/analytics/totem/:id`

#### Estatísticas de Campanha
**Endpoint:** `GET /api/analytics/campaign/:id`

### Relatórios

#### Listar Relatórios
**Endpoint:** `GET /api/reports`

**Query Parameters:**
- `page`, `limit`, `search`
- `clientId` (opcional)
- `reportType` (opcional)

#### Criar Relatório
**Endpoint:** `POST /api/reports`

**Request:**
```json
{
  "name": "Relatório Mensal",
  "report_type": "monthly",
  "client_id": 1,
  "start_date": "2025-01-01",
  "end_date": "2025-01-31",
  "format": "pdf",
  "include_charts": true
}
```

#### Gerar Relatório em Lote
**Endpoint:** `POST /api/reports/bulk-generate`

**Request:**
```json
{
  "report_type": "monthly",
  "client_ids": [1, 2, 3],
  "start_date": "2025-01-01",
  "end_date": "2025-01-31",
  "format": "pdf"
}
```

#### Download de Relatório
**Endpoint:** `GET /api/reports/:id/download`

#### Deletar Relatório
**Endpoint:** `DELETE /api/reports/:id`

#### Estatísticas de Relatórios
**Endpoint:** `GET /api/reports/stats`

---

## 📱 QR Codes

#### Listar QR Codes
**Endpoint:** `GET /api/qrcodes`

**Query Parameters:**
- `page`, `limit`, `search`
- `clientId` (opcional)
- `qrType` (opcional): url, text, wifi, vcard, etc.
- `isActive` (opcional)

#### Criar QR Code
**Endpoint:** `POST /api/qrcodes`

**Request:**
```json
{
  "name": "QR Promoção",
  "qr_type": "url",
  "data": {
    "url": "https://example.com/promo"
  },
  "client_id": 1,
  "expires_at": "2025-12-31T23:59:59Z",
  "is_active": true
}
```

**Tipos de QR Code:**
- `url` - URL simples
- `text` - Texto
- `wifi` - Credenciais WiFi
- `vcard` - Cartão de visita
- `email` - Email
- `sms` - SMS
- `phone` - Telefone

#### Atualizar QR Code
**Endpoint:** `PUT /api/qrcodes/:id`

#### Deletar QR Code
**Endpoint:** `DELETE /api/qrcodes/:id`

#### Download QR Code (Imagem)
**Endpoint:** `GET /api/qrcodes/:id/download`

#### Buscar QR Code por ID
**Endpoint:** `GET /api/qrcodes/:id`

---

## 🏷️ Tags e Interações

#### Listar Tags
**Endpoint:** `GET /api/tags`

**Query Parameters:**
- `page`, `limit`, `search`
- `tagType` (opcional): rfid, nfc, qr
- `clientId` (opcional)

#### Criar Tag
**Endpoint:** `POST /api/tags`

**Request:**
```json
{
  "tag_id": "tag-123",
  "tag_type": "rfid",
  "name": "Tag VIP",
  "content_id": 10,
  "client_id": 1,
  "metadata": {
    "category": "vip",
    "discount": 10
  }
}
```

#### Buscar Conteúdo por Tag
**Endpoint:** `GET /api/tags/:tagId/content`

**Response:**
```json
{
  "tag_id": "tag-123",
  "content_id": 10,
  "content": {
    "media_id": 10,
    "name": "Conteúdo VIP",
    "url": "https://..."
  }
}
```

#### Atualizar Tag
**Endpoint:** `PUT /api/tags/:id`

#### Deletar Tag
**Endpoint:** `DELETE /api/tags/:id`

---

## 👤 Reconhecimento Facial

#### Fazer Match Facial
**Endpoint:** `POST /api/facial-recognition/match`

**Request:**
```json
{
  "features": {
    "face_encoding": [0.123, 0.456, ...],
    "landmarks": {...}
  },
  "totem_id": 100
}
```

#### Listar Pessoas Reconhecidas
**Endpoint:** `GET /api/facial-recognition/persons`

**Query Parameters:**
- `page`, `limit`, `search`
- `clientId` (opcional)

#### Criar Pessoa
**Endpoint:** `POST /api/facial-recognition/persons`

**Request:**
```json
{
  "person_id": "person-001",
  "name": "João Silva",
  "features": {
    "face_encoding": [0.123, 0.456, ...]
  },
  "content_id": 10,
  "client_id": 1
}
```

#### Atualizar Pessoa
**Endpoint:** `PUT /api/facial-recognition/persons/:id`

#### Deletar Pessoa
**Endpoint:** `DELETE /api/facial-recognition/persons/:id`

---

## 🌐 Rede de Totens

#### Buscar Conteúdo Relacionado
**Endpoint:** `POST /api/network/related-content`

**Request:**
```json
{
  "interaction": {
    "type": "tag",
    "tag_id": "tag-123"
  },
  "totemId": 100
}
```

#### Buscar Totens Próximos
**Endpoint:** `GET /api/network/totems/:totemId/nearby`

**Query Parameters:**
- `radius` (opcional): Raio em metros (padrão: 50)

---

## 🤖 IA e Smart Playlists

### IA

#### Gerar Conteúdo com IA
**Endpoint:** `POST /api/ai/generate`

**Request:**
```json
{
  "prompt": "Crie uma descrição para campanha de verão",
  "type": "text",
  "options": {
    "max_tokens": 500,
    "temperature": 0.7
  }
}
```

#### Analisar Campanha
**Endpoint:** `POST /api/ai/analyze-campaign`

**Request:**
```json
{
  "campaign_id": 1,
  "analysis_type": "performance"
}
```

### Smart Playlists

#### Listar Smart Playlists
**Endpoint:** `GET /api/smart-playlist`

**Query Parameters:**
- `page`, `limit`, `search`
- `clientId` (opcional)

#### Criar Smart Playlist
**Endpoint:** `POST /api/smart-playlist`

**Request:**
```json
{
  "name": "Smart Playlist IA",
  "client_id": 1,
  "rules": {
    "time_based": {
      "morning": ["content-1", "content-2"],
      "afternoon": ["content-3", "content-4"]
    },
    "ai_suggestions": true
  },
  "is_active": true
}
```

#### Gerar Playlist Automaticamente
**Endpoint:** `POST /api/smart-playlist/generate`

**Request:**
```json
{
  "client_id": 1,
  "totem_id": 100,
  "duration_minutes": 60,
  "preferences": {
    "categories": ["promo", "info"],
    "exclude": ["content-5"]
  }
}
```

---

## 💰 Faturamento e Assinaturas

### Faturamento

#### Listar Faturas
**Endpoint:** `GET /api/billing`

**Query Parameters:**
- `page`, `limit`, `search`
- `clientId` (opcional)
- `status` (opcional): pending, paid, overdue, cancelled

#### Criar Fatura
**Endpoint:** `POST /api/billing`

**Request:**
```json
{
  "client_id": 1,
  "amount": 1000.00,
  "due_date": "2025-02-01",
  "description": "Fatura mensal - Janeiro 2025",
  "items": [
    {
      "description": "Assinatura Premium",
      "quantity": 1,
      "unit_price": 1000.00
    }
  ]
}
```

#### Atualizar Fatura
**Endpoint:** `PUT /api/billing/:id`

#### Marcar Fatura como Paga
**Endpoint:** `POST /api/billing/:id/mark-paid`

#### Buscar Fatura por ID
**Endpoint:** `GET /api/billing/:id`

### Planos

#### Listar Planos
**Endpoint:** `GET /api/plans`

#### Criar Plano
**Endpoint:** `POST /api/plans`

**Request:**
```json
{
  "name": "Plano Premium",
  "description": "Plano com recursos avançados",
  "price": 1000.00,
  "billing_interval": "monthly",
  "features": {
    "max_totems": 10,
    "max_storage_gb": 100,
    "ai_enabled": true
  },
  "is_active": true
}
```

### Assinaturas

#### Listar Assinaturas
**Endpoint:** `GET /api/subscriptions`

**Query Parameters:**
- `page`, `limit`, `search`
- `clientId` (opcional)
- `status` (opcional): active, cancelled, expired

#### Criar Assinatura
**Endpoint:** `POST /api/subscriptions`

**Request:**
```json
{
  "client_id": 1,
  "plan_id": 1,
  "billing_interval": "monthly",
  "start_date": "2025-01-01"
}
```

#### Atualizar Assinatura
**Endpoint:** `PUT /api/subscriptions/:id`

#### Cancelar Assinatura
**Endpoint:** `POST /api/subscriptions/:id/cancel`

---

## ⚙️ Configurações do Sistema

#### Listar Configurações
**Endpoint:** `GET /api/settings`

**Query Parameters:**
- `category` (opcional)

#### Atualizar Configuração
**Endpoint:** `PUT /api/settings`

**Request:**
```json
{
  "key": "max_upload_size",
  "value": "100MB",
  "category": "media"
}
```

#### Criar/Resetar Todas as Configurações
**Endpoint:** `POST /api/settings`

---

## 📤 Exportação de Dados

### Export Queries

#### Listar Queries de Exportação
**Endpoint:** `GET /api/export-queries`

#### Criar Query de Exportação
**Endpoint:** `POST /api/export-queries`

**Request:**
```json
{
  "name": "Export Clientes",
  "query": "SELECT * FROM clients WHERE is_active = true",
  "format": "csv",
  "is_active": true
}
```

### Export Schedules

#### Listar Agendamentos de Exportação
**Endpoint:** `GET /api/export-schedules`

#### Criar Agendamento
**Endpoint:** `POST /api/export-schedules`

**Request:**
```json
{
  "name": "Export Diário",
  "query_id": 1,
  "schedule_cron": "0 0 * * *",
  "is_active": true
}
```

### Export Executions

#### Listar Execuções
**Endpoint:** `GET /api/export-executions`

#### Download de Exportação
**Endpoint:** `GET /api/export-executions/:id/download`

---

## 🔄 Atualizações OTA

#### Listar Atualizações
**Endpoint:** `GET /api/ota-updates`

#### Criar Atualização
**Endpoint:** `POST /api/ota-updates`

**Form Data:**
- `file` (obrigatório): Arquivo de atualização
- `version` (obrigatório): Versão
- `platform` (obrigatório): webos, tizen, android, linux, windows, all
- `description` (opcional)

#### Ativar Atualização
**Endpoint:** `POST /api/ota-updates/:id/activate`

#### Estatísticas de Atualizações
**Endpoint:** `GET /api/ota-updates/stats`

---

## 📝 Logs e Debug

#### Listar Logs
**Endpoint:** `GET /api/logs`

**Query Parameters:**
- `level` (opcional): info, warn, error, debug
- `limit` (opcional)
- `startDate`, `endDate` (opcional)

#### Logs do Sistema
**Endpoint:** `GET /api/logs/system`

#### Logs de Erro
**Endpoint:** `GET /api/logs/errors`

---

## 📊 Dashboard

#### Dashboard Principal
**Endpoint:** `GET /api/dashboard`

**Response:**
```json
{
  "stats": {
    "totalClients": 10,
    "totalTotems": 50,
    "activeCampaigns": 5,
    "totalViews": 15000
  },
  "recentActivity": [...],
  "alerts": [...]
}
```

---

## 🔄 Fluxos de Trabalho Completos

### Fluxo 1: Criar Campanha Completa

```bash
# 1. Criar mídias
MEDIA1=$(curl -s -X POST http://localhost:3000/api/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@video1.mp4" \
  -F "name=Video 1" \
  -F "clientId=1" | jq -r '.data.media_id')

MEDIA2=$(curl -s -X POST http://localhost:3000/api/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@video2.mp4" \
  -F "name=Video 2" \
  -F "clientId=1" | jq -r '.data.media_id')

# 2. Criar playlist
PLAYLIST=$(curl -s -X POST http://localhost:3000/api/playlists \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Playlist Campanha\",
    \"client_id\": 1,
    \"items\": [
      {\"media_id\": $MEDIA1, \"order_index\": 1, \"duration_seconds\": 30},
      {\"media_id\": $MEDIA2, \"order_index\": 2, \"duration_seconds\": 45}
    ]
  }" | jq -r '.data.playlist_id')

# 3. Criar campanha
CAMPAIGN=$(curl -s -X POST http://localhost:3000/api/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Campanha Exemplo\",
    \"client_id\": 1,
    \"start_date\": \"2025-12-01\",
    \"end_date\": \"2026-01-15\",
    \"playlist_id\": $PLAYLIST
  }" | jq -r '.data.campaign_id')

# 4. Adicionar totens à campanha
curl -X POST http://localhost:3000/api/campaigns/$CAMPAIGN/totems \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"totem_id": 100}'

# 5. Ativar campanha
curl -X POST http://localhost:3000/api/campaigns/$CAMPAIGN/activate \
  -H "Authorization: Bearer $TOKEN"
```

### Fluxo 2: Configurar Rede SmartDisplayFX

```bash
# 1. Criar site
curl -X POST http://localhost:3000/api/smartdisplayfx/sites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "loja-centro-01",
    "name": "Loja Centro",
    "broker_url": "ws://mqtt.local:9001",
    "client_id": 1
  }'

# 2. Adicionar totens
curl -X POST http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01/totems \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"totem_id": 100, "role": "master"}'

curl -X POST http://localhost:3000/api/smartdisplayfx/sites/loja-centro-01/totems \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"totem_id": 101, "role": "participant"}'

# 3. Criar regra
curl -X POST http://localhost:3000/api/smartdisplayfx/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Regra Jovens",
    "site_id": "loja-centro-01",
    "conditions": {
      "age_bucket": ["14-25"],
      "mood": ["happy"]
    },
    "actions": {
      "effect_type": "neon_warp",
      "content_category": "games"
    },
    "priority": 10
  }'

# 4. Gerar timeline
curl -X POST http://localhost:3000/api/smartdisplayfx/timelines/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "loja-centro-01",
    "durationMinutes": 60
  }'
```

---

## 🚀 Continuidade na Evolução

### Melhorias Implementadas Recentemente

1. ✅ **SmartDisplayFX Plus** - Sistema completo de efeitos FX
2. ✅ **RBAC Completo** - Roles e permissões hierárquicas
3. ✅ **Rede Estrela** - Gerenciamento de sites e totens
4. ✅ **Telemetria** - Coleta e análise de performance
5. ✅ **Regras Inteligentes** - Sistema de regras baseado em condições

### Próximas Evoluções Sugeridas

#### 1. Player Cliente SmartDisplayFX Plus
- [ ] Estrutura base HTML5/JS
- [ ] Integração MQTT over WebSocket
- [ ] Renderização WebGL (Three.js/PixiJS)
- [ ] Efeitos visuais (Neon Warp, Ripple Sync, etc.)
- [ ] Sincronização de tempo
- [ ] Cache local de timelines

#### 2. IA de Borda
- [ ] MediaPipe Tasks Vision
- [ ] Detecção de gestos
- [ ] Estimativa facial
- [ ] Mapa de atenção
- [ ] Classificação de comportamento

#### 3. Melhorias no Backend
- [ ] WebSocket real-time para dashboard
- [ ] Sistema de notificações push
- [ ] Cache Redis para queries frequentes
- [ ] Otimização de queries complexas
- [ ] Sistema de backup automático

#### 4. Frontend Admin
- [ ] Interface para gerenciar SmartDisplayFX
- [ ] Visualizador de rede estrela
- [ ] Editor visual de regras
- [ ] Preview de efeitos FX
- [ ] Dashboard de telemetria em tempo real

---

**Manual criado em:** 2025-01-XX  
**Versão:** 1.0  
**Status:** ✅ Completo

