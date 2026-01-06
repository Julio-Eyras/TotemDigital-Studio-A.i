# Diagrama Visual: Relacionamento Subscriber → Contratos → Planos → Publishers

## 📊 **DIAGRAMA ENTIDADE-RELACIONAMENTO (ER)**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUBSCRIBERS                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ subscriber_id (PK)                                              │   │
│  │ name, email, phone, whatsapp, address                           │   │
│  │ is_active                                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SUBSCRIBER_CONTRACTS                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ contract_id (PK)                                                │   │
│  │ subscriber_id (FK) ───────────────┐                            │   │
│  │ plan_id (FK) ──────────────────────┼──┐                         │   │
│  │ contract_number, title, description                              │   │
│  │ start_date, end_date                                             │   │
│  │ status (draft, active, expired, ...)                            │   │
│  │ total_amount, currency                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ N:1
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PLANS                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ plan_id (PK)                                                     │   │
│  │ name, slug, description                                          │   │
│  │ price_monthly, price_yearly                                      │   │
│  │ features (JSONB) ──┐                                             │   │
│  │ limits (JSONB) ────┼─ Regras base definidas pelo Admin          │   │
│  │ is_active         │                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  PLAN_PUBLISHER_ACCESS                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ plan_id (FK) + publisher_id (FK) = PK                         │   │
│  │ is_allowed (true/false)                                        │   │
│  │ restrictions (JSONB) ──┐                                       │   │
│  │   - max_campaigns      │                                       │   │
│  │   - revenue_share_min  │ Restrições específicas por publisher │   │
│  │   - priority           │                                       │   │
│  │   - time_slots         ┘                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ N:1
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PUBLISHERS                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ publisher_id (PK)                                               │   │
│  │ name, email, phone, whatsapp                                    │   │
│  │ is_subscriber, is_publisher, client_type                        │   │
│  │ active                                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│              SUBSCRIBER_PUBLISHER_ACCESS                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ access_id (PK)                                                  │   │
│  │ subscriber_id (FK) ────────────┐                               │   │
│  │ publisher_id (FK) ──────────────┼──┐                            │   │
│  │ contract_id (FK) ───────────────┼──┼──┐                         │   │
│  │ plan_id (FK) ───────────────────┼──┼──┼──┐                      │   │
│  │ access_type (plan/contract/override)                            │   │
│  │ granted_at, expires_at, revoked_at                               │   │
│  │ is_active                                                        │   │
│  │ granted_by, notes, metadata                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ⚠️ Esta é a tabela que REALMENTE controla o acesso                    │
│  ⚠️ Pode ser criada automaticamente (via plano) ou manualmente         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 **FLUXO DE ACESSO (Passo a Passo)**

### **Cenário 1: Acesso Automático via Plano**

```
┌─────────────┐
│  Admin      │
└─────┬───────┘
      │
      │ 1. Cria Plano "Premium"
      ▼
┌─────────────────────────────────────┐
│  PLANS                               │
│  plan_id: 1                          │
│  name: "Premium"                     │
│  features: {max_campaigns: 50}       │
└─────┬───────────────────────────────┘
      │
      │ 2. Configura acesso a publishers
      ▼
┌─────────────────────────────────────┐
│  PLAN_PUBLISHER_ACCESS               │
│  plan_id: 1 → publisher_id: 1 ✅     │
│  plan_id: 1 → publisher_id: 2 ✅     │
│  restrictions: {max_campaigns: 10}  │
└─────────────────────────────────────┘
      │
      │ 3. Subscriber assina contrato
      ▼
┌─────────────────────────────────────┐
│  SUBSCRIBER_CONTRACTS                │
│  subscriber_id: 1                    │
│  contract_id: 10                     │
│  plan_id: 1 ────────────────────────┼──┐
│  status: 'active'                    │  │
└─────────────────────────────────────┘  │
                                         │
      │ 4. Sistema cria acesso automaticamente
      ▼                                  │
┌─────────────────────────────────────┐ │
│  SUBSCRIBER_PUBLISHER_ACCESS         │ │
│  subscriber_id: 1                    │ │
│  publisher_id: 1                     │ │
│  plan_id: 1 ─────────────────────────┘ │
│  access_type: 'plan'                  │
│  (criado automaticamente)             │
│                                       │
│  subscriber_id: 1                    │
│  publisher_id: 2                     │
│  plan_id: 1 ─────────────────────────┘
│  access_type: 'plan'
└─────────────────────────────────────┘
```

### **Cenário 2: Acesso Manual via Contrato**

```
┌─────────────┐
│  Admin      │
└─────┬───────┘
      │
      │ 1. Cria contrato sem plano
      ▼
┌─────────────────────────────────────┐
│  SUBSCRIBER_CONTRACTS                │
│  subscriber_id: 2                    │
│  contract_id: 20                     │
│  plan_id: NULL ──────────────────────┼──┐
│  status: 'active'                    │  │
└─────────────────────────────────────┘  │
                                         │
      │ 2. Admin concede acesso manual
      ▼                                  │
┌─────────────────────────────────────┐ │
│  SUBSCRIBER_PUBLISHER_ACCESS         │ │
│  subscriber_id: 2                    │ │
│  publisher_id: 3                     │ │
│  contract_id: 20 ────────────────────┘ │
│  access_type: 'contract'             │
│  (criado manualmente)                │
└─────────────────────────────────────┘
```

### **Cenário 3: Override (Sobrescreve Plano)**

```
┌─────────────────────────────────────┐
│  SUBSCRIBER_CONTRACTS                │
│  subscriber_id: 3                    │
│  contract_id: 30                     │
│  plan_id: 2 (Plano "Standard")       │
│  status: 'active'                    │
└─────┬───────────────────────────────┘
      │
      │ Plano "Standard" permite:
      │ - Publisher A ✅
      │ - Publisher B ✅
      │
      │ Admin quer dar acesso extra:
      ▼
┌─────────────────────────────────────┐
│  SUBSCRIBER_PUBLISHER_ACCESS         │
│  subscriber_id: 3                    │
│  publisher_id: 1 (Publisher A)      │
│  plan_id: 2                          │
│  access_type: 'plan' ──┐             │
│                        │             │
│  subscriber_id: 3      │             │
│  publisher_id: 2 (Publisher B)      │
│  plan_id: 2                          │
│  access_type: 'plan' ──┼─ Automático │
│                        │             │
│  subscriber_id: 3      │             │
│  publisher_id: 3 (Publisher C)      │
│  access_type: 'override' ───────────┘
│  (criado manualmente, não está no plano)
└─────────────────────────────────────┘
```

---

## 🎯 **PRIORIDADE DE VALIDAÇÃO**

A função `check_subscriber_publisher_access` valida nesta ordem:

```
┌─────────────────────────────────────────────────────────┐
│  VALIDAÇÃO DE ACESSO                                     │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Prioridade 1:        │
        │  Acesso Explícito     │
        │  (contract/override)  │
        └───────────┬───────────┘
                    │
                    │ Se não encontrou
                    ▼
        ┌───────────────────────┐
        │  Prioridade 2:        │
        │  Acesso via Plano     │
        │  (herdado do contrato)│
        └───────────┬───────────┘
                    │
                    │ Se não encontrou
                    ▼
        ┌───────────────────────┐
        │  Resultado:           │
        │  SEM ACESSO ❌         │
        └───────────────────────┘
```

---

## 📋 **RESUMO DOS RELACIONAMENTOS**

| Relacionamento | Cardinalidade | Tabela de Junção | Observações |
|----------------|---------------|------------------|-------------|
| **Subscriber → Contratos** | 1:N | `subscriber_contracts` | Um subscriber pode ter múltiplos contratos ativos |
| **Contrato → Plano** | N:1 | `subscriber_contracts.plan_id` | Um contrato está vinculado a um plano (ou NULL) |
| **Plano → Publishers** | 1:N | `plan_publisher_access` | Um plano pode permitir acesso a múltiplos publishers |
| **Subscriber → Publishers** | N:M | `subscriber_publisher_access` | Acesso real controlado aqui |
| **Contrato → Acesso** | 1:N | `subscriber_publisher_access.contract_id` | Um contrato pode gerar múltiplos acessos |

---

## ✅ **VALIDAÇÕES IMPLEMENTADAS**

### **1. Validação Temporal:**
- ✅ `subscriber_contracts.start_date <= CURRENT_DATE`
- ✅ `subscriber_contracts.end_date >= CURRENT_DATE` (ou NULL)
- ✅ `subscriber_contracts.status = 'active'`
- ✅ `subscriber_publisher_access.expires_at > CURRENT_TIMESTAMP` (ou NULL)
- ✅ `subscriber_publisher_access.revoked_at IS NULL`

### **2. Validação de Status:**
- ✅ `subscribers.is_active = true`
- ✅ `publishers.active = true`
- ✅ `plans.is_active = true`
- ✅ `subscriber_publisher_access.is_active = true`

### **3. Validação de Acesso:**
- ✅ `plan_publisher_access.is_allowed = true`
- ✅ Função SQL `check_subscriber_publisher_access()` valida tudo

---

## 🔧 **IMPLEMENTAÇÃO ATUAL**

### **Backend Services:**

1. **`SubscriberAccessService`**
   - `hasAccess(subscriberId, publisherId)` - Valida acesso
   - `getAccessiblePublishers(subscriberId)` - Lista publishers acessíveis
   - `grantAccess(...)` - Concede acesso manual
   - `setPlanPublisherAccess(...)` - Configura plano → publisher

2. **`SubscriberAccessNotificationService`**
   - Monitora acessos expirando
   - Envia notificações (7, 15, 30 dias antes)

3. **`CampaignService`**
   - Valida acesso antes de criar/atualizar campanha
   - `validateCampaignPublishers(...)`

### **Frontend:**

1. **`PlanPublisherAccess.tsx`**
   - Gerencia `plan_publisher_access`
   - Configura quais publishers cada plano permite

2. **`SubscriberPublisherAccess.tsx`**
   - Gerencia `subscriber_publisher_access`
   - Concede/revoga acesso manual

3. **`SubscriberAccessExpiring.tsx`**
   - Dashboard de acessos expirando

4. **`Campaigns.tsx`**
   - Filtra publishers baseado no acesso do subscriber
   - Valida antes de criar campanha

---

## 🎓 **CONCLUSÃO**

O modelo v2.0 implementa corretamente:

✅ **1 Subscriber → N Contratos**  
✅ **1 Contrato → 1 Plano**  
✅ **1 Plano → N Publishers** (via `plan_publisher_access`)  
✅ **Regras base definidas pelo Admin** (em `plans` e `plan_publisher_access`)  
✅ **Acesso real controlado por `subscriber_publisher_access`**  
✅ **Validação hierárquica** (Override > Contrato > Plano)  
✅ **Controle temporal** (datas de validade)  
✅ **Múltiplos contratos por subscriber**  

O sistema é **flexível** e permite tanto acesso automático (via planos) quanto manual (via contratos ou override).

