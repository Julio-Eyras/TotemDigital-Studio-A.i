# Modelo ER e Operações: Subscribers, Publishers e Contratos

## 🏗️ **MODELO ENTIDADE-RELACIONAMENTO (ER)**

### **⚠️ IMPORTANTE: Estrutura de Contratos**

Existem **DUAS tabelas de contratos separadas**:

1. **`subscriber_contracts`** → Contratos de ANUNCIANTES
   - ✅ **Sempre** relacionado a um `subscriber_id` (FK obrigatório)
   - ✅ **Pode** estar relacionado a um `plan_id` (FK opcional)
   
2. **`publisher_contracts`** → Contratos de PUBLICADORES
   - ✅ **Sempre** relacionado a um `publisher_id` (FK obrigatório)
   - ❌ **NÃO** relacionado a planos (não tem `plan_id`)

### **Diagrama Completo:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ADMINISTRATOR                                │
│  (role: 'admin' ou 'admin_sql')                                            │
│  - Cria Publishers                                                          │
│  - Cria Planos                                                              │
│  - Configura plan_publisher_access                                          │
│  - Aprova/Rejeita Contratos                                                 │
│  - Gerencia Acessos (subscriber_publisher_access)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                             │
        ▼                                             ▼
┌───────────────┐                          ┌───────────────┐
│  SUBSCRIBERS  │                          │  PUBLISHERS   │
│ (Anunciantes) │                          │ (Publicadores)│
│               │                          │               │
│ - subscriber_ │                          │ - publisher_  │
│   id (PK)     │                          │   id (PK)     │
│ - name        │                          │ - name        │
│ - email       │                          │ - email       │
│ - phone       │                          │ - phone       │
│ - is_active   │                          │ - active      │
└───────┬───────┘                          └───────┬───────┘
        │                                             │
        │ 1:N                                         │ 1:N
        │                                             │
        ▼                                             ▼
┌──────────────────┐                      ┌──────────────────┐
│ SUBSCRIBER_      │                      │ PUBLISHER_       │
│ CONTRACTS        │                      │ CONTRACTS        │
│                  │                      │                  │
│ - contract_id    │                      │ - contract_id    │
│ - subscriber_id  │◄─── OBRIGATÓRIO      │ - publisher_id   │◄─── OBRIGATÓRIO
│   (FK)           │                      │   (FK)           │
│ - plan_id        │◄─── OPCIONAL         │ - contract_type  │
│   (FK)           │   (pode ser NULL)    │   (revenue_share,│
│ - contract_type  │                      │    subscription, │
│ - status         │                      │    hybrid)        │
│ - start_date     │                      │ - revenue_share_% │
│ - end_date       │                      │ - subscription_ │
│                  │                      │   amount         │
│ OPERAÇÕES:       │                      │ - status         │
│ - Criar: Admin   │                      │ - start_date     │
│ - Editar: Admin  │                      │ - end_date       │
│ - Ver: Admin +   │                      │                  │
│   Subscriber     │                      │ ⚠️ NÃO tem       │
│ - Assinar:       │                      │   plan_id        │
│   Subscriber     │                      │                  │
└───────┬──────────┘                      │ OPERAÇÕES:       │
        │                                 │ - Criar: Admin   │
        │ N:1 (opcional)                  │ - Editar: Admin  │
        │                                 │ - Ver: Admin +   │
        ▼                                 │   Publisher      │
┌──────────────────┐                      │ - Assinar:       │
│     PLANS        │                      │   Publisher      │
│                  │                      └──────────────────┘
│ - plan_id        │                      (NÃO relacionado a PLANS)
│ - name           │
│ - price_monthly  │
│ - features       │
│ - limits         │
│                  │
│ OPERAÇÕES:       │
│ - Criar: Admin   │
│ - Editar: Admin  │
│ - Ver: Todos     │
│ - Deletar: Admin │
└───────┬──────────┘
│                  │
│ - plan_id        │
│ - name           │
│ - price_monthly  │
│ - features       │
│ - limits         │
│                  │
│ OPERAÇÕES:       │
│ - Criar: Admin   │
│ - Editar: Admin  │
│ - Ver: Todos     │
│ - Deletar: Admin │
└───────┬──────────┘
        │
        │ 1:N
        │
        ▼
┌──────────────────────────────┐
│  PLAN_PUBLISHER_ACCESS        │
│                              │
│ - plan_id (FK)               │
│ - publisher_id (FK)         │
│ - is_allowed                 │
│ - restrictions (JSONB)       │
│                              │
│ OPERAÇÕES:                   │
│ - Criar: Admin               │
│ - Editar: Admin              │
│ - Ver: Admin                 │
│ - Deletar: Admin             │
└──────────────┬───────────────┘
               │
               │ N:1
               │
               ▼
┌──────────────────────────────┐
│  SUBSCRIBER_PUBLISHER_ACCESS │
│  (Acesso Real)               │
│                              │
│ - access_id                  │
│ - subscriber_id (FK)         │
│ - publisher_id (FK)          │
│ - contract_id (FK)           │
│ - plan_id (FK)               │
│ - access_type                │
│ - is_active                  │
│                              │
│ OPERAÇÕES:                   │
│ - Criar: Admin (manual) OU   │
│   Sistema (automático)       │
│ - Editar: Admin              │
│ - Revogar: Admin             │
│ - Ver: Admin + Subscriber    │
└──────────────────────────────┘
```

---

## 👤 **QUEM PODE OPERAR O QUÊ**

### **1. SYSTEM ADMINISTRATOR (role: 'admin' ou 'admin_sql')**

#### **Operações Permitidas:**

##### **✅ SUBSCRIBERS:**
- ✅ **Criar** novos subscribers
- ✅ **Editar** qualquer subscriber
- ✅ **Deletar** subscribers (soft delete)
- ✅ **Ver** todos os subscribers
- ✅ **Ativar/Desativar** subscribers

##### **✅ PUBLISHERS:**
- ✅ **Criar** novos publishers
- ✅ **Editar** qualquer publisher
- ✅ **Deletar** publishers (soft delete)
- ✅ **Ver** todos os publishers
- ✅ **Ativar/Desativar** publishers

##### **✅ LOCALS (de qualquer publisher):**
- ✅ **Criar** locals para qualquer publisher
- ✅ **Editar** locals de qualquer publisher
- ✅ **Deletar** locals de qualquer publisher
- ✅ **Ver** todos os locals
- ✅ **Aprovar** locals pendentes

##### **✅ TOTEMS (de qualquer publisher):**
- ✅ **Criar** totens em locals de qualquer publisher
- ✅ **Editar** totens de qualquer publisher
- ✅ **Deletar** totens de qualquer publisher
- ✅ **Ver** todos os totens
- ✅ **Aprovar** totens pendentes

##### **✅ SMART TVs (de qualquer publisher):**
- ✅ **Criar** smart TVs em totens de qualquer publisher
- ✅ **Editar** smart TVs de qualquer publisher
- ✅ **Deletar** smart TVs de qualquer publisher
- ✅ **Ver** todas as smart TVs

##### **✅ PLANOS:**
- ✅ **Criar** novos planos
- ✅ **Editar** planos existentes
- ✅ **Deletar** planos
- ✅ **Ver** todos os planos
- ✅ **Configurar** features e limits (JSONB)

##### **✅ PLAN_PUBLISHER_ACCESS:**
- ✅ **Criar** configurações de acesso (plano → publisher)
- ✅ **Editar** restrições por publisher
- ✅ **Deletar** configurações
- ✅ **Ver** todas as configurações

##### **✅ SUBSCRIBER_CONTRACTS:**
- ✅ **Criar** contratos para qualquer subscriber
- ✅ **Editar** contratos existentes
- ✅ **Aprovar/Rejeitar** contratos
- ✅ **Assinar** contratos (como tenant)
- ✅ **Ver** todos os contratos
- ✅ **Terminar/Cancelar** contratos

##### **✅ PUBLISHER_CONTRACTS:**
- ✅ **Criar** contratos para qualquer publisher
- ✅ **Editar** contratos existentes
- ✅ **Aprovar/Rejeitar** contratos
- ✅ **Assinar** contratos (como tenant)
- ✅ **Ver** todos os contratos
- ✅ **Terminar/Cancelar** contratos

##### **✅ SUBSCRIBER_PUBLISHER_ACCESS:**
- ✅ **Criar** acessos manualmente (override)
- ✅ **Editar** acessos existentes
- ✅ **Revogar** acessos
- ✅ **Ver** todos os acessos
- ✅ **Conceder** acesso temporário

##### **✅ OUTRAS OPERAÇÕES:**
- ✅ **Gerenciar** usuários do sistema
- ✅ **Gerenciar** roles e permissões
- ✅ **Ver** todos os dados (sem isolamento)
- ✅ **Acessar** todas as rotas administrativas

---

### **2. SUBSCRIBER USER (role: 'subscriber' ou 'client')**

#### **Contexto:**
- Usuário vinculado a um `subscriber_id` específico
- Só pode ver e gerenciar dados do seu próprio subscriber
- Isolamento automático de dados via middleware

#### **Operações Permitidas:**

##### **✅ SUBSCRIBER (Próprio):**
- ✅ **Ver** informações do próprio subscriber
- ❌ **NÃO pode editar** dados do subscriber (apenas admin)
- ❌ **NÃO pode criar** novos subscribers

##### **✅ SUBSCRIBER_CONTRACTS (Próprios):**
- ✅ **Ver** contratos do próprio subscriber
- ✅ **Assinar** contratos (quando status = 'draft')
- ❌ **NÃO pode criar** contratos (apenas admin)
- ❌ **NÃO pode editar** contratos (apenas admin)
- ✅ **Ver** status e datas de validade

##### **✅ CAMPANHAS:**
- ✅ **Criar** campanhas para o próprio subscriber
- ✅ **Editar** campanhas do próprio subscriber
- ✅ **Deletar** campanhas do próprio subscriber
- ✅ **Ver** apenas campanhas do próprio subscriber
- ✅ **Ativar/Pausar** campanhas próprias

##### **✅ MÍDIA:**
- ✅ **Upload** de mídia para o próprio subscriber
- ✅ **Editar** mídia do próprio subscriber
- ✅ **Deletar** mídia do próprio subscriber
- ✅ **Ver** apenas mídia do próprio subscriber

##### **✅ PLAYLISTS:**
- ✅ **Criar** playlists para o próprio subscriber
- ✅ **Editar** playlists do próprio subscriber
- ✅ **Deletar** playlists do próprio subscriber
- ✅ **Ver** apenas playlists do próprio subscriber

##### **✅ SUBSCRIBER_PUBLISHER_ACCESS:**
- ✅ **Ver** acessos do próprio subscriber
- ✅ **Ver** publishers disponíveis (baseado em acessos ativos)
- ❌ **NÃO pode criar** acessos (apenas admin)
- ❌ **NÃO pode revogar** acessos (apenas admin)

##### **✅ PUBLISHERS:**
- ✅ **Ver** apenas publishers que têm acesso ativo
- ✅ **Ver** informações básicas (nome, contato)
- ❌ **NÃO pode ver** locals, totens, smart TVs
- ❌ **NÃO pode criar/editar** publishers

##### **✅ BILLING:**
- ✅ **Ver** faturas do próprio subscriber
- ✅ **Ver** histórico de pagamentos
- ❌ **NÃO pode criar** faturas (sistema cria automaticamente)

##### **❌ OPERAÇÕES NEGADAS:**
- ❌ **NÃO pode** criar/editar/deletar publishers
- ❌ **NÃO pode** criar/editar/deletar planos
- ❌ **NÃO pode** criar/editar/deletar `plan_publisher_access`
- ❌ **NÃO pode** criar/editar/deletar `subscriber_publisher_access` (exceto ver)
- ❌ **NÃO pode** ver dados de outros subscribers
- ❌ **NÃO pode** ver locals, totens, smart TVs

---

### **3. PUBLISHER USER (role: 'publisher')**

#### **Contexto:**
- Usuário vinculado a um `publisher_id` específico
- Só pode ver e gerenciar dados do seu próprio publisher
- Isolamento automático de dados via middleware

#### **Operações Permitidas:**

##### **✅ PUBLISHER (Próprio):**
- ✅ **Ver** informações do próprio publisher
- ❌ **NÃO pode editar** dados do publisher (apenas admin)
- ❌ **NÃO pode criar** novos publishers

##### **✅ PUBLISHER_CONTRACTS (Próprios):**
- ✅ **Ver** contratos do próprio publisher
- ✅ **Assinar** contratos (quando status = 'draft')
- ❌ **NÃO pode criar** contratos (apenas admin)
- ❌ **NÃO pode editar** contratos (apenas admin)
- ✅ **Ver** termos de revenue share e subscription

##### **✅ LOCALS:**
- ❌ **NÃO pode criar** locals (apenas admin)
- ❌ **NÃO pode editar** locals (apenas admin)
- ❌ **NÃO pode deletar** locals (apenas admin)
- ✅ **Ver** apenas locals do próprio publisher

##### **✅ TOTEMS:**
- ❌ **NÃO pode criar** totens (apenas admin)
- ❌ **NÃO pode editar** totens (apenas admin)
- ❌ **NÃO pode deletar** totens (apenas admin)
- ✅ **Ver** apenas totens do próprio publisher
- ❌ **NÃO pode aprovar** totens pendentes (apenas admin)

##### **✅ SMART TVs:**
- ❌ **NÃO pode criar** smart TVs (apenas admin)
- ❌ **NÃO pode editar** smart TVs (apenas admin)
- ❌ **NÃO pode deletar** smart TVs (apenas admin)
- ✅ **Ver** apenas smart TVs do próprio publisher e do próprio totem

##### **✅ CAMPANHAS (Visualização):**
- ✅ **Ver** campanhas ativas nos seus totens
- ✅ **Ver** campanhas vinculadas ao publisher (via `campaign_publishers`)
- ❌ **NÃO pode criar/editar** campanhas (apenas subscribers)

##### **✅ BILLING:**
- ✅ **Ver** revenue share recebido
- ✅ **Ver** payouts pendentes e pagos
- ✅ **Ver** subscriptions pagas (se aplicável)
- ❌ **NÃO pode criar** billing (sistema cria automaticamente)

##### **✅ ANALYTICS:**
- ✅ **Ver** estatísticas dos próprios totens
- ✅ **Ver** performance de campanhas nos seus totens
- ✅ **Ver** revenue share consolidado

##### **❌ OPERAÇÕES NEGADAS:**
- ❌ **NÃO pode** criar/editar/deletar subscribers
- ❌ **NÃO pode** criar/editar/deletar planos
- ❌ **NÃO pode** criar/editar/deletar `plan_publisher_access`
- ❌ **NÃO pode** criar/editar/deletar `subscriber_publisher_access`
- ❌ **NÃO pode** ver dados de outros publishers
- ❌ **NÃO pode** criar/editar campanhas (apenas visualizar)

---

## 🔄 **FLUXO DE OPERAÇÕES**

### **Fluxo 1: Subscriber Cria Campanha**

```
1. Subscriber User faz login
   └── Sistema identifica: subscriber_id = 5

2. Subscriber acessa /campaigns
   └── Middleware filtra: apenas campanhas com subscriber_id = 5

3. Subscriber cria nova campanha
   └── Sistema valida:
       - subscriber_id = 5 (automático)
       - Verifica se subscriber tem acesso a publishers
       - Permite selecionar apenas publishers com acesso ativo

4. Subscriber vincula campanha a publishers
   └── Sistema valida:
       - subscriber_publisher_access existe e está ativo
       - Contrato está ativo (se aplicável)
       - Acesso não expirou

5. Campanha é criada
   └── Sistema cria:
       - campaigns (subscriber_id = 5)
       - campaign_publishers (vincula a publishers permitidos)
```

### **Fluxo 2: Admin Cria Contrato de Subscriber**

```
1. Admin cria subscriber_contract
   └── subscriber_id = 5 (OBRIGATÓRIO - FK para subscribers)
   └── plan_id = 1 (OPCIONAL - FK para plans, pode ser NULL)
   └── status = 'draft'

2. Subscriber assina contrato
   └── signed_by_subscriber_at = CURRENT_TIMESTAMP
   └── status = 'active' (após assinatura)

3. Sistema detecta contrato ativado
   └── Se plan_id existe (não é NULL):
       - Busca plan_id = 1
       - Busca plan_publisher_access onde plan_id = 1
       - Para cada publisher permitido:
         * Cria subscriber_publisher_access:
           - subscriber_id = 5
           - publisher_id = X
           - contract_id = contrato criado
           - plan_id = 1
           - access_type = 'plan'
           - is_active = true
           - expires_at = end_date do contrato
   └── Se plan_id é NULL:
       - Acesso deve ser criado manualmente pelo admin
       - Ou usar subscriber_publisher_access com access_type = 'contract'

4. Subscriber agora tem acesso aos publishers
   └── Pode criar campanhas vinculadas a esses publishers
```

### **Fluxo 2B: Admin Cria Contrato de Publisher**

```
1. Admin cria publisher_contract
   └── publisher_id = 10 (OBRIGATÓRIO - FK para publishers)
   └── contract_type = 'revenue_share'
   └── revenue_share_percentage = 70.00
   └── status = 'draft'
   ⚠️ NÃO tem plan_id (publisher_contracts não está relacionado a planos)

2. Publisher assina contrato
   └── signed_by_publisher_at = CURRENT_TIMESTAMP
   └── status = 'active' (após assinatura)

3. Sistema usa contrato para calcular revenue share
   └── Quando campanha é executada no publisher:
       - Busca publisher_contract ativo
       - Usa revenue_share_percentage (ex: 70%)
       - Cria publisher_billing com valor calculado
```

### **Fluxo 3: Publisher Gerencia Totens**

```
1. Publisher User faz login
   └── Sistema identifica: publisher_id = 10

2. Publisher acessa /locals
   └── Middleware filtra: apenas locals com publisher_id = 10

3. Publisher cria novo local
   └── Sistema valida:
       - publisher_id = 10 (automático)
       - Permite criar

4. Publisher cria totem no local
   └── Sistema valida:
       - local_id pertence ao publisher_id = 10
       - Permite criar

5. Publisher cria smart TV no totem
   └── Sistema valida:
       - totem_id pertence a local do publisher_id = 10
       - Permite criar
```

### **Fluxo 4: Campanha é Executada (Revenue Share)**

```
1. Campanha ativa é executada em totem
   └── Sistema identifica:
       - totem → local → publisher_id = 10

2. Sistema busca publisher_contracts ativo
   └── publisher_id = 10
   └── status = 'active'
   └── contract_type = 'revenue_share' ou 'hybrid'

3. Sistema calcula revenue share
   └── Se revenue_share_percentage existe:
       - Usa valor fixo (ex: 70%)
   └── Se não, usa revenue_share_rules:
       - Calcula baseado em tipo de campanha, horário, etc.

4. Sistema cria publisher_billing
   └── publisher_id = 10
   └── billing_type = 'revenue_share'
   └── direction = 'outgoing' (publisher recebe)
   └── amount = valor calculado
   └── payment_status = 'pending_payout'
```

---

## 📋 **TABELA RESUMO DE OPERAÇÕES**

| Entidade | Admin | Subscriber User | Publisher User |
|----------|-------|-----------------|----------------|
| **Subscribers** | CRUD completo | Ver próprio | ❌ |
| **Publishers** | CRUD completo | Ver (com acesso) | Ver próprio |
| **Plans** | CRUD completo | Ver | ❌ |
| **Subscriber Contracts** | CRUD completo | Ver + Assinar próprios | ❌ |
| **Publisher Contracts** | CRUD completo | ❌ | Ver + Assinar próprios |
| **Plan Publisher Access** | CRUD completo | ❌ | ❌ |
| **Subscriber Publisher Access** | CRUD completo | Ver próprios | ❌ |
| **Campaigns** | CRUD completo | CRUD próprios | Ver (nos seus totens) |
| **Media** | CRUD completo | CRUD próprios | ❌ |
| **Playlists** | CRUD completo | CRUD próprios | ❌ |
| **Locals** | CRUD completo | ❌ | Ver apenas próprios |
| **Totems** | CRUD completo | ❌ | Ver apenas próprios |
| **Smart TVs** | CRUD completo | ❌ | Ver apenas próprios |
| **Billing (Subscriber)** | Ver todos | Ver próprios | ❌ |
| **Billing (Publisher)** | Ver todos | ❌ | Ver próprio |

**Legenda:**
- **CRUD completo** = Create, Read, Update, Delete
- **CRUD próprios** = CRUD apenas dos seus próprios dados
- **Ver** = Apenas leitura
- **❌** = Sem acesso

---

## 🔐 **VALIDAÇÕES DE SEGURANÇA**

### **Isolamento de Dados:**

#### **Subscriber User:**
- Middleware `subscriberIsolationMiddleware` filtra automaticamente
- Todas as queries adicionam `WHERE subscriber_id = $1`
- Tentativas de acessar outros subscribers retornam 403

#### **Publisher User:**
- Validação manual em cada operação
- Verifica `publisher_id` do usuário vs `publisher_id` do recurso
- Tentativas de acessar outros publishers retornam 403
- **Apenas visualização**: Publisher User NÃO pode criar/editar/deletar locals, totens e smart TVs

### **Validação de Acesso:**

#### **Campanhas:**
- Subscriber só pode criar campanha vinculada ao seu `subscriber_id`
- Subscriber só pode vincular a publishers com `subscriber_publisher_access` ativo
- Sistema valida antes de permitir vinculação

#### **Locals, Totens e Smart TVs:**
- **Apenas ADMIN** pode criar/editar/deletar locals, totens e smart TVs
- **Publisher User** pode apenas **visualizar** seus próprios recursos
- Sistema filtra automaticamente por `publisher_id` na visualização
- Sistema valida `local_id → publisher_id`, `totem_id → local_id → publisher_id` antes de permitir (para admin)

---

## 🎯 **EXEMPLOS PRÁTICOS**

### **Exemplo 1: Subscriber Cria Campanha**

```
Usuário: subscriber_user (subscriber_id = 5)
Ação: Criar campanha

1. POST /api/campaigns
   Body: {
     name: "Campanha Verão",
     subscriber_id: 5,  // Automático (do token)
     publisher_ids: [10, 11]
   }

2. Sistema valida:
   - subscriber_id = 5 (do token)
   - Verifica subscriber_publisher_access:
     * subscriber_id=5, publisher_id=10, is_active=true ✅
     * subscriber_id=5, publisher_id=11, is_active=true ✅

3. Sistema cria:
   - campaigns (subscriber_id = 5)
   - campaign_publishers (campaign_id, publisher_id = 10)
   - campaign_publishers (campaign_id, publisher_id = 11)

4. Resposta: 201 Created
```

### **Exemplo 2: Admin Cria Totem para Publisher**

```
Usuário: admin
Ação: Criar totem para publisher

1. POST /api/totems
   Body: {
     identifier: "TOTEM-001",
     local_id: 25,
     uin: "UIN-123456"
   }

2. Sistema valida:
   - Admin tem permissão para criar ✅
   - Verifica local:
     * SELECT publisher_id FROM locals WHERE local_id = 25
     * Resultado: publisher_id = 10 ✅

3. Sistema cria:
   - totems (local_id = 25, identifier, uin)

4. Resposta: 201 Created
```

### **Exemplo 2B: Publisher Visualiza Totens**

```
Usuário: publisher_user (publisher_id = 10)
Ação: Visualizar totens do próprio publisher

1. GET /api/totems
   Headers: Authorization: Bearer <token>

2. Sistema valida:
   - publisher_id = 10 (do token)
   - Filtra: apenas totens onde local.publisher_id = 10

3. Sistema retorna:
   - Lista de totens do publisher_id = 10 (apenas leitura)

4. Resposta: 200 OK
   - Publisher pode ver, mas NÃO pode criar/editar/deletar
```

### **Exemplo 3: Admin Cria Acesso Manual**

```
Usuário: admin
Ação: Conceder acesso subscriber → publisher manualmente

1. POST /api/subscriber-access
   Body: {
     subscriber_id: 5,
     publisher_id: 12,
     access_type: "override",
     expires_at: "2024-12-31"
   }

2. Sistema valida:
   - Admin pode criar qualquer acesso ✅

3. Sistema cria:
   - subscriber_publisher_access:
     * subscriber_id = 5
     * publisher_id = 12
     * access_type = "override"
     * granted_by = admin.id
     * is_active = true

4. Resposta: 201 Created
```

---

## 📊 **RESUMO DO MODELO ER**

### **Entidades Principais:**
1. **SUBSCRIBERS** - Anunciantes (compram espaço)
2. **PUBLISHERS** - Publicadores (vendem espaço)
3. **SUBSCRIBER_CONTRACTS** - Contratos de anunciantes
   - ✅ **Tem** `subscriber_id` (FK obrigatório)
   - ✅ **Tem** `plan_id` (FK opcional - pode ser NULL)
4. **PUBLISHER_CONTRACTS** - Contratos de publicadores
   - ✅ **Tem** `publisher_id` (FK obrigatório)
   - ❌ **NÃO tem** `plan_id` (não relacionado a planos)
5. **PLANS** - Planos do sistema
6. **PLAN_PUBLISHER_ACCESS** - Configuração plano → publisher
7. **SUBSCRIBER_PUBLISHER_ACCESS** - Acesso real subscriber → publisher

### **Relacionamentos:**

#### **Contratos:**
- **1 Subscriber** → **N Subscriber_Contracts** (obrigatório: cada contrato tem subscriber_id)
- **1 Subscriber_Contract** → **1 Plan** (OPCIONAL: plan_id pode ser NULL)
- **1 Publisher** → **N Publisher_Contracts** (obrigatório: cada contrato tem publisher_id)
- **1 Publisher_Contract** → **0 Plans** (NÃO relacionado a planos)

#### **Acessos:**
- **1 Plan** → **N Publishers** (via `plan_publisher_access`)
- **1 Subscriber** → **N Publishers** (via `subscriber_publisher_access`)

#### **Infraestrutura:**
- **1 Publisher** → **N Locals** → **N Totens** → **N Smart TVs**

### **Regras de Negócio:**
- Contrato ativo → Cria acessos automaticamente (se tem plan_id)
- Contrato expirado → Revoga acessos automaticamente
- Campanha executada → Calcula revenue share baseado em `publisher_contracts`
- Acesso expirado → Subscriber não pode criar campanhas naquele publisher

---

**Última atualização:** 2026-01-02
**Versão:** v2.1.0

**Nota:** Para a versão mais completa e atualizada, consulte `MODELO_ER_OPERACOES_SUBSCRIBERS_PUBLISHERS_CONTRATOS_V2.md`

