# Diagrama Funcional do Sistema - SmartSignage Pro

**Versão:** 2.1.0  
**Data:** Dezembro 2025

---

## 📊 Índice de Diagramas

1. [Arquitetura Geral do Sistema](#1-arquitetura-geral-do-sistema)
2. [Modelo de Negócio - Entidades e Relacionamentos](#2-modelo-de-negócio---entidades-e-relacionamentos)
3. [Fluxo de Mixagem de Playlists](#3-fluxo-de-mixagem-de-playlists)
4. [Fluxo Completo de Conteúdo](#4-fluxo-completo-de-conteúdo)
5. [Processo de Geração de Mix para Totem](#5-processo-de-geração-de-mix-para-totem)
6. [Sistema de Billing e Contratos](#6-sistema-de-billing-e-contratos)

---

## 1. Arquitetura Geral do Sistema

```mermaid
graph TB
    subgraph "Frontend - Interface Web"
        UI[Interface React]
        Dashboard[Dashboard]
        Campaigns[Gestão de Campanhas]
        Playlists[Gestão de Playlists]
        Mix[Visualização de Mix]
        Analytics[Analytics]
    end

    subgraph "Backend - API REST"
        API[API Express]
        Auth[Autenticação JWT]
        Routes[Rotas]
        Services[Services]
        Workers[Background Workers]
    end

    subgraph "Camada de Serviços"
        MixService[TotemPlaylistMixService]
        CampaignService[CampaignService]
        AIService[AIService]
        BillingService[BillingService]
        CacheService[CacheService]
    end

    subgraph "Banco de Dados"
        DB[(PostgreSQL)]
        Redis[(Redis - Cache)]
    end

    subgraph "Infraestrutura Externa"
        Ollama[Ollama/OpenAI]
        Webhooks[Webhooks]
        Totems[Totens - Smart TVs]
    end

    UI --> API
    Dashboard --> API
    Campaigns --> API
    Playlists --> API
    Mix --> API
    Analytics --> API

    API --> Auth
    API --> Routes
    Routes --> Services
    Services --> MixService
    Services --> CampaignService
    Services --> AIService
    Services --> BillingService
    Services --> CacheService

    MixService --> DB
    CampaignService --> DB
    AIService --> Ollama
    CacheService --> Redis
    Services --> DB

    Workers --> MixService
    Workers --> BillingService

    MixService --> Webhooks
    Totems --> API
```

---

## 2. Modelo de Negócio - Entidades e Relacionamentos

```mermaid
erDiagram
    PUBLISHERS ||--o{ LOCALS : "tem"
    PUBLISHERS ||--o{ USERS : "tem"
    PUBLISHERS ||--o{ TOTEMS : "via locals"
    PUBLISHERS ||--o{ PUBLISHER_BILLING : "tem"
    PUBLISHERS ||--o{ PUBLISHER_CONTRACTS : "tem"
    PUBLISHERS ||--o{ CAMPAIGN_PUBLISHERS : "participa"
    
    SUBSCRIBERS ||--o{ CAMPAIGNS : "cria"
    SUBSCRIBERS ||--o{ MEDIAS : "upload"
    SUBSCRIBERS ||--o{ PLAYLISTS : "cria"
    SUBSCRIBERS ||--o{ SUBSCRIBER_BILLING : "tem"
    SUBSCRIBERS ||--o{ SUBSCRIBER_CONTRACTS : "tem"
    
    LOCALS ||--o{ TOTEMS : "contém"
    TOTEMS ||--o{ SMART_TVS : "controla"
    TOTEMS ||--o{ TOTEM_PLAYLIST_MIX : "tem mixagem"
    TOTEMS ||--o{ AI_CONTEXT_DATA : "tem contexto"
    
    CAMPAIGNS ||--o{ CAMPAIGN_PUBLISHERS : "publicada em"
    CAMPAIGNS ||--o{ CAMPAIGN_TOTEMS : "vinculada a"
    CAMPAIGNS ||--o{ CAMPAIGN_PLAYLISTS : "usa playlists"
    CAMPAIGNS ||--o{ QR_CODES : "tem QR codes"
    
    PLAYLISTS ||--o{ PLAYLIST_ITEMS : "contém itens"
    PLAYLISTS ||--o{ CAMPAIGN_PLAYLISTS : "usada em"
    MEDIAS ||--o{ PLAYLIST_ITEMS : "compõe"
    
    PLAYLIST_MIX_RULES ||--o{ TOTEM_PLAYLIST_MIX : "gera"
    TOTEM_PLAYLIST_MIX ||--o{ PLAYLIST_MIX_HISTORY : "tem histórico"
    
    PUBLISHERS {
        int publisher_id PK
        string name
        string client_type
        boolean active
    }
    
    SUBSCRIBERS {
        int subscriber_id PK
        string name
        string email
        boolean is_active
    }
    
    LOCALS {
        int local_id PK
        int publisher_id FK
        string name
        string address
    }
    
    TOTEMS {
        int totem_id PK
        int local_id FK
        string identifier
        string name
        string status
    }
    
    CAMPAIGNS {
        int campaign_id PK
        int subscriber_id FK
        string title
        string commercial_tier
        numeric default_time_share_percent
        date start_date
        date end_date
    }
    
    PLAYLISTS {
        int playlist_id PK
        int subscriber_id FK
        string name
        boolean is_active
    }
    
    MEDIAS {
        int media_id PK
        int subscriber_id FK
        string name
        string media_type
        int duration_seconds
    }
    
    PLAYLIST_MIX_RULES {
        int rule_id PK
        int totem_id FK
        string rule_type
        boolean ai_enabled
        string rotation_strategy
    }
    
    TOTEM_PLAYLIST_MIX {
        int mix_id PK
        int totem_id FK
        int rule_id FK
        jsonb mix_items
        int total_items
        string mix_strategy
    }
```

---

## 3. Fluxo de Mixagem de Playlists

```mermaid
sequenceDiagram
    participant T as Totem
    participant API as Backend API
    participant MixSvc as MixService
    participant RuleSvc as Rules Service
    participant AISvc as AIService
    participant CampSvc as CampaignService
    participant DB as Database
    participant Cache as Cache

    T->>API: GET /api/totems/{id}/playlist/mix
    API->>MixSvc: getCurrentMix(totemId)
    
    alt Mix existe no cache
        MixSvc->>Cache: get("totem_mix:{id}")
        Cache-->>MixSvc: Mix cached
        MixSvc-->>API: Return cached mix
    else Mix não existe ou expirado
        MixSvc->>Cache: get("mix_rule:{id}")
        
        alt Regra no cache
            Cache-->>MixSvc: Rule cached
        else
            MixSvc->>DB: getMixRuleForTotem()
            DB-->>MixSvc: Mix Rule
            MixSvc->>Cache: set(rule, 1h)
        end
        
        MixSvc->>DB: getAIContextForTotem()
        DB-->>MixSvc: AI Context
        
        alt IA habilitada e contexto incompleto
            MixSvc->>AISvc: analyzeSentimentWithAI()
            AISvc->>AISvc: Process AI Request
            AISvc-->>MixSvc: Sentiment Analysis
            MixSvc->>DB: updateAIContext()
        end
        
        MixSvc->>CampSvc: getMixedCampaignsForTotem()
        CampSvc->>DB: Query campaigns, playlists, medias
        DB-->>CampSvc: Campaigns data
        CampSvc-->>MixSvc: Mixed Campaigns
        
        MixSvc->>MixSvc: calculateItemWeights()
        MixSvc->>MixSvc: sortAndFilterItems()
        MixSvc->>MixSvc: distributeIntoTimeSlots()
        
        MixSvc->>DB: Save mix to database
        MixSvc->>Cache: set(mix, 30min)
        MixSvc->>MixSvc: triggerWebhook("playlist_mix.generated")
        
        MixSvc-->>API: Generated Mix
    end
    
    API-->>T: Mix Response
```

---

## 4. Fluxo Completo de Conteúdo

```mermaid
flowchart TD
    Start([Subscriber cria conteúdo]) --> UploadMedia[Upload de Mídia]
    UploadMedia --> CreatePlaylist[Cria Playlist]
    CreatePlaylist --> AddMedia[Adiciona Mídias à Playlist]
    AddMedia --> CreateCampaign[Subscriber cria Campanha]
    
    CreateCampaign --> SetCommercialFields[Define Campos Comerciais<br/>- Commercial Tier<br/>- Time Share<br/>- Impression Limits]
    SetCommercialFields --> LinkPlaylist[Vincula Playlists à Campanha]
    LinkPlaylist --> AssignPublisher[Publicador aprova Campanha]
    
    AssignPublisher --> SetPublisherRules[Define Regras por Publisher<br/>- Time Share<br/>- Dayparting<br/>- Impression Limits]
    SetPublisherRules --> AssignTotems[Vincula Campanha a Totens]
    
    AssignTotems --> CreateMixRule[Create/Update Mix Rule<br/>- Tipo: Systematic/AI/Hybrid<br/>- Pesos e Estratégias]
    CreateMixRule --> UpdateAIContext[Atualiza Contexto de IA<br/>- Pedestrian Count<br/>- Sentiment<br/>- Performance]
    
    UpdateAIContext --> GenerateMix[Gera Mixagem Inteligente]
    
    GenerateMix --> CalculateWeights[Calcula Pesos<br/>- Priority<br/>- Time<br/>- Tags<br/>- Commercial Tier<br/>- AI Context]
    CalculateWeights --> SortItems[Ordena Itens<br/>- Round Robin<br/>- Priority<br/>- Weighted<br/>- AI Optimized]
    SortItems --> DistributeSlots[Distribui em Slots<br/>- Time Share<br/>- Max Consecutive<br/>- Impression Limits]
    
    DistributeSlots --> SaveMix[Salva Mix no Banco]
    SaveMix --> CacheMix[Cacheia Mixagem]
    CacheMix --> NotifyWebhook[Notifica Webhooks]
    NotifyWebhook --> TotemRequest[Totem requisita Mix]
    
    TotemRequest --> GetMix[Obtém Mix Atual]
    GetMix --> DisplayContent[Exibe Conteúdo nas Smart TVs]
    
    DisplayContent --> CollectMetrics[Coleta Métricas]
    CollectMetrics --> UpdateContext[Atualiza Contexto de IA]
    UpdateContext --> RegenerateMix{Regenera Mix?}
    
    RegenerateMix -->|Sim - Horário/Evento| GenerateMix
    RegenerateMix -->|Não| DisplayContent
    
    DisplayContent --> Analytics[Analytics e Relatórios]
    Analytics --> Billing[Geração de Billing]
    Billing --> End([Fim do Ciclo])
```

---

## 5. Processo de Geração de Mix para Totem

```mermaid
flowchart LR
    subgraph "1. Coleta"
        A1[Regra de Mixagem] --> A2[Contexto de IA]
        A2 --> A3[Campanhas Ativas]
        A3 --> A4[Playlists Vinculadas]
        A4 --> A5[Mídias das Playlists]
    end
    
    subgraph "2. Agregação"
        B1[Itens de Mídia] --> B2[Metadados<br/>- Prioridade<br/>- Tags<br/>- Duração]
        B2 --> B3[Campos Comerciais<br/>- Tier<br/>- Time Share<br/>- Limits]
        B3 --> B4[Contexto de IA<br/>- Sentiment<br/>- Pedestrians<br/>- Performance]
    end
    
    subgraph "3. Ordenação"
        C1[Calcular Pesos] --> C2{Aplica Regra}
        C2 -->|Systematic| C3[Ordena por Pesos<br/>Sistemáticos]
        C2 -->|AI| C4[Otimiza com IA]
        C2 -->|Hybrid| C5[Combina Ambos]
        C3 --> C6[Aplica Estratégia]
        C4 --> C6
        C5 --> C6
        C6 -->|Round Robin| C7[Intercala Campanhas]
        C6 -->|Priority| C8[Ordena por Prioridade]
        C6 -->|Weighted| C9[Ordena por Peso]
        C6 -->|AI Optimized| C10[Otimização IA]
    end
    
    subgraph "4. Distribuição"
        D1[Itens Ordenados] --> D2[Distribui em Slots<br/>10 minutos cada]
        D2 --> D3[Respeita Time Share]
        D3 --> D4[Respeita Max Consecutive]
        D4 --> D5[Respeita Impression Limits]
        D5 --> D6[Dayparting Rules]
    end
    
    subgraph "5. Geração Final"
        E1[Slots Distribuídos] --> E2[Mix Final]
        E2 --> E3[Salva no Banco]
        E3 --> E4[Cacheia Resultado]
        E4 --> E5[Notifica Webhooks]
        E5 --> E6[Mix Pronto para Totem]
    end
    
    A5 --> B1
    B4 --> C1
    C7 --> D1
    C8 --> D1
    C9 --> D1
    C10 --> D1
    D6 --> E1
```

---

## 6. Sistema de Billing e Contratos

```mermaid
flowchart TD
    subgraph "Subscriber Side"
        S1[Subscriber cria Campanha] --> S2[Define Budget e Duração]
        S2 --> S3[Campanha Ativa]
        S3 --> S4[Subscriber Billing Service]
        S4 --> S5[Gera Invoice<br/>Baseado em:<br/>- Tempo de exibição<br/>- Tier comercial<br/>- Impression counts]
        S5 --> S6[Payment Status<br/>- Pending<br/>- Paid<br/>- Overdue]
    end
    
    subgraph "Publisher Side"
        P1[Publisher aprova Campanha] --> P2[Publica em seus Totens]
        P2 --> P3[Campanha em Exibição]
        P3 --> P4[Publisher Billing Service]
        P4 --> P5[Gera Payout<br/>Baseado em:<br/>- Time share usado<br/>- Tier da campanha<br/>- Performance metrics]
        P5 --> P6[Payout Status<br/>- Pending<br/>- Processed<br/>- Paid]
    end
    
    subgraph "Contracts"
        C1[Subscriber Contract] --> C2[Define Terms<br/>- Pricing<br/>- Duration<br/>- Limits]
        C2 --> S4
        C3[Publisher Contract] --> C4[Define Terms<br/>- Commission<br/>- Revenue Share<br/>- Payout Terms]
        C4 --> P4
    end
    
    S3 --> P2
    S6 --> P6
```

---

## 7. Fluxo de Heartbeat e Atualização de Contexto

```mermaid
sequenceDiagram
    participant T as Totem
    participant API as Backend API
    participant TS as TotemService
    participant MixSvc as MixService
    participant Worker as MixWorker
    participant DB as Database

    Note over T,DB: Heartbeat periódico (ex: 1 minuto)
    T->>API: POST /api/totems/{id}/heartbeat<br/>{status, metrics, aiContext}
    API->>TS: processHeartbeat(data)
    
    TS->>DB: Update totem status
    TS->>DB: Save metrics
    
    alt AI Context presente
        TS->>MixSvc: updateAIContext(totemId, context)
        MixSvc->>DB: Upsert ai_context_data
        MixSvc->>DB: Update timestamps
        
        Note over MixSvc,DB: Se contexto mudou significativamente
        MixSvc->>Worker: Trigger mix regeneration
    end
    
    TS->>DB: Get current mix
    DB-->>TS: Current Mix
    TS-->>API: Totem Response + Current Mix
    API-->>T: Response
    
    Note over Worker,DB: Background Worker - Regeneração automática
    Worker->>DB: Get active totems
    Worker->>MixSvc: generateMixForTotem(totemId)
    MixSvc->>MixSvc: Generate new mix
    MixSvc->>DB: Save new mix
    MixSvc->>T: Notify via WebSocket (opcional)
```

---

## 8. Arquitetura de Regras de Mixagem

```mermaid
graph TD
    subgraph "Regras Systemáticas"
        S1[Priority Weight] --> S2[Ordena por Prioridade]
        S3[Time Weight] --> S4[Ajusta por Horário]
        S5[Tag Weight] --> S6[Filtra/Ordena por Tags]
        S7[Subscriber Weight] --> S8[Prioriza Subscribers]
    end
    
    subgraph "Regras de IA"
        AI1[Pedestrian Detection] --> AI2[Ajusta por Densidade]
        AI3[Sentiment Analysis] --> AI4[Ajusta por Sentimento]
        AI5[Context Awareness] --> AI6[Ajusta por Contexto]
        AI7[Historical Optimization] --> AI8[Aprende com Histórico]
    end
    
    subgraph "Estratégias de Rotação"
        E1[Round Robin] --> E2[Intercala Campanhas]
        E3[Priority] --> E4[Ordena por Prioridade]
        E5[Weighted] --> E6[Ordena por Peso Calculado]
        E7[AI Optimized] --> E8[Otimização com IA]
    end
    
    subgraph "Campos Comerciais"
        C1[Commercial Tier] --> C2[Premium > Standard > Remnant]
        C3[Time Share] --> C4[Aloca % de Tempo]
        C5[Impression Limits] --> C6[Min/Max por Hora]
        C7[Max Consecutive] --> C8[Limita Sequências]
    end
    
    S2 --> Mix[Mixagem Final]
    S4 --> Mix
    S6 --> Mix
    S8 --> Mix
    AI2 --> Mix
    AI4 --> Mix
    AI6 --> Mix
    AI8 --> Mix
    E2 --> Mix
    E4 --> Mix
    E6 --> Mix
    E8 --> Mix
    C2 --> Mix
    C4 --> Mix
    C6 --> Mix
    C8 --> Mix
```

---

## 9. Visão Geral do Negócio

```mermaid
graph LR
    subgraph "Ator: Subscriber<br/>(Anunciante)"
        S1[Cria Conteúdo]
        S2[Upload Mídias]
        S3[Cria Playlists]
        S4[Cria Campanhas]
        S5[Define Budget]
        S6[Paga por Exposição]
        
        S1 --> S2 --> S3 --> S4 --> S5 --> S6
    end
    
    subgraph "Ator: Publisher<br/>(Publicador)"
        P1[Aprova Campanhas]
        P2[Vincula a Totens]
        P3[Gerencia Espaço]
        P4[Recebe Revenue]
        
        P1 --> P2 --> P3 --> P4
    end
    
    subgraph "Sistema: Mix Inteligente"
        M1[Coleta Campanhas]
        M2[Aplica Regras]
        M3[Otimiza com IA]
        M4[Distribui em Slots]
        M5[Gera Mix Final]
        
        M1 --> M2 --> M3 --> M4 --> M5
    end
    
    subgraph "Ator: Totem<br/>(Smart TVs)"
        T1[Requisita Mix]
        T2[Recebe Playlist]
        T3[Exibe Conteúdo]
        T4[Coleta Métricas]
        T5[Envia Heartbeat]
        
        T1 --> T2 --> T3 --> T4 --> T5 --> T1
    end
    
    S4 --> P1
    P2 --> M1
    M5 --> T1
    T4 --> M3
    S6 -.->|Billing| P4
```

---

## 10. Ciclo de Vida de uma Campanha

```mermaid
stateDiagram-v2
    [*] --> Draft: Subscriber cria
    
    Draft --> PendingApproval: Submete para publicação
    
    PendingApproval --> Active: Publisher aprova
    PendingApproval --> Rejected: Publisher rejeita
    Rejected --> Draft: Subscriber revisa
    
    Active --> Active: Em exibição<br/>Mix gerada periodicamente
    
    Active --> Paused: Pausada manualmente
    Paused --> Active: Retomada
    
    Active --> Completed: Data fim atingida
    Active --> Cancelled: Cancelada
    
    Completed --> [*]: Gera billing final
    Cancelled --> [*]: Finaliza
```

---

## 📝 Legenda e Notas

### Componentes Principais

- **Subscriber (Anunciante)**: Cliente que cria campanhas e conteúdo
- **Publisher (Publicador)**: Proprietário dos totens/espaços publicitários
- **Totem**: Dispositivo físico com Smart TVs que exibe conteúdo
- **Mix Service**: Serviço que gera playlists inteligentes misturadas
- **Campaign**: Campanha publicitária com múltiplas playlists
- **Playlist**: Sequência ordenada de mídias
- **Media**: Arquivo de mídia (vídeo, imagem)

### Fluxos Principais

1. **Criação de Conteúdo**: Subscriber → Playlists → Campanhas
2. **Publicação**: Publisher aprova e vincula a totens
3. **Mixagem**: Sistema gera mix inteligente combinando campanhas
4. **Exibição**: Totem recebe e exibe mixagem
5. **Feedback**: Totem envia métricas → Contexto IA → Regenera mix

### Tecnologias

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis (opcional)
- **IA**: Ollama/OpenAI/Anthropic
- **Workers**: node-cron para tarefas agendadas

---

**Para visualizar os diagramas:**
- Use um editor que suporte Mermaid (GitHub, GitLab, VS Code com extensão)
- Ou acesse: https://mermaid.live/

