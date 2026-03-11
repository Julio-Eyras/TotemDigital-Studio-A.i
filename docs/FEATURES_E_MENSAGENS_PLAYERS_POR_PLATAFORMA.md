# Features das plataformas players e mensagens (estruturas esperadas e enviadas)

Documento sistemático: funcionalidades por plataforma e contrato das mensagens entre players e backend.  
Complementa **MAPA_PLAYERS_POR_PLATAFORMA.md** e **DESIGN_PLAYER_PLATAFORMAS_STORAGE_E_DOWNLOAD.md**.

---

## 1. Features por plataforma (matriz sistemática)

### 1.1 Autenticação e identidade

| Feature | Android | Linux Electron | Linux C++ | webOS | Tizen |
|--------|---------|----------------|-----------|-------|-------|
| Token de dispositivo (GET /api/player/token) | ✅ | ✅ | ❌ | ✅ | ✅ |
| Autenticação legada (POST /api/player/register) | fallback | — | ✅ | fallback | fallback |
| UIN + secret (X-Totem-Token, X-Totem-UIN) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bearer token após getDeviceToken | ✅ | ✅ | — | ✅ | ✅ |

### 1.2 Conteúdo (playlist / plano)

| Feature | Android | Linux Electron | Linux C++ | webOS | Tizen |
|--------|---------|----------------|-----------|-------|-------|
| DispatchPlan (GET /api/player/dispatch) | ✅ principal | ✅ principal | ❌ | ✅ principal | ✅ principal |
| Playlist legada (GET /api/player/playlist ou totem) | ✅ fallback | ✅ fallback | ✅ | ✅ fallback | — |
| Modo offline (último plano em cache) | ✅ | ✅ | — | ✅ | ✅ |

### 1.3 Configuração e storage

| Feature | Android | Linux Electron | Linux C++ | webOS | Tizen |
|--------|---------|----------------|-----------|-------|-------|
| GET /api/player/config | ✅ | ✅ | ✅ | ✅ | ✅ |
| storageUseExternalFirst aplicado | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pasta propagandas (criada ao arranque) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Storage interno + externo (USB) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Convenção ficheiro {mediaId}.{ext} | ✅ | ✅ | ✅ | ✅ | ✅ |

### 1.4 Download e reprodução

| Feature | Android | Linux Electron | Linux C++ | webOS | Tizen |
|--------|---------|----------------|-----------|-------|-------|
| Download HTTPS para propagandas | ✅ | ✅ | ❌ | ✅ | ✅ |
| Resolução path local (externo → interno) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reprodução file:// quando existe local | ✅ | ✅ | ✅ | ✅ | ✅ |
| Endpoint download mídia (GET /api/media/:id/download) | ✅ | ✅ | — | ✅ | ✅ |

### 1.5 Heartbeat e comandos

| Feature | Android | Linux Electron | Linux C++ | webOS | Tizen |
|--------|---------|----------------|-----------|-------|-------|
| POST /api/player/heartbeat | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comandos pendentes na resposta | ✅ | ✅ | ✅ | ✅ | ✅ |
| executedCommands no body | opcional | opcional | opcional | opcional | opcional |

### 1.6 Outros

| Feature | Android | Linux Electron | Linux C++ | webOS | Tizen |
|--------|---------|----------------|-----------|-------|-------|
| Painel Debug (storage) | ✅ | ✅ | ❌ | ❌ | ❌ |
| TotemConnectionManager (totem local) | — | — | — | ✅ | ✅ |
| SmartDisplayFX (MQTT/efeitos) | — | ✅ | ❌ | ✅ | — |
| GET /api/player/validate | opcional | opcional | — | opcional | opcional |

---

## 2. Mensagens: endpoints, método, query/body e estruturas

Base URL: `{API_BASE_URL}` (ex.: `http://localhost:3000`).  
Autenticação: quando indicado, usar **Bearer token** (após getDeviceToken) ou **X-Totem-Token** + **X-Totem-UIN** (HMAC com totemSecret).

---

### 2.1 GET /api/player/token

**Objetivo:** Obter token de dispositivo para usar em dispatch e heartbeat.

**Request (query):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| uin | string | Sim | UIN do totem (1–100 caracteres) |
| deviceId | string | Não | ID estável do dispositivo |
| platform | string | Não | Ex.: `android`, `linux`, `webos`, `tizen` |
| appVersion | string | Não | Ex.: `2.1.0` |

**Headers (opcional para validação legada):**  
`X-Totem-Token`, `X-Totem-UIN` (token HMAC gerado com totemSecret).

**Response 200 (sucesso):**

```json
{
  "token": "string",
  "expiresIn": 3600
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| token | string | Token a enviar em dispatch e heartbeat |
| expiresIn | number | Segundos até expiração (ex.: 3600) |

**Respostas de erro:** 400 (UIN inválido), 500.

---

### 2.2 GET /api/player/config

**Objetivo:** Configuração do player (storage, heartbeat, etc.).

**Request:** Sem body. Query e headers opcionais.

**Response 200:**

```json
{
  "serverUrl": "string",
  "heartbeatInterval": 30000,
  "mediaPath": "/assets/uploads",
  "autoStart": true,
  "fullscreen": true,
  "portrait": false,
  "abandonPin": "string",
  "storageUseExternalFirst": true
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| serverUrl | string | URL base do backend |
| heartbeatInterval | number | Intervalo de heartbeat (ms) |
| mediaPath | string | Path base de mídias no servidor |
| autoStart | boolean | Início automático |
| fullscreen | boolean | Ecrã cheio |
| portrait | boolean | Orientação retrato |
| abandonPin | string | PIN de abandono (segurança) |
| storageUseExternalFirst | boolean | **Preferir storage externo (USB)** para propagandas |

---

### 2.3 GET /api/player/dispatch

**Objetivo:** Obter plano de exibição (DispatchPlan) para o totem.

**Request (query):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| uin | string | Sim | UIN do totem |
| token | string | Sim | Token de dispositivo (getDeviceToken) |
| deviceId | string | Não | ID do dispositivo |
| timestamp | string | Não | ISO8601 (ex.: momento do pedido) |
| timezone | string | Não | Ex.: `Europe/Lisbon` |

**Headers:**  
`Authorization: Bearer {token}` (recomendado) ou `X-Totem-Token` + `X-Totem-UIN`.

**Response 200 (sucesso):**

```json
{
  "success": true,
  "plan": {
    "totemId": 1,
    "timestamp": "2025-03-07T12:00:00.000Z",
    "playlistId": 10,
    "playlistName": "string",
    "mediaItems": [
      {
        "mediaId": 1,
        "order": 1,
        "duration": 10,
        "url": "https://... ou /api/media/1/stream",
        "mediaType": "video",
        "metadata": {
          "width": 1920,
          "height": 1080,
          "mimeType": "video/mp4",
          "checksum": "opcional",
          "size": "opcional"
        }
      }
    ],
    "totalDuration": 120,
    "priority": 1,
    "source": "campaign",
    "sourceId": 5,
    "sourceName": "string",
    "validityStart": "2025-03-07T00:00:00.000Z",
    "validityEnd": "2025-03-08T00:00:00.000Z",
    "metadata": {
      "resolution": "1920x1080",
      "orientation": "landscape",
      "campaignId": 1,
      "campaignTitle": "string",
      "mixId": 0,
      "mixStrategy": "string",
      "defaultAd": false
    }
  },
  "fromCache": false,
  "executionTimeMs": 50
}
```

**Estrutura do plano (plan):**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| totemId | number | ID do totem |
| timestamp | string (ISO) | Momento do plano |
| playlistId | number | ID da playlist |
| playlistName | string | Nome da playlist |
| mediaItems | array | Itens a exibir (ordem de reprodução) |
| totalDuration | number | Duração total (segundos) |
| priority | number | Prioridade do plano |
| source | string | `direct` \| `group` \| `campaign` \| `mix` |
| sourceId | number | ID do agendamento/campanha/mix |
| sourceName | string | Nome da origem |
| validityStart | string (ISO) | Início de validade |
| validityEnd | string (ISO) | Fim de validade |
| metadata | object | Metadados adicionais |

**Estrutura de cada mediaItem:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| mediaId | number | ID da mídia (uso em nome de ficheiro: `{mediaId}.{ext}`) |
| order | number | Ordem na playlist |
| duration | number | Duração em segundos |
| url | string | URL para download ou streaming (HTTPS ou path relativo ao backend) |
| mediaType | string | Ex.: `video`, `image`, `html` |
| metadata | object | width, height, mimeType; opcionalmente checksum, size, name |

**Response 200 (erro lógico, sem plano):**

```json
{
  "success": false,
  "error": "string"
}
```

**Respostas de erro:** 400 (parâmetros inválidos), 401 (token inválido), 500.

---

### 2.4 POST /api/player/heartbeat

**Objetivo:** Registrar presença do totem e obter comandos pendentes.

**Request (query):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| uin | string | Sim | UIN do totem |
| token | string | Sim | Token de dispositivo |
| deviceId | string | Não | ID do dispositivo |

**Request (body, JSON):**

```json
{
  "uin": "string",
  "deviceId": "string",
  "status": "online",
  "version": "2.1.0",
  "firmwareVersion": "string",
  "ipAddress": "string",
  "config": {},
  "metrics": {},
  "executedCommands": [1, 2]
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| status | string | Ex.: `online` |
| version | string | Versão do app |
| firmwareVersion | string | Versão do firmware/OS |
| ipAddress | string | IP do totem |
| config | object | Configuração do dispositivo (opcional) |
| metrics | object | Métricas (opcional) |
| executedCommands | number[] | IDs de comandos já executados (para marcar como executed) |

**Response 200 (sucesso):**

```json
{
  "success": true,
  "token": "string",
  "pendingCommands": [
    {
      "id": 1,
      "type": "string",
      "data": {},
      "priority": 1
    }
  ]
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| token | string | Novo token (renovado) |
| pendingCommands | array | Comandos remotos pendentes |

**Estrutura de cada comando pendente:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | number | command_id |
| type | string | command_type |
| data | object | Parâmetros (command_data) |
| priority | number | Prioridade |

**Respostas de erro:** 400, 401, 404 (totem não encontrado ou inativo), 500.

---

### 2.5 GET /api/player/validate

**Objetivo:** Validar totem e token (legado / diagnóstico).

**Request (query):**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| uin | string | Sim | UIN do totem |
| token | string | Não | Token a validar |

**Response 200:** Estrutura definida pelo DispatcherRouter (contém dados do totem, playlist, comandos, etc.). Usado como fallback quando não se usa DispatchPlan.

---

### 2.6 POST /api/player/register (legado)

**Objetivo:** Autenticação legada (obter token JWT para totem).

**Request (body, JSON):**

```json
{
  "uin": "string"
}
```

**Response 200:**

```json
{
  "token": "string",
  "refreshToken": "string"
}
```

O player usa `token` em `Authorization: Bearer {token}` nas chamadas seguintes.

---

### 2.7 GET /api/player/playlist (legado)

**Objetivo:** Obter playlist no formato antigo (por totem/UIN).

**Request:** Query/headers conforme rota (UIN/token). A rota exata pode ser via totems ou player (depende do backend).

**Response 200 (exemplo):**

```json
{
  "items": [
    {
      "id": 1,
      "type": "video",
      "url": "string",
      "duration": 10000,
      "name": "string",
      "schedule": {}
    }
  ],
  "campaign_id": 0,
  "contract_valid": true,
  "access_granted": true
}
```

`duration` em ms no legado; `id` pode ser usado como mediaId para resolver path local em propagandas.

---

### 2.8 GET /api/media/:id/download

**Objetivo:** Download do ficheiro de mídia (para gravar em propagandas).

**Request:**  
- URL: `GET {API_BASE_URL}/api/media/{mediaId}/download`  
- Headers: `Authorization: Bearer {token}` ou `X-Totem-Token` + `X-Totem-UIN`

**Response 200:** Ficheiro binário (stream); header `Content-Disposition` com nome do ficheiro.  
**Respostas de erro:** 401, 404 (mídia ou ficheiro não encontrado), 500.

---

### 2.9 GET /api/player/fallback-manifest

**Objetivo:** Listar propagandas e vinhetas para modo fallback (player-web / sem plano).

**Request:** Sem parâmetros obrigatórios.

**Response 200:**

```json
{
  "propagandas": ["f1.jpg", "f2.mp4"],
  "vinhetas": ["v1.mp4"]
}
```

Lista de nomes de ficheiros nas pastas do servidor (player-web).

---

## 3. Resumo das estruturas esperadas pelos players

### 3.1 O que o player envia (tipicamente)

- **Token:** Query `uin`, `token` (e opcionalmente `deviceId`, `platform`, `appVersion`, `timestamp`, `timezone`) conforme o endpoint.
- **Heartbeat:** Body com `status`, `version`, `metrics`, `executedCommands`, etc.
- **Headers:** `Authorization: Bearer {token}` após getDeviceToken; ou `X-Totem-Token` + `X-Totem-UIN` (HMAC com totemSecret).

### 3.2 O que o player espera receber

- **Config:** Objeto com `storageUseExternalFirst` (boolean) para definir ordem de storage (externo primeiro ou não).
- **DispatchPlan:** Objeto `plan` com `mediaItems[]`; cada item com `mediaId`, `order`, `duration`, `url`, `mediaType`, `metadata` (mimeType para extensão de ficheiro). O player grava em `.../propagandas/{mediaId}.{ext}` e resolve o path local por essa convenção.
- **Heartbeat:** Objeto com `token` (renovado) e `pendingCommands[]` (id, type, data, priority).
- **Download:** Stream binário do ficheiro de mídia para guardar localmente.

---

## 4. Referência cruzada

- **Fluxo e ficheiros:** **MAPA_PLAYERS_POR_PLATAFORMA.md**
- **Design storage e convenções:** **DESIGN_PLAYER_PLATAFORMAS_STORAGE_E_DOWNLOAD.md**
- **Tipos backend (DispatchPlan, DispatchMediaItem):** `backend/src/types/dispatcherTotem.types.ts`
- **Handlers (token, dispatch, heartbeat):** `backend/src/services/dispatcherRouter.ts`
- **Config do player (getPlayerConfig):** `backend/src/services/systemService.ts`

---

*Documento de referência para implementação e integração dos players. Atualizar quando forem adicionados novos campos ou endpoints.*
