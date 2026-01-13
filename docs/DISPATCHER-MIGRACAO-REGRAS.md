# 🔄 Migração de Regras: Mix Service → Dispatcher

## 📋 Objetivo

Analisar regras importantes do **Totem Playlist Mix Service** que devem ser migradas para o **Dispatcher-Totem Service** para centralizar a lógica de decisão e garantir consistência.

---

## 🎯 Regras Importantes Identificadas no Mix Service

### **1. Regras Comerciais (CRÍTICAS)**

#### **A. Commercial Tier (`commercial_tier`)**
**Localização:** `totemPlaylistMixService.ts:738-745`

```typescript
const tierWeights: Record<string, number> = {
  premium: 3,
  standard: 2,
  remnant: 1,
};
```

**Por que migrar:**
- ✅ Afeta decisão de qual campanha exibir
- ✅ Deve ser considerado ANTES de gerar mix
- ✅ É regra de negócio, não de mixagem

**Onde usar no Dispatcher:**
- Na função `resolveConflicts()` - adicionar tier como critério de desempate
- Na função `calculateScore()` - incluir peso do tier

---

#### **B. Time Share Percent (`time_share_percent`)**
**Localização:** `totemPlaylistMixService.ts:748-759`

```typescript
const effectiveTimeShare = publisherTimeShare ?? defaultTimeShare;
if (effectiveTimeShare > 0) {
  const timeShareFactor = (effectiveTimeShare / 100) * 10;
  weight += timeShareFactor * (rule.time_weight || 1);
}
```

**Por que migrar:**
- ✅ Define se deve usar MIX ou SINGLE
- ✅ Se `time_share_percent > 0` → indica necessidade de mix
- ✅ É critério de decisão, não de execução

**Onde usar no Dispatcher:**
- Na função `decideStrategy()` - verificar se há time_share para decidir MIX
- Na função `getCandidateSchedules()` - incluir time_share nos candidatos

---

#### **C. Max Consecutive Slots (`max_consecutive_slots`)**
**Localização:** `totemPlaylistMixService.ts:899`

```typescript
const maxConsecutive = campaign.max_consecutive_slots || 2;
if (currentConsecutive >= maxConsecutive) continue;
```

**Por que migrar:**
- ✅ É regra de negócio que afeta decisão
- ✅ Deve ser validado ANTES de gerar plano
- ✅ Pode influenciar escolha entre campanhas

**Onde usar no Dispatcher:**
- Na função `validateCommercialRules()` - validar limites
- Na função `decideStrategy()` - considerar ao decidir MIX

---

#### **D. Max Impressions Per Hour (`max_impressions_per_hour`)**
**Localização:** `totemPlaylistMixService.ts:902`

```typescript
const maxImpressions = campaign.max_impressions_per_hour || Infinity;
if (maxImpressions !== Infinity && hourlyImpressions >= maxImpressions) continue;
```

**Por que migrar:**
- ✅ Limite comercial que afeta disponibilidade
- ✅ Deve ser verificado antes de selecionar campanha
- ✅ É regra de negócio, não técnica

**Onde usar no Dispatcher:**
- Na função `validateCommercialRules()` - verificar limites de impressão
- Na função `getCandidateSchedules()` - filtrar campanhas que atingiram limite

---

### **2. Regras de Ordenação (IMPORTANTES)**

#### **A. Cálculo de Peso com Múltiplos Fatores**
**Localização:** `totemPlaylistMixService.ts:724-809`

**Fatores considerados:**
1. Prioridade da campanha (`priority`)
2. Tier comercial (`commercial_tier`)
3. Time share percent (`time_share_percent`)
4. Prioridade da playlist (`playlist.priority`)
5. Horário (`time_weight`)
6. Tags (`tag_weight`)
7. Subscriber (`subscriber_weight`)
8. Ajustes de IA (pedestrian, sentiment, performance)

**Por que migrar:**
- ✅ Cálculo de peso é parte da decisão, não da execução
- ✅ Dispatcher precisa saber qual campanha tem maior peso
- ✅ Atualmente Dispatcher só considera `priority`, ignora outros fatores

**Onde usar no Dispatcher:**
- Substituir `calculateScore()` simples por cálculo completo de peso
- Usar peso calculado em `resolveConflicts()`

---

#### **B. Estratégias de Rotação**
**Localização:** `totemPlaylistMixService.ts:995-1007`

**Estratégias:**
- `round_robin` - Alterna entre campanhas
- `priority` - Ordena por prioridade
- `weighted` - Ordena por peso calculado
- `ai_optimized` - IA decide ordem

**Por que migrar:**
- ✅ Afeta decisão de qual campanha escolher
- ✅ Deve ser aplicado ANTES de gerar plano
- ✅ É regra de negócio, não técnica

**Onde usar no Dispatcher:**
- Na função `resolveConflicts()` - aplicar estratégia de rotação
- Na função `decideStrategy()` - considerar estratégia ao decidir MIX

---

### **3. Regras de Distribuição Temporal (CRÍTICAS)**

#### **A. Distribuição em Slots Temporais**
**Localização:** `totemPlaylistMixService.ts:815-960`

**Lógica:**
- Cria timeline de 24 horas (144 slots de 10 minutos)
- Distribui itens respeitando `time_share_percent`
- Respeita `max_consecutive_slots`
- Respeita `max_impressions_per_hour`

**Por que migrar:**
- ⚠️ **NÃO DEVE SER MIGRADO COMPLETAMENTE**
- ✅ Mas a **DECISÃO** de usar distribuição temporal deve estar no Dispatcher
- ✅ Dispatcher deve decidir: "Preciso distribuir temporalmente?" → Chama Mix Service

**Onde usar no Dispatcher:**
- Na função `decideStrategy()` - se `time_share_percent > 0` → MIX
- Dispatcher chama Mix Service para executar distribuição

---

### **4. Regras de IA (OPCIONAIS)**

#### **A. Ajustes Baseados em Contexto de IA**
**Localização:** `totemPlaylistMixService.ts:786-806`

**Ajustes:**
- Pedestrian detection → multiplicador de densidade
- Sentiment analysis → multiplicador de sentimento
- Historical optimization → multiplicador de performance

**Por que migrar:**
- ✅ Afeta peso/prioridade das campanhas
- ✅ Deve ser considerado na decisão
- ✅ Mas pode ser opcional (se IA não disponível)

**Onde usar no Dispatcher:**
- Na função `calculateScore()` - incluir ajustes de IA se disponível
- Na função `getCandidateSchedules()` - buscar contexto de IA se habilitado

---

## 📊 Matriz de Decisão: O que Migrar?

| Regra | Localização Atual | Migrar? | Prioridade | Onde Usar no Dispatcher |
|-------|------------------|---------|------------|-------------------------|
| `commercial_tier` | Mix Service | ✅ SIM | 🔴 ALTA | `resolveConflicts()`, `calculateScore()` |
| `time_share_percent` | Mix Service | ✅ SIM | 🔴 ALTA | `decideStrategy()`, `getCandidateSchedules()` |
| `max_consecutive_slots` | Mix Service | ✅ SIM | 🟡 MÉDIA | `validateCommercialRules()`, `decideStrategy()` |
| `max_impressions_per_hour` | Mix Service | ✅ SIM | 🟡 MÉDIA | `validateCommercialRules()`, `getCandidateSchedules()` |
| Cálculo de peso completo | Mix Service | ✅ SIM | 🔴 ALTA | Substituir `calculateScore()` |
| Estratégias de rotação | Mix Service | ✅ SIM | 🟡 MÉDIA | `resolveConflicts()`, `decideStrategy()` |
| Distribuição temporal | Mix Service | ❌ NÃO | - | Mix Service executa, Dispatcher decide quando usar |
| Ajustes de IA | Mix Service | ✅ SIM | 🟢 BAIXA | `calculateScore()` (opcional) |

---

## 🔄 Plano de Migração

### **Fase 1: Migrar Regras Comerciais Críticas** (Prioridade ALTA)

#### **1.1. Adicionar campos comerciais em `CandidateSchedule`**

```typescript
export interface CandidateSchedule {
  // ... campos existentes ...
  
  // NOVOS CAMPOS:
  commercialTier?: 'premium' | 'standard' | 'remnant';
  timeSharePercent?: number;
  maxConsecutiveSlots?: number;
  maxImpressionsPerHour?: number;
}
```

#### **1.2. Buscar campos comerciais em `getCandidateSchedules()`**

```typescript
// Modificar query para incluir:
SELECT 
  c.commercial_tier,
  c.default_time_share_percent,
  c.max_consecutive_slots,
  cp.time_share_percent,
  cp.max_impressions_per_hour
FROM campaigns c
LEFT JOIN campaign_publishers cp ON ...
```

#### **1.3. Implementar `validateCommercialRules()`**

```typescript
private async validateCommercialRules(
  candidate: CandidateSchedule,
  totemId: number,
  timestamp: Date
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  // 1. Verificar max_impressions_per_hour
  if (candidate.maxImpressionsPerHour) {
    const currentHour = timestamp.getHours();
    const impressionsThisHour = await this.getImpressionsCount(
      candidate.campaignId,
      totemId,
      currentHour
    );
    if (impressionsThisHour >= candidate.maxImpressionsPerHour) {
      errors.push('Limite de impressões por hora atingido');
    }
  }
  
  // 2. Verificar acesso subscriber → publisher
  const access = await this.checkSubscriberPublisherAccess(
    candidate.subscriberId,
    totemId
  );
  if (!access.valid) {
    errors.push('Subscriber não tem acesso a este publisher');
  }
  
  return { valid: errors.length === 0, errors };
}
```

#### **1.4. Implementar `decideStrategy()`**

```typescript
private decideStrategy(
  candidates: CandidateSchedule[]
): 'single' | 'priority' | 'mix' {
  if (candidates.length === 0) return 'single';
  if (candidates.length === 1) return 'single';
  
  // Verificar se algum tem time_share_percent > 0
  const hasTimeShare = candidates.some(
    c => (c.timeSharePercent || 0) > 0
  );
  
  if (hasTimeShare) {
    return 'mix'; // Time share requer mix
  }
  
  // Verificar prioridades
  const priorities = candidates.map(c => c.priority);
  const maxPriority = Math.max(...priorities);
  const candidatesWithMaxPriority = candidates.filter(
    c => c.priority === maxPriority
  );
  
  if (candidatesWithMaxPriority.length === 1) {
    return 'priority'; // Apenas um com prioridade máxima
  }
  
  // Mesma prioridade = mixar
  return 'mix';
}
```

---

### **Fase 2: Migrar Cálculo de Peso Completo** (Prioridade ALTA)

#### **2.1. Substituir `calculateScore()` simples por cálculo completo**

```typescript
private calculateWeight(
  candidate: CandidateSchedule,
  rule?: MixRule,
  aiContext?: AIContext
): number {
  let weight = 0;
  
  // 1. Prioridade da campanha
  weight += candidate.priority * (rule?.priority_weight || 1.0);
  
  // 2. Tier comercial
  const tierWeights: Record<string, number> = {
    premium: 3,
    standard: 2,
    remnant: 1,
  };
  const tierWeight = tierWeights[candidate.commercialTier || 'standard'] || 2;
  weight += tierWeight * (rule?.priority_weight || 1.0);
  
  // 3. Time share percent
  if (candidate.timeSharePercent && candidate.timeSharePercent > 0) {
    const timeShareFactor = (candidate.timeSharePercent / 100) * 10;
    weight += timeShareFactor * (rule?.time_weight || 1.0);
  }
  
  // 4. Ajustes de IA (se disponível)
  if (aiContext && rule?.ai_enabled) {
    // Pedestrian detection
    if (rule.use_pedestrian_detection && aiContext.pedestrian_count > 0) {
      const densityMultiplier = aiContext.pedestrian_density === 'high' ? 1.5 :
                               aiContext.pedestrian_density === 'medium' ? 1.2 : 1.0;
      weight *= densityMultiplier;
    }
    
    // Sentiment analysis
    if (rule.use_sentiment_analysis && aiContext.sentiment_score !== undefined) {
      const sentimentMultiplier = 1.0 + (aiContext.sentiment_score * 0.3);
      weight *= sentimentMultiplier;
    }
  }
  
  return Math.max(0, weight);
}
```

#### **2.2. Usar peso calculado em `resolveConflicts()`**

```typescript
private async resolveConflicts(
  candidates: CandidateSchedule[]
): Promise<CandidateSchedule | null> {
  // Calcular peso para cada candidato
  const rule = await this.getMixRuleForTotem(candidates[0]?.totemId);
  const aiContext = rule?.ai_enabled ? await this.getAIContext(...) : null;
  
  const candidatesWithWeight = candidates.map(c => ({
    ...c,
    weight: this.calculateWeight(c, rule, aiContext),
  }));
  
  // Ordenar por:
  // 1. Peso calculado (maior primeiro)
  // 2. Escopo (direct > group)
  // 3. Data de criação (mais recente primeiro)
  candidatesWithWeight.sort((a, b) => {
    if (a.weight !== b.weight) return b.weight - a.weight;
    if (a.scope !== b.scope) {
      if (a.scope === 'totem') return -1;
      if (b.scope === 'totem') return 1;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  
  return candidatesWithWeight[0] || null;
}
```

---

### **Fase 3: Integrar com Mix Service** (Prioridade ALTA)

#### **3.1. Modificar `dispatch()` para usar estratégia**

```typescript
async dispatch(
  request: DispatchRequest,
  options: DispatchOptions = {}
): Promise<DispatchResponse> {
  // ... código existente de descoberta ...
  
  // NOVO: Decidir estratégia
  const strategy = this.decideStrategy(candidates);
  
  if (strategy === 'mix') {
    // Chamar Mix Service
    const mixService = getTotemPlaylistMixService();
    const mix = await mixService.generateMixForTotem(request.totemId);
    
    // Converter TotemPlaylistMix → DispatchPlan
    const plan = await this.convertMixToDispatchPlan(mix, request.totemId, request.timestamp);
    
    return {
      success: true,
      plan,
      fromCache: false,
      executionTimeMs: Date.now() - startTime,
    };
  }
  
  // Estratégia SINGLE ou PRIORITY (código existente)
  const winner = await this.resolveConflicts(candidates);
  // ... resto do código ...
}
```

---

## ⚠️ Cuidados e Considerações

### **1. Não Quebrar Funcionalidade Existente**
- ✅ Manter Mix Service funcionando independentemente
- ✅ Dispatcher pode usar Mix Service quando necessário
- ✅ Não remover código do Mix Service, apenas adicionar no Dispatcher

### **2. Compatibilidade com Código Existente**
- ✅ `CandidateSchedule` deve manter campos existentes
- ✅ Adicionar novos campos como opcionais
- ✅ Validar se campos existem antes de usar

### **3. Performance**
- ✅ Cache de regras de mixagem (já existe)
- ✅ Cache de contexto de IA (já existe)
- ✅ Evitar queries desnecessárias

### **4. Testes**
- ✅ Testar cada fase isoladamente
- ✅ Testar integração Dispatcher ↔ Mix Service
- ✅ Testar casos extremos (sem time_share, sem IA, etc.)

---

## 📝 Checklist de Migração

### **Fase 1: Regras Comerciais**
- [ ] Adicionar campos comerciais em `CandidateSchedule`
- [ ] Modificar `getCandidateSchedules()` para buscar campos comerciais
- [ ] Implementar `validateCommercialRules()`
- [ ] Implementar `decideStrategy()`
- [ ] Testar validação de regras comerciais

### **Fase 2: Cálculo de Peso**
- [ ] Implementar `calculateWeight()` completo
- [ ] Substituir `calculateScore()` por `calculateWeight()`
- [ ] Modificar `resolveConflicts()` para usar peso completo
- [ ] Testar cálculo de peso com diferentes cenários

### **Fase 3: Integração Mix Service**
- [ ] Modificar `dispatch()` para usar `decideStrategy()`
- [ ] Implementar `convertMixToDispatchPlan()`
- [ ] Testar integração Dispatcher ↔ Mix Service
- [ ] Testar estratégias SINGLE, PRIORITY, MIX

---

## 🎯 Resultado Esperado

Após a migração:

1. **Dispatcher centraliza TODAS as decisões**
   - Qual campanha escolher
   - Quando usar MIX vs SINGLE
   - Como calcular prioridade/peso

2. **Mix Service foca apenas em EXECUÇÃO**
   - Recebe decisão do Dispatcher
   - Executa distribuição temporal
   - Gera playlist mixada

3. **Regras comerciais aplicadas consistentemente**
   - `commercial_tier` afeta decisão
   - `time_share_percent` determina estratégia
   - `max_consecutive_slots` e `max_impressions_per_hour` validados

---

**Data:** 2026-01-13  
**Versão:** 1.0  
**Branch:** `dispatcher-totens`
