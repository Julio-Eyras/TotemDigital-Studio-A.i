# Análise Completa do Sistema - Smart Signage Pro v2.1
## TODO de Correções, Bugs e Otimizações

**Data:** 2026-01-03  
**Versão do Sistema:** 2.1.0  
**Status:** Análise Completa

---

## 📋 ÍNDICE

1. [Análise do Modelo ER](#1-análise-do-modelo-er)
2. [Análise da Lógica de Negócio](#2-análise-da-lógica-de-negócio)
3. [Bugs e Problemas Identificados](#3-bugs-e-problemas-identificados)
4. [Inconsistências de Código](#4-inconsistências-de-código)
5. [Otimizações Necessárias](#5-otimizações-necessárias)
6. [Melhorias de Arquitetura](#6-melhorias-de-arquitetura)
7. [TODO Estruturado](#7-todo-estruturado)

---

## 1. ANÁLISE DO MODELO ER

### ✅ Pontos Fortes

1. **Estrutura bem definida:**
   - Separação clara entre Subscribers (anunciantes) e Publishers (publicadores)
   - Hierarquia clara: Publisher → Local → Totem → Smart TV
   - Contratos separados para cada tipo de entidade

2. **Relacionamentos corretos:**
   - `subscriber_contracts` tem `plan_id` opcional (correto)
   - `publisher_contracts` NÃO tem `plan_id` (correto)
   - `smart_tvs.totem_id` suporta 1:N (correto após correção)

3. **Sistema de acesso bem estruturado:**
   - `plan_publisher_access` define disponibilidade
   - `subscriber_publisher_access` define acesso real
   - Suporte a múltiplos tipos de acesso (plan, contract, override)

### ⚠️ Problemas Identificados

#### 1.1. Inconsistência: Totem → Smart TV (1:1 vs 1:N)

**Status:** ✅ **CORRIGIDO** (comentário atualizado)

**Problema Original:**
- Schema suportava 1:N, mas comentário dizia 1:1
- Backend pode ter lógica assumindo 1:1

**Ação:** ✅ Comentário atualizado para refletir 1:N

**Verificar:**
- [ ] Backend routes de `smart-tvs` suportam múltiplas TVs por totem
- [ ] Frontend permite criar múltiplas TVs para um totem
- [ ] Queries não assumem 1:1

---

## 2. ANÁLISE DA LÓGICA DE NEGÓCIO

### ✅ Pontos Fortes

1. **Isolamento de dados:**
   - Middleware `subscriberIsolationMiddleware` funciona corretamente
   - Publisher users só veem seus próprios dados
   - Admin tem acesso total

2. **Sistema de permissões:**
   - Flags customizados (Flag_smart_0 a Flag_smart_9) implementados
   - Roles hierárquicos (owner_system > admin_sql > admin > operadores)
   - Função SQL `get_user_effective_flags()` otimizada

3. **Subdomínios:**
   - Configuração Nginx automatizada
   - Headers X-Subdomain-Type configurados
   - Frontend detecta subdomínio corretamente

### ⚠️ Problemas Identificados

#### 2.1. Migração client_id → subscriber_id Incompleta

**Severidade:** 🔴 **ALTA**

**Problema:**
- Código ainda usa `client_id` em muitos lugares
- Tabela `clients` ainda existe (deprecada)
- Rotas `/api/clients` ainda ativas (marcadas como TODO para deprecar)
- Rotas `/api/billing` ainda usam `client_id` (marcadas como TODO)

**Evidências:**
```typescript
// backend/src/index.ts
import clientRoutes from './routes/clients'; // TODO: Deprecar - usar subscribers
import billingRoutes from './routes/billing'; // TODO: Deprecar

// backend/src/services/billingService.ts
// Ainda usa client_id em queries
FROM billing b
LEFT JOIN clients cl ON b.client_id = cl.client_id
```

**Impacto:**
- Confusão entre conceitos
- Possível inconsistência de dados
- Manutenção duplicada

**Ação Necessária:**
1. Migrar todas as referências de `client_id` para `subscriber_id`
2. Deprecar rotas `/api/clients` e `/api/billing`
3. Criar rotas de redirecionamento temporárias
4. Atualizar documentação
5. Remover tabela `clients` após migração completa

**Prioridade:** 🔴 **ALTA**

---

#### 2.2. Tabela `billing` vs `subscriber_billing` e `publisher_billing`

**Severidade:** 🟡 **MÉDIA**

**Problema:**
- Existem 3 tabelas de billing:
  - `billing` (legado, usa `client_id`)
  - `subscriber_billing` (novo, usa `subscriber_id`)
  - `publisher_billing` (novo, usa `publisher_id`)

**Status:**
- Rotas novas criadas (`/api/subscriber-billing`, `/api/publisher-billing`)
- Rotas antigas ainda ativas (`/api/billing`)

**Ação Necessária:**
1. Migrar dados de `billing` para `subscriber_billing` ou `publisher_billing`
2. Deprecar rota `/api/billing`
3. Remover tabela `billing` após migração

**Prioridade:** 🟡 **MÉDIA**

---

#### 2.3. Validação de Relacionamentos Totem → Smart TV

**Severidade:** 🟡 **MÉDIA**

**Problema:**
- Backend pode não validar corretamente se múltiplas Smart TVs podem pertencer ao mesmo totem
- Queries podem assumir 1:1

**Ação Necessária:**
1. Verificar queries em `smartTvService.ts`
2. Verificar rotas em `smart-tvs.ts`
3. Garantir que validações permitam 1:N
4. Atualizar documentação de API

**Prioridade:** 🟡 **MÉDIA**

---

## 3. BUGS E PROBLEMAS IDENTIFICADOS

### 🔴 Bugs Críticos

#### 3.1. Inconsistência client_id/subscriber_id em Queries

**Arquivo:** `backend/src/services/billingService.ts`

**Problema:**
```typescript
// Linha 286-290
LEFT JOIN clients cl ON b.client_id = cl.client_id
```

**Deve ser:**
```typescript
LEFT JOIN subscribers s ON b.subscriber_id = s.subscriber_id
```

**Impacto:** Queries podem falhar ou retornar dados incorretos

**Prioridade:** 🔴 **ALTA**

---

#### 3.2. Tabela `clients` Ainda Referenciada

**Arquivos Afetados:**
- `backend/src/services/billingService.ts`
- `backend/src/services/clientService.ts`
- `backend/src/routes/clients.ts`

**Problema:** Código ainda referencia tabela `clients` que deveria estar deprecada

**Ação:** Migrar todas as referências para `subscribers`

**Prioridade:** 🔴 **ALTA**

---

#### 3.3. Cache Usando client_id em vez de subscriber_id

**Arquivo:** `backend/src/services/analyticsCacheService.ts`

**Problema:**
```typescript
getOverviewKey(clientId?: number, ...)
getTotemsStatsKey(clientId?: number, ...)
getMediaStatsKey(clientId?: number, ...)
getCampaignsStatsKey(clientId?: number, ...)
invalidateClientCache(clientId: number)
```

**Deve usar:** `subscriberId` em vez de `clientId`

**Prioridade:** 🟡 **MÉDIA**

---

### 🟡 Bugs Médios

#### 3.4. Validação de Permissões Inconsistente

**Arquivo:** `backend/src/routes/campaigns.ts`

**Problema:**
```typescript
// Linha 210
if (req.user.role === 'client' && req.user.clientId !== campaign.clientId) {
```

**Deve verificar:** `subscriberId` em vez de `clientId`

**Prioridade:** 🟡 **MÉDIA**

---

#### 3.5. Relatórios Usando client_id

**Arquivo:** `backend/src/services/reportsService.ts`

**Problema:**
```typescript
// Linha 605-610
const subscriberId = filters.subscriberId || filters.clientId;
// ...
s.subscriber_id as client_id, -- Mantido para compatibilidade
```

**Ação:** Remover suporte a `clientId` após migração completa

**Prioridade:** 🟢 **BAIXA** (já tem fallback)

---

## 4. INCONSISTÊNCIAS DE CÓDIGO

### 4.1. Nomenclatura Inconsistente

**Problema:** Mistura de `clientId` e `subscriberId` no código

**Arquivos Afetados:**
- `backend/src/middleware/auth.middleware.ts` - Tem ambos (com fallback)
- `backend/src/services/campaignService.ts` - Usa `clientId` em interfaces
- `backend/src/routes/campaigns.ts` - Usa ambos

**Ação:** Padronizar para `subscriberId` em todo o código

**Prioridade:** 🟡 **MÉDIA**

---

### 4.2. Interfaces TypeScript Desatualizadas

**Problema:** Interfaces ainda usam `clientId` em vez de `subscriberId`

**Exemplo:**
```typescript
// backend/src/services/campaignService.ts
byClient: { clientId: number; clientName: string; count: number }[];
```

**Ação:** Atualizar todas as interfaces

**Prioridade:** 🟡 **MÉDIA**

---

### 4.3. Comentários e Documentação Desatualizados

**Problema:** Comentários ainda mencionam `client` em vez de `subscriber`

**Exemplo:**
```typescript
// backend/src/routes/campaigns.ts
// Linha 45
clientId, // mantém nome por compatibilidade; internamente usa subscriber_id
```

**Ação:** Atualizar comentários e documentação

**Prioridade:** 🟢 **BAIXA**

---

## 5. OTIMIZAÇÕES NECESSÁRIAS

### 5.1. Queries SQL Não Otimizadas

**Problema:** Algumas queries podem ser otimizadas com índices ou JOINs mais eficientes

**Exemplos:**
- Queries de billing com múltiplos JOINs
- Queries de campanhas com filtros complexos
- Queries de analytics sem índices adequados

**Ação:** 
1. Analisar queries lentas
2. Adicionar índices onde necessário
3. Otimizar JOINs

**Prioridade:** 🟡 **MÉDIA**

---

### 5.2. Cache Não Utilizado em Alguns Serviços

**Problema:** Alguns serviços não usam cache mesmo quando poderiam

**Exemplos:**
- `campaignService` - Listagens poderiam ser cacheadas
- `publisherService` - Dados estáticos poderiam ser cacheados
- `planService` - Planos raramente mudam

**Ação:** Implementar cache onde faz sentido

**Prioridade:** 🟢 **BAIXA**

---

### 5.3. Função SQL `get_user_effective_flags()` Pode Ser Melhorada

**Status:** ✅ Já implementada e otimizada

**Verificar:** Se está sendo usada em todos os lugares necessários

**Prioridade:** 🟢 **BAIXA**

---

## 6. MELHORIAS DE ARQUITETURA

### 6.1. Separação de Responsabilidades

**Problema:** Alguns serviços fazem muitas coisas

**Exemplo:** `billingService` lida com subscriber e publisher billing

**Ação:** Já separado em `subscriberBillingService` e `publisherBillingService`

**Status:** ✅ Implementado

---

### 6.2. Validação Centralizada

**Problema:** Validações espalhadas pelo código

**Ação:** Usar middleware de validação (já existe `validation.middleware.ts`)

**Status:** ⚠️ Parcialmente implementado

**Prioridade:** 🟡 **MÉDIA**

---

### 6.3. Tratamento de Erros

**Status:** ✅ Bem implementado com `error.middleware.ts`

**Verificar:** Se todos os serviços usam o error handler corretamente

**Prioridade:** 🟢 **BAIXA**

---

## 7. TODO ESTRUTURADO

### 🔴 ALTA PRIORIDADE (Crítico)

#### 7.1. Migração Completa client_id → subscriber_id

**Tarefas:**
- [ ] **7.1.1** Atualizar todas as queries SQL que usam `client_id`
  - [ ] `billingService.ts` - Migrar queries
  - [ ] `campaignService.ts` - Atualizar interfaces e queries
  - [ ] `reportsService.ts` - Remover fallback `clientId`
  - [ ] `analyticsCacheService.ts` - Renomear métodos para `subscriberId`
  
- [ ] **7.1.2** Atualizar todas as interfaces TypeScript
  - [ ] Remover `clientId` de interfaces
  - [ ] Adicionar `subscriberId` onde necessário
  - [ ] Atualizar tipos de resposta de API
  
- [ ] **7.1.3** Deprecar rotas antigas
  - [ ] Marcar `/api/clients` como deprecated
  - [ ] Marcar `/api/billing` como deprecated
  - [ ] Criar rotas de redirecionamento temporárias
  - [ ] Adicionar warnings em logs
  
- [ ] **7.1.4** Atualizar frontend
  - [ ] Substituir todas as referências a `clientId`
  - [ ] Atualizar chamadas de API
  - [ ] Atualizar componentes React
  
- [ ] **7.1.5** Migração de dados
  - [ ] Script para migrar dados de `clients` para `subscribers`
  - [ ] Script para migrar dados de `billing` para `subscriber_billing`
  - [ ] Validação de integridade após migração
  
- [ ] **7.1.6** Remover código legado
  - [ ] Remover rota `/api/clients`
  - [ ] Remover rota `/api/billing`
  - [ ] Remover tabela `clients` (após migração)
  - [ ] Remover tabela `billing` (após migração)
  - [ ] Remover `clientService.ts`
  - [ ] Remover `billingService.ts` (legado)

**Estimativa:** 3-5 dias  
**Responsável:** Backend + Frontend  
**Dependências:** Nenhuma

---

#### 7.2. Validação de Relacionamento Totem → Smart TV (1:N)

**Tarefas:**
- [ ] **7.2.1** Verificar backend
  - [ ] `smartTvService.ts` - Verificar queries e validações
  - [ ] `smart-tvs.ts` - Verificar rotas permitem múltiplas TVs
  - [ ] Remover validações que assumem 1:1
  
- [ ] **7.2.2** Verificar frontend
  - [ ] Componente de criação de Smart TV permite múltiplas
  - [ ] Listagem mostra todas as TVs de um totem
  - [ ] Validações não bloqueiam 1:N
  
- [ ] **7.2.3** Testes
  - [ ] Testar criação de múltiplas TVs para um totem
  - [ ] Testar listagem de TVs por totem
  - [ ] Testar exclusão de TV (não deve afetar outras)

**Estimativa:** 1-2 dias  
**Responsável:** Backend + Frontend  
**Dependências:** Nenhuma

---

### 🟡 MÉDIA PRIORIDADE (Importante)

#### 7.3. Padronização de Nomenclatura

**Tarefas:**
- [ ] **7.3.1** Atualizar todos os comentários
  - [ ] Substituir "client" por "subscriber" em comentários
  - [ ] Atualizar documentação inline
  
- [ ] **7.3.2** Atualizar logs
  - [ ] Substituir mensagens de log que usam "client"
  - [ ] Padronizar formato de logs
  
- [ ] **7.3.3** Atualizar documentação
  - [ ] README.md
  - [ ] Documentação de API
  - [ ] Guias de uso

**Estimativa:** 1 dia  
**Responsável:** Todos  
**Dependências:** 7.1 (após migração)

---

#### 7.4. Otimização de Queries SQL

**Tarefas:**
- [ ] **7.4.1** Análise de performance
  - [ ] Identificar queries lentas (usar EXPLAIN ANALYZE)
  - [ ] Listar queries que fazem full table scan
  - [ ] Identificar JOINs ineficientes
  
- [ ] **7.4.2** Adicionar índices
  - [ ] Índices em foreign keys frequentemente usadas
  - [ ] Índices compostos para queries complexas
  - [ ] Índices parciais onde aplicável
  
- [ ] **7.4.3** Otimizar queries
  - [ ] Reescrever queries ineficientes
  - [ ] Usar CTEs onde apropriado
  - [ ] Evitar N+1 queries

**Estimativa:** 2-3 dias  
**Responsável:** Backend  
**Dependências:** Nenhuma

---

#### 7.5. Implementar Cache em Serviços

**Tarefas:**
- [ ] **7.5.1** Cache de campanhas
  - [ ] Listagens de campanhas
  - [ ] Estatísticas de campanhas
  
- [ ] **7.5.2** Cache de publishers
  - [ ] Listagem de publishers
  - [ ] Dados estáticos de publishers
  
- [ ] **7.5.3** Cache de planos
  - [ ] Listagem de planos
  - [ ] Features e limits de planos

**Estimativa:** 2 dias  
**Responsável:** Backend  
**Dependências:** Redis configurado

---

### 🟢 BAIXA PRIORIDADE (Melhorias)

#### 7.6. Melhorias de Validação

**Tarefas:**
- [ ] **7.6.1** Centralizar validações
  - [ ] Usar `validation.middleware.ts` em todas as rotas
  - [ ] Criar schemas de validação reutilizáveis
  
- [ ] **7.6.2** Validações de negócio
  - [ ] Validar relacionamentos antes de criar/atualizar
  - [ ] Validar datas e períodos
  - [ ] Validar valores monetários

**Estimativa:** 2 dias  
**Responsável:** Backend  
**Dependências:** Nenhuma

---

#### 7.7. Melhorias de Documentação

**Tarefas:**
- [ ] **7.7.1** Documentação de API
  - [ ] Atualizar Swagger com novos endpoints
  - [ ] Adicionar exemplos de uso
  - [ ] Documentar erros comuns
  
- [ ] **7.7.2** Documentação de código
  - [ ] Adicionar JSDoc em funções públicas
  - [ ] Documentar decisões de arquitetura
  - [ ] Criar guias de contribuição

**Estimativa:** 2-3 dias  
**Responsável:** Todos  
**Dependências:** Nenhuma

---

#### 7.8. Testes Automatizados

**Tarefas:**
- [ ] **7.8.1** Testes unitários
  - [ ] Serviços críticos (billing, campaigns, playlists)
  - [ ] Middleware de autenticação
  - [ ] Validações
  
- [ ] **7.8.2** Testes de integração
  - [ ] Fluxos completos (criar campanha → executar)
  - [ ] Testes de isolamento de dados
  - [ ] Testes de permissões
  
- [ ] **7.8.3** Testes E2E
  - [ ] Fluxos principais do usuário
  - [ ] Testes de subdomínios

**Estimativa:** 5-7 dias  
**Responsável:** Backend + Frontend  
**Dependências:** Nenhuma

---

## 📊 RESUMO POR PRIORIDADE

### 🔴 Alta Prioridade (2 itens)
1. Migração client_id → subscriber_id (7.1)
2. Validação Totem → Smart TV 1:N (7.2)

### 🟡 Média Prioridade (3 itens)
3. Padronização de nomenclatura (7.3)
4. Otimização de queries SQL (7.4)
5. Implementar cache em serviços (7.5)

### 🟢 Baixa Prioridade (3 itens)
6. Melhorias de validação (7.6)
7. Melhorias de documentação (7.7)
8. Testes automatizados (7.8)

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

### Semana 1 (Crítico)
1. **Dia 1-2:** Iniciar migração client_id → subscriber_id (backend)
2. **Dia 3-4:** Continuar migração (frontend)
3. **Dia 5:** Validação Totem → Smart TV 1:N

### Semana 2 (Importante)
4. **Dia 1-2:** Padronização de nomenclatura
5. **Dia 3-4:** Otimização de queries SQL
6. **Dia 5:** Implementar cache

### Semana 3+ (Melhorias)
7. Melhorias de validação
8. Documentação
9. Testes automatizados

---

## 📝 NOTAS IMPORTANTES

1. **Migração client_id → subscriber_id:**
   - Fazer em etapas para não quebrar sistema
   - Manter compatibilidade temporária
   - Testar extensivamente antes de remover código legado

2. **Validação 1:N:**
   - Verificar se frontend já suporta
   - Pode ser que apenas backend precise de ajustes

3. **Otimizações:**
   - Medir antes de otimizar
   - Usar ferramentas de profiling
   - Documentar melhorias feitas

---

**Última atualização:** 2026-01-03  
**Próxima revisão:** Após implementação das correções críticas
