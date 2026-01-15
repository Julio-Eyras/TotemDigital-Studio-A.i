# Análise do Relacionamento: Subscribers → Contratos → Planos → Publishers

## 📋 **VISÃO GERAL DO MODELO**

O sistema Smart Signage Pro v2.0 implementa um modelo hierárquico de acesso onde:

```
Subscriber (1:N) → Contratos (N:1) → Plano (1:N) → Publishers
```

**Fluxo de Acesso:**
1. Um **Subscriber** (anunciante) pode ter **1 ou mais Contratos**
2. Cada **Contrato** está associado a **1 Plano específico**
3. Cada **Plano** tem regras base definidas pelo administrador
4. Cada **Plano** pode permitir acesso a **1 ou mais Publishers**
5. O acesso real é validado através de `subscriber_publisher_access` (combina plano + contrato)

---

## 🗄️ **ESTRUTURA DAS TABELAS (v2.0)**

### **1. SUBSCRIBERS (Assinantes/Anunciantes)**

```sql
CREATE TABLE subscribers (
    subscriber_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    whatsapp TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Características:**
- ✅ Entidade base (anunciantes que compram espaço publicitário)
- ✅ Um subscriber pode ter múltiplos contratos
- ✅ Não tem relacionamento direto com planos ou publishers

---

### **2. SUBSCRIBER_CONTRACTS (Contratos dos Subscribers)**

```sql
CREATE TABLE subscriber_contracts (
    contract_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL,  -- FK para subscribers
    plan_id INTEGER,                  -- FK para plans (NOVO no v2.0)
    
    contract_number TEXT UNIQUE NOT NULL,
    contract_type TEXT NOT NULL,      -- 'advertising', 'subscription', 'partnership'
    title TEXT NOT NULL,
    description TEXT,
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- Valores contratuais
    total_amount NUMERIC(12, 2),
    currency TEXT DEFAULT 'BRL',
    payment_terms TEXT,
    
    -- Arquivo do contrato
    document_path TEXT,
    document_filename TEXT,
    document_mime_type TEXT,
    document_size_bytes BIGINT,
    
    status TEXT DEFAULT 'draft',     -- draft, active, expired, terminated, cancelled
    
    signed_by_subscriber_at TIMESTAMP,
    signed_by_admin_at TIMESTAMP,
    created_by INTEGER,               -- FK para users
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Relacionamentos:**
- ✅ **1 Subscriber** → **N Contratos** (um subscriber pode ter múltiplos contratos)
- ✅ **1 Contrato** → **1 Plano** (cada contrato está vinculado a um plano específico)
- ✅ **1 Contrato** → **1 Subscriber** (cada contrato pertence a um subscriber)

**Características Importantes:**
- ⚠️ **`plan_id` é OPCIONAL** (pode ser NULL) - permite contratos sem plano definido
- ⚠️ **`status`** controla se o contrato está ativo (`'active'`)
- ⚠️ **`start_date` e `end_date`** controlam validade temporal

---

### **3. PLANS (Planos)**

```sql
CREATE TABLE plans (
    plan_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_monthly NUMERIC(12, 2) NOT NULL,
    price_yearly NUMERIC(12, 2),
    currency TEXT DEFAULT 'BRL',
    billing_interval TEXT DEFAULT 'month',
    
    -- Integração Stripe
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    stripe_product_id TEXT,
    
    -- Features e limites do plano
    features JSONB DEFAULT '{}'::jsonb,
    limits JSONB DEFAULT '{}'::jsonb,  -- Ex: { totems: 10, campaigns: 50, storage_gb: 100 }
    
    is_active BOOLEAN DEFAULT true,
    is_popular BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Características:**
- ✅ **Definidos pelo Administrador** (regras base do sistema)
- ✅ **Features e Limits** em JSONB (configuráveis)
- ✅ **1 Plano** → **N Contratos** (múltiplos contratos podem usar o mesmo plano)
- ✅ **1 Plano** → **N Publishers** (via `plan_publisher_access`)

---

### **4. PLAN_PUBLISHER_ACCESS (Acesso Plano → Publisher)**

```sql
CREATE TABLE plan_publisher_access (
    plan_id INTEGER NOT NULL,         -- FK para plans
    publisher_id INTEGER NOT NULL,    -- FK para publishers
    
    -- Controle de acesso
    is_allowed BOOLEAN DEFAULT true,
    
    -- Restrições específicas do plano para este publisher
    restrictions JSONB DEFAULT '{}'::jsonb,
        -- Exemplo: { 
        --   "max_campaigns": 10,
        --   "revenue_share_min": 5,
        --   "priority": "high",
        --   "time_slots": ["08:00-18:00"]
        -- }
    
    -- Metadados
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (plan_id, publisher_id)
);
```

**Relacionamentos:**
- ✅ **1 Plano** → **N Publishers** (um plano pode permitir acesso a múltiplos publishers)
- ✅ **1 Publisher** → **N Planos** (um publisher pode estar em múltiplos planos)

**Características:**
- ✅ **Configuração Base**: Define quais publishers um plano permite acessar
- ✅ **Restrições por Publisher**: Cada combinação plano-publisher pode ter restrições específicas
- ✅ **Gerenciado pelo Administrador**: Configuração centralizada

---

### **5. SUBSCRIBER_PUBLISHER_ACCESS (Acesso Real Subscriber → Publisher)**

```sql
CREATE TABLE subscriber_publisher_access (
    access_id SERIAL PRIMARY KEY,
    
    -- Relacionamentos
    subscriber_id INTEGER NOT NULL,  -- FK para subscribers
    publisher_id INTEGER NOT NULL,  -- FK para publishers
    contract_id INTEGER,             -- FK para subscriber_contracts (pode ser NULL)
    plan_id INTEGER,                 -- FK para plans (para auditoria)
    
    -- Controle de acesso
    access_type TEXT NOT NULL DEFAULT 'contract', 
        -- 'plan' = herdado do plano (criado automaticamente)
        -- 'contract' = definido no contrato específico
        -- 'override' = sobrescreve configuração do plano
    
    -- Controle temporal
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,             -- NULL = sem expiração
    revoked_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadados
    granted_by INTEGER,               -- FK para users (quem concedeu acesso)
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Relacionamentos:**
- ✅ **1 Subscriber** → **N Publishers** (via múltiplos acessos)
- ✅ **1 Publisher** → **N Subscribers** (via múltiplos acessos)
- ✅ **1 Contrato** → **N Acessos** (um contrato pode gerar múltiplos acessos)
- ✅ **1 Plano** → **N Acessos** (via `plan_publisher_access`)

**Características:**
- ✅ **Acesso Real**: Esta é a tabela que realmente controla o acesso
- ✅ **Múltiplas Fontes**: Acesso pode vir de:
  - **Plano** (`access_type = 'plan'`) - herdado automaticamente
  - **Contrato** (`access_type = 'contract'`) - definido no contrato
  - **Override** (`access_type = 'override'`) - sobrescreve tudo
- ✅ **Temporal**: Pode ter `expires_at` para controle de validade
- ✅ **Revogável**: `revoked_at` permite revogar sem deletar

---

### **6. PUBLISHERS (Publicadores)**

```sql
CREATE TABLE publishers (
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Características:**
- ✅ **Publicadores**: Clientes que instalam totens e Smart TVs
- ✅ **Pode ser também Subscriber**: `is_subscriber = true` (dual role)
- ✅ **Acesso via Planos**: Publishers são acessados através de planos

---

## 🔄 **FLUXO DE ACESSO (Como Funciona)**

### **Cenário 1: Acesso via Plano (Automático)**

```
1. Admin cria Plano "Premium" com regras base
2. Admin configura plan_publisher_access:
   - Plano "Premium" → Publisher "Shopping Center Norte" (is_allowed = true)
   - Plano "Premium" → Publisher "Aeroporto" (is_allowed = true)
   
3. Subscriber "Coca-Cola" assina Contrato vinculado ao Plano "Premium"
   - subscriber_contracts: subscriber_id=1, plan_id=1, status='active'
   
4. Sistema automaticamente cria subscriber_publisher_access:
   - subscriber_id=1, publisher_id=1, plan_id=1, access_type='plan'
   - subscriber_id=1, publisher_id=2, plan_id=1, access_type='plan'
   
5. Subscriber "Coca-Cola" agora tem acesso aos 2 publishers
```

### **Cenário 2: Acesso via Contrato Específico (Manual)**

```
1. Subscriber "Pepsi" tem Contrato ativo sem plano definido
   - subscriber_contracts: subscriber_id=2, plan_id=NULL, status='active'
   
2. Admin concede acesso manual via subscriber_publisher_access:
   - subscriber_id=2, publisher_id=3, contract_id=5, access_type='contract'
   
3. Subscriber "Pepsi" tem acesso apenas ao publisher específico
```

### **Cenário 3: Override (Sobrescreve Plano)**

```
1. Subscriber "Nike" tem Contrato com Plano "Standard"
   - Plano "Standard" permite acesso a Publisher A e B
   
2. Admin quer dar acesso extra a Publisher C (não está no plano):
   - subscriber_publisher_access: 
     subscriber_id=3, publisher_id=3, access_type='override'
   
3. Subscriber "Nike" tem acesso a A, B (via plano) e C (via override)
```

---

## 🔍 **VALIDAÇÃO DE ACESSO (Função SQL)**

O sistema usa a função `check_subscriber_publisher_access` para validar acesso:

```sql
CREATE OR REPLACE FUNCTION check_subscriber_publisher_access(
    p_subscriber_id INTEGER, 
    p_publisher_id INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_access BOOLEAN := false;
    v_plan_id INTEGER;
BEGIN
    -- Prioridade 1: Acesso explícito via subscriber_publisher_access
    IF EXISTS (
        SELECT 1 FROM subscriber_publisher_access
        WHERE subscriber_id = p_subscriber_id
          AND publisher_id = p_publisher_id
          AND is_active = TRUE
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
          AND access_type IN ('contract', 'override')
    ) THEN
        RETURN TRUE;
    END IF;

    -- Prioridade 2: Acesso via plano do contrato ativo
    IF EXISTS (
        SELECT 1
        FROM subscriber_contracts sc
        JOIN plan_publisher_access ppa ON sc.plan_id = ppa.plan_id
        WHERE sc.subscriber_id = p_subscriber_id
          AND sc.status = 'active'
          AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
          AND sc.start_date <= CURRENT_DATE
          AND ppa.publisher_id = p_publisher_id
          AND ppa.is_allowed = TRUE
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Prioridade de Validação:**
1. **Acesso Explícito** (`contract` ou `override`) - maior prioridade
2. **Acesso via Plano** (herdado do contrato) - menor prioridade

---

## 📊 **VIEW: subscriber_publisher_access_active**

A view consolida todos os acessos ativos:

```sql
CREATE OR REPLACE VIEW subscriber_publisher_access_active AS
SELECT
    s.subscriber_id,
    s.name AS subscriber_name,
    p.publisher_id,
    p.name AS publisher_name,
    p.email AS publisher_email,
    TRUE AS has_access,
    COALESCE(spa.access_type, 'plan') AS access_type,
    COALESCE(spa.contract_id, sc.contract_id) AS contract_id,
    COALESCE(spa.plan_id, sc.plan_id) AS plan_id,
    pl.name AS plan_name,
    COALESCE(spa.granted_at, sc.created_at) AS granted_at,
    COALESCE(spa.expires_at, sc.end_date) AS expires_at
FROM subscribers s
JOIN publishers p ON check_subscriber_publisher_access(s.subscriber_id, p.publisher_id) = TRUE
LEFT JOIN subscriber_publisher_access spa 
    ON s.subscriber_id = spa.subscriber_id 
    AND p.publisher_id = spa.publisher_id 
    AND spa.is_active = TRUE 
    AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
LEFT JOIN subscriber_contracts sc 
    ON s.subscriber_id = sc.subscriber_id 
    AND sc.status = 'active' 
    AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
LEFT JOIN plans pl 
    ON COALESCE(spa.plan_id, sc.plan_id) = pl.plan_id
WHERE (spa.access_id IS NOT NULL 
    OR (sc.contract_id IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM plan_publisher_access ppa 
            WHERE ppa.plan_id = sc.plan_id 
            AND ppa.publisher_id = p.publisher_id 
            AND ppa.is_allowed = TRUE
        )
    )
);
```

---

## 🎯 **IMPLEMENTAÇÃO ATUAL (Backend)**

### **SubscriberAccessService**

O serviço `SubscriberAccessService` gerencia todo o fluxo:

```typescript
// Validação de acesso
async hasAccess(subscriberId: number, publisherId: number): Promise<boolean>

// Listar publishers acessíveis
async getAccessiblePublishers(subscriberId: number): Promise<number[]>

// Conceder acesso via contrato
async grantAccess(
  subscriberId: number,
  publisherId: number,
  contractId: number,
  grantedBy: number
): Promise<SubscriberPublisherAccess>

// Configurar acesso plano → publisher
async setPlanPublisherAccess(
  planId: number,
  publisherId: number,
  isAllowed: boolean,
  restrictions?: any
): Promise<void>
```

---

## ✅ **RESUMO DO MODELO**

### **Relacionamentos:**

```
Subscriber (1) ──< (N) subscriber_contracts (N) ──> (1) Plan
                                                          │
                                                          │
                                                          v
                                              plan_publisher_access
                                                          │
                                                          v
                                                    Publisher
                                                          │
                                                          │
subscriber_publisher_access ─────────────────────────────┘
```

### **Regras de Negócio:**

1. ✅ **1 Subscriber pode ter N Contratos**
2. ✅ **1 Contrato está vinculado a 1 Plano** (ou NULL)
3. ✅ **1 Plano pode permitir acesso a N Publishers** (via `plan_publisher_access`)
4. ✅ **Acesso real é controlado por `subscriber_publisher_access`**
5. ✅ **Prioridade**: Override > Contrato > Plano
6. ✅ **Validação temporal**: `start_date`, `end_date`, `expires_at`
7. ✅ **Status**: `is_active`, `status = 'active'`, `revoked_at IS NULL`

---

## 🔧 **PONTOS DE ATENÇÃO**

### **⚠️ Limitações Atuais:**

1. **Contrato sem Plano:**
   - Se `subscriber_contracts.plan_id = NULL`, o acesso só pode ser manual
   - Não há acesso automático via plano

2. **Múltiplos Contratos:**
   - Um subscriber pode ter múltiplos contratos ativos
   - Cada contrato pode ter um plano diferente
   - O acesso é unificado (OR lógico)

3. **Expiração:**
   - `subscriber_contracts.end_date` controla validade do contrato
   - `subscriber_publisher_access.expires_at` controla validade do acesso
   - Ambos são verificados

### **✅ Funcionalidades Implementadas:**

1. ✅ Validação de acesso via função SQL
2. ✅ View consolidada de acessos ativos
3. ✅ Suporte a múltiplos contratos por subscriber
4. ✅ Suporte a override de acesso
5. ✅ Controle temporal (expiração)
6. ✅ Notificações de acesso expirando
7. ✅ Auditoria (granted_by, notes, metadata)

---

## 📝 **CONCLUSÃO**

O modelo v2.0 implementa corretamente:

- ✅ **1 Subscriber → N Contratos** ✅
- ✅ **1 Contrato → 1 Plano** ✅
- ✅ **1 Plano → N Publishers** ✅
- ✅ **Regras base definidas pelo Admin** ✅
- ✅ **Acesso real via subscriber_publisher_access** ✅

O sistema é **flexível** e permite:
- Acesso automático via planos
- Acesso manual via contratos
- Override de acesso
- Múltiplos contratos por subscriber
- Controle temporal de acesso

