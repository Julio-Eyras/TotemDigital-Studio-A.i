# Arquitetura do Sistema: Dispatcher-Totem e Playlist Mix

## 📋 Visão Geral

O sistema Smart Signage Pro utiliza uma arquitetura modular com três componentes principais que trabalham em conjunto para decidir o que exibir em cada totem:

1. **Dispatcher-Totem** - Motor de decisão (resolve conflitos)
2. **Playlist Mix Service** - Combina múltiplas campanhas
3. **Workers em Background** - Regeneração automática e manutenção

### 🏗️ Topologia em Estrela

O sistema utiliza uma **topologia em estrela** onde:

- **Totens** atuam como **hubs locais** (replicadores de rede)
- **Smart TVs** dependem do totem associado para conteúdo
- **Armazenamento local** garante continuidade mesmo sem Internet
- **Download assíncrono** + **reprodução local** (não streaming contínuo)

**Documentação completa**: Ver `docs/ARQUITETURA-CACHE-ARMAZENAMENTO-LOCAL.md`

---

## 🔄 Fluxo Principal: Como Funciona

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUISIÇÃO DO TOTEM                           │
│              (Totem solicita: "O que exibir agora?")            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DISPATCHER-TOTEM SERVICE                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Verificar Cache                                        │  │
│  │    - Cache Key: totem_{id}_{timestamp}                   │  │
│  │    - TTL: 60 segundos (configurável)                     │  │
│  │    - Se encontrado → Retorna imediatamente               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 2. Descobrir Candidatos                                  │  │
│  │    - Buscar campanhas ativas para o totem                 │  │
│  │    - Verificar: campaign_totems, campaign_locals         │  │
│  │    - Filtrar por: data, horário, dia da semana           │  │
│  │    - Resultado: Array de CandidateSchedule               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 3. Validar Regras Comerciais                             │  │
│  │    - Verificar time_share_percent                        │  │
│  │    - Verificar max_consecutive_slots                    │  │
│  │    - Verificar max_impressions_per_hour                 │  │
│  │    - Verificar contratos ativos                         │  │
│  │    - Resultado: Array de candidatos válidos              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 4. Decidir Estratégia                                    │  │
│  │    ┌──────────────────────────────────────────────┐    │  │
│  │    │ SINGLE: 1 candidato → Usar diretamente        │    │  │
│  │    │ PRIORITY: Múltiplos → Escolher por prioridade  │    │  │
│  │    │ MIX: Múltiplos → Combinar usando Mix Service   │    │  │
│  │    └──────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ├──────────┬──────────┐              │
│                            ▼          ▼          ▼               │
│                    ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│                    │ SINGLE  │ │PRIORITY │ │   MIX   │        │
│                    └────┬────┘ └────┬────┘ └────┬────┘        │
│                         │           │           │              │
│                         └───────────┴───────────┘              │
│                                 │                               │
│                                 ▼                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 5. Validar Compatibilidade Técnica                      │  │
│  │    - Totem online?                                      │  │
│  │    - Playlist disponível?                               │  │
│  │    - Arquivos de mídia acessíveis?                      │  │
│  │    - Espaço em disco suficiente?                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 6. Validar Integridade                                  │  │
│  │    - Playlist tem itens?                                 │  │
│  │    - Arquivos de mídia válidos?                          │  │
│  │    - Contrato válido?                                    │  │
│  │    - Publisher tem acesso?                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 7. Gerar Dispatch Plan                                   │  │
│  │    - Lista de mídias com ordem                           │  │
│  │    - Durações e transições                              │  │
│  │    - Metadados (resolução, orientação, etc.)            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 8. Salvar no Cache                                       │  │
│  │    - Cache Key: totem_{id}_{timestamp}                   │  │
│  │    - TTL: 60 segundos                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 9. Registrar Log de Auditoria                           │  │
│  │    - Salvar em dispatcher_log                            │  │
│  │    - Incluir: candidatos, validações, plano, tempo       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│                    ┌───────────────────┐                       │
│                    │  RETORNAR PLANO    │                       │
│                    │   PARA O TOTEM     │                       │
│                    └───────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Estratégia MIX: Playlist Mix Service

Quando o Dispatcher decide usar a estratégia **MIX**, ele delega para o **Playlist Mix Service**:

```
┌─────────────────────────────────────────────────────────────────┐
│              DISPATCHER (Estratégia = MIX)                      │
│                    ↓                                            │
│         Chama: mixService.generateMixForTotem(totemId)         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              PLAYLIST MIX SERVICE                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Obter Regra de Mixagem                                │  │
│  │    - Buscar mix_rule para o totem                       │  │
│  │    - Se não existir → Usar regra padrão                  │  │
│  │    - Cache: 1 hora                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 2. Buscar Campanhas Ativas                              │  │
│  │    - Todas as campanhas válidas para o totem             │  │
│  │    - Com suas playlists associadas                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 3. Aplicar Regras de Mixagem                            │  │
│  │    ┌──────────────────────────────────────────────┐      │  │
│  │    │ SYSTEMATIC:                                  │      │  │
│  │    │  - Round Robin                               │      │  │
│  │    │  - Por Prioridade                            │      │  │
│  │    │  - Por Peso (weighted)                       │      │  │
│  │    │                                              │      │  │
│  │    │ AI:                                          │      │  │
│  │    │  - Análise de contexto                       │      │  │
│  │    │  - Detecção de pedestres                     │      │  │
│  │    │  - Análise de sentimento                     │      │  │
│  │    │  - Otimização histórica                      │      │  │
│  │    │                                              │      │  │
│  │    │ HYBRID: Combinação de ambos                  │      │  │
│  │    └──────────────────────────────────────────────┘      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 4. Gerar TotemPlaylistMix                                │  │
│  │    - Combinar itens de múltiplas playlists               │  │
│  │    - Aplicar pesos e prioridades                        │  │
│  │    - Ordenar por estratégia escolhida                   │  │
│  │    - Calcular duração total                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 5. Salvar Mix no Banco                                   │  │
│  │    - Tabela: totem_playlist_mix                          │  │
│  │    - Marcar como is_current = true                       │  │
│  │    - Incrementar mix_version                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 6. Converter para DispatchPlan                          │  │
│  │    - TotemPlaylistMix → DispatchPlan                     │  │
│  │    - Incluir metadados e transições                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│                    ┌───────────────────┐                       │
│                    │ RETORNAR AO       │                       │
│                    │ DISPATCHER        │                       │
│                    └───────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Workers em Background

O sistema possui workers que executam tarefas periódicas:

### 1. Playlist Mix Worker

```
┌─────────────────────────────────────────────────────────────────┐
│              PLAYLIST MIX WORKER                                │
│                                                                 │
│  Agendamentos Cron:                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Regeneração Horária                                   │  │
│  │    Schedule: 0 * * * * (todo minuto 0 de cada hora)     │  │
│  │    Ação: Regenera mixagens para todos os totens ativos   │  │
│  │    Condição: Só se mixagem tiver > 1 hora                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 2. Regeneração Diária                                     │  │
│  │    Schedule: 0 2 * * * (02:00 todo dia)                  │  │
│  │    Ação: Regenera todas as mixagens (force = true)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 3. Verificação de Campanhas                              │  │
│  │    Schedule: */15 * * * * (a cada 15 minutos)            │  │
│  │    Ação: Verifica mudanças em campanhas e regenera        │  │
│  │           mixagens afetadas                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Fluxo de Regeneração:                                         │
│    Totens Ativos → Para cada totem:                            │
│      → Verificar se precisa regenerar                          │
│      → Chamar mixService.generateMixForTotem()                 │
│      → Salvar nova mixagem                                     │
│      → Invalidar cache                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Playlist Engine Worker

```
┌─────────────────────────────────────────────────────────────────┐
│              PLAYLIST ENGINE WORKER                             │
│                                                                 │
│  Responsabilidades:                                            │
│  - Gerar totem_playlists (playlists compiladas para totens)   │
│  - Processar agendamentos                                      │
│  - Manter sincronização entre campanhas e totens               │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Invoice Worker

```
┌─────────────────────────────────────────────────────────────────┐
│              INVOICE WORKER                                     │
│                                                                 │
│  Agendamentos:                                                 │
│  - Geração de faturas: 02:00 diariamente                      │
│  - Marcação de vencidas: 03:00 diariamente                    │
│  - Notificações: 09:00 diariamente                            │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Subscriber Access Notification Worker

```
┌─────────────────────────────────────────────────────────────────┐
│              SUBSCRIBER ACCESS NOTIFICATION WORKER              │
│                                                                 │
│  Agendamentos:                                                 │
│  - Verificação de acessos expirando (7, 15, 30 dias): 08:00   │
│  - Verificação de acessos expirados: 09:00                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Queries e Processos de Banco de Dados

### Dispatcher: Buscar Candidatos

```sql
-- 1. Buscar campanhas ativas para o totem
SELECT DISTINCT c.*
FROM campaigns c
INNER JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
WHERE ct.totem_id = $1
  AND c.is_active = true
  AND c.status = 'active'
  AND (c.start_date IS NULL OR c.start_date <= $2)
  AND (c.end_date IS NULL OR c.end_date >= $2)
  AND (c.start_time IS NULL OR c.start_time <= $3)
  AND (c.end_time IS NULL OR c.end_time >= $3)
  AND (c.days_of_week IS NULL OR $4 = ANY(c.days_of_week::text[]))
```

### Playlist Mix: Buscar Campanhas para Mixagem

```sql
-- Buscar todas as campanhas válidas com suas playlists
SELECT 
  c.campaign_id,
  c.title,
  c.priority,
  c.commercial_tier,
  c.time_share_percent,
  p.playlist_id,
  p.name as playlist_name
FROM campaigns c
INNER JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
LEFT JOIN campaign_playlists cp ON c.campaign_id = cp.campaign_id
LEFT JOIN playlists p ON cp.playlist_id = p.playlist_id
WHERE ct.totem_id = $1
  AND c.is_active = true
ORDER BY c.priority DESC, c.commercial_tier
```

---

## 📊 Fluxo Completo: Do Totem ao Display

```
┌─────────────┐
│   TOTEM     │ 1. Solicita: "O que exibir agora?"
│  (Player)   │    GET /api/player/dispatch?uin={UIN}&token={TOKEN}
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  API ROUTE: /api/dispatcher-totem/dispatch                │
│  → dispatcherTotemService.dispatch()                        │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  DISPATCHER-TOTEM SERVICE                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Verifica Cache → Se não, processa...                │  │
│  │                                                      │  │
│  │ 1. Busca Candidatos (campanhas ativas)              │  │
│  │ 2. Valida Regras Comerciais                         │  │
│  │ 3. Decide Estratégia                                │  │
│  │    ├─ SINGLE → Resolve conflito                     │  │
│  │    ├─ PRIORITY → Escolhe por prioridade            │  │
│  │    └─ MIX → Chama Playlist Mix Service             │  │
│  │ 4. Valida Técnica e Integridade                     │  │
│  │ 5. Gera Dispatch Plan                               │  │
│  │ 6. Salva Cache                                      │  │
│  │ 7. Registra Log (dispatcher_log)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐      ┌──────────────────────┐
│  Estratégia   │      │  PLAYLIST MIX        │
│  SINGLE/      │      │  SERVICE             │
│  PRIORITY     │      │  ┌────────────────┐ │
│               │      │  │ 1. Busca Regra  │ │
│  Resolve      │      │  │ 2. Busca        │ │
│  conflito     │      │  │    Campanhas    │ │
│  diretamente  │      │  │ 3. Aplica Mix   │ │
│               │      │  │ 4. Gera Mix     │ │
│               │      │  │ 5. Salva Mix    │ │
│               │      │  │ 6. Converte para│ │
│               │      │  │    DispatchPlan │ │
│               │      │  └────────────────┘ │
└───────┬───────┘      └──────────┬──────────┘
        │                         │
        └───────────┬─────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   DISPATCH PLAN        │
        │  {                    │
        │    playlistId: 1,     │
        │    mediaItems: [...], │
        │    totalDuration: 40, │
        │    ...                │
        │  }                    │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   RETORNA PARA TOTEM  │
        │   (JSON Response)     │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   TOTEM EXECUTA       │
        │   Playlist no Display │
        │                       │
        │  ┌─────────────────┐ │
        │  │ Download Mídias  │ │
        │  │ (se necessário)  │ │
        │  │ Cache Local      │ │
        │  └─────────────────┘ │
        │                       │
        │  ┌─────────────────┐ │
        │  │ Servir TVs      │ │
        │  │ (HTTP Local)    │ │
        │  └─────────────────┘ │
        └───────────────────────┘
```

**Nota**: Após receber o `DispatchPlan`, o totem:
1. **Baixa mídias** do backend (se não estiverem em cache)
2. **Armazena localmente** para reprodução offline
3. **Serve TVs associadas** via HTTP local
4. **Continua funcionando** mesmo se Internet cair

---

## 🗄️ Tabelas Principais

### dispatcher_log
- **Propósito**: Auditoria de todas as decisões do Dispatcher
- **Campos importantes**:
  - `totem_id`: Totem para o qual a decisão foi tomada
  - `selected_campaign_id`: Campanha selecionada (se aplicável)
  - `selected_playlist_id`: Playlist selecionada
  - `selected_source`: 'campaign', 'direct', 'mix'
  - `candidates`: JSONB com todos os candidatos considerados
  - `dispatch_plan`: JSONB com o plano completo gerado
  - `from_cache`: Se veio do cache
  - `execution_time_ms`: Tempo de execução

### totem_playlist_mix
- **Propósito**: Armazenar mixagens geradas para totens
- **Campos importantes**:
  - `totem_id`: Totem para o qual a mixagem foi gerada
  - `mix_version`: Versão da mixagem (incrementa a cada regeneração)
  - `mix_items`: JSONB com itens da mixagem
  - `is_current`: Se é a mixagem atual
  - `generated_at`: Quando foi gerada

### campaigns
- **Propósito**: Campanhas publicitárias
- **Relacionamentos**:
  - `campaign_totems`: Quais totens podem exibir a campanha
  - `campaign_playlists`: Quais playlists pertencem à campanha
  - `campaign_medias`: Mídias diretas da campanha

### playlists
- **Propósito**: Listas de mídias organizadas
- **Relacionamentos**:
  - `playlist_items`: Itens (mídias) da playlist
  - `subscriber_id`: Anunciante dono da playlist

---

## 🔐 Cache Strategy

### Dispatcher Cache
- **Chave**: `dispatcher:totem:{totemId}:{timestamp}`
- **TTL**: 60 segundos (configurável)
- **Conteúdo**: `{ plan, candidates }`
- **Invalidação**: Quando campanha muda, quando mix é regenerado

### Playlist Mix Cache
- **Chave**: `mix_rule:totem:{totemId}`
- **TTL**: 1 hora
- **Conteúdo**: Regra de mixagem do totem

---

## 🎯 Decisões e Estratégias

### Quando usar SINGLE?
- Apenas 1 candidato encontrado
- Não há conflito para resolver

### Quando usar PRIORITY?
- Múltiplos candidatos
- Regra de mixagem não existe ou está desabilitada
- Fallback quando Mix falha

### Quando usar MIX?
- Múltiplos candidatos
- Regra de mixagem existe e está ativa
- Permite combinar conteúdo de múltiplas campanhas

---

## 📝 Notas Importantes

1. **Dispatcher NÃO executa**: Ele apenas decide e gera planos. O totem é responsável por executar.

2. **Cache é crítico**: Reduz carga no banco e melhora performance. TTL curto (60s) garante atualização frequente.

3. **Workers são assíncronos**: Regeneram mixagens em background sem bloquear requisições.

4. **Logs são essenciais**: `dispatcher_log` permite auditoria completa de todas as decisões.

5. **Validações em cascata**: Temporal → Comercial → Técnica → Integridade. Se qualquer uma falhar, o candidato é rejeitado.

6. **Fallback sempre disponível**: Se Mix falhar, sistema tenta PRIORITY. Se tudo falhar, retorna vazio (totem pode usar playlist padrão).

---

## 🔄 Ciclo de Vida de uma Decisão

```
1. Totem solicita plano
   ↓
2. Dispatcher verifica cache
   ├─ Cache Hit → Retorna imediatamente (log apenas)
   └─ Cache Miss → Processa...
       ↓
3. Busca candidatos no banco
   ↓
4. Valida regras comerciais
   ↓
5. Decide estratégia
   ├─ SINGLE → Resolve diretamente
   ├─ PRIORITY → Escolhe melhor
   └─ MIX → Delega para Mix Service
       ↓
6. Validações técnicas e de integridade
   ↓
7. Gera Dispatch Plan
   ↓
8. Salva no cache
   ↓
9. Registra log de auditoria
   ↓
10. Retorna para totem
```

---

## 🎨 Visualização Simplificada

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITETURA GERAL                        │
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │   TOTEM      │──────│   API REST   │                   │
│  │  (Player)    │      │   (Express)  │                   │
│  └──────────────┘      └──────┬───────┘                   │
│                                │                            │
│                    ┌───────────┴───────────┐              │
│                    │                       │               │
│            ┌───────▼───────┐      ┌───────▼───────┐       │
│            │  DISPATCHER   │      │  PLAYLIST MIX │       │
│            │   SERVICE     │◄─────│   SERVICE     │       │
│            └───────┬───────┘      └───────────────┘       │
│                    │                                        │
│            ┌───────▼───────┐                              │
│            │   DATABASE    │                              │
│            │  (PostgreSQL) │                              │
│            └───────┬───────┘                              │
│                    │                                        │
│            ┌───────▼───────┐                              │
│            │     CACHE     │                              │
│            │   (Redis/     │                              │
│            │    Memory)    │                              │
│            └───────────────┘                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           WORKERS EM BACKGROUND                    │   │
│  │  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ Playlist Mix │  │ Playlist     │               │   │
│  │  │ Worker       │  │ Engine       │               │   │
│  │  │              │  │ Worker       │               │   │
│  │  └──────────────┘  └──────────────┘               │   │
│  │  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │ Invoice      │  │ Subscriber   │               │   │
│  │  │ Worker       │  │ Access       │               │   │
│  │  │              │  │ Worker       │               │   │
│  │  └──────────────┘  └──────────────┘               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Resumo Executivo

**Dispatcher-Totem** é o cérebro do sistema:
- Decide o que exibir em cada totem
- Resolve conflitos entre campanhas
- Valida regras comerciais e técnicas
- Gera planos de exibição
- Mantém auditoria completa

**Playlist Mix Service** é o especialista em combinação:
- Combina múltiplas campanhas inteligentemente
- Aplica regras sistemáticas ou IA
- Gera mixagens otimizadas
- Trabalha em conjunto com o Dispatcher

**Workers** são os mantenedores:
- Regeneram mixagens automaticamente
- Mantêm dados atualizados
- Executam tarefas periódicas
- Não bloqueiam requisições

**Resultado**: Sistema robusto, escalável e auditável que decide automaticamente o melhor conteúdo para cada totem em tempo real.
