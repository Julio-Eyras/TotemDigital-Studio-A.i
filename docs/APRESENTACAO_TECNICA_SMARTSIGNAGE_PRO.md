# SmartSignage Pro - Apresentação Técnica

## 🏗️ Arquitetura e Estrutura Técnica

### Visão Geral do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    SmartSignage Pro                          │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │   Frontend   │◄────►│   Backend    │                   │
│  │  (React)     │      │  (Node.js)   │                   │
│  └──────────────┘      └──────┬───────┘                   │
│                               │                             │
│                    ┌──────────┴──────────┐                │
│                    │                     │                │
│            ┌───────▼──────┐    ┌────────▼────────┐        │
│            │  PostgreSQL  │    │     Redis      │        │
│            │   Database   │    │     Cache       │        │
│            └──────────────┘    └─────────────────┘        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Player Clients (Multi-plataforma)          │  │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │  │
│  │  │webOS │  │Tizen │  │Android│  │Linux │  │Windows│ │  │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Stack Tecnológico

### **Backend**
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Linguagem**: TypeScript
- **Banco de Dados**: PostgreSQL 14+
- **Cache**: Redis 6+
- **Queue**: Bull (Redis-based)
- **Autenticação**: JWT + 2FA (TOTP)
- **Pagamentos**: Stripe API

### **Frontend**
- **Framework**: React 18+
- **Linguagem**: TypeScript
- **State Management**: Redux Toolkit + React Query
- **UI Framework**: Material-UI (MUI)
- **Build**: Vite
- **HTTP Client**: Axios

### **Player Clients**
- **webOS**: JavaScript + webOS TV SDK
- **Tizen**: JavaScript + Tizen TV SDK
- **Android TV**: Kotlin + Android TV SDK
- **Linux**: Electron + C++
- **Windows**: Electron

### **Infraestrutura**
- **Containerização**: Docker (opcional)
- **CI/CD**: GitHub Actions
- **Monitoramento**: Logs estruturados
- **Storage**: Sistema de arquivos + S3 (opcional)

---

## 🏛️ Arquitetura do Sistema

### **1. Camada de Apresentação (Frontend)**

```
Frontend (React)
├── Dashboard
│   ├── Estatísticas em tempo real
│   ├── Gráficos e métricas
│   └── Visão geral do sistema
├── Gestão de Conteúdo
│   ├── Mídias (upload, organização)
│   ├── Playlists (criação, edição)
│   └── Campanhas (agendamento)
├── Gestão de Totens
│   ├── Cadastro e aprovação
│   ├── Controle remoto
│   └── Monitoramento
├── Analytics
│   ├── Relatórios
│   ├── Export (Excel/PDF)
│   └── Insights
└── Configurações
    ├── Usuários e permissões
    ├── Sistema
    └── 2FA
```

### **2. Camada de Aplicação (Backend)**

```
Backend (Node.js/Express)
├── API REST
│   ├── Autenticação (JWT + 2FA)
│   ├── Gestão de usuários
│   ├── CRUD de entidades
│   └── Upload de arquivos
├── Serviços
│   ├── AuthService (autenticação)
│   ├── MediaService (mídias)
│   ├── PlaylistService (playlists)
│   ├── CampaignService (campanhas)
│   ├── TotemService (totens)
│   ├── AnalyticsService (analytics)
│   ├── BillingService (faturamento)
│   └── AIService (IA)
├── Workers
│   ├── InvoiceWorker (faturas)
│   ├── ExportWorker (exportações)
│   └── ScheduleWorker (agendamentos)
└── Middleware
    ├── Autenticação
    ├── Validação
    ├── Rate Limiting
    └── Logging
```

### **3. Camada de Dados**

```
PostgreSQL Database
├── users (usuários)
├── clients (clientes)
├── totems (totens/players)
├── medias (mídias)
├── playlists (playlists)
├── campaigns (campanhas)
├── event_logs (eventos)
├── plans (planos)
├── subscriptions (assinaturas)
├── invoices (faturas)
└── remote_commands (comandos remotos)
```

### **4. Camada de Cache**

```
Redis Cache
├── Session Storage
├── API Response Cache
├── Rate Limiting
└── Queue Management
```

---

## 🔧 Componentes Principais

### **1. Sistema de Autenticação**

```
┌─────────────┐
│   Login     │
└──────┬──────┘
       │
       ├─► JWT Token
       │
       ├─► 2FA (TOTP) ──► QR Code
       │
       └─► Refresh Token
```

**Características:**
- Autenticação JWT
- 2FA com TOTP (Google Authenticator)
- Refresh tokens
- Códigos de backup
- Controle de sessão

### **2. Sistema de Mídias**

```
Upload → Validação → Processamento → Armazenamento
   │         │            │              │
   │         │            │              └─► File System
   │         │            │
   │         │            └─► Thumbnail Generation
   │         │
   │         └─► Type/Size Validation
   │
   └─► Virus Scan (opcional)
```

**Características:**
- Upload múltiplo
- Validação de tipo/tamanho
- Geração de thumbnails
- Organização por categorias
- Suporte a vídeo, imagem, HTML

### **3. Sistema de Playlists**

```
Playlist Creation
    │
    ├─► Manual (drag & drop)
    │
    ├─► Smart Playlist (IA)
    │   └─► Regras automáticas
    │
    └─► Template-based
```

**Características:**
- Criação manual e automática
- IA para geração inteligente
- Agendamento temporal
- Transições configuráveis
- Versionamento

### **4. Sistema de Campanhas**

```
Campaign
    │
    ├─► Playlists
    │
    ├─► Totens
    │
    ├─► Schedule (start/end)
    │
    └─► Priority
```

**Características:**
- Agendamento temporal
- Múltiplas playlists
- Múltiplos totens
- Priorização
- Ativação automática

### **5. Sistema de Totens/Players**

```
Totem Registration
    │
    ├─► UIN Generation
    │
    ├─► Approval
    │
    ├─► Configuration
    │
    └─► Playlist Assignment
```

**Características:**
- Registro automático
- Aprovação manual
- Configuração remota
- Heartbeat monitoring
- Controle remoto

### **6. Sistema de Analytics**

```
Event Collection
    │
    ├─► Playback Events
    ├─► Display Events
    ├─► Interaction Events
    └─► System Events
         │
         └─► Aggregation
              │
              └─► Reports
```

**Características:**
- Coleta de eventos em tempo real
- Agregação de dados
- Relatórios exportáveis
- Dashboards interativos
- Insights com IA

---

## 🔐 Segurança

### **Camadas de Segurança**

```
┌─────────────────────────────────┐
│  HTTPS/TLS (Transport)          │
├─────────────────────────────────┤
│  Rate Limiting                  │
├─────────────────────────────────┤
│  Input Validation               │
├─────────────────────────────────┤
│  Authentication (JWT + 2FA)     │
├─────────────────────────────────┤
│  Authorization (RBAC)           │
├─────────────────────────────────┤
│  Data Encryption                 │
└─────────────────────────────────┘
```

**Implementações:**
- HTTPS obrigatório
- Rate limiting por endpoint
- Validação de entrada (express-validator)
- JWT com expiração
- 2FA com TOTP
- RBAC (Admin, Manager, Client)
- Criptografia de dados sensíveis
- Sanitização de logs

---

## 📊 Performance e Escalabilidade

### **Otimizações**

- **Cache Redis**: Respostas frequentes
- **Índices de Banco**: Queries otimizadas
- **Lazy Loading**: Carregamento sob demanda
- **Pagination**: Listagens paginadas
- **CDN**: Assets estáticos (opcional)
- **Compression**: Gzip/Brotli

### **Escalabilidade**

```
Horizontal Scaling
    │
    ├─► Load Balancer
    │
    ├─► Multiple Backend Instances
    │
    ├─► Shared Redis
    │
    └─► Shared PostgreSQL
```

**Suporta:**
- Múltiplas instâncias backend
- Load balancing
- Database replication
- Redis cluster
- Horizontal scaling

---

## 🔄 Fluxos Principais

### **1. Fluxo de Reprodução**

```
Player Start
    │
    ├─► Register/Validate
    │
    ├─► Get Playlist
    │
    ├─► Download Media (cache)
    │
    ├─► Play Media
    │
    ├─► Send Heartbeat
    │
    └─► Repeat
```

### **2. Fluxo de Atualização de Conteúdo**

```
Admin Updates Content
    │
    ├─► Upload Media
    │
    ├─► Create/Update Playlist
    │
    ├─► Assign to Campaign
    │
    ├─► Schedule Campaign
    │
    └─► Players Sync (Heartbeat)
         │
         └─► Download & Play
```

### **3. Fluxo de Billing**

```
Subscription
    │
    ├─► Stripe Checkout
    │
    ├─► Webhook Processing
    │
    ├─► Invoice Generation
    │
    └─► Email Delivery
```

---

## 📦 Requisitos do Sistema

### **Servidor (Backend)**

**Mínimo:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 50GB SSD
- Network: 100 Mbps

**Recomendado:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 200GB+ SSD
- Network: 1 Gbps

**Software:**
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Nginx (opcional)

### **Cliente (Frontend)**

**Navegador:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Resolução:**
- Mínimo: 1280x720
- Recomendado: 1920x1080+

### **Player Clients**

**webOS:**
- webOS 4.0+
- 2GB RAM
- 5GB Storage

**Tizen:**
- Tizen 4.0+
- 2GB RAM
- 5GB Storage

**Android TV:**
- Android 7.0+
- 2GB RAM
- 5GB Storage

**Linux:**
- Ubuntu 20.04+ / Debian 11+
- 2GB RAM
- 10GB Storage

**Windows:**
- Windows 10+
- 2GB RAM
- 10GB Storage

---

## 🔌 Integrações

### **APIs Disponíveis**

- **REST API**: Completa para integrações
- **Webhooks**: Eventos em tempo real
- **Stripe**: Pagamentos e assinaturas
- **Email**: SMTP configurável
- **Storage**: S3 compatível (opcional)

### **Integrações Futuras**

- Google Analytics
- Facebook/Instagram
- WhatsApp Business
- Sistemas ERP
- APIs de terceiros

---

## 📈 Monitoramento e Logs

### **Sistema de Logging**

- **Operacional**: Logs de arquivo (info, error, warn, debug)
- **Eventos**: Banco de dados (playback, display, interactions)
- **Auditoria**: Ações de usuários
- **Performance**: Métricas de sistema

### **Métricas Coletadas**

- Uptime de totens
- Taxa de reprodução
- Erros e exceções
- Uso de recursos
- Engajamento

---

## 🚀 Deployment

### **Opções de Deploy**

1. **On-Premise**
   - Instalação em servidor próprio
   - Controle total
   - Conformidade de dados

2. **Cloud (SaaS)**
   - Hospedagem gerenciada
   - Escalabilidade automática
   - Manutenção incluída

3. **Híbrido**
   - Backend na nuvem
   - Players on-premise
   - Flexibilidade máxima

---

## 📚 Documentação Técnica

### **Disponível**

- API Documentation (Swagger/OpenAPI)
- Guias de integração
- SDKs e exemplos
- Arquitetura detalhada
- Troubleshooting

---

## ✅ Conformidade e Padrões

- **REST**: API RESTful padrão
- **JWT**: RFC 7519
- **TOTP**: RFC 6238
- **HTTPS**: TLS 1.2+
- **CORS**: Configurável
- **GDPR**: Compatível (preparado)

---

**SmartSignage Pro** - *Arquitetura Robusta e Escalável*

*Tecnologia de ponta para comunicação digital profissional*

