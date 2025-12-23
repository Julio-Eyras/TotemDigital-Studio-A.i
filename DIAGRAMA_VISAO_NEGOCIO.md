# Diagrama de Visão de Negócio - SmartSignage Pro

**Versão:** 2.1.0  
**Data:** Dezembro 2025

---

## 🎯 Visão Geral do Modelo de Negócio

```mermaid
graph TB
    subgraph "ECOSSISTEMA SMART SIGNAGE PRO"
        subgraph "1. CRIAÇÃO DE CONTEÚDO"
            A1[Anunciante/Subscriber<br/>Upload de Mídias]
            A2[Cria Playlists<br/>Sequências de Conteúdo]
            A3[Cria Campanhas<br/>Define Objetivos e Budget]
            A1 --> A2 --> A3
        end
        
        subgraph "2. PUBLICAÇÃO"
            B1[Publicador/Publisher<br/>Aprova Campanhas]
            B2[Vincula a Locais<br/>Shopping, Food Court, etc]
            B3[Vincula a Totens<br/>Dispositivos Específicos]
            B1 --> B2 --> B3
        end
        
        subgraph "3. MIXAGEM INTELIGENTE"
            C1[Sistema Coleta<br/>- Campanhas Ativas<br/>- Playlists Vinculadas<br/>- Contexto de IA]
            C2[Aplica Regras<br/>- Systemáticas<br/>- IA/Híbridas<br/>- Comerciais]
            C3[Distribui em Slots<br/>- Time Share<br/>- Tier Comercial<br/>- Limites]
            C4[Gera Mix Final<br/>Playlist Otimizada]
            C1 --> C2 --> C3 --> C4
        end
        
        subgraph "4. EXIBIÇÃO"
            D1[Totem requisita Mix]
            D2[Recebe Playlist]
            D3[Exibe nas Smart TVs]
            D4[Coleta Métricas]
            D1 --> D2 --> D3 --> D4
        end
        
        subgraph "5. FEEDBACK E OTIMIZAÇÃO"
            E1[Métricas enviadas]
            E2[Contexto IA atualizado]
            E3[Mix regenerada]
            E4[Analytics e Relatórios]
            E1 --> E2 --> E3 --> E4
        end
        
        subgraph "6. BILLING"
            F1[Subscriber paga<br/>por exposição]
            F2[Publisher recebe<br/>revenue share]
            F3[Sistema gerencia<br/>contratos e invoices]
            F1 --> F3 --> F2
        end
    end
    
    A3 --> B1
    B3 --> C1
    C4 --> D1
    D4 --> E1
    E3 --> C1
    A3 --> F1
    B3 --> F2
```

---

## 💰 Modelo de Receita

```mermaid
graph LR
    subgraph "FLUXO FINANCEIRO"
        S[Subscriber<br/>Anunciante] -->|Paga| SS[SmartSignage Pro<br/>Plataforma]
        SS -->|Revenue Share| P[Publisher<br/>Publicador]
        SS -->|Taxa de Serviço| PL[SmartSignage Pro<br/>Receita Própria]
    end
    
    subgraph "FATORES DE PREÇO"
        T1[Commercial Tier<br/>Premium > Standard > Remnant]
        T2[Time Share<br/>% de tempo alocado]
        T3[Impression Count<br/>Quantidade de exibições]
        T4[Performance<br/>Engajamento e métricas]
    end
    
    T1 --> SS
    T2 --> SS
    T3 --> SS
    T4 --> SS
```

---

## 🎬 Fluxo Detalhado de Valor

```mermaid
sequenceDiagram
    participant Sub as Subscriber<br/>(Anunciante)
    participant Pub as Publisher<br/>(Publicador)
    participant Sys as Sistema<br/>(SmartSignage Pro)
    participant Tot as Totem<br/>(Smart TVs)
    participant Aud as Audiência<br/>(Público)

    Note over Sub,Aud: 1. CRIAÇÃO E CONFIGURAÇÃO
    Sub->>Sys: Upload mídias e cria playlists
    Sub->>Sys: Cria campanha com budget e tier
    Sys->>Pub: Notifica nova campanha
    Pub->>Sys: Aprova e vincula a totens
    
    Note over Sub,Aud: 2. MIXAGEM INTELIGENTE
    Sys->>Sys: Coleta campanhas ativas
    Sys->>Sys: Analisa contexto de IA
    Sys->>Sys: Aplica regras de mixagem
    Sys->>Sys: Gera mix otimizada
    
    Note over Sub,Aud: 3. EXIBIÇÃO
    Tot->>Sys: Requisita playlist atual
    Sys->>Tot: Envia mix gerada
    Tot->>Aud: Exibe conteúdo nas TVs
    Aud->>Tot: Interage com conteúdo
    
    Note over Sub,Aud: 4. COLETA E FEEDBACK
    Tot->>Sys: Envia métricas (heartbeat)
    Sys->>Sys: Atualiza contexto de IA
    Sys->>Sys: Regenera mix se necessário
    
    Note over Sub,Aud: 5. ANALYTICS E BILLING
    Sys->>Sub: Relatório de performance
    Sys->>Sub: Invoice baseado em uso
    Sys->>Pub: Payout baseado em revenue share
    Sys->>Sys: Analytics e insights
```

---

## 🏗️ Arquitetura de Negócio - 3 Camadas

```mermaid
graph TB
    subgraph "CAMADA 1: CONTEÚDO E CAMPANHAS"
        direction LR
        C1[Subscribers<br/>Anunciantes] --> C2[Medias<br/>Vídeos, Imagens]
        C2 --> C3[Playlists<br/>Sequências]
        C3 --> C4[Campanhas<br/>Objetivos, Budget, Tier]
    end
    
    subgraph "CAMADA 2: DISTRIBUIÇÃO E MIXAGEM"
        direction LR
        D1[Publishers<br/>Publicadores] --> D2[Locals<br/>Locais Físicos]
        D2 --> D3[Totens<br/>Dispositivos]
        D4[Mix Engine<br/>Sistema Inteligente] --> D5[Mix Rules<br/>Regras]
        D5 --> D6[AI Context<br/>Contexto]
        D4 --> D7[Generated Mix<br/>Mix Gerada]
    end
    
    subgraph "CAMADA 3: EXECUÇÃO E MONETIZAÇÃO"
        direction LR
        E1[Smart TVs<br/>Exibição] --> E2[Metrics<br/>Métricas]
        E2 --> E3[Analytics<br/>Análise]
        E3 --> E4[Billing<br/>Faturamento]
        E4 --> E5[Revenue Share<br/>Distribuição]
    end
    
    C4 --> D1
    D3 --> D4
    D7 --> E1
    E2 --> D6
    E3 --> C1
    E4 --> C1
    E5 --> D1
```

---

## 🎯 Personas e Jornadas

### Persona 1: Anunciante (Subscriber)

```mermaid
journey
    title Jornada do Anunciante
    section Cadastro
      Cria conta: 3: Anunciante
      Faz upload de mídias: 4: Anunciante
      Cria primeira playlist: 4: Anunciante
    section Campanha
      Cria campanha: 5: Anunciante
      Define budget e tier: 4: Anunciante
      Aguarda aprovação: 2: Anunciante
    section Execução
      Campanha aprovada: 5: Anunciante
      Monitora performance: 5: Anunciante
      Ajusta campanha: 4: Anunciante
    section Resultados
      Recebe relatórios: 5: Anunciante
      Paga invoice: 3: Anunciante
      Analisa ROI: 5: Anunciante
```

### Persona 2: Publicador (Publisher)

```mermaid
journey
    title Jornada do Publicador
    section Setup
      Cadastra locais: 4: Publicador
      Instala totens: 3: Publicador
      Configura mix rules: 4: Publicador
    section Operação
      Recebe solicitações: 4: Publicador
      Aprova campanhas: 5: Publicador
      Monitora espaços: 5: Publicador
    section Otimização
      Analisa performance: 5: Publicador
      Ajusta regras: 4: Publicador
      Otimiza revenue: 5: Publicador
    section Monetização
      Recebe payouts: 5: Publicador
      Analisa receita: 5: Publicador
```

---

## 📊 Matriz de Valor

```mermaid
graph TB
    subgraph "VALOR PARA ANUNCIANTE"
        V1[Alcance Público Relevante]
        V2[Otimização Automática]
        V3[Métricas Detalhadas]
        V4[ROI Mensurável]
    end
    
    subgraph "VALOR PARA PUBLICADOR"
        V5[Monetização de Espaço]
        V6[Gestão Automática]
        V7[Revenue Share]
        V8[Insights de Público]
    end
    
    subgraph "VALOR PARA PLATAFORMA"
        V9[Taxa de Serviço]
        V10[Dados Agregados]
        V11[Ecosistema Escalável]
        V12[IA Melhorada]
    end
    
    subgraph "VALOR PARA PÚBLICO"
        V13[Conteúdo Relevante]
        V14[Experiência Melhorada]
        V15[Informações Úteis]
        V16[Entretenimento]
    end
```

---

## 🔄 Ciclo de Otimização Contínua

```mermaid
graph LR
    A[Coleta de Dados] --> B[Análise de IA]
    B --> C[Otimização de Mix]
    C --> D[Exibição Otimizada]
    D --> E[Métricas de Performance]
    E --> F[Feedback Loop]
    F --> A
    
    style A fill:#e1f5ff
    style B fill:#fff4e1
    style C fill:#e8f5e9
    style D fill:#f3e5f5
    style E fill:#ffebee
    style F fill:#e0f2f1
```

---

## 📈 Evolução do Sistema

```mermaid
timeline
    title Evolução do Sistema SmartSignage Pro
    
    section Fase 1: Básico
        Upload de Conteúdo : Playlists Estáticas
                              : Exibição Simples
                              : Billing Manual
    
    section Fase 2: Inteligente
        Mix Automática : Regras Systemáticas
                        : Campos Comerciais
                        : Analytics Básico
    
    section Fase 3: IA Avançada
        IA Integrada : Análise de Sentimento
                      : Contexto Inteligente
                      : Otimização Automática
    
    section Fase 4: Futuro
        ML Avançado : Otimização Contínua
                     : Detecção de Transeuntes
                     : Personalização Extrema
```

---

## 🎨 Diferenciais Competitivos

```mermaid
mindmap
  root((SmartSignage<br/>Pro))
    Mix Inteligente
      IA Integrada
      Otimização Automática
      Contexto Real-time
    Flexibilidade Comercial
      Multiple Tiers
      Time Share Dinâmico
      Impression Limits
    Gestão Completa
      Multi-tenant
      Billing Automatizado
      Analytics Avançado
    Escalabilidade
      Múltiplos Totens
      Múltiplas Campanhas
      Performance Otimizada
```

---

**Última atualização:** Dezembro 2025

