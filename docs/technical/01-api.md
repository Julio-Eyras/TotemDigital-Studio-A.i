# Documentação da API — TotemDigital Studio

**Catálogo completo (todas as rotas):** [07-API-INVENTARIO.md](./07-API-INVENTARIO.md) · [openapi.json](./openapi.json) · `GET /api/openapi.json`  
**Swagger UI** (só `NODE_ENV=development`): `/api-docs`  
**Overlay P0 (schemas de integração):** `backend/src/config/openapi-p0.json`  
Regenerar: `python scripts/generate-openapi-from-routes.py`

Este ficheiro descreve sobretudo o **Player API** (dispatch, token, heartbeat).

## Base URL

```
http://seu-servidor:3000/api
```

## Autenticação

A maioria dos endpoints requer autenticação via JWT token no header:

```
Authorization: Bearer <token>
```

### Obter Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "senha123"
}
```

**Resposta (sem 2FA):**
```json
{
  "message": "Login realizado com sucesso",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "owner_system",
    "user_type": "system_user"
  }
}
```

Se 2FA estiver activo: `{ "message", "requiresTwoFactor": true, "user" }` (sem tokens). Schema completo: overlay P0 / `GET /api/openapi.json`.

## Endpoints Principais

### Player API

#### Obter Plano de Exibição

```http
GET /api/player/dispatch?uin={UIN}&token={token}&deviceId={deviceId}&timestamp={timestamp}&timezone={timezone}
```

**Parâmetros:**
- `uin` (obrigatório): UIN do totem
- `token` (obrigatório): Token de autenticação do totem
- `deviceId` (opcional): ID do dispositivo
- `timestamp` (opcional): Timestamp para o plano (ISO 8601)
- `timezone` (opcional): Timezone do totem

**Resposta:**
```json
{
  "success": true,
  "plan": {
    "totemId": 1,
    "timestamp": "2026-01-26T10:00:00Z",
    "playlistId": 5,
    "playlistName": "Campanha Verão",
    "mediaItems": [
      {
        "mediaId": 10,
        "order": 0,
        "duration": 30,
        "url": "https://...",
        "mediaType": "video",
        "cacheBucket": "propagandas"
      }
    ],
    "totalDuration": 180,
    "priority": 75,
    "source": "direct",
    "sourceId": 9,
    "validityStart": "2026-01-26T00:00:00Z",
    "validityEnd": "2026-01-26T23:59:59Z"
  },
  "planState": "ACTIVE",
  "planVersion": "pv-1-abc",
  "fromCache": false,
  "executionTimeMs": 45
}
```

#### Enviar Heartbeat

```http
POST /api/player/heartbeat?uin={UIN}&token={token}&deviceId={deviceId}
Content-Type: application/json

{
  "status": "online",
  "version": "2.1.0",
  "metrics": { ... },
  "executedCommands": [1, 2, 3]
}
```

**Resposta:**
```json
{
  "success": true,
  "token": "novo_token",
  "pendingCommands": [
    {
      "id": 5,
      "type": "restart",
      "data": {}
    }
  ]
}
```

#### Registrar Evento

```http
POST /api/player/event?uin={UIN}&token={token}
Content-Type: application/json

{
  "eventType": "video_playback_start",
  "mediaId": 10,
  "playlistId": 5,
  "campaignId": 3,
  "metadata": { ... }
}
```

**Tipos de Evento:**
- `video_playback_start`
- `video_playback_end`
- `video_playback_error`
- `image_display`
- `playlist_start`
- `playlist_end`

### Campanhas

#### Listar Campanhas

```http
GET /api/campaigns
Authorization: Bearer <token>
```

**Query Parameters:**
- `status`: Filtrar por status (active, paused, etc.)
- `subscriberId`: Filtrar por subscriber
- `page`: Número da página
- `limit`: Itens por página

#### Criar Campanha

```http
POST /api/campaigns
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Campanha Verão",
  "startDate": "2026-01-01",
  "endDate": "2026-03-31",
  "startTime": "08:00",
  "endTime": "22:00",
  "daysOfWeek": ["monday", "tuesday", "wednesday"],
  "priority": 75,
  "playlistIds": [5, 6],
  "totemIds": [1, 2, 3]
}
```

#### Atualizar Campanha

```http
PUT /api/campaigns/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Campanha Verão Atualizada",
  "priority": 80
}
```

### Playlists

#### Listar Playlists

```http
GET /api/playlists
Authorization: Bearer <token>
```

#### Criar Playlist

```http
POST /api/playlists
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Playlist Verão",
  "description": "Conteúdo de verão",
  "items": [
    {
      "mediaId": 10,
      "orderIndex": 0,
      "displaySeconds": 30
    }
  ]
}
```

### Mídias

#### Upload de Mídia

```http
POST /api/media/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <arquivo>
name: "Vídeo Promocional"
description: "Descrição opcional"
```

#### Listar Mídias

```http
GET /api/media
Authorization: Bearer <token>
```

**Query Parameters:**
- `status`: Filtrar por status (approved, pending, etc.)
- `mediaType`: Filtrar por tipo (video, image, html)
- `page`: Número da página
- `limit`: Itens por página

### Totens

#### Listar Totens

```http
GET /api/totems
Authorization: Bearer <token>
```

#### Criar Totem

```http
POST /api/totems
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Totem Loja 1",
  "uin": "UIN-SHOPPING-001-2025",
  "localId": 1,
  "description": "Totem na entrada"
}
```

#### Enviar Comando Remoto

```http
POST /api/totems/:id/commands
Authorization: Bearer <token>
Content-Type: application/json

{
  "commandType": "restart",
  "commandData": {}
}
```

## Códigos de Status HTTP

- `200 OK`: Requisição bem-sucedida
- `201 Created`: Recurso criado com sucesso
- `400 Bad Request`: Dados inválidos
- `401 Unauthorized`: Não autenticado
- `403 Forbidden`: Sem permissão
- `404 Not Found`: Recurso não encontrado
- `500 Internal Server Error`: Erro interno do servidor

## Formato de Erro

```json
{
  "error": "Mensagem de erro",
  "details": [
    {
      "field": "campo",
      "message": "mensagem específica"
    }
  ]
}
```

## Rate Limiting

- **Player API**: Sem limite (endpoints públicos)
- **Admin API**: 100 requisições/minuto por IP
- **Upload**: 10 uploads/minuto por usuário

## Webhooks

### Configurar Webhook

```http
POST /api/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Meu Webhook",
  "url": "https://meu-servidor.com/webhook",
  "events": ["campaign.created", "totem.offline"],
  "secret": "minha_chave_secreta"
}
```

### Eventos Disponíveis

- `campaign.created`
- `campaign.updated`
- `campaign.approved`
- `totem.online`
- `totem.offline`
- `media.approved`
- `playlist.updated`

## Exemplos de Integração

### JavaScript/Node.js

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://seu-servidor:3000/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Listar campanhas
const campaigns = await api.get('/campaigns');

// Criar campanha
const newCampaign = await api.post('/campaigns', {
  title: 'Nova Campanha',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  playlistIds: [1, 2]
});
```

### Python

```python
import requests

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Listar campanhas
response = requests.get(
    'http://seu-servidor:3000/api/campaigns',
    headers=headers
)

campaigns = response.json()
```

### cURL

```bash
# Listar campanhas
curl -X GET \
  http://seu-servidor:3000/api/campaigns \
  -H "Authorization: Bearer $TOKEN"

# Criar campanha
curl -X POST \
  http://seu-servidor:3000/api/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Nova Campanha",
    "startDate": "2026-01-01",
    "endDate": "2026-12-31"
  }'
```

## Próximos Passos

- [Guia de Desenvolvimento](./02-desenvolvimento.md) - Detalhes técnicos
- [Migração](./03-migracao.md) - Guia de migração
