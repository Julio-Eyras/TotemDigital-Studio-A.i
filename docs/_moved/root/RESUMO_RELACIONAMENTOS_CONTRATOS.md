# 📋 Resumo: Relacionamentos de Contratos

## ✅ **RESUMO EXECUTIVO**

### **Estrutura de Contratos:**

O sistema possui **DUAS tabelas de contratos independentes**:

1. **`subscriber_contracts`** → Contratos de ANUNCIANTES
2. **`publisher_contracts`** → Contratos de PUBLICADORES

---

## 📊 **SUBSCRIBER_CONTRACTS**

### **Relacionamentos:**

```
┌──────────────┐
│ SUBSCRIBERS  │
│              │
│ subscriber_  │
│   id (PK)    │
└──────┬───────┘
       │
       │ 1:N (OBRIGATÓRIO)
       │
       ▼
┌──────────────────────────┐
│ SUBSCRIBER_CONTRACTS     │
│                          │
│ - contract_id (PK)       │
│ - subscriber_id (FK) ✅  │←── OBRIGATÓRIO (sempre tem)
│ - plan_id (FK) ⚠️       │←── OPCIONAL (pode ser NULL)
│                          │
└──────┬───────────────────┘
       │
       │ N:1 (OPCIONAL)
       │ (apenas se plan_id não for NULL)
       │
       ▼
┌──────────────┐
│    PLANS     │
│              │
│ - plan_id    │
│   (PK)       │
└──────────────┘
```

### **Campos Importantes:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `subscriber_id` | INTEGER (FK) | ✅ **SIM** | ID do subscriber (anunciante) |
| `plan_id` | INTEGER (FK) | ⚠️ **OPCIONAL** | ID do plano associado (pode ser NULL) |
| `contract_type` | TEXT | ✅ SIM | 'advertising', 'subscription', 'partnership' |
| `status` | TEXT | ✅ SIM | 'draft', 'active', 'expired', 'terminated', 'cancelled' |

### **Regras:**

- ✅ **Todo contrato** DEVE estar vinculado a um `subscriber_id`
- ⚠️ **Pode ou não** estar vinculado a um `plan_id`
- ✅ Se tem `plan_id`, o sistema pode criar acessos automaticamente
- ✅ Se não tem `plan_id`, acessos devem ser criados manualmente

---

## 📊 **PUBLISHER_CONTRACTS**

### **Relacionamentos:**

```
┌──────────────┐
│ PUBLISHERS   │
│              │
│ publisher_   │
│   id (PK)    │
└──────┬───────┘
       │
       │ 1:N (OBRIGATÓRIO)
       │
       ▼
┌──────────────────────────┐
│ PUBLISHER_CONTRACTS      │
│                          │
│ - contract_id (PK)       │
│ - publisher_id (FK) ✅   │←── OBRIGATÓRIO (sempre tem)
│ ⚠️ NÃO tem plan_id      │←── NÃO relacionado a planos
│                          │
└──────────────────────────┘

⚠️ NÃO relacionado a PLANS
```

### **Campos Importantes:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `publisher_id` | INTEGER (FK) | ✅ **SIM** | ID do publisher (publicador) |
| `plan_id` | ❌ **NÃO EXISTE** | - | Publisher contracts NÃO têm plan_id |
| `contract_type` | TEXT | ✅ SIM | 'revenue_share', 'subscription', 'partnership', 'hybrid' |
| `revenue_share_percentage` | NUMERIC(5,2) | ⚠️ OPCIONAL | % que publisher recebe (ex: 70.00) |
| `subscription_amount` | NUMERIC(12,2) | ⚠️ OPCIONAL | Valor que publisher paga (se contract_type = 'subscription') |
| `status` | TEXT | ✅ SIM | 'draft', 'active', 'expired', 'terminated', 'cancelled' |

### **Regras:**

- ✅ **Todo contrato** DEVE estar vinculado a um `publisher_id`
- ❌ **NÃO tem** relacionamento com planos (`plan_id` não existe)
- ✅ Define termos de revenue share (publisher recebe %)
- ✅ Define termos de subscription (publisher paga valor fixo)
- ✅ Usado para calcular `publisher_billing` quando campanhas são executadas

---

## 🔄 **COMPARAÇÃO: Subscriber vs Publisher Contracts**

| Aspecto | SUBSCRIBER_CONTRACTS | PUBLISHER_CONTRACTS |
|---------|---------------------|---------------------|
| **Vinculação** | `subscriber_id` (FK obrigatório) | `publisher_id` (FK obrigatório) |
| **Plano** | `plan_id` (FK opcional) | ❌ Não tem `plan_id` |
| **Tipos** | 'advertising', 'subscription', 'partnership' | 'revenue_share', 'subscription', 'partnership', 'hybrid' |
| **Finalidade** | Subscriber compra espaço publicitário | Publisher vende espaço (recebe % ou paga subscription) |
| **Relacionamento com Plans** | ✅ Pode estar relacionado | ❌ Não relacionado |
| **Gera Acesso Automático?** | ✅ Se tem `plan_id` | ❌ Não gera acesso |

---

## 🎯 **EXEMPLOS PRÁTICOS**

### **Exemplo 1: Subscriber Contract COM Plan**

```sql
-- Contrato vinculado a subscriber e plano
INSERT INTO subscriber_contracts (
    subscriber_id,      -- ✅ OBRIGATÓRIO
    plan_id,            -- ✅ Preenchido (não NULL)
    contract_type,
    status
) VALUES (
    5,                  -- subscriber_id = 5
    1,                  -- plan_id = 1 (Plano Premium)
    'advertising',
    'active'
);

-- Sistema automaticamente cria:
-- subscriber_publisher_access para todos os publishers
-- permitidos no plan_id = 1
```

### **Exemplo 2: Subscriber Contract SEM Plan**

```sql
-- Contrato vinculado apenas a subscriber (sem plano)
INSERT INTO subscriber_contracts (
    subscriber_id,      -- ✅ OBRIGATÓRIO
    plan_id,            -- ⚠️ NULL (sem plano)
    contract_type,
    status
) VALUES (
    5,                  -- subscriber_id = 5
    NULL,               -- plan_id = NULL (sem plano)
    'partnership',
    'active'
);

-- Admin deve criar subscriber_publisher_access manualmente
-- ou usar outro mecanismo de controle de acesso
```

### **Exemplo 3: Publisher Contract**

```sql
-- Contrato de publisher (NÃO tem plan_id)
INSERT INTO publisher_contracts (
    publisher_id,           -- ✅ OBRIGATÓRIO
    contract_type,
    revenue_share_percentage,
    status
) VALUES (
    10,                     -- publisher_id = 10
    'revenue_share',
    70.00,                  -- Publisher recebe 70% do revenue
    'active'
);

-- ⚠️ NÃO tem plan_id (não relacionado a planos)
-- Usado para calcular revenue share quando campanhas são executadas
```

---

## 📋 **RESUMO DAS REGRAS**

### **Subscriber Contracts:**
1. ✅ **Sempre** tem `subscriber_id` (FK obrigatório)
2. ⚠️ **Pode ter** `plan_id` (FK opcional)
3. ✅ Se tem `plan_id`, pode gerar acessos automaticamente
4. ✅ Se não tem `plan_id`, acessos devem ser manuais

### **Publisher Contracts:**
1. ✅ **Sempre** tem `publisher_id` (FK obrigatório)
2. ❌ **NÃO tem** `plan_id` (não relacionado a planos)
3. ✅ Define termos de revenue share ou subscription
4. ✅ Usado para calcular billing quando campanhas são executadas

---

**Última atualização:** 2024-12-19
**Versão:** v2.0

