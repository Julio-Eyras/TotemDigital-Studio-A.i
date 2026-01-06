# Análise Completa do Sistema Smart Signage Pro v2.0

## 📊 **VISÃO GERAL DA ARQUITETURA**

O sistema Smart Signage Pro v2.0 implementa um modelo de **multi-tenancy** com três tipos principais de entidades:

1. **Subscribers (Assinantes/Anunciantes)** - Empresas que compram espaço publicitário
2. **Publishers (Publicadores)** - Empresas que possuem totens/smart TVs e vendem espaço publicitário
3. **System Users (Usuários do Sistema)** - Administradores e operadores do sistema

---

## 🏗️ **ESTRUTURA DE RELACIONAMENTOS**

### **Hierarquia Principal:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTEM ADMINISTRATOR                          │
│  (Cria Publishers, Planos, Gerencia Acesso)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                             │
        ▼                                             ▼
┌───────────────┐                          ┌───────────────┐
│  SUBSCRIBERS  │                          │  PUBLISHERS  │
│ (Anunciantes) │                          │ (Publicadores)│
└───────┬───────┘                          └───────┬───────┘
        │                                             │
        │ 1:N                                         │ 1:N
        │                                             │
        ▼                                             ▼
┌──────────────────┐                      ┌──────────────────┐
│   CONTRATOS      │                      │   CONTRATOS      │
│ (Subscriber)     │                      │ (Publisher)      │
└───────┬──────────┘                      └───────┬──────────┘
        │                                             │
        │ N:1                                         │
        │                                             │
        ▼                                             ▼
┌──────────────────┐                      ┌──────────────────┐
│     PLANOS       │                      │ Revenue Share     │
│  (Plans)         │                      │ Subscription      │
└───────┬──────────┘                      └───────────────────┘
        │
        │ 1:N
        │
        ▼
┌──────────────────────────────┐
│  PLAN_PUBLISHER_ACCESS       │
│  (Define quais publishers    │
│   cada plano permite)        │
└──────────────┬───────────────┘
               │
               │ N:1
               │
               ▼
┌──────────────────────────────┐
│  SUBSCRIBER_PUBLISHER_ACCESS │
│  (Acesso real concedido)      │
└──────────────────────────────┘
```

---

## ✅ **O QUE ESTÁ IMPLEMENTADO**

### **1. Backend - Serviços e Rotas**

#### **✅ Subscribers (Assinantes)**
- ✅ `SubscriberService` - CRUD completo
- ✅ Rotas `/api/subscribers` - GET, POST, PUT, DELETE
- ✅ Isolamento de dados por subscriber
- ✅ Validações de ownership

#### **✅ Publishers (Publicadores)**
- ✅ `PublisherService` - CRUD completo
- ✅ Rotas `/api/publishers` - GET, POST, PUT, DELETE
- ✅ Métodos auxiliares:
  - `getLocalsByPublisher()`
  - `getTotemsByPublisher()`
  - `getSmartTvsByPublisher()`
  - `getPublisherStats()`
- ✅ Rotas relacionadas:
  - `/api/publishers/:id/locals`
  - `/api/publishers/:id/totems`
  - `/api/publishers/:id/smart-tvs`
  - `/api/publishers/:id/stats`

#### **✅ Locals (Locais Físicos)**
- ✅ `LocalService` - CRUD completo com validações de ownership
- ✅ Rotas `/api/locals` - GET, POST, PUT, DELETE
- ✅ Rota `/api/locals/:id/totems` - Listar totens do local
- ✅ Validação: Não-admin só vê locals do seu publisher

#### **✅ Totems**
- ✅ `TotemService` - CRUD completo
- ✅ Suporte a `uin` (Unique Identifier Number)
- ✅ Suporte a `local_id` (obrigatório)
- ✅ Validação de ownership via local → publisher
- ✅ Rotas `/api/totems` - GET, POST, PUT, DELETE
- ✅ Rotas especiais:
  - `/api/totems/uin/:uin`
  - `/api/totems/:id/heartbeat`
  - `/api/totems/:id/approve`

#### **✅ Smart TVs**
- ✅ `SmartTvService` - CRUD completo com validações de ownership
- ✅ Rotas `/api/smart-tvs` - GET, POST, PUT, DELETE
- ✅ Rota `/api/smart-tvs/totem/:totemId` - Listar Smart TVs de um totem
- ✅ Validação: Não-admin só vê Smart TVs do seu publisher (via totem → local → publisher)

#### **✅ Contratos e Planos**
- ✅ `PlanService` - Gerenciamento de planos
- ✅ Rotas `/api/plans` - CRUD de planos
- ✅ `SubscriberAccessService` - Gerenciamento de acesso subscriber → publisher
- ✅ Rotas `/api/subscriber-access` - CRUD de acessos
- ✅ Rotas relacionadas:
  - `/api/subscriber-access/plan-publisher` - Configurar acesso por plano
  - `/api/subscriber-access/expiring` - Acessos expirando
- ✅ `SubscriberAccessNotificationService` - Notificações de acesso expirando
- ✅ Worker `SubscriberAccessNotificationWorker` - Verifica acessos expirando

#### **✅ Billing (Faturamento)**
- ✅ `SubscriberBillingService` - Faturamento de subscribers
- ✅ `PublisherBillingService` - Faturamento de publishers
- ✅ Rotas `/api/subscriber-billing` e `/api/publisher-billing`

#### **✅ Campanhas e Mídia**
- ✅ `CampaignService` - CRUD completo
- ✅ Suporte a `campaign_medias` (mídia direta em campanhas)
- ✅ Suporte a `campaign_playlists` (playlists em campanhas)
- ✅ `MediaService` - CRUD completo com isolamento por subscriber
- ✅ `PlaylistService` - CRUD completo
- ✅ Rotas `/api/campaigns`, `/api/media`, `/api/playlists`

#### **✅ Playlist Engine**
- ✅ `PlaylistEngineService` - Motor de geração de playlists
- ✅ Rotas `/api/playlist-engine`:
  - `/api/playlist-engine/totem/:totemId` - Obter playlist do totem
  - `/api/playlist-engine/totem/:totemId/regenerate` - Regenerar playlist
  - `/api/playlist-engine/publisher/:publisherId/regenerate` - Regenerar para publisher
  - `/api/playlist-engine/campaign/:campaignId/regenerate` - Regenerar para campanha
  - `/api/playlist-engine/stats` - Estatísticas
- ✅ Worker `PlaylistEngineWorker` - Processa atualizações de playlists

#### **✅ Autenticação e Autorização**
- ✅ `AuthService` - Login de sistema e subscriber
- ✅ JWT Authentication
- ✅ RBAC (Role-Based Access Control)
- ✅ Middleware `authMiddleware`
- ✅ Middleware `subscriberIsolationMiddleware`
- ✅ Middleware `authorizeRole`

### **2. Frontend - Páginas e Componentes**

#### **✅ Páginas Principais**
- ✅ `Dashboard.tsx` - Dashboard principal
- ✅ `Subscribers.tsx` (renomeado de Clients) - CRUD de assinantes
- ✅ `Publishers.tsx` - CRUD de publishers com abas de detalhes
- ✅ `Locals.tsx` - CRUD de locais (NOVO)
- ✅ `Totems.tsx` - CRUD de totens (parcial - falta `uin` e `local_id` no frontend)
- ⚠️ `SmartTvs.tsx` - **FALTA CRIAR**
- ✅ `Campaigns.tsx` - CRUD de campanhas
- ✅ `Playlists.tsx` - CRUD de playlists
- ✅ `Media.tsx` - CRUD de mídia
- ✅ `SubscriberDashboard.tsx` - Dashboard para subscribers
- ✅ `SubscriberLogin.tsx` - Login para subscribers

#### **✅ Páginas de Acesso e Contratos**
- ✅ `PlanPublisherAccess.tsx` - Configurar acesso plano → publisher
- ✅ `SubscriberPublisherAccess.tsx` - Gerenciar acessos subscriber → publisher
- ✅ `SubscriberAccessExpiring.tsx` - Visualizar acessos expirando

#### **✅ API Client**
- ✅ `localApi` - CRUD de locals
- ✅ `smartTvApi` - CRUD de Smart TVs
- ✅ `publisherApi` - CRUD de publishers
- ✅ `subscriberApi` - CRUD de subscribers
- ✅ `campaignApi` - CRUD de campanhas
- ✅ `playlistApi` - CRUD de playlists
- ✅ `mediaApi` - CRUD de mídia

---

## ❌ **O QUE FALTA IMPLEMENTAR**

### **1. Frontend - Páginas Faltantes**

#### **❌ Smart TVs**
- ❌ Página `SmartTvs.tsx` - CRUD completo de Smart TVs
- ❌ Integração com totens (seleção de totem ao criar Smart TV)
- ❌ Visualização de informações técnicas (brand, model, platform, resolution)

#### **❌ Totems - Melhorias**
- ❌ Campo `uin` no formulário de criação/edição
- ❌ Seleção de `local_id` no formulário (dropdown com locals do publisher)
- ❌ Validação de ownership no frontend
- ❌ Atualizar interface para usar `Totem` em vez de `Player`

#### **❌ Contratos**
- ❌ Página `SubscriberContracts.tsx` - CRUD de contratos de subscribers
- ❌ Página `PublisherContracts.tsx` - CRUD de contratos de publishers
- ❌ Integração com planos ao criar contrato
- ❌ Upload de documentos contratuais
- ❌ Visualização de status e datas de validade

#### **❌ Planos - Melhorias**
- ❌ Interface mais completa para gerenciar planos
- ❌ Configuração de features e limits (JSONB)
- ❌ Visualização de publishers permitidos por plano

### **2. Backend - Serviços Faltantes**

#### **❌ Contratos**
- ❌ `SubscriberContractService` - CRUD de contratos de subscribers
- ❌ `PublisherContractService` - CRUD de contratos de publishers
- ❌ Rotas `/api/subscriber-contracts` e `/api/publisher-contracts`
- ❌ Upload de documentos contratuais
- ❌ Validação de datas e status

#### **❌ Integração Contratos → Acesso**
- ❌ Criação automática de `subscriber_publisher_access` ao ativar contrato
- ❌ Revogação automática ao expirar/terminar contrato
- ❌ Sincronização entre contratos e acessos

### **3. Funcionalidades Faltantes**

#### **❌ Dashboard de Publisher**
- ❌ Dashboard específico para publishers
- ❌ Estatísticas de revenue share
- ❌ Visualização de campanhas ativas nos seus totens
- ❌ Relatórios de performance

#### **❌ Notificações e Alertas**
- ❌ Notificações quando contrato está próximo de expirar
- ❌ Alertas de acessos expirando (já existe worker, falta UI)
- ❌ Notificações de campanhas aprovadas/rejeitadas

#### **❌ Relatórios e Analytics**
- ❌ Relatórios de revenue share por publisher
- ❌ Relatórios de campanhas por subscriber
- ❌ Analytics de performance de totens/smart TVs

---

## 🔗 **RELACIONAMENTO PUBLISHERS ↔ CONTRATOS**

### **Estrutura no Banco de Dados:**

```sql
-- Contratos de Publishers
CREATE TABLE publisher_contracts (
    contract_id SERIAL PRIMARY KEY,
    publisher_id INTEGER NOT NULL, -- FK para publishers
    
    contract_number TEXT UNIQUE NOT NULL,
    contract_type TEXT NOT NULL,
        -- 'revenue_share' (contrato de revenue share)
        -- 'subscription' (contrato de assinatura)
        -- 'partnership' (parceria)
        -- 'hybrid' (recebe % E paga subscription)
    
    title TEXT NOT NULL,
    description TEXT,
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- Termos de revenue share (se aplicável)
    revenue_share_percentage NUMERIC(5, 2), -- % fixo
    revenue_share_rules JSONB, -- Regras variáveis
    minimum_payout_amount NUMERIC(12, 2),
    
    -- Termos de subscription (se aplicável)
    subscription_amount NUMERIC(12, 2),
    subscription_interval TEXT, -- month, year
    
    currency TEXT DEFAULT 'BRL',
    payment_terms TEXT,
    
    -- Arquivo do contrato
    document_path TEXT,
    document_filename TEXT,
    document_mime_type TEXT,
    document_size_bytes BIGINT,
    
    status TEXT DEFAULT 'draft', -- draft, active, expired, terminated, cancelled
    
    signed_by_publisher_at TIMESTAMP,
    signed_by_tenant_at TIMESTAMP,
    
    metadata JSONB,
    created_by INTEGER, -- FK para users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Relacionamentos:**

```
PUBLISHERS (1:N) → PUBLISHER_CONTRACTS
  │
  ├── Revenue Share Contracts
  │   └── Define % de revenue share que publisher recebe
  │
  ├── Subscription Contracts
  │   └── Define valor que publisher paga mensalmente/anualmente
  │
  └── Hybrid Contracts
      └── Combina revenue share + subscription
```

### **Status Atual:**

- ✅ **Schema criado** - Tabela `publisher_contracts` existe no banco
- ❌ **Service não implementado** - Falta `PublisherContractService`
- ❌ **Rotas não implementadas** - Falta `/api/publisher-contracts`
- ❌ **Frontend não implementado** - Falta página de gerenciamento

---

## 🎯 **SUGESTÕES DE MELHORIAS**

### **1. Prioridade ALTA - Completar CRUDs Faltantes**

#### **1.1. Smart TVs Frontend**
- Criar página `SmartTvs.tsx` completa
- Integrar com seleção de totens
- Adicionar ao menu principal
- Adicionar rota em `App.tsx`

#### **1.2. Totems Frontend - Melhorias**
- Adicionar campo `uin` no formulário
- Adicionar seleção de `local_id` (dropdown filtrado por publisher)
- Atualizar interface para usar `Totem` em vez de `Player`
- Validar ownership no frontend

#### **1.3. Contratos de Publishers**
- Criar `PublisherContractService`
- Criar rotas `/api/publisher-contracts`
- Criar página `PublisherContracts.tsx`
- Integrar com billing de publishers

#### **1.4. Contratos de Subscribers**
- Criar `SubscriberContractService`
- Criar rotas `/api/subscriber-contracts`
- Criar página `SubscriberContracts.tsx`
- Integrar com criação automática de acessos

### **2. Prioridade MÉDIA - Integrações e Automações**

#### **2.1. Integração Contratos → Acesso**
- **Ao ativar contrato de subscriber:**
  - Criar automaticamente `subscriber_publisher_access` baseado no plano
  - Notificar subscriber sobre acessos concedidos
  
- **Ao expirar/terminar contrato:**
  - Revogar automaticamente acessos relacionados
  - Notificar subscriber sobre revogação
  
- **Ao criar/atualizar contrato de publisher:**
  - Validar termos de revenue share
  - Atualizar cálculos de billing

#### **2.2. Dashboard de Publisher**
- Estatísticas de revenue share
- Campanhas ativas nos totens
- Performance de totens/smart TVs
- Gráficos de revenue ao longo do tempo

#### **2.3. Notificações Melhoradas**
- Notificações in-app para:
  - Contratos próximos de expirar (7, 15, 30 dias)
  - Acessos expirando
  - Campanhas aprovadas/rejeitadas
  - Novos totens registrados
- Emails automáticos para eventos importantes

### **3. Prioridade BAIXA - Melhorias de UX e Performance**

#### **3.1. Navegação Contextual**
- Na página do Publisher → Ver Locals → Criar Local
- Na página do Local → Ver Totens → Criar Totem
- Na página do Totem → Ver Smart TVs → Criar Smart TV
- Breadcrumbs para navegação hierárquica

#### **3.2. Filtros e Busca Avançada**
- Filtros combinados (publisher + local + totem)
- Busca por UIN de totem
- Busca por device_id de Smart TV
- Filtros por status, datas, etc.

#### **3.3. Visualizações**
- Mapa com localização de locals (usando latitude/longitude)
- Gráficos de distribuição de totens por publisher
- Timeline de contratos e acessos

#### **3.4. Exportação e Relatórios**
- Exportar lista de totens em CSV/Excel
- Exportar contratos em PDF
- Relatórios de revenue share por publisher
- Relatórios de campanhas por subscriber

---

## 📋 **CHECKLIST DE IMPLEMENTAÇÃO SUGERIDO**

### **Fase 1: Completar CRUDs Básicos (1-2 semanas)**
- [ ] Criar página `SmartTvs.tsx`
- [ ] Atualizar `Totems.tsx` (adicionar `uin` e `local_id`)
- [ ] Criar `PublisherContractService` e rotas
- [ ] Criar `SubscriberContractService` e rotas
- [ ] Criar páginas de contratos no frontend

### **Fase 2: Integrações (1 semana)**
- [ ] Integração contrato → acesso automático
- [ ] Validações de datas e status
- [ ] Upload de documentos contratuais
- [ ] Notificações de eventos contratuais

### **Fase 3: Dashboards e Relatórios (1-2 semanas)**
- [ ] Dashboard de Publisher
- [ ] Relatórios de revenue share
- [ ] Analytics de performance
- [ ] Exportação de dados

### **Fase 4: Melhorias de UX (1 semana)**
- [ ] Navegação contextual
- [ ] Filtros avançados
- [ ] Visualizações (mapas, gráficos)
- [ ] Breadcrumbs

---

## 🔐 **VALIDAÇÕES DE SEGURANÇA IMPLEMENTADAS**

### **✅ Ownership Validation**
- ✅ Locals: Não-admin só vê locals do seu publisher
- ✅ Totens: Não-admin só vê totens dos seus locals
- ✅ Smart TVs: Não-admin só vê Smart TVs dos seus totens
- ✅ Campanhas: Subscriber só vê suas próprias campanhas
- ✅ Mídia: Subscriber só vê sua própria mídia
- ✅ Playlists: Subscriber só vê suas próprias playlists

### **✅ RBAC (Role-Based Access Control)**
- ✅ Admin: Acesso total
- ✅ Publisher User: Acesso apenas aos seus dados
- ✅ Subscriber User: Acesso apenas aos seus dados
- ✅ Middleware `authorizeRole` para rotas específicas

### **✅ Data Isolation**
- ✅ Middleware `subscriberIsolationMiddleware`
- ✅ Filtros automáticos por `subscriber_id` ou `publisher_id`
- ✅ Validações em todas as operações CRUD

---

## 📊 **ESTATÍSTICAS DO SISTEMA**

### **Backend:**
- **Serviços:** ~60 serviços implementados
- **Rotas:** ~50 rotas principais
- **Workers:** 4 workers (Export, Advanced Schedule, Subscriber Access Notification, Playlist Engine)

### **Frontend:**
- **Páginas:** ~25 páginas implementadas
- **Componentes:** Múltiplos componentes reutilizáveis
- **API Client:** Interfaces completas para todas as entidades principais

### **Banco de Dados:**
- **Tabelas principais:** ~40 tabelas
- **Relacionamentos:** Complexos e bem definidos
- **Índices:** Otimizados para performance

---

## 🎯 **PRÓXIMOS PASSOS RECOMENDADOS**

1. **Completar Smart TVs Frontend** - Alta prioridade
2. **Melhorar Totems Frontend** - Adicionar `uin` e `local_id`
3. **Implementar Contratos** - Backend e Frontend
4. **Integrar Contratos → Acesso** - Automação
5. **Criar Dashboard de Publisher** - Visualização de dados

---

## 📝 **NOTAS IMPORTANTES**

- O sistema está bem estruturado e modular
- As validações de segurança estão implementadas
- Falta principalmente completar os CRUDs no frontend
- A integração contratos → acesso precisa ser automatizada
- O sistema está pronto para produção após completar os itens faltantes

---

**Última atualização:** 2024-12-19
**Versão do Sistema:** v2.0
**Status:** Em desenvolvimento ativo

