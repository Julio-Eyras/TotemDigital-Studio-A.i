# Análise do Frontend - Playlists e Campanhas

## 📊 Estado Atual do Frontend

### ✅ **O QUE JÁ ESTÁ IMPLEMENTADO:**

#### 1. **Campaigns.tsx**
- ✅ Suporta `playlistIds` em `CreateCampaignRequest` e `UpdateCampaignRequest`
- ✅ Exibe seleção de playlists via `Autocomplete`
- ✅ Filtra publishers acessíveis baseado em `subscriberId`
- ✅ Valida acesso a publishers antes de criar campanha
- ✅ Usa `userSubscriberId` para filtros automáticos
- ✅ Exibe publishers associados nas campanhas

#### 2. **Playlists.tsx**
- ✅ Interface básica de CRUD de playlists
- ✅ Gerenciamento de mídias em playlists
- ✅ Exibe contagem de mídias e duração total
- ⚠️ **PROBLEMA**: Ainda usa `clientId` em vez de `subscriberId`
- ⚠️ **PROBLEMA**: Não filtra automaticamente por subscriber (mostra todas as playlists)
- ⚠️ **PROBLEMA**: Não valida ownership ao adicionar mídias

#### 3. **API Client (`index.ts`)**
- ✅ `PlaylistItem` interface existe
- ⚠️ **PROBLEMA**: Interface ainda usa `client_id` em vez de `subscriber_id`
- ⚠️ **PROBLEMA**: `CreatePlaylistRequest` e `UpdatePlaylistRequest` usam `clientId`
- ✅ `Campaign` interface suporta `playlistIds`
- ❌ **FALTA**: `Campaign` interface não tem `mediaIds` e `mediaNames`
- ❌ **FALTA**: `CreateCampaignRequest` e `UpdateCampaignRequest` não têm `mediaIds`

---

## ❌ **O QUE ESTÁ FALTANDO (PRIORIDADE ALTA):**

### 1. **Playlists.tsx - Filtros e Isolamento de Dados**

**Problemas:**
- ❌ Não filtra playlists por subscriber automaticamente
- ❌ Não mostra seletor de subscriber para admins
- ❌ Não valida ownership ao adicionar mídias à playlist
- ❌ Não mostra subscriber name nas playlists
- ❌ Usa `clientId` em vez de `subscriberId`

**O que fazer:**
```typescript
// Adicionar:
- Filtro automático por subscriberId (não-admin)
- Seletor de subscriber para admins
- Validação ao adicionar mídia (verificar se pertence ao mesmo subscriber)
- Exibir subscriber_name nas cards de playlist
- Usar subscriberId em vez de clientId
```

### 2. **Campaigns.tsx - Suporte a Mídias Diretas**

**Problemas:**
- ❌ Não permite selecionar mídias diretamente (sem playlist)
- ❌ Não exibe mídias diretas associadas à campanha
- ❌ Interface `Campaign` não tem `mediaIds` e `mediaNames`

**O que fazer:**
```typescript
// Adicionar:
- Campo para selecionar mídias diretamente (Autocomplete)
- Exibir mídias diretas na listagem de campanhas
- Validação: mídias devem pertencer ao mesmo subscriber da campanha
- Atualizar interface Campaign para incluir mediaIds e mediaNames
```

### 3. **API Client (`index.ts`) - Interfaces Atualizadas**

**Problemas:**
- ❌ `PlaylistItem` não tem `subscriber_id` e `subscriber_name`
- ❌ `CreatePlaylistRequest` e `UpdatePlaylistRequest` usam `clientId`
- ❌ `Campaign` interface não tem `mediaIds` e `mediaNames`
- ❌ `CreateCampaignRequest` e `UpdateCampaignRequest` não têm `mediaIds`

**O que fazer:**
```typescript
// Atualizar interfaces:
- PlaylistItem: adicionar subscriber_id, subscriber_name
- CreatePlaylistRequest: adicionar subscriberId (manter clientId para compatibilidade)
- UpdatePlaylistRequest: adicionar subscriberId (manter clientId para compatibilidade)
- Campaign: adicionar mediaIds?: number[], mediaNames?: string[]
- CreateCampaignRequest: adicionar mediaIds?: number[]
- UpdateCampaignRequest: adicionar mediaIds?: number[]
```

### 4. **Validações de Ownership no Frontend**

**Problemas:**
- ❌ Não valida se mídia pertence ao mesmo subscriber da playlist antes de adicionar
- ❌ Não valida se playlist pertence ao mesmo subscriber da campanha antes de associar
- ❌ Não valida se mídia pertence ao mesmo subscriber da campanha antes de associar diretamente

**O que fazer:**
```typescript
// Adicionar validações:
- Ao adicionar mídia à playlist: verificar subscriber_id da mídia === subscriber_id da playlist
- Ao associar playlist à campanha: verificar subscriber_id da playlist === subscriber_id da campanha
- Ao associar mídia diretamente à campanha: verificar subscriber_id da mídia === subscriber_id da campanha
- Mostrar mensagens de erro claras quando há violação
```

---

## 🎯 **PRIORIDADES PARA IMPLEMENTAR:**

### **PRIORIDADE 1 (CRÍTICO):**

1. **Atualizar Interfaces TypeScript**
   - [ ] Adicionar `subscriber_id` e `subscriber_name` em `PlaylistItem`
   - [ ] Adicionar `subscriberId` em `CreatePlaylistRequest` e `UpdatePlaylistRequest`
   - [ ] Adicionar `mediaIds` e `mediaNames` em `Campaign`
   - [ ] Adicionar `mediaIds` em `CreateCampaignRequest` e `UpdateCampaignRequest`

2. **Playlists.tsx - Isolamento de Dados**
   - [ ] Filtrar playlists automaticamente por `subscriberId` (não-admin)
   - [ ] Adicionar seletor de subscriber para admins
   - [ ] Exibir `subscriber_name` nas cards
   - [ ] Usar `subscriberId` em vez de `clientId`

3. **Playlists.tsx - Validação de Ownership**
   - [ ] Filtrar mídias disponíveis por subscriber ao adicionar à playlist
   - [ ] Validar ownership antes de adicionar mídia
   - [ ] Mostrar erro se mídia pertence a outro subscriber

### **PRIORIDADE 2 (IMPORTANTE):**

4. **Campaigns.tsx - Suporte a Mídias Diretas**
   - [ ] Adicionar campo `Autocomplete` para selecionar mídias diretamente
   - [ ] Filtrar mídias por subscriber ao selecionar
   - [ ] Exibir mídias diretas na listagem de campanhas
   - [ ] Validar ownership ao associar mídias

5. **Campaigns.tsx - Validação de Playlists**
   - [ ] Filtrar playlists disponíveis por subscriber ao selecionar
   - [ ] Validar ownership ao associar playlist à campanha
   - [ ] Mostrar erro se playlist pertence a outro subscriber

### **PRIORIDADE 3 (MELHORIAS):**

6. **UX Improvements**
   - [ ] Mostrar avisos quando tentar usar recursos de outro subscriber
   - [ ] Indicar visualmente o subscriber de cada playlist/campanha
   - [ ] Adicionar tooltips explicativos sobre ownership
   - [ ] Melhorar mensagens de erro

---

## 📝 **RESUMO DO QUE FALTA:**

### **Backend → Frontend (Gaps):**

| Funcionalidade Backend | Status Frontend | Prioridade |
|------------------------|-----------------|------------|
| `subscriber_id` em playlists | ❌ Usa `client_id` | **ALTA** |
| Filtro automático por subscriber | ❌ Não implementado | **ALTA** |
| Validação de ownership (mídia → playlist) | ❌ Não implementado | **ALTA** |
| Validação de ownership (playlist → campanha) | ❌ Não implementado | **ALTA** |
| `mediaIds` em campanhas | ❌ Não implementado | **ALTA** |
| `subscriberId` em requests | ❌ Usa `clientId` | **MÉDIA** |
| Exibir `subscriber_name` | ❌ Não exibe | **MÉDIA** |

### **Componentes que Precisam de Atualização:**

1. **`frontend/src/pages/Playlists/Playlists.tsx`** - **CRÍTICO**
   - Filtros por subscriber
   - Validação de ownership
   - Uso de `subscriberId`

2. **`frontend/src/pages/Campaigns/Campaigns.tsx`** - **CRÍTICO**
   - Suporte a `mediaIds`
   - Validação de ownership de playlists
   - Validação de ownership de mídias diretas

3. **`frontend/src/services/api/index.ts`** - **CRÍTICO**
   - Atualizar interfaces TypeScript
   - Adicionar `mediaIds` em Campaign

---

## 🚀 **PLANO DE AÇÃO RECOMENDADO:**

### **Fase 1: Interfaces e API Client (30 min)**
1. Atualizar `PlaylistItem` interface
2. Atualizar `CreatePlaylistRequest` e `UpdatePlaylistRequest`
3. Atualizar `Campaign` interface
4. Atualizar `CreateCampaignRequest` e `UpdateCampaignRequest`

### **Fase 2: Playlists.tsx - Isolamento (1h)**
1. Adicionar filtro automático por subscriber
2. Adicionar seletor de subscriber para admins
3. Exibir subscriber_name
4. Usar subscriberId em vez de clientId

### **Fase 3: Playlists.tsx - Validações (30 min)**
1. Filtrar mídias por subscriber ao adicionar
2. Validar ownership antes de adicionar
3. Mostrar erros apropriados

### **Fase 4: Campaigns.tsx - Mídias Diretas (1h)**
1. Adicionar campo para selecionar mídias diretamente
2. Filtrar mídias por subscriber
3. Exibir mídias diretas na listagem
4. Validar ownership

### **Fase 5: Campaigns.tsx - Validações (30 min)**
1. Filtrar playlists por subscriber
2. Validar ownership ao associar playlist
3. Mostrar erros apropriados

**Tempo Total Estimado: ~3.5 horas**

