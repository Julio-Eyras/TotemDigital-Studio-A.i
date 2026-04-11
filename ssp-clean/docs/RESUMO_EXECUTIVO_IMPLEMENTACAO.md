# Resumo Executivo: Implementação das Mudanças no Código

## 📊 Escopo Identificado

### Arquivos Encontrados
- **64 arquivos** usando `client_id`/`clientId`/`clients` no backend
- **1 arquivo** usando `host_id`/`hostId`/`hosts` no backend
- Múltiplos arquivos no frontend

### Arquivos Críticos para Renomeação

#### Backend - Rotas
- ✅ `backend/src/routes/clients.ts` → `subscribers.ts`
- ❌ `backend/src/routes/hosts.ts` → **NÃO EXISTE** (precisa criar `publishers.ts`)

#### Backend - Serviços
- ✅ `backend/src/services/clientService.ts` → `subscriberService.ts`
- ❌ `backend/src/services/hostService.ts` → **NÃO EXISTE** (precisa criar `publisherService.ts`)

#### Backend - Outros Arquivos Críticos
- `backend/src/middleware/auth.middleware.ts` - atualizar `client_id` → `publisher_id`
- `backend/src/routes/campaigns.ts` - atualizar `client_id` → `subscriber_id`
- `backend/src/routes/media.ts` - atualizar `client_id` → `subscriber_id`
- `backend/src/services/campaignService.ts` - atualizar queries
- `backend/src/services/mediaService.ts` - atualizar queries
- `backend/src/services/billingService.ts` - dividir em dois serviços
- E muitos outros...

---

## 🎯 Estratégia de Implementação

### Abordagem Incremental
1. **Criar novos arquivos** primeiro (não deletar os antigos ainda)
2. **Atualizar referências** gradualmente
3. **Manter compatibilidade** durante transição
4. **Remover arquivos antigos** no final

### Ordem de Execução

#### FASE 1: Criar Novos Arquivos Base
1. Criar `subscriberService.ts` (baseado em `clientService.ts`)
2. Criar `publisherService.ts` (novo)
3. Criar `subscribers.ts` route (baseado em `clients.ts`)
4. Criar `publishers.ts` route (novo)

#### FASE 2: Atualizar Tipos e Interfaces
1. Atualizar `types/entities.ts`
2. Atualizar `types/api.ts`
3. Criar novos tipos para billing e contratos

#### FASE 3: Atualizar Serviços Dependentes
1. Atualizar `campaignService.ts`
2. Atualizar `mediaService.ts`
3. Criar `subscriberBillingService.ts`
4. Criar `publisherBillingService.ts`

#### FASE 4: Atualizar Rotas
1. Atualizar `index.ts` de rotas
2. Atualizar rotas que usam `client_id`
3. Criar novas rotas de billing e contratos

#### FASE 5: Atualizar Middleware
1. Atualizar `auth.middleware.ts`
2. Atualizar validações

#### FASE 6: Frontend
1. Renomear componentes
2. Atualizar APIs
3. Atualizar stores

---

## ⚠️ Pontos de Atenção

1. **Não deletar arquivos antigos** até que todas as referências sejam atualizadas
2. **Manter compatibilidade** durante transição (pode usar aliases temporários)
3. **Testar cada fase** antes de prosseguir
4. **Documentar mudanças** em cada arquivo

---

## 🚀 Próximos Passos Imediatos

Vou começar criando:
1. `backend/src/services/subscriberService.ts`
2. `backend/src/services/publisherService.ts`
3. `backend/src/routes/subscribers.ts`
4. `backend/src/routes/publishers.ts`

Depois atualizar as referências gradualmente.

