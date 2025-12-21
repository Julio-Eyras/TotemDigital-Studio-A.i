# Análise Crítica: Modelo de Billing e Estrutura Organizacional

## 🎯 Clarificação do Modelo de Negócio

### Hierarquia de Entidades (Corrigida)

```
┌─────────────────────────────────────────────────────────────┐
│                  SMARTDISPLAY ECOSYSTEM                     │
│                                                             │
│  TENANT = SmartSignage Pro (a plataforma, você)            │
│                                                             │
│  ┌──────────────┐              ┌──────────────┐            │
│  │     HOST     │              │    CLIENT    │            │
│  │ (Publisher)  │              │ (Advertiser) │            │
│  │              │              │              │            │
│  │ • Instala    │              │ • Cria       │            │
│  │   totens     │              │   campanhas  │            │
│  │              │              │              │            │
│  │ • Recebe %   │◄───Billing───┤ • Paga       │            │
│  │   OU paga    │   (Host)     │   anúncios   │            │
│  │   para usar  │              │              │            │
│  │              │              │              │            │
│  │ → users      │              │ → campaigns  │            │
│  │ → totems     │              │ → medias     │            │
│  │ → locals     │              │              │            │
│  └──────────────┘              └──────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Entidades Principais

#### 1️⃣ **TENANT = SmartSignage Pro** (Você)
- A **plataforma em si**
- Operador do sistema
- Recebe receita de:
  - Anunciantes (CLIENTs) que pagam por anúncios
  - Hosts que pagam para usar o sistema (se aplicável)

#### 2️⃣ **HOST** (Publisher/Operador)
- Cliente que **instala e opera totens**
- Pode ter dois modelos de negócio:
  - **Modelo A:** Recebe percentual (revenue share) por exibir anúncios
  - **Modelo B:** Paga para usar o sistema (subscription)
- **Usuários do sistema** (users pertencem ao HOST)
- **Assinaturas** podem ser do HOST (se modelo B)

#### 3️⃣ **CLIENT** (Advertiser/Anunciante)
- Empresa que **faz anúncios**
- Cria campanhas e mídias
- **Paga pela publicidade**
- **NÃO controla hardware**
- **NÃO são tenants do sistema**

---

## 💰 Análise do Modelo de Billing

### Situação Atual no Schema

```sql
billing (
    billing_id,
    client_id,          -- ❓ Apenas client_id
    campaign_id,
    totem_id,
    billing_type,
    amount,
    ...
)
```

### Problema Identificado

A tabela `billing` atual **apenas tem `client_id`**, mas precisa suportar:

1. **Billing de CLIENT (Anunciante)**
   - CLIENT paga para fazer anúncios
   - `billing_type` = 'advertisement', 'campaign', etc.
   - `amount` = valor que CLIENT paga

2. **Billing de HOST (Publisher)**
   - **Cenário A:** HOST recebe percentual (revenue share)
     - `billing_type` = 'revenue_share', 'payout'
     - `amount` = valor que HOST recebe
   - **Cenário B:** HOST paga para usar sistema
     - `billing_type` = 'subscription', 'platform_fee'
     - `amount` = valor que HOST paga

### Proposta de Solução

#### **Opção 1: Campos Opcionais (Polimórfico)**

```sql
billing (
    billing_id,
    
    -- Entidade que paga/recebe (polimórfico)
    client_id INTEGER,        -- NULL se for billing de HOST
    host_id INTEGER,          -- NULL se for billing de CLIENT
    
    -- Contexto da transação
    campaign_id INTEGER,      -- Se relacionado a campanha
    totem_id INTEGER,         -- Se relacionado a totem específico
    subscription_id INTEGER,  -- Se relacionado a assinatura
    
    billing_type TEXT NOT NULL,  -- 'advertisement', 'revenue_share', 'subscription', 'platform_fee'
    billing_direction TEXT,      -- 'incoming' (recebe), 'outgoing' (paga)
    
    amount NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    ...
    
    -- Constraint: apenas um dos dois preenchidos
    CONSTRAINT chk_billing_entity 
        CHECK (
            (client_id IS NOT NULL AND host_id IS NULL) OR
            (client_id IS NULL AND host_id IS NOT NULL)
        )
);
```

**Vantagens:**
- ✅ Uma única tabela para todos os tipos de billing
- ✅ Flexível para diferentes modelos de negócio
- ✅ Facilita relatórios consolidados

**Desvantagens:**
- ⚠️ Menos explícito (precisa verificar billing_type para entender)
- ⚠️ Constraint CHECK necessário

#### **Opção 2: Tabelas Separadas (Recomendado)**

```sql
-- Billing de Anunciantes (CLIENT paga)
advertiser_billing (
    billing_id,
    client_id INTEGER NOT NULL,      -- FK → clients
    campaign_id INTEGER,              -- FK → campaigns
    billing_type TEXT,                -- 'advertisement', 'campaign', 'media_upload'
    amount NUMERIC(12, 2) NOT NULL,   -- Valor que CLIENT paga
    direction TEXT DEFAULT 'incoming', -- Sempre 'incoming' (plataforma recebe)
    ...
);

-- Billing de Hosts (HOST recebe ou paga)
host_billing (
    billing_id,
    host_id INTEGER NOT NULL,         -- FK → hosts
    campaign_id INTEGER,               -- FK → campaigns (se revenue share)
    totem_id INTEGER,                  -- FK → totems (se específico)
    subscription_id INTEGER,           -- FK → subscriptions (se subscription)
    billing_type TEXT,                 -- 'revenue_share', 'payout', 'subscription', 'platform_fee'
    amount NUMERIC(12, 2) NOT NULL,
    direction TEXT,                    -- 'outgoing' (HOST recebe) ou 'incoming' (HOST paga)
    revenue_share_percentage NUMERIC(5, 2), -- Se revenue share
    ...
);
```

**Vantagens:**
- ✅ Mais explícito e claro
- ✅ Constraints mais simples
- ✅ Queries mais diretas
- ✅ Melhor separação de responsabilidades

**Desvantagens:**
- ⚠️ Duas tabelas para gerenciar
- ⚠️ Relatórios consolidados precisam de UNION

#### **Opção 3: Tabela Unificada com Discriminação (Híbrida)**

```sql
billing (
    billing_id,
    
    -- Discriminador de tipo
    billing_entity_type TEXT NOT NULL, -- 'client' ou 'host'
    
    -- FK polimórfico (apenas um preenchido baseado em billing_entity_type)
    client_id INTEGER,  -- Preenchido se billing_entity_type = 'client'
    host_id INTEGER,    -- Preenchido se billing_entity_type = 'host'
    
    -- Contexto
    campaign_id INTEGER,
    totem_id INTEGER,
    subscription_id INTEGER,
    
    billing_type TEXT NOT NULL,
    direction TEXT NOT NULL,  -- 'incoming' (plataforma recebe) ou 'outgoing' (plataforma paga)
    amount NUMERIC(12, 2) NOT NULL,
    ...
    
    CONSTRAINT chk_billing_entity_type 
        CHECK (
            (billing_entity_type = 'client' AND client_id IS NOT NULL AND host_id IS NULL) OR
            (billing_entity_type = 'host' AND host_id IS NOT NULL AND client_id IS NULL)
        )
);
```

**Vantagens:**
- ✅ Uma tabela unificada
- ✅ Tipo explícito
- ✅ Facilita relatórios

**Desvantagens:**
- ⚠️ Ainda precisa de constraint CHECK
- ⚠️ Queries precisam filtrar por billing_entity_type

---

## 🔍 Análise de Casos de Uso

### Caso 1: Anunciante Paga por Campanha

```
CLIENT (Anunciante) → Paga R$ 1.000,00 → SmartSignage Pro (TENANT)
                                                      ↓
                                               Billing: incoming
                                               client_id = X
                                               billing_type = 'campaign'
                                               amount = 1000.00
```

### Caso 2: Host Recebe Revenue Share

```
CLIENT (Anunciante) → Paga R$ 1.000,00 → SmartSignage Pro (TENANT)
                                                      ↓
                                               SmartSignage retém 30%
                                               HOST recebe 70%
                                                      ↓
                                               Billing HOST: outgoing
                                               host_id = Y
                                               billing_type = 'revenue_share'
                                               amount = 700.00
                                               revenue_share_percentage = 70.00
```

### Caso 3: Host Paga Subscription

```
HOST → Paga R$ 500,00/mês → SmartSignage Pro (TENANT)
                                    ↓
                             Billing: incoming
                             host_id = Y
                             billing_type = 'subscription'
                             amount = 500.00
                             direction = 'incoming'
```

### Caso 4: Host Híbrido (Recebe % E Paga Subscription)

```
HOST pode:
- Receber revenue share de anúncios (outgoing da plataforma)
- Pagar subscription mensal (incoming da plataforma)
```

---

## 📊 Impacto em Outras Tabelas

### users

**Situação atual:**
```sql
users (
    id,
    client_id,  -- ❌ Confuso
    ...
)
```

**Correção necessária:**
```sql
users (
    id,
    host_id,  -- ✅ CORRETO! Users pertencem ao HOST
    ...
)
```

**Justificativa:**
- Users são **operadores do sistema** que pertencem ao HOST
- HOST é quem **instala e opera** os totens
- CLIENTs (anunciantes) **não têm users** no sistema (eles apenas criam campanhas)

### subscriptions

**Situação atual:**
```sql
subscriptions (
    subscription_id,
    client_id,  -- ❓
    plan_id,
    ...
)
```

**Análise:**
- Subscription pode ser de **HOST** (se modelo de negócio B - host paga)
- Subscription **não é de CLIENT** (anunciante não assina, apenas paga por campanhas)

**Correção necessária:**
```sql
subscriptions (
    subscription_id,
    host_id,  -- ✅ CORRETO! Subscription é do HOST
    plan_id,
    ...
)
```

**OU** se o sistema não usa subscription de HOST:
```sql
-- Remover subscription ou tornar opcional
subscriptions (
    subscription_id,
    host_id INTEGER,  -- Opcional, se HOST paga subscription
    plan_id,
    ...
)
```

### billing (Revisado)

Conforme análise acima, precisa suportar ambos CLIENT e HOST.

---

## ✅ Recomendações Finais

### 1. Estrutura de Billing (Recomendação: Opção 2 - Tabelas Separadas)

**Justificativa:**
- Mais clara e explícita
- Facilita queries e relatórios
- Melhor separação de responsabilidades
- Mais fácil de manter

### 2. Correções Imediatas Necessárias

1. **`users.client_id` → `users.host_id`**
   - Users pertencem ao HOST (tenant/operador)
   - CLIENTs não têm users

2. **`subscriptions.client_id` → `subscriptions.host_id`** (se aplicável)
   - Subscription é do HOST (se modelo de negócio B)

3. **`billing.client_id` → Reestruturar**
   - Criar `advertiser_billing` e `host_billing`
   - OU usar modelo polimórfico com discriminação

4. **`totems.client_id` → REMOVER**
   - Totem não pertence a anunciante
   - Totem pertence a HOST (via local_id)

### 3. Campos Adicionais Necessários

Se usar modelo de revenue share:
```sql
host_billing (
    ...
    revenue_share_percentage NUMERIC(5, 2),  -- % que host recebe
    original_campaign_amount NUMERIC(12, 2), -- Valor original da campanha
    platform_fee_amount NUMERIC(12, 2),      -- Valor que plataforma retém
    ...
);
```

### 4. Regras de Negócio a Definir

1. **Percentual de revenue share:** Fixo ou variável por host?
2. **Modelo híbrido:** Host pode receber % E pagar subscription?
3. **Aprovação de payouts:** Como aprovar pagamentos para hosts?
4. **Contratos:** Como armazenar regras contratuais de revenue share?

---

## 🎯 Próximos Passos

1. **Validar modelo de billing** - Qual opção escolher?
2. **Definir regras de revenue share** - Percentuais, contratos, etc.
3. **Criar migração** - Implementar mudanças no schema
4. **Atualizar código** - Backend e frontend

---

**Aguardando validação e decisões sobre modelo de billing antes de prosseguir com implementação!**

