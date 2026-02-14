# Arquitetura do Sistema - SmartSignage Pro

## Visão Geral

SmartSignage Pro é uma arquitetura distribuída baseada em microserviços, com separação clara entre frontend, backend e players.

## Componentes Principais

### 1. Frontend (React)
- **Tecnologia**: React 18+, TypeScript
- **Build**: Vite
- **Estado**: Context API + Hooks
- **Roteamento**: React Router
- **UI**: Componentes customizados

**Responsabilidades:**
- Interface de usuário administrativa
- Gerenciamento de campanhas, playlists, mídias
- Visualização de relatórios e analytics
- Configuração do sistema

### 2. Backend (Node.js/Express)
- **Tecnologia**: Node.js 18+, TypeScript, Express
- **ORM**: Query builder customizado (PostgreSQL)
- **Autenticação**: JWT
- **Cache**: Redis (opcional) + in-memory

**Responsabilidades:**
- API REST para frontend
- API para players
- Processamento de mídias
- Dispatcher (motor de decisão)
- Gerenciamento de eventos e analytics

### 3. Banco de Dados (PostgreSQL)
- **Versão**: PostgreSQL 12+
- **Schema**: Refatorado v2.1 (PostgreSQL direto, sem ORM)
- **Views**: Materializadas para analytics
- **Triggers**: Para auditoria e validação

**Tabelas Principais:**
- `campaigns`, `playlists`, `medias`
- `totems`, `locals`, `publishers`
- `event_logs`, `dispatcher_log`
- `users`, `roles`, `permissions`

### 4. Player (HTML5/JavaScript)
- **Tecnologia**: Vanilla JavaScript, HTML5
- **Cache**: IndexedDB
- **Reprodução**: HTML5 Video/Image

**Responsabilidades:**
- Reprodução de conteúdo
- Cache local de mídias
- Sincronização com backend
- Envio de eventos e heartbeat

### 5. Nginx (Reverse Proxy)
- **Função**: Proxy reverso e servidor web estático
- **SSL**: Suporte a HTTPS/Let's Encrypt
- **Cache**: Cache de arquivos estáticos

## Arquitetura de Camadas

```
┌─────────────────────────────────────────┐
│         Frontend (React)                │
│    Interface Administrativa             │
└──────────────┬──────────────────────────┘
               │ HTTP/REST
┌──────────────▼──────────────────────────┐
│         Nginx (Reverse Proxy)           │
│    /api/* → Backend                     │
│    /static/* → Frontend Build           │
│    /player/* → Player Web               │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼─────┐  ┌──────▼──────┐
│  Backend   │  │  Frontend   │
│  (Express)  │  │   (Build)   │
└──────┬─────┘  └─────────────┘
       │
┌──────▼──────────────────────┐
│   PostgreSQL Database       │
│   - Dados                   │
│   - Cache (opcional)        │
└─────────────────────────────┘
```

## Fluxo de Dados

### 1. Criação de Campanha

```
Frontend → Backend API → PostgreSQL
         ↓
    Validação
         ↓
    Salva Campanha
```

### 2. Exibição de Conteúdo

```
Player → GET /api/player/dispatch
       ↓
   Backend → Dispatcher Service
           ↓
      Busca Campanhas (PostgreSQL)
           ↓
      Validação Temporal/Técnica
           ↓
      Gera Plano de Exibição
           ↓
      Cache (60s)
           ↓
      Retorna Plano
       ↓
   Player Reproduz Conteúdo
```

### 3. Eventos e Analytics

```
Player → POST /api/player/event
       ↓
   Backend → Event Log Service
           ↓
      Salva em event_logs (PostgreSQL)
           ↓
      Atualiza Views Materializadas
           ↓
      Analytics Disponível
```

## Serviços do Backend

### DispatcherTotemService
- **Responsabilidade**: Gerar planos de exibição
- **Processo**: Busca candidatos → Valida → Resolve conflitos → Gera plano
- **Cache**: 60 segundos TTL

### EventLogService
- **Responsabilidade**: Registrar eventos do sistema
- **Eventos**: Playback, exibição, erros, comandos
- **Armazenamento**: `event_logs` table

### MediaService
- **Responsabilidade**: Gerenciar upload e processamento de mídias
- **Processos**: Upload → Validação → Thumbnail → Aprovação

### CampaignService
- **Responsabilidade**: Gerenciar campanhas
- **Validações**: Período, agendamento, vinculações

### TotemService
- **Responsabilidade**: Gerenciar totens e heartbeat
- **Monitoramento**: Status, comandos remotos

## Segurança

### Autenticação
- **JWT**: Tokens de acesso (1 hora) + refresh (7 dias)
- **2FA**: Suporte a autenticação de dois fatores
- **RBAC**: Role-Based Access Control

### Autorização
- **Middleware**: Verifica permissões antes de executar ações
- **Roles**: admin, publisher, subscriber, viewer
- **Permissions**: Granulares por recurso/ação

### Validação
- **Input**: Validação de dados de entrada (express-validator)
- **SQL Injection**: Prepared statements
- **XSS**: Sanitização de inputs
- **CSRF**: Tokens CSRF em formulários

## Performance

### Cache
- **Dispatcher**: Cache de planos (60s)
- **Player**: Cache local (IndexedDB)
- **Frontend**: Cache de assets estáticos (Nginx)

### Otimizações
- **Views Materializadas**: Agregação de analytics
- **Índices**: Índices otimizados no banco
- **Lazy Loading**: Carregamento sob demanda no frontend
- **CDN**: Suporte a CDN para mídias (configurável)

## Escalabilidade

### Horizontal
- **Backend**: Múltiplas instâncias atrás de load balancer
- **Database**: Read replicas para leitura
- **Storage**: S3/Cloud Storage para mídias

### Vertical
- **Database**: Otimização de queries e índices
- **Backend**: Processamento assíncrono de tarefas pesadas
- **Cache**: Redis para cache distribuído

## Monitoramento

### Logs
- **Backend**: Logs estruturados (JSON)
- **Player**: Console logs + eventos
- **Nginx**: Access logs e error logs

### Métricas
- **Performance**: Tempo de resposta, throughput
- **Erros**: Taxa de erro, tipos de erro
- **Uso**: Requisições por endpoint, usuários ativos

### Alertas
- **Totens Offline**: Alertas quando totem fica offline
- **Erros Críticos**: Alertas para erros do sistema
- **Performance**: Alertas para degradação

## Deployment

### Single-Server
- Tudo em um servidor (backend + frontend + database)
- Ideal para instalações pequenas/médias

### Docker
- Containers separados para cada serviço
- Facilita escalabilidade e manutenção

### Cloud
- Suporte a deploy em AWS, Azure, GCP
- Auto-scaling configurável

## Próximos Passos

- [Requisitos](./02-requisitos.md) - Requisitos detalhados
- [Configuração](./03-configuracao.md) - Configurações avançadas
- [Workflows](./04-workflows.md) - Fluxos de trabalho
