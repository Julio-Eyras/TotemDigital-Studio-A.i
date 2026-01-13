# 📊 Análise Completa: Dispatcher-Totem - União de Propostas

## 🎯 Objetivo

Este documento analisa a proposta do ChatGPT sobre o módulo Dispatcher-Totem, compara com o que já está implementado no sistema SmartSignage Pro, e propõe uma união das abordagens com melhorias incrementais.

---

## 📋 1. O QUE JÁ ESTÁ IMPLEMENTADO

### 1.1. Dispatcher-Totem Service (`dispatcherTotemService.ts`)

**Status:** ✅ **IMPLEMENTADO**

**Funcionalidades Atuais:**
- ✅ Descoberta de candidatos (campanhas ativas para um totem)
- ✅ Resolução de conflitos por prioridade
- ✅ Validação temporal (datas, horários, dias da semana)
- ✅ Validação de compatibilidade técnica (parcial - TODO)
- ✅ Validação de integridade de playlists
- ✅ Geração de planos de exibição (`DispatchPlan`)
- ✅ Cache de planos (configurável, TTL padrão: 60s)
- ✅ Auditoria completa em `dispatcher_log`

**Fluxo Atual:**
```
1. getCandidateSchedules() → Busca campanhas ativas
2. resolveConflicts() → Ordena por prioridade/escopo
3. validateTemporalFrequency() → Valida datas/horários/dias
4. validateTechnicalCompatibility() → Valida resolução/orientação (TODO)
5. validatePlaylistIntegrity() → Valida mídias
6. generateDispatchPlan() → Gera plano final
7. logDispatch() → Registra em dispatcher_log
```

**Limitações Identificadas:**
- ⚠️ Validação técnica ainda não implementa resolução/orientação
- ⚠️ Não considera múltiplas playlists simultâneas (apenas seleciona uma)
- ⚠️ Não integra com `TotemPlaylistMixService` para combinar playlists
- ⚠️ Não considera `commercial_tier`, `time_share_percent`, `max_consecutive_slots`

### 1.2. Totem Playlist Mix Service (`totemPlaylistMixService.ts`)

**Status:** ✅ **IMPLEMENTADO**

**Funcionalidades Atuais:**
- ✅ Mixagem inteligente de múltiplas playlists
- ✅ Regras sistemáticas (prioridade, tempo, tags, subscriber)
- ✅ Suporte a IA (pedestrian detection, sentiment analysis, context awareness)
- ✅ Estratégias de rotação: `round_robin`, `priority`, `weighted`, `ai_optimized`
- ✅ Geração de `totem_playlist_mix` com itens ordenados
- ✅ Cache de regras de mixagem

**Fluxo Atual:**
```
1. getMixRuleForTotem() → Obtém regra de mixagem
2. generateMixForTotem() → Gera mix de playlists
3. Aplica pesos: priority_weight, time_weight, tag_weight, subscriber_weight
4. Ordena por estratégia (round_robin, priority, weighted, ai_optimized)
5. Salva em totem_playlist_mix
```

**Limitações Identificadas:**
- ⚠️ Não considera validação temporal (start_time, end_time, days_of_week)
- ⚠️ Não valida compatibilidade técnica antes de mixar
- ⚠️ Não integra com `DispatcherTotemService` para decisões unificadas

### 1.3. Estrutura de Dados

**Tabelas Relevantes:**
- ✅ `campaigns` - Campanhas com `priority`, `start_date`, `end_date`, `start_time`, `end_time`, `days_of_week`
- ✅ `campaign_totems` - Associação direta totem-campanha (com overrides de prioridade/horário)
- ✅ `campaign_publishers` - Associação via publisher (grupo)
- ✅ `campaign_playlists` - Playlists por campanha
- ✅ `playlists` - Playlists com `schedule_config` (JSONB)
- ✅ `playlist_items` - Itens de playlist
- ✅ `totem_playlist_mix` - Mix gerado para totem
- ✅ `dispatcher_log` - Log de auditoria de decisões
- ✅ `playlist_mix_rules` - Regras de mixagem

**Campos Comerciais (Novos no ER v2.0):**
- ✅ `campaigns.commercial_tier` - `premium`, `standard`, `remnant`
- ✅ `campaigns.default_time_share_percent` - % alvo de share de tempo
- ✅ `campaigns.max_consecutive_slots` - Máximo de slots consecutivos

---

## 📋 2. PROPOSTA DO CHATGPT

### 2.1. Princípios Fundamentais

**O que o Dispatcher DEVE fazer:**
1. ✅ Resolver conflitos de agendamentos
2. ✅ Gerar planos de exibição (playlist + ordem + metadados)
3. ✅ Validar frequências e recorrências
4. ✅ Validar compatibilidade técnica
5. ✅ Validar integridade

**O que o Dispatcher NÃO deve fazer:**
- ❌ Renderização de conteúdo
- ❌ Execução de playlists
- ❌ Download direto de mídias
- ❌ Player de mídia

### 2.2. Fluxo de Decisão Proposto

```
1. Descobrir Candidatos
   - Agendamentos ativos
   - Apontam para totem X OU grupo que contém X
   - Possuem playlist válida

2. Resolver Conflitos (Ordem de Prioridade)
   a) Prioridade (maior valor vence)
   b) Escopo (direct > group)
   c) Especificidade (Totem > Grupo pequeno > Grupo grande)
   d) Data de criação (mais recente)

3. Validar Frequência Temporal
   - Interpretar campo frequencia
   - Verificar timestamp dentro da janela válida

4. Validar Compatibilidade Técnica
   - Resolução compatível
   - Orientação da tela
   - Plataforma (WebOS, Android, Browser)

5. Validar Integridade
   - Mídias existentes
   - URLs válidas
   - Duração coerente

6. Gerar Plano
   - Se todas validações passarem → gerar DispatchPlan
   - Se falhar → cair para próximo candidato
```

### 2.3. Questões para Decisão (do ChatGPT)

1. **Cache**: O Dispatcher deve cachear planos? Por quanto tempo?
   - ✅ **RESPOSTA ATUAL:** Sim, 60 segundos (configurável)

2. **Webhooks**: Notificar quando um plano muda?
   - ⚠️ **RESPOSTA ATUAL:** Não implementado

3. **Auditoria**: Registrar todas as decisões para análise?
   - ✅ **RESPOSTA ATUAL:** Sim, em `dispatcher_log`

4. **Performance**: Como otimizar para muitos totens simultâneos?
   - ⚠️ **RESPOSTA ATUAL:** Cache básico, sem otimizações avançadas

5. **Frequência**: Como armazenar/interpretar regras de frequência complexas?
   - ✅ **RESPOSTA ATUAL:** `days_of_week` (JSON array), `start_time`, `end_time`

---

## 📋 3. ANÁLISE COMPARATIVA

### 3.1. O que o ChatGPT propôs e JÁ TEMOS

| Funcionalidade | ChatGPT | Implementado | Status |
|---------------|---------|--------------|--------|
| Descoberta de candidatos | ✅ | ✅ | ✅ Completo |
| Resolução de conflitos | ✅ | ✅ | ✅ Completo |
| Validação temporal | ✅ | ✅ | ✅ Completo |
| Validação técnica | ✅ | ⚠️ Parcial | ⚠️ TODO |
| Validação de integridade | ✅ | ✅ | ✅ Completo |
| Geração de planos | ✅ | ✅ | ✅ Completo |
| Cache | ✅ | ✅ | ✅ Completo |
| Auditoria | ✅ | ✅ | ✅ Completo |

### 3.2. O que o ChatGPT propôs e NÃO TEMOS

| Funcionalidade | ChatGPT | Implementado | Ação Necessária |
|---------------|---------|--------------|-----------------|
| Validação técnica completa | ✅ | ⚠️ Parcial | Implementar resolução/orientação |
| Webhooks | ✅ | ❌ | Adicionar notificações |
| Otimizações de performance | ✅ | ⚠️ Básico | Melhorar cache e queries |

### 3.3. O que TEMOS e o ChatGPT NÃO propôs

| Funcionalidade | ChatGPT | Implementado | Valor |
|---------------|---------|--------------|-------|
| Mix de múltiplas playlists | ❌ | ✅ | 🎯 **ALTO** - Permite combinar campanhas |
| Regras de mixagem (IA) | ❌ | ✅ | 🎯 **ALTO** - Mix inteligente |
| Camadas comerciais | ❌ | ✅ | 🎯 **ALTO** - premium/standard/remnant |
| Time share percent | ❌ | ✅ | 🎯 **ALTO** - Controle de % de tempo |
| Max consecutive slots | ❌ | ✅ | 🎯 **MÉDIO** - Evita repetição |

---

## 📋 4. PROPOSTA DE UNIÃO E INCREMENTAÇÃO

### 4.1. Arquitetura Unificada

```
┌─────────────────────────────────────────────────────────────┐
│                    DISPATCHER-TOTEM                         │
│                  (Motor de Decisão)                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├───► 1. Descoberta de Candidatos
                            │     (campanhas ativas)
                            │
                            ├───► 2. Validação Temporal
                            │     (datas, horários, dias)
                            │
                            ├───► 3. Validação Técnica
                            │     (resolução, orientação, plataforma)
                            │
                            ├───► 4. Resolução de Conflitos
                            │     (prioridade, escopo, especificidade)
                            │
                            ├───► 5. Decisão: Mix ou Single?
                            │     ┌─────────────────────┐
                            │     │ Se múltiplas válidas │
                            │     │ → Usar Mix Service  │
                            │     │ Se única válida     │
                            │     │ → Usar Single Plan  │
                            │     └─────────────────────┘
                            │
                            ├───► 6. Geração de Plano
                            │     (DispatchPlan ou TotemPlaylistMix)
                            │
                            └───► 7. Auditoria
                                  (dispatcher_log)
```

### 4.2. Fluxo Unificado Proposto

#### **Fase 1: Descoberta e Validação** (Já implementado)
```typescript
1. getCandidateSchedules(totemId, timestamp)
   → Busca campanhas ativas (direct + via publisher)
   → Filtra por validação temporal básica
   → Retorna CandidateSchedule[]
```

#### **Fase 2: Validação Avançada** (Melhorar)
```typescript
2. validateCandidates(candidates, totemId)
   → Para cada candidato:
     a) validateTemporalFrequency() ✅ (já tem)
     b) validateTechnicalCompatibility() ⚠️ (completar)
     c) validatePlaylistIntegrity() ✅ (já tem)
     d) validateCommercialRules() 🆕 (novo)
   → Retorna CandidateSchedule[] (apenas válidos)
```

#### **Fase 3: Decisão de Estratégia** (Novo)
```typescript
3. decideStrategy(validCandidates)
   → Se apenas 1 candidato válido:
     → Estratégia: SINGLE (retornar plano único)
   → Se múltiplos candidatos válidos:
     → Verificar se há conflito de prioridade
     → Se prioridades diferentes:
       → Estratégia: PRIORITY (vencedor único)
     → Se prioridades iguais OU time_share_percent > 0:
       → Estratégia: MIX (usar TotemPlaylistMixService)
```

#### **Fase 4: Geração de Plano** (Unificar)
```typescript
4. generatePlan(strategy, candidates, totemId)
   → Se SINGLE ou PRIORITY:
     → generateDispatchPlan(candidate) ✅ (já tem)
   → Se MIX:
     → TotemPlaylistMixService.generateMixForTotem(totemId)
     → Converter TotemPlaylistMix → DispatchPlan
```

### 4.3. Melhorias Incrementais Propostas

#### **A. Validação Técnica Completa** 🆕

```typescript
private async validateTechnicalCompatibility(
  candidate: CandidateSchedule,
  totemId: number
): Promise<{ valid: boolean; errors: string[] }> {
  // 1. Buscar dados do totem e Smart TVs
  const totem = await this.getTotemWithSmartTvs(totemId);
  
  // 2. Buscar requisitos da playlist
  const playlist = await this.getPlaylistRequirements(candidate.playlistId);
  
  // 3. Validar resolução
  if (playlist.requiredResolution) {
    const compatible = totem.smartTvs.some(tv => 
      tv.resolution_width >= playlist.requiredResolution.width &&
      tv.resolution_height >= playlist.requiredResolution.height
    );
    if (!compatible) {
      errors.push('Resolução incompatível');
    }
  }
  
  // 4. Validar orientação
  if (playlist.requiredOrientation) {
    const compatible = totem.smartTvs.some(tv => 
      tv.orientation === playlist.requiredOrientation
    );
    if (!compatible) {
      errors.push('Orientação incompatível');
    }
  }
  
  // 5. Validar plataforma
  if (playlist.requiredPlatform) {
    const compatible = totem.smartTvs.some(tv => 
      tv.platform === playlist.requiredPlatform
    );
    if (!compatible) {
      errors.push('Plataforma incompatível');
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

#### **B. Validação de Regras Comerciais** 🆕

```typescript
private async validateCommercialRules(
  candidate: CandidateSchedule,
  totemId: number,
  timestamp: Date
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  // 1. Verificar se subscriber tem acesso ao publisher do totem
  const access = await this.checkSubscriberPublisherAccess(
    candidate.subscriberId,
    totemId
  );
  if (!access.valid) {
    errors.push('Subscriber não tem acesso a este publisher');
  }
  
  // 2. Verificar se contrato está ativo
  if (candidate.contractId) {
    const contract = await this.getContract(candidate.contractId);
    if (!contract.isActive || contract.endDate < timestamp) {
      errors.push('Contrato não está ativo');
    }
  }
  
  // 3. Verificar limites de time_share_percent
  // (será validado no mix, não aqui)
  
  return { valid: errors.length === 0, errors };
}
```

#### **C. Integração com Mix Service** 🆕

```typescript
private async generateMixedPlan(
  candidates: CandidateSchedule[],
  totemId: number,
  timestamp: Date
): Promise<DispatchPlan> {
  // 1. Obter regra de mixagem
  const mixRule = await this.mixService.getMixRuleForTotem(totemId);
  
  // 2. Preparar dados para mix
  const campaignsForMix = candidates.map(c => ({
    campaignId: c.campaignId,
    playlistId: c.playlistId,
    priority: c.priority,
    commercialTier: c.commercialTier,
    timeSharePercent: c.timeSharePercent,
    maxConsecutiveSlots: c.maxConsecutiveSlots,
  }));
  
  // 3. Gerar mix
  const mix = await this.mixService.generateMixForTotem(totemId);
  
  // 4. Converter TotemPlaylistMix → DispatchPlan
  return this.convertMixToDispatchPlan(mix, totemId, timestamp);
}
```

#### **D. Decisão Inteligente de Estratégia** 🆕

```typescript
private decideStrategy(
  candidates: CandidateSchedule[]
): 'single' | 'priority' | 'mix' {
  if (candidates.length === 0) {
    return 'single'; // Nenhum candidato = plano vazio
  }
  
  if (candidates.length === 1) {
    return 'single'; // Apenas um candidato = plano único
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
  
  // Verificar se algum tem time_share_percent > 0
  const hasTimeShare = candidates.some(
    c => (c.timeSharePercent || 0) > 0
  );
  
  if (hasTimeShare) {
    return 'mix'; // Time share requer mix
  }
  
  // Verificar se todos têm mesma prioridade
  if (priorities.every(p => p === maxPriority)) {
    return 'mix'; // Mesma prioridade = mixar
  }
  
  // Por padrão, usar prioridade (vencedor único)
  return 'priority';
}
```

#### **E. Webhooks para Notificações** 🆕

```typescript
private async notifyPlanChange(
  totemId: number,
  oldPlan: DispatchPlan | null,
  newPlan: DispatchPlan
): Promise<void> {
  const webhookService = getWebhookService();
  
  await webhookService.triggerWebhook('dispatcher.plan_changed', {
    totemId,
    oldPlan: oldPlan ? {
      playlistId: oldPlan.playlistId,
      priority: oldPlan.priority,
      source: oldPlan.source,
    } : null,
    newPlan: {
      playlistId: newPlan.playlistId,
      priority: newPlan.priority,
      source: newPlan.source,
    },
    timestamp: new Date(),
  });
}
```

---

## 📋 5. PLANO DE IMPLEMENTAÇÃO

### **Fase 1: Completar Validações** (Prioridade ALTA)
- [ ] Implementar validação técnica completa (resolução, orientação, plataforma)
- [ ] Implementar validação de regras comerciais (acesso, contrato)
- [ ] Adicionar testes unitários para validações

### **Fase 2: Integração com Mix Service** (Prioridade ALTA)
- [ ] Implementar `decideStrategy()` para escolher entre single/priority/mix
- [ ] Integrar `TotemPlaylistMixService` no fluxo do dispatcher
- [ ] Converter `TotemPlaylistMix` → `DispatchPlan` quando necessário
- [ ] Adicionar testes de integração

### **Fase 3: Melhorias de Performance** (Prioridade MÉDIA)
- [ ] Otimizar queries de descoberta de candidatos (índices, cache)
- [ ] Implementar cache de validações técnicas
- [ ] Adicionar métricas de performance (tempo de execução)

### **Fase 4: Webhooks e Notificações** (Prioridade BAIXA)
- [ ] Implementar notificações de mudança de plano
- [ ] Adicionar webhooks para eventos do dispatcher
- [ ] Documentar eventos disponíveis

### **Fase 5: Monitoramento e Analytics** (Prioridade MÉDIA)
- [ ] Dashboard de monitoramento do dispatcher
- [ ] Analytics de decisões (quais estratégias são mais usadas)
- [ ] Alertas para falhas recorrentes

---

## 📋 6. QUESTÕES PARA DECISÃO

### **Q1: Quando usar MIX vs SINGLE?**
**Proposta:**
- **SINGLE**: Quando há apenas 1 candidato válido OU quando há vencedor claro por prioridade
- **MIX**: Quando múltiplos candidatos têm mesma prioridade OU quando `time_share_percent > 0`

### **Q2: Como tratar `max_consecutive_slots`?**
**Proposta:**
- Validar no momento de gerar o plano
- Se mix, aplicar limite por campanha no `TotemPlaylistMixService`
- Se single, não aplicar (playlist única)

### **Q3: Como tratar `commercial_tier`?**
**Proposta:**
- Usar como peso adicional na resolução de conflitos
- `premium` > `standard` > `remnant`
- Integrar com `TotemPlaylistMixService` para ordenação

### **Q4: Cache de planos - TTL dinâmico?**
**Proposta:**
- TTL baseado na menor janela de validade dos candidatos
- Se campanha válida por 1 hora → cache por 1 minuto
- Se campanha válida por 1 dia → cache por 5 minutos

---

## 📋 7. CONCLUSÃO

### **O que já temos:**
✅ Dispatcher básico funcional
✅ Mix service completo
✅ Auditoria completa
✅ Cache básico

### **O que falta:**
⚠️ Validação técnica completa
⚠️ Integração dispatcher ↔ mix service
⚠️ Decisão inteligente de estratégia
⚠️ Webhooks e notificações

### **Próximos passos:**
1. Completar validações técnicas
2. Integrar dispatcher com mix service
3. Implementar decisão de estratégia
4. Adicionar testes e documentação

---

**Data:** 2026-01-13  
**Versão:** 1.0  
**Autor:** Análise baseada em proposta ChatGPT + código existente
