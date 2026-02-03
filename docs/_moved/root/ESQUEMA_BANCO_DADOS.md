# Esquema do Banco de Dados - SmartSignage Pro v2.1

**Versão do Schema:** 2.0.0  
**Banco de Dados:** PostgreSQL 15+  
**Data:** Dezembro 2025

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Principais Entidades](#principais-entidades)
3. [Tabelas Base](#tabelas-base)
4. [Tabelas Dependentes](#tabelas-dependentes)
5. [Billing e Contratos](#billing-e-contratos)
6. [Tabelas de Relacionamento](#tabelas-de-relacionamento)
7. [Analytics e Logs](#analytics-e-logs)
8. [Views e Materialized Views](#views-e-materialized-views)
9. [Índices e Performance](#índices-e-performance)
10. [Triggers e Functions](#triggers-e-functions)
11. [Diagrama ER](#diagrama-er)

---

## Visão Geral

O schema v2.0 representa uma refatoração completa do banco de dados, incorporando:

- ✅ Renomeações: `clients` → `subscribers`, `hosts` → `publishers`
- ✅ Billing separado (`subscriber_billing`, `publisher_billing`)
- ✅ Contratos (`subscriber_contracts`, `publisher_contracts`)
- ✅ Triggers automáticos para `updated_at`
- ✅ Índices otimizados (incluindo parciais e compostos)
- ✅ Views e Materialized Views
- ✅ Validações JSONB e constraints de negócio

### Estrutura dos Scripts SQL

Os scripts SQL estão organizados em partes:

1. `part1-schema-setup.sql` - Setup do schema e versionamento
2. `part2-tables-base.sql` - Tabelas base (sem FKs externas)
3. `part3-tables-dependent.sql` - Tabelas dependentes
4. `part4-billing-contracts.sql` - Billing e contratos
5. `part5-tables-relationships.sql` - Tabelas de relacionamento N:N
6. `part6-tables-other.sql` - Outras tabelas (analytics, logs, ML)
7. `part7-foreign-keys.sql` - Foreign Keys
8. `part8-indexes.sql` - Índices
9. `part9-triggers-functions.sql` - Triggers e funções
10. `part10-views.sql` - Views e Materialized Views

---

## Principais Entidades

### Hierarquia de Entidades

```
PUBLISHERS (Publicadores)
  ├── LOCALS (Locais)
  │     └── TOTEMS (Totens)
  │           └── SMART_TVS (Smart TVs)
  ├── USERS (Usuários)
  ├── SUBSCRIPTIONS (Assinaturas)
  └── PUBLISHER_BILLING (Billing)

SUBSCRIBERS (Anunciantes)
  ├── CAMPAIGNS (Campanhas)
  ├── MEDIAS (Mídias)
  ├── PLAYLISTS (Playlists)
  └── SUBSCRIBER_BILLING (Billing)
```

### Fluxo de Relacionamentos

```
Subscriber → Media
    ↓
  Playlist (candidata) ← Mídias organizadas
    ↓
  Campaign → campaign_playlists → Playlist (associada)
                ↓
            Campaign_Totems → Totem → Local → Publisher
                ↓
        [MIX INTELIGENTE] ← Todas as playlists das campanhas ativas
                ↓
        Playlist Final do Totem (ordenada por regras/IA)
                ↓
            Campaign_Publishers → Publisher → Revenue Share
```

---

## Tabelas Base

### 1. subscribers (Anunciantes/Assinantes)

**Antes:** `clients`

**Descrição:** Anunciantes que compram espaço publicitário na plataforma.

**Campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| subscriber_id | SERIAL PRIMARY KEY | ID único |
| name | TEXT NOT NULL | Nome/Razão Social |
| contact_name | TEXT | Nome do contato |
| email | TEXT UNIQUE | Email |
| phone | TEXT | Telefone |
| whatsapp | TEXT | WhatsApp |
| address | TEXT | Endereço |
| is_active | BOOLEAN DEFAULT true | Status ativo/inativo |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- Um subscriber pode ter múltiplas campanhas (`campaigns`)
- Um subscriber pode ter múltiplas mídias (`medias`)
- Um subscriber pode ter múltiplas playlists (`playlists`)
- Um subscriber pode ter múltiplos billings (`subscriber_billing`)

### 2. publishers (Publicadores)

**Antes:** `hosts`

**Descrição:** Proprietários de totens que disponibilizam displays para exibir campanhas.

**Campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| publisher_id | SERIAL PRIMARY KEY | ID único |
| name | TEXT NOT NULL | Nome/Razão Social |
| contact_name | TEXT | Nome do contato |
| email | TEXT | Email |
| phone | TEXT | Telefone |
| whatsapp | TEXT | WhatsApp |
| description | TEXT | Descrição |
| is_subscriber | BOOLEAN DEFAULT false | Também é subscriber? |
| is_publisher | BOOLEAN DEFAULT true | É publisher? |
| client_type | TEXT DEFAULT 'publisher' | 'subscriber', 'publisher', 'both' |
| active | BOOLEAN DEFAULT true | Status ativo/inativo |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Constraints:**
- `client_type` deve ser 'subscriber', 'publisher' ou 'both'

**Relacionamentos:**
- Um publisher pode ter múltiplos locals (`locals`)
- Um publisher pode ter múltiplos users (`users`)
- Um publisher pode ter múltiplas subscriptions (`subscriptions`)
- Um publisher pode ter múltiplos billings (`publisher_billing`)

### 3. users (Usuários)

**Descrição:** Usuários do sistema com autenticação e autorização.

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | SERIAL PRIMARY KEY | ID único |
| username | TEXT UNIQUE NOT NULL | Nome de usuário |
| email | TEXT UNIQUE NOT NULL | Email |
| password_hash | TEXT NOT NULL | Hash da senha (bcrypt) |
| name | TEXT | Nome completo |
| publisher_id | INTEGER | FK para publishers (se tenant user) |
| subscriber_id | INTEGER | FK para subscribers (se subscriber user) |
| user_type | TEXT | 'admin', 'tenant', 'subscriber', 'publisher' |
| is_tenant_user | BOOLEAN DEFAULT false | É usuário da plataforma? |
| is_active | BOOLEAN DEFAULT true | Status ativo/inativo |
| last_login | TIMESTAMP | Último login |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**Relacionamentos:**
- Um user pode pertencer a um publisher (`publisher_id`)
- Um user pode pertencer a um subscriber (`subscriber_id`)
- Um user pode ter múltiplos roles (`user_roles`)

### 4. roles (Roles)

**Descrição:** Roles/perfis de usuário.

**Campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| role_id | SERIAL PRIMARY KEY | ID único |
| name | TEXT UNIQUE NOT NULL | Nome do role (admin, manager, operator, viewer) |
| description | TEXT | Descrição |
| is_active | BOOLEAN DEFAULT true | Status ativo/inativo |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

### 5. permissions (Permissões)

**Descrição:** Permissões individuais do sistema.

**Campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| permission_id | SERIAL PRIMARY KEY | ID único |
| name | TEXT UNIQUE NOT NULL | Nome da permissão |
| resource | TEXT NOT NULL | Recurso (media, campaign, totem, etc.) |
| action | TEXT NOT NULL | Ação (create, read, update, delete, approve) |
| description | TEXT | Descrição |
| created_at | TIMESTAMP | Data de criação |

---

## Tabelas Dependentes

### 6. locals (Locais)

**Descrição:** Locais físicos onde totens estão instalados.

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| local_id | SERIAL PRIMARY KEY | ID único |
| publisher_id | INTEGER NOT NULL | FK para publishers |
| name | TEXT NOT NULL | Nome do local |
| address | TEXT | Endereço |
| city | TEXT | Cidade |
| state | TEXT | Estado |
| zip_code | TEXT | CEP |
| country | TEXT DEFAULT 'BR' | País |
| latitude | REAL | Latitude |
| longitude | REAL | Longitude |
| timezone | TEXT DEFAULT 'America/Sao_Paulo' | Timezone |
| description | TEXT | Descrição |
| is_active | BOOLEAN DEFAULT true | Status ativo/inativo |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**FK:** `publisher_id` → `publishers.publisher_id`

### 7. totems (Totens)

**Descrição:** Micro-servidores edge que controlam Smart TVs.

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| totem_id | SERIAL PRIMARY KEY | ID único |
| identifier | TEXT UNIQUE NOT NULL | Identificador único |
| uin | TEXT UNIQUE | Unique Identifier Number |
| device_id | TEXT UNIQUE | Device ID único |
| local_id | INTEGER NOT NULL | FK para locals |
| name | TEXT | Nome |
| description | TEXT | Descrição |
| model | TEXT | Modelo |
| manufacturer | TEXT | Fabricante |
| firmware_version | TEXT | Versão do firmware |
| status | TEXT DEFAULT 'offline' | Status (offline, online, error, maintenance, syncing) |
| last_heartbeat | TIMESTAMP | Último heartbeat |
| heartbeat_interval | INTEGER DEFAULT 60 | Intervalo de heartbeat (segundos) |
| network_info | JSONB | Informações de rede (IP, MAC, DNS) |
| capabilities | JSONB | Recursos do totem |
| is_active | BOOLEAN DEFAULT true | Status ativo/inativo |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**FK:** `local_id` → `locals.local_id`

**Constraints:**
- `status` deve ser 'offline', 'online', 'error', 'maintenance' ou 'syncing'

### 8. smart_tvs (Smart TVs)

**Descrição:** Displays físicos controlados pelos totens.

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| tv_id | SERIAL PRIMARY KEY | ID único |
| totem_id | INTEGER NOT NULL | FK para totems (1:1) |
| identifier | TEXT UNIQUE NOT NULL | Identificador único |
| device_id | TEXT UNIQUE | Device ID único |
| name | TEXT | Nome |
| brand | TEXT | Marca (LG, Samsung, Sony) |
| model | TEXT | Modelo |
| platform | TEXT | Plataforma (webOS, Tizen, Android TV) |
| firmware_version | TEXT | Versão do firmware |
| resolution_width | INTEGER | Largura da resolução |
| resolution_height | INTEGER | Altura da resolução |
| orientation | TEXT DEFAULT 'landscape' | Orientação (landscape, portrait) |
| status | TEXT DEFAULT 'offline' | Status (offline, online, playing, error) |
| last_heartbeat | TIMESTAMP | Último heartbeat |
| capabilities | JSONB | Recursos da TV |
| settings | JSONB | Configurações específicas |
| is_active | BOOLEAN DEFAULT true | Status ativo/inativo |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**FK:** `totem_id` → `totems.totem_id`

### 9. campaigns (Campanhas)

**Descrição:** Campanhas publicitárias criadas por subscribers (anunciantes), com atributos comerciais usados na mixagem de conteúdo.

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| campaign_id | SERIAL PRIMARY KEY | ID único |
| subscriber_id | INTEGER NOT NULL | FK para subscribers |
| name | TEXT NOT NULL | Nome da campanha |
| description | TEXT | Descrição |
| commercial_tier | TEXT DEFAULT 'standard' | Tier comercial (premium, standard, remnant) |
| default_time_share_percent | NUMERIC(5, 2) DEFAULT 0 | Share de tempo padrão da campanha (0-100%) |
| max_consecutive_slots | INTEGER DEFAULT 2 | Máximo de slots consecutivos na timeline do totem |
| start_date | TIMESTAMP | Data de início |
| end_date | TIMESTAMP | Data de término |
| status | TEXT DEFAULT 'draft' | Status (draft, active, paused, completed, cancelled) |
| budget | NUMERIC(12, 2) | Orçamento |
| spent | NUMERIC(12, 2) | Valor gasto |
| settings | JSONB | Configurações da campanha |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**FK:** `subscriber_id` → `subscribers.subscriber_id`

### 10. medias (Mídias)

**Descrição:** Arquivos de conteúdo (imagens, vídeos, HTML5).

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| media_id | SERIAL PRIMARY KEY | ID único |
| subscriber_id | INTEGER NOT NULL | FK para subscribers |
| name | TEXT NOT NULL | Nome da mídia |
| description | TEXT | Descrição |
| file_path | TEXT NOT NULL | Caminho do arquivo |
| file_size | BIGINT | Tamanho do arquivo (bytes) |
| mime_type | TEXT | Tipo MIME |
| media_type | TEXT | Tipo (image, video, html5) |
| duration | INTEGER | Duração (segundos, para vídeos) |
| width | INTEGER | Largura (pixels) |
| height | INTEGER | Altura (pixels) |
| metadata | JSONB | Metadados adicionais |
| is_active | BOOLEAN DEFAULT true | Status ativo/inativo |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**FK:** `subscriber_id` → `subscribers.subscriber_id`

### 11. playlists (Playlists)

**Descrição:** Sequências ordenadas de mídias que podem ser atreladas a uma ou mais campanhas, que serão reproduzidas nos totens.

**Conceito Fundamental:**
- Playlists são criadas independentemente e funcionam como **candidatas** a serem usadas em campanhas
- Uma playlist pode ser associada a uma ou múltiplas campanhas
- A **playlist final do totem** é o **mix inteligente** de todas as playlists e campanhas atreladas a ele
- As playlists dos totens são classificadas, ordenadas e/ou disparadas sob regras sistemáticas ou **Inteligência Artificial**, incluindo:
  - Tags de conteúdo
  - Reconhecimento de transeuntes (detecção de público)
  - Análise de sentimento e contexto
  - Priorização por campanha
  - Regras temporais e outras configurações

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| playlist_id | SERIAL PRIMARY KEY | ID único |
| subscriber_id | INTEGER NOT NULL | FK para subscribers |
| name | TEXT NOT NULL | Nome da playlist |
| description | TEXT | Descrição |
| status | TEXT DEFAULT 'draft' | Status (draft, pending_approval, approved, rejected) |
| settings | JSONB | Configurações da playlist |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**FK:** `subscriber_id` → `subscribers.subscriber_id`

### 12. playlist_items (Itens da Playlist)

**Descrição:** Itens individuais de uma playlist (ordem e duração).

**Campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| item_id | SERIAL PRIMARY KEY | ID único |
| playlist_id | INTEGER NOT NULL | FK para playlists |
| media_id | INTEGER NOT NULL | FK para medias |
| order_index | INTEGER NOT NULL | Ordem na playlist |
| duration | INTEGER | Duração de exibição (segundos) |
| transition | TEXT | Transição entre mídias |
| settings | JSONB | Configurações específicas do item |
| created_at | TIMESTAMP | Data de criação |

**FKs:**
- `playlist_id` → `playlists.playlist_id`
- `media_id` → `medias.media_id`

---

## Billing e Contratos

### 13. subscriber_billing (Billing de Anunciantes)

**Descrição:** Cobranças de subscribers (anunciantes que pagam).

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| billing_id | SERIAL PRIMARY KEY | ID único |
| subscriber_id | INTEGER NOT NULL | FK para subscribers |
| campaign_id | INTEGER | FK para campaigns (opcional) |
| billing_type | TEXT NOT NULL | Tipo (advertisement, campaign, media_upload, storage, subscription) |
| amount | NUMERIC(12, 2) NOT NULL | Valor |
| currency | TEXT DEFAULT 'BRL' | Moeda |
| direction | TEXT DEFAULT 'incoming' | Sempre 'incoming' (plataforma recebe) |
| description | TEXT | Descrição |
| invoice_number | TEXT UNIQUE | Número da fatura |
| payment_method | TEXT | Método de pagamento |
| payment_status | TEXT DEFAULT 'pending' | Status (pending, paid, failed, refunded, cancelled) |
| payment_date | TIMESTAMP | Data de pagamento |
| due_date | TIMESTAMP | Data de vencimento |
| stripe_payment_intent_id | TEXT | ID do pagamento Stripe |
| metadata | JSONB | Dados adicionais |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**FKs:**
- `subscriber_id` → `subscribers.subscriber_id`
- `campaign_id` → `campaigns.campaign_id`

**Constraints:**
- `direction` deve ser 'incoming'
- `amount` deve ser > 0

### 14. publisher_billing (Billing de Publicadores)

**Descrição:** Billing de publishers (revenue share e subscriptions).

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| billing_id | SERIAL PRIMARY KEY | ID único |
| publisher_id | INTEGER NOT NULL | FK para publishers |
| campaign_id | INTEGER | FK para campaigns (se revenue share) |
| totem_id | INTEGER | FK para totems (se billing específico) |
| subscription_id | INTEGER | FK para subscriptions (se subscription) |
| billing_type | TEXT NOT NULL | Tipo (revenue_share, payout, subscription, platform_fee) |
| amount | NUMERIC(12, 2) NOT NULL | Valor |
| currency | TEXT DEFAULT 'BRL' | Moeda |
| direction | TEXT NOT NULL | 'outgoing' (publisher recebe) ou 'incoming' (publisher paga) |
| revenue_share_percentage | NUMERIC(5, 2) | % de revenue share (ex: 70.00) |
| original_campaign_amount | NUMERIC(12, 2) | Valor original da campanha |
| platform_fee_amount | NUMERIC(12, 2) | Taxa da plataforma |
| publisher_share_amount | NUMERIC(12, 2) | Valor que publisher recebe |
| description | TEXT | Descrição |
| invoice_number | TEXT UNIQUE | Número da fatura |
| payment_status | TEXT DEFAULT 'pending' | Status |
| payment_date | TIMESTAMP | Data de pagamento |
| due_date | TIMESTAMP | Data de vencimento |
| approved_by | INTEGER | FK para users (quem aprovou) |
| approved_at | TIMESTAMP | Data de aprovação |
| metadata | JSONB | Dados adicionais |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**FKs:**
- `publisher_id` → `publishers.publisher_id`
- `campaign_id` → `campaigns.campaign_id`
- `totem_id` → `totems.totem_id`
- `subscription_id` → `subscriptions.subscription_id`
- `approved_by` → `users.id`

### 15. subscriber_contracts (Contratos de Anunciantes)

**Descrição:** Contratos de anunciantes.

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| contract_id | SERIAL PRIMARY KEY | ID único |
| subscriber_id | INTEGER NOT NULL | FK para subscribers |
| contract_type | TEXT NOT NULL | Tipo do contrato |
| start_date | DATE | Data de início |
| end_date | DATE | Data de término |
| status | TEXT DEFAULT 'draft' | Status |
| terms | TEXT | Termos e condições |
| document_path | TEXT | Caminho do documento (PDF/DOC) |
| metadata | JSONB | Dados adicionais |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**FK:** `subscriber_id` → `subscribers.subscriber_id`

### 16. publisher_contracts (Contratos de Publicadores)

**Descrição:** Contratos de publicadores.

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| contract_id | SERIAL PRIMARY KEY | ID único |
| publisher_id | INTEGER NOT NULL | FK para publishers |
| contract_type | TEXT NOT NULL | Tipo do contrato |
| start_date | DATE | Data de início |
| end_date | DATE | Data de término |
| status | TEXT DEFAULT 'draft' | Status |
| revenue_share_percentage | NUMERIC(5, 2) | % de revenue share |
| terms | TEXT | Termos e condições |
| document_path | TEXT | Caminho do documento (PDF/DOC) |
| metadata | JSONB | Dados adicionais |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**FK:** `publisher_id` → `publishers.publisher_id`

---

## Tabelas de Relacionamento

### 17. subscriptions (Assinaturas de Publishers)

**Descrição:** Assinaturas de publishers (planos de uso do sistema).

**Campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| subscription_id | SERIAL PRIMARY KEY | ID único |
| publisher_id | INTEGER NOT NULL | FK para publishers |
| plan_id | INTEGER NOT NULL | FK para plans |
| status | TEXT DEFAULT 'active' | Status (active, cancelled, expired) |
| start_date | DATE | Data de início |
| end_date | DATE | Data de término |
| stripe_subscription_id | TEXT | ID da assinatura Stripe |
| metadata | JSONB | Dados adicionais |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**FKs:**
- `publisher_id` → `publishers.publisher_id`
- `plan_id` → `plans.plan_id`

### 18. campaign_totems (Campanhas ↔ Totens)

**Importante:** Quando campanhas são associadas a totens através desta tabela, todas as playlists dessas campanhas (via `campaign_playlists`) são coletadas e mixadas pelo sistema para formar a playlist final executada no totem. Essa playlist mixada é classificada, ordenada e disparada seguindo regras sistemáticas e/ou Inteligência Artificial (tags, reconhecimento de transeuntes, sentimento, etc.).

**Descrição:** Relacionamento N:N entre campanhas e totens.

**Campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| campaign_id | INTEGER NOT NULL | FK para campaigns |
| totem_id | INTEGER NOT NULL | FK para totems |
| created_at | TIMESTAMP | Data de criação |

**PK:** `(campaign_id, totem_id)`

### 19. campaign_playlists (Campanhas ↔ Playlists)

**Descrição:** Relacionamento N:N entre campanhas e playlists. Esta tabela associa playlists (candidatas) às campanhas. Uma playlist pode ser usada em múltiplas campanhas, e uma campanha pode usar múltiplas playlists.

**Nota:** Quando campanhas são associadas a totens (via `campaign_totems`), todas as playlists dessas campanhas são coletadas e mixadas para formar a playlist final executada no totem, seguindo regras sistemáticas e/ou IA.

**Campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| campaign_id | INTEGER NOT NULL | FK para campaigns |
| playlist_id | INTEGER NOT NULL | FK para playlists |
| created_at | TIMESTAMP | Data de criação |

**PK:** `(campaign_id, playlist_id)`

### 20. campaign_publishers (Campanhas ↔ Publishers)

**Descrição:** Relacionamento N:N entre campanhas e publishers, com configurações comerciais específicas por publisher/grupo.

**Campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| campaign_id | INTEGER NOT NULL | FK para campaigns |
| publisher_id | INTEGER NOT NULL | FK para publishers |
| revenue_share_percentage | NUMERIC(5, 2) | % específico para este publisher nesta campanha |
| time_share_percent | NUMERIC(5, 2) | Share de tempo específico desta campanha neste publisher (0-100%) |
| daypart_config | JSONB | Configuração por faixas horárias (ex.: `{ "12-13": { "time_share_percent": 50 } }`) |
| min_impressions_per_hour | INTEGER | Número mínimo de impressões por hora (se configurado) |
| max_impressions_per_hour | INTEGER | Número máximo de impressões por hora (se configurado) |
| is_active | BOOLEAN DEFAULT true | Se a relação está ativa |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

**PK:** `(campaign_id, publisher_id)`

### 21. user_roles (Usuários ↔ Roles)

**Descrição:** Relacionamento N:N entre usuários e roles.

**Campos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| user_id | INTEGER NOT NULL | FK para users |
| role_id | INTEGER NOT NULL | FK para roles |
| created_at | TIMESTAMP | Data de criação |

**PK:** `(user_id, role_id)`

---

## Analytics e Logs

### 22. analytics_sessions (Sessões de Analytics)

**Descrição:** Sessões de reprodução de conteúdo.

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| session_id | SERIAL PRIMARY KEY | ID único |
| totem_id | INTEGER | FK para totems |
| campaign_id | INTEGER | FK para campaigns |
| playlist_id | INTEGER | FK para playlists |
| start_time | TIMESTAMP | Hora de início |
| end_time | TIMESTAMP | Hora de término |
| duration | INTEGER | Duração (segundos) |
| metadata | JSONB | Dados adicionais |

### 23. event_logs (Logs de Eventos)

**Descrição:** Logs de eventos do sistema.

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| log_id | SERIAL PRIMARY KEY | ID único |
| event_type | TEXT NOT NULL | Tipo do evento |
| entity_type | TEXT | Tipo da entidade (campaign, totem, media) |
| entity_id | INTEGER | ID da entidade |
| subscriber_id | INTEGER | FK para subscribers |
| publisher_id | INTEGER | FK para publishers |
| description | TEXT | Descrição |
| metadata | JSONB | Dados adicionais |
| created_at | TIMESTAMP | Data de criação |

### 24. execution_logs (Logs de Execução)

**Descrição:** Logs de execução de playlists em totens.

**Campos Principais:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| execution_id | SERIAL PRIMARY KEY | ID único |
| totem_id | INTEGER NOT NULL | FK para totems |
| playlist_id | INTEGER NOT NULL | FK para playlists |
| campaign_id | INTEGER | FK para campaigns |
| start_time | TIMESTAMP | Hora de início |
| end_time | TIMESTAMP | Hora de término |
| status | TEXT | Status (success, error, interrupted) |
| metadata | JSONB | Dados adicionais |

---

## Views e Materialized Views

### Views Simples

- `v_active_campaigns`: Campanhas ativas
- `v_totem_status`: Status consolidado de totens
- `v_publisher_revenue`: Receita de publishers

### Materialized Views

- `mv_publisher_revenue_share_consolidated`: Revenue share consolidado de publishers
- `mv_totem_executions_last_24h`: Execuções de totens nas últimas 24h

**Nota:** Materialized Views precisam ser atualizadas periodicamente:
```sql
REFRESH MATERIALIZED VIEW mv_publisher_revenue_share_consolidated;
REFRESH MATERIALIZED VIEW mv_totem_executions_last_24h;
```

---

## Índices e Performance

### Índices Principais

**Índices Simples:**
- `subscribers.email` (UNIQUE)
- `publishers.email`
- `users.email` (UNIQUE)
- `users.username` (UNIQUE)
- `totems.identifier` (UNIQUE)
- `totems.local_id`
- `campaigns.subscriber_id`
- `medias.subscriber_id`
- `playlists.subscriber_id`

**Índices Compostos:**
- `(campaign_id, totem_id)` em `campaign_totems`
- `(subscriber_id, status)` em `campaigns`
- `(publisher_id, status)` em `publisher_billing`

**Índices Parciais:**
- `WHERE is_active = true` em várias tabelas
- `WHERE status = 'active'` em campaigns

---

## Triggers e Functions

### Triggers Automáticos

**updated_at Trigger:**
- Atualiza automaticamente o campo `updated_at` quando registros são modificados
- Aplicado em todas as tabelas que possuem `updated_at`

**Funções SQL:**

- `update_updated_at_column()`: Função para atualizar `updated_at`
- Funções de validação JSONB
- Funções de derivação de IDs relacionados

---

## Diagrama ER

### Relacionamentos Principais

```
subscribers (1) ────< (N) campaigns
subscribers (1) ────< (N) medias
subscribers (1) ────< (N) playlists
subscribers (1) ────< (N) subscriber_billing

publishers (1) ────< (N) locals
publishers (1) ────< (N) users
publishers (1) ────< (N) subscriptions
publishers (1) ────< (N) publisher_billing

locals (1) ────< (N) totems
totems (1) ────< (1) smart_tvs

campaigns (N) ────< (N) campaign_totems >─── (N) totems
campaigns (N) ────< (N) campaign_playlists >─── (N) playlists
campaigns (N) ────< (N) campaign_publishers >─── (N) publishers

playlists (1) ────< (N) playlist_items >─── (N) medias

users (N) ────< (N) user_roles >─── (N) roles
```

---

## Aplicando o Schema

### Script Master

Execute todos os scripts na ordem:

```bash
psql -U postgres -d smartsignage -f database/smartchannel-db-v2-refactored-apply-all.sql
```

### Scripts Individuais

```bash
psql -U postgres -d smartsignage -f database/smartchannel-db-v2-refactored-part1-schema-setup.sql
psql -U postgres -d smartsignage -f database/smartchannel-db-v2-refactored-part2-tables-base.sql
# ... e assim por diante
```

### Via Node.js

```bash
node backend/scripts/setup-database.js
```

---

## Validação do Schema

Após aplicar o schema, valide:

```sql
-- Verificar número de tabelas
SELECT COUNT(*) as total_tabelas
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- Verificar Foreign Keys
SELECT COUNT(*) as total_fks
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND constraint_type = 'FOREIGN KEY';

-- Verificar triggers
SELECT COUNT(*) as total_triggers
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Verificar índices
SELECT COUNT(*) as total_indices
FROM pg_indexes
WHERE schemaname = 'public';
```

---

## Notas de Migração

### De Schema v1.0 para v2.0

**Renomeações:**
- `clients` → `subscribers`
- `hosts` → `publishers`
- `client_id` → `subscriber_id`
- `host_id` → `publisher_id`

**Novas Tabelas:**
- `subscriber_billing`
- `publisher_billing`
- `subscriber_contracts`
- `publisher_contracts`

**Modificações:**
- `users` agora tem `publisher_id` e `user_type`
- `totems` não tem mais `client_id` (relacionamento via `local_id` → `publisher_id`)

---

**Última Atualização:** Dezembro 2025  
**Versão do Schema:** 2.0.0

Para mais informações, consulte:
- `database/README-V2-REFACTORED.md`
- `MANUAL_TECNICO.md`

