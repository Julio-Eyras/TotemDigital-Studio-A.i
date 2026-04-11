# 📋 Análise Completa do Sistema - Pendências, Integrações e Melhorias

**Data da Análise:** 2026-01-08  
**Escopo:** Sistema completo - Backend, Frontend, Database, Integrações

---

## 🎯 ÍNDICE

1. [Validações Críticas Faltando](#1-validações-críticas-faltando)
2. [Funcionalidades Pendentes](#2-funcionalidades-pendentes)
3. [Integrações Incompletas](#3-integrações-incompletas)
4. [Gerenciamento de Publisher Contracts](#4-gerenciamento-de-publisher-contracts)
5. [Validações de Limites de Planos](#5-validações-de-limites-de-planos)
6. [Execução de Campanhas em Totens](#6-execução-de-campanhas-em-totens)
7. [Frontend - Interfaces Faltando](#7-frontend---interfaces-faltando)
8. [Backend - Endpoints Faltando](#8-backend---endpoints-faltando)
9. [Melhorias de UX/UI](#9-melhorias-de-uxui)
10. [Segurança e Permissões](#10-segurança-e-permissões)
11. [Sincronização Backend-Frontend](#11-sincronização-backend-frontend)

---

## 1. 🔴 VALIDAÇÕES CRÍTICAS FALTANDO

### 1.1. Validação de Limites de Planos ⚠️ **CRÍTICO**

**Status:** ❌ **NÃO IMPLEMENTADO**

**Problema:**
- Não existe validação de limites do plano ao criar mídias, playlists ou campanhas
- Sistema permite criar recursos ilimitados, mesmo que o plano tenha restrições
- Não há verificação de armazenamento (storage) ao fazer upload de mídias

**O que falta:**
- ✅ **Backend:** Implementar validação de limites do plano
  - Verificar `limits.medias` ao criar mídia
  - Verificar `limits.playlists` ao criar playlist
  - Verificar `limits.campaigns` ao criar campanha
  - Verificar `limits.storage_gb` ao fazer upload de mídia
  
- ✅ **Backend:** Criar método `validatePlanLimits(subscriberId, resourceType)` em `subscriberService`
- ✅ **Backend:** Criar método `validateStorageLimit(subscriberId, newFileSizeBytes)` em `mediaService`
- ✅ **Frontend:** Exibir alertas quando próximo do limite
- ✅ **Frontend:** Bloquear criação se limite atingido
- ✅ **Frontend:** Mostrar contador: "X de Y mídias utilizadas"

**Impacto:** 🔴 **CRÍTICO** - Permite uso excessivo de recursos sem controle

**Tempo Estimado:** 4-5 horas

---

### 1.2. Validação de Acesso a Totens ⚠️ **CRÍTICO**

**Status:** ⚠️ **PARCIAL**

**O que está implementado:**
- ✅ Validação básica ao associar campanha a publishers
- ✅ Validação de acesso via `subscriber_publisher_access`

**O que falta:**
- ❌ **Backend:** Validação ao associar campanha a totens específicos
- ❌ **Backend:** Validação ao adicionar campanha à fila de execução (`campaign_totems`)
- ❌ **Backend:** Método `validateTotemAccess(subscriberId, totemId)` em `campaignService`
- ❌ **Frontend:** Validação ao selecionar totens para campanha

**Onde implementar:**
- `backend/src/services/campaignService.ts` - Método `addTotemToCampaign`
- `backend/src/routes/campaigns.ts` - Rota `POST /api/campaigns/:id/totems`

**Impacto:** 🔴 **CRÍTICO** - Permite acesso a totens não autorizados

**Tempo Estimado:** 2-3 horas

---

### 1.3. Validação de Execução de Campanhas ⚠️ **CRÍTICO**

**Status:** ⚠️ **PARCIAL**

**O que está implementado:**
- ✅ Validação de contrato ativo ao criar campanha
- ✅ Validação de período válido do contrato

**O que falta:**
- ❌ **Backend:** Validação completa ao adicionar campanha à fila de totens
- ❌ **Backend:** Validar que campanha tem conteúdo (mídias ou playlists)
- ❌ **Backend:** Validar status da campanha ('active' ou 'approved')
- ❌ **Backend:** Validar acesso aos totens via contratos/planos
- ❌ **Backend:** Método `validateCampaignExecution(campaignId, totemIds)` em `campaignService`

**Onde implementar:**
- `backend/src/services/campaignService.ts` - Método `addTotemToCampaign`
- `backend/src/services/campaignService.ts` - Método `activateCampaign`
- `backend/src/routes/campaigns.ts` - Rota `POST /api/campaigns/:id/activate`

**Impacto:** 🔴 **CRÍTICO** - Permite execução de campanhas inválidas

**Tempo Estimado:** 3-4 horas

---

## 2. ⚠️ FUNCIONALIDADES PENDENTES

### 2.1. Adicionar Mídias à Playlist ⚠️ **CRÍTICO**

**Status:** ✅ **BACKEND IMPLEMENTADO** ❌ **FRONTEND NÃO IMPLEMENTADO**

**O que está implementado:**
- ✅ Backend: Endpoint `POST /api/playlists/:id/media` existe
- ✅ Backend: Método `addMediaToPlaylist` em `playlistService.ts`
- ✅ Backend: Validação de ownership (mídia pertence ao mesmo subscriber)

**O que falta:**
- ❌ **Frontend:** Interface para selecionar mídias e adicionar à playlist
- ❌ **Frontend:** Seção na aba Playlists para adicionar mídias
- ❌ **Frontend:** Select múltiplo de mídias disponíveis
- ❌ **Frontend:** Botão "Adicionar Mídias à Playlist"
- ❌ **Frontend:** Lista de mídias já adicionadas com opção de remover
- ❌ **Frontend:** Campo para configurar ordem inicial (`order_index`)

**Onde implementar:**
- `frontend/src/pages/Subscribers/Subscribers.tsx` - Aba Playlists
- Adicionar chamada para `playlistApi.addMedia(playlistId, mediaId, orderIndex, duration)`

**Impacto:** 🟡 **MÉDIO** - Funcionalidade essencial que está faltando na interface

**Tempo Estimado:** 2-3 horas

---

### 2.2. Drag & Drop para Reordenar Playlist ⚠️ **IMPORTANTE**

**Status:** ✅ **BACKEND IMPLEMENTADO** ❌ **FRONTEND NÃO IMPLEMENTADO**

**O que está implementado:**
- ✅ Backend: Método `reorderPlaylistMedia` em `playlistService.ts`

**O que falta:**
- ❌ **Frontend:** Instalar biblioteca: `@dnd-kit/core` ou `react-beautiful-dnd`
- ❌ **Frontend:** Componente draggable para itens da playlist
- ❌ **Frontend:** Implementar drag & drop na lista de itens
- ❌ **Frontend:** Atualizar `order_index` automaticamente após reordenar

**Onde implementar:**
- `frontend/src/pages/Subscribers/Subscribers.tsx` - Aba Playlists
- Criar componente `DraggablePlaylistItems`

**Impacto:** 🟡 **MÉDIO** - Melhora significativamente a UX

**Tempo Estimado:** 3-4 horas

---

### 2.3. Configurar Duração por Item da Playlist ⚠️ **IMPORTANTE**

**Status:** ✅ **BACKEND IMPLEMENTADO** ❌ **FRONTEND NÃO IMPLEMENTADO**

**O que está implementado:**
- ✅ Backend: Campo `display_seconds` em `playlist_items`
- ✅ Backend: Duração padrão (10 segundos) ao adicionar mídia

**O que falta:**
- ❌ **Frontend:** Campo numérico na lista de itens para configurar duração
- ❌ **Frontend:** Validação de duração mínima e máxima
- ❌ **Frontend:** Endpoint para atualizar duração: `PATCH /api/playlists/:id/items/:itemId`

**Onde implementar:**
- `frontend/src/pages/Subscribers/Subscribers.tsx` - Aba Playlists, lista de itens
- Adicionar `TextField` para `display_seconds` em cada item

**Impacto:** 🟡 **MÉDIO** - Funcionalidade importante para controle de exibição

**Tempo Estimado:** 2-3 horas

---

## 3. 🔗 INTEGRAÇÕES INCOMPLETAS

### 3.1. Gerenciamento de Publisher Contracts ⚠️ **CRÍTICO**

**Status:** ✅ **BACKEND PARCIAL** ❌ **FRONTEND NÃO IMPLEMENTADO**

**O que está implementado:**
- ✅ Backend: Service `publisherContractService.ts` existe
- ✅ Backend: Tabela `publisher_contracts` no banco
- ✅ Backend: Validação de `contract_id` ao criar publisher
- ✅ Frontend: Aba "Contratos" no dialog de edição do Publisher (somente visualização)

**O que falta:**
- ❌ **Backend:** Rotas para gerenciar `publisher_contracts` (CRUD completo)
- ❌ **Backend:** Endpoint `GET /api/publishers/:id/contracts`
- ❌ **Backend:** Endpoint `POST /api/contracts` (para publisher contracts)
- ❌ **Backend:** Endpoint `PUT /api/publisher-contracts/:id`
- ❌ **Backend:** Endpoint `DELETE /api/publisher-contracts/:id`
- ❌ **Frontend:** Interface completa para gerenciar `publisher_contracts`
- ❌ **Frontend:** Formulário para criar/editar publisher contract
- ❌ **Frontend:** Validações específicas para publisher contracts
- ❌ **Frontend:** Aba "Contratos" no dialog de edição do Publisher (CRUD completo)

**Onde implementar:**
- `backend/src/routes/contracts.ts` - Adicionar rotas para publisher contracts
- `backend/src/routes/publishers.ts` - Adicionar rota para listar contracts
- `frontend/src/pages/Contracts/Contracts.tsx` - Adicionar suporte a publisher contracts
- `frontend/src/pages/Publishers/Publishers.tsx` - Melhorar aba Contratos

**Impacto:** 🔴 **CRÍTICO** - Funcionalidade essencial para o modelo de negócio

**Tempo Estimado:** 5-6 horas

---

### 3.2. Integração de Planos com Limites ⚠️ **CRÍTICO**

**Status:** ❌ **NÃO IMPLEMENTADO**

**Problema:**
- Tabela `plans` não tem campos para definir limites (`limits.medias`, `limits.playlists`, `limits.campaigns`, `limits.storage_gb`)
- Não existe validação de limites baseada nos planos

**O que falta:**
- ❌ **Database:** Verificar se tabela `plans` tem campos de limites
- ❌ **Database:** Se não existir, adicionar campos:
  - `max_medias INTEGER`
  - `max_playlists INTEGER`
  - `max_campaigns INTEGER`
  - `max_storage_gb NUMERIC(10, 2)`
  - OU campo JSONB `limits` com estrutura:
    ```json
    {
      "medias": 100,
      "playlists": 50,
      "campaigns": 20,
      "storage_gb": 10.0
    }
    ```
- ❌ **Backend:** Atualizar interface `Plan` para incluir limites
- ❌ **Backend:** Implementar validações de limites

**Onde verificar:**
- `database/smartchannel-db-v2-refactored-partX.sql` - Tabela `plans`
- `backend/src/services/planService.ts` - Interface `Plan`

**Impacto:** 🔴 **CRÍTICO** - Base para validações de limites

**Tempo Estimado:** 2-3 horas (verificação) + 3-4 horas (implementação se necessário)

---

### 3.3. Associar Publishers a Contratos de Subscribers ⚠️ **IMPORTANTE**

**Status:** ✅ **BACKEND PARCIAL** ❌ **FRONTEND NÃO IMPLEMENTADO**

**O que está implementado:**
- ✅ Backend: Tabela `subscriber_publisher_access` existe
- ✅ Backend: Método `addPublisherToContract` em `contractService.ts`
- ✅ Backend: Método `getPublishersByContract` em `contractService.ts`
- ✅ Backend: Rota `POST /api/contracts/:id/publishers` existe
- ✅ Frontend: Aba "Publicadores" no dialog de criação/edição de contratos

**O que falta:**
- ❌ **Frontend:** Validação ao selecionar publishers (verificar se subscriber tem acesso)
- ❌ **Frontend:** Feedback visual quando publisher é adicionado
- ❌ **Frontend:** Lista de publishers associados ao contrato na visualização
- ❌ **Frontend:** Opção de remover publisher do contrato

**Onde implementar:**
- `frontend/src/pages/Contracts/Contracts.tsx` - Melhorar aba "Publicadores"

**Impacto:** 🟡 **MÉDIO** - Melhora a gestão de contratos

**Tempo Estimado:** 2-3 horas

---

## 4. 📱 FRONTEND - INTERFACES FALTANDO

### 4.1. Dashboard de Estatísticas do Subscriber ⚠️ **IMPORTANTE**

**Status:** ❌ **NÃO IMPLEMENTADO**

**O que falta:**
- ❌ **Frontend:** Nova aba "Estatísticas" no dialog de edição do Subscriber
- ❌ **Frontend:** Exibir:
  - Contadores: mídias, playlists, campanhas
  - Storage utilizado vs. limite
  - Gráficos de uso (Chart.js ou similar)
  - Alertas de expiração de contratos
  - Limites do plano vs. uso atual

**Onde implementar:**
- `frontend/src/pages/Subscribers/Subscribers.tsx` - Adicionar nova aba
- `backend/src/routes/subscribers.ts` - Expandir rota `GET /api/subscribers/:id/stats`

**Impacto:** 🟡 **MÉDIO** - Melhora visibilidade do uso

**Tempo Estimado:** 4-5 horas

---

### 4.2. Filtros e Busca nas Listas ⚠️ **IMPORTANTE**

**Status:** ⚠️ **PARCIAL**

**O que está implementado:**
- ✅ Backend: Parâmetro `search` em várias rotas
- ✅ Algumas listas têm filtros básicos

**O que falta:**
- ❌ **Frontend:** Filtros avançados nas listas de:
  - Mídias (por tipo, status, tags)
  - Playlists (por status, data)
  - Campanhas (por status, tipo, contrato)
- ❌ **Frontend:** Busca por nome, tags
- ❌ **Frontend:** Ordenação (data, nome, tipo)

**Onde implementar:**
- `frontend/src/pages/Subscribers/Subscribers.tsx` - Adicionar filtros nas abas

**Impacto:** 🟡 **MÉDIO** - Melhora navegação

**Tempo Estimado:** 2-3 horas

---

### 4.3. Paginação Real ⚠️ **IMPORTANTE**

**Status:** ⚠️ **PARCIAL**

**O que está implementado:**
- ✅ Backend: Paginação implementada na maioria das rotas
- ✅ Frontend: Algumas listas têm paginação

**O que falta:**
- ❌ **Frontend:** Paginação consistente em todas as listas
- ❌ **Frontend:** Componente de paginação reutilizável
- ❌ **Frontend:** Substituir limite hardcoded (1000 itens) por paginação real

**Onde implementar:**
- `frontend/src/pages/Subscribers/Subscribers.tsx` - Abas Mídias, Playlists, Campanhas
- `frontend/src/pages/Publishers/Publishers.tsx` - Abas Locais, Totens, Smart TVs

**Impacto:** 🟡 **MÉDIO** - Necessário para grandes volumes

**Tempo Estimado:** 3-4 horas

---

## 5. 🔌 BACKEND - ENDPOINTS FALTANDO

### 5.1. Endpoints para Publisher Contracts ⚠️ **CRÍTICO**

**Status:** ✅ **SERVICE EXISTE** ❌ **ROTAS NÃO IMPLEMENTADAS**

**O que falta:**
- ❌ **Backend:** `GET /api/publisher-contracts` - Listar publisher contracts
- ❌ **Backend:** `GET /api/publisher-contracts/:id` - Obter publisher contract por ID
- ❌ **Backend:** `POST /api/publisher-contracts` - Criar publisher contract
- ❌ **Backend:** `PUT /api/publisher-contracts/:id` - Atualizar publisher contract
- ❌ **Backend:** `DELETE /api/publisher-contracts/:id` - Deletar publisher contract
- ❌ **Backend:** `GET /api/publishers/:id/contracts` - Listar contracts de um publisher

**Onde implementar:**
- `backend/src/routes/contracts.ts` - Adicionar rotas para publisher contracts
- OU criar `backend/src/routes/publisher-contracts.ts` dedicado

**Impacto:** 🔴 **CRÍTICO** - Necessário para gerenciar publisher contracts

**Tempo Estimado:** 2-3 horas

---

### 5.2. Endpoint para Atualizar Duração de Item da Playlist ⚠️ **IMPORTANTE**

**Status:** ❌ **NÃO IMPLEMENTADO**

**O que falta:**
- ❌ **Backend:** `PATCH /api/playlists/:id/items/:itemId` - Atualizar `display_seconds`
- ❌ **Backend:** Validação de duração mínima e máxima

**Onde implementar:**
- `backend/src/routes/playlists.ts` - Adicionar rota
- `backend/src/services/playlistService.ts` - Adicionar método `updatePlaylistItemDuration`

**Impacto:** 🟡 **MÉDIO** - Necessário para funcionalidade de configurar duração

**Tempo Estimado:** 1-2 horas

---

### 5.3. Endpoint para Validar Execução de Campanha ⚠️ **CRÍTICO**

**Status:** ❌ **NÃO IMPLEMENTADO**

**O que falta:**
- ❌ **Backend:** `POST /api/campaigns/:id/validate-execution` - Validar se campanha pode ser executada
- ❌ **Backend:** Retornar lista de validações (contrato, conteúdo, totens, status)

**Onde implementar:**
- `backend/src/routes/campaigns.ts` - Adicionar rota
- `backend/src/services/campaignService.ts` - Adicionar método `validateCampaignExecution`

**Impacto:** 🟡 **MÉDIO** - Melhora feedback ao usuário

**Tempo Estimado:** 2-3 horas

---

## 6. 🔐 SEGURANÇA E PERMISSÕES

### 6.1. Isolamento de Dados por Subscriber ⚠️ **CRÍTICO**

**Status:** ⚠️ **PARCIAL**

**O que está implementado:**
- ✅ Validação básica de ownership em algumas rotas
- ✅ Isolamento em `playlistService` e `mediaService`

**O que falta:**
- ❌ **Backend:** Middleware global de isolamento por subscriber
- ❌ **Backend:** Validação em todas as rotas (mídias, playlists, campanhas)
- ❌ **Backend:** Prevenção de acesso cross-subscriber
- ❌ **Backend:** Filtros automáticos em queries do banco de dados

**Onde implementar:**
- `backend/src/middleware/subscriberIsolation.middleware.ts` - Criar middleware
- Aplicar em todas as rotas de recursos de subscribers

**Impacto:** 🔴 **CRÍTICO** - Segurança de dados

**Tempo Estimado:** 4-5 horas

---

### 6.2. Proteção de Valores Contratuais ⚠️ **IMPORTANTE**

**Status:** ⚠️ **PARCIAL**

**O que está implementado:**
- ✅ Roles administrativos podem criar contratos
- ✅ Contratos têm valores reservados

**O que falta:**
- ❌ **Backend:** Middleware para ocultar campos reservados baseado em role
- ❌ **Backend:** Remover `total_amount`, `payment_terms`, `revenue_share_percentage` da resposta para roles não autorizados
- ❌ **Frontend:** Não exibir valores reservados para `operador_comercial`

**Onde implementar:**
- `backend/src/middleware/contractValuesProtection.middleware.ts` - Criar middleware
- `frontend/src/pages/Contracts/Contracts.tsx` - Ocultar campos baseado em role

**Impacto:** 🟡 **MÉDIO** - Proteção de informações sensíveis

**Tempo Estimado:** 2-3 horas

---

## 7. 🔄 SINCRONIZAÇÃO BACKEND-FRONTEND

### 7.1. Interfaces TypeScript Desatualizadas ⚠️ **IMPORTANTE**

**Status:** ⚠️ **PARCIAIS DESATUALIZAÇÕES**

**O que verificar:**
- ❌ `frontend/src/services/api/index.ts` - Verificar se todas as interfaces estão atualizadas
- ❌ `Contract` interface - Verificar se inclui campos de publisher contracts
- ❌ `Campaign` interface - Verificar se inclui `contractId`, `contract_number`, etc.
- ❌ `Playlist` interface - Verificar se inclui todos os campos necessários

**Impacto:** 🟡 **MÉDIO** - Pode causar erros de tipo

**Tempo Estimado:** 1-2 horas (verificação e correção)

---

### 7.2. Validações Cliente-Servidor ⚠️ **IMPORTANTE**

**Status:** ⚠️ **PARCIAL**

**O que está implementado:**
- ✅ Validações básicas no frontend (email, telefone, contrato)
- ✅ Validações no backend

**O que falta:**
- ❌ **Frontend:** Validações de limites de plano (antes de fazer upload)
- ❌ **Frontend:** Validações de acesso a totens (antes de associar campanha)
- ❌ **Frontend:** Feedback prévio de validações (chamadas para endpoints de validação)

**Impacto:** 🟡 **MÉDIO** - Melhora UX

**Tempo Estimado:** 2-3 horas

---

## 8. 📊 RESUMO DE PRIORIDADES

### 🔴 PRIORIDADE CRÍTICA (Implementar Primeiro)

1. ✅ **Validação de Limites de Planos** (4-5h)
2. ✅ **Validação de Acesso a Totens** (2-3h)
3. ✅ **Validação de Execução de Campanhas** (3-4h)
4. ✅ **Gerenciamento de Publisher Contracts (Backend)** (2-3h)
5. ✅ **Isolamento de Dados por Subscriber** (4-5h)

**Total:** ~16-20 horas

---

### 🟡 PRIORIDADE IMPORTANTE (Implementar Depois)

6. ✅ **Adicionar Mídias à Playlist (Frontend)** (2-3h)
7. ✅ **Gerenciamento de Publisher Contracts (Frontend)** (3-4h)
8. ✅ **Drag & Drop para Playlist** (3-4h)
9. ✅ **Configurar Duração por Item** (2-3h)
10. ✅ **Dashboard de Estatísticas** (4-5h)
11. ✅ **Integração de Planos com Limites** (2-3h + 3-4h se necessário)
12. ✅ **Filtros e Busca** (2-3h)
13. ✅ **Paginação Real** (3-4h)
14. ✅ **Proteção de Valores Contratuais** (2-3h)

**Total:** ~26-34 horas

---

### 🟢 PRIORIDADE FUTURA (Pode Esperar)

15. ✅ **Endpoint para Validar Execução** (2-3h)
16. ✅ **Endpoint para Atualizar Duração** (1-2h)
17. ✅ **Validações Cliente-Servidor** (2-3h)
18. ✅ **Interfaces TypeScript Desatualizadas** (1-2h)

**Total:** ~6-10 horas

---

## 9. 📝 RECOMENDAÇÕES

### Ordem de Implementação Sugerida:

**Fase 1 (Crítico - 1-2 semanas):**
1. Verificar schema de `plans` e adicionar limites se necessário
2. Implementar validações de limites de planos
3. Implementar validação de acesso a totens
4. Implementar validação completa de execução de campanhas
5. Implementar rotas para publisher contracts
6. Implementar isolamento de dados por subscriber

**Fase 2 (Importante - 1 semana):**
7. Implementar frontend para adicionar mídias à playlist
8. Implementar frontend para gerenciar publisher contracts
9. Implementar drag & drop para playlist
10. Implementar configurar duração por item

**Fase 3 (Melhorias - 1 semana):**
11. Implementar dashboard de estatísticas
12. Implementar filtros e busca
13. Implementar paginação real
14. Implementar proteção de valores contratuais

---

## 10. ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Validações Críticas:
- [ ] Validação de limites de planos (medias, playlists, campaigns, storage)
- [ ] Validação de acesso a totens
- [ ] Validação completa de execução de campanhas
- [ ] Isolamento de dados por subscriber

### Funcionalidades Pendentes:
- [ ] Adicionar mídias à playlist (frontend)
- [ ] Drag & drop para reordenar playlist
- [ ] Configurar duração por item da playlist

### Integrações:
- [ ] Gerenciamento completo de publisher contracts (backend + frontend)
- [ ] Verificar e atualizar schema de `plans` com limites
- [ ] Associar publishers a contratos (melhorias no frontend)

### Frontend:
- [ ] Dashboard de estatísticas
- [ ] Filtros e busca avançados
- [ ] Paginação real em todas as listas

### Backend:
- [ ] Rotas para publisher contracts
- [ ] Endpoint para atualizar duração de item
- [ ] Endpoint para validar execução de campanha

### Segurança:
- [ ] Middleware de isolamento por subscriber
- [ ] Proteção de valores contratuais

---

**Data de Criação:** 2026-01-08  
**Última Atualização:** 2026-01-08
