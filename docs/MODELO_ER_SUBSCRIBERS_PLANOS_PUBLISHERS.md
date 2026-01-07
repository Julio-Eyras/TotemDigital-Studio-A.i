# Modelo E.R: Subscribers, Planos e Publishers

## 📋 Visão Geral

Este documento explica o modelo Entidade-Relacionamento (E.R) atual do sistema SmartSignage Pro, focando na relação entre **Subscribers (Assinantes)**, **Planos** e **Publishers (Publicadores)**.

---

## 🏗️ Estrutura do Modelo E.R

### 1. **SUBSCRIBERS (Assinantes/Anunciantes)**

**Tabela:** `subscribers`

**Descrição:** Representa os anunciantes/assinantes que compram espaço publicitário no sistema.

**Campos Principais:**
- `subscriber_id` (PK) - Identificador único
- `name` - Nome/razão social
- `contact_name` - Nome do contato
- `email` - Email único
- `phone`, `whatsapp` - Contatos
- `address` - Endereço
- `description` - Descrição/observações
- `is_active` - Status ativo/inativo

**Relacionamentos:**
- **1:N** com `subscriber_contracts` (um subscriber pode ter múltiplos contratos)
- **N:M** com `publishers` via `subscriber_publisher_access` (acesso a publishers)
- **1:N** com `locals` (um subscriber pode ter múltiplos locais)

---

### 2. **PLANS (Planos)**

**Tabela:** `plans`

**Descrição:** Define os planos de assinatura disponíveis no sistema, com características, valores e períodos.

**Campos Principais:**
- `plan_id` (PK) - Identificador único
- `name` - Nome do plano
- `slug` - Identificador único textual
- `description` - Descrição do plano
- `price_monthly` - Preço mensal
- `price_yearly` - Preço anual (opcional)
- `currency` - Moeda (padrão: BRL)
- `billing_interval` - Intervalo de cobrança (month/year)
- `features` (JSONB) - Features do plano
- `limits` (JSONB) - Limites do plano (ex: totems, campaigns, storage_gb)
- `is_active` - Plano ativo/inativo
- `is_popular` - Destaque do plano
- `sort_order` - Ordem de exibição

**Exemplo de `limits` (JSONB):**
```json
{
  "totems": 10,
  "campaigns": 50,
  "storage_gb": 100,
  "max_duration_seconds": 60
}
```

**Relacionamentos:**
- **1:N** com `subscriber_contracts` (um plano pode estar em múltiplos contratos)
- **N:M** com `publishers` via `plan_publisher_access` (publishers incluídos no plano)
- **1:N** com `subscriber_publisher_access` (acessos herdados do plano)

---

### 3. **SUBSCRIBER_CONTRACTS (Contratos de Subscribers)**

**Tabela:** `subscriber_contracts`

**Descrição:** Representa os contratos assinados pelos subscribers, vinculando um subscriber a um plano com período válido e valores.

**Campos Principais:**
- `contract_id` (PK) - Identificador único
- `subscriber_id` (FK) - Subscriber que assinou o contrato
- `plan_id` (FK) - Plano associado ao contrato
- `contract_number` - Número único do contrato
- `contract_type` - Tipo: 'advertising', 'subscription', 'partnership'
- `title` - Título do contrato
- `description` - Descrição
- `start_date` - Data de início
- `end_date` - Data de término (NULL = sem expiração)
- `total_amount` - Valor total do contrato
- `currency` - Moeda (padrão: BRL)
- `payment_terms` - Condições de pagamento
- `document_path` - Caminho do arquivo PDF/DOC/DOCX
- `status` - Status: 'draft', 'active', 'expired', 'terminated', 'cancelled'
- `signed_by_subscriber_at` - Data de assinatura pelo subscriber
- `signed_by_tenant_at` - Data de assinatura pelo tenant
- `metadata` (JSONB) - Termos adicionais, cláusulas

**Relacionamentos:**
- **N:1** com `subscribers` (múltiplos contratos por subscriber)
- **N:1** com `plans` (múltiplos contratos podem usar o mesmo plano)
- **1:N** com `subscriber_publisher_access` (contrato gera acessos)

**⚠️ IMPORTANTE:** Um subscriber pode ter **múltiplos contratos ativos simultaneamente**, cada um vinculado a um plano diferente.

---

### 4. **PLAN_PUBLISHER_ACCESS (Publishers Incluídos no Plano)**

**Tabela:** `plan_publisher_access`

**Descrição:** Define quais publishers estão incluídos em cada plano (configuração base do plano).

**Campos Principais:**
- `plan_id` (FK, parte da PK) - Plano
- `publisher_id` (FK, parte da PK) - Publisher incluído
- `is_allowed` - Se false, bloqueia explicitamente o acesso
- `restrictions` (JSONB) - Restrições específicas do plano para este publisher
- `notes` - Observações
- `created_at`, `updated_at` - Timestamps

**Exemplo de `restrictions` (JSONB):**
```json
{
  "max_campaigns": 10,
  "revenue_share_min": 5,
  "priority": "high",
  "time_slots": ["08:00-18:00"]
}
```

**Relacionamentos:**
- **N:1** com `plans` (múltiplos publishers por plano)
- **N:1** com `publishers` (um publisher pode estar em múltiplos planos)

**⚠️ IMPORTANTE:** Esta tabela define a **configuração base** do plano. Quando um subscriber contrata um plano, os acessos são criados automaticamente em `subscriber_publisher_access`.

---

### 5. **SUBSCRIBER_PUBLISHER_ACCESS (Controle de Acesso Subscriber → Publisher)**

**Tabela:** `subscriber_publisher_access`

**Descrição:** Gerencia o acesso efetivo de subscribers a publishers, com base em planos ou contratos específicos.

**Campos Principais:**
- `access_id` (PK) - Identificador único
- `subscriber_id` (FK) - Subscriber
- `publisher_id` (FK) - Publisher acessível
- `contract_id` (FK, nullable) - Contrato que gerou o acesso (NULL = acesso direto do plano)
- `plan_id` (FK, nullable) - Plano base (para auditoria)
- `access_type` - Tipo: 'plan' (herdado), 'contract' (via contrato), 'override' (manual)
- `granted_at` - Data de concessão
- `expires_at` - Data de expiração (NULL = sem expiração)
- `revoked_at` - Data de revogação
- `is_active` - Status ativo/inativo
- `granted_by` (FK para users) - Quem concedeu o acesso
- `notes` - Observações
- `metadata` (JSONB) - Metadados adicionais

**Relacionamentos:**
- **N:1** com `subscribers` (múltiplos acessos por subscriber)
- **N:1** com `publishers` (múltiplos acessos por publisher)
- **N:1** com `subscriber_contracts` (acesso pode vir de um contrato específico)
- **N:1** com `plans` (acesso pode vir de um plano)

**⚠️ IMPORTANTE:** Esta é a tabela que **efetivamente controla** quais publishers um subscriber pode acessar. Os acessos podem ser:
- **Herdados do plano** (`access_type = 'plan'`) - Criados automaticamente quando o plano é contratado
- **Definidos no contrato** (`access_type = 'contract'`) - Específicos do contrato
- **Sobrescritos manualmente** (`access_type = 'override'`) - Ajustes manuais

---

### 6. **PUBLISHERS (Publicadores)**

**Tabela:** `publishers`

**Descrição:** Representa os publicadores que possuem totens/Smart TVs e vendem espaço publicitário.

**Campos Principais:**
- `publisher_id` (PK) - Identificador único
- `name` - Nome/razão social
- `contact_name` - Nome do contato
- `email` - Email
- `phone`, `whatsapp` - Contatos
- `address` - Endereço
- `description` - Descrição
- `is_active` - Status ativo/inativo

**Relacionamentos:**
- **N:M** com `plans` via `plan_publisher_access` (publishers incluídos em planos)
- **N:M** com `subscribers` via `subscriber_publisher_access` (subscribers com acesso)
- **1:N** com `locals` (um publisher pode ter múltiplos locais)

---

## 🔗 Diagrama de Relacionamentos

```
┌─────────────────┐
│   SUBSCRIBERS   │
│  (Assinantes)   │
└────────┬────────┘
         │
         │ 1:N
         │
         ▼
┌─────────────────────────┐
│ SUBSCRIBER_CONTRACTS    │
│ (Contratos)             │
│ - start_date            │
│ - end_date              │
│ - total_amount          │
│ - status                │
└────────┬────────────────┘
         │
         │ N:1
         │
         ▼
┌─────────────────┐
│     PLANS       │
│   (Planos)      │
│ - price_monthly │
│ - price_yearly  │
│ - features      │
│ - limits         │
└────────┬────────┘
         │
         │ N:M
         │
         ▼
┌─────────────────────────┐
│ PLAN_PUBLISHER_ACCESS   │
│ (Publishers no Plano)   │
│ - is_allowed            │
│ - restrictions          │
└────────┬────────────────┘
         │
         │ N:1
         │
         ▼
┌─────────────────┐
│   PUBLISHERS    │
│ (Publicadores)  │
└─────────────────┘
         ▲
         │
         │ N:M
         │
┌─────────────────────────┐
│ SUBSCRIBER_PUBLISHER_   │
│ ACCESS                  │
│ (Acesso Efetivo)        │
│ - access_type           │
│ - granted_at            │
│ - expires_at            │
│ - is_active             │
└────────┬────────────────┘
         │
         │ N:1
         │
         ▼
┌─────────────────┐
│   SUBSCRIBERS   │
│  (Assinantes)   │
└─────────────────┘
```

---

## 📊 Fluxo de Funcionamento

### 1. **Criação de um Plano**
1. Um plano é criado em `plans` com características, valores e limites
2. Publishers são associados ao plano em `plan_publisher_access`
3. Restrições específicas podem ser definidas por publisher

### 2. **Contratação de um Plano por um Subscriber**
1. Um contrato é criado em `subscriber_contracts`:
   - Vincula `subscriber_id` ao `plan_id`
   - Define `start_date` e `end_date` (período válido)
   - Define `total_amount` (valor)
   - Status inicial: 'draft' ou 'active'

2. Quando o contrato é ativado, acessos são criados automaticamente em `subscriber_publisher_access`:
   - Para cada publisher em `plan_publisher_access` do plano contratado
   - `access_type = 'contract'` ou `'plan'`
   - `contract_id` aponta para o contrato
   - `expires_at` pode ser herdado do `end_date` do contrato

### 3. **Acesso a Publishers**
- Um subscriber pode acessar publishers através de:
  - **Acessos herdados do plano** (`access_type = 'plan'`)
  - **Acessos via contrato** (`access_type = 'contract'`)
  - **Acessos sobrescritos manualmente** (`access_type = 'override'`)

### 4. **Múltiplos Contratos Simultâneos**
- Um subscriber pode ter **múltiplos contratos ativos** ao mesmo tempo
- Cada contrato pode estar vinculado a um plano diferente
- Os acessos são **combinados** (união) - o subscriber tem acesso a todos os publishers de todos os planos contratados

---

## ✅ Características do Modelo

### ✅ **Subscriber pode contratar múltiplos planos**
- Sim! Um subscriber pode ter múltiplos contratos (`subscriber_contracts`) ativos simultaneamente
- Cada contrato vincula um `subscriber_id` a um `plan_id` diferente

### ✅ **Planos possuem características (valores, períodos válidos)**
- **Valores:** `price_monthly`, `price_yearly`, `total_amount` (no contrato)
- **Períodos válidos:** `start_date` e `end_date` no contrato
- **Características:** `features` e `limits` (JSONB) no plano

### ✅ **Planos incluem publishers**
- Sim! A tabela `plan_publisher_access` define quais publishers estão incluídos em cada plano
- Quando um subscriber contrata um plano, os acessos são criados automaticamente

### ✅ **Controle de acesso granular**
- A tabela `subscriber_publisher_access` controla efetivamente quais publishers um subscriber pode acessar
- Suporta acessos temporários (`expires_at`)
- Suporta revogação (`revoked_at`)
- Suporta diferentes tipos de acesso (plan, contract, override)

---

## 🔍 Exemplos de Consultas Úteis

### Listar todos os planos contratados por um subscriber
```sql
SELECT 
    sc.contract_id,
    sc.contract_number,
    sc.start_date,
    sc.end_date,
    sc.total_amount,
    sc.status,
    p.name AS plan_name,
    p.price_monthly,
    p.price_yearly
FROM subscriber_contracts sc
JOIN plans p ON sc.plan_id = p.plan_id
WHERE sc.subscriber_id = :subscriber_id
  AND sc.status = 'active';
```

### Listar todos os publishers acessíveis por um subscriber
```sql
SELECT DISTINCT
    pub.publisher_id,
    pub.name AS publisher_name,
    spa.access_type,
    spa.granted_at,
    spa.expires_at,
    spa.is_active
FROM subscriber_publisher_access spa
JOIN publishers pub ON spa.publisher_id = pub.publisher_id
WHERE spa.subscriber_id = :subscriber_id
  AND spa.is_active = true
  AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
  AND spa.revoked_at IS NULL;
```

### Listar publishers incluídos em um plano
```sql
SELECT 
    pub.publisher_id,
    pub.name AS publisher_name,
    ppa.is_allowed,
    ppa.restrictions
FROM plan_publisher_access ppa
JOIN publishers pub ON ppa.publisher_id = pub.publisher_id
WHERE ppa.plan_id = :plan_id
  AND ppa.is_allowed = true;
```

---

## 📝 Notas Importantes

1. **Um subscriber pode ter múltiplos contratos ativos simultaneamente** - cada um vinculado a um plano diferente
2. **Os acessos são combinados** - se um subscriber tem 2 contratos ativos, ele tem acesso a todos os publishers de ambos os planos
3. **Acessos podem expirar** - `expires_at` em `subscriber_publisher_access` controla a validade do acesso
4. **Acessos podem ser revogados** - `revoked_at` marca quando um acesso foi revogado
5. **Restrições por publisher** - `plan_publisher_access.restrictions` permite definir limites específicos por publisher dentro de um plano

---

## 🎯 Conclusão

O modelo E.R atual **já suporta corretamente** a funcionalidade descrita:

✅ Subscribers podem contratar um ou mais planos  
✅ Planos possuem características (valores, períodos válidos)  
✅ Planos incluem publishers  
✅ Controle de acesso granular e temporal  

O modelo está bem estruturado e permite flexibilidade para diferentes cenários de negócio.
