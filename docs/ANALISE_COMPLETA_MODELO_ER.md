# Análise Completa do Modelo E.R. - SmartSignage Pro

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Análise de Entidades](#análise-de-entidades)
3. [Relacionamentos Principais](#relacionamentos-principais)
4. [Análise por Módulo Funcional](#análise-por-módulo-funcional)
5. [Problemas Identificados](#problemas-identificados)
6. [Oportunidades de Melhoria](#oportunidades-de-melhoria)
7. [Propostas de Refatoração](#propostas-de-refatoração)

---

## 📌 Documentos Relacionados

- **Análise Detalhada de Billing:** `ANALISE_BILLING_MODELO_NEGOCIO.md`
  - Modelo de revenue share
  - Billing de CLIENT vs HOST
  - Propostas de reestruturação

- **Análise de Workflow de Aprovação e Atribuição:** `ANALISE_WORKFLOW_APROVACAO_ATRIBUICAO.md`
  - Workflow de aprovação de mídias e playlists
  - Atribuição de campanhas a hosts/locais/totens
  - Problemas e propostas de melhoria

---

---

## 🎯 Visão Geral

O modelo E.R. do SmartSignage Pro é composto por **75+ tabelas** organizadas em múltiplos módulos funcionais, suportando um sistema complexo de sinalização digital com features avançadas como analytics, ML/AI, controle remoto, billing, e orquestração de efeitos visuais.

### Estatísticas do Modelo
- **Total de Tabelas:** ~75 tabelas
- **Módulos Principais:** 17 módulos funcionais
- **Complexidade:** Alta (múltiplos relacionamentos N:N)
- **Padrões:** Soft delete, auditoria, timestamps

---

## 📊 Análise de Entidades

### 🎯 **CLARIFICAÇÃO CRÍTICA DO MODELO DE NEGÓCIO**

Antes de analisar as entidades, é fundamental entender os **dois tipos de "clientes"** no sistema:

#### **1️⃣ CLIENT (client_id) = ANUNCIANTE** correto sim
- 👉 **Quem ANUNCIA** (compra mídia, cria campanhas). exatamente.
- Dona das **campanhas, anúncios, criativos** sim
- Pode anunciar em **vários hosts** sim
- **NÃO controla hardware** exato 
- **NÃO é tenant do sistema** isso mesmo

#### **2️⃣ HOST (host_id) = CLIENTE DO SISTEMA (TENANT)**
- 👉 **Onde o sistema é INSTALADO** (opera totens e TVs) exatamente
- Cliente do **software SmartSignage** 
- Controla **hardware, telas, players, totens**
- Pode exibir **anúncios de vários clients**
- **É o TENANT real do sistema** (quem autentica, usa o sistema, paga pelo software). exatamente

#### **3️⃣ TOTEM = Micro-servidor Edge**
- Totem = **edge node** (pequeno servidor)
- Controla e sincroniza **Smart TVs**
- Comunica com backend central (orquestrador)
- Executa fallback offline
- Reporta métricas

isso mesmo.

#### **4️⃣ SMART TV = Display Controlado**
- TV controlada pelo totem
- Suporta múltiplas plataformas: LG webOS, Samsung Tizen, Android TV
exatamente isso 
---

### 📐 Diagrama Conceitual Correto

```
┌─────────────────────────────────────────────────────────────────┐
│                  SMARTDISPLAY ECOSYSTEM                         │
│                  (Modelo de Negócio Correto)                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐  ┌──────────────────────────┐
│         HOST (TENANT)            │  │    CLIENT (ANUNCIANTE)   │
│    Cliente do Sistema            │  │    Quem Anuncia          │
│                                  │  │                          │
│  • Instala totens e TVs          │  │  • Cria campanhas        │
│  • Usa o software                │  │  • Faz upload de mídias  │
│  • Autentica usuários            │  │  • Compra espaço         │
│  • Paga assinatura               │  │  • Não controla hardware │
│                                  │  │                          │
│  ┌──────────────┐                │  │  ┌──────────────────┐   │
│  │   users      │                │  │  │   campaigns      │   │
│  │   (host_id)  │                │  │  │   (client_id)    │   │
│  └──────────────┘                │  │  └──────────────────┘   │
│                                  │  │                          │
│  ┌──────────────┐                │  │  ┌──────────────────┐   │
│  │ subscriptions│                │  │  │    medias        │   │
│  │   (host_id)  │                │  │  │   (client_id)    │   │
│  └──────────────┘                │  │  └──────────────────┘   │
│                                  │  │                          │
│  ┌──────────────┐                │  │                          │
│  │   billing    │                │  │                          │
│  │   (host_id)  │                │  │                          │
│  └──────────────┘                │  │                          │
│         │                        │  │                          │
│         │                        │  │                          │
│         └──────────┐             │  │             ┌────────────┘
│                    │             │  │             │
│         ┌──────────▼─────────────▼──▼─────────────▼─────────┐
│         │         campaign_totems (N:M)                     │
│         │         (Ligação entre anunciante e totens)      │
│         └───────────────────────────────────────────────────┘
│                    │
│         ┌──────────▼──────────┐
│         │     HOST            │
│         │  (via local_id)     │
│         │                     │
│         │  ┌──────────────┐   │
│         │  │   locals     │   │
│         │  │  (host_id)   │   │
│         │  └──────┬───────┘   │
│         │         │           │
│         │  ┌──────▼───────┐   │
│         │  │   totems     │   │
│         │  │  (local_id)  │   │ ❌ NÃO tem client_id!
│         │  └──────┬───────┘   │
│         │         │           │
│         │  ┌──────▼───────┐   │
│         │  │  smart_tvs   │   │
│         │  │  (totem_id)  │   │
│         │  └──────────────┘   │
│         └─────────────────────┘
```

**Legenda:**
- 🔵 **HOST** = Tenant (cliente do sistema)
- 🟢 **CLIENT** = Anunciante (quem faz anúncios)
- ⚫ **TOTEM** = Edge node (micro-servidor)
- ⚪ **SMART TV** = Display

---

### 1. Hierarquia Organizacional

#### **clients** (Anunciantes - NÃO são tenants)
- **Papel:** Anunciantes que criam campanhas e mídias
- **Relacionamentos:**
  - `1:N` → `campaigns` ✅ (anunciante cria campanhas)
  - `1:N` → `medias` ✅ (anunciante cria mídias)
  - `1:N` → `advertiser_billing` ✅ (anunciante paga por publicidade)
  - `N:N` → `hosts` (via `campaign_totems` → `totems` → `locals` → `hosts`)
- **Observações:**
  - ✅ **CORRETO:** CLIENTs são anunciantes, não tenants
  - ✅ CLIENT **NÃO tem relacionamento direto com `users`** (users pertencem ao HOST)
  - ✅ CLIENT **TEM billing próprio** (anunciante paga por campanhas/anúncios)
  - ⚠️ **PROBLEMA:** Tabela `billing` atual tem apenas `client_id`, mas precisa suportar billing de HOST também

#### **hosts** (Clientes que Instalam Totens - NÃO são tenants)
- **Papel:** Clientes que **instalam e operam totens** no sistema SmartSignage
- **Observação IMPORTANTE:** HOST não é tenant. **TENANT = SmartSignage Pro** (a plataforma em si)
- **Modelos de Negócio:**
  - **Modelo A:** HOST recebe percentual (revenue share) por exibir anúncios
  - **Modelo B:** HOST paga para usar o sistema (subscription)
- **Relacionamentos:**
  - `1:N` → `locals` ✅
  - `1:N` → `users` (via `client_id`? ⚠️ **DEVERIA SER host_id**)
  - `1:N` → `subscriptions` (via `client_id`? ⚠️ **DEVERIA SER host_id** - se Modelo B)
  - `1:N` → `host_billing` ✅ (HOST pode receber % OU pagar subscription)
  - `N:N` → `clients` (via `campaign_totems` - anunciantes exibem em totens deste host)
- **Observações:**
  - ✅ Hierarquia geográfica bem estruturada: `hosts` → `locals` → `totems`
  - ⚠️ **PROBLEMA CRÍTICO:** `users.client_id` deveria ser `users.host_id` (users pertencem ao HOST)
  - ⚠️ **PROBLEMA CRÍTICO:** `subscriptions.client_id` deveria ser `subscriptions.host_id` (se Modelo B)
  - ⚠️ **PROBLEMA CRÍTICO:** `billing` precisa suportar ambos CLIENT e HOST (ver análise detalhada em `ANALISE_BILLING_MODELO_NEGOCIO.md`)

#### **TENANT = SmartSignage Pro** (A Plataforma)
- **Papel:** Operador do sistema, dono da plataforma
- **Recebe receita de:**
  - CLIENTs (anunciantes) que pagam por anúncios
  - HOSTs que pagam subscription (se Modelo B)
- **Paga para:**
  - HOSTs que recebem revenue share (se Modelo A)
- **Observações:**
  - ✅ TENANT não é uma entidade no banco (é o operador do sistema)
  - ✅ TODOS os billings passam pelo TENANT (plataforma)

#### **locals** (Locais do Host)
- **Papel:** Locais físicos onde totens estão instalados (ex: loja específica)
- **Relacionamentos:**
  - `N:1` → `hosts` ✅
  - `1:N` → `totems` ✅
- **Observações:**
  - ✅ Estrutura correta: local pertence a host, totem pertence a local

### 2. Dispositivos e Totens

#### **totems** (Micro-servidores Edge)
- **Papel:** Pequenos servidores edge que controlam Smart TVs
- **Colunas Importantes:**
  - `totem_id`, `identifier`, `uin`, `device_id`
  - `local_id` (FK → `locals`) ✅ **CORRETO** (totem pertence a local/host)
  - `client_id` (FK → `clients`) ❌ **ERRO CONCEITUAL**
  - `status`, `last_heartbeat`
- **Relacionamentos Múltiplos:**
  - `1:1` → `smart_tvs` ✅ (totem controla TV)
  - `1:1` → `totem_ml_config` ✅
  - `1:N` → `playlists` ✅
  - `N:M` → `campaigns` (via `campaign_totems`) ✅ (totem pode exibir campanhas de múltiplos clients)
  - `1:N` → `execution_logs` ✅
  - `1:N` → `analytics_sessions` ✅
  - `1:N` → `remote_commands` ✅
  - `1:N` → `interaction_logs` ✅
- **Observações:**
  - ❌ **ERRO CRÍTICO:** `totems.client_id` é **conceitualmente errado**
    - Totem **NÃO pertence a CLIENT (anunciante)**
    - Totem **pertence a HOST** (via `local_id` → `locals` → `hosts`)
    - Totem **pode exibir campanhas de múltiplos CLIENTs** (via `campaign_totems`)
  - ✅ Suporte robusto para monitoramento e controle
  - ✅ Arquitetura edge computing bem implementada

### 3. Campanhas e Conteúdo

#### **campaigns**
- **Estrutura:**
  - `campaign_id`, `client_id`, `title`, `campaign_type`
  - `status`, `start_date`, `end_date`
- **Relacionamentos:**
  - `1:N` → `campaign_playlists` (tabela associativa)
  - `1:N` → `campaign_totems` (tabela associativa)
  - `1:N` → `qr_codes`
  - `1:N` → `short_links`
  - `1:N` → `execution_logs`
- **Observações:**
  - ✅ Flexibilidade para múltiplas playlists e totens
  - ✅ Suporte a agendamento temporal

#### **medias**
- **Estrutura:**
  - `media_id`, `client_id`, `name`, `file_path`
  - `media_type`, `duration_seconds`, `size_bytes`
  - `status` (draft, review, published, archived)
- **Relacionamentos:**
  - `1:N` → `playlist_items`
  - `1:N` → `execution_logs`
  - `1:N` → `tags` (para interação)
  - `1:N` → `recognized_persons` (para personalização)
- **Observações:**
  - ✅ Workflow de aprovação suportado
  - ✅ Suporte a múltiplos tipos de mídia

#### **playlists**
- **Estrutura:**
  - `playlist_id`, `totem_id`, `campaign_id`, `client_id`
  - `name`, `description`, `is_active`
- **Relacionamentos:**
  - `1:N` → `playlist_items`
  - `N:1` → `totems` (playlist específica de totem)
  - `N:1` → `campaigns` (playlist de campanha)
- **Observações:**
  - ⚠️ **AMBIGUIDADE:** Playlist pode ser de totem OU campanha? Como distinguir?
  - ⚠️ **POTENCIAL PROBLEMA:** `client_id` redundante? Já está via `totem_id` ou `campaign_id`

#### **playlist_items**
- **Tabela Associativa:**
  - `playlist_id` (FK → `playlists`)
  - `media_id` (FK → `medias`)
  - `display_seconds`, `order_index`
- **Observações:**
  - ✅ Ordem e duração configuráveis

### 4. Analytics e Monitoramento

#### **analytics_sessions**
- **Estrutura:**
  - `session_id`, `totem_id`, `start_time`, `end_time`
- **Relacionamentos:**
  - `1:N` → `analytics_emotions`
  - `1:N` → `analytics_gestures`
- **Observações:**
  - ✅ Sessões bem estruturadas para analytics

#### **execution_logs**
- **Estrutura:**
  - `totem_id`, `campaign_id`, `media_id`, `client_id`
  - `playlist_id`, `event_type`, `timestamp`
- **Observações:**
  - ✅ Logging abrangente para auditoria
  - ⚠️ **REDUNDÂNCIA:** `client_id` pode ser derivado de `totem_id` ou `campaign_id`

#### **event_logs**
- **Estrutura:**
  - `event_type`, `entity_type`, `entity_id`
  - `totem_id`, `campaign_id`, `media_id`
  - `metadata` (JSONB)
- **Observações:**
  - ✅ Flexível para diferentes tipos de eventos
  - ✅ JSONB para metadados dinâmicos

### 5. RBAC (Role-Based Access Control)

#### **users**
- **Estrutura:**
  - `id`, `username`, `email`, `password_hash`
  - `role` (admin, manager, operator, viewer, client)
  - `client_id` (FK → `clients`)
- **Relacionamentos:**
  - `N:M` → `roles` (via `user_roles`)
  - `1:N` → `audit_logs`
  - `1:N` → `user_two_factor`
- **Observações:**
  - ✅ Suporte a múltiplos roles por usuário
  - ✅ 2FA implementado

#### **roles** e **permissions**
- **Estrutura:**
  - `role_id`, `name`, `description`
  - `permission_id`, `resource`, `action`
- **Relacionamentos:**
  - `N:M` → `permissions` (via `role_permissions`)
- **Observações:**
  - ✅ RBAC granular e flexível

### 6. Billing e Assinaturas

#### **plans**
- **Estrutura:**
  - `plan_id`, `name`, `slug`, `price_monthly`, `price_yearly`
  - `features` (JSONB), `limits` (JSONB)
- **Relacionamentos:**
  - `1:N` → `subscriptions`

#### **subscriptions**
- **Estrutura:**
  - `subscription_id`, `client_id`, `plan_id`
  - `stripe_subscription_id`, `status`
- **Relacionamentos:**
  - `1:N` → `billing`
- **Observações:**
  - ✅ Integração com Stripe
  - ✅ Features e limites configuráveis via JSONB

### 7. ML/AI e Interatividade

#### **totem_ml_config**
- **Estrutura:**
  - `totem_id` (FK → `totems`)
  - Configurações de ML (JSONB)
- **Observações:**
  - ✅ Configuração por totem

#### **emotion_data**, **gesture_data**, **behavior_data**
- **Estrutura:**
  - `totem_id`, `session_id`, dados específicos
- **Observações:**
  - ✅ Dados separados por tipo
  - ⚠️ **POTENCIAL PROBLEMA:** `session_id` não tem FK explícita?

#### **tags** e **recognized_persons**
- **Estrutura:**
  - `tag_id`, `tag_type` (RFID, NFC, QR, barcode)
  - `person_id`, `features` (JSON)
- **Relacionamentos:**
  - `1:N` → `interaction_logs`
- **Observações:**
  - ✅ Suporte a múltiplos tipos de interação

### 8. Controle Remoto

#### **remote_commands**
- **Estrutura:**
  - `command_id`, `totem_id`, `user_id` (created_by)
  - `command_type`, `status`, `parameters` (JSONB)
- **Observações:**
  - ✅ Rastreamento de comandos remotos

### 9. OTA Updates

#### **ota_updates**
- **Estrutura:**
  - `id`, `version`, `platform`, `file_path`
  - `status`, `rollout_percentage`
- **Relacionamentos:**
  - `1:N` → `totem_update_status`
- **Observações:**
  - ✅ Suporte a rollout gradual

### 10. SmartDisplayFX (Efeitos Visuais)

#### **fx_effects**, **fx_rules**, **fx_timelines**
- **Estrutura:**
  - Efeitos, regras e timelines para orquestração visual
- **Relacionamentos:**
  - `fx_sites` → `fx_totem_sites` → `totems`
- **Observações:**
  - ✅ Sistema complexo de orquestração de efeitos

---

## 🔗 Relacionamentos Principais

### Diagrama de Relacionamentos Críticos

```
┌─────────┐
│ clients │ (Raiz Multi-tenant)
└────┬────┘
     │
     ├───→ users (1:N)
     ├───→ campaigns (1:N)
     ├───→ medias (1:N)
     ├───→ subscriptions (1:N)
     └───→ billing (1:N)

┌─────────┐     ┌─────────┐     ┌─────────┐
│  hosts  │──→  │ locals  │──→  │ totems  │
└─────────┘     └─────────┘     └────┬────┘
                                     │
                   ┌─────────────────┼─────────────────┐
                   │                 │                 │
              (1:N)              (1:N)              (1:N)
                   │                 │                 │
            ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
            │  playlists  │  │campaign_totems│ │remote_commands│
            └─────────────┘  └──────────────┘  └──────────────┘

┌──────────┐     ┌──────────────┐     ┌─────────┐
│campaigns │──→  │campaign_playlists│  │playlists│
└──────────┘     └──────────────┘     └────┬────┘
                                            │
                                            │ (1:N)
                                            │
                                     ┌──────▼──────┐
                                     │playlist_items│
                                     └──────┬──────┘
                                            │ (N:1)
                                            │
                                     ┌──────▼──────┐
                                     │   medias    │
                                     └─────────────┘
```

### Relacionamentos N:N Identificados

1. **campaigns ↔ playlists** (via `campaign_playlists`)
   - ✅ Tabela associativa bem estruturada
   - ✅ Permite múltiplas playlists por campanha

2. **campaigns ↔ totems** (via `campaign_totems`)
   - ✅ Tabela associativa com dados adicionais
   - ✅ Agendamento por totem

3. **users ↔ roles** (via `user_roles`)
   - ✅ RBAC flexível

4. **roles ↔ permissions** (via `role_permissions`)
   - ✅ Permissões granulares

5. **totems ↔ fx_sites** (via `fx_totem_sites`)
   - ✅ Orquestração de efeitos visuais

---

## 🎯 Análise por Módulo Funcional

### 1. Módulo de Organização e Localização

**Forças:**
- ✅ Hierarquia clara: `hosts` → `locals` → `totems` (TENANT = HOST)
- ✅ CLIENTs (anunciantes) separados de HOSTs (tenants)
- ✅ Multi-tenancy conceitualmente correto (HOST é tenant)

**Fraquezas:**
- ❌ `totems.client_id` é **ERRO CONCEITUAL** (totem não pertence a anunciante)
- ❌ `users.client_id`, `subscriptions.client_id`, `billing.client_id` deveriam ser `host_id`
- ⚠️ Risco de inconsistência se totem mudar de local

**Recomendações:**
- **URGENTE:** Remover `totems.client_id` (totem pertence a HOST via local_id)
- **URGENTE:** Criar migração para renomear `client_id` → `host_id` em `users`, `subscriptions`, `billing`
- Adicionar VIEW para derivar host_id de totem quando necessário

### 2. Módulo de Campanhas e Conteúdo

**Forças:**
- ✅ Flexibilidade para múltiplas playlists por campanha
- ✅ Suporte a agendamento temporal
- ✅ Workflow de aprovação

**Fraquezas:**
- ⚠️ `playlists` pode ser de totem OU campanha (ambíguo)
- ⚠️ `playlists.client_id` pode ser redundante

**Recomendações:**
- Clarificar se playlist é sempre associada a campanha OU totem
- Considerar separar em `campaign_playlists` e `totem_playlists`

### 3. Módulo de Analytics

**Forças:**
- ✅ Sessões bem estruturadas
- ✅ Separação por tipo de dados (emoções, gestos, comportamentos)

**Fraquezas:**
- ⚠️ `session_id` em `emotion_data`, `gesture_data` não tem FK explícita
- ⚠️ Dados podem ficar órfãos

**Recomendações:**
- Adicionar FK para `analytics_sessions` ou `ml_sessions`
- Considerar constraints para garantir integridade

### 4. Módulo de RBAC

**Forças:**
- ✅ RBAC granular e flexível
- ✅ Suporte a múltiplos roles por usuário
- ✅ 2FA implementado

**Fraquezas:**
- ⚠️ Campo `role` em `users` pode conflitar com `user_roles`
- ⚠️ Ambiguidade entre role direta e roles via tabela associativa

**Recomendações:**
- Decidir: usar apenas `user_roles` OU apenas `role` direto
- Se ambos, documentar claramente a prioridade

### 5. Módulo de Billing

**Forças:**
- ✅ Integração com Stripe
- ✅ Features e limites configuráveis via JSONB

**Fraquezas:**
- ⚠️ Sem histórico de mudanças de plano
- ⚠️ Sem suporte a upgrades/downgrades graduais

**Recomendações:**
- Adicionar tabela de histórico de assinaturas
- Suportar períodos pro-rata

### 6. Módulo de Controle Remoto

**Forças:**
- ✅ Rastreamento completo de comandos
- ✅ Estados bem definidos

**Fraquezas:**
- ⚠️ Sem retry automático configurável
- ⚠️ Sem timeout por tipo de comando

**Recomendações:**
- Adicionar configurações de retry e timeout

### 7. Módulo SmartDisplayFX

**Forças:**
- ✅ Sistema complexo e flexível
- ✅ Suporte a múltiplos sites e totens

**Fraquezas:**
- ⚠️ Estrutura complexa pode dificultar manutenção
- ⚠️ Regras em JSONB podem ser difíceis de validar

**Recomendações:**
- Documentar estrutura JSONB das regras
- Considerar validação via triggers ou constraints

---

## ⚠️ Problemas Identificados

### 1. Erros Conceituais Críticos

#### **Problema 1: client_id em totems é CONCEITUALMENTE ERRADO**
```sql
totems (
    totem_id,
    local_id,      -- FK → locals ✅ CORRETO (totem pertence a HOST)
    client_id,     -- FK → clients ❌ ERRADO! Totem NÃO pertence a anunciante
    ...
)
```
**Análise:**
- Totem **pertence a HOST** (via `local_id` → `locals` → `hosts`)
- Totem **NÃO pertence a CLIENT** (anunciante)
- Totem **pode exibir campanhas de múltiplos CLIENTs** via `campaign_totems`
- **Risco:** Modelo de dados confunde tenant (HOST) com anunciante (CLIENT)

**Recomendações:**
- **URGENTE:** Remover `totems.client_id` completamente
- Totem sempre pertence a HOST (via local_id)
- Campanhas se associam a totens via `campaign_totems` (N:M)

#### **Problema 2: users e subscriptions usam client_id mas deveriam usar host_id**
```sql
users (
    id,
    client_id,     -- ❌ DEVERIA SER host_id (users pertencem ao HOST tenant)
    ...
)

subscriptions (
    subscription_id,
    client_id,     -- ❌ DEVERIA SER host_id (assinatura é do HOST)
    ...
)

billing (
    billing_id,
    client_id,     -- ❌ DEVERIA SER host_id (cobrança é do HOST)
    ...
)
```
**Análise:**
- Users e subscriptions **pertencem ao HOST**, não ao CLIENT (anunciante)
- HOST não é tenant (TENANT = SmartSignage Pro), mas HOST é quem **opera** o sistema
- **Risco:** Modelo atual mistura anunciante com operador, causando confusão

**Recomendações:**
- **URGENTE:** Criar migração para renomear `client_id` → `host_id` em `users` e `subscriptions`
- Atualizar todas as queries e código que usam esses campos
- **NOTA:** Billing precisa suportar AMBOS CLIENT e HOST (ver `ANALISE_BILLING_MODELO_NEGOCIO.md`)

#### **Problema 3: playlists.client_id Redundante ou Errado**
```sql
playlists (
    playlist_id,
    totem_id,      -- FK → totems (opcional)
    campaign_id,   -- FK → campaigns (opcional)
    client_id,     -- FK → clients ⚠️ REDUNDANTE?
    ...
)
```
**Análise:**
- `client_id` pode ser derivado via `totem_id` OU `campaign_id`
- **Risco:** Ambiguidade se ambos `totem_id` e `campaign_id` estiverem preenchidos

**Recomendações:**
- Opção A: Remover `client_id` e derivar via VIEW
- Opção B: Adicionar constraint CHECK para garantir apenas um dos dois preenchidos

#### **Problema 4: execution_logs.client_id - Qual é o correto?**
```sql
execution_logs (
    totem_id,      -- FK → totems
    campaign_id,   -- FK → campaigns
    media_id,      -- FK → medias
    client_id,     -- FK → clients ⚠️ REDUNDANTE?
    ...
)
```
**Análise:**
- `execution_logs.client_id` pode referir-se a:
  - CLIENT (anunciante) da campanha? Ou
  - HOST (tenant) do totem?
- **Risco:** Ambiguidade sobre qual "cliente" está sendo logado

**Recomendações:**
- **Decisão necessária:** O que `execution_logs.client_id` representa?
  - Se for HOST: renomear para `host_id` e derivar via `totem_id` → `local_id` → `host_id`
  - Se for CLIENT: manter mas derivar via `campaign_id` → `client_id`
  - **Sugestão:** Adicionar ambos `host_id` e `advertiser_client_id` para clareza

### 2. Nomenclatura Confusa

#### **Problema 5: Uso Inconsistente de "client_id"**
**Análise:**
- O campo `client_id` é usado para duas coisas diferentes:
  1. Anunciante (CLIENT) - em `campaigns`, `medias`
  2. Tenant (HOST) - em `users`, `subscriptions`, `billing`, `totems`
- Isso causa **confusão conceitual** grave

**Recomendações:**
- **Padronizar nomenclatura:**
  - `client_id` = Anunciante (advertiser)
  - `host_id` = Tenant (cliente do sistema)
- Criar aliases/VIEWs para compatibilidade durante migração

### 3. Foreign Keys Ausentes

#### **Problema 6: session_id Sem FK**
```sql
emotion_data (
    totem_id,
    session_id,    -- ⚠️ SEM FK explícita
    ...
)

gesture_data (
    totem_id,
    session_id,    -- ⚠️ SEM FK explícita
    ...
)
```
**Análise:**
- `session_id` pode referenciar `analytics_sessions.session_id` OU `ml_sessions.session_id`
- **Risco:** Dados órfãos, impossível garantir integridade

**Recomendações:**
- Adicionar FK para `analytics_sessions` ou `ml_sessions`
- Ou criar tabela unificada de sessões

### 4. Ambiguidades de Design

#### **Problema 7: playlists Ambíguo (totem OU campanha?)**
```sql
playlists (
    playlist_id,
    totem_id,      -- Opcional
    campaign_id,   -- Opcional
    ...
)
```
**Análise:**
- Playlist pode ser específica de totem OU de campanha
- **Risco:** Ambiguidade se ambos estiverem preenchidos

**Recomendações:**
- Opção A: Separar em `totem_playlists` e `campaign_playlists`
- Opção B: Adicionar constraint CHECK para garantir apenas um preenchido
- Opção C: Criar tabela base `playlists` e tabelas especializadas

#### **Problema 8: users.role vs user_roles**
```sql
users (
    id,
    role,          -- ⚠️ Role direta
    ...
)

user_roles (
    user_id,       -- FK → users
    role_id,       -- FK → roles
    ...
)
```
**Análise:**
- Dois sistemas de roles coexistem
- **Risco:** Conflito de permissões, ambiguidade

**Recomendações:**
- Opção A: Usar apenas `user_roles` (mais flexível)
- Opção B: Usar apenas `role` direto (mais simples)
- Opção C: Documentar prioridade (ex: `user_roles` sobrescreve `role`)

### 5. Performance e Escalabilidade

#### **Problema 9: Índices Potencialmente Ausentes**
**Análise:**
- Consultas frequentes podem não ter índices adequados
- Exemplos:
  - `execution_logs` por `totem_id` + `timestamp`
  - `analytics_sessions` por `totem_id` + `start_time`
  - `event_logs` por `event_type` + `timestamp`

**Recomendações:**
- Auditoria completa de índices
- Criar índices compostos para queries frequentes

#### **Problema 10: JSONB Sem Validação**
**Análise:**
- Múltiplos campos JSONB sem validação (ex: `fx_rules.conditions`, `fx_rules.actions`)
- **Risco:** Dados inválidos, difícil debug

**Recomendações:**
- Adicionar constraints CHECK para validar estrutura JSONB
- Ou usar triggers para validação

---

## 💡 Oportunidades de Melhoria

### 1. Normalização

#### **Melhoria 1: Remover Redundâncias**
- Remover `client_id` redundante de `totems`, `playlists`, `execution_logs`
- Criar VIEWs materializadas para performance se necessário

#### **Melhoria 2: Clarificar Relacionamentos**
- Separar `playlists` em tipos específicos OU adicionar constraints
- Documentar claramente relacionamentos opcionais

### 2. Integridade Referencial

#### **Melhoria 3: Adicionar FKs Ausentes**
- Adicionar FK para `session_id` em `emotion_data`, `gesture_data`
- Adicionar constraints para garantir integridade

#### **Melhoria 4: Constraints de Negócio**
- Adicionar CHECK constraints para:
  - `playlists`: apenas `totem_id` OU `campaign_id` preenchido
  - `campaigns`: `start_date` <= `end_date`
  - `subscriptions`: `current_period_start` <= `current_period_end`

### 3. Performance

#### **Melhoria 5: Índices Estratégicos**
- Criar índices compostos para queries frequentes
- Considerar índices parciais para dados ativos (`is_active = true`)

#### **Melhoria 6: Particionamento**
- Considerar particionar tabelas grandes por data:
  - `execution_logs` por `timestamp`
  - `event_logs` por `timestamp`
  - `analytics_sessions` por `start_time`

### 4. Flexibilidade e Extensibilidade

#### **Melhoria 7: Versionamento de Schema**
- Adicionar `schema_version` em `system_settings`
- Criar tabela de migrações aplicadas

#### **Melhoria 8: Auditoria Completa**
- Adicionar `created_by` e `updated_by` em todas as tabelas importantes
- Criar triggers para log automático de mudanças

### 5. Documentação

#### **Melhoria 9: Comentários SQL**
- Adicionar comentários em todas as tabelas e colunas importantes
- Documentar relacionamentos e constraints

#### **Melhoria 10: Diagrama Visual**
- Criar diagrama ER visual atualizado
- Manter sincronizado com schema

---

## 🔧 Propostas de Refatoração

### Proposta 1: Correção Conceitual - Remover client_id de totems

**Antes:**
```sql
totems (
    totem_id,
    local_id,
    client_id  -- ❌ ERRADO! Totem não pertence a anunciante
)
```

**Depois:**
```sql
totems (
    totem_id,
    local_id  -- ✅ CORRETO! Totem pertence a HOST via local
)

-- VIEW se precisar do host_id frequentemente
CREATE VIEW totems_with_host AS
SELECT 
    t.*,
    h.host_id,
    h.name as host_name
FROM totems t
JOIN locals l ON t.local_id = l.local_id
JOIN hosts h ON l.host_id = h.host_id;
```

**Justificativa:**
- Totem **sempre** pertence a HOST (via local_id)
- Totem pode exibir campanhas de **múltiplos CLIENTs** (via campaign_totems)
- Não faz sentido totem ter client_id direto

### Proposta 2: Clarificação de Playlists

**Opção A: Separar Tabelas**
```sql
-- Playlists base (sem totem_id ou campaign_id)
playlists (
    playlist_id,
    client_id,
    name,
    ...
)

-- Associações específicas
totem_playlists (
    playlist_id,
    totem_id
)

campaign_playlists (
    playlist_id,
    campaign_id
)
```

**Opção B: Constraint CHECK**
```sql
playlists (
    playlist_id,
    totem_id,
    campaign_id,
    client_id,
    ...
    CONSTRAINT chk_playlist_association 
        CHECK (
            (totem_id IS NOT NULL AND campaign_id IS NULL) OR
            (totem_id IS NULL AND campaign_id IS NOT NULL)
        )
)
```

### Proposta 3: Sessões Unificadas

**Antes:**
```sql
analytics_sessions (...)
ml_sessions (...)
-- emotion_data.session_id sem FK
```

**Depois:**
```sql
-- Tabela base de sessões
sessions (
    session_id,
    totem_id,
    session_type,  -- 'analytics' ou 'ml'
    start_time,
    end_time,
    ...
)

-- Tabelas especializadas
analytics_sessions (
    session_id PRIMARY KEY REFERENCES sessions,
    -- campos específicos de analytics
)

ml_sessions (
    session_id PRIMARY KEY REFERENCES sessions,
    -- campos específicos de ML
)

-- Agora emotion_data pode ter FK
emotion_data (
    session_id REFERENCES sessions,
    ...
)
```

### Proposta 4: Migração client_id → host_id em users e subscriptions

**NOTA:** Billing requer análise separada (ver `ANALISE_BILLING_MODELO_NEGOCIO.md`) pois precisa suportar tanto CLIENT quanto HOST.

**Antes:**
```sql
users (
    id,
    client_id,  -- ❌ Confuso: é anunciante ou tenant?
    ...
)

subscriptions (
    subscription_id,
    client_id,  -- ❌ Deveria ser host_id
    ...
)

billing (
    billing_id,
    client_id,  -- ❌ Deveria ser host_id
    ...
)
```

**Depois:**
```sql
users (
    id,
    host_id,  -- ✅ CORRETO! User pertence ao HOST tenant
    ...
)

subscriptions (
    subscription_id,
    host_id,  -- ✅ CORRETO! Assinatura é do HOST
    ...
)

billing (
    billing_id,
    host_id,  -- ✅ CORRETO! Cobrança é do HOST
    ...
)
```

**Migração:**
1. Criar nova coluna `host_id`
2. Popular `host_id` a partir de `client_id` atual (assumindo que client_id atual é na verdade host_id)
3. Atualizar código e queries
4. Remover `client_id` antigo após validação

### Proposta 5: RBAC Unificado

**Opção A: Remover role direto**
```sql
users (
    id,
    -- role removido
    ...
)

-- Usar apenas user_roles
user_roles (
    user_id,
    role_id
)
```

**Opção B: Prioridade Documentada**
```sql
-- Manter ambos, mas documentar:
-- Se user_roles existe, usar user_roles
-- Senão, usar users.role como fallback
-- Criar VIEW ou função para resolver role atual
```

---

## 📊 Métricas de Qualidade do Modelo

### Pontos Fortes
- ✅ **Multi-tenancy:** Bem implementado
- ✅ **RBAC:** Flexível e granular
- ✅ **Auditoria:** Logging abrangente
- ✅ **Extensibilidade:** JSONB para dados flexíveis
- ✅ **Features Avançadas:** ML/AI, FX, Analytics

### Pontos Fracos
- ⚠️ **Redundâncias:** Múltiplos `client_id` redundantes
- ⚠️ **FKs Ausentes:** Alguns relacionamentos sem integridade
- ⚠️ **Ambiguidades:** Alguns relacionamentos ambíguos
- ⚠️ **Performance:** Índices podem ser otimizados
- ⚠️ **Validação:** JSONB sem validação

### Score Geral: **7.5/10**
- Estrutura sólida com algumas oportunidades de melhoria
- Refatorações sugeridas são incrementais (não requerem mudança completa)

---

## 🎯 Conclusão e Próximos Passos

### Resumo Executivo (Após Clarificações)

Com base nas **clarificações críticas** sobre o modelo de negócio:

#### ✅ **O que está CORRETO no modelo atual:**
1. **Separação CLIENT vs HOST** - Conceito correto de anunciante vs tenant
2. **Hierarquia HOST → LOCAL → TOTEM** - Estrutura geográfica bem definida
3. **Campanhas pertencem a CLIENT** - Anunciantes criam campanhas
4. **Totens como edge nodes** - Arquitetura edge computing bem implementada
5. **Relação N:M entre campanhas e totens** - Flexibilidade para exibição

#### ❌ **O que precisa CORRIGIR URGENTEMENTE:**
1. **`totems.client_id`** - ERRO CONCEITUAL (remover completamente)
2. **`users.client_id`** - Deveria ser `host_id` (users pertencem ao HOST tenant)
3. **`subscriptions.client_id`** - Deveria ser `host_id` (assinatura é do HOST)
4. **`billing.client_id`** - Deveria ser `host_id` (cobrança é do HOST)
5. **Nomenclatura confusa** - `client_id` usado para duas coisas diferentes

### 🎯 Modelo Conceitual Correto (Visão Alinhada)

```
┌─────────────────────────────────────────────────────────────┐
│              SMARTDISPLAY ECOSYSTEM                          │
│                                                              │
│  TENANT = SmartSignage Pro (a plataforma, você)             │
│                                                              │
└─────────────────────────────────────────────────────────────┘

HOST → LOCAL → TOTEM → SMART_TV
(operador) (geografia) (edge)  (display)
```

**Fluxo de Billing:**
1. CLIENT paga R$ 1.000 → TENANT (SmartSignage Pro)
2. TENANT retém 30% → R$ 300 (plataforma)
3. TENANT paga 70% → HOST → R$ 700 (revenue share)


re analise esta questao corrija se necessario reflita em todo o sistema qualquer alteracoes decorrentes de isto. 
### Recomendações Prioritárias (Revisadas)

#### **🔴 Prioridade CRÍTICA (Correções Conceituais):**
1. ✅ **Remover `totems.client_id`** - Totem não pertence a anunciante, pertence a HOST via local_id
2. ✅ **Migrar `users.client_id` → `users.host_id`** - Users pertencem ao HOST (operador)
3. ✅ **Migrar `subscriptions.client_id` → `subscriptions.host_id`** - Assinatura é do HOST (se Modelo B)
4. ✅ **Reestruturar `billing`** - Suportar billing de CLIENT (anunciante paga) E HOST (recebe % ou paga)
5. ✅ **Padronizar nomenclatura** - `client_id` = anunciante, `host_id` = operador (não tenant)

#### **🟡 Prioridade ALTA (Integridade e Performance):**
6. ⚠️ Adicionar FKs ausentes para integridade referencial
7. ⚠️ Adicionar constraints CHECK para regras de negócio
8. ⚠️ Otimizar índices para queries frequentes
9. ⚠️ Adicionar validação para campos JSONB

#### **🟢 Prioridade MÉDIA (Melhorias Incrementais):**
10. 📝 Criar diagrama ER visual atualizado
11. 📝 Adicionar comentários SQL em todas as tabelas
12. 📝 Implementar auditoria completa (created_by, updated_by)

### 📋 Plano de Ação Sugerido

#### **Fase 1: Correções Conceituais (CRÍTICO)**
1. Documentar impactos da migração `client_id` → `host_id`
2. Criar scripts de migração para:
   - Remover `totems.client_id`
   - Renomear `users.client_id` → `users.host_id`
   - Renomear `subscriptions.client_id` → `subscriptions.host_id`
   - Reestruturar `billing` (ver `ANALISE_BILLING_MODELO_NEGOCIO.md`)
3. Atualizar código backend (todos os serviços que usam esses campos)
4. Atualizar código frontend (todas as queries e componentes)
5. Testar extensivamente

#### **Fase 2: Integridade Referencial**
1. Adicionar FKs ausentes
2. Adicionar constraints CHECK
3. Criar VIEWs para compatibilidade durante transição

#### **Fase 3: Otimizações**
1. Auditoria de índices
2. Criação de índices estratégicos
3. Validação de campos JSONB

### ⚠️ Pontos de Atenção

1. **Migração de dados:** Garantir que dados existentes sejam preservados
2. **Compatibilidade:** Criar VIEWs/aliases durante período de transição
3. **Testes:** Validar todas as funcionalidades após migração
4. **Documentação:** Atualizar toda documentação de API e código

### 🎉 Benefícios Esperados

Após as correções:
- ✅ **Clareza conceitual:** Separação clara entre operador (HOST), anunciante (CLIENT) e plataforma (TENANT)
- ✅ **Integridade referencial:** FK constraints garantem consistência
- ✅ **Manutenibilidade:** Código mais fácil de entender e manter
- ✅ **Escalabilidade:** Modelo preparado para marketplace de anúncios
- ✅ **Performance:** Índices otimizados para queries frequentes

---

## 📊 Score Final Revisado

### Pontos Fortes: **8/10**
- ✅ Arquitetura edge computing bem implementada
- ✅ Separação correta de conceitos (anunciante vs operador vs plataforma)
- ✅ Features avançadas (ML/AI, FX, Analytics)
- ✅ RBAC flexível e granular

### Pontos Fracos Identificados: **5 problemas críticos** reanalise esta questao corrija se necessario reflita em todo o sistema qualquer alteracoes decorrentes de isto. 

- ❌ `totems.client_id` (erro conceitual) reanalise esta questao corrija se necessario reflita em todo o sistema qualquer alteracoes decorrentes de isto. . 
- ❌ `users.client_id` (deveria ser `host_id`)
- ❌ `subscriptions.client_id` (deveria ser `host_id`)
- ❌ `billing.client_id` (deveria ser `host_id`)
- ⚠️ Nomenclatura confusa

### Score Geral: **7.0/10** → **9.0/10** (após correções)
Com as correções conceituais, o modelo fica muito mais sólido e alinhado com o negócio.

---

**Documento atualizado com clarificações do modelo de negócio. Pronto para debater próximos passos e implementação das correções!**

