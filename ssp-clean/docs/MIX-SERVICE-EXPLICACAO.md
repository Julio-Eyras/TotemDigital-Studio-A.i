# 🎵 Mix Service - Explicação Completa

## 📋 O que é o Mix Service?

O **Totem Playlist Mix Service** é um serviço que **combina múltiplas playlists de diferentes campanhas** em uma única playlist unificada para um totem, aplicando regras inteligentes de ordenação e distribuição.

---

## 🎯 Problema que Resolve

### **Cenário sem Mix Service:**
```
Totem 1 tem 3 campanhas ativas:
- Campanha A (prioridade 10) → Playlist A
- Campanha B (prioridade 8)  → Playlist B  
- Campanha C (prioridade 8)  → Playlist C

❌ Problema: Qual playlist exibir?
   → Dispatcher escolhe apenas UMA (a de maior prioridade)
   → Campanhas B e C ficam sem exibição
```

### **Cenário com Mix Service:**
```
Totem 1 tem 3 campanhas ativas:
- Campanha A (prioridade 10, time_share: 50%) → Playlist A
- Campanha B (prioridade 8, time_share: 30%)  → Playlist B  
- Campanha C (prioridade 8, time_share: 20%)  → Playlist C

✅ Solução: Mix Service combina todas em uma playlist única:
   → 50% do tempo para Campanha A
   → 30% do tempo para Campanha B
   → 20% do tempo para Campanha C
```

---

## 🔄 Como Funciona

### **Fluxo Completo:**

```
1. Obter Regra de Mixagem
   └─► Busca regra específica do totem OU regra global padrão

2. Obter Campanhas Ativas
   └─► Busca todas campanhas válidas para o totem
   └─► Via campaign_totems (direto) OU campaign_publishers (grupo)

3. Coletar Itens de Todas as Playlists
   └─► Para cada campanha → Para cada playlist → Para cada item
   └─► Cria MixItem[] com metadados

4. Calcular Peso de Cada Item
   └─► Peso = (prioridade × priority_weight) + 
              (tier × tier_weight) + 
              (time_share × time_weight) + 
              (tags × tag_weight) + 
              (subscriber × subscriber_weight) +
              (IA adjustments)

5. Ordenar e Filtrar
   └─► Ordena por peso (maior primeiro)
   └─► Aplica estratégia: round_robin, priority, weighted, ai_optimized
   └─► Filtra por max_items_per_playlist

6. Distribuir em Slots Temporais
   └─► Respeita time_share_percent de cada campanha
   └─► Respeita max_consecutive_slots (evita repetição)
   └─► Distribui ao longo do tempo

7. Salvar Mix Gerado
   └─► Salva em totem_playlist_mix
   └─► Marca como "current" (atual)
   └─► Cacheia por 30 minutos
```

---

## 📊 Estrutura de Dados

### **MixItem (Item na Playlist Mixada)**

```typescript
interface MixItem {
  media_id: number;           // ID da mídia
  playlist_id: number;        // ID da playlist original
  campaign_id: number;        // ID da campanha
  subscriber_id: number;      // ID do subscriber (anunciante)
  order_index: number;        // Ordem na playlist mixada
  weight: number;             // Peso calculado (para ordenação)
  source: 'campaign' | 'playlist';
  priority: number;           // Prioridade combinada
  tags?: string[];            // Tags da mídia
  duration?: number;          // Duração em segundos
}
```

### **TotemPlaylistMix (Mix Completo)**

```typescript
interface TotemPlaylistMix {
  mix_id: number;             // ID único do mix
  totem_id: number;           // Totem para o qual foi gerado
  rule_id?: number;           // Regra de mixagem usada
  mix_version: number;        // Versão do mix (incrementa a cada geração)
  mix_items: MixItem[];       // Itens ordenados
  total_items: number;        // Total de itens
  total_duration: number;      // Duração total em segundos
  mix_strategy: string;       // 'systematic', 'ai', 'hybrid'
  context_snapshot?: any;      // Snapshot do contexto (IA, etc)
  is_active: boolean;
  is_current: boolean;        // Se é o mix atual do totem
  generated_at: string;
  applied_at?: string;
}
```

---

## ⚙️ Regras de Mixagem

### **Tipos de Regras:**

1. **`systematic`** - Apenas regras sistemáticas (sem IA)
2. **`ai`** - Apenas IA (sem regras sistemáticas)
3. **`hybrid`** - Combinação de regras + IA

### **Pesos Configuráveis:**

```typescript
interface MixRule {
  priority_weight: number;      // Peso da prioridade (0-10)
  time_weight: number;          // Peso do horário (0-10)
  tag_weight: number;           // Peso das tags (0-10)
  subscriber_weight: number;     // Peso do subscriber (0-10)
  
  // Estratégias de rotação:
  rotation_strategy: 
    | 'round_robin'      // Alterna entre campanhas
    | 'priority'         // Ordena por prioridade
    | 'weighted'        // Ordena por peso calculado
    | 'ai_optimized';   // IA decide ordem
  
  max_items_per_playlist: number;  // Máximo de itens (padrão: 50)
  shuffle_enabled: boolean;         // Embaralhar dentro da mesma prioridade
}
```

### **Exemplo de Cálculo de Peso:**

```typescript
// Item da Campanha A:
priority = 10
commercial_tier = 'premium' (peso 3)
time_share_percent = 50%
priority_weight = 1.0
time_weight = 1.0

// Cálculo:
weight = (10 × 1.0) + (3 × 1.0) + (50 × 1.0) = 63

// Item da Campanha B:
priority = 8
commercial_tier = 'standard' (peso 2)
time_share_percent = 30%
priority_weight = 1.0
time_weight = 1.0

// Cálculo:
weight = (8 × 1.0) + (2 × 1.0) + (30 × 1.0) = 40

// Resultado: Campanha A vem primeiro (peso 63 > 40)
```

---

## 🤖 Integração com IA

### **Recursos de IA Disponíveis:**

1. **Pedestrian Detection** (`use_pedestrian_detection`)
   - Detecta número de pessoas próximas ao totem
   - Ajusta conteúdo baseado na densidade

2. **Sentiment Analysis** (`use_sentiment_analysis`)
   - Analisa sentimento do ambiente
   - Prioriza conteúdo positivo em ambientes negativos

3. **Context Awareness** (`use_context_awareness`)
   - Considera horário do dia, clima, eventos
   - Ajusta conteúdo contextualmente

4. **Historical Optimization** (`use_historical_optimization`)
   - Usa histórico de performance
   - Prioriza conteúdo que performou melhor

### **Exemplo com IA:**

```typescript
// Contexto detectado:
{
  pedestrian_count: 50,
  pedestrian_density: 'high',
  sentiment_score: 0.8,  // Positivo
  time_of_day: 'afternoon',
  day_type: 'weekday'
}

// IA ajusta pesos:
// → Conteúdo promocional ganha +20% de peso
// → Conteúdo educativo ganha -10% de peso
// → Conteúdo interativo ganha +15% de peso
```

---

## 📈 Distribuição em Slots Temporais

### **Como Funciona:**

O Mix Service distribui os itens ao longo do tempo respeitando:

1. **`time_share_percent`** - % de tempo que cada campanha deve ocupar
2. **`max_consecutive_slots`** - Máximo de itens consecutivos da mesma campanha

### **Exemplo:**

```
Campanha A: time_share = 50%, max_consecutive = 2
Campanha B: time_share = 30%, max_consecutive = 1
Campanha C: time_share = 20%, max_consecutive = 1

Distribuição (10 itens):
A, A, B, C, A, A, B, C, A, B

✅ Campanha A: 50% (5 itens)
✅ Campanha B: 30% (3 itens)
✅ Campanha C: 20% (2 itens)
✅ Máximo consecutivo respeitado
```

---

## 🔗 Integração com Dispatcher

### **Cenário Atual:**

```
Dispatcher → Escolhe UMA campanha → Gera plano único
```

### **Cenário Proposto (Unificado):**

```
Dispatcher → Decide estratégia:
  ├─► Se apenas 1 candidato → SINGLE (plano único)
  ├─► Se múltiplos com prioridades diferentes → PRIORITY (vencedor único)
  └─► Se múltiplos com mesma prioridade OU time_share > 0 → MIX
       └─► Chama Mix Service → Combina todas → Retorna plano unificado
```

---

## 💾 Armazenamento

### **Tabela: `totem_playlist_mix`**

```sql
CREATE TABLE totem_playlist_mix (
  mix_id SERIAL PRIMARY KEY,
  totem_id INTEGER NOT NULL,
  rule_id INTEGER,
  mix_version INTEGER,
  mix_items JSONB,              -- Array de MixItem[]
  total_items INTEGER,
  total_duration INTEGER,
  mix_strategy TEXT,
  context_snapshot JSONB,
  is_active BOOLEAN,
  is_current BOOLEAN,            -- Apenas um pode ser "current"
  generated_at TIMESTAMP,
  applied_at TIMESTAMP
);
```

### **Cache:**

- Cache por 30 minutos
- Chave: `totem_mix:{totemId}:current`
- Invalida quando nova mixagem é gerada

---

## 🎯 Casos de Uso

### **Caso 1: Múltiplas Campanhas com Mesma Prioridade**

```
Totem Shopping Center:
- Campanha Black Friday (prioridade 10)
- Campanha Natal (prioridade 10)
- Campanha Promoção Semanal (prioridade 10)

✅ Mix Service combina todas respeitando time_share_percent
```

### **Caso 2: Campanhas com Time Share Definido**

```
Totem Farmácia:
- Campanha Medicamentos (time_share: 60%)
- Campanha Promoções (time_share: 30%)
- Campanha Informações (time_share: 10%)

✅ Mix Service distribui respeitando os percentuais
```

### **Caso 3: Evitar Repetição**

```
Campanha Premium:
- max_consecutive_slots = 2

✅ Mix Service garante que não apareçam mais de 2 itens consecutivos
```

---

## 📊 Exemplo Prático Completo

### **Input:**

```typescript
Totem ID: 1
Campanhas Ativas:
  - Campanha A: priority=10, tier='premium', time_share=50%
  - Campanha B: priority=8, tier='standard', time_share=30%
  - Campanha C: priority=8, tier='standard', time_share=20%

Regra de Mixagem:
  - priority_weight: 1.0
  - time_weight: 1.0
  - rotation_strategy: 'weighted'
  - max_items_per_playlist: 20
```

### **Processamento:**

```
1. Coleta itens:
   - Campanha A: 10 itens
   - Campanha B: 8 itens
   - Campanha C: 5 itens

2. Calcula pesos:
   - Item A: peso = 63
   - Item B: peso = 40
   - Item C: peso = 40

3. Ordena por peso:
   - Todos A primeiro (peso 63)
   - Depois B e C alternados (peso 40)

4. Distribui respeitando time_share:
   - 50% para A = 10 itens
   - 30% para B = 6 itens
   - 20% para C = 4 itens
   Total: 20 itens
```

### **Output:**

```json
{
  "mix_id": 123,
  "totem_id": 1,
  "mix_version": 5,
  "total_items": 20,
  "total_duration": 300,
  "mix_strategy": "systematic",
  "mix_items": [
    {"media_id": 1, "campaign_id": 1, "order_index": 1, "weight": 63},
    {"media_id": 2, "campaign_id": 1, "order_index": 2, "weight": 63},
    ...
    {"media_id": 11, "campaign_id": 2, "order_index": 11, "weight": 40},
    ...
  ]
}
```

---

## ✅ Vantagens do Mix Service

1. **Permite múltiplas campanhas simultâneas** - Não precisa escolher apenas uma
2. **Respeita contratos comerciais** - Time share percent garante distribuição justa
3. **Evita repetição** - Max consecutive slots previne monotonia
4. **Inteligente** - Pode usar IA para otimização
5. **Flexível** - Regras configuráveis por totem
6. **Auditável** - Tudo é registrado em `totem_playlist_mix`

---

## ⚠️ Limitações Atuais

1. **Não valida temporalmente** - Não verifica `start_time`, `end_time`, `days_of_week`
2. **Não valida técnica** - Não verifica resolução/orientação antes de mixar
3. **Não integra com Dispatcher** - São serviços separados
4. **Não considera acesso** - Não valida se subscriber tem acesso ao publisher

---

## 🔄 Próximos Passos (Proposta)

1. **Integrar com Dispatcher** - Dispatcher decide quando usar Mix
2. **Adicionar validações** - Temporal, técnica, acesso
3. **Melhorar distribuição** - Considerar horários específicos
4. **Otimizar performance** - Cache mais inteligente

---

**Data:** 2026-01-13  
**Versão:** 1.0
