# Modelo ER e Operações: Subscribers, Publishers e Contratos - v2.1

**Última atualização:** 2026-01-02  
**Versão do Sistema:** 2.1.0

---

## 🏗️ **MODELO ENTIDADE-RELACIONAMENTO (ER) COMPLETO**

### **⚠️ IMPORTANTE: Estrutura de Contratos**

Existem **DUAS tabelas de contratos completamente separadas**:

1. **`subscriber_contracts`** → Contratos de ANUNCIANTES (Subscribers)
   - ✅ **Sempre** relacionado a um `subscriber_id` (FK obrigatório)
   - ✅ **Pode** estar relacionado a um `plan_id` (FK opcional - pode ser NULL)
   - ✅ **Tipos:** `advertising`, `subscription`, `partnership`
   
2. **`publisher_contracts`** → Contratos de PUBLICADORES (Publishers)
   - ✅ **Sempre** relacionado a um `publisher_id` (FK obrigatório)
   - ❌ **NÃO** relacionado a planos (não tem `plan_id`)
   - ✅ **Tipos:** `revenue_share`, `subscription`, `partnership`, `hybrid`

### **Diagrama ER Completo:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ADMINISTRATOR                                │
│  (role: 'admin' ou 'admin_sql')                                            │
│  - Cria Publishers                                                          │
│  - Cria Subscribers                                                         │
│  - Cria Planos                                                              │
│  - Configura plan_publisher_access                                          │
│  - Cria/Edita/Deleta Locals, Totens, Smart TVs                             │
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
│               │                          │ - client_type │
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
│ - contract_type  │                      │    subscription,  │
│   (advertising,  │                      │    partnership,  │
│    subscription, │                      │    hybrid)        │
│    partnership)  │                      │ - revenue_share_% │
│ - status         │                      │ - subscription_  │
│ - start_date     │                      │   amount         │
│ - end_date       │                      │ - status         │
│ - signed_by_     │                      │ - start_date     │
│   subscriber_at  │                      │ - end_date       │
│                  │                      │ - signed_by_     │
│ OPERAÇÕES:       │                      │   publisher_at   │
│ - Criar: Admin   │                      │                  │
│ - Editar: Admin  │                      │ ⚠️ NÃO tem       │
│ - Ver: Admin +   │                      │   plan_id        │
│   Subscriber     │                      │                  │
│ - Assinar:       │                      │ OPERAÇÕES:       │
│   Subscriber     │                      │ - Criar: Admin   │
└───────┬──────────┘                      │ - Editar: Admin  │
        │                                 │ - Ver: Admin +   │
        │ N:1 (opcional)                  │   Publisher      │
        │                                 │ - Assinar:       │
        ▼                                 │   Publisher      │
┌──────────────────┐                      └──────────────────┘
│     PLANS        │                      (NÃO relacionado a PLANS)
│                  │
│ - plan_id        │
│ - name           │
│ - slug           │
│ - price_monthly  │
│ - price_yearly   │
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
│ - publisher_id (FK)          │
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
│   (plan, contract, override)  │
│ - is_active                  │
│ - expires_at                  │
│                              │
│ OPERAÇÕES:                   │
│ - Criar: Admin (manual) OU   │
│   Sistema (automático)       │
│ - Editar: Admin              │
│ - Revogar: Admin             │
│ - Ver: Admin + Subscriber    │
└──────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    INFRAESTRUTURA                            │
│                                                              │
│  PUBLISHERS                                                  │
│      │                                                       │
│      │ 1:N                                                   │
│      ▼                                                       │
│  LOCALS                                                      │
│  - local_id (PK)                                            │
│  - publisher_id (FK) ◄─── OBRIGATÓRIO                       │
│  - name                                                     │
│  - address, city, state                                      │
│  - latitude, longitude                                       │
│  - is_active                                                 │
│                                                              │
│  OPERAÇÕES:                                                 │
│  - Criar: APENAS Admin                                      │
│  - Editar: APENAS Admin                                     │
│  - Deletar: APENAS Admin                                    │
│  - Ver: Admin (todos) + Publisher (próprios)                │
│      │                                                       │
│      │ 1:N                                                   │
│      ▼                                                       │
│  TOTEMS                                                      │
│  - totem_id (PK)                                            │
│  - local_id (FK) ◄─── OBRIGATÓRIO                           │
│  - identifier (UNIQUE)                                      │
│  - uin (UNIQUE)                                             │
│  - device_id (UNIQUE)                                       │
│  - name, description                                        │
│  - status (offline, online, error, maintenance)             │
│  - last_heartbeat                                           │
│  - is_active                                                │
│                                                              │
│  OPERAÇÕES:                                                 │
│  - Criar: APENAS Admin                                      │
│  - Editar: APENAS Admin                                     │
│  - Deletar: APENAS Admin                                    │
│  - Aprovar: APENAS Admin (se status = pending_approval)     │
│  - Ver: Admin (todos) + Publisher (próprios)               │
│      │                                                       │
│      │ 1:1                                                   │
│      ▼                                                       │
│  SMART_TVS                                                   │
│  - tv_id (PK)                                               │
│  - totem_id (FK) ◄─── OBRIGATÓRIO (1:1)                     │
│  - identifier (UNIQUE)                                      │
│  - device_id (UNIQUE)                                       │
│  - name, brand, model                                        │
│  - platform (webOS, Tizen, Android TV)                     │
│  - resolution_width, resolution_height                      │
│  - orientation (landscape, portrait)                        │
│  - status (offline, online, playing, error)                │
│  - is_active                                                │
│                                                              │
│  OPERAÇÕES:                                                 │
│  - Criar: APENAS Admin                                      │
│  - Editar: APENAS Admin                                     │
│  - Deletar: APENAS Admin                                    │
│  - Ver: Admin (todos) + Publisher (próprios)               │
└─────────────────────────────────────────────────────────────┘
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

##### **✅ LOCALS:**
- ✅ **Criar** locals para qualquer publisher
- ✅ **Editar** locals de qualquer publisher
- ✅ **Deletar** locals de qualquer publisher
- ✅ **Ver** todos os locals
- ✅ **Aprovar** locals pendentes (se aplicável)

##### **✅ TOTEMS:**
- ✅ **Criar** totens em locals de qualquer publisher
- ✅ **Editar** totens de qualquer publisher
- ✅ **Deletar** totens de qualquer publisher
- ✅ **Ver** todos os totens
- ✅ **Aprovar** totens pendentes (status = 'pending_approval')

##### **✅ SMART TVs:**
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

##### **✅ CAMPANHAS:**
- ✅ **Criar** campanhas para qualquer subscriber
- ✅ **Editar** campanhas de qualquer subscriber
- ✅ **Deletar** campanhas
- ✅ **Ver** todas as campanhas
- ✅ **Aprovar/Pausar** campanhas

##### **✅ MÍDIA:**
- ✅ **Upload** de mídia para qualquer subscriber
- ✅ **Editar** mídia de qualquer subscriber
- ✅ **Deletar** mídia
- ✅ **Ver** toda a mídia
- ✅ **Aprovar/Rejeitar** mídia

##### **✅ PLAYLISTS:**
- ✅ **Criar** playlists para qualquer subscriber
- ✅ **Editar** playlists de qualquer subscriber
- ✅ **Deletar** playlists
- ✅ **Ver** todas as playlists

##### **✅ OUTRAS OPERAÇÕES:**
- ✅ **Gerenciar** usuários do sistema
- ✅ **Gerenciar** roles e permissões
- ✅ **Ver** todos os dados (sem isolamento)
- ✅ **Acessar** todas as rotas administrativas
- ✅ **Gerenciar** billing (subscriber e publisher)
- ✅ **Gerenciar** analytics e relatórios

---

### **2. SUBSCRIBER USER (role: 'subscriber' ou 'client')**

#### **Contexto:**
- Usuário vinculado a um `subscriber_id` específico
- Só pode ver e gerenciar dados do seu próprio subscriber
- Isolamento automático de dados via middleware `subscriberIsolationMiddleware`

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
- ✅ **Vincular** campanhas a publishers (apenas com acesso ativo)

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
- ✅ **Ver** faturas do próprio subscriber (`subscriber_billing`)
- ✅ **Ver** histórico de pagamentos
- ❌ **NÃO pode criar** faturas (sistema cria automaticamente)

##### **❌ OPERAÇÕES NEGADAS:**
- ❌ **NÃO pode** criar/editar/deletar publishers
- ❌ **NÃO pode** criar/editar/deletar planos
- ❌ **NÃO pode** criar/editar/deletar `plan_publisher_access`
- ❌ **NÃO pode** criar/editar/deletar `subscriber_publisher_access` (exceto ver)
- ❌ **NÃO pode** ver dados de outros subscribers
- ❌ **NÃO pode** criar/editar/deletar locals, totens, smart TVs
- ❌ **NÃO pode** ver locals, totens, smart TVs

---

### **3. PUBLISHER USER (role: 'publisher')**

#### **Contexto:**
- Usuário vinculado a um `publisher_id` específico
- Só pode ver dados do seu próprio publisher
- **IMPORTANTE:** Apenas visualização de Locals, Totens e Smart TVs

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
- ❌ **NÃO pode Criar** locals (apenas admin)
- ❌ **NÃO pode Editar** locals (apenas admin)
- ❌ **NÃO pode Deletar** locals (apenas admin)
- ✅ **Ver** apenas locals do próprio publisher

##### **✅ TOTEMS:**
- ❌ **NÃO pode Criar** totens (apenas admin)
- ❌ **NÃO pode Editar** totens (apenas admin)
- ❌ **NÃO pode Deletar** totens (apenas admin)
- ✅ **Ver** apenas totens do próprio publisher
- ❌ **NÃO pode Aprovar** totens pendentes (apenas admin)

##### **✅ SMART TVs:**
- ❌ **NÃO pode Criar** smart TVs (apenas admin)
- ❌ **NÃO pode Editar** smart TVs (apenas admin)
- ❌ **NÃO pode Deletar** smart TVs (apenas admin)
- ✅ **Ver** apenas smart TVs do próprio publisher e do próprio totem

##### **✅ CAMPANHAS (Visualização):**
- ✅ **Ver** campanhas ativas nos seus totens
- ✅ **Ver** campanhas vinculadas ao publisher (via `campaign_publishers`)
- ❌ **NÃO pode criar/editar** campanhas (apenas subscribers)

##### **✅ BILLING:**
- ✅ **Ver** revenue share recebido (`publisher_billing` com direction = 'outgoing')
- ✅ **Ver** payouts pendentes e pagos
- ✅ **Ver** subscriptions pagas (se aplicável - direction = 'incoming')
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
- ❌ **NÃO pode** criar/editar/deletar locals, totens, smart TVs

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

### **Fluxo 3: Admin Cria Local, Totem e Smart TV para Publisher**

```
1. Admin cria local para publisher
   └── POST /api/locals
       Body: {
         publisher_id: 10,
         name: "Loja Centro",
         address: "Rua X, 123"
       }
   └── Sistema valida: publisher_id existe
   └── Sistema cria: locals (publisher_id = 10)

2. Admin cria totem no local
   └── POST /api/totems
       Body: {
         identifier: "TOTEM-001",
         local_id: 25,
         uin: "UIN-123456"
       }
   └── Sistema valida:
       - Admin tem permissão ✅
       - local_id = 25 existe
       - local.publisher_id = 10 ✅
   └── Sistema cria: totems (local_id = 25)

3. Admin cria smart TV no totem
   └── POST /api/smart-tvs
       Body: {
         totem_id: 50,
         identifier: "TV-001",
         brand: "LG",
         model: "55UN7300"
       }
   └── Sistema valida:
       - Admin tem permissão ✅
       - totem_id = 50 existe
       - totem.local_id = 25
       - local.publisher_id = 10 ✅
   └── Sistema cria: smart_tvs (totem_id = 50)

4. Publisher User visualiza (apenas leitura)
   └── GET /api/locals → Filtra: publisher_id = 10
   └── GET /api/totems → Filtra: local.publisher_id = 10
   └── GET /api/smart-tvs → Filtra: totem.local.publisher_id = 10
   └── Publisher pode ver, mas NÃO pode criar/editar/deletar
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
| **Locals** | CRUD completo | ❌ | **Ver apenas** próprios |
| **Totems** | CRUD completo | ❌ | **Ver apenas** próprios |
| **Smart TVs** | CRUD completo | ❌ | **Ver apenas** próprios |
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
     title: "Campanha Verão",
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

## 📊 **ESTRUTURA COMPLETA DAS TABELAS**

### **Tabelas Principais:**

#### **SUBSCRIBERS:**
- `subscriber_id` (PK)
- `name`, `email`, `phone`, `whatsapp`, `address`
- `is_active`
- `created_at`, `updated_at`

#### **PUBLISHERS:**
- `publisher_id` (PK)
- `name`, `email`, `phone`, `whatsapp`, `description`
- `client_type` ('subscriber', 'publisher', 'both')
- `active`
- `created_at`, `updated_at`

#### **LOCALS:**
- `local_id` (PK)
- `publisher_id` (FK) ◄─── **OBRIGATÓRIO**
- `name`, `address`, `city`, `state`, `zip_code`, `country`
- `latitude`, `longitude`
- `timezone`
- `is_active`
- `created_at`, `updated_at`

#### **TOTEMS:**
- `totem_id` (PK)
- `local_id` (FK) ◄─── **OBRIGATÓRIO**
- `identifier` (UNIQUE)
- `uin` (UNIQUE)
- `device_id` (UNIQUE)
- `name`, `description`
- `model`, `manufacturer`
- `firmware_version`, `hardware_version`, `os_version`
- `status` ('offline', 'online', 'error', 'maintenance', 'syncing')
- `last_heartbeat`
- `network_info` (JSONB)
- `capabilities` (JSONB)
- `is_active`
- `created_at`, `updated_at`

#### **SMART_TVS:**
- `tv_id` (PK)
- `totem_id` (FK) ◄─── **OBRIGATÓRIO** (1:1)
- `identifier` (UNIQUE)
- `device_id` (UNIQUE)
- `name`, `brand`, `model`
- `platform` ('webOS', 'Tizen', 'Android TV', etc.)
- `firmware_version`
- `resolution_width`, `resolution_height`
- `orientation` ('landscape', 'portrait')
- `status` ('offline', 'online', 'playing', 'error', 'sleeping')
- `last_heartbeat`
- `capabilities` (JSONB)
- `settings` (JSONB)
- `is_active`
- `created_at`, `updated_at`

#### **SUBSCRIBER_CONTRACTS:**
- `contract_id` (PK)
- `subscriber_id` (FK) ◄─── **OBRIGATÓRIO**
- `plan_id` (FK) ◄─── **OPCIONAL** (pode ser NULL)
- `contract_number` (UNIQUE)
- `contract_type` ('advertising', 'subscription', 'partnership')
- `title`, `description`
- `start_date`, `end_date`
- `total_amount`, `currency`
- `status` ('draft', 'active', 'expired', 'terminated', 'cancelled')
- `signed_by_subscriber_at`, `signed_by_tenant_at`
- `document_path`, `document_filename`
- `metadata` (JSONB)
- `created_at`, `updated_at`

#### **PUBLISHER_CONTRACTS:**
- `contract_id` (PK)
- `publisher_id` (FK) ◄─── **OBRIGATÓRIO**
- ⚠️ **NÃO tem** `plan_id`
- `contract_number` (UNIQUE)
- `contract_type` ('revenue_share', 'subscription', 'partnership', 'hybrid')
- `title`, `description`
- `start_date`, `end_date`
- `revenue_share_percentage` (NUMERIC 5,2)
- `revenue_share_rules` (JSONB)
- `subscription_amount`, `subscription_interval`
- `currency`
- `status` ('draft', 'active', 'expired', 'terminated', 'cancelled')
- `signed_by_publisher_at`, `signed_by_tenant_at`
- `document_path`, `document_filename`
- `metadata` (JSONB)
- `created_at`, `updated_at`

#### **PLANS:**
- `plan_id` (PK)
- `name`, `slug` (UNIQUE)
- `description`
- `price_monthly`, `price_yearly`
- `currency`
- `billing_interval`
- `features` (JSONB)
- `limits` (JSONB)
- `is_active`
- `created_at`, `updated_at`

#### **PLAN_PUBLISHER_ACCESS:**
- `plan_id` (FK)
- `publisher_id` (FK)
- `is_allowed`
- `restrictions` (JSONB)
- PRIMARY KEY (plan_id, publisher_id)

#### **SUBSCRIBER_PUBLISHER_ACCESS:**
- `access_id` (PK)
- `subscriber_id` (FK)
- `publisher_id` (FK)
- `contract_id` (FK) - opcional
- `plan_id` (FK) - opcional
- `access_type` ('plan', 'contract', 'override')
- `is_active`
- `expires_at`
- `granted_by` (FK para users)
- `created_at`, `updated_at`

---

## 🔗 **RELACIONAMENTOS DETALHADOS**

### **Relacionamentos de Contratos:**

1. **Subscriber → Subscriber_Contracts:**
   - 1 Subscriber → N Subscriber_Contracts
   - `subscriber_id` é **OBRIGATÓRIO** (FK NOT NULL)
   - Cada contrato pertence a exatamente 1 subscriber

2. **Subscriber_Contract → Plan:**
   - 1 Subscriber_Contract → 0 ou 1 Plan
   - `plan_id` é **OPCIONAL** (FK pode ser NULL)
   - Se `plan_id` existe, cria acessos automaticamente

3. **Publisher → Publisher_Contracts:**
   - 1 Publisher → N Publisher_Contracts
   - `publisher_id` é **OBRIGATÓRIO** (FK NOT NULL)
   - Cada contrato pertence a exatamente 1 publisher

4. **Publisher_Contract → Plan:**
   - **NÃO EXISTE** relacionamento
   - `publisher_contracts` **NÃO tem** `plan_id`
   - Publishers não estão relacionados a planos via contratos

### **Relacionamentos de Acesso:**

1. **Plan → Publishers:**
   - 1 Plan → N Publishers (via `plan_publisher_access`)
   - Define quais publishers estão disponíveis para um plano

2. **Subscriber → Publishers:**
   - 1 Subscriber → N Publishers (via `subscriber_publisher_access`)
   - Define acesso real do subscriber aos publishers

3. **Subscriber_Contract → Subscriber_Publisher_Access:**
   - Quando contrato é ativado e tem `plan_id`:
     - Sistema busca `plan_publisher_access` para o `plan_id`
     - Cria `subscriber_publisher_access` para cada publisher permitido

### **Relacionamentos de Infraestrutura:**

1. **Publisher → Locals:**
   - 1 Publisher → N Locals
   - `publisher_id` é **OBRIGATÓRIO** em `locals`
   - Cada local pertence a exatamente 1 publisher

2. **Local → Totems:**
   - 1 Local → N Totems
   - `local_id` é **OBRIGATÓRIO** em `totems`
   - Cada totem pertence a exatamente 1 local

3. **Totem → Smart TV:**
   - 1 Totem → 1 Smart TV (relacionamento 1:1)
   - `totem_id` é **OBRIGATÓRIO** em `smart_tvs`
   - Cada smart TV é controlada por exatamente 1 totem

### **Relacionamentos de Campanhas:**

1. **Subscriber → Campaigns:**
   - 1 Subscriber → N Campaigns
   - `subscriber_id` é **OBRIGATÓRIO** em `campaigns`
   - Cada campanha pertence a exatamente 1 subscriber

2. **Campaign → Publishers:**
   - 1 Campaign → N Publishers (via `campaign_publishers`)
   - Subscriber só pode vincular a publishers com acesso ativo

3. **Campaign → Totems:**
   - 1 Campaign → N Totems (via `campaign_totems`)
   - Campanha pode ser executada em múltiplos totens

---

## 📝 **REGRAS DE NEGÓCIO**

### **Contratos:**

1. **Subscriber Contracts:**
   - Contrato ativo com `plan_id` → Cria acessos automaticamente
   - Contrato expirado → Revoga acessos automaticamente
   - Contrato sem `plan_id` → Acesso deve ser criado manualmente

2. **Publisher Contracts:**
   - Contrato ativo → Usado para calcular revenue share
   - Revenue share pode ser fixo (`revenue_share_percentage`) ou variável (`revenue_share_rules`)
   - Contrato pode ser `hybrid` (recebe % E paga subscription)

### **Acessos:**

1. **Subscriber_Publisher_Access:**
   - Criado automaticamente quando contrato com `plan_id` é ativado
   - Pode ser criado manualmente pelo admin (access_type = 'override')
   - Acesso expirado → Subscriber não pode criar campanhas naquele publisher

2. **Plan_Publisher_Access:**
   - Define quais publishers estão disponíveis para cada plano
   - Configurado apenas pelo admin

### **Infraestrutura:**

1. **Locals, Totens e Smart TVs:**
   - **Apenas ADMIN** pode criar/editar/deletar
   - **Publisher User** pode apenas visualizar seus próprios recursos
   - Sistema valida ownership em todas as operações

### **Campanhas:**

1. **Criação:**
   - Subscriber só pode criar campanha vinculada ao seu `subscriber_id`
   - Subscriber só pode vincular a publishers com `subscriber_publisher_access` ativo
   - Sistema valida antes de permitir vinculação

2. **Execução:**
   - Campanha executada em totem → Calcula revenue share baseado em `publisher_contracts`
   - Revenue share é registrado em `publisher_billing`

---

## 🎯 **VALIDAÇÕES IMPLEMENTADAS**

### **Backend:**

1. **Routes:**
   - `/api/locals` - POST, PUT, DELETE: `authorizeRole(['admin'])`
   - `/api/totems` - POST, PUT, DELETE: `authorizeRole(['admin'])`
   - `/api/smart-tvs` - POST, PUT, DELETE: `authorizeRole(['admin'])`

2. **Services:**
   - Validação de ownership em todas as operações
   - Verificação de `local_id → publisher_id` antes de criar totem
   - Verificação de `totem_id → local_id → publisher_id` antes de criar smart TV

3. **Middleware:**
   - `subscriberIsolationMiddleware` - Filtra automaticamente por `subscriber_id`
   - `authMiddleware` - Valida token e extrai user info
   - `authorizeRole` - Verifica permissões por role

### **Frontend:**

1. **Conditional Rendering:**
   - Botões de criar/editar/deletar só aparecem se `isAdmin === true`
   - Publisher User vê apenas visualização

2. **API Calls:**
   - Filtros automáticos baseados em role
   - Validação de permissões antes de fazer requisições

---

## 📚 **REFERÊNCIAS**

- **Schema SQL:** `database/smartchannel-db-v2-refactored-*.sql`
- **Backend Routes:** `backend/src/routes/`
- **Backend Services:** `backend/src/services/`
- **Frontend Pages:** `frontend/src/pages/`
- **Documentação de Contratos:** `DOCUMENTACAO_TABELAS_CONTRATOS.md`

---

**Última atualização:** 2026-01-02  
**Versão do Documento:** 2.1.0  
**Versão do Sistema:** 2.1.0

