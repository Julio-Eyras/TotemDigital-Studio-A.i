# Diagrama Completo do Sistema Smart Signage Pro v2.0

## 🏗️ **ARQUITETURA COMPLETA DO SISTEMA**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ADMINISTRATOR                                 │
│  (Cria Publishers, Planos, Gerencia Acesso, Aprova Contratos)             │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                             │
        ▼                                             ▼
┌───────────────┐                          ┌───────────────┐
│  SUBSCRIBERS  │                          │  PUBLISHERS   │
│ (Anunciantes) │                          │ (Publicadores) │
│               │                          │               │
│ - name        │                          │ - name        │
│ - email       │                          │ - email       │
│ - phone       │                          │ - phone       │
│ - address     │                          │ - contact_name│
│ - is_active   │                          │ - is_active   │
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
│ - subscriber_id  │                      │ - publisher_id   │
│ - plan_id        │                      │ - contract_type  │
│ - contract_number│                      │   (revenue_share, │
│ - contract_type  │                      │    subscription,  │
│ - start_date     │                      │    partnership,   │
│ - end_date       │                      │    hybrid)        │
│ - status         │                      │ - revenue_share_ │
│ - total_amount   │                      │   percentage      │
│ - document_path  │                      │ - subscription_   │
└───────┬──────────┘                      │   amount         │
        │                                 │ - start_date     │
        │ N:1                             │ - end_date       │
        │                                 │ - status         │
        ▼                                 │ - document_path  │
┌──────────────────┐                      └──────────────────┘
│     PLANS        │
│                  │
│ - plan_id        │
│ - name           │
│ - slug           │
│ - price_monthly  │
│ - price_yearly  │
│ - features (JSON)│
│ - limits (JSON)  │
│ - is_active      │
└───────┬──────────┘
        │
        │ 1:N
        │
        ▼
┌──────────────────────────────┐
│  PLAN_PUBLISHER_ACCESS       │
│                              │
│ - plan_id (FK)               │
│ - publisher_id (FK)         │
│ - is_allowed                 │
│ - restrictions (JSON)         │
│   - max_campaigns            │
│   - revenue_share_min        │
│   - priority                 │
│   - time_slots               │
└──────────────┬───────────────┘
               │
               │ N:1
               │
               ▼
┌──────────────────────────────┐
│  SUBSCRIBER_PUBLISHER_ACCESS │
│  (Acesso Real Concedido)     │
│                              │
│ - access_id                  │
│ - subscriber_id (FK)         │
│ - publisher_id (FK)          │
│ - contract_id (FK)           │
│ - plan_id (FK)               │
│ - access_type                │
│   (plan/contract/override)   │
│ - granted_at                 │
│ - expires_at                 │
│ - is_active                  │
└──────────────────────────────┘
```

---

## 📍 **HIERARQUIA PUBLISHER → LOCALS → TOTEMS → SMART TVs**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PUBLISHERS                                            │
│  (Criado apenas por Admin)                                                  │
│                                                                              │
│  - publisher_id (PK)                                                        │
│  - name, email, phone, contact_name                                         │
│  - is_subscriber, is_publisher, client_type                                 │
│  - active                                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LOCALS                                               │
│  (Locais Físicos dos Publishers)                                           │
│                                                                              │
│  - local_id (PK)                                                            │
│  - publisher_id (FK) ───────────────────────┐                             │
│  - name                                      │                             │
│  - address, city, state, zip_code, country  │                             │
│  - latitude, longitude                      │                             │
│  - timezone                                 │                             │
│  - description                              │                             │
│  - is_active                                │                             │
└─────────────────────────────────────────────┼─────────────────────────────┘
                              │                 │
                              │ 1:N             │ Ownership
                              │                 │
                              ▼                 │
┌───────────────────────────────────────────────┼─────────────────────────────┐
│                        TOTEMS                │                             │
│  (Dispositivos de Controle)                 │                             │
│                                              │                             │
│  - totem_id (PK)                            │                             │
│  - local_id (FK) ───────────────┐          │                             │
│  - identifier (único)           │          │                             │
│  - uin (Unique Identifier Number, único)    │                             │
│  - device_id (único)            │          │                             │
│  - name, description           │          │                             │
│  - model, manufacturer          │          │                             │
│  - firmware_version             │          │                             │
│  - status (online/offline)      │          │                             │
│  - last_heartbeat               │          │                             │
│  - is_active                    │          │                             │
└─────────────────────────────────┼──────────┼─────────────────────────────┘
                                  │          │
                                  │ 1:N      │ Ownership
                                  │          │
                                  ▼          │
┌─────────────────────────────────────────────┼─────────────────────────────┐
│                        SMART TVs            │                             │
│  (TVs Controladas pelos Totens)            │                             │
│                                              │                             │
│  - tv_id (PK)                                │                             │
│  - totem_id (FK) ───────────────┐          │                             │
│  - identifier (único)           │          │                             │
│  - device_id (único)            │          │                             │
│  - name                         │          │                             │
│  - brand, model, platform        │          │                             │
│  - firmware_version              │          │                             │
│  - resolution_width, height      │          │                             │
│  - orientation                   │          │                             │
│  - status                        │          │                             │
│  - capabilities (JSON)           │          │                             │
│  - settings (JSON)                │          │                             │
│  - is_active                     │          │                             │
└──────────────────────────────────┼──────────┼─────────────────────────────┘
                                   │          │
                                   │          │
                                   │          │
                    ┌──────────────┴──────────┴──────────────┐
                    │                                         │
                    │  Ownership Chain:                       │
                    │  Smart TV → Totem → Local → Publisher  │
                    │                                         │
                    │  Validação:                             │
                    │  - Admin: Vê tudo                       │
                    │  - Publisher User: Vê apenas seus dados│
                    └─────────────────────────────────────────┘
```

---

## 🎯 **FLUXO DE CAMPANHAS E PLAYLISTS**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUBSCRIBERS                                         │
│  (Anunciantes que criam campanhas)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CAMPAIGNS                                            │
│                                                                              │
│  - campaign_id (PK)                                                        │
│  - subscriber_id (FK) ───────────────┐                                    │
│  - name, description                   │                                    │
│  - start_date, end_date                │                                    │
│  - status (draft/active/paused/ended)  │                                    │
│  - is_active                            │                                    │
└─────────────────────────────────────────┼────────────────────────────────────┘
                              │             │
                              │ N:M         │
                              │             │
        ┌─────────────────────┴─────┐       │
        │                           │       │
        ▼                           ▼       │
┌───────────────┐          ┌───────────────┐│
│   PLAYLISTS   │          │     MEDIA     ││
│               │          │               ││
│ - playlist_id │          │ - media_id     ││
│ - subscriber_ │          │ - subscriber_ ││
│   id (FK)     │          │   id (FK)     ││
│ - name        │          │ - file_name   ││
│ - description │          │ - file_path   ││
│ - is_active   │          │ - status      ││
└───────┬───────┘          └───────┬───────┘│
        │                          │        │
        │ N:M                      │ N:M    │
        │                          │        │
        └──────────┬───────────────┴────────┘
                   │
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              CAMPAIGN_PLAYLISTS & CAMPAIGN_MEDIAS                           │
│                                                                              │
│  campaign_playlists:                                                        │
│    - campaign_id (FK)                                                       │
│    - playlist_id (FK)                                                       │
│    - order, weight                                                          │
│                                                                              │
│  campaign_medias:                                                           │
│    - campaign_id (FK)                                                       │
│    - media_id (FK)                                                          │
│    - order, weight                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              CAMPAIGN_PUBLISHERS                                            │
│  (Campanhas vinculadas a Publishers)                                       │
│                                                                              │
│  - campaign_id (FK)                                                        │
│  - publisher_id (FK)                                                       │
│  - is_active                                                                │
│  - commercial_tier                                                          │
│  - time_sharing_rules (JSON)                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              PLAYLIST ENGINE                                                │
│  (Motor de Geração de Playlists por Totem)                                 │
│                                                                              │
│  Processa:                                                                  │
│  1. Campanhas ativas do subscriber                                          │
│  2. Acesso subscriber → publisher (via subscriber_publisher_access)       │
│  3. Campanhas vinculadas ao publisher (via campaign_publishers)            │
│  4. Regras de commercial tier e time sharing                                │
│  5. Status de mídia e playlists (aprovadas, ativas)                        │
│                                                                              │
│  Gera:                                                                      │
│  - totem_playlists (playlist final do totem)                               │
│  - totem_playlist_items (itens ordenados)                                  │
│  - totem_playlist_generation_log (log de gerações)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TOTEMS                                               │
│  (Recebem playlists geradas pelo engine)                                   │
│                                                                              │
│  - current_playlist_id (FK para totem_playlists)                           │
│  - last_playlist_update                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💰 **FLUXO DE BILLING E REVENUE SHARE**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              SUBSCRIBER_CONTRACTS                                         │
│  (Contratos de Anunciantes)                                                │
│                                                                              │
│  - subscriber paga por plano                                               │
│  - plano define acesso a publishers                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              SUBSCRIBER_BILLING                                             │
│  (Faturamento de Subscribers)                                              │
│                                                                              │
│  - invoices                                                                │
│  - payments                                                                │
│  - subscriptions                                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│              PUBLISHER_CONTRACTS                                            │
│  (Contratos de Publishers)                                                 │
│                                                                              │
│  - revenue_share_percentage (% que publisher recebe)                      │
│  - subscription_amount (valor que publisher paga)                        │
│  - contract_type (revenue_share/subscription/hybrid)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              PUBLISHER_BILLING                                              │
│  (Faturamento de Publishers)                                               │
│                                                                              │
│  - revenue_share_calculations                                              │
│  - payouts                                                                  │
│  - subscriptions (se publisher paga)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              REVENUE SHARE CONSOLIDATED                                     │
│  (Materialized View)                                                       │
│                                                                              │
│  - Consolida revenue share por publisher                                   │
│  - Calcula valores baseados em campanhas executadas                       │
│  - Atualizado periodicamente                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 **FLUXO DE ACESSO E PERMISSÕES**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USERS                                               │
│                                                                              │
│  - user_id (PK)                                                            │
│  - username, email                                                          │
│  - role (admin/publisher_user/subscriber_user)                            │
│  - publisher_id (FK) - se publisher_user                                   │
│  - subscriber_id (FK) - se subscriber_user                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                             │
        ▼                                             ▼
┌───────────────┐                          ┌───────────────┐
│   ADMIN      │                          │ PUBLISHER/    │
│              │                          │ SUBSCRIBER    │
│ - Vê tudo    │                          │ USER          │
│ - Cria tudo  │                          │               │
│ - Gerencia   │                          │ - Vê apenas  │
│   acessos    │                          │   seus dados  │
│              │                          │ - Cria apenas │
│              │                          │   em seu      │
│              │                          │   universo     │
└──────────────┘                          └───────────────┘
```

---

## 📊 **RESUMO DE RELACIONAMENTOS**

### **Subscribers:**
- 1:N → `subscriber_contracts`
- 1:N → `campaigns`
- 1:N → `playlists`
- 1:N → `medias`
- N:M → `publishers` (via `subscriber_publisher_access`)

### **Publishers:**
- 1:N → `publisher_contracts`
- 1:N → `locals`
- N:M → `subscribers` (via `subscriber_publisher_access`)
- N:M → `campaigns` (via `campaign_publishers`)

### **Locals:**
- N:1 → `publishers`
- 1:N → `totems`

### **Totems:**
- N:1 → `locals`
- 1:N → `smart_tvs`
- 1:1 → `totem_playlists` (playlist atual)

### **Smart TVs:**
- N:1 → `totems`

### **Campaigns:**
- N:1 → `subscribers`
- N:M → `playlists` (via `campaign_playlists`)
- N:M → `medias` (via `campaign_medias`)
- N:M → `publishers` (via `campaign_publishers`)

### **Plans:**
- 1:N → `subscriber_contracts`
- N:M → `publishers` (via `plan_publisher_access`)

---

## 🎯 **VALIDAÇÕES DE OWNERSHIP**

### **Hierarquia de Validação:**

```
Admin
  └── Vê e gerencia tudo

Publisher User
  └── Publisher (seu)
      └── Locals (do seu publisher)
          └── Totems (dos seus locals)
              └── Smart TVs (dos seus totens)

Subscriber User
  └── Subscriber (seu)
      └── Campaigns (do seu subscriber)
      └── Playlists (do seu subscriber)
      └── Medias (do seu subscriber)
      └── Publishers (via subscriber_publisher_access)
```

---

**Última atualização:** 2024-12-19
**Versão:** v2.0

