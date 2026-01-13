# Proposta: Módulo Dispatcher-Totem

## 📋 Contexto

Baseado na conversa do ChatGPT sobre o Dispatcher-Totem, este módulo é um **motor de decisão** que resolve conflitos de agendamentos e gera planos de exibição para totens, sem executar ou renderizar conteúdo.

## 🎯 Responsabilidades do Dispatcher-Totem

### ✅ O que o Dispatcher FAZ:
1. **Resolve conflitos de agendamentos** quando múltiplos agendamentos são válidos para o mesmo totem no mesmo horário
2. **Gera planos de exibição** (playlist + ordem + metadados) baseado em regras determinísticas
3. **Valida frequências e recorrências** (diário, semanal, dias da semana, janelas específicas)
4. **Valida compatibilidade técnica** (resolução, orientação, plataforma)
5. **Valida integridade** (mídias existentes, URLs válidas, duração coerente)

### ❌ O que o Dispatcher NÃO FAZ:
- Renderização de conteúdo
- Execução de playlists
- Download direto de mídias
- Player de mídia

## 🏗️ Arquitetura Proposta

### Localização no Projeto

```
backend/src/
├── services/
│   └── dispatcherTotemService.ts      # ⭐ NOVO: Serviço principal
├── routes/
│   └── dispatcher-totem.ts            # ⭐ NOVO: Rotas da API
├── validators/
│   └── dispatcherTotem.validators.ts  # ⭐ NOVO: Validações
└── types/
    └── dispatcherTotem.types.ts        # ⭐ NOVO: Interfaces e tipos
```

### Estrutura do Serviço

```typescript
// backend/src/services/dispatcherTotemService.ts

export interface DispatchRequest {
  totemId: number;
  timestamp: Date; // ou string ISO
  timezone?: string; // timezone do totem
}

export interface DispatchPlan {
  totemId: number;
  timestamp: Date;
  playlistId: number;
  playlistName: string;
  mediaItems: DispatchMediaItem[];
  totalDuration: number;
  priority: number;
  source: 'direct' | 'group' | 'campaign';
  sourceId: number; // ID do agendamento/campanha
  validityStart: Date;
  validityEnd: Date;
  metadata: {
    resolution?: string;
    orientation?: 'landscape' | 'portrait';
    platform?: string;
  };
}

export interface DispatchMediaItem {
  mediaId: number;
  order: number;
  duration: number;
  url: string;
  mediaType: string;
  metadata?: any;
}

export class DispatcherTotemService {
  // 1. Descobrir candidatos
  private async getCandidateSchedules(totemId: number, timestamp: Date): Promise<Schedule[]>
  
  // 2. Resolver conflitos (ordenação)
  private async resolveConflicts(candidates: Schedule[]): Promise<Schedule | null>
  
  // 3. Validar frequência temporal
  private async validateTemporalFrequency(schedule: Schedule, timestamp: Date): Promise<boolean>
  
  // 4. Validar compatibilidade técnica
  private async validateTechnicalCompatibility(schedule: Schedule, totem: Totem): Promise<boolean>
  
  // 5. Validar integridade da playlist
  private async validatePlaylistIntegrity(playlistId: number): Promise<boolean>
  
  // 6. Gerar plano de exibição
  public async dispatch(totemId: number, timestamp?: Date): Promise<DispatchPlan | null>
  
  // 7. Obter histórico de decisões (para debug/auditoria)
  public async getDispatchHistory(totemId: number, startDate: Date, endDate: Date): Promise<DispatchPlan[]>
}
```

## 🔄 Fluxo de Decisão

### Etapa 1: Descobrir Candidatos
```typescript
// Buscar agendamentos que:
// - Estão ativos (data/hora/frequência válida)
// - Apontam para: id_totem = X OU id_grupo_totem que contém o totem X
// - Possuem playlist válida
```

### Etapa 2: Resolver Conflitos (Ordem de Prioridade)
1. **Prioridade** (campo `priority`) - Maior valor vence
2. **Escopo** - Agendamento direto no TOTEM vence sobre GRUPO
3. **Especificidade** - Menor alcance = maior peso (Totem > Grupo pequeno > Grupo grande)
4. **Data de criação** - Último critério para desempate

### Etapa 3: Validar Frequência Temporal
- Interpretar campo `frequencia` (diário, semanal, dias da semana, janelas específicas)
- Verificar se o timestamp está dentro da janela válida

### Etapa 4: Validar Compatibilidade Técnica
- Resolução compatível
- Orientação da tela
- Plataforma (WebOS, Android, Browser)

### Etapa 5: Validar Integridade
- Mídias existentes
- URLs válidas
- Duração coerente

### Etapa 6: Gerar Plano
- Se todas as validações passarem, gerar `DispatchPlan`
- Se falhar, cair para o próximo agendamento elegível

## 🔗 Integrações com Serviços Existentes

### Dependências
- `totemService.ts` - Obter dados do totem (plataforma, resolução, orientação)
- `campaignService.ts` - Obter campanhas/agendamentos
- `playlistService.ts` - Obter playlists e mídias
- `mediaService.ts` - Validar mídias
- `subscriberAccessService.ts` - Verificar acesso de subscribers a publishers

### Relação com Serviços Existentes
- **TotemPlaylistMixService**: O Dispatcher pode usar o MixService para combinar múltiplas playlists quando necessário
- **PlaylistEngineService**: O Engine executa o plano gerado pelo Dispatcher
- **CampaignService**: Fornece os agendamentos que o Dispatcher processa

## 📊 Modelo de Dados (Baseado no ER)

O Dispatcher trabalha com:
- `TOTEM` - Representa TV, painel, player, Smart TV
- `GRUPO_TOTEM` - Agrupamento lógico
- `PLAYLIST` - Conjunto ordenado de mídia
- `MÍDIA` - Conteúdo real
- `AGENDAMENTO` - Núcleo do problema (campanha com quando, o que, onde, prioridade)

## 🚀 API Proposta

### Endpoints

```typescript
// GET /api/dispatcher-totem/:totemId/dispatch
// Obter plano de exibição para um totem em um momento específico
// Query params: ?timestamp=2024-01-12T10:00:00Z

// GET /api/dispatcher-totem/:totemId/history
// Obter histórico de decisões
// Query params: ?startDate=...&endDate=...

// GET /api/dispatcher-totem/:totemId/candidates
// Debug: ver quais agendamentos são candidatos em um momento
// Query params: ?timestamp=...

// POST /api/dispatcher-totem/validate
// Validar um plano antes de aplicar
```

## ✅ Princípios Confirmados

- ✔️ Prioridade maior sempre vence
- ✔️ Totem direto vence grupo
- ✔️ Em falha técnica, cai para o próximo agendamento
- ✔️ Dispatcher gera plano, não executa
- ✔️ Frequência será interpretada como regra temporal
- ✔️ Determinístico (mesmo input = mesmo output)

## 📝 Próximos Passos

1. **Definir API do módulo** - Interfaces e contratos
2. **Definir algoritmo formal** - Pseudocódigo da resolução de conflitos
3. **Implementar serviço** - Código TypeScript
4. **Criar rotas** - Endpoints REST
5. **Testes** - Unitários e de integração
6. **Documentação** - Swagger/OpenAPI

## 🔍 Questões para Decisão

1. **Cache**: O Dispatcher deve cachear planos? Por quanto tempo?
2. **Webhooks**: Notificar quando um plano muda?
3. **Auditoria**: Registrar todas as decisões para análise?
4. **Performance**: Como otimizar para muitos totens simultâneos?
5. **Frequência**: Como armazenar/interpretar regras de frequência complexas?
