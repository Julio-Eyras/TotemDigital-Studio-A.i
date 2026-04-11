# Reanálise Completa: Modelo de Negócio e Renomeações

## 🎯 Modelo de Negócio Revisado

### Hierarquia de Entidades (Corrigida e Renomeada)

```
┌─────────────────────────────────────────────────────────────┐
│              SMARTDISPLAY ECOSYSTEM                         │
│                                                             │
│  TENANT = SmartSignage Pro (a plataforma, você)            │
│  - Admin e Operador cadastrados em users                    │
│  - Recebe receita de Subscribers e Publishers               │
│                                                             │
│  ┌────────────────────┐        ┌─────────────────────┐     │
│  │   PUBLISHER        │        │   SUBSCRIBER        │     │
│  │ (antes: host)      │        │ (antes: client)     │     │
│  │                    │        │                     │     │
│  │ • Instala totens   │        │ • Cria campanhas    │     │
│  │ • Instala SmartTVs │        │ • Faz upload mídias │     │
│  │ • Gerencia midias, │        │ • Gerencia mídias,  │     │
│  │   playlists,       │        │   playlists,        │     │
│  │   campanhas        │        │   campanhas         │     │
│  │                    │        │ • Paga por          │     │
│  │ • Recebe % OU paga │        │   anúncios/lotes    │     │
│  │   subscription     │        │ • Autorização final │     │
│  │                    │        │   pelos tenants     │     │
│  │ → users            │        │                     │     │
│  │ → totems           │        │ → campaigns         │     │
│  │ → locals           │        │ → medias            │     │
│  │ → smart_tvs        │        │ → playlists         │     │
│  └────────────────────┘        └─────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Entidades Principais (Nomenclatura Corrigida)

#### 1️⃣ **TENANT = SmartSignage Pro** (Você/A Plataforma)
- **Papel:** A plataforma em si, operador do sistema
- **Admin e Operador:** Cadastrados na tabela `users` (com RBAC específico)
- **Recebe receita de:**
  - **Subscribers** (antes clients): pagam por anúncios, lotes de exibições, quantidades de totens, smart TVs, tempo, fatores determinados por regra
  - **Publishers** (antes hosts): podem pagar subscription OU receber revenue share
- **Observações:**
  - ✅ TENANT não é uma entidade no banco (é o operador do sistema)
  - ✅ TODOS os billings passam pelo TENANT (plataforma)

#### 2️⃣ **PUBLISHER** (antes: HOST)
- **Renomeação:** `hosts` → `publishers` (tabela e todas as referências)
- **Papel:** Local onde **totens e Smart TVs estão instalados**
- **Flag de Tipo:** Tabela `publishers` tem flag que define:
  - `is_subscriber` BOOLEAN (pode ser assinante também)
  - `is_publisher` BOOLEAN (pode ser publisher)
  - `client_type` TEXT ('subscriber', 'publisher', 'both')
- **Modelos de Billing:**
  - **Modelo A:** Recebe percentual (revenue share) por exibir anúncios
  - **Modelo B:** Paga subscription para usar o sistema
  - **Modelo Híbrido:** Recebe % E paga subscription
- **Gerencia:** Mídias, playlists, campanhas próprias
- **Usuários:** `users` pertencem ao Publisher (via `publisher_id`)
- **Hardware:** Controla totens, Smart TVs, locals

#### 3️⃣ **SUBSCRIBER** (antes: CLIENT)
- **Renomeação:** `clients` → `subscribers` (tabela e todas as referências)
- **Papel:** Anunciante que **compra espaço publicitário**
- **Formas de Pagamento:**
  - Por anúncios
  - Por lotes de exibições
  - Por quantidades de totens/Smart TVs
  - Por tempo
  - Por fatores determinados por regra
- **Acesso:**
  - ✅ Acesso às suas mídias, playlists, campanhas
  - ✅ Pode criar e gerenciar conteúdo
  - ❌ **Autorização final** cabe aos **tenants do sistema** (admin/operador com RBAC)
- **Observações:**
  - Subscribers **NÃO são users do sistema** (não têm acesso como operadores)
  - Subscribers apenas **gerenciam** seu conteúdo, mas precisam de **aprovação** para publicar

---

## 📋 Mapeamento de Renomeações

### Tabelas a Renomear

| Nome Antigo | Nome Novo | Justificativa |
|-------------|-----------|---------------|
| `clients` | `subscribers` | Reflete corretamente: são assinantes que compram espaço publicitário |
| `hosts` | `publishers` | Reflete corretamente: são publishers que publicam/exibem conteúdo |
| `client_id` | `subscriber_id` | Em todas as tabelas que referenciam `subscribers` |
| `host_id` | `publisher_id` | Em todas as tabelas que referenciam `publishers` |
| `advertiser_billing` | `subscriber_billing` | Billing de subscribers (anunciantes) |
| `host_billing` | `publisher_billing` | Billing de publishers |

### Campos que DEVEM mudar

#### 1. **Tabela `subscribers` (antes `clients`)**
```sql
-- Renomear tabela
ALTER TABLE clients RENAME TO subscribers;

-- Renomear PK se necessário (PostgreSQL mantém, mas podemos documentar)
-- client_id → subscriber_id (FKs serão atualizadas)
```

#### 2. **Tabela `publishers` (antes `hosts`)**
```sql
-- Renomear tabela
ALTER TABLE hosts RENAME TO publishers;

-- Adicionar flags de tipo
ALTER TABLE publishers ADD COLUMN is_subscriber BOOLEAN DEFAULT false;
ALTER TABLE publishers ADD COLUMN is_publisher BOOLEAN DEFAULT true;
ALTER TABLE publishers ADD COLUMN client_type TEXT DEFAULT 'publisher';
  -- Valores: 'subscriber', 'publisher', 'both'

-- Criar constraint
ALTER TABLE publishers ADD CONSTRAINT chk_client_type 
  CHECK (client_type IN ('subscriber', 'publisher', 'both'));
```

#### 3. **Tabela `users`**
```sql
-- ANTES: client_id (confuso)
-- DEPOIS: publisher_id (users pertencem ao publisher)

ALTER TABLE users RENAME COLUMN client_id TO publisher_id;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_client_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_publisher_id_fkey 
  FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE SET NULL;
```

#### 4. **Tabela `subscriptions`**
```sql
-- ANTES: client_id
-- DEPOIS: publisher_id (subscription é do publisher, se Modelo B)

ALTER TABLE subscriptions RENAME COLUMN client_id TO publisher_id;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_client_id_fkey;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_publisher_id_fkey 
  FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE CASCADE;
```

#### 5. **Tabela `totems`**
```sql
-- REMOVER client_id completamente
ALTER TABLE totems DROP COLUMN IF EXISTS client_id;
-- Totem sempre pertence a publisher via local_id → locals → publishers
```

#### 6. **Tabela `locals`**
```sql
-- ANTES: host_id
-- DEPOIS: publisher_id

ALTER TABLE locals RENAME COLUMN host_id TO publisher_id;
ALTER TABLE locals DROP CONSTRAINT IF EXISTS locals_host_id_fkey;
ALTER TABLE locals ADD CONSTRAINT locals_publisher_id_fkey 
  FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE CASCADE;
```

#### 7. **Tabelas de Conteúdo (campaigns, medias, playlists)**
```sql
-- Estas referenciam SUBSCRIBER (anunciante que cria conteúdo)
-- campaigns.client_id → campaigns.subscriber_id
-- medias.client_id → medias.subscriber_id
-- playlists.client_id → playlists.subscriber_id (se existir)

ALTER TABLE campaigns RENAME COLUMN client_id TO subscriber_id;
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_client_id_fkey;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_subscriber_id_fkey 
  FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE CASCADE;

ALTER TABLE medias RENAME COLUMN client_id TO subscriber_id;
ALTER TABLE medias DROP CONSTRAINT IF EXISTS medias_client_id_fkey;
ALTER TABLE medias ADD CONSTRAINT medias_subscriber_id_fkey 
  FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE CASCADE;

-- playlists.client_id (se existir e for de subscriber)
ALTER TABLE playlists RENAME COLUMN client_id TO subscriber_id;
ALTER TABLE playlists DROP CONSTRAINT IF EXISTS playlists_client_id_fkey;
ALTER TABLE playlists ADD CONSTRAINT playlists_subscriber_id_fkey 
  FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE SET NULL;
```

#### 8. **Tabela `execution_logs`**
```sql
-- DECISÃO NECESSÁRIA: client_id aqui representa o quê?
-- Se for SUBSCRIBER da campanha → subscriber_id
-- Se for PUBLISHER do totem → remover (derivar via totem_id → local_id → publisher_id)

-- Opção recomendada: Manter subscriber_id (anunciante da campanha)
ALTER TABLE execution_logs RENAME COLUMN client_id TO subscriber_id;
-- Adicionar também publisher_id derivado (via VIEW ou coluna calculada)
```

---

## 💰 Estrutura de Billing (Tabelas Separadas)

### **Tabela `subscriber_billing`** (antes `advertiser_billing`)

```sql
CREATE TABLE IF NOT EXISTS subscriber_billing (
    billing_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL,
    campaign_id INTEGER,
    billing_type TEXT NOT NULL,
      -- 'advertisement', 'campaign', 'media_upload', 'exhibition_lot', 
      -- 'totem_quantity', 'smarttv_quantity', 'time_based', 'rule_based'
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    direction TEXT DEFAULT 'incoming', -- Sempre 'incoming' (plataforma recebe)
    description TEXT,
    due_date TIMESTAMP,
    status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'cancelled', 'refunded'
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
      -- Armazena regras específicas: lotes, quantidades, fatores, etc.
    stripe_invoice_id TEXT,
    stripe_payment_intent_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL
);

CREATE INDEX idx_subscriber_billing_subscriber_id ON subscriber_billing(subscriber_id);
CREATE INDEX idx_subscriber_billing_status ON subscriber_billing(status);
CREATE INDEX idx_subscriber_billing_due_date ON subscriber_billing(due_date);
CREATE INDEX idx_subscriber_billing_campaign_id ON subscriber_billing(campaign_id);
```

### **Tabela `publisher_billing`** (antes `host_billing`)

```sql
CREATE TABLE IF NOT EXISTS publisher_billing (
    billing_id SERIAL PRIMARY KEY,
    publisher_id INTEGER NOT NULL,
    campaign_id INTEGER, -- Se revenue share de campanha específica
    totem_id INTEGER,    -- Se revenue share de totem específico
    subscription_id INTEGER, -- Se subscription mensal
    
    billing_type TEXT NOT NULL,
      -- 'revenue_share', 'payout', 'subscription', 'platform_fee'
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    direction TEXT NOT NULL,
      -- 'outgoing' (publisher recebe da plataforma)
      -- 'incoming' (publisher paga para plataforma)
    
    -- Campos específicos de revenue share
    revenue_share_percentage NUMERIC(5, 2), -- % que publisher recebe
    original_campaign_amount NUMERIC(12, 2), -- Valor original da campanha
    platform_fee_amount NUMERIC(12, 2), -- Valor que plataforma retém
    
    description TEXT,
    due_date TIMESTAMP,
    status TEXT DEFAULT 'pending',
      -- 'pending', 'approved', 'paid', 'cancelled', 'rejected'
    approved_by INTEGER, -- FK → users (tenant com RBAC para aprovar payouts)
    approved_at TIMESTAMP,
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_publisher_billing_publisher_id ON publisher_billing(publisher_id);
CREATE INDEX idx_publisher_billing_status ON publisher_billing(status);
CREATE INDEX idx_publisher_billing_direction ON publisher_billing(direction);
CREATE INDEX idx_publisher_billing_billing_type ON publisher_billing(billing_type);
CREATE INDEX idx_publisher_billing_approved_by ON publisher_billing(approved_by);
```

---

## 🔐 RBAC e Aprovação de Payouts

### Permissão para Aprovar Payouts

```sql
-- Adicionar permissão específica para aprovar payouts de publishers
INSERT INTO permissions (permission_id, resource, action, description) VALUES
  (NEW_ID, 'publisher_billing', 'approve_payout', 'Aprovar pagamentos para publishers');

-- Assimilar a role 'admin' ou criar role 'billing_manager'
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ((SELECT role_id FROM roles WHERE name = 'admin'), 
   (SELECT permission_id FROM permissions WHERE resource = 'publisher_billing' AND action = 'approve_payout'));
```

---

## 📄 Gestão de Contratos e Documentos

### **Tabela `publisher_contracts`**

```sql
CREATE TABLE IF NOT EXISTS publisher_contracts (
    contract_id SERIAL PRIMARY KEY,
    publisher_id INTEGER NOT NULL,
    contract_type TEXT NOT NULL,
      -- 'revenue_share', 'subscription', 'hybrid'
    revenue_share_percentage NUMERIC(5, 2), -- Se revenue share
    subscription_amount NUMERIC(12, 2), -- Se subscription
    subscription_period TEXT, -- 'monthly', 'yearly'
    
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'active', -- 'draft', 'active', 'expired', 'cancelled'
    
    -- Documentos (PDF, DOC, DOCX)
    contract_document_path TEXT, -- Caminho para arquivo
    contract_document_filename TEXT,
    contract_document_mime_type TEXT, -- 'application/pdf', 'application/msword', etc.
    contract_document_size INTEGER, -- Tamanho em bytes
    
    signed_by_publisher BOOLEAN DEFAULT false,
    signed_by_platform BOOLEAN DEFAULT false,
    signed_at TIMESTAMP,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_by INTEGER, -- FK → users (tenant que criou contrato)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_publisher_contracts_publisher_id ON publisher_contracts(publisher_id);
CREATE INDEX idx_publisher_contracts_status ON publisher_contracts(status);
CREATE INDEX idx_publisher_contracts_type ON publisher_contracts(contract_type);
```

### **Tabela `subscriber_contracts`** (Opcional, para contratos de assinantes)

```sql
CREATE TABLE IF NOT EXISTS subscriber_contracts (
    contract_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL,
    contract_type TEXT NOT NULL,
      -- 'advertisement', 'exhibition_lot', 'time_based', 'rule_based'
    
    -- Regras e limites do contrato
    rules JSONB NOT NULL DEFAULT '{}'::jsonb,
      -- Exemplo: {"max_exhibitions": 1000, "duration_days": 30, "totem_limit": 5}
    
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'active',
    
    -- Documentos
    contract_document_path TEXT,
    contract_document_filename TEXT,
    contract_document_mime_type TEXT,
    contract_document_size INTEGER,
    
    signed_by_subscriber BOOLEAN DEFAULT false,
    signed_by_platform BOOLEAN DEFAULT false,
    signed_at TIMESTAMP,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

---

## 🔍 Impacto em Outras Tabelas

### Tabelas que Referenciam `clients` (→ `subscribers`)

| Tabela | Campo Atual | Campo Novo | Ação |
|--------|-------------|------------|------|
| `campaigns` | `client_id` | `subscriber_id` | Renomear FK |
| `medias` | `client_id` | `subscriber_id` | Renomear FK |
| `playlists` | `client_id` | `subscriber_id` | Renomear FK (se existir) |
| `execution_logs` | `client_id` | `subscriber_id` | Renomear (representa anunciante) |
| `qr_codes` | `client_id` | `subscriber_id` | Renomear FK |
| `short_links` | `client_id` | `subscriber_id` | Renomear FK |
| `smart_playlists` | `client_id` | `subscriber_id` | Renomear FK |
| Qualquer outra tabela com `client_id` | `client_id` | `subscriber_id` | Renomear FK |

### Tabelas que Referenciam `hosts` (→ `publishers`)

| Tabela | Campo Atual | Campo Novo | Ação |
|--------|-------------|------------|------|
| `locals` | `host_id` | `publisher_id` | Renomear FK |
| `users` | `client_id` | `publisher_id` | Renomear FK (users pertencem ao publisher) |
| `subscriptions` | `client_id` | `publisher_id` | Renomear FK (subscription é do publisher) |
| Qualquer outra tabela com `host_id` | `host_id` | `publisher_id` | Renomear FK |

### Tabelas que DEVEM Remover `client_id`

| Tabela | Campo | Ação | Justificativa |
|--------|-------|------|---------------|
| `totems` | `client_id` | **REMOVER** | Totem pertence a publisher via local_id |
| `playlists` | `client_id` | Avaliar se redundante | Pode ser derivado via campaign_id → subscriber_id |

---

## ❓ Questões para Esclarecer

### 1. **Subscriptions - Publisher ou Subscriber?**

**Pergunta:** Subscriptions são de Publishers (se pagam para usar sistema) OU de Subscribers (se assinam plano de anúncios)?

**Análise Atual:**
- Você mencionou: "subscriptions podem ser do HOST (se modelo B - host paga)"
- Mas também: "assinantes pagam por anúncios, lotes, etc."

**Proposta:**
- `subscriptions` → `publisher_subscriptions` (Publisher paga para usar plataforma)
- Subscribers **não têm subscriptions**, apenas pagam por uso (via `subscriber_billing`)

**Confirmação necessária:** Subscribers têm subscriptions ou apenas billing por uso?

### 2. **Users - Qual o Relacionamento Completo?**

**Situação:**
- Users são usuários do sistema SmartSignage
- Users pertencem ao Publisher (via `publisher_id`)
- Admin e Operador são users

**Questões:**
- Users podem ser "tenant users" (admin/operador do sistema) sem `publisher_id`?
- Ou todos users têm `publisher_id`, e tenant users têm um Publisher especial "SmartSignage Pro"?
- Como distinguir tenant users de publisher users?

**Proposta:**
```sql
users (
    id,
    publisher_id INTEGER, -- NULL se for tenant user
    username,
    email,
    ...
    is_tenant_user BOOLEAN DEFAULT false, -- True se for admin/operador do sistema
    ...
);
```

### 3. **Publisher pode ser Subscriber?**

**Você mencionou:** Publisher tem flag `is_subscriber`, `is_publisher`, ou `both`.

**Questões:**
- Um Publisher que também é Subscriber tem registro duplicado?
- Ou um único registro em `publishers` com `client_type = 'both'`?
- Se `both`, como funciona billing? Têm `subscriber_billing` E `publisher_billing`?

**Proposta:**
- Um único registro em `publishers` com `client_type = 'both'`
- Se `is_subscriber = true`, também pode ter registros em `subscriber_billing`
- Se `is_publisher = true`, também pode ter registros em `publisher_billing`

### 4. **Playlists - Subscriber ou Publisher?**

**Questão:** Playlists são sempre de Subscribers (anunciantes) ou também podem ser de Publishers?

**Análise:**
- Você mencionou: "Publisher gerencia mídias, playlists, campanhas próprias"
- E também: "Subscriber gerencia mídias, playlists, campanhas"

**Proposta:**
```sql
playlists (
    playlist_id,
    subscriber_id INTEGER, -- Se playlist de anunciante
    publisher_id INTEGER,  -- Se playlist do publisher (conteúdo próprio)
    totem_id INTEGER,
    campaign_id INTEGER,
    ...
    CONSTRAINT chk_playlist_owner CHECK (
        (subscriber_id IS NOT NULL AND publisher_id IS NULL) OR
        (subscriber_id IS NULL AND publisher_id IS NOT NULL)
    )
);
```

### 5. **Execution Logs - Qual Cliente?**

**Questão:** `execution_logs.client_id` representa Subscriber (anunciante) ou Publisher (dono do totem)?

**Proposta:**
```sql
execution_logs (
    log_id,
    totem_id,
    campaign_id,
    media_id,
    subscriber_id INTEGER, -- Anunciante da campanha (derivado via campaign_id)
    -- publisher_id derivado via totem_id → local_id → publisher_id (VIEW)
    ...
);
```

---

## 🔧 Plano de Refatoração Completo

### **Fase 1: Criar Novas Estruturas (Sem Remover Antigas)**

1. Criar tabela `subscribers` (cópia de `clients`)
2. Criar tabela `publishers` (cópia de `hosts` + flags)
3. Criar `subscriber_billing`
4. Criar `publisher_billing`
5. Criar `publisher_contracts`
6. Criar `subscriber_contracts` (se necessário)

### **Fase 2: Migrar Dados**

1. Migrar dados de `clients` → `subscribers`
2. Migrar dados de `hosts` → `publishers`
3. Popular flags `is_subscriber`, `is_publisher`, `client_type`

### **Fase 3: Atualizar FKs Gradualmente**

1. Criar novas colunas (`subscriber_id`, `publisher_id`)
2. Popular novas colunas a partir de dados antigos
3. Validar integridade
4. Atualizar código para usar novos campos

### **Fase 4: Remover Estruturas Antigas**

1. Remover `client_id` de `totems`
2. Remover FKs antigas
3. Remover colunas antigas após validação completa
4. Remover tabelas antigas (se migração completa)

### **Fase 5: Atualizar Código**

1. Backend: atualizar todos os serviços, rotas, queries
2. Frontend: atualizar todas as APIs, componentes, queries
3. Scripts: atualizar scripts de instalação, migração, etc.

---

## 📊 Impacto no Modelo E.R.

### Novo Diagrama de Relacionamentos

```
┌─────────────────┐
│  subscribers    │ (Anunciantes)
└────────┬────────┘
         │
         ├──→ campaigns (1:N)
         ├──→ medias (1:N)
         ├──→ playlists (1:N) [se de anunciante]
         ├──→ subscriber_billing (1:N)
         └──→ subscriber_contracts (1:N)

┌─────────────────┐
│  publishers     │ (Publicadores)
└────────┬────────┘
         │
         ├──→ users (1:N)
         ├──→ locals (1:N)
         ├──→ subscriptions (1:N) [se paga subscription]
         ├──→ publisher_billing (1:N)
         ├──→ publisher_contracts (1:N)
         └──→ playlists (1:N) [se conteúdo próprio]

publishers → locals → totems → smart_tvs

campaigns (subscriber) ──→ campaign_totems ──→ totems (publisher)
```

---

## ✅ Checklist de Renomeações

### Tabelas
- [ ] `clients` → `subscribers`
- [ ] `hosts` → `publishers`
- [ ] Criar `subscriber_billing`
- [ ] Criar `publisher_billing`
- [ ] Criar `publisher_contracts`
- [ ] Criar `subscriber_contracts` (se necessário)

### Colunas FKs
- [ ] Todas as `client_id` → `subscriber_id`
- [ ] Todas as `host_id` → `publisher_id`
- [ ] `users.client_id` → `users.publisher_id`
- [ ] `subscriptions.client_id` → `subscriptions.publisher_id`
- [ ] `locals.host_id` → `locals.publisher_id`
- [ ] `campaigns.client_id` → `campaigns.subscriber_id`
- [ ] `medias.client_id` → `medias.subscriber_id`
- [ ] `playlists.client_id` → `playlists.subscriber_id` (ou remover se redundante)
- [ ] `execution_logs.client_id` → `execution_logs.subscriber_id`

### Colunas para Remover
- [ ] `totems.client_id` (REMOVER completamente)

### Novas Estruturas
- [ ] `publishers.is_subscriber` BOOLEAN
- [ ] `publishers.is_publisher` BOOLEAN
- [ ] `publishers.client_type` TEXT
- [ ] `publisher_billing.approved_by` INTEGER
- [ ] `publisher_billing.revenue_share_percentage`
- [ ] `publisher_billing.original_campaign_amount`
- [ ] `publisher_billing.platform_fee_amount`

---

## 🎯 Próximos Passos

1. **Responder questões abertas** (subscriptions, users tenant, etc.)
2. **Validar modelo proposto** com stakeholders
3. **Criar scripts de migração** detalhados
4. **Testar migração** em ambiente de desenvolvimento
5. **Documentar todas as mudanças** para equipe
6. **Implementar gradualmente** (fases acima)

---

**Aguardando respostas às questões para finalizar modelo e criar scripts de migração!**

