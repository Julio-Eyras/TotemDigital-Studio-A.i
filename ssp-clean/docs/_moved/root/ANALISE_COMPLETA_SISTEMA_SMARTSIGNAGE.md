# 📊 Análise Completa do Sistema SmartSignage Pro

**Data:** 2025-12-19  
**Versão do Sistema:** v2.1.0  
**Foco:** Servidor Único (single-server)

---

## 📋 Índice

1. [Arquitetura Geral](#arquitetura-geral)
2. [Camadas do Sistema](#camadas-do-sistema)
3. [Funcionalidades Principais](#funcionalidades-principais)
4. [Players - Versões e Categorias](#players---versões-e-categorias)
5. [Variáveis de Ambiente](#variáveis-de-ambiente)
6. [Lógica de Funcionamento](#lógica-de-funcionamento)
7. [Integrações](#integrações)
8. [Problemas Identificados](#problemas-identificados)
9. [Falhas de Lógica](#falhas-de-lógica)
10. [Funções Faltantes](#funções-faltantes)
11. [Variáveis Não Documentadas](#variáveis-não-documentadas)
12. [Debug e Logging](#debug-e-logging)
13. [Integridade do Sistema](#integridade-do-sistema)

---

## 🏗️ Arquitetura Geral

### Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│                    SMARTSIGNAGE PRO v2.1                     │
│                  (Single-Server Architecture)                │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ┌───▼───┐          ┌───▼───┐          ┌───▼───┐
    │Frontend│         │Backend │         │Database│
    │(React) │◄───────►│(NodeJS)│◄───────►│(PostgreSQL)
    └───┬───┘          └───┬───┘          └───────┘
        │                  │
        │                  ├──► Redis (Cache)
        │                  ├──► Nginx (Reverse Proxy)
        │                  ├──► MQTT (SmartDisplayFX)
        │                  └──► Ollama (IA)
        │
    ┌───▼───────────────────────────────────────────┐
    │           Players (Clientes)                   │
    │  - player-web/ (HTML5 básico)                  │
    │  - player-client/ (Smart TVs)                  │
    │  - player-agent/ (Sincronização)               │
    └────────────────────────────────────────────────┘
```

### Componentes Principais

1. **Frontend (React/TypeScript)**
   - Interface administrativa web
   - Dashboard, gestão de clientes, totens, campanhas
   - Upload de mídia, criação de playlists

2. **Backend (Node.js/TypeScript/Express)**
   - API REST completa
   - Serviços de negócio
   - Middlewares de segurança
   - Workers (background jobs)

3. **Database (PostgreSQL)**
   - Único banco de dados suportado
   - Schema completo em `database/smartchannel-db-v2-refactored-apply-all.sql`

4. **Nginx**
   - Reverse proxy
   - Servir arquivos estáticos (frontend, player-web)
   - Proxy para API backend

5. **Redis (Opcional)**
   - Cache
   - Queue management

6. **Players**
   - Múltiplas versões e plataformas (ver seção Players)

---

## 🔷 Camadas do Sistema

### 1. Camada de Apresentação (Frontend)

**Localização:** `frontend/`

**Tecnologias:**
- React 18
- TypeScript
- Material-UI ou similar
- Axios (API calls)

**Páginas Principais:**
- `/login` - Autenticação
- `/dashboard` - Dashboard principal
- `/clients` - Gestão de clientes
- `/totems` - Gestão de totens/players
- `/campaigns` - Gestão de campanhas
- `/media` - Upload e gestão de mídia
- `/playlists` - Criação de playlists
- `/analytics` - Analytics e relatórios
- `/billing` - Faturamento
- `/settings` - Configurações

**Integração:**
- API REST: `http://localhost:3000/api/*`
- Autenticação JWT
- WebSocket (opcional, para atualizações em tempo real)

---

### 2. Camada de Aplicação (Backend)

**Localização:** `backend/src/`

#### 2.1 Routes (Rotas API)

**Arquivos:** `backend/src/routes/*.ts`

**Principais Rotas:**

| Rota | Arquivo | Descrição |
|------|---------|-----------|
| `/api/auth` | `auth.ts` | Autenticação (login, refresh, 2FA) |
| `/api/users` | `users.ts` | Gestão de usuários |
| `/api/clients` | `clients.ts` | Gestão de clientes |
| `/api/totems` | `totems.ts` | Gestão de totens/dispositivos |
| `/api/players` | `players.ts` | API de gerenciamento de players |
| `/api/player` | `player.ts` | API de validação/registro do player |
| `/api/media` | `media.ts` | Upload e gestão de mídia |
| `/api/playlists` | `playlists.ts` | Gestão de playlists |
| `/api/campaigns` | `campaigns.ts` | Gestão de campanhas |
| `/api/analytics` | `analytics.ts` | Analytics |
| `/api/billing` | `billing.ts` | Faturamento |
| `/api/ai` | `ai.ts` | Integração com IA |
| `/api/smart-playlist` | `smart-playlist.ts` | Playlists inteligentes |
| `/api/reports` | `reports.ts` | Relatórios |
| `/api/settings` | `settings.ts` | Configurações do sistema |
| `/api/smartdisplayfx/*` | `smartdisplayfx*.ts` | SmartDisplayFX (efeitos visuais) |

**Total:** ~47 arquivos de rotas

#### 2.2 Services (Serviços de Negócio)

**Arquivos:** `backend/src/services/*.ts`

**Principais Serviços:**

| Serviço | Arquivo | Responsabilidade |
|---------|---------|------------------|
| `AuthService` | `authService.ts` | Autenticação, JWT, 2FA |
| `UserService` | `userService.ts` | Gestão de usuários |
| `ClientService` | `clientService.ts` | Gestão de clientes |
| `TotemService` | `totemService.ts` | Gestão de totens |
| `PlayerService` | `playerService.ts` | Gestão de players |
| `MediaService` | `mediaService.ts` | Upload e gestão de mídia |
| `PlaylistService` | `playlistService.ts` | Gestão de playlists |
| `CampaignService` | `campaignService.ts` | Gestão de campanhas |
| `AnalyticsService` | `analyticsService.ts` | Analytics e métricas |
| `BillingService` | `billingService.ts` | Faturamento |
| `AIService` | `aiService.ts` | Integração com IA |
| `SmartPlaylistService` | `smartPlaylistService.ts` | Playlists inteligentes |
| `ReportsService` | `reportsService.ts` | Geração de relatórios |
| `SystemService` | `systemService.ts` | Informações do sistema |
| `StorageService` | `storageService.ts` | Armazenamento de arquivos |
| `EmailService` | `emailService.ts` | Envio de emails |
| `WebSocketService` | `websocketService.ts` | WebSocket para real-time |

**Total:** ~60 arquivos de serviços

#### 2.3 Middleware

**Arquivos:** `backend/src/middleware/*.ts`

| Middleware | Arquivo | Função |
|------------|---------|--------|
| `authMiddleware` | `auth.middleware.ts` | Validação JWT |
| `security.middleware` | `security.middleware.ts` | Rate limiting, validação payload |
| `error.middleware` | `error.middleware.ts` | Tratamento de erros |
| `logger.middleware` | `logger.middleware.ts` | Logging de requisições |
| `operatorProtection.middleware` | `operatorProtection.middleware.ts` | Proteção de dados de clientes |
| `auditSystemUsers.middleware` | `auditSystemUsers.middleware.ts` | Auditoria de usuários sistema |

#### 2.4 Config

**Arquivos:** `backend/src/config/*.ts`

| Config | Arquivo | Responsabilidade |
|--------|---------|------------------|
| `env.ts` | `env.ts` | Variáveis de ambiente |
| `database.ts` | `database.ts` | Configuração PostgreSQL |
| `redis.ts` | `redis.ts` | Configuração Redis |
| `logger.ts` | `logger.ts` | Configuração de logs |
| `queue.ts` | `queue.ts` | Configuração de filas |

#### 2.5 Workers (Background Jobs)

**Localização:** `backend/src/workers/`

| Worker | Arquivo | Responsabilidade |
|--------|---------|------------------|
| `ExportWorker` | `exportWorker.ts` | Processamento de exports |
| `AdvancedScheduleWorker` | `advancedScheduleWorker.ts` | Agendamentos avançados |
| `InvoiceWorker` | `invoiceWorker.ts` | Processamento de faturas |

---

### 3. Camada de Dados (Database)

**Localização:** `database/smartchannel-db-v2-refactored-apply-all.sql`

**Tipo:** PostgreSQL 15+

**Schema:**
- ~70+ tabelas
- Relacionamentos complexos
- Índices otimizados
- Triggers e funções

**Tabelas Principais:**
- `users` - Usuários do sistema
- `clients` - Clientes
- `totems` - Totens/dispositivos
- `media` - Arquivos de mídia
- `playlists` - Playlists
- `campaigns` - Campanhas
- `analytics_*` - Tabelas de analytics
- `billing_*` - Tabelas de faturamento

---

### 4. Camada de Infraestrutura

#### 4.1 Nginx

**Configuração:** `nginx/*.conf`

**Funções:**
- Reverse proxy para backend (`/api/*` → `http://localhost:3000`)
- Servir frontend estático (`/` → `/usr/share/nginx/html`)
- Servir player-web (`/player` → `/opt/smart-signage/player-web/`)
- Compressão gzip
- Cache de arquivos estáticos

#### 4.2 Systemd Services

**Serviços:**
- `smartsignage-backend.service` - Backend Node.js
- `smartsignage-frontend.service` - Nginx (frontend)
- `postgresql.service` - PostgreSQL
- `redis.service` - Redis (se instalado)

---

## 🎯 Funcionalidades Principais

### 1. Autenticação e Autorização

**Funcionalidades:**
- ✅ Login/Logout
- ✅ JWT (Access + Refresh tokens)
- ✅ 2FA (TOTP)
- ✅ Roles e Permissions
- ✅ Proteção de rotas
- ✅ Rate limiting

**Problemas Identificados:**
- ⚠️ Falta validação de força de senha
- ⚠️ Falta política de expiração de senha
- ⚠️ Falta auditoria completa de logins

---

### 2. Gestão de Clientes e Usuários

**Funcionalidades:**
- ✅ CRUD de clientes
- ✅ CRUD de usuários
- ✅ Multi-tenancy (isolamento de dados)
- ✅ Hierarquia de clientes

**Problemas Identificados:**
- ⚠️ Falta verificação de quota por cliente
- ⚠️ Falta gestão de subclientes

---

### 3. Gestão de Totens/Players

**Funcionalidades:**
- ✅ CRUD de totens
- ✅ Registro automático (UIN)
- ✅ Heartbeat
- ✅ Status online/offline
- ✅ Comandos remotos

**Problemas Identificados:**
- ⚠️ Falta sincronização de timezone
- ⚠️ Falta gestão de grupos de totens

---

### 4. Gestão de Mídia

**Funcionalidades:**
- ✅ Upload de arquivos
- ✅ Validação de tipo/tamanho
- ✅ Conversão de formato (se necessário)
- ✅ Storage management
- ✅ Quota por cliente

**Problemas Identificados:**
- ⚠️ Falta compressão automática de imagens
- ⚠️ Falta transcodificação de vídeo
- ⚠️ Falta CDN integration

---

### 5. Playlists e Campanhas

**Funcionalidades:**
- ✅ Criação de playlists
- ✅ Agendamento
- ✅ Playlists inteligentes (IA)
- ✅ Campanhas com múltiplas playlists

**Problemas Identificados:**
- ⚠️ Falta validação de conflitos de agendamento
- ⚠️ Falta preview de playlist

---

### 6. Analytics

**Funcionalidades:**
- ✅ Métricas de execução
- ✅ Relatórios
- ✅ Export de dados

**Problemas Identificados:**
- ⚠️ Falta analytics em tempo real
- ⚠️ Falta dashboards customizáveis

---

### 7. IA (Smart Playlists)

**Funcionalidades:**
- ✅ Integração com Ollama/OpenAI/Anthropic
- ✅ Geração de playlists com IA
- ✅ Análise de conteúdo

**Problemas Identificados:**
- ⚠️ Falta cache de respostas IA
- ⚠️ Falta fallback quando IA não disponível

---

### 8. SmartDisplayFX

**Funcionalidades:**
- ✅ Efeitos visuais avançados
- ✅ Sincronização MQTT
- ✅ Orquestração multi-totem

**Problemas Identificados:**
- ⚠️ Falta documentação completa
- ⚠️ Falta testes de carga

---

## 🎮 Players - Versões e Categorias

### Visão Geral

O sistema possui **múltiplos tipos de players** organizados em diferentes categorias:

```
PLAYERS
│
├── 📱 player-web/ (HTML5 Básico)
│   └── Uso: PCs, tablets, navegadores genéricos
│
├── 📺 player-client/ (Smart TVs)
│   ├── BASE (HLS Minimalista)
│   │   ├── android/SmartSignage-ANDROID-PLAYER-HLS/
│   │   ├── tizen/SmartSignage-TIZEN-PLAYER-HLS/
│   │   └── webos/SmartSignage-LG-PLAYER-HLS/
│   │
│   └── PRO (Completo)
│       ├── android/SmartSignage-ANDROID-PLAYER/
│       ├── tizen/SmartSignage-TIZEN-PLAYER/
│       └── webos/SmartSignage-LG-PLAYER/
│
├── 🔄 player-agent/ (Sincronização)
│   └── Agente Node.js para telemetria
│
└── 🎨 player-fx/ (Efeitos FX)
    └── Player especializado em efeitos visuais
```

---

### 1. player-web/ (HTML5 Básico)

**Localização:** `player-web/`

**Tipo:** Player HTML5 servido pelo backend via Nginx

**Características:**
- ✅ Player HTML5 completo (1512 linhas)
- ✅ Playlist management
- ✅ Media playback (vídeo, imagem, HTML)
- ✅ Heartbeat periódico
- ✅ Recebimento de comandos
- ✅ Auto-registro (UIN)
- ✅ Modo kiosk com PIN de saída
- ✅ Validação de totem no backend
- ✅ Cache local de mídia

**URL:** `http://servidor/player?uin=XXXXX`

**Quando usar:**
- Dispositivos genéricos (PCs, tablets)
- Navegadores web
- Ambiente de teste/desenvolvimento
- Fallback quando não há player nativo

**Integração:**
- Backend: `/api/player/*`
- Nginx: Serve em `/player`
- Uso: Acessado via navegador com `?uin=XXXXX`

---

### 2. player-client/ BASE (HLS Minimalista)

**Localização:** `player-client/platforms/*/SmartSignage-*-PLAYER-HLS/`

**Plataformas:**
- ✅ **Android TV:** `android/SmartSignage-ANDROID-PLAYER-HLS/`
- ✅ **Samsung Tizen:** `tizen/SmartSignage-TIZEN-PLAYER-HLS/`
- ✅ **LG webOS:** `webos/SmartSignage-LG-PLAYER-HLS/`

**Características BASE:**
- ✅ **HLS nativo apenas** (HTTP Live Streaming)
- ✅ **Hardware decoding** automático (H.264, H.265)
- ✅ **CPU baixíssimo** (< 10-15%)
- ✅ **24/7 operação** confiável
- ✅ **Auto-registro** (UIN)
- ✅ **Fallback offline** (USB/SSD)
- ✅ **HTTP Polling** para comandos (não WebSocket)
- ✅ **Heartbeat** periódico
- ✅ **Watchdog** multi-camada

**Quando usar BASE:**
- Streaming HLS contínuo
- Operação 24/7 pura
- CPU mínimo crítico
- Simplicidade e estabilidade
- Não precisa de efeitos visuais

**Arquitetura BASE:**
```
BASE Player
│
├── DeviceInfoService (coleta UIN, MAC, Device ID)
├── HLSPlayer (player HLS nativo)
├── CommandFetcher (HTTP polling)
├── HeartbeatService (envio de status)
└── FallbackManager (fallback offline)
```

---

### 3. player-client/ PRO (Versão Completa)

**Localização:** `player-client/platforms/*/SmartSignage-*-PLAYER/`

**Plataformas:**
- ✅ **Android TV:** `android/SmartSignage-ANDROID-PLAYER/`
- ✅ **Samsung Tizen:** `tizen/SmartSignage-TIZEN-PLAYER/`
- ✅ **LG webOS:** `webos/SmartSignage-LG-PLAYER/`

**Características PRO:**
- ✅ **Tudo do BASE +**
- ✅ **SmartDisplayFX** (efeitos visuais avançados)
- ✅ **PlaylistManager** avançado (múltiplos tipos de mídia)
- ✅ **Cache local** extensivo
- ✅ **Scheduler** complexo
- ✅ **Serviços interativos:**
  - Facial Recognition
  - Tag Reader (NFC/QR)
  - Visual Network Service
- ✅ **InterruptionManager** (interrupções programadas)
- ✅ **Integração MQTT** completa
- ✅ **InteractivePlayer** (interatividade)

**Quando usar PRO:**
- Funcionalidades avançadas necessárias
- Efeitos visuais e animações
- Playlists complexas
- Interatividade avançada
- Cache offline extensivo
- Sincronização multi-totem

**Arquitetura PRO:**
```
PRO Player
│
├── BASE (tudo acima) +
├── SmartDisplayFX Engine
├── PlaylistManager (avançado)
├── Cache Manager (extensivo)
├── Scheduler (complexo)
├── InterruptionManager
├── InteractivePlayer
└── MQTT Client (sincronização)
```

---

### 4. player-agent/ (Agente de Sincronização)

**Localização:** `player-agent/`

**Tipo:** Agente Node.js (monolito) executado como serviço systemd

**Características:**
- ✅ Heartbeat periódico para `/api/players/{id}/heartbeat`
- ✅ Sincronização de playlist via `/api/players/{id}/playlist`
- ✅ Download de mídias com cache local
- ✅ Validação de mídia por checksum
- ✅ Execução como serviço systemd

**Quando usar:**
- Separar **telemetria/sincronização** da **exibição visual**
- Player visual pode ser navegador (`/player`) ou player nativo
- Útil para totens que rodam players externos

**Integração:**
- Backend: API REST (`/api/players/{id}/*`)
- Serviço: systemd (`smartplayer-agent.service`)

---

### 5. player-fx/ (Player com Efeitos FX)

**Localização:** `player-fx/`

**Tipo:** Player TypeScript/Vite especializado em efeitos visuais

**Características:**
- ✅ Efeitos visuais avançados (Neon Warp, Ripple, etc.)
- ✅ Sincronização MQTT para múltiplos totens
- ✅ Renderização WebGL/Canvas
- ✅ Orquestração em tempo real
- ✅ Sincronização de tempo entre totens
- ✅ Timeline de efeitos

**Quando usar:**
- Projetos que requerem efeitos visuais específicos
- Sincronização avançada entre múltiplos totens
- Prototipagem de novos efeitos

**Status:** ⚠️ Em desenvolvimento/experimental

---

### 6. Outros Players

#### Linux Electron
- **Localização:** `player-client/platforms/linux-electron/`
- **Tipo:** Player Electron para Linux
- **Status:** ✅ Funcional

#### Windows Electron
- **Localização:** `player-client/platforms/windows-electron/`
- **Tipo:** Player Electron para Windows
- **Status:** ✅ Funcional

#### Linux C++
- **Localização:** `player-client/platforms/linux-cpp/`
- **Tipo:** Player nativo C++ para Linux
- **Status:** ✅ Funcional

---

### Comparação BASE vs PRO

| Característica | BASE | PRO |
|----------------|------|-----|
| **HLS** | ✅ Nativo | ✅ Nativo |
| **Hardware Decoding** | ✅ Sim | ✅ Sim |
| **CPU Usage** | < 10-15% | Variável (maior com FX) |
| **SmartDisplayFX** | ❌ Não | ✅ Sim |
| **Cache Local** | Básico | Extensivo |
| **Scheduler** | Básico | Complexo |
| **Interatividade** | ❌ Não | ✅ Sim |
| **MQTT** | ❌ Não | ✅ Sim |
| **Playlist Types** | HLS apenas | Múltiplos |
| **Uso** | 24/7 streaming | Funcionalidades avançadas |

---

## 🔧 Variáveis de Ambiente

### Variáveis Principais

#### Servidor

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `NODE_ENV` | Ambiente (production/development) | `development` | ✅ |
| `PORT` | Porta do backend | `3000` | ✅ |
| `HOST` | Host do backend | `0.0.0.0` | ✅ |

#### Database (PostgreSQL)

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `DATABASE_URL` | URL de conexão completa | - | ✅ |
| `DB_HOST` | Host do PostgreSQL | `localhost` | ⚠️ |
| `DB_PORT` | Porta do PostgreSQL | `5432` | ⚠️ |
| `DB_NAME` | Nome do banco | `smartsignage` | ⚠️ |
| `DB_USER` | Usuário do banco | `smartsignage` | ⚠️ |
| `DB_PASSWORD` | Senha do banco | - | ⚠️ |
| `DB_POOL_SIZE` | Tamanho do pool | `20` | ❌ |
| `DB_CONNECTION_TIMEOUT` | Timeout de conexão (ms) | `30000` | ❌ |

**Nota:** Se `DATABASE_URL` estiver definida, tem precedência sobre variáveis individuais.

#### Autenticação (JWT)

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `JWT_SECRET` | Chave secreta JWT | - | ✅ |
| `JWT_EXPIRES_IN` | Tempo de expiração | `24h` | ❌ |
| `JWT_REFRESH_EXPIRES_IN` | Tempo de expiração refresh | `7d` | ❌ |
| `TWO_FACTOR_ENCRYPTION_KEY` | Chave para 2FA | `JWT_SECRET` | ❌ |

#### Segurança

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `PLAYER_ABANDON_PIN` | PIN para sair do player | `1234` | ❌ |
| `BCRYPT_ROUNDS` | Rounds de hash de senha | `12` | ❌ |
| `CORS_ORIGIN` | Origens CORS permitidas | `http://localhost:3000` | ❌ |
| `MAX_PAYLOAD_SIZE` | Tamanho máximo payload | `10MB` | ❌ |

#### Rate Limiting

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `RATE_LIMIT_WINDOW_MS` | Janela de rate limit (ms) | `900000` (15min) | ❌ |
| `RATE_LIMIT_MAX_REQUESTS` | Máx requisições por janela | `100` | ❌ |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Janela para auth (ms) | `900000` (15min) | ❌ |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | Máx tentativas login | `5` | ❌ |
| `UPLOAD_RATE_LIMIT_WINDOW_MS` | Janela para upload (ms) | `3600000` (1h) | ❌ |
| `UPLOAD_RATE_LIMIT_MAX_REQUESTS` | Máx uploads por janela | `20` | ❌ |

#### Upload de Arquivos

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `UPLOAD_MAX_SIZE` | Tamanho máximo upload | `100MB` | ❌ |
| `UPLOAD_PATH` | Caminho de upload | `/opt/smart-signage/public/assets/uploads` | ❌ |
| `MEDIA_QUOTA_PER_CLIENT` | Quota por cliente | `5GB` | ❌ |
| `ALLOWED_FILE_TYPES` | Tipos permitidos | Múltiplos | ❌ |

#### Redis (Cache)

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `CACHE_ENABLED` | Habilitar cache | `true` | ❌ |
| `REDIS_URL` | URL do Redis | `redis://localhost:6379` | ❌ |
| `REDIS_HOST` | Host do Redis | `localhost` | ❌ |
| `REDIS_PORT` | Porta do Redis | `6379` | ❌ |
| `REDIS_PASSWORD` | Senha do Redis | - | ❌ |

#### Player

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `PLAYER_PATH` | Caminho do player-web | `/opt/smart-signage/player-web/index.html` | ❌ |
| `PLAYER_DIR` | Diretório do player-web | `/opt/smart-signage/player-web` | ❌ |
| `PLAYER_ABANDON_PIN` | PIN para sair do kiosk | `1234` | ❌ |

**Problemas Identificados:**
- ⚠️ `PLAYER_PATH` e `PLAYER_DIR` não estão documentados em `env.example`
- ⚠️ Falta `PLAYER_HEARTBEAT_INTERVAL` no backend (usado apenas no frontend)
- ⚠️ Falta `PLAYER_API_URL` no backend

#### IA

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `AI_PROVIDER` | Provider (ollama/openai/anthropic) | `ollama` | ❌ |
| `AI_MODEL` | Modelo a usar | `llama3.2:3b` | ❌ |
| `OLLAMA_BASE_URL` | URL do Ollama | `http://localhost:11434` | ❌ |
| `OPENAI_API_KEY` | Chave API OpenAI | - | ❌ |
| `ANTHROPIC_API_KEY` | Chave API Anthropic | - | ❌ |

#### SmartDisplayFX / MQTT

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `SMARTDISPLAYFX_MQTT_ENABLED` | Habilitar MQTT | `false` | ❌ |
| `SMARTDISPLAYFX_MQTT_URL` | URL do broker MQTT | `mqtt://localhost:1883` | ❌ |
| `SMARTDISPLAYFX_MQTT_USERNAME` | Usuário MQTT | - | ❌ |
| `SMARTDISPLAYFX_MQTT_PASSWORD` | Senha MQTT | - | ❌ |
| `SMARTDISPLAYFX_MQTT_PREFIX` | Prefixo de tópicos | `smartdisplay` | ❌ |

#### Email

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `EMAIL_ENABLED` | Habilitar email | `false` | ❌ |
| `SMTP_HOST` | Servidor SMTP | `smtp.gmail.com` | ❌ |
| `SMTP_PORT` | Porta SMTP | `587` | ❌ |
| `SMTP_USER` | Usuário SMTP | - | ❌ |
| `SMTP_PASS` | Senha SMTP | - | ❌ |
| `SMTP_FROM` | Email remetente | - | ❌ |

#### Logging

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `LOG_LEVEL` | Nível de log | `info` | ❌ |
| `LOG_FILE` | Arquivo de log | `./logs/app.log` | ❌ |
| `LOG_MAX_SIZE` | Tamanho máximo | `10MB` | ❌ |
| `LOG_MAX_FILES` | Máximo de arquivos | `5` | ❌ |

---

### Variáveis Não Documentadas

**Problemas Identificados:**

1. **Variáveis do Player:**
   - ⚠️ `PLAYER_PATH` - Usado em `backend/src/index.ts` mas não em `env.example`
   - ⚠️ `PLAYER_DIR` - Usado em `backend/src/routes/totems.ts` mas não em `env.example`
   - ⚠️ `PLAYER_AUTO_START` - Usado em `systemService.ts` mas não documentado
   - ⚠️ `PLAYER_FULLSCREEN` - Usado em `systemService.ts` mas não documentado
   - ⚠️ `PLAYER_PORTRAIT` - Usado em `systemService.ts` mas não documentado

2. **Variáveis do Install Script:**
   - ⚠️ Múltiplas variáveis usadas no `install-smartsignage.sh` não estão documentadas
   - ⚠️ Variáveis de porta (FRONTEND_PORT, BACKEND_PORT, etc.) não estão em `env.example` do backend

3. **Inconsistências:**
   - ⚠️ `env.example` (raiz) vs `backend/env.example` - Conteúdos diferentes
   - ⚠️ Algumas variáveis têm padrões diferentes em diferentes arquivos

---

## 🔄 Lógica de Funcionamento

### Fluxo de Instalação (Single-Server)

```
1. Executar install-smartsignage.sh
   │
   ├──► Detectar OS (Ubuntu/Debian)
   ├──► Instalar dependências (Node.js, PostgreSQL, Nginx, etc.)
   ├──► Configurar PostgreSQL
   ├──► Executar schema SQL (smartchannel-db-v2-refactored-apply-all.sql)
   ├──► Build Backend (TypeScript → JavaScript)
   ├──► Build Frontend (React → static files)
   ├──► Configurar Nginx
   ├──► Copiar player-web/ para /opt/smart-signage/player-web/
   ├──► Criar serviços systemd
   └──► Iniciar serviços
```

### Fluxo de Autenticação

```
1. Cliente faz POST /api/auth/login
   │
   ├──► AuthService valida credenciais
   ├──► Se 2FA habilitado → retorna token temporário
   ├──► Senão → gera JWT (access + refresh)
   │
   └──► Cliente armazena tokens
       │
       ├──► Access token → usar em requisições (Authorization header)
       ├──► Refresh token → usar quando access expirar
       │
       └──► Backend valida token em cada requisição (authMiddleware)
```

### Fluxo de Player Registration

```
1. Player acessa /player?uin=XXXXX
   │
   ├──► Backend valida UIN
   ├──► Se não existe → cria totem automaticamente
   ├──► Gera token de autenticação
   │
   └──► Player recebe token e configuração
       │
       ├──► Player inicia heartbeat periódico
       ├──► Player faz polling de comandos
       ├──► Player recebe playlist
       └──► Player reproduz mídia
```

### Fluxo de Playlist

```
1. Admin cria playlist no frontend
   │
   ├──► Frontend → POST /api/playlists
   ├──► Backend → PlaylistService.create()
   ├──► Salva no banco
   │
   └──► Admin associa playlist a totem/campanha
       │
       ├──► Frontend → POST /api/campaigns ou PUT /api/totems/:id
       ├──► Backend atualiza totem/campanha
       │
       └──► Player faz polling de comandos
           │
           ├──► Player → GET /api/player/command?uin=XXXXX
           ├──► Backend retorna comando "PLAY" com playlist
           │
           └──► Player reproduz playlist
```

### Fluxo de Upload de Mídia

```
1. Admin faz upload no frontend
   │
   ├──► Frontend → POST /api/media/upload
   ├──► Backend valida:
   │   ├──► Tipo de arquivo permitido
   │   ├──► Tamanho máximo
   │   ├──► Quota do cliente
   │
   ├──► StorageService salva arquivo
   ├──► Salva metadata no banco
   │
   └──► Retorna URL da mídia para uso em playlists
```

---

## 🔗 Integrações

### 1. PostgreSQL

**Tipo:** Banco de dados principal (único suportado)

**Conexão:**
- Pool de conexões
- Timeout configurável
- Retry automático

**Problemas Identificados:**
- ⚠️ Falta connection pooling monitoring
- ⚠️ Falta backup automático configurável

---

### 2. Redis

**Tipo:** Cache opcional

**Uso:**
- Cache de queries frequentes
- Queue management
- Session storage (opcional)

**Problemas Identificados:**
- ⚠️ Redis não é obrigatório mas alguns serviços podem depender
- ⚠️ Falta validação clara de dependência

---

### 3. MQTT (SmartDisplayFX)

**Tipo:** Broker MQTT para sincronização

**Uso:**
- Sincronização de efeitos entre totens
- Orquestração multi-totem
- SmartDisplayFX

**Problemas Identificados:**
- ⚠️ Falta documentação de tópicos MQTT
- ⚠️ Falta validação de conexão MQTT

---

### 4. IA (Ollama/OpenAI/Anthropic)

**Tipo:** Integração com serviços de IA

**Uso:**
- Geração de playlists inteligentes
- Análise de conteúdo
- Sugestões automáticas

**Problemas Identificados:**
- ⚠️ Falta cache de respostas IA
- ⚠️ Falta fallback quando IA não disponível
- ⚠️ Falta controle de custos

---

### 5. Email (SMTP)

**Tipo:** Envio de emails

**Uso:**
- Notificações
- Relatórios por email
- Recuperação de senha

**Problemas Identificados:**
- ⚠️ Falta template engine
- ⚠️ Falta fila de emails

---

## ❌ Problemas Identificados

### 1. Falhas de Lógica

#### 1.1 Player Path Inconsistente

**Problema:**
- `PLAYER_PATH` usado em `backend/src/index.ts` com padrão `/opt/smart-signage/player-web/index.html`
- `PLAYER_DIR` usado em `backend/src/routes/totems.ts` com padrão `/opt/smart-signage/player-web`
- Mas `PLAYER_PATH` não está em `env.example`

**Impacto:**
- Usuários podem não saber como configurar caminho do player
- Instalação pode falhar se path não estiver correto

**Solução Sugerida:**
- Adicionar `PLAYER_PATH` e `PLAYER_DIR` em `env.example`
- Documentar relação entre as duas variáveis

---

#### 1.2 Validação de Variáveis de Ambiente

**Problema:**
- `backend/src/config/env.ts` usa `requireEnv()` para `DATABASE_URL` e `JWT_SECRET`
- Mas `env.example` não deixa claro quais são obrigatórias

**Impacto:**
- Sistema pode falhar silenciosamente se variáveis não estiverem definidas
- Difícil depurar problemas de configuração

**Solução Sugerida:**
- Documentar claramente variáveis obrigatórias vs opcionais
- Adicionar validação na inicialização com mensagens claras

---

#### 1.3 Player Config Missing Variables

**Problema:**
- `systemService.ts` usa `process.env.PLAYER_AUTO_START`, `PLAYER_FULLSCREEN`, `PLAYER_PORTRAIT`
- Essas variáveis não estão documentadas em `env.example`

**Impacto:**
- Configuração do player pode não funcionar como esperado
- Valores padrão podem não ser os desejados

**Solução Sugerida:**
- Adicionar todas as variáveis de player em `env.example`
- Documentar valores padrão e quando usar

---

#### 1.4 Duplicação de env.example

**Problema:**
- Existem dois arquivos `env.example`:
  - Raiz: `env.example`
  - Backend: `backend/env.example`
- Conteúdos diferentes

**Impacto:**
- Confusão sobre qual usar
- Inconsistências na configuração

**Solução Sugerida:**
- Consolidar em um único arquivo
- Ou documentar diferença entre os dois

---

### 2. Funções Faltantes

#### 2.1 Validação de Quota por Cliente

**Problema:**
- `StorageService` tem `MEDIA_QUOTA_PER_CLIENT` mas pode não estar validando corretamente

**Impacto:**
- Clientes podem exceder quota
- Storage pode encher sem controle

**Solução Sugerida:**
- Implementar validação de quota antes de upload
- Adicionar endpoint para verificar quota

---

#### 2.2 Sincronização de Timezone

**Problema:**
- Totens podem estar em timezones diferentes
- Agendamentos podem não funcionar corretamente

**Impacto:**
- Playlists agendadas podem não executar no horário correto
- Analytics podem ter timestamps incorretos

**Solução Sugerida:**
- Adicionar campo `timezone` em `totems`
- Converter timestamps para timezone do totem

---

#### 2.3 Preview de Playlist

**Problema:**
- Não há endpoint para preview de playlist antes de publicar

**Impacto:**
- Admins não podem testar playlists antes de aplicar
- Pode causar problemas em produção

**Solução Sugerida:**
- Adicionar endpoint `/api/playlists/:id/preview`
- Retornar lista de mídias com URLs

---

#### 2.4 Backup Automático

**Problema:**
- Não há sistema de backup automático configurável

**Impacto:**
- Dados podem ser perdidos
- Recuperação difícil

**Solução Sugerida:**
- Implementar serviço de backup
- Configurável via variáveis de ambiente
- Agendamento via cron ou worker

---

#### 2.5 Health Check Avançado

**Problema:**
- Health check básico existe (`/health`)
- Mas não verifica todos os componentes

**Impacto:**
- Sistema pode reportar "healthy" mesmo com problemas
- Dificulta monitoramento

**Solução Sugerida:**
- Adicionar checks para:
  - Database connection
  - Redis connection
  - Disk space
  - Memory usage

---

### 3. Variáveis Não Documentadas

**Lista Completa:**

1. `PLAYER_PATH` - Caminho do player-web (usado em `backend/src/index.ts`)
2. `PLAYER_DIR` - Diretório do player-web (usado em `backend/src/routes/totems.ts`)
3. `PLAYER_AUTO_START` - Auto-start do player (usado em `systemService.ts`)
4. `PLAYER_FULLSCREEN` - Fullscreen do player (usado em `systemService.ts`)
5. `PLAYER_PORTRAIT` - Orientação portrait (usado em `systemService.ts`)
6. `HEARTBEAT_INTERVAL` - Intervalo de heartbeat (mencionado mas não usado)
7. `SERVER_URL` - URL do servidor (usado em `systemService.ts`)

**Solução Sugerida:**
- Adicionar todas em `env.example`
- Documentar com descrição e valor padrão

---

### 4. Debug e Logging

#### 4.1 Níveis de Log

**Problema:**
- `LOG_LEVEL` existe mas pode não estar sendo usado consistentemente

**Impacto:**
- Difícil depurar problemas
- Logs podem ser muito verbosos ou muito silenciosos

**Solução Sugerida:**
- Garantir que todos os serviços respeitam `LOG_LEVEL`
- Adicionar logs estruturados (JSON)

---

#### 4.2 Logs de Player

**Problema:**
- Player debug existe (`/api/player/debug/*`)
- Mas pode não estar capturando todos os erros

**Impacto:**
- Difícil depurar problemas de players
- Erros podem passar despercebidos

**Solução Sugerida:**
- Melhorar captura de erros do player
- Adicionar logs de heartbeat
- Adicionar logs de comandos

---

#### 4.3 Logs de Instalação

**Problema:**
- `install-smartsignage.sh` tem logs mas podem não estar salvos

**Impacto:**
- Difícil depurar problemas de instalação
- Erros podem ser perdidos

**Solução Sugerida:**
- Salvar logs de instalação em arquivo
- Adicionar opção de verbose mode

---

### 5. Integridade do Sistema

#### 5.1 Validação de Integridade

**Problema:**
- Não há validação automática de integridade do sistema

**Impacto:**
- Problemas podem passar despercebidos
- Sistema pode estar corrompido sem saber

**Solução Sugerida:**
- Implementar health check completo
- Adicionar validação de schema do banco
- Adicionar validação de arquivos de mídia

---

#### 5.2 Sincronização de Dados

**Problema:**
- Não há verificação de sincronização entre componentes

**Impacto:**
- Dados podem ficar desatualizados
- Inconsistências podem ocorrer

**Solução Sugerida:**
- Adicionar checks de consistência
- Implementar sincronização automática

---

#### 5.3 Permissões de Arquivos

**Problema:**
- Permissões podem não estar corretas após instalação

**Impacto:**
- Uploads podem falhar
- Player pode não acessar arquivos

**Solução Sugerida:**
- Validar permissões na instalação
- Adicionar script de fix de permissões

---

## 📝 Resumo Executivo

### Status Geral

**✅ Funcionalidades Principais:** Implementadas e funcionais  
**⚠️ Documentação:** Incompleta (variáveis não documentadas)  
**⚠️ Validações:** Faltam validações importantes  
**⚠️ Debug:** Pode ser melhorado  

### Prioridades de Correção

1. **Alta Prioridade:**
   - Documentar todas as variáveis de ambiente
   - Adicionar validação de quota por cliente
   - Corrigir inconsistências de paths do player

2. **Média Prioridade:**
   - Implementar backup automático
   - Adicionar preview de playlist
   - Melhorar health checks

3. **Baixa Prioridade:**
   - Sincronização de timezone
   - Logs estruturados
   - Validação de integridade

---

**Data da Análise:** 2025-12-19  
**Próximos Passos:** Aguardando aprovação para correções

