# Plano de Ação Meticuloso: Renomeações e Refatoração Completa do Modelo E.R.

## 📋 Documento Baseado em
- **QUESTOES_ESCLARECER_MODELO_NEGOCIO.md** (respostas confirmadas)
- **CONSOLIDACAO_FINAL_ANALISE_MODELO.md** (decisões finais)
- **REANALISE_COMPLETA_MODELO_NEGOCIO_RENOMENACOES.md** (nomenclatura)
- **ANALISE_COMPLETA_MODELO_ER.md** (análise técnica)

---

## 🎯 Objetivo Final

**Recriar todo o banco de dados do zero** com:
1. ✅ Renomeações: `clients` → `subscribers`, `hosts` → `publishers`
2. ✅ Novas estruturas de billing (`subscriber_billing`, `publisher_billing`)
3. ✅ Novas estruturas de contratos (`publisher_contracts`, `subscriber_contracts`)
4. ✅ Novos campos em `users` (`is_tenant_user`, `user_type`)
5. ✅ Novos campos em `publishers` (`is_subscriber`, `is_publisher`, `client_type`)
6. ✅ Estruturas polimórficas (`playlists`, `execution_logs`)
7. ✅ Remoção de `totems.client_id`
8. ✅ Todos os FKs atualizados corretamente
9. ✅ Índices recriados
10. ✅ Views atualizadas

---

## ⚠️ PRECAUÇÕES CRÍTICAS

1. **BACKUP COMPLETO** antes de qualquer alteração
2. **Ambiente de teste primeiro** - nunca em produção direto
3. **Ordem de dependências** - criar tabelas na ordem correta
4. **Verificação de integridade** após cada fase
5. **Documentação** de todas as mudanças
6. **Código backend/frontend** será atualizado **DEPOIS** do banco

---

## 📊 Resumo das Decisões Confirmadas

| Decisão | Resposta |
|---------|----------|
| Subscriptions | Modelo híbrido - Publishers E Subscribers podem ter |
| Users | 3 tipos: `is_tenant_user` (flag) + `publisher_id` (opcional) |
| Publisher pode ser Subscriber | Sim, flag `client_type = 'both'` com billing separado |
| Playlists | Polimórfica - `subscriber_id` OU `publisher_id` (CHECK constraint) |
| Execution Logs | Polimórfica - ambos `subscriber_id` E `publisher_id` |
| Revenue Share | Variável por publisher (via contrato) |
| Modelo Híbrido | Billing separado (contas independentes) |
| Documentos | Sistema de arquivos (path configurável) |
| Preservar Dados | **NÃO** - recriar database do zero nao necessita herdar nada|

---

## 🏗️ FASE 0: PREPARAÇÃO E ANÁLISE

### Passo 0.1: Backup Completo
```sql
-- Criar backup completo do banco atual
pg_dump -U postgres -d smartchannel -F c -f backup_pre_refactor_$(date +%Y%m%d_%H%M%S).dump
```
sem backup ao inves de renomear ou listar fk que serao afetadas como ja falei desconsidere legado trabalhe no script database-db.sql e crie este script novamente tudo em ordem 


### Passo 0.2: Inventário de Tabelas Afetadas
Documentar todas as tabelas que serão alteradas:

**Tabelas a RENOMEAR:**
- `clients` → `subscribers`
- `hosts` → `publishers`

**Tabelas com `client_id` a RENOMEAR:**
- `users` → `publisher_id` (mudança de conceito!)
- `subscriptions` → `publisher_id` (mudança de conceito!)
- `campaigns` → `subscriber_id`
- `medias` → `subscriber_id`
- `playlists` → `subscriber_id` + `publisher_id` (polimórfico)
- `execution_logs` → `subscriber_id` + `publisher_id` (polimórfico)
- `qr_codes` → `subscriber_id`
- `short_links` → `subscriber_id`
- `smart_playlists` → `subscriber_id`
- `stripe_customers` → `subscriber_id`
- `fx_sites` → `subscriber_id`
- `billing` → será dividida em `subscriber_billing` e `publisher_billing`

**Tabelas com `host_id` a RENOMEAR:**
- `locals` → `publisher_id`

**Tabelas a MODIFICAR (remover `client_id`):**
- `totems` → **REMOVER** `client_id` completamente

**Tabelas NOVAS a CRIAR:**
- `subscriber_billing`
- `publisher_billing`
- `publisher_contracts`
- `subscriber_contracts`

### Passo 0.3: Inventário de FKs
Listar todas as Foreign Keys que serão afetadas:
```sql
-- Query para listar todas as FKs
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (ccu.table_name = 'clients' OR ccu.table_name = 'hosts' 
       OR ccu.table_name = 'users' OR kcu.column_name LIKE '%client_id%' 
       OR kcu.column_name LIKE '%host_id%');
```

### Passo 0.4: Inventário de Índices
Listar todos os índices que referenciam `client_id` ou `host_id`:
```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexdef LIKE '%client_id%' OR indexdef LIKE '%host_id%';
```

### Passo 0.5: Inventário de Views
Listar todas as views que podem ser afetadas:
```sql
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE definition LIKE '%client%' OR definition LIKE '%host%';
```

---

## 🔨 FASE 1: CRIAR NOVO SCHEMA SQL COMPLETO

### Passo 1.1: Estrutura Base do Arquivo SQL
Criar arquivo: `database/smartchannel-db-v2-refactored.sql` e isso mesmso que eu queria 

**Estrutura do arquivo:**
```sql
-- =============================================
-- SmartSignage Pro - Schema Refatorado v2.0
-- =============================================
-- Data: $(date)
-- Baseado em: Plano de Ação Meticuloso
-- =============================================

-- SCHEMA SETUP
CREATE SCHEMA IF NOT EXISTS public;
SET search_path TO public;

-- =============================================
-- ORDEM DE CRIAÇÃO (RESPEITANDO DEPENDÊNCIAS)
-- =============================================
-- 1. Tabelas base (sem FKs externas)
-- 2. Tabelas com FKs para tabelas base
-- 3. Tabelas polimórficas
-- 4. Tabelas de relacionamento N:M
-- 5. Tabelas de billing
-- 6. Tabelas de contratos
-- 7. Foreign Keys
-- 8. Índices
-- 9. Views
-- 10. Triggers e Functions
-- =============================================
```

### Passo 1.2: Criar Tabelas Base (Sem FKs Externas)

#### 1.2.1: Tabela `subscribers` (antes `clients`)
```sql
CREATE TABLE IF NOT EXISTS subscribers (
    subscriber_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    whatsapp TEXT, -- Corrigido de 'wths'
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE subscribers IS 'Anunciantes/Assinantes que compram espaço publicitário';
COMMENT ON COLUMN subscribers.subscriber_id IS 'ID único do assinante (anunciante)';
```

#### 1.2.2: Tabela `publishers` (antes `hosts`)
```sql
CREATE TABLE IF NOT EXISTS publishers (
    publisher_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    description TEXT,
    
    -- Flags de tipo
    is_subscriber BOOLEAN DEFAULT false,
    is_publisher BOOLEAN DEFAULT true,
    client_type TEXT NOT NULL DEFAULT 'publisher', -- 'subscriber', 'publisher', 'both'
    
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_publisher_client_type 
        CHECK (client_type IN ('subscriber', 'publisher', 'both'))
);

COMMENT ON TABLE publishers IS 'Publicadores - clientes que instalam totens e Smart TVs';
COMMENT ON COLUMN publishers.publisher_id IS 'ID único do publisher';
COMMENT ON COLUMN publishers.is_subscriber IS 'Se true, publisher também é assinante';
COMMENT ON COLUMN publishers.is_publisher IS 'Se true, publisher publica conteúdo';
COMMENT ON COLUMN publishers.client_type IS 'Tipo: subscriber, publisher ou both';
```

#### 1.2.3: Tabela `users` (MODIFICADA)
```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    
    -- NOVO: Relacionamento com publisher
    publisher_id INTEGER, -- NULL se for tenant user
    
    -- NOVO: Tipo de usuário
    user_type TEXT NOT NULL DEFAULT 'publisher_user', 
        -- 'system_user' (tenant/admin), 'subscriber_user', 'publisher_user'
    is_tenant_user BOOLEAN DEFAULT false, -- True se for admin/operador do sistema
    
    role TEXT, -- Role direta (mantido para compatibilidade)
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_users_user_type 
        CHECK (user_type IN ('system_user', 'subscriber_user', 'publisher_user')),
    CONSTRAINT chk_users_tenant_logic 
        CHECK (
            (is_tenant_user = true AND publisher_id IS NULL) OR
            (is_tenant_user = false AND publisher_id IS NOT NULL)
        )
);

COMMENT ON TABLE users IS 'Usuários do sistema SmartSignage';
COMMENT ON COLUMN users.publisher_id IS 'FK para publisher (NULL se for tenant user)';
COMMENT ON COLUMN users.user_type IS 'Tipo: system_user, subscriber_user, publisher_user';
COMMENT ON COLUMN users.is_tenant_user IS 'True se for admin/operador do sistema (tenant)';
```

**NOTA:** FK para `publishers` será criada depois.

#### 1.2.4: Outras Tabelas Base (sem mudanças diretas)
- `roles`
- `permissions`
- `plans`
- `system_settings`
- `ai_models`
- `ml_models`
- (todas as outras que não têm `client_id` ou `host_id`)

### Passo 1.3: Criar Tabelas com FKs para Tabelas Base

#### 1.3.1: Tabela `locals`
```sql
CREATE TABLE IF NOT EXISTS locals (
    local_id SERIAL PRIMARY KEY,
    publisher_id INTEGER NOT NULL, -- ANTES: host_id
    name TEXT NOT NULL,
    address TEXT,
    description TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- FK será adicionada depois
);

COMMENT ON TABLE locals IS 'Locais físicos onde totens estão instalados';
COMMENT ON COLUMN locals.publisher_id IS 'FK para publisher (dono do local)';
```

#### 1.3.2: Tabela `totems` (SEM `client_id`)
```sql
CREATE TABLE IF NOT EXISTS totems (
    totem_id SERIAL PRIMARY KEY,
    identifier TEXT UNIQUE NOT NULL,
    uin TEXT UNIQUE,
    device_id TEXT,
    local_id INTEGER NOT NULL, -- FK para locals
    -- client_id REMOVIDO - totem não pertence a anunciante!
    
    name TEXT,
    status TEXT DEFAULT 'offline',
    last_heartbeat TIMESTAMP,
    firmware_version TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- FKs serão adicionadas depois
);

COMMENT ON TABLE totems IS 'Totens (edge nodes) que controlam Smart TVs';
COMMENT ON COLUMN totems.local_id IS 'FK para local (totem pertence a publisher via local)';
```

#### 1.3.3: Tabela `campaigns`
```sql
CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL, -- ANTES: client_id
    title TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT DEFAULT 'standard',
    status TEXT DEFAULT 'draft',
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    budget NUMERIC(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- FK será adicionada depois
);

COMMENT ON TABLE campaigns IS 'Campanhas publicitárias criadas por assinantes';
COMMENT ON COLUMN campaigns.subscriber_id IS 'FK para subscriber (anunciante que cria campanha)';
```

#### 1.3.4: Tabela `medias`
```sql
CREATE TABLE IF NOT EXISTS medias (
    media_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL, -- ANTES: client_id
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    media_type TEXT NOT NULL,
    duration_seconds INTEGER,
    thumbnail_path TEXT,
    status TEXT DEFAULT 'draft', -- Será substituído por approval_workflows
    is_active BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- FK será adicionada depois
);

COMMENT ON TABLE medias IS 'Mídias criadas por assinantes';
COMMENT ON COLUMN medias.subscriber_id IS 'FK para subscriber (anunciante que cria mídia)';
```

#### 1.3.5: Tabela `playlists` (POLIMÓRFICA)
```sql
CREATE TABLE IF NOT EXISTS playlists (
    playlist_id SERIAL PRIMARY KEY,
    
    -- POLIMÓRFICO: pode ser de subscriber OU publisher
    subscriber_id INTEGER, -- Se playlist de anunciante
    publisher_id INTEGER,  -- Se playlist do publisher (conteúdo próprio)
    
    totem_id INTEGER, -- Opcional: playlist específica de totem
    campaign_id INTEGER, -- Opcional: playlist de campanha
    
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_playlist_owner CHECK (
        (subscriber_id IS NOT NULL AND publisher_id IS NULL) OR
        (subscriber_id IS NULL AND publisher_id IS NOT NULL)
    )
    -- FKs serão adicionadas depois
);

COMMENT ON TABLE playlists IS 'Playlists podem ser de assinantes (anunciantes) ou publishers (conteúdo próprio)';
COMMENT ON COLUMN playlists.subscriber_id IS 'FK para subscriber (se playlist de anunciante)';
COMMENT ON COLUMN playlists.publisher_id IS 'FK para publisher (se playlist de conteúdo próprio)';
```

#### 1.3.6: Tabela `execution_logs` (POLIMÓRFICA)
```sql
CREATE TABLE IF NOT EXISTS execution_logs (
    log_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    campaign_id INTEGER,
    media_id INTEGER,
    playlist_id INTEGER,
    
    -- POLIMÓRFICO: ambos subscriber e publisher
    subscriber_id INTEGER, -- Anunciante da campanha
    publisher_id INTEGER,  -- Dono do totem (derivado via totem_id → local_id → publisher_id)
    
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- FKs serão adicionadas depois
);

COMMENT ON TABLE execution_logs IS 'Logs de execução de campanhas e mídias';
COMMENT ON COLUMN execution_logs.subscriber_id IS 'Anunciante da campanha';
COMMENT ON COLUMN execution_logs.publisher_id IS 'Dono do totem onde foi executado';
```

#### 1.3.7: Tabela `subscriptions` (MODIFICADA)
```sql
CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    publisher_id INTEGER, -- ANTES: client_id (MODELO HÍBRIDO: pode ser publisher ou subscriber)
    subscriber_id INTEGER, -- NOVO: para assinantes também
    
    plan_id INTEGER NOT NULL,
    stripe_subscription_id TEXT UNIQUE,
    status TEXT DEFAULT 'active', -- active, cancelled, expired, past_due
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_subscription_owner CHECK (
        (publisher_id IS NOT NULL AND subscriber_id IS NULL) OR
        (publisher_id IS NULL AND subscriber_id IS NOT NULL)
    )
    -- FKs serão adicionadas depois
);

COMMENT ON TABLE subscriptions IS 'Assinaturas - podem ser de publishers OU subscribers (modelo híbrido)';
COMMENT ON COLUMN subscriptions.publisher_id IS 'FK para publisher (se subscription de publisher)';
COMMENT ON COLUMN subscriptions.subscriber_id IS 'FK para subscriber (se subscription de assinante)';
```

### Passo 1.4: Criar Tabelas de Billing

#### 1.4.1: Tabela `subscriber_billing`
```sql
CREATE TABLE IF NOT EXISTS subscriber_billing (
    billing_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL,
    campaign_id INTEGER,
    
    billing_type TEXT NOT NULL,
        -- 'advertisement', 'exhibition_lot', 'totem_quantity', 
        -- 'smarttv_quantity', 'time_based', 'rule_based'
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    direction TEXT DEFAULT 'incoming', -- Sempre 'incoming' (plataforma recebe)
    
    description TEXT,
    due_date TIMESTAMP,
    status TEXT DEFAULT 'pending', 
        -- 'pending', 'paid', 'cancelled', 'refunded'
    
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
        -- Armazena detalhes específicos:
        -- exhibition_lot: {"lot_size": 1000, "exhibitions_used": 750}
        -- totem_quantity: {"totem_count": 10, "days": 30}
        -- time_based: {"start_date": "...", "end_date": "...", "hourly_rate": 50}
        -- rule_based: {"rule_id": 123, "rule_params": {...}}
    
    stripe_invoice_id TEXT,
    stripe_payment_intent_id TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
    -- FKs serão adicionadas depois
);

COMMENT ON TABLE subscriber_billing IS 'Billing de assinantes (anunciantes que pagam)';
COMMENT ON COLUMN subscriber_billing.subscriber_id IS 'FK para subscriber';
COMMENT ON COLUMN subscriber_billing.direction IS 'Sempre incoming (plataforma recebe)';
```

#### 1.4.2: Tabela `publisher_billing`
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
    
    -- Aprovação de payouts
    approved_by INTEGER, -- FK → users (tenant com RBAC para aprovar payouts)
    approved_at TIMESTAMP,
    
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
    -- FKs serão adicionadas depois
);

COMMENT ON TABLE publisher_billing IS 'Billing de publishers (recebem revenue share OU pagam subscription)';
COMMENT ON COLUMN publisher_billing.publisher_id IS 'FK para publisher';
COMMENT ON COLUMN publisher_billing.direction IS 'outgoing (recebe) ou incoming (paga)';
COMMENT ON COLUMN publisher_billing.revenue_share_percentage IS 'Percentual de revenue share (variável por contrato)';
COMMENT ON COLUMN publisher_billing.approved_by IS 'FK para user que aprovou o payout';
```

### Passo 1.5: Criar Tabelas de Contratos

#### 1.5.1: Tabela `publisher_contracts`
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
    status TEXT DEFAULT 'active', 
        -- 'draft', 'active', 'expired', 'cancelled'
    
    -- Documentos (PDF, DOC, DOCX) - sistema de arquivos
    contract_document_path TEXT, -- Caminho no filesystem (configurável)
    contract_document_filename TEXT,
    contract_document_mime_type TEXT, 
        -- 'application/pdf', 'application/msword', etc.
    contract_document_size INTEGER, -- Tamanho em bytes
    
    signed_by_publisher BOOLEAN DEFAULT false,
    signed_by_platform BOOLEAN DEFAULT false,
    signed_at TIMESTAMP,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_by INTEGER, -- FK → users (tenant que criou contrato)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- FKs serão adicionadas depois
);

COMMENT ON TABLE publisher_contracts IS 'Contratos de publishers (revenue share, subscription, híbrido)';
COMMENT ON COLUMN publisher_contracts.contract_document_path IS 'Caminho no sistema de arquivos do servidor (path configurável)';
```

#### 1.5.2: Tabela `subscriber_contracts`
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- FKs serão adicionadas depois
);

COMMENT ON TABLE subscriber_contracts IS 'Contratos de assinantes (regras de pagamento)';
```

### Passo 1.6: Outras Tabelas Afetadas

Atualizar TODAS as tabelas restantes que têm `client_id`:
- `qr_codes` → `subscriber_id`
- `short_links` → `subscriber_id`
- `smart_playlists` → `subscriber_id`
- `stripe_customers` → `subscriber_id`
- `fx_sites` → `subscriber_id`

### Passo 1.7: Criar Foreign Keys (em Ordem)

**IMPORTANTE:** Criar FKs na ordem correta para evitar erros de dependência.

```sql
-- =============================================
-- FOREIGN KEYS
-- =============================================

-- 1. Users → Publishers
ALTER TABLE users 
ADD CONSTRAINT fk_users_publisher 
FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE SET NULL;

-- 2. Locals → Publishers
ALTER TABLE locals 
ADD CONSTRAINT fk_locals_publisher 
FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE CASCADE;

-- 3. Totems → Locals (totem pertence a publisher via local)
ALTER TABLE totems 
ADD CONSTRAINT fk_totems_local 
FOREIGN KEY (local_id) REFERENCES locals(local_id) ON DELETE CASCADE;

-- 4. Campaigns → Subscribers
ALTER TABLE campaigns 
ADD CONSTRAINT fk_campaigns_subscriber 
FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE CASCADE;

-- 5. Medias → Subscribers
ALTER TABLE medias 
ADD CONSTRAINT fk_medias_subscriber 
FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE CASCADE;

-- 6. Playlists → Subscribers (polimórfico)
ALTER TABLE playlists 
ADD CONSTRAINT fk_playlists_subscriber 
FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE CASCADE;

-- 7. Playlists → Publishers (polimórfico)
ALTER TABLE playlists 
ADD CONSTRAINT fk_playlists_publisher 
FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE CASCADE;

-- 8. Execution Logs → Subscribers
ALTER TABLE execution_logs 
ADD CONSTRAINT fk_execution_logs_subscriber 
FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE SET NULL;

-- 9. Execution Logs → Publishers
ALTER TABLE execution_logs 
ADD CONSTRAINT fk_execution_logs_publisher 
FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE SET NULL;

-- 10. Subscriptions → Publishers (polimórfico)
ALTER TABLE subscriptions 
ADD CONSTRAINT fk_subscriptions_publisher 
FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE CASCADE;

-- 11. Subscriptions → Subscribers (polimórfico)
ALTER TABLE subscriptions 
ADD CONSTRAINT fk_subscriptions_subscriber 
FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE CASCADE;

-- 12. Subscriber Billing → Subscribers
ALTER TABLE subscriber_billing 
ADD CONSTRAINT fk_subscriber_billing_subscriber 
FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE CASCADE;

-- 13. Subscriber Billing → Campaigns
ALTER TABLE subscriber_billing 
ADD CONSTRAINT fk_subscriber_billing_campaign 
FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL;

-- 14. Publisher Billing → Publishers
ALTER TABLE publisher_billing 
ADD CONSTRAINT fk_publisher_billing_publisher 
FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE CASCADE;

-- 15. Publisher Billing → Campaigns
ALTER TABLE publisher_billing 
ADD CONSTRAINT fk_publisher_billing_campaign 
FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL;

-- 16. Publisher Billing → Totems
ALTER TABLE publisher_billing 
ADD CONSTRAINT fk_publisher_billing_totem 
FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL;

-- 17. Publisher Billing → Subscriptions
ALTER TABLE publisher_billing 
ADD CONSTRAINT fk_publisher_billing_subscription 
FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id) ON DELETE SET NULL;

-- 18. Publisher Billing → Users (approved_by)
ALTER TABLE publisher_billing 
ADD CONSTRAINT fk_publisher_billing_approved_by 
FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- 19. Publisher Contracts → Publishers
ALTER TABLE publisher_contracts 
ADD CONSTRAINT fk_publisher_contracts_publisher 
FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE CASCADE;

-- 20. Publisher Contracts → Users (created_by)
ALTER TABLE publisher_contracts 
ADD CONSTRAINT fk_publisher_contracts_created_by 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- 21. Subscriber Contracts → Subscribers
ALTER TABLE subscriber_contracts 
ADD CONSTRAINT fk_subscriber_contracts_subscriber 
FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE CASCADE;

-- 22. Subscriber Contracts → Users (created_by)
ALTER TABLE subscriber_contracts 
ADD CONSTRAINT fk_subscriber_contracts_created_by 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- ... continuar com todas as outras FKs das tabelas restantes
```

### Passo 1.8: Criar Índices Estratégicos

```sql
-- =============================================
-- ÍNDICES ESTRATÉGICOS
-- =============================================

-- Subscribers
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(is_active) WHERE is_active = true;

-- Publishers
CREATE INDEX IF NOT EXISTS idx_publishers_email ON publishers(email);
CREATE INDEX IF NOT EXISTS idx_publishers_active ON publishers(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_publishers_client_type ON publishers(client_type);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_publisher_id ON users(publisher_id);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(is_tenant_user) WHERE is_tenant_user = true;

-- Locals
CREATE INDEX IF NOT EXISTS idx_locals_publisher_id ON locals(publisher_id);

-- Totems
CREATE INDEX IF NOT EXISTS idx_totems_local_id ON totems(local_id);
-- REMOVIDO: idx_totems_client_id (client_id foi removido!)

-- Campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_subscriber_id ON campaigns(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_subscriber_active_dates 
    ON campaigns(subscriber_id, is_active, start_date, end_date) 
    WHERE is_active = true;

-- Medias
CREATE INDEX IF NOT EXISTS idx_medias_subscriber_id ON medias(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_medias_subscriber_status_type 
    ON medias(subscriber_id, status, media_type);

-- Playlists (polimórfico)
CREATE INDEX IF NOT EXISTS idx_playlists_subscriber_id ON playlists(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_playlists_publisher_id ON playlists(publisher_id);

-- Execution Logs (polimórfico)
CREATE INDEX IF NOT EXISTS idx_execution_logs_subscriber_id ON execution_logs(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_publisher_id ON execution_logs(publisher_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_totem_timestamp 
    ON execution_logs(totem_id, timestamp);

-- Subscriptions (polimórfico)
CREATE INDEX IF NOT EXISTS idx_subscriptions_publisher_id ON subscriptions(publisher_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber_id ON subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Subscriber Billing
CREATE INDEX IF NOT EXISTS idx_subscriber_billing_subscriber_id 
    ON subscriber_billing(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_billing_status 
    ON subscriber_billing(status);
CREATE INDEX IF NOT EXISTS idx_subscriber_billing_due_date 
    ON subscriber_billing(due_date);

-- Publisher Billing
CREATE INDEX IF NOT EXISTS idx_publisher_billing_publisher_id 
    ON publisher_billing(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_billing_status 
    ON publisher_billing(status);
CREATE INDEX IF NOT EXISTS idx_publisher_billing_direction 
    ON publisher_billing(direction);
CREATE INDEX IF NOT EXISTS idx_publisher_billing_billing_type 
    ON publisher_billing(billing_type);
CREATE INDEX IF NOT EXISTS idx_publisher_billing_approved_by 
    ON publisher_billing(approved_by);

-- Publisher Contracts
CREATE INDEX IF NOT EXISTS idx_publisher_contracts_publisher_id 
    ON publisher_contracts(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_contracts_status 
    ON publisher_contracts(status);

-- Subscriber Contracts
CREATE INDEX IF NOT EXISTS idx_subscriber_contracts_subscriber_id 
    ON subscriber_contracts(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_contracts_status 
    ON subscriber_contracts(status);

-- ... continuar com índices das outras tabelas
```

### Passo 1.9: Criar Views Úteis

```sql
-- =============================================
-- VIEWS ÚTEIS
-- =============================================

-- View: Totems com Publisher (derivado via local)
CREATE OR REPLACE VIEW v_totems_with_publisher AS
SELECT 
    t.*,
    l.publisher_id,
    p.name AS publisher_name,
    p.client_type AS publisher_type
FROM totems t
JOIN locals l ON t.local_id = l.local_id
JOIN publishers p ON l.publisher_id = p.publisher_id;

COMMENT ON VIEW v_totems_with_publisher IS 'View para obter publisher de um totem (via local)';

-- View: Execution Logs completos (subscriber + publisher)
CREATE OR REPLACE VIEW v_execution_logs_complete AS
SELECT 
    el.*,
    s.name AS subscriber_name,
    p.name AS publisher_name,
    c.title AS campaign_title,
    m.name AS media_name
FROM execution_logs el
LEFT JOIN subscribers s ON el.subscriber_id = s.subscriber_id
LEFT JOIN publishers p ON el.publisher_id = p.publisher_id
LEFT JOIN campaigns c ON el.campaign_id = c.campaign_id
LEFT JOIN medias m ON el.media_id = m.media_id;

COMMENT ON VIEW v_execution_logs_complete IS 'View completa de execution logs com nomes de subscriber e publisher';

-- View: Publishers que também são Subscribers
CREATE OR REPLACE VIEW v_publishers_also_subscribers AS
SELECT 
    p.*,
    COUNT(DISTINCT c.campaign_id) AS campaign_count,
    COUNT(DISTINCT m.media_id) AS media_count
FROM publishers p
LEFT JOIN campaigns c ON c.subscriber_id = (
    SELECT subscriber_id FROM subscribers WHERE email = p.email LIMIT 1
)
LEFT JOIN medias m ON m.subscriber_id = (
    SELECT subscriber_id FROM subscribers WHERE email = p.email LIMIT 1
)
WHERE p.client_type = 'both' OR p.is_subscriber = true
GROUP BY p.publisher_id;

COMMENT ON VIEW v_publishers_also_subscribers IS 'Publishers que também são subscribers (modelo híbrido)';

-- View: Revenue Share Summary
CREATE OR REPLACE VIEW v_publisher_revenue_summary AS
SELECT 
    pb.publisher_id,
    p.name AS publisher_name,
    COUNT(*) AS total_billings,
    SUM(CASE WHEN pb.direction = 'outgoing' THEN pb.amount ELSE 0 END) AS total_revenue_share,
    SUM(CASE WHEN pb.direction = 'incoming' THEN pb.amount ELSE 0 END) AS total_payments,
    SUM(CASE WHEN pb.direction = 'outgoing' THEN pb.amount ELSE -pb.amount END) AS net_balance
FROM publisher_billing pb
JOIN publishers p ON pb.publisher_id = p.publisher_id
WHERE pb.status = 'paid'
GROUP BY pb.publisher_id, p.name;

COMMENT ON VIEW v_publisher_revenue_summary IS 'Resumo de revenue share e pagamentos por publisher';
```

### Passo 1.10: Verificação de Integridade

Criar script de verificação:
```sql
-- =============================================
-- VERIFICAÇÃO DE INTEGRIDADE
-- =============================================

-- Verificar se todas as tabelas foram criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verificar se todas as FKs foram criadas
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (ccu.table_name = 'subscribers' OR ccu.table_name = 'publishers')
ORDER BY tc.table_name, kcu.column_name;

-- Verificar constraints CHECK
SELECT 
    table_name,
    constraint_name,
    check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
ORDER BY table_name;

-- Verificar se não há mais client_id ou host_id
SELECT 
    table_name,
    column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name LIKE '%client_id%' OR column_name LIKE '%host_id%')
  AND column_name NOT IN ('subscriber_id', 'publisher_id');
-- Deve retornar vazio!
```

---

## 🔄 FASE 2: APLICAR NOVO SCHEMA

### Passo 2.1: Ambiente de Teste

1. Criar banco de teste:
```sql
CREATE DATABASE smartchannel_test;
```

2. Aplicar novo schema:
```bash
psql -U postgres -d smartchannel_test -f database/smartchannel-db-v2-refactored.sql
```

3. Executar verificações de integridade

4. Testar queries básicas

### Passo 2.2: Backup de Produção

```bash
pg_dump -U postgres -d smartchannel -F c -f backup_pre_refactor_$(date +%Y%m%d_%H%M%S).dump
```

### Passo 2.3: Aplicar em Produção (CUIDADO!)

**OPÇÃO A: Recriar banco do zero (RECOMENDADO)**
```bash
# 1. Fazer backup
pg_dump -U postgres -d smartchannel -F c -f backup_final_$(date +%Y%m%d_%H%M%S).dump

# 2. Dropar banco (CUIDADO!)
dropdb -U postgres smartchannel

# 3. Criar banco novo
createdb -U postgres smartchannel

# 4. Aplicar novo schema
psql -U postgres -d smartchannel -f database/smartchannel-db-v2-refactored.sql

# 5. Verificar integridade
psql -U postgres -d smartchannel -f scripts/verify_integrity.sql
```

**OPÇÃO B: Migração gradual (não recomendado, mas possível)**
- Mais complexo
- Requer scripts de migração de dados
- Maior risco de erro

---

## 💻 FASE 3: ATUALIZAR BACKEND

### Passo 3.1: Atualizar Models/Entities

**Arquivos a atualizar:**
- `backend/src/models/` (todos os models)
- `backend/src/types/` (TypeScript types)

**Mudanças principais:**
- Renomear `Client` → `Subscriber`
- Renomear `Host` → `Publisher`
- Atualizar todos os campos `clientId` → `subscriberId`
- Atualizar todos os campos `hostId` → `publisherId`
- Adicionar novos campos (`is_tenant_user`, `user_type`, etc.)

### Passo 3.2: Atualizar Services

**Serviços afetados:**
- `campaignService.ts` → usar `subscriber_id`
- `mediaService.ts` → usar `subscriber_id`
- `playlistService.ts` → suportar polimorfismo
- `totemService.ts` → remover `client_id`, derivar publisher via local
- `billingService.ts` → dividir em `subscriberBillingService` e `publisherBillingService`
- `userService.ts` → adicionar lógica de `is_tenant_user` e `publisher_id`

### Passo 3.3: Atualizar Routes/Controllers

**Rotas afetadas:**
- `/api/clients/*` → `/api/subscribers/*`
- `/api/hosts/*` → `/api/publishers/*`
- `/api/users/*` → atualizar lógica de `publisher_id`
- `/api/billing/*` → dividir em `/api/subscriber-billing/*` e `/api/publisher-billing/*`

### Passo 3.4: Atualizar Queries SQL

**Buscar e substituir:**
- `client_id` → `subscriber_id` (onde aplicável)
- `host_id` → `publisher_id`
- `FROM clients` → `FROM subscribers`
- `FROM hosts` → `FROM publishers`
- `JOIN clients` → `JOIN subscribers`
- `JOIN hosts` → `JOIN publishers`

### Passo 3.5: Atualizar Middleware de Autenticação

**Middleware afetado:**
- `authMiddleware.ts` → considerar `is_tenant_user` e `publisher_id`
- RBAC → atualizar permissões para novos recursos

### Passo 3.6: Atualizar Validações

**Validações afetadas:**
- Validar `subscriber_id` em vez de `client_id`
- Validar `publisher_id` em vez de `host_id`
- Validar constraints polimórficas (`playlists`, `execution_logs`)

---

## 🎨 FASE 4: ATUALIZAR FRONTEND

### Passo 4.1: Atualizar API Clients

**Arquivos:**
- `frontend/src/services/api/clients.ts` → `subscribers.ts`
- `frontend/src/services/api/hosts.ts` → `publishers.ts`
- `frontend/src/services/api/billing.ts` → dividir

### Passo 4.2: Atualizar Components

**Componentes afetados:**
- Todos que usam `client` → `subscriber`
- Todos que usam `host` → `publisher`
- Formulários de usuários → adicionar campo `publisher_id`
- Formulários de billing → separar subscriber e publisher

### Passo 4.3: Atualizar Types/Interfaces

**Arquivos:**
- `frontend/src/types/` → atualizar todas as interfaces
- `Client` → `Subscriber`
- `Host` → `Publisher`

### Passo 4.4: Atualizar Estado (Redux/Context)

**Stores/Contexts:**
- `clientSlice` → `subscriberSlice`
- `hostSlice` → `publisherSlice`
- Adicionar estado para billing separado

---

## 🧪 FASE 5: TESTES

### Passo 5.1: Testes de Integridade de Dados
- Verificar todas as FKs
- Verificar constraints CHECK
- Verificar índices

### Passo 5.2: Testes Funcionais
- CRUD de subscribers
- CRUD de publishers
- CRUD de campanhas (com subscriber_id)
- CRUD de mídias (com subscriber_id)
- CRUD de playlists (polimórfico)
- Criação de billing (subscriber e publisher)

### Passo 5.3: Testes de Integração
- Fluxo completo de criação de campanha
- Fluxo completo de billing
- Fluxo de aprovação de payouts

### Passo 5.4: Testes de Performance
- Queries com novos índices
- Views materializadas (se necessário)

---

## 📚 FASE 6: DOCUMENTAÇÃO

### Passo 6.1: Documentar Mudanças
- Changelog detalhado
- Guia de migração
- Mapeamento de campos antigos → novos

### Passo 6.2: Atualizar API Documentation
- Swagger/OpenAPI
- Exemplos de requests/responses

### Passo 6.3: Atualizar Documentação de Desenvolvimento
- README
- Guias de setup
- Diagramas ER atualizados

---

## ✅ CHECKLIST FINAL

### Banco de Dados
- [ ] Schema novo criado e testado
- [ ] Todas as tabelas renomeadas/criadas
- [ ] Todas as FKs criadas
- [ ] Todos os índices criados
- [ ] Todas as views criadas
- [ ] Constraints CHECK funcionando
- [ ] Verificação de integridade passou

### Backend
- [ ] Models atualizados
- [ ] Services atualizados
- [ ] Routes atualizados
- [ ] Queries SQL atualizadas
- [ ] Middleware atualizado
- [ ] Validações atualizadas
- [ ] Testes passando

### Frontend
- [ ] API clients atualizados
- [ ] Components atualizados
- [ ] Types atualizados
- [ ] Estado atualizado
- [ ] Testes passando

### Testes
- [ ] Testes de integridade
- [ ] Testes funcionais
- [ ] Testes de integração
- [ ] Testes de performance

### Documentação
- [ ] Changelog
- [ ] Guia de migração
- [ ] API documentation
- [ ] Documentação de desenvolvimento

---

## 🚨 PONTOS DE ATENÇÃO CRÍTICOS

1. **Ordem de criação** - Respeitar dependências entre tabelas
2. **Constraints CHECK** - Validar logic polimórfica corretamente
3. **Índices compostos** - Manter performance
4. **Views** - Atualizar todas que referenciam tabelas antigas
5. **Código legado** - Buscar TODAS as referências a `client`/`host`
6. **RBAC** - Atualizar permissões para novos recursos
7. **Migração de dados** - Se necessário migrar dados antigos (não neste caso)
8. **Backup** - Sempre fazer backup antes de mudanças

---

## 📅 ESTIMATIVA DE TEMPO

| Fase | Tempo Estimado |
|------|----------------|
| Fase 0: Preparação | 2-4 horas |
| Fase 1: Criar Schema SQL | 8-12 horas |
| Fase 2: Aplicar Schema | 2-4 horas |
| Fase 3: Backend | 16-24 horas |
| Fase 4: Frontend | 12-16 horas |
| Fase 5: Testes | 8-12 horas |
| Fase 6: Documentação | 4-6 horas |
| **TOTAL** | **52-78 horas** |

---

## 🎯 PRÓXIMOS PASSOS IMEDIATOS

1. **Revisar este plano** com a equipe
2. **Criar ambiente de teste**
3. **Iniciar Fase 0** (Preparação)
4. **Criar arquivo SQL completo** (Fase 1)
5. **Testar em ambiente isolado**
6. **Validar com stakeholders**
7. **Aplicar em produção** (após aprovação)

---

**Status:** Plano criado e pronto para execução após aprovação.

