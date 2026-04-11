# Diagrama ER Completo - Smart Signage Pro v2.1

**Versão do Sistema:** 2.1.0  
**Data:** 2026-01-02

---

## 📊 **DIAGRAMA ER COMPLETO**

Este documento contém o diagrama ER completo do sistema Smart Signage Pro, incluindo todas as tabelas e relacionamentos.

### **Formato:**
- Diagrama em Mermaid (renderizável em GitHub, GitLab, e editores Markdown)
- Diagrama em texto ASCII (alternativo)
- Legenda e explicações

---

## 🎨 **DIAGRAMA MERMAID**

```mermaid
erDiagram
    %% ============================================
    %% ENTIDADES PRINCIPAIS (Base)
    %% ============================================
    
    SUBSCRIBERS ||--o{ SUBSCRIBER_CONTRACTS : "tem"
    SUBSCRIBERS ||--o{ CAMPAIGNS : "cria"
    SUBSCRIBERS ||--o{ MEDIAS : "possui"
    SUBSCRIBERS ||--o{ PLAYLISTS : "cria"
    SUBSCRIBERS ||--o{ SUBSCRIBER_BILLING : "paga"
    SUBSCRIBERS ||--o{ SUBSCRIBER_PUBLISHER_ACCESS : "acessa"
    
    PUBLISHERS ||--o{ PUBLISHER_CONTRACTS : "tem"
    PUBLISHERS ||--o{ LOCALS : "possui"
    PUBLISHERS ||--o{ SUBSCRIPTIONS : "assina"
    PUBLISHERS ||--o{ PUBLISHER_BILLING : "recebe/paga"
    PUBLISHERS ||--o{ PLAN_PUBLISHER_ACCESS : "configurado"
    PUBLISHERS ||--o{ SUBSCRIBER_PUBLISHER_ACCESS : "acessado"
    PUBLISHERS ||--o{ CAMPAIGN_PUBLISHERS : "vinculado"
    
    PLANS ||--o{ SUBSCRIBER_CONTRACTS : "vinculado"
    PLANS ||--o{ SUBSCRIPTIONS : "oferecido"
    PLANS ||--o{ PLAN_PUBLISHER_ACCESS : "define"
    
    %% ============================================
    %% INFRAESTRUTURA (Hierarquia)
    %% ============================================
    
    PUBLISHERS ||--o{ LOCALS : "possui"
    LOCALS ||--o{ TOTEMS : "contém"
    TOTEMS ||--|| SMART_TVS : "controla"
    
    %% ============================================
    %% CAMPANHAS E MÍDIA
    %% ============================================
    
    CAMPAIGNS ||--o{ CAMPAIGN_MEDIAS : "inclui"
    CAMPAIGNS ||--o{ CAMPAIGN_PLAYLISTS : "usa"
    CAMPAIGNS ||--o{ CAMPAIGN_TOTEMS : "executa_em"
    CAMPAIGNS ||--o{ CAMPAIGN_PUBLISHERS : "vinculado"
    CAMPAIGNS ||--o{ CAMPAIGN_LOCALS : "vinculado"
    CAMPAIGNS ||--o{ QR_CODES : "tem"
    CAMPAIGNS ||--o{ SHORT_LINKS : "tem"
    
    PLAYLISTS ||--o{ PLAYLIST_ITEMS : "contém"
    PLAYLIST_ITEMS }o--|| MEDIAS : "referencia"
    
    MEDIAS }o--|| CAMPAIGN_MEDIAS : "usado_em"
    
    %% ============================================
    %% CONTRATOS E ACESSOS
    %% ============================================
    
    SUBSCRIBER_CONTRACTS }o--o| PLANS : "pode_ter"
    SUBSCRIBER_CONTRACTS ||--o{ SUBSCRIBER_PUBLISHER_ACCESS : "gera"
    
    PLAN_PUBLISHER_ACCESS }o--|| PLANS : "define"
    PLAN_PUBLISHER_ACCESS }o--|| PUBLISHERS : "permite"
    
    SUBSCRIBER_PUBLISHER_ACCESS }o--|| SUBSCRIBERS : "subscriber"
    SUBSCRIBER_PUBLISHER_ACCESS }o--|| PUBLISHERS : "publisher"
    SUBSCRIBER_PUBLISHER_ACCESS }o--o| SUBSCRIBER_CONTRACTS : "via_contrato"
    SUBSCRIBER_PUBLISHER_ACCESS }o--o| PLANS : "via_plano"
    
    %% ============================================
    %% BILLING
    %% ============================================
    
    SUBSCRIBER_BILLING }o--|| SUBSCRIBERS : "cobrado_de"
    SUBSCRIBER_BILLING }o--o| CAMPAIGNS : "relacionado"
    
    PUBLISHER_BILLING }o--|| PUBLISHERS : "publisher"
    PUBLISHER_BILLING }o--o| CAMPAIGNS : "revenue_share"
    PUBLISHER_BILLING }o--o| TOTEMS : "totem_especifico"
    PUBLISHER_BILLING }o--o| SUBSCRIPTIONS : "subscription"
    
    SUBSCRIPTIONS }o--|| PUBLISHERS : "publisher"
    SUBSCRIPTIONS }o--|| PLANS : "plano"
    
    %% ============================================
    %% PLAYLISTS GERADAS (Totem)
    %% ============================================
    
    TOTEMS ||--o{ TOTEM_PLAYLISTS : "tem_playlist"
    SMART_TVS ||--o{ TOTEM_PLAYLISTS : "tem_playlist"
    TOTEM_PLAYLISTS ||--o{ TOTEM_PLAYLIST_ITEMS : "contém"
    TOTEM_PLAYLIST_ITEMS }o--|| MEDIAS : "mídia"
    TOTEM_PLAYLIST_ITEMS }o--o| CAMPAIGNS : "campanha"
    TOTEM_PLAYLIST_ITEMS }o--|| SUBSCRIBERS : "subscriber"
    TOTEM_PLAYLIST_ITEMS }o--|| PUBLISHERS : "publisher"
    
    TOTEMS ||--o{ TOTEM_PLAYLIST_GENERATION_LOG : "log_geracao"
    
    %% ============================================
    %% USUÁRIOS E PERMISSÕES (RBAC)
    %% ============================================
    
    USERS }o--o| PUBLISHERS : "pode_ser_de"
    USERS ||--o{ USER_ROLES : "tem"
    USER_ROLES }o--|| ROLES : "role"
    ROLES ||--o{ ROLE_PERMISSIONS : "tem"
    ROLE_PERMISSIONS }o--|| PERMISSIONS : "permissao"
    
    USERS ||--o{ AUDIT_LOGS : "gera"
    USERS ||--o{ USER_TWO_FACTOR : "tem"
    USERS ||--o{ PASSWORD_RESET_TOKENS : "tem"
    USERS ||--o{ REMOTE_COMMANDS : "cria"
    USERS ||--o{ OTA_UPDATES : "cria"
    USERS ||--o{ REPORTS : "cria"
    USERS ||--o{ DASHBOARD_LAYOUTS : "configura"
    
    %% ============================================
    %% ANALYTICS E LOGS
    %% ============================================
    
    TOTEMS ||--o{ ANALYTICS_SESSIONS : "tem_sessao"
    ANALYTICS_SESSIONS ||--o{ ANALYTICS_EMOTIONS : "detecta"
    ANALYTICS_SESSIONS ||--o{ ANALYTICS_GESTURES : "detecta"
    ANALYTICS_SESSIONS ||--o{ EMOTION_DATA : "emocoes"
    ANALYTICS_SESSIONS ||--o{ GESTURE_DATA : "gestos"
    ANALYTICS_SESSIONS ||--o{ BEHAVIOR_DATA : "comportamentos"
    
    TOTEMS ||--o{ EXECUTION_LOGS : "executa"
    EXECUTION_LOGS }o--o| CAMPAIGNS : "campanha"
    EXECUTION_LOGS }o--o| PLAYLISTS : "playlist"
    EXECUTION_LOGS }o--o| MEDIAS : "mídia"
    EXECUTION_LOGS }o--o| PUBLISHERS : "publisher"
    EXECUTION_LOGS }o--o| SUBSCRIBERS : "subscriber"
    
    TOTEMS ||--o{ EVENT_LOGS : "eventos"
    TOTEMS ||--o{ INTERACTION_LOGS : "interacoes"
    INTERACTION_LOGS }o--o| TAGS : "tag"
    INTERACTION_LOGS }o--o| RECOGNIZED_PERSONS : "pessoa"
    
    TOTEMS ||--o| TOTEM_ML_CONFIG : "config_ml"
    TOTEMS ||--o{ RECOGNIZED_PERSONS : "reconhece"
    
    TAGS }o--o| SUBSCRIBERS : "pode_ser_de"
    TAGS }o--o| PUBLISHERS : "pode_ser_de"
    
    %% ============================================
    %% OTA UPDATES
    %% ============================================
    
    OTA_UPDATES ||--o{ TOTEM_UPDATE_STATUS : "status_por_totem"
    TOTEM_UPDATE_STATUS }o--|| TOTEMS : "totem"
    
    %% ============================================
    %% SMARTDISPLAYFX
    %% ============================================
    
    FX_SITES ||--o{ FX_TOTEM_SITES : "contem"
    FX_TOTEM_SITES }o--|| TOTEMS : "totem"
    FX_SITES ||--o{ FX_TIMELINES : "tem_timeline"
    FX_SITES ||--o{ FX_RULES : "tem_regra"
    FX_EFFECTS ||--o{ FX_RULES : "usado_em"
    
    %% ============================================
    %% OUTRAS ENTIDADES
    %% ============================================
    
    USERS ||--o{ WEBHOOK_CONFIGS : "configura"
    USERS ||--o{ ALERT_RULES : "configura"
    
    %% ============================================
    %% DEFINIÇÕES DAS ENTIDADES
    %% ============================================
    
    SUBSCRIBERS {
        int subscriber_id PK
        string name
        string email UK
        string phone
        boolean is_active
        timestamp created_at
    }
    
    PUBLISHERS {
        int publisher_id PK
        string name
        string email
        string client_type
        boolean active
        timestamp created_at
    }
    
    PLANS {
        int plan_id PK
        string name
        string slug UK
        numeric price_monthly
        jsonb features
        jsonb limits
        boolean is_active
    }
    
    LOCALS {
        int local_id PK
        int publisher_id FK
        string name
        string address
        string city
        real latitude
        real longitude
        boolean is_active
    }
    
    TOTEMS {
        int totem_id PK
        int local_id FK
        string identifier UK
        string uin UK
        string device_id UK
        string status
        timestamp last_heartbeat
        boolean is_active
    }
    
    SMART_TVS {
        int tv_id PK
        int totem_id FK
        string identifier UK
        string device_id UK
        string brand
        string model
        string platform
        string status
        boolean is_active
    }
    
    CAMPAIGNS {
        int campaign_id PK
        int subscriber_id FK
        string title
        string campaign_type
        string commercial_tier
        numeric default_time_share_percent
        timestamp start_date
        timestamp end_date
        string status
        boolean is_active
    }
    
    MEDIAS {
        int media_id PK
        int subscriber_id FK
        string name
        string file_path
        string media_type
        int duration_seconds
        string status
        int approved_by FK
        boolean is_active
    }
    
    PLAYLISTS {
        int playlist_id PK
        int subscriber_id FK
        string name
        jsonb schedule_config
        boolean is_active
    }
    
    PLAYLIST_ITEMS {
        int item_id PK
        int playlist_id FK
        int media_id FK
        int display_seconds
        int order_index
        boolean is_active
    }
    
    SUBSCRIBER_CONTRACTS {
        int contract_id PK
        int subscriber_id FK
        int plan_id FK "nullable"
        string contract_number UK
        string contract_type
        date start_date
        date end_date
        string status
        timestamp signed_by_subscriber_at
    }
    
    PUBLISHER_CONTRACTS {
        int contract_id PK
        int publisher_id FK
        string contract_number UK
        string contract_type
        numeric revenue_share_percentage
        jsonb revenue_share_rules
        numeric subscription_amount
        date start_date
        date end_date
        string status
        timestamp signed_by_publisher_at
    }
    
    PLAN_PUBLISHER_ACCESS {
        int plan_id FK
        int publisher_id FK
        boolean is_allowed
        jsonb restrictions
        primary_key plan_id_publisher_id
    }
    
    SUBSCRIBER_PUBLISHER_ACCESS {
        int access_id PK
        int subscriber_id FK
        int publisher_id FK
        int contract_id FK "nullable"
        int plan_id FK "nullable"
        string access_type
        timestamp granted_at
        timestamp expires_at
        boolean is_active
    }
    
    SUBSCRIBER_BILLING {
        int billing_id PK
        int subscriber_id FK
        int campaign_id FK "nullable"
        string billing_type
        numeric amount
        string direction "always incoming"
        string payment_status
        timestamp payment_date
    }
    
    PUBLISHER_BILLING {
        int billing_id PK
        int publisher_id FK
        int campaign_id FK "nullable"
        int totem_id FK "nullable"
        string billing_type
        numeric amount
        string direction "incoming/outgoing"
        numeric revenue_share_percentage
        string payment_status
        int approved_by FK "nullable"
    }
    
    SUBSCRIPTIONS {
        int subscription_id PK
        int publisher_id FK
        int plan_id FK
        string stripe_subscription_id UK
        string status
        timestamp current_period_start
        timestamp current_period_end
    }
    
    TOTEM_PLAYLISTS {
        int totem_playlist_id PK
        int totem_id FK
        int smart_tv_id FK "nullable"
        int publisher_id FK
        string playlist_hash
        int version
        int total_items
        string status
        timestamp generated_at
    }
    
    TOTEM_PLAYLIST_ITEMS {
        int item_id PK
        int totem_playlist_id FK
        int media_id FK
        int campaign_id FK "nullable"
        int subscriber_id FK
        int publisher_id FK
        int order_index
        int display_seconds
        string commercial_tier
        numeric time_share_percent
    }
    
    USERS {
        int id PK
        string username UK
        string email UK
        string password_hash
        int publisher_id FK "nullable"
        string user_type
        boolean is_tenant_user
        string role
        boolean is_active
    }
    
    ROLES {
        int role_id PK
        string name UK
        string description
        boolean is_active
    }
    
    PERMISSIONS {
        int permission_id PK
        string name UK
        string resource
        string action
    }
    
    USER_ROLES {
        int user_id FK
        int role_id FK
        primary_key user_id_role_id
    }
    
    ROLE_PERMISSIONS {
        int role_id FK
        int permission_id FK
        primary_key role_id_permission_id
    }
    
    CAMPAIGN_MEDIAS {
        int campaign_id FK
        int media_id FK
        int display_seconds
        int order_index
        primary_key campaign_id_media_id
    }
    
    CAMPAIGN_PLAYLISTS {
        int campaign_id FK
        int playlist_id FK
        int priority
        primary_key campaign_id_playlist_id
    }
    
    CAMPAIGN_TOTEMS {
        int campaign_id FK
        int totem_id FK
        timestamp start_date
        timestamp end_date
        int priority
        primary_key campaign_id_totem_id
    }
    
    CAMPAIGN_PUBLISHERS {
        int campaign_id FK
        int publisher_id FK
        numeric revenue_share_percentage
        numeric time_share_percent
        primary_key campaign_id_publisher_id
    }
    
    CAMPAIGN_LOCALS {
        int campaign_id FK
        int local_id FK
        primary_key campaign_id_local_id
    }
    
    QR_CODES {
        int qr_id PK
        int campaign_id FK
        string code UK
        string qr_type
        string content
        string url
        int scan_count
        timestamp expires_at
        boolean is_active
    }
    
    ANALYTICS_SESSIONS {
        int session_id PK
        int totem_id FK
        timestamp start_time
        timestamp end_time
        int duration_seconds
    }
    
    EXECUTION_LOGS {
        bigint log_id PK
        int totem_id FK
        int campaign_id FK "nullable"
        int publisher_id FK "nullable"
        int subscriber_id FK "nullable"
        string event_type
        jsonb event_data
        timestamp timestamp
    }
    
    TOTEM_ML_CONFIG {
        int config_id PK
        int totem_id FK UK
        boolean emotion_detection_enabled
        boolean gesture_detection_enabled
        jsonb config
    }
    
    OTA_UPDATES {
        int id PK
        string version
        string platform
        string file_path
        string status
        int created_by FK
    }
    
    TOTEM_UPDATE_STATUS {
        int id PK
        int ota_update_id FK
        int totem_id FK
        string status
        unique ota_update_id_totem_id
    }
    
    REMOTE_COMMANDS {
        int command_id PK
        int totem_id FK
        int user_id FK
        string command_type
        string status
        jsonb parameters
        jsonb response
    }
    
    AUDIT_LOGS {
        bigint id PK
        int user_id FK "nullable"
        string action
        string entity
        int entity_id
        int publisher_id FK "nullable"
        int subscriber_id FK "nullable"
        timestamp timestamp
    }
    
    REPORTS {
        int report_id PK
        string type
        string title
        string status
        string format
        string file_path
        int created_by FK
    }
    
    SYSTEM_SETTINGS {
        int setting_id PK
        string setting_key UK
        string setting_value
        string setting_type
        string category
    }
```

---

## 📋 **LEGENDA E EXPLICAÇÕES**

### **Símbolos de Relacionamento:**

- `||--o{` = Um para Muitos (1:N) - obrigatório do lado "um"
- `}o--o{` = Muitos para Muitos (N:M) - ambos opcionais
- `||--||` = Um para Um (1:1) - ambos obrigatórios
- `}o--o|` = Muitos para Um (N:1) - opcional do lado "muitos"
- `}o--||` = Muitos para Um (N:1) - obrigatório do lado "um"

### **Tipos de Chaves:**

- `PK` = Primary Key (Chave Primária)
- `FK` = Foreign Key (Chave Estrangeira)
- `UK` = Unique Key (Chave Única)
- `nullable` = Campo opcional (pode ser NULL)

### **Grupos de Entidades:**

#### **1. Entidades Principais:**
- `SUBSCRIBERS` - Anunciantes
- `PUBLISHERS` - Publicadores
- `PLANS` - Planos

#### **2. Infraestrutura:**
- `LOCALS` - Locais físicos
- `TOTEMS` - Micro-servidores edge
- `SMART_TVS` - Displays controlados

#### **3. Conteúdo:**
- `CAMPAIGNS` - Campanhas publicitárias
- `MEDIAS` - Arquivos de mídia
- `PLAYLISTS` - Listas de reprodução
- `PLAYLIST_ITEMS` - Itens das playlists

#### **4. Contratos e Acessos:**
- `SUBSCRIBER_CONTRACTS` - Contratos de anunciantes
- `PUBLISHER_CONTRACTS` - Contratos de publicadores
- `PLAN_PUBLISHER_ACCESS` - Configuração plano → publisher
- `SUBSCRIBER_PUBLISHER_ACCESS` - Acesso real subscriber → publisher

#### **5. Billing:**
- `SUBSCRIBER_BILLING` - Cobranças de anunciantes
- `PUBLISHER_BILLING` - Pagamentos/recebimentos de publicadores
- `SUBSCRIPTIONS` - Assinaturas de publicadores

#### **6. Playlists Geradas:**
- `TOTEM_PLAYLISTS` - Playlists finais por totem/TV
- `TOTEM_PLAYLIST_ITEMS` - Itens das playlists geradas
- `TOTEM_PLAYLIST_GENERATION_LOG` - Log de gerações

#### **7. Usuários e Permissões:**
- `USERS` - Usuários do sistema
- `ROLES` - Papéis (RBAC)
- `PERMISSIONS` - Permissões
- `USER_ROLES` - Relacionamento users ↔ roles
- `ROLE_PERMISSIONS` - Relacionamento roles ↔ permissions

#### **8. Analytics e Logs:**
- `ANALYTICS_SESSIONS` - Sessões de analytics
- `ANALYTICS_EMOTIONS` - Detecção de emoções
- `ANALYTICS_GESTURES` - Detecção de gestos
- `EXECUTION_LOGS` - Logs de execução
- `EVENT_LOGS` - Logs de eventos
- `INTERACTION_LOGS` - Logs de interações

#### **9. ML/AI:**
- `TOTEM_ML_CONFIG` - Configuração ML por totem
- `EMOTION_DATA` - Dados de emoções
- `GESTURE_DATA` - Dados de gestos
- `BEHAVIOR_DATA` - Dados de comportamento
- `RECOGNIZED_PERSONS` - Pessoas reconhecidas
- `TAGS` - Tags RFID/NFC/QR

#### **10. OTA e Controle:**
- `OTA_UPDATES` - Atualizações OTA
- `TOTEM_UPDATE_STATUS` - Status de atualização por totem
- `REMOTE_COMMANDS` - Comandos remotos

#### **11. Outros:**
- `QR_CODES` - QR Codes
- `SHORT_LINKS` - Links encurtados
- `REPORTS` - Relatórios
- `AUDIT_LOGS` - Logs de auditoria
- `SYSTEM_SETTINGS` - Configurações do sistema
- `FX_SITES` - Sites SmartDisplayFX
- `FX_EFFECTS` - Efeitos visuais
- `WEBHOOK_CONFIGS` - Configurações de webhooks

---

## 🔗 **RELACIONAMENTOS PRINCIPAIS**

### **Hierarquia de Infraestrutura:**
```
PUBLISHERS (1) → LOCALS (N) → TOTEMS (N) → SMART_TVS (1)
```

### **Fluxo de Campanhas:**
```
SUBSCRIBERS (1) → CAMPAIGNS (N) → CAMPAIGN_PUBLISHERS (N) → PUBLISHERS (N)
                                    ↓
                            CAMPAIGN_TOTEMS (N) → TOTEMS (N)
                                    ↓
                            TOTEM_PLAYLISTS (N) → TOTEM_PLAYLIST_ITEMS (N) → MEDIAS (N)
```

### **Fluxo de Acessos:**
```
PLANS (1) → PLAN_PUBLISHER_ACCESS (N) → PUBLISHERS (N)
    ↓
SUBSCRIBER_CONTRACTS (N) → SUBSCRIBER_PUBLISHER_ACCESS (N) → PUBLISHERS (N)
```

### **Fluxo de Billing:**
```
CAMPAIGNS (1) → EXECUTION_LOGS (N) → PUBLISHER_BILLING (N) → PUBLISHERS (1)
SUBSCRIBERS (1) → CAMPAIGNS (N) → SUBSCRIBER_BILLING (N)
```

---

## 📊 **ESTATÍSTICAS DO SCHEMA**

- **Total de Tabelas:** ~60+
- **Tabelas Principais:** 15
- **Tabelas de Relacionamento N:M:** 10+
- **Tabelas de Logs/Analytics:** 10+
- **Tabelas de Configuração:** 5+
- **Tabelas de Segurança:** 5+

---

## 🎯 **NOTAS IMPORTANTES**

1. **Contratos Separados:**
   - `SUBSCRIBER_CONTRACTS` tem `plan_id` (opcional)
   - `PUBLISHER_CONTRACTS` NÃO tem `plan_id`

2. **Infraestrutura:**
   - Apenas ADMIN pode criar/editar/deletar LOCALS, TOTEMS, SMART_TVS
   - Publisher User pode apenas visualizar

3. **Playlists:**
   - `PLAYLISTS` pertence a SUBSCRIBERS
   - `TOTEM_PLAYLISTS` são geradas automaticamente pelo sistema

4. **Acessos:**
   - `SUBSCRIBER_PUBLISHER_ACCESS` pode ser criado via plano ou manualmente

5. **Billing:**
   - `SUBSCRIBER_BILLING` sempre `direction = 'incoming'`
   - `PUBLISHER_BILLING` pode ser `incoming` ou `outgoing`

---

**Última atualização:** 2026-01-02  
**Versão do Documento:** 1.0.0  
**Versão do Sistema:** 2.1.0

