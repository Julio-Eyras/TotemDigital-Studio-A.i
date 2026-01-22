# Documentação: Playlist Mixer por Totem

## 📋 Visão Geral

A tela **Playlist Mixer por Totem** é uma interface de gerenciamento e visualização do sistema de mixagem inteligente de playlists. Ela permite visualizar, gerar e analisar como múltiplas campanhas e playlists são combinadas (mixadas) para criar uma playlist final otimizada para cada totem.

### Objetivo Principal

Criar e gerenciar playlists mixadas que combinam conteúdo de múltiplas campanhas, respeitando:
- **Prioridades** das campanhas
- **Parâmetros de rotação** (round-robin, weighted, priority-based)
- **Regras de mixagem** (systematic, AI, hybrid)
- **Contexto de IA** (transeuntes, sentimento, horário)
- **Histórico de performance**

---

## 🎯 Funcionalidades da Tela

### 1. Seleção de Totem

**Campo:** Dropdown "Totem"

**Problema Identificado:** O campo não está apresentando totens no combo.

**Causa Provável:**
- A API `totemApi.getAll()` pode não estar retornando dados
- Os totens podem não estar sendo carregados corretamente
- Pode haver problema de autenticação/autorização

**Solução:**
- Verificar se a API `/api/totems` está retornando dados
- Verificar se os totens estão ativos (`is_active = true`)
- Verificar permissões do usuário

**Campo "Gerar nova mixagem":**
- **Status:** Fica desabilitado quando nenhum totem está selecionado
- **Comportamento Correto:** O botão deve estar desabilitado até que um totem seja selecionado
- **Tipo:** É um botão (Button), não um campo de texto - está correto

### 2. Playlist Mixada Atual

Exibe a mixagem atual do totem selecionado, mostrando:
- **Versão** da mixagem
- **Total de itens** na playlist
- **Duração total** em minutos
- **Mapa visual** de slots (timeline colorida por campanha)
- **Lista detalhada** de itens com:
  - Ordem de exibição
  - Campanha, Playlist e Mídia
  - Duração, peso e prioridade

### 3. Contexto de IA

Exibe dados coletados para otimização via IA:
- **Pessoas detectadas** (pedestrian_count)
- **Densidade** (low, medium, high)
- **Sentimento** (score e label: positive, neutral, negative)
- **Momento do dia** (morning, afternoon, evening, night)
- **Tipo de dia** (weekday, weekend, holiday)

**Uso Futuro:** Esses dados serão usados para integração com IA para otimização automática das mixagens.

### 4. Regras de Mixagem

Lista as regras ativas que influenciam a ordenação:
- **Nome e descrição** da regra
- **Tipo:** systematic, ai, hybrid
- **Estratégia de rotação:** round_robin, priority, weighted, ai_optimized
- **Máximo de itens** por playlist
- **Status:** ativa/inativa, padrão

### 5. Histórico de Mixagens

Tabela com histórico de todas as mixagens geradas:
- **ID da mixagem**
- **Estratégia** usada
- **Total de itens** e **duração**
- **Score de engajamento** (0-100)
- **Número de execuções**
- **Datas** de geração, aplicação e última execução

**Filtros disponíveis:**
- Por estratégia (systematic, ai, hybrid)
- Por data (início e fim)
- Paginação

---

## 🗄️ Tabelas Relacionadas

### 1. `totem_playlist_mix`
Armazena a playlist mixada final de cada totem.

**Campos principais:**
- `mix_id`: ID único da mixagem
- `totem_id`: Totem ao qual pertence
- `rule_id`: Regra usada para gerar (FK para `playlist_mix_rules`)
- `mix_version`: Versão da mixagem (incrementa a cada nova)
- `mix_items`: JSONB array com itens ordenados
  ```json
  [
    {
      "media_id": 1,
      "playlist_id": 1,
      "campaign_id": 1,
      "order_index": 0,
      "weight": 0.5,
      "source": "campaign",
      "display_seconds": 10
    }
  ]
  ```
- `total_items`: Total de itens na mixagem
- `total_duration`: Duração total em segundos
- `mix_strategy`: Estratégia usada (systematic, ai, hybrid)
- `context_snapshot`: Snapshot do contexto no momento da geração
- `is_active`: Se está ativa
- `is_current`: Se é a playlist atual do totem
- `generated_at`: Quando foi gerada
- `applied_at`: Quando foi aplicada ao totem

### 2. `playlist_mix_rules`
Regras que definem como as playlists devem ser mixadas.

**Campos principais:**
- `rule_id`: ID único
- `totem_id`: NULL = regra global, INTEGER = regra específica do totem
- `name`: Nome da regra
- `description`: Descrição
- `rule_type`: systematic, ai, hybrid
- **Pesos:**
  - `priority_weight`: Peso da prioridade (0.0-10.0)
  - `time_weight`: Peso do horário (0.0-10.0)
  - `tag_weight`: Peso das tags (0.0-10.0)
  - `subscriber_weight`: Peso do subscriber (0.0-10.0)
- **Configurações de IA:**
  - `ai_enabled`: Se IA está habilitada
  - `ai_provider`: ollama, openai, anthropic, custom
  - `ai_model`: Modelo específico
  - `ai_config`: Configurações JSONB
- **Recursos de IA:**
  - `use_pedestrian_detection`: Reconhecimento de transeuntes
  - `use_sentiment_analysis`: Análise de sentimento
  - `use_context_awareness`: Consciência contextual
  - `use_historical_optimization`: Otimização baseada em histórico
- **Configurações de Mixagem:**
  - `max_items_per_playlist`: Máximo de itens (padrão: 50)
  - `rotation_strategy`: round_robin, priority, weighted, ai_optimized
  - `shuffle_enabled`: Se deve embaralhar dentro da mesma prioridade
- `is_active`: Se está ativa
- `is_default`: Se é a regra padrão

### 3. `ai_context_data`
Dados de contexto coletados para IA.

**Campos principais:**
- `context_id`: ID único
- `totem_id`: Totem ao qual pertence
- **Transeuntes:**
  - `pedestrian_count`: Número de pessoas detectadas
  - `pedestrian_density`: low, medium, high
  - `pedestrian_demographics`: JSONB com demografia
  - `last_pedestrian_detection`: Última detecção
- **Sentimento:**
  - `sentiment_score`: -1.0 (negativo) a 1.0 (positivo)
  - `sentiment_label`: positive, neutral, negative
  - `emotion_tags`: Array de emoções
  - `last_sentiment_analysis`: Última análise
- **Contexto Temporal/Ambiental:**
  - `time_of_day`: morning, afternoon, evening, night
  - `day_type`: weekday, weekend, holiday
  - `weather_context`: JSONB com clima
  - `event_context`: JSONB com eventos
- **Performance:**
  - `performance_metrics`: JSONB com métricas
  - `last_performance_update`: Última atualização
- `raw_ai_data`: Dados brutos da IA

### 4. `playlist_mix_history`
Histórico de todas as mixagens geradas.

**Campos principais:**
- `history_id`: ID único
- `totem_id`: Totem
- `mix_id`: FK para `totem_playlist_mix` (pode ser NULL se mix foi deletada)
- `rule_id`: Regra usada
- `mix_strategy`: Estratégia usada
- `total_items`: Total de itens
- `total_duration`: Duração total
- **Performance:**
  - `execution_count`: Quantas vezes foi executada
  - `average_view_time`: Tempo médio de visualização
  - `engagement_score`: Score de engajamento (0-100)
- `context_snapshot`: Snapshot do contexto
- `generated_at`: Quando foi gerada
- `applied_at`: Quando foi aplicada
- `last_executed_at`: Última execução

---

## 🔄 Fluxo de Funcionamento

### 1. Seleção de Totem
```
Usuário seleciona totem → Frontend chama:
- totemApi.getAll() → Lista totens
- getCurrentMix(totemId) → Mix atual
- getAIContext(totemId) → Contexto de IA
- getMixRules(totemId) → Regras ativas
- getMixHistory({totemId}) → Histórico
```

### 2. Geração de Nova Mixagem
```
Usuário clica "Gerar nova mixagem" → Frontend chama:
- generateMix(totemId) → Backend gera nova mixagem
  → Backend:
    1. Busca campanhas ativas para o totem
    2. Busca regra de mixagem (específica do totem ou padrão)
    3. Aplica regras de rotação e priorização
    4. Se IA habilitada: usa contexto de IA para otimização
    5. Gera mix_items ordenados
    6. Salva em totem_playlist_mix
    7. Cria registro em playlist_mix_history
    8. Retorna mixagem gerada
```

### 3. Visualização
```
Frontend exibe:
- Mapa visual de slots (timeline colorida)
- Lista detalhada de itens
- Resumo por campanha (distribuição de tempo)
- Contexto de IA
- Regras ativas
- Histórico com filtros
```

---

## 📊 Estratégias de Mixagem

### 1. Systematic
Mixagem baseada apenas em regras sistemáticas:
- Prioridade da campanha
- Horário (time_share_percent)
- Tags
- Subscriber

**Sem uso de IA.**

### 2. AI
Mixagem baseada apenas em IA:
- Usa contexto de IA (transeuntes, sentimento)
- Otimização baseada em histórico
- Análise de performance

**Sem regras sistemáticas.**

### 3. Hybrid
Combina regras sistemáticas + IA:
- Aplica regras sistemáticas primeiro
- IA otimiza a ordenação final
- Considera contexto e histórico

**Recomendado para máxima otimização.**

---

## 🔄 Estratégias de Rotação

### 1. round_robin
Rotação circular igual entre campanhas.

### 2. priority
Prioriza campanhas com maior prioridade.

### 3. weighted
Distribui tempo proporcionalmente aos pesos.

### 4. ai_optimized
IA decide a melhor ordenação baseada em contexto e histórico.

---

## 🎨 Visualização na Tela

### Mapa Visual de Slots
Barra horizontal colorida onde cada cor representa uma campanha:
- Largura proporcional à duração
- Tooltip mostra detalhes ao passar o mouse
- Legenda mostra distribuição por campanha

### Lista Detalhada
Lista ordenada de itens mostrando:
- #1, #2, #3... (ordem de exibição)
- Campanha X • Playlist Y • Mídia Z
- Duração: Xs • Peso: Y • Prioridade: Z

### Resumo por Campanha
Chips coloridos mostrando:
- Campanha X: Y% do tempo (~Z min)

---

## 🐛 Problemas Identificados e Soluções

### 1. Combo de Totens Vazio

**Problema:** Campo "Selecione totem" não apresenta opções.

**Possíveis Causas:**
1. **Paginação:** A API retorna apenas 10 totens por padrão. Se houver mais totens, pode não retornar todos.
2. **Formato da resposta:** A API retorna `{ data: [], total: 0, page: 1, limit: 10 }`, mas o frontend espera `resp.data`.
3. Totens não estão ativos (`is_active = false`)
4. Problema de autenticação/autorização
5. Erro na chamada da API

**Solução:**
1. **Verificar paginação:** A chamada `totemApi.getAll()` deve incluir `limit: 100` ou maior:
   ```typescript
   const resp = await totemApi.getAll({ limit: 100 });
   ```
2. **Verificar console do navegador** para erros
3. **Verificar Network tab** para ver resposta da API
4. **Verificar se totens existem e estão ativos** no banco:
   ```sql
   SELECT totem_id, name, identifier, is_active, status 
   FROM totems 
   WHERE is_active = true 
   ORDER BY totem_id;
   ```
5. **Verificar permissões** do usuário
6. **Verificar formato da resposta:** A API deve retornar `{ data: [...] }` e o frontend usa `resp.data`

### 2. Botão "Gerar nova mixagem" Desabilitado

**Status:** Comportamento correto - deve estar desabilitado até selecionar totem.

**Se estiver desabilitado mesmo com totem selecionado:**
- Verificar se `selectedTotemId` está sendo setado corretamente
- Verificar se há erro na validação

---

## 📝 Dados de Carga Incluídos

A carga inicial (`carga-inicial-v6.sql`) agora inclui:

### 1. Regras de Mixagem (`playlist_mix_rules`)
- **Regra padrão global** (systematic)
- **Regra para Totem 1** (hybrid com IA)
- **Regra para Totem 2** (systematic)
- **Regra para Totem 9** (systematic)
- **Regra global com IA** (para futura integração)

### 2. Contexto de IA (`ai_context_data`)
- Dados para Totem 1 (alto tráfego, positivo)
- Dados para Totem 2 (médio tráfego, neutro)
- Dados para Totem 3 (baixo tráfego, positivo)
- Dados para Totem 9 (alto tráfego, neutro)
- Dados para Totem 10 (médio tráfego, positivo)

### 3. Histórico de Mixagens (`playlist_mix_history`)
- Histórico para Totem 1 (2 registros)
- Histórico para Totem 2 (2 registros)
- Histórico para Totem 3 (1 registro)
- Histórico para Totem 9 (2 registros - recentes)
- Histórico para Totem 10 (1 registro)

### 4. Mixes Atuais (`totem_playlist_mix`)
- Mixes já existentes para todos os totens ativos
- Mixes recentes para Totem 9 e 10

---

## 🚀 Próximos Passos (Integração com IA)

1. **Coleta Automática de Contexto:**
   - Integração com câmeras para detecção de transeuntes
   - Análise de sentimento em tempo real
   - Coleta de métricas de performance

2. **Otimização Automática:**
   - IA analisa contexto e histórico
   - Gera mixagens otimizadas automaticamente
   - Ajusta pesos e prioridades dinamicamente

3. **A/B Testing:**
   - Testa diferentes mixagens
   - Compara performance
   - Seleciona melhor estratégia

---

## 📚 Referências

- **Tabelas:** `totem_playlist_mix`, `playlist_mix_rules`, `ai_context_data`, `playlist_mix_history`
- **API:** `/api/playlist-mix/*`, `/api/totems/:id/playlist/mix/*`
- **Frontend:** `frontend/src/pages/PlaylistMix/PlaylistMix.tsx`
- **Backend:** `backend/src/routes/playlist-mix.ts`, `backend/src/services/totemPlaylistMixService.ts`
