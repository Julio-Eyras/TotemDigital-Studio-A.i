# Diagrama ER Simplificado - Smart Signage Pro v2.1

**Versão do Sistema:** 2.1.0  
**Data:** 2026-01-02

---

## 🎯 **DIAGRAMA ER SIMPLIFICADO (Entidades Principais)**

Este diagrama mostra apenas as entidades principais e seus relacionamentos mais importantes.

```mermaid
erDiagram
    %% Entidades Principais
    SUBSCRIBERS ||--o{ CAMPAIGNS : "cria"
    SUBSCRIBERS ||--o{ MEDIAS : "possui"
    SUBSCRIBERS ||--o{ PLAYLISTS : "cria"
    SUBSCRIBERS ||--o{ SUBSCRIBER_CONTRACTS : "tem"
    SUBSCRIBERS ||--o{ SUBSCRIBER_BILLING : "paga"
    
    PUBLISHERS ||--o{ LOCALS : "possui"
    PUBLISHERS ||--o{ PUBLISHER_CONTRACTS : "tem"
    PUBLISHERS ||--o{ PUBLISHER_BILLING : "recebe/paga"
    
    %% Infraestrutura
    LOCALS ||--o{ TOTEMS : "contém"
    TOTEMS ||--|| SMART_TVS : "controla"
    
    %% Campanhas
    CAMPAIGNS ||--o{ CAMPAIGN_PUBLISHERS : "vinculado"
    CAMPAIGNS ||--o{ CAMPAIGN_TOTEMS : "executa_em"
    CAMPAIGN_PUBLISHERS }o--|| PUBLISHERS : "publisher"
    CAMPAIGN_TOTEMS }o--|| TOTEMS : "totem"
    
    %% Contratos e Acessos
    PLANS ||--o{ SUBSCRIBER_CONTRACTS : "vinculado"
    SUBSCRIBER_CONTRACTS ||--o{ SUBSCRIBER_PUBLISHER_ACCESS : "gera"
    SUBSCRIBER_PUBLISHER_ACCESS }o--|| SUBSCRIBERS : "subscriber"
    SUBSCRIBER_PUBLISHER_ACCESS }o--|| PUBLISHERS : "publisher"
    
    PLANS ||--o{ PLAN_PUBLISHER_ACCESS : "define"
    PLAN_PUBLISHER_ACCESS }o--|| PUBLISHERS : "publisher"
    
    %% Billing
    CAMPAIGNS ||--o{ SUBSCRIBER_BILLING : "gera"
    CAMPAIGNS ||--o{ PUBLISHER_BILLING : "revenue_share"
    
    SUBSCRIBERS {
        int subscriber_id PK
        string name
        string email UK
        boolean is_active
    }
    
    PUBLISHERS {
        int publisher_id PK
        string name
        string email
        boolean active
    }
    
    PLANS {
        int plan_id PK
        string name
        numeric price_monthly
        jsonb features
    }
    
    LOCALS {
        int local_id PK
        int publisher_id FK
        string name
    }
    
    TOTEMS {
        int totem_id PK
        int local_id FK
        string identifier UK
        string status
    }
    
    SMART_TVS {
        int tv_id PK
        int totem_id FK
        string identifier UK
    }
    
    CAMPAIGNS {
        int campaign_id PK
        int subscriber_id FK
        string title
        string status
    }
    
    MEDIAS {
        int media_id PK
        int subscriber_id FK
        string name
        string media_type
    }
    
    PLAYLISTS {
        int playlist_id PK
        int subscriber_id FK
        string name
    }
    
    SUBSCRIBER_CONTRACTS {
        int contract_id PK
        int subscriber_id FK
        int plan_id FK "nullable"
        string status
    }
    
    PUBLISHER_CONTRACTS {
        int contract_id PK
        int publisher_id FK
        numeric revenue_share_percentage
        string status
    }
    
    PLAN_PUBLISHER_ACCESS {
        int plan_id FK
        int publisher_id FK
        boolean is_allowed
    }
    
    SUBSCRIBER_PUBLISHER_ACCESS {
        int access_id PK
        int subscriber_id FK
        int publisher_id FK
        int plan_id FK "nullable"
        boolean is_active
    }
    
    SUBSCRIBER_BILLING {
        int billing_id PK
        int subscriber_id FK
        numeric amount
        string payment_status
    }
    
    PUBLISHER_BILLING {
        int billing_id PK
        int publisher_id FK
        numeric amount
        string direction
    }
```

---

## 📊 **HIERARQUIA DE INFRAESTRUTURA**

```
PUBLISHERS (1)
    │
    └── LOCALS (N)
            │
            └── TOTEMS (N)
                    │
                    └── SMART_TVS (1)
```

---

## 🔄 **FLUXO DE CAMPANHAS**

```
SUBSCRIBERS (1)
    │
    └── CAMPAIGNS (N)
            │
            ├── CAMPAIGN_PUBLISHERS (N) ──→ PUBLISHERS (N)
            │
            └── CAMPAIGN_TOTEMS (N) ──→ TOTEMS (N)
```

---

## 🔐 **FLUXO DE ACESSOS**

```
PLANS (1)
    │
    ├── PLAN_PUBLISHER_ACCESS (N) ──→ PUBLISHERS (N)
    │
    └── SUBSCRIBER_CONTRACTS (N)
            │
            └── SUBSCRIBER_PUBLISHER_ACCESS (N) ──→ PUBLISHERS (N)
```

---

## 💰 **FLUXO DE BILLING**

```
CAMPAIGNS (1)
    │
    ├── SUBSCRIBER_BILLING (N) ──→ SUBSCRIBERS (1)
    │
    └── PUBLISHER_BILLING (N) ──→ PUBLISHERS (1)
```

---

**Última atualização:** 2026-01-02  
**Versão do Documento:** 1.0.0

