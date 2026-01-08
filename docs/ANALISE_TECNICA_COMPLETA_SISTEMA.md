# 📊 Análise Técnica Completa - SmartSignage Pro v2.1

**Data:** 2026-01-08  
**Versão do Sistema:** 2.1.0  
**Autor:** Análise Automatizada

---

## 📑 Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Modelo Entidade-Relacionamento (E.R.)](#2-modelo-entidade-relacionamento-er)
3. [Sistema de Roles e Permissões](#3-sistema-de-roles-e-permissões)
4. [Lógica de Negócio](#4-lógica-de-negócio)
5. [Fluxo de Criação Baseado em Contratos](#5-fluxo-de-criação-baseado-em-contratos)
6. [Isolamento de Dados](#6-isolamento-de-dados)
7. [Interfaces Frontend vs Backend](#7-interfaces-frontend-vs-backend)
8. [Inconsistências Identificadas](#8-inconsistências-identificadas)
9. [Recomendações](#9-recomendações)

---

## 1. Visão Geral da Arquitetura

### 1.1 Stack Tecnológica

- **Backend:** Node.js + Express.js + TypeScript
- **Frontend:** React + TypeScript + Material-UI
- **Banco de Dados:** PostgreSQL (único driver suportado)
- **Autenticação:** JWT (JSON Web Tokens)
- **Autorização:** RBAC (Role-Based Access Control) + Flags
- **Arquitetura:** Multi-tenant com isolamento por subscriber

### 1.2 Padrão Arquitetural

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
│  - Páginas: Subscribers, Publishers, Contracts, etc.        │
│  - Componentes: MediaUploadDialog, etc.                      │
│  - Services: API client (axios)                              │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Express)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Middleware Layer                                     │   │
│  │  - authMiddleware (JWT)                             │   │
│  │  - authorizeRole (RBAC)                             │   │
│  │  - subscriberIsolationMiddleware (Data Isolation)   │   │
│  │  - contractValuesProtectionMiddleware (Sensitive)   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Routes Layer                                         │   │
│  │  - /api/subscribers, /api/publishers, etc.          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Services Layer                                        │   │
│  │  - subscriberService, publisherService, etc.         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ SQL
┌─────────────────────────────────────────────────────────────┐
│              DATABASE (PostgreSQL)                           │
│  - subscribers, publishers, contracts, plans, etc.          │
│  - Foreign keys e constraints                               │
│  - Triggers e functions                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Modelo Entidade-Relacionamento (E.R.)

### 2.1 Entidades Principais

#### 2.1.1 SUBSCRIBERS (Anunciantes/Assinantes)

```sql
subscribers (
    subscriber_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    whatsapp TEXT,
    address TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

**Propósito:** Representa anunciantes que compram espaço publicitário nos totens dos publishers.

**Relacionamentos:**
- 1:N → `subscriber_contracts` (um subscriber pode ter múltiplos contratos)
- 1:N → `medias` (mídias do subscriber)
- 1:N → `playlists` (playlists do subscriber)
- 1:N → `campaigns` (campanhas do subscriber)
- N:M → `publishers` (via `subscriber_publisher_access`)

#### 2.1.2 PUBLISHERS (Publicadores)

```sql
publishers (
    publisher_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    description TEXT,
    is_subscriber BOOLEAN DEFAULT false,
    is_publisher BOOLEAN DEFAULT true,
    client_type TEXT NOT NULL DEFAULT 'publisher',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

**Propósito:** Representa clientes que instalam totens e Smart TVs e disponibilizam espaço publicitário.

**Relacionamentos:**
- 1:N → `locals` (locais físicos do publisher)
- 1:N → `totems` (via locals)
- 1:N → `smart_tvs` (via totems)
- 1:N → `publisher_contracts` (contratos do publisher)
- N:M → `subscribers` (via `subscriber_publisher_access`)

**Observação:** Um publisher pode também ser subscriber (`is_subscriber = true`), criando um relacionamento híbrido.

#### 2.1.3 CONTRACTS (Contratos)

O sistema possui **dois tipos de contratos**:

**A. SUBSCRIBER_CONTRACTS** (Contratos de Anunciantes)

```sql
subscriber_contracts (
    contract_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER, -- NULL se created_before_subscriber = true
    plan_id INTEGER,
    created_before_subscriber BOOLEAN DEFAULT false,
    contract_number TEXT UNIQUE NOT NULL,
    contract_type TEXT NOT NULL, -- 'advertising', 'subscription', 'partnership'
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    total_amount NUMERIC(12, 2), -- VALOR CONTRATUAL (RESERVADO)
    currency TEXT DEFAULT 'BRL',
    payment_terms TEXT, -- VALOR CONTRATUAL (RESERVADO)
    document_path TEXT,
    status TEXT DEFAULT 'draft',
    signed_by_subscriber_at TIMESTAMP,
    signed_by_tenant_at TIMESTAMP,
    created_by INTEGER, -- FK para users (tenant user)
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

**B. PUBLISHER_CONTRACTS** (Contratos de Publishers)

```sql
publisher_contracts (
    contract_id SERIAL PRIMARY KEY,
    publisher_id INTEGER, -- NULL se created_before_publisher = true
    created_before_publisher BOOLEAN DEFAULT false,
    contract_number TEXT UNIQUE NOT NULL,
    contract_type TEXT NOT NULL, -- 'revenue_share', 'subscription', 'partnership', 'hybrid'
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    revenue_share_percentage NUMERIC(5, 2), -- VALOR CONTRATUAL (RESERVADO)
    revenue_share_rules JSONB,
    minimum_payout_amount NUMERIC(12, 2), -- VALOR CONTRATUAL (RESERVADO)
    subscription_amount NUMERIC(12, 2), -- VALOR CONTRATUAL (RESERVADO)
    subscription_interval TEXT,
    currency TEXT DEFAULT 'BRL',
    payment_terms TEXT, -- VALOR CONTRATUAL (RESERVADO)
    document_path TEXT,
    status TEXT DEFAULT 'draft',
    signed_by_publisher_at TIMESTAMP,
    signed_by_tenant_at TIMESTAMP,
    created_by INTEGER, -- FK para users (tenant user)
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

**Propósito:** Contratos definem os termos comerciais entre a plataforma e subscribers/publishers.

**Características Importantes:**
- ✅ **Valores contratuais protegidos** (`total_amount`, `payment_terms`, `revenue_share_percentage`, etc.)
- ✅ **Criação prévia permitida** (`created_before_subscriber` / `created_before_publisher`)
- ✅ **Rastreabilidade** (`created_by` sempre aponta para tenant user)

#### 2.1.4 PLANS (Planos)

```sql
plans (
    plan_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_monthly NUMERIC(12, 2) NOT NULL,
    price_yearly NUMERIC(12, 2),
    currency TEXT DEFAULT 'BRL',
    billing_interval TEXT DEFAULT 'month',
    features JSONB DEFAULT '{}'::jsonb,
    limits JSONB DEFAULT '{}'::jsonb, -- { medias: 100, playlists: 50, campaigns: 20, storage_gb: 10 }
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

**Propósito:** Define limites e features disponíveis para subscribers através de contratos.

**Relacionamentos:**
- 1:N → `subscriber_contracts` (contratos vinculam subscribers a planos)
- N:M → `publishers` (via `plan_publisher_access`)

#### 2.1.5 LOCALS, TOTEMS, SMART_TVS (Recursos Físicos)

**Hierarquia:**
```
PUBLISHER → LOCALS → TOTEMS → SMART_TVS
```

**Rastreabilidade:**
- Todos possuem `created_via_contract_id` (FK para `subscriber_contracts`)
- Permite rastrear qual contrato gerou a criação do recurso

#### 2.1.6 MEDIAS, PLAYLISTS, CAMPAIGNS (Conteúdo)

**Hierarquia:**
```
SUBSCRIBER → MEDIAS → PLAYLISTS → CAMPAIGNS
```

**Regras de Negócio:**
- ✅ Mídias pertencem a um subscriber
- ✅ Playlists pertencem a um subscriber e contêm mídias do mesmo subscriber
- ✅ Campanhas pertencem a um subscriber e podem conter:
  - Mídias individuais (do mesmo subscriber)
  - Playlists (do mesmo subscriber)
- ✅ Campanhas podem ser vinculadas a contratos (`campaigns.contract_id`)
- ✅ Campanhas só podem ser executadas em totens acessíveis via contratos/planos

### 2.2 Relacionamentos N:M (Many-to-Many)

#### 2.2.1 SUBSCRIBER_PUBLISHER_ACCESS

```sql
subscriber_publisher_access (
    subscriber_id INTEGER NOT NULL,
    publisher_id INTEGER NOT NULL,
    access_type TEXT NOT NULL, -- 'full', 'limited', 'campaign_only'
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    PRIMARY KEY (subscriber_id, publisher_id)
)
```

**Propósito:** Define quais publishers um subscriber pode acessar (via contratos/planos).

**Fluxo:**
1. Subscriber contrata um plano (`subscriber_contracts`)
2. Plano define publishers incluídos (`plan_publisher_access`)
3. Sistema cria registro em `subscriber_publisher_access`
4. Subscriber pode criar campanhas para totens desses publishers

#### 2.2.2 PLAN_PUBLISHER_ACCESS

```sql
plan_publisher_access (
    plan_id INTEGER NOT NULL,
    publisher_id INTEGER NOT NULL,
    access_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    PRIMARY KEY (plan_id, publisher_id)
)
```

**Propósito:** Define quais publishers estão incluídos em um plano.

#### 2.2.3 CAMPAIGN_TOTEMS

```sql
campaign_totems (
    campaign_id INTEGER NOT NULL,
    totem_id INTEGER NOT NULL,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    start_time TEXT,
    end_time TEXT,
    days_of_week TEXT,
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (campaign_id, totem_id)
)
```

**Propósito:** Define em quais totens uma campanha será exibida.

**Validação:** Subscriber deve ter acesso ao publisher do totem via contratos/planos.

---

## 3. Sistema de Roles e Permissões

### 3.1 Roles Principais

#### 3.1.1 Roles Administrativas (Tenant Users)

| Role | Descrição | Acesso |
|------|-----------|--------|
| `owner_system` | Proprietário do sistema | ✅ Acesso total (bypass completo) |
| `admin_sql` | Administrador SQL/Técnico | ✅ Recursos técnicos e administrativos |
| `admin` | Administrador | ✅ Recursos administrativos |
| `operador_faturamento` | Operador de Faturamento | ✅ Contratos, billing, valores contratuais |
| `operador_comercial` | Operador Comercial | ✅ Contratos (sem ver valores), criação de recursos |

**Características:**
- ✅ `is_tenant_user = true`
- ✅ `publisher_id = NULL` e `subscriber_id = NULL`
- ✅ Podem criar contratos, subscribers, publishers e recursos
- ✅ Podem visualizar valores contratuais (exceto `operador_comercial`)

#### 3.1.2 Roles de Cliente

| Role | Descrição | Acesso |
|------|-----------|--------|
| `publisher_user` | Usuário de Publisher | ✅ Recursos do próprio publisher |
| `subscriber_user` | Usuário de Subscriber | ✅ Recursos do próprio subscriber |
| `publisher_subscriber` | Publisher que também anuncia | ✅ Recursos de publisher E subscriber |

**Características:**
- ✅ `is_tenant_user = false`
- ✅ `publisher_id` e/ou `subscriber_id` definidos
- ✅ Isolamento de dados por subscriber/publisher

### 3.2 Sistema de Flags (Permissões Granulares)

```typescript
interface UserFlags {
  flag_smart_0: boolean; // Permissão específica 0
  flag_smart_1: boolean; // Permissão específica 1
  flag_smart_2: boolean; // Permissão específica 2
  // ... até flag_smart_9
}
```

**Propósito:** Permissões granulares além das roles, permitindo controle fino de funcionalidades.

**Implementação:**
- Flags podem ser definidas por usuário (`user_flags`)
- Flags padrão por role (`role_flags`)
- Função SQL `get_user_effective_flags()` calcula flags efetivas

### 3.3 Middleware de Autorização

#### 3.3.1 `authorizeRole(roles: string[])`

```typescript
// Exemplo: Apenas admin, admin_sql, owner_system podem criar subscribers
router.post('/api/subscribers',
  authMiddleware,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  createSubscriberValidator,
  validateRequest,
  async (req, res) => { ... }
);
```

**Lógica:**
1. ✅ `owner_system` → bypass completo
2. ✅ `admin_sql` → acesso se role estiver na lista OU se for admin_sql e lista incluir 'admin'
3. ✅ Outras roles → acesso apenas se role estiver na lista

#### 3.3.2 `subscriberIsolationMiddleware`

```typescript
// Aplicado em rotas de recursos de subscriber
router.use(subscriberIsolationMiddleware);
```

**Funcionalidade:**
- Adiciona `req.subscriberId` baseado no usuário autenticado
- Valida que subscriber existe e está ativo
- Bloqueia acesso se não houver subscriberId válido

**Aplicação:**
- ✅ Rotas de mídias (`/api/media`)
- ✅ Rotas de playlists (`/api/playlists`)
- ✅ Rotas de campanhas (`/api/campaigns`)

#### 3.3.3 `contractValuesProtectionMiddleware`

```typescript
// Protege valores contratuais sensíveis
router.get('/api/contracts',
  authMiddleware,
  protectContractValues,
  async (req, res) => { ... }
);
```

**Funcionalidade:**
- Remove/mascara campos sensíveis para roles não autorizadas:
  - `total_amount`
  - `payment_terms`
  - `revenue_share_percentage`
  - `minimum_payout_amount`
  - `subscription_amount`

**Roles Autorizadas:**
- ✅ `owner_system`
- ✅ `admin_sql`
- ✅ `admin`
- ✅ `operador_faturamento`

**Roles NÃO Autorizadas:**
- ❌ `operador_comercial` (pode criar contratos, mas não ver valores)
- ❌ `publisher_user`
- ❌ `subscriber_user`

---

## 4. Lógica de Negócio

### 4.1 Fluxo de Criação de Subscriber

```
1. ADMINISTRATIVO cria CONTRATO
   └─ POST /api/contracts
   └─ Body: { contract_number, contract_type, plan_id, ... }
   └─ subscriber_id: NULL (created_before_subscriber = true)

2. ADMINISTRATIVO cria SUBSCRIBER vinculado ao CONTRATO
   └─ POST /api/subscribers
   └─ Body: { name, contract_id, ... }
   └─ Validação:
      ✅ contract_id existe
      ✅ Contrato está em status válido (draft ou active)
      ✅ Contrato não está expirado
   └─ Atualização: subscriber_contracts.subscriber_id = novo subscriber_id

3. Sistema cria acesso a publishers (via plan_publisher_access)
   └─ Se plano tem publishers associados:
      └─ Cria registros em subscriber_publisher_access
```

### 4.2 Fluxo de Criação de Publisher

```
1. ADMINISTRATIVO cria CONTRATO DE PUBLISHER
   └─ POST /api/publisher-contracts
   └─ Body: { contract_number, contract_type, revenue_share_percentage, ... }
   └─ publisher_id: NULL (created_before_publisher = true)

2. ADMINISTRATIVO cria PUBLISHER vinculado ao CONTRATO
   └─ POST /api/publishers
   └─ Body: { name, contract_id, ... }
   └─ Validação:
      ✅ contract_id existe
      ✅ Contrato está em status válido
   └─ Atualização: publisher_contracts.publisher_id = novo publisher_id

3. ADMINISTRATIVO cria RECURSOS (Locais, Totens, Smart TVs)
   └─ POST /api/locals, /api/totems, /api/smart-tvs
   └─ Body: { ..., contract_id }
   └─ created_via_contract_id = contract_id (rastreabilidade)
```

### 4.3 Validação de Limites de Plano

**Campos em `plans.limits` (JSONB):**
```json
{
  "medias": 100,
  "playlists": 50,
  "campaigns": 20,
  "storage_gb": 10
}
```

**Validação:**
1. Subscriber tem contratos ativos?
2. Contratos têm planos associados?
3. Calcular limites máximos (maior valor entre todos os planos)
4. Contar recursos atuais do subscriber
5. Validar se não excede limite

**Implementação:**
- `subscriberService.getMaxLimits(subscriberId)` → retorna limites máximos
- `subscriberService.getCurrentResourceCount(subscriberId, resourceType)` → conta recursos
- `subscriberService.validatePlanLimits(subscriberId, resourceType)` → valida antes de criar

### 4.4 Validação de Acesso a Totens

**Fluxo:**
```
1. Subscriber quer criar campanha para totem X
2. Sistema busca publisher do totem (via locals)
3. Sistema verifica subscriber_publisher_access
   └─ Subscriber tem acesso ao publisher?
   └─ Acesso está ativo e não expirado?
4. Se sim → permite criar campanha
   Se não → bloqueia com erro 403
```

**Implementação:**
- `subscriberService.validateTotemAccess(subscriberId, totemId)` → retorna boolean

### 4.5 Validação de Execução de Campanhas

**Regras:**
1. ✅ Campanha deve estar vinculada a um contrato (`campaigns.contract_id`)
2. ✅ Contrato deve estar ativo (`status = 'active'`)
3. ✅ Contrato não deve estar expirado (`end_date >= CURRENT_DATE`)
4. ✅ Campanha deve estar ativa (`status = 'active'` ou 'approved'` e `is_active = true`)
5. ✅ Campanha deve ter conteúdo (mídias ou playlists associadas)
6. ✅ Subscriber deve ter acesso a todos os totens da campanha

**Implementação:**
- `campaignService.validateCampaignExecution(campaignId, totemIds)` → valida todas as regras

---

## 5. Fluxo de Criação Baseado em Contratos

### 5.1 Princípios

1. **Contratos são obrigatórios** antes da criação de subscribers/publishers
2. **Apenas roles administrativas** podem criar contratos e recursos
3. **Valores contratuais são protegidos** (visíveis apenas para roles específicas)
4. **Rastreabilidade completa** (todos os recursos têm `created_via_contract_id`)

### 5.2 Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────┐
│ ADMINISTRATIVO (owner_system, admin_sql, admin,              │
│              operador_faturamento, operador_comercial)       │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ 1. Criar Contrato
                        ↓
        ┌───────────────────────────────┐
        │ subscriber_contracts OU        │
        │ publisher_contracts            │
        │ - contract_number              │
        │ - contract_type                │
        │ - plan_id (se subscriber)      │
        │ - total_amount (PROTEGIDO)     │
        │ - payment_terms (PROTEGIDO)    │
        │ - subscriber_id: NULL         │
        │ - created_before_subscriber: true │
        └───────────────────────────────┘
                        │
                        │ 2. Criar Subscriber/Publisher
                        ↓
        ┌───────────────────────────────┐
        │ subscribers OU publishers      │
        │ - name                         │
        │ - contract_id (OBRIGATÓRIO)    │
        │ - ...                          │
        └───────────────────────────────┘
                        │
                        │ 3. Atualizar Contrato
                        ↓
        ┌───────────────────────────────┐
        │ subscriber_contracts.subscriber_id │
        │ OU publisher_contracts.publisher_id │
        │ = novo ID                      │
        └───────────────────────────────┘
                        │
                        │ 4. Criar Recursos
                        ↓
        ┌───────────────────────────────┐
        │ locals, totems, smart_tvs     │
        │ - created_via_contract_id     │
        │ - publisher_id (para locals)  │
        │ - local_id (para totems)      │
        │ - totem_id (para smart_tvs)   │
        └───────────────────────────────┘
```

### 5.3 Validações Implementadas

#### 5.3.1 Criação de Subscriber

**Backend (`backend/src/routes/subscribers.ts`):**
```typescript
router.post('/api/subscribers',
  authMiddleware,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  createSubscriberValidator, // Valida contract_id obrigatório
  validateRequest,
  async (req, res) => {
    // Validação adicional:
    // ✅ Contrato existe
    // ✅ Contrato está em status válido
    // ✅ Contrato não está expirado
    // ✅ Se created_before_subscriber = false, subscriber_id deve ser NULL
  }
);
```

**Frontend (`frontend/src/pages/Subscribers/Subscribers.tsx`):**
```typescript
const validateContract = (contractId?: number): { valid: boolean; error?: string } => {
  if (!contractId || contractId <= 0) {
    return { valid: false, error: 'Contrato é obrigatório' };
  }
  return { valid: true };
};

const handleCreateSubscriber = async () => {
  const contractValidation = validateContract(newSubscriber.contract_id);
  if (!contractValidation.valid) {
    setError(contractValidation.error);
    setCreateTab(0); // Ir para aba de Informações
    return;
  }
  // ... criar subscriber
};
```

#### 5.3.2 Criação de Publisher

**Backend (`backend/src/routes/publishers.ts`):**
```typescript
router.post('/api/publishers',
  authMiddleware,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  createPublisherValidator, // Valida contract_id obrigatório
  validateRequest,
  async (req, res) => {
    // Validação adicional similar à de subscribers
  }
);
```

#### 5.3.3 Criação de Recursos (Locais, Totens, Smart TVs)

**Backend (`backend/src/routes/locals.ts`, `totems.ts`, `smart-tvs.ts`):**
```typescript
router.post('/api/locals',
  authMiddleware,
  authorizeRole(['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial']),
  createLocalValidator, // Valida contract_id obrigatório
  validateRequest,
  async (req, res) => {
    // Validação adicional:
    // ✅ Contrato existe e está válido
    // ✅ created_via_contract_id = contract_id
  }
);
```

---

## 6. Isolamento de Dados

### 6.1 Isolamento por Subscriber

**Middleware:** `subscriberIsolationMiddleware`

**Aplicação:**
- ✅ Rotas de mídias (`/api/media`)
- ✅ Rotas de playlists (`/api/playlists`)
- ✅ Rotas de campanhas (`/api/campaigns`)
- ✅ Rotas de billing (`/api/subscriber-billing`)

**Funcionalidade:**
1. Identifica `subscriberId` do usuário autenticado
2. Adiciona `req.subscriberId` ao request
3. Serviços filtram automaticamente por `subscriberId`

**Exemplo:**
```typescript
// Em playlistService.ts
async getAllPlaylists(params, requestSubscriberId, isAdmin) {
  let query = 'SELECT * FROM playlists WHERE 1=1';
  
  if (!isAdmin && requestSubscriberId) {
    query += ' AND subscriber_id = $1';
    params = [requestSubscriberId];
  }
  
  // ... executar query
}
```

### 6.2 Isolamento por Publisher

**Implementação:** Similar ao isolamento por subscriber, mas baseado em `publisherId`.

**Aplicação:**
- ✅ Rotas de locals (`/api/locals`)
- ✅ Rotas de totens (`/api/totems`)
- ✅ Rotas de smart TVs (`/api/smart-tvs`)

---

## 7. Interfaces Frontend vs Backend

### 7.1 Mapeamento de Interfaces

#### 7.1.1 Subscriber

**Backend (`backend/src/services/subscriberService.ts`):**
```typescript
interface CreateSubscriberRequest {
  name: string;
  contract_id: number; // OBRIGATÓRIO
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  description?: string;
}
```

**Frontend (`frontend/src/services/api/index.ts`):**
```typescript
export interface CreateSubscriberRequest {
  name: string;
  contract_id?: number; // OPCIONAL na interface (mas obrigatório na validação)
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  description?: string;
}
```

**⚠️ INCONSISTÊNCIA:** Backend exige `contract_id` como obrigatório, mas frontend permite `undefined` no estado inicial. **CORRIGIDO:** Validação no frontend garante que seja fornecido antes de enviar.

#### 7.1.2 Contract

**Backend (`backend/src/services/contractService.ts`):**
```typescript
interface Contract {
  contract_id: number;
  subscriber_id?: number;
  publisher_id?: number;
  plan_id?: number;
  contract_number: string;
  contract_type: 'advertising' | 'subscription' | 'partnership' | 'revenue_share' | 'hybrid';
  title: string;
  // ... outros campos
}
```

**Frontend (`frontend/src/services/api/index.ts`):**
```typescript
export interface Contract {
  contract_id: number;
  subscriber_id?: number;
  publisher_id?: number;
  plan_id?: number;
  contract_number: string;
  contract_type: 'advertising' | 'subscription' | 'partnership' | 'revenue_share' | 'hybrid';
  title: string;
  // ... outros campos
}
```

**✅ CONSISTENTE:** Interfaces alinhadas.

#### 7.1.3 Media

**Backend (`backend/src/services/mediaService.ts`):**
```typescript
interface MediaResponse {
  media_id: number;
  subscriber_id: number;
  name: string;
  media_type: string; // 'video', 'image', 'audio', etc.
  file_path: string;
  // ... outros campos
}
```

**Frontend (`frontend/src/services/api/index.ts`):**
```typescript
export interface MediaItem {
  media_id: number;
  subscriberId: number;
  name: string;
  media_type: string; // CORRETO
  file_path: string;
  // ... outros campos
}
```

**⚠️ INCONSISTÊNCIA ENCONTRADA:** Alguns lugares no frontend usam `mediaType` (camelCase) em vez de `media_type` (snake_case). **CORRIGIDO:** Uso de `option.media_type` ou fallback para `(option as any).mediaType`.

---

## 8. Inconsistências Identificadas

### 8.1 Inconsistências Corrigidas

#### 8.1.1 Tipo `contract_type` em `UpdateContractRequest`

**Problema:**
- `UpdateContractRequest` não incluía `'hybrid'` e `'revenue_share'` no tipo `contract_type`
- Causava erro de compilação TypeScript ao atualizar contratos

**Correção:**
```typescript
// ANTES
contract_type?: 'advertising' | 'subscription' | 'partnership';

// DEPOIS
contract_type?: 'advertising' | 'subscription' | 'partnership' | 'revenue_share' | 'hybrid';
```

#### 8.1.2 Parâmetro `publisherId` em `contractApi.getAll`

**Problema:**
- `contractApi.getAll` não aceita `publisherId` como parâmetro
- Código tentava usar `publisherId` em `loadAvailableContracts` e `loadPublisherContracts`

**Correção:**
- Removido `publisherId` das chamadas
- Para contratos de publisher, usar `publisherContractApi.getAll({ publisherId })`

#### 8.1.3 Propriedade `mediaType` vs `media_type`

**Problema:**
- Frontend usava `option.mediaType` (camelCase) mas backend retorna `media_type` (snake_case)

**Correção:**
```typescript
// ANTES
{option.mediaType === 'image' && <ImageIcon />}

// DEPOIS
{((option as any).mediaType || option.media_type) === 'image' && <ImageIcon />}
```

#### 8.1.4 Métodos ausentes em `SubscriberService`

**Problema:**
- `getCurrentResourceCount` e `getCurrentStorage` não existiam como métodos públicos
- Rotas tentavam chamar esses métodos

**Correção:**
- Adicionados métodos públicos:
  - `getCurrentResourceCount(subscriberId, resourceType)`
  - `getCurrentStorage(subscriberId)`

#### 8.1.5 Tipo de retorno `null` vs `undefined` em `getMaxLimits`

**Problema:**
- `getMaxLimits` retornava `null` mas tipo esperava `number | undefined`

**Correção:**
- Alterado retorno de `null` para `undefined` para consistência com TypeScript

### 8.2 Inconsistências Potenciais (Requerem Verificação)

#### 8.2.1 Uso de `clientId` (Deprecated)

**Problema:**
- Muitos lugares ainda usam `clientId` (deprecated) em vez de `subscriberId`
- Pode causar confusão e bugs

**Recomendação:**
- Criar script de migração para remover todas as referências a `clientId`
- Atualizar interfaces e serviços para usar apenas `subscriberId`

#### 8.2.2 Validação de `contract_id` em Recursos

**Problema:**
- Recursos (locals, totens, smart_tvs) têm `created_via_contract_id` mas validação pode não estar completa

**Recomendação:**
- Verificar se todas as rotas de criação validam:
  - Contrato existe
  - Contrato está ativo
  - Contrato não está expirado

#### 8.2.3 Proteção de Valores Contratuais

**Problema:**
- `contractValuesProtectionMiddleware` pode não estar aplicado em todas as rotas necessárias

**Recomendação:**
- Auditar todas as rotas que retornam contratos
- Garantir que middleware está aplicado

---

## 9. Recomendações

### 9.1 Melhorias de Consistência

1. **Padronizar Nomenclatura:**
   - ✅ Usar `snake_case` no backend (banco de dados)
   - ✅ Usar `camelCase` no frontend (TypeScript/React)
   - ✅ Criar funções de mapeamento para conversão

2. **Remover Deprecated Fields:**
   - ❌ Remover `clientId` de todas as interfaces e serviços
   - ❌ Atualizar documentação

3. **Validação Consistente:**
   - ✅ Criar validador centralizado para contratos
   - ✅ Aplicar validação em todas as rotas de criação

### 9.2 Melhorias de Segurança

1. **Auditoria Completa:**
   - ✅ Logar todas as criações de contratos, subscribers, publishers
   - ✅ Logar todas as visualizações de valores contratuais

2. **Proteção de Dados:**
   - ✅ Garantir que `contractValuesProtectionMiddleware` está em todas as rotas
   - ✅ Testar com diferentes roles

### 9.3 Melhorias de Performance

1. **Otimização de Queries:**
   - ✅ Adicionar índices em campos frequentemente consultados
   - ✅ Usar `EXPLAIN ANALYZE` para identificar queries lentas

2. **Cache:**
   - ✅ Cachear limites de planos (Redis)
   - ✅ Cachear contratos ativos

### 9.4 Melhorias de Documentação

1. **Documentação Técnica:**
   - ✅ Documentar todas as rotas da API
   - ✅ Documentar regras de negócio
   - ✅ Documentar fluxos de criação

2. **Documentação de Código:**
   - ✅ Adicionar JSDoc em todas as funções
   - ✅ Documentar interfaces TypeScript

---

## 📝 Conclusão

O sistema SmartSignage Pro v2.1 está bem estruturado com:

✅ **Modelo E.R. sólido** com relacionamentos claros  
✅ **Sistema de roles e permissões robusto**  
✅ **Fluxo de criação baseado em contratos** implementado  
✅ **Isolamento de dados** por subscriber/publisher  
✅ **Proteção de valores contratuais** sensíveis  

**Inconsistências corrigidas:**
- ✅ Tipos TypeScript corrigidos
- ✅ Parâmetros de API corrigidos
- ✅ Propriedades de interfaces alinhadas
- ✅ Métodos ausentes adicionados

**Próximos passos recomendados:**
1. Remover completamente `clientId` (deprecated)
2. Auditar proteção de valores contratuais
3. Adicionar testes automatizados
4. Melhorar documentação técnica

---

**Documento gerado automaticamente em:** 2026-01-08  
**Versão do sistema analisado:** 2.1.0
