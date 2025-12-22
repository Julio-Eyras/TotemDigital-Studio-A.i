# Consolidação Final: Análise Completa do Modelo E.R.

## 📋 Documentos Relacionados

1. **`REANALISE_COMPLETA_MODELO_NEGOCIO_RENOMENACOES.md`** - Reanálise completa com renomeações
2. **`QUESTOES_ESCLARECER_MODELO_NEGOCIO.md`** - Questões que precisam ser respondidas
3. **`RESUMO_EXECUTIVO_RENOMENACOES.md`** - Resumo executivo das mudanças
4. **`ANALISE_COMPLETA_MODELO_ER.md`** - Análise inicial do modelo E.R.
5. **`ANALISE_BILLING_MODELO_NEGOCIO.md`** - Análise detalhada de billing
6. **`ANALISE_WORKFLOW_APROVACAO_ATRIBUICAO.md`** - Análise de workflow de aprovação

---

## 🎯 Modelo de Negócio Final (Consolidado)

### Hierarquia de Entidades

```
┌─────────────────────────────────────────────────────────────┐
│              SMARTDISPLAY ECOSYSTEM                         │
│                                                             │
│  TENANT = SmartSignage Pro                                 │
│  - Admin e Operador em users (is_tenant_user = true)      │
│  - Recebe receita de Subscribers e Publishers              │
│                                                             │
│  ┌────────────────────┐        ┌─────────────────────┐     │
│  │   PUBLISHER        │        │   SUBSCRIBER        │     │
│  │ (antes: host)      │        │ (antes: client)     │     │
│  │                    │        │                     │     │
│  │ • Instala totens   │        │ • Cria campanhas    │     │
│  │ • Instala SmartTVs │        │ • Cria mídias       │     │
│  │ • Gerencia conteúdo│        │ • Cria playlists    │     │
│  │ • Recebe % OU paga │        │ • Paga por espaço   │     │
│  │   subscription     │        │ • Aprovação tenants │     │
│  │                    │        │                     │     │
│  │ → users            │        │ → campaigns         │     │
│  │ → locals           │        │ → medias            │     │
│  │ → totems           │        │ → playlists         │     │
│  │ → smart_tvs        │        │ → subscriber_billing│     │
│  │ → publisher_billing│        └─────────────────────┘     │
│  │ → subscriptions    │                                    │
│  └────────────────────┘                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Hierarquia Geográfica:
publishers → locals → totems → smart_tvs

Ligação de Conteúdo:
subscribers.campaigns → campaign_totems → publishers.totems
```

---

## 🔄 Mudanças Críticas Identificadas

### 1. Renomeações Obrigatórias

#### Tabelas
- `clients` → `subscribers` sim 
- `hosts` → `publishers` sim 

#### Colunas (em TODAS as tabelas)
- `client_id` → `subscriber_id` sim 
- `host_id` → `publisher_id` sim 

#### Específicas
- `users.client_id` → `users.publisher_id` sim 
- `subscriptions.client_id` → `subscriptions.publisher_id` sim 
- `locals.host_id` → `locals.publisher_id` sim 
- `campaigns.client_id` → `campaigns.subscriber_id` sim 
- `medias.client_id` → `medias.subscriber_id` sim 

### 2. Remoções Obrigatórias

- `totems.client_id` → **REMOVER** (totem pertence a publisher via local_id) claro 

### 3. Novas Estruturas

#### Tabelas Novas
- `subscriber_billing` (billing de anunciantes) sim 
- `publisher_billing` (billing de publishers) sim 
- `publisher_contracts` (contratos de publishers) sim 
- `subscriber_contracts` (contratos de subscribers, opcional) sim 

#### Campos Novos em `publishers` sim 
- `is_subscriber` BOOLEAN
- `is_publisher` BOOLEAN
- `client_type` TEXT ('subscriber', 'publisher', 'both')

#### Campos Novos em `publisher_billing` sim 
- `revenue_share_percentage` NUMERIC(5, 2)
- `original_campaign_amount` NUMERIC(12, 2)
- `platform_fee_amount` NUMERIC(12, 2)
- `approved_by` INTEGER (FK → users)
- `approved_at` TIMESTAMP

---

## 💰 Estrutura de Billing (Confirmada: Tabelas Separadas) sim 

### `subscriber_billing`
- Subscribers (anunciantes) **pagam** para plataforma
- `direction` = 'incoming' (plataforma recebe)
- `billing_type`: 'advertisement', 'exhibition_lot', 'totem_quantity', 'smarttv_quantity', 'time_based', 'rule_based'

### `publisher_billing`
- Publishers **recebem** (revenue share) OU **pagam** (subscription)
- `direction` = 'outgoing' (publisher recebe) OU 'incoming' (publisher paga)
- `billing_type`: 'revenue_share', 'payout', 'subscription', 'platform_fee'
- Modelo **híbrido** suportado (recebe % E paga subscription)  sim modelo hibrido 

---

## 🔐 Workflow de Aprovação

### Mídias
- ✅ Workflow existe (`approval_workflows`) extender ele. 
- ✅ Remover `medias.status`, usar apenas `approval_workflows.status` sim 
sim 
### Playlists e Campanhas
- ⚠️ Você confirmou: **NÃO precisam de aprovação do admin**
- ⚠️ Subscribers/Publishers podem gerenciar diretamente (se tiverem flag habilitada)
- ⚠️ Se flag desabilitada, aprovação necessária (pelo tenant do sistema admin ou usuario com rbac correspondente)
sim
### Payouts de Publishers
- ✅ Aprovação via RBAC
- ✅ Campo `approved_by` em `publisher_billing`
- ✅ Workflow: pending → approved → paid
sim
---

## ⚠️ Questões Críticas que Precisam Resposta

### 🔴 Prioridade ALTA

1. **Subscriptions:** São de Publishers (pagam plataforma) ou também de Subscribers (planos)? subscriptions sao os assinantes que pagam por anunuciar 

2. **Users Tenant:** Como modelar admin/operador? Flag `is_tenant_user` ou Publisher especial? assim de esta forma `is_tenant_user`
3. **Publisher pode ser Subscriber:** Como funciona quando `client_type = 'both'`? Billing separado? sim billing separado 
4. **Playlists:** Podem ser de Publishers (conteúdo próprio) ou apenas de Subscribers? polimorfica tando de um ou d0 outro 
5. **Execution Logs:** `client_id` representa Subscriber ou Publisher? polimorfico 

### 🟡 Prioridade MÉDIA

6. **Revenue Share:** Fixo (70%) ou variável por publisher (via contrato)? variavel via contrato
7. **Modelo Híbrido:** Subscription desconta do revenue share ou contas separadas? modelo hibrido 

8. **Workflow de Aprovação:** Detalhes do workflow de aprovação de payouts, investigue como esta agora e apresente sugestoes. 
9. **Armazenamento de Documentos:** Banco, filesystem, ou storage externo (S3)? filesystem 

### 🟢 Prioridade BAIXA

10. **Tipos de Pagamento:** Todos os tipos de `billing_type` estão cobertos? nao entendi 

---

## 📊 Impactos Identificados

### Backend
- Todos os serviços que usam `client_id` ou `host_id`
- Rotas e controllers
- Queries SQL
- Validações e middlewares
sim execute com o maio cuidado 

### Frontend
- APIs e queries
- Componentes que usam `client_id` ou `host_id`
- Formulários e listagens
sim execute com o maio cuidado 

### Banco de Dados recrie do zero as necessidades atuais e contrucao do modelo e.r cuide muito bem para a ordem dos respectivos comandos sql. 

- Todas as FKs
- Índices
- Views
- Triggers e functions
sim execute com o maio cuidado 


### Scripts
- Scripts de instalação
- Scripts de migração
- Scripts de backup
sim execute com o maio cuidado 

---

## ✅ Decisões Confirmadas

1. ✅ **Tabelas separadas para billing** (não polimórfico)
2. ✅ **Modelo híbrido** (publisher recebe % E paga subscription)
3. ✅ **RBAC para aprovação** de payouts
4. ✅ **Armazenar contratos** (PDF, DOC, DOCX)
5. ✅ **Revenue share variável** (conforme contrato)
6. ✅ **NÃO preservar dados** (recriar todo o banco do zero  estrutura e recrie tudo )

---

## 🎯 Próximos Passos

1. **Responder todas as questões** em `QUESTOES_ESCLARECER_MODELO_NEGOCIO.md`
2. **Validar modelo** após respostas
3. **Criar DDL completo** com todas as mudanças
4. **Criar scripts de migração** (estrutura apenas, sem dados)
5. **Documentar impactos** no código
6. **Criar plano de implementação** detalhado

---

**Status:** Análise completa realizada. Aguardando respostas às questões críticas para finalizar modelo e criar scripts de migração.

