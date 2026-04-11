# Documentação Completa: Tabelas de Contratos e Relacionamentos

## 📋 **VISÃO GERAL**

O sistema possui **duas tabelas principais de contratos**:

1. **`subscriber_contracts`** - Contratos com anunciantes (subscribers)
2. **`publisher_contracts`** - Contratos com publicadores (publishers)

Ambas se relacionam com **planos**, **publishers**, **subscribers** e controlam **regras de acesso** e **billing**.

---

## 📊 **1. SUBSCRIBER_CONTRACTS (Contratos de Anunciantes)**

### **Estrutura da Tabela:**

```sql
CREATE TABLE subscriber_contracts (
    -- IDs e Relacionamentos
    contract_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL,        -- FK → subscribers
    plan_id INTEGER,                       -- FK → plans (OPCIONAL)
    
    -- Identificação
    contract_number TEXT UNIQUE NOT NULL,   -- Número único do contrato
    contract_type TEXT NOT NULL,           -- Tipo: 'advertising', 'subscription', 'partnership'
    title TEXT NOT NULL,                   -- Título do contrato
    description TEXT,                      -- Descrição detalhada
    
    -- Período de Validade
    start_date DATE NOT NULL,              -- Data de início
    end_date DATE,                         -- Data de término (NULL = sem término)
    
    -- Valores Financeiros
    total_amount NUMERIC(12, 2),           -- Valor total do contrato
    currency TEXT DEFAULT 'BRL',          -- Moeda (BRL, USD, etc.)
    payment_terms TEXT,                    -- Condições de pagamento
    
    -- Documento do Contrato
    document_path TEXT,                    -- Caminho do arquivo (PDF/DOC/DOCX)
    document_filename TEXT,                -- Nome do arquivo
    document_mime_type TEXT,               -- Tipo MIME do arquivo
    document_size_bytes BIGINT,            -- Tamanho em bytes
    
    -- Status e Assinaturas
    status TEXT DEFAULT 'draft',           -- draft, active, expired, terminated, cancelled
    signed_by_subscriber_at TIMESTAMP,     -- Data de assinatura pelo subscriber
    signed_by_tenant_at TIMESTAMP,         -- Data de assinatura pelo admin/tenant
    
    -- Metadados
    metadata JSONB,                       -- Dados adicionais (cláusulas, termos, etc.)
    created_by INTEGER,                    -- FK → users (quem criou)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Campos Detalhados:**

#### **Relacionamentos:**
- **`subscriber_id`** (OBRIGATÓRIO)
  - FK para `subscribers.subscriber_id`
  - Define qual anunciante é parte do contrato
  - Um subscriber pode ter múltiplos contratos

- **`plan_id`** (OPCIONAL)
  - FK para `plans.plan_id`
  - Define qual plano está associado ao contrato
  - Se NULL, contrato não está vinculado a um plano específico
  - Quando preenchido, o contrato herda as regras do plano

#### **Identificação:**
- **`contract_number`** (OBRIGATÓRIO, ÚNICO)
  - Número único do contrato (ex: "CONTRACT-2024-001")
  - Usado para referência e busca

- **`contract_type`** (OBRIGATÓRIO)
  - `'advertising'` - Contrato de publicidade (anunciante paga por espaço)
  - `'subscription'` - Contrato de assinatura (anunciante paga mensalmente/anualmente)
  - `'partnership'` - Contrato de parceria (termos especiais)

#### **Período:**
- **`start_date`** (OBRIGATÓRIO)
  - Data de início do contrato
  - Contrato só fica ativo após esta data

- **`end_date`** (OPCIONAL)
  - Data de término do contrato
  - Se NULL, contrato não tem data de término
  - Contrato expira automaticamente após esta data

#### **Valores:**
- **`total_amount`** (OPCIONAL)
  - Valor total do contrato
  - Pode ser usado para contratos de valor fixo

- **`currency`** (DEFAULT: 'BRL')
  - Moeda do contrato

- **`payment_terms`** (OPCIONAL)
  - Condições de pagamento (ex: "30 dias", "À vista", etc.)

#### **Documento:**
- **`document_path`** - Caminho completo do arquivo
- **`document_filename`** - Nome original do arquivo
- **`document_mime_type`** - Tipo do arquivo (application/pdf, etc.)
- **`document_size_bytes`** - Tamanho do arquivo

#### **Status:**
- **`status`** (DEFAULT: 'draft')
  - `'draft'` - Rascunho (não ativo)
  - `'active'` - Ativo (contrato em vigor)
  - `'expired'` - Expirado (passou end_date)
  - `'terminated'` - Terminado (cancelado antes do fim)
  - `'cancelled'` - Cancelado

#### **Assinaturas:**
- **`signed_by_subscriber_at`** - Data/hora que subscriber assinou
- **`signed_by_tenant_at`** - Data/hora que admin/tenant assinou

#### **Metadados:**
- **`metadata`** (JSONB)
  - Dados adicionais em formato JSON
  - Exemplo:
    ```json
    {
      "clauses": ["Cláusula 1", "Cláusula 2"],
      "special_terms": "Termos especiais...",
      "auto_renew": true,
      "renewal_period_days": 365
    }
    ```

---

## 📊 **2. PUBLISHER_CONTRACTS (Contratos de Publicadores)**

### **Estrutura da Tabela:**

```sql
CREATE TABLE publisher_contracts (
    -- IDs e Relacionamentos
    contract_id SERIAL PRIMARY KEY,
    publisher_id INTEGER NOT NULL,        -- FK → publishers
    
    -- Identificação
    contract_number TEXT UNIQUE NOT NULL,
    contract_type TEXT NOT NULL,          -- 'revenue_share', 'subscription', 'partnership', 'hybrid'
    title TEXT NOT NULL,
    description TEXT,
    
    -- Período de Validade
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- Termos de Revenue Share (se aplicável)
    revenue_share_percentage NUMERIC(5, 2),  -- % fixo (ex: 70.00 = 70%)
    revenue_share_rules JSONB,               -- Regras variáveis
    minimum_payout_amount NUMERIC(12, 2),    -- Valor mínimo para pagamento
    
    -- Termos de Subscription (se aplicável)
    subscription_amount NUMERIC(12, 2),      -- Valor mensal/anual
    subscription_interval TEXT,               -- 'month' ou 'year'
    
    -- Valores Financeiros
    currency TEXT DEFAULT 'BRL',
    payment_terms TEXT,
    
    -- Documento do Contrato
    document_path TEXT,
    document_filename TEXT,
    document_mime_type TEXT,
    document_size_bytes BIGINT,
    
    -- Status e Assinaturas
    status TEXT DEFAULT 'draft',
    signed_by_publisher_at TIMESTAMP,
    signed_by_tenant_at TIMESTAMP,
    
    -- Metadados
    metadata JSONB,
    created_by INTEGER,                    -- FK → users
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Campos Detalhados:**

#### **Relacionamentos:**
- **`publisher_id`** (OBRIGATÓRIO)
  - FK para `publishers.publisher_id`
  - Define qual publisher é parte do contrato
  - Um publisher pode ter múltiplos contratos

#### **Tipo de Contrato:**
- **`contract_type`** (OBRIGATÓRIO)
  - `'revenue_share'` - Publisher recebe % das campanhas exibidas
  - `'subscription'` - Publisher paga mensalmente/anualmente para usar o sistema
  - `'partnership'` - Contrato de parceria (termos especiais)
  - `'hybrid'` - Combina revenue share + subscription (recebe % E paga subscription)

#### **Revenue Share:**
- **`revenue_share_percentage`** (OPCIONAL)
  - Percentual fixo que publisher recebe (ex: 70.00 = 70%)
  - Se NULL, usa regras variáveis de `revenue_share_rules`

- **`revenue_share_rules`** (JSONB)
  - Regras variáveis de revenue share
  - Exemplo:
    ```json
    {
      "by_campaign_type": {
        "video": 70,
        "image": 60,
        "interactive": 80
      },
      "by_time_slot": {
        "peak": 75,
        "off_peak": 65
      },
      "minimum_percentage": 50
    }
    ```

- **`minimum_payout_amount`** (OPCIONAL)
  - Valor mínimo acumulado para fazer payout ao publisher
  - Ex: Se mínimo é R$ 100,00, só paga quando acumular R$ 100,00 ou mais

#### **Subscription:**
- **`subscription_amount`** (OPCIONAL)
  - Valor que publisher paga mensalmente/anualmente
  - Usado quando `contract_type = 'subscription'` ou `'hybrid'`

- **`subscription_interval`** (OPCIONAL)
  - `'month'` - Pagamento mensal
  - `'year'` - Pagamento anual

---

## 🔗 **RELACIONAMENTOS COMPLETOS**

### **Diagrama de Relacionamentos:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUBSCRIBERS                                   │
│  (Anunciantes que compram espaço publicitário)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ 1:N
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              SUBSCRIBER_CONTRACTS                               │
│                                                                  │
│  - contract_id (PK)                                              │
│  - subscriber_id (FK) ────────────┐                            │
│  - plan_id (FK) ──────────────────┼──┐                         │
│  - contract_number, title, type   │  │                         │
│  - start_date, end_date           │  │                         │
│  - total_amount, currency         │  │                         │
│  - status (draft/active/expired)  │  │                         │
│  - document_path                  │  │                         │
└───────────────────────────────────┼──┼─────────────────────────┘
                            │        │  │
                            │        │  │ N:1
                            │        │  │
                            │        │  ▼
                            │        │ ┌─────────────────────────┐
                            │        │ │        PLANS            │
                            │        │ │                         │
                            │        │ │ - plan_id (PK)          │
                            │        │ │ - name, slug            │
                            │        │ │ - price_monthly/yearly  │
                            │        │ │ - features (JSONB)      │
                            │        │ │ - limits (JSONB)        │
                            │        │ └───────────┬─────────────┘
                            │        │             │
                            │        │             │ 1:N
                            │        │             │
                            │        │             ▼
                            │        │ ┌─────────────────────────┐
                            │        │ │ PLAN_PUBLISHER_ACCESS   │
                            │        │ │                         │
                            │        │ │ - plan_id (FK)          │
                            │        │ │ - publisher_id (FK)    │
                            │        │ │ - is_allowed            │
                            │        │ │ - restrictions (JSONB)  │
                            │        │ └───────────┬─────────────┘
                            │        │             │
                            │        │             │ N:1
                            │        │             │
                            │        └─────────────┼─────────────┐
                            │                      │             │
                            │                      ▼             │
                            │        ┌─────────────────────────┐ │
                            │        │      PUBLISHERS         │ │
                            │        │                         │ │
                            │        │ - publisher_id (PK)     │ │
                            │        │ - name, email, phone    │ │
                            │        └───────────┬─────────────┘ │
                            │                    │               │
                            │                    │ 1:N           │
                            │                    │               │
                            │                    ▼               │
                            │        ┌─────────────────────────┐ │
                            │        │   PUBLISHER_CONTRACTS   │ │
                            │        │                         │ │
                            │        │ - contract_id (PK)      │ │
                            │        │ - publisher_id (FK)     │ │
                            │        │ - contract_type         │ │
                            │        │   (revenue_share/       │ │
                            │        │    subscription/hybrid)  │ │
                            │        │ - revenue_share_%       │ │
                            │        │ - subscription_amount   │ │
                            │        │ - start_date, end_date  │ │
                            │        │ - status                │ │
                            │        └─────────────────────────┘ │
                            │                                    │
                            │                                    │
                            └────────────────────────────────────┘
                                         │
                                         │
                                         ▼
                            ┌─────────────────────────────────────┐
                            │ SUBSCRIBER_PUBLISHER_ACCESS        │
                            │ (Acesso Real Concedido)             │
                            │                                     │
                            │ - access_id (PK)                    │
                            │ - subscriber_id (FK) ───────────┐  │
                            │ - publisher_id (FK) ─────────────┼─┐│
                            │ - contract_id (FK) ──────────────┼─┼┼┐
                            │ - plan_id (FK) ───────────────────┼─┼┼┼┐
                            │ - access_type                     │ ││││
                            │   (plan/contract/override)         │ ││││
                            │ - granted_at, expires_at           │ ││││
                            │ - is_active                        │ ││││
                            └────────────────────────────────────┼─┼┼┼┘
                                                                │ │││
                                                                │ │││
                    ┌───────────────────────────────────────────┘ │││
                    │                                             │││
                    │ Quando contrato de subscriber é ativado:   │││
                    │ 1. Busca plan_id do contrato               │││
                    │ 2. Busca publishers permitidos no plano    │││
                    │    (via plan_publisher_access)              │││
                    │ 3. Cria subscriber_publisher_access         │││
                    │    para cada publisher permitido           │││
                    └─────────────────────────────────────────────┘││
                                                                  ││
                    ┌─────────────────────────────────────────────┘│
                    │ Quando campanha é executada:                │
                    │ 1. Identifica publisher (via totem)          │
                    │ 2. Busca publisher_contracts ativo          │
                    │ 3. Calcula revenue share baseado em:         │
                    │    - revenue_share_percentage (fixo) OU     │
                    │    - revenue_share_rules (variável)         │
                    │ 4. Cria registro em publisher_billing       │
                    └─────────────────────────────────────────────┘
```

---

## 📐 **REGRAS E VALIDAÇÕES**

### **1. Regras de Subscriber Contracts:**

#### **Validação de Datas:**
- `start_date` deve ser <= `end_date` (se `end_date` não for NULL)
- Contrato só fica `'active'` se `start_date <= CURRENT_DATE`
- Contrato expira automaticamente se `end_date < CURRENT_DATE`

#### **Validação de Plano:**
- `plan_id` é OPCIONAL
- Se preenchido, deve existir em `plans`
- Se preenchido, o contrato herda as regras do plano

#### **Validação de Status:**
- Contrato só pode ser `'active'` se:
  - `status = 'draft'` → pode mudar para `'active'`
  - `start_date <= CURRENT_DATE`
  - Se `end_date` existe, `end_date >= CURRENT_DATE`
  - Assinado por ambas as partes (opcional, depende do fluxo)

### **2. Regras de Publisher Contracts:**

#### **Validação de Revenue Share:**
- Se `contract_type = 'revenue_share'` ou `'hybrid'`:
  - Deve ter `revenue_share_percentage` OU `revenue_share_rules`
  - `revenue_share_percentage` deve estar entre 0 e 100

#### **Validação de Subscription:**
- Se `contract_type = 'subscription'` ou `'hybrid'`:
  - Deve ter `subscription_amount > 0`
  - Deve ter `subscription_interval` ('month' ou 'year')

#### **Validação de Datas:**
- Mesmas regras de `subscriber_contracts`

### **3. Regras de Acesso (subscriber_publisher_access):**

#### **Criação Automática:**
Quando um `subscriber_contract` é ativado (`status = 'active'`):

1. **Se contrato tem `plan_id`:**
   - Busca todos os publishers permitidos no plano (via `plan_publisher_access`)
   - Para cada publisher permitido:
     - Cria `subscriber_publisher_access` com:
       - `subscriber_id` = do contrato
       - `publisher_id` = do plano
       - `contract_id` = do contrato
       - `plan_id` = do contrato
       - `access_type` = `'plan'`
       - `granted_at` = CURRENT_TIMESTAMP
       - `expires_at` = `end_date` do contrato (se existir)
       - `is_active` = true

2. **Se contrato NÃO tem `plan_id`:**
   - Acesso deve ser criado manualmente pelo admin
   - `access_type` = `'contract'` ou `'override'`

#### **Revogação Automática:**
Quando um `subscriber_contract` expira ou é terminado:

1. Busca todos os `subscriber_publisher_access` com `contract_id` do contrato
2. Atualiza:
   - `is_active` = false
   - `revoked_at` = CURRENT_TIMESTAMP

### **4. Regras de Billing:**

#### **Subscriber Billing:**
- Criado quando subscriber paga por:
  - Campanha (`billing_type = 'campaign'`)
  - Upload de mídia (`billing_type = 'media_upload'`)
  - Storage (`billing_type = 'storage'`)
  - Subscription (`billing_type = 'subscription'`)
- `direction` sempre = `'incoming'` (plataforma recebe)

#### **Publisher Billing:**
- **Revenue Share (`billing_type = 'revenue_share'`):**
  - Criado quando campanha é executada em totem do publisher
  - `direction` = `'outgoing'` (publisher recebe)
  - Calcula baseado em `publisher_contracts.revenue_share_percentage` ou `revenue_share_rules`
  - Exemplo:
    - Campanha custa R$ 1.000,00
    - Publisher tem revenue_share_percentage = 70%
    - Publisher recebe: R$ 700,00
    - Plataforma retém: R$ 300,00

- **Subscription (`billing_type = 'subscription'`):**
  - Criado periodicamente (mensal/anual)
  - `direction` = `'incoming'` (publisher paga)
  - Valor vem de `publisher_contracts.subscription_amount`

---

## 🎯 **EXEMPLOS PRÁTICOS**

### **Exemplo 1: Contrato de Subscriber com Plano**

```
1. Admin cria Plano "Premium":
   - plan_id = 1
   - name = "Premium"
   - price_monthly = 500.00

2. Admin configura acesso do plano:
   - plan_publisher_access:
     - plan_id = 1, publisher_id = 10 (Shopping Center)
     - plan_id = 1, publisher_id = 11 (Aeroporto)

3. Subscriber "Coca-Cola" assina contrato:
   - subscriber_contracts:
     - subscriber_id = 5
     - plan_id = 1
     - contract_number = "CONTRACT-2024-001"
     - status = 'active'
     - start_date = '2024-01-01'
     - end_date = '2024-12-31'

4. Sistema cria acessos automaticamente:
   - subscriber_publisher_access:
     - subscriber_id = 5, publisher_id = 10, contract_id = 1, plan_id = 1
     - subscriber_id = 5, publisher_id = 11, contract_id = 1, plan_id = 1
```

### **Exemplo 2: Contrato de Publisher com Revenue Share**

```
1. Publisher "Shopping Center" assina contrato:
   - publisher_contracts:
     - publisher_id = 10
     - contract_type = 'revenue_share'
     - revenue_share_percentage = 70.00
     - status = 'active'
     - start_date = '2024-01-01'

2. Subscriber "Coca-Cola" cria campanha:
   - campaigns:
     - subscriber_id = 5
     - total_budget = 10000.00

3. Campanha é executada em totem do Shopping Center:
   - Sistema calcula revenue share:
     - Valor da campanha: R$ 1.000,00
     - Publisher recebe: R$ 700,00 (70%)
     - Plataforma retém: R$ 300,00 (30%)

4. Sistema cria billing:
   - publisher_billing:
     - publisher_id = 10
     - billing_type = 'revenue_share'
     - direction = 'outgoing'
     - amount = 700.00
     - revenue_share_percentage = 70.00
     - payment_status = 'pending_payout'
```

### **Exemplo 3: Contrato Híbrido (Revenue Share + Subscription)**

```
1. Publisher "Aeroporto" assina contrato híbrido:
   - publisher_contracts:
     - publisher_id = 11
     - contract_type = 'hybrid'
     - revenue_share_percentage = 60.00
     - subscription_amount = 2000.00
     - subscription_interval = 'month'
     - status = 'active'

2. Publisher recebe revenue share:
   - Quando campanhas são executadas
   - Recebe 60% do valor

3. Publisher paga subscription:
   - Mensalmente: R$ 2.000,00
   - publisher_billing:
     - direction = 'incoming'
     - billing_type = 'subscription'
     - amount = 2000.00
```

---

## 📝 **RESUMO DOS RELACIONAMENTOS**

### **Subscriber Contracts:**
- **1 Subscriber** → **N Contratos**
- **1 Contrato** → **1 Plano** (opcional)
- **1 Contrato** → **N Acessos** (via `subscriber_publisher_access`)

### **Publisher Contracts:**
- **1 Publisher** → **N Contratos**
- **1 Contrato** → Define termos de revenue share e/ou subscription

### **Plans:**
- **1 Plano** → **N Contratos** (subscribers)
- **1 Plano** → **N Publishers** (via `plan_publisher_access`)

### **Acesso Real:**
- **`subscriber_publisher_access`** é a tabela que realmente controla o acesso
- Pode ser criado:
  - **Automaticamente** (via plano do contrato)
  - **Manualmente** (pelo admin)
  - **Sobrescrito** (override de regras)

---

**Última atualização:** 2024-12-19
**Versão:** v2.0

