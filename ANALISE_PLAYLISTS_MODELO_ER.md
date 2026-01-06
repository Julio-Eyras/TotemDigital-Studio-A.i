# Análise do Módulo de Playlists - Modelo ER v2

## 📋 Modelo ER Desejado (v2)

### Relacionamentos Esperados:
1. **Subscriber → Playlists**: 1:N (Um subscriber pode ter uma ou mais playlists)
2. **Playlist → Media**: N:M via `playlist_items` (Uma playlist é composta por 1 ou mais mídias)
3. **Media → Subscriber**: N:1 (Mídias pertencem a um subscriber)
4. **Campaign → Subscriber**: N:1 (Campanhas pertencem a um subscriber)
5. **Campaign → Playlists**: N:M via `campaign_playlists` (Campanhas podem ter uma ou várias playlists)
6. **Campaign → Media**: N:M via `campaign_medias` (Campanhas podem ter mídias diretamente, sem playlist)

---

## 🔍 Como Está Funcionando HOJE

### ✅ **O QUE ESTÁ CORRETO:**

#### 1. **Tabela `playlists` (Schema v2)**
```sql
CREATE TABLE playlists (
    playlist_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL,  -- ✅ CORRETO: Playlist pertence ao subscriber
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    schedule_config JSONB,
    metadata JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```
- ✅ Playlist pertence a um subscriber (`subscriber_id NOT NULL`)
- ✅ Não tem mais `totem_id`, `campaign_id` (removidos na migração)
- ✅ Relacionamento com campanhas via `campaign_playlists` (N:M)

#### 2. **Tabela `playlist_items`**
```sql
CREATE TABLE playlist_items (
    item_id SERIAL PRIMARY KEY,
    playlist_id INTEGER NOT NULL,  -- FK para playlists
    media_id INTEGER NOT NULL,      -- FK para medias
    display_seconds INTEGER,
    order_index INTEGER,
    ...
);
```
- ✅ Relacionamento N:M entre playlists e mídias
- ✅ Ordem de exibição (`order_index`)

#### 3. **Tabela `campaign_playlists`**
```sql
CREATE TABLE campaign_playlists (
    campaign_id INTEGER NOT NULL,
    playlist_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (campaign_id, playlist_id)
);
```
- ✅ Relacionamento N:M entre campanhas e playlists
- ✅ Uma playlist pode estar em múltiplas campanhas
- ✅ Uma campanha pode ter múltiplas playlists

#### 4. **Tabela `medias`**
- ✅ Tem `subscriber_id` (mídias pertencem a subscribers)
- ✅ Relacionamento correto com playlists via `playlist_items`

---

### ⚠️ **PROBLEMAS IDENTIFICADOS:**

#### 1. **Backend Service (`playlistService.ts`)**

**Problema:** Ainda usa `clientId` em vez de `subscriberId` na interface
```typescript
export interface CreatePlaylistRequest {
  name: string;
  description?: string;
  clientId?: number;  // ❌ DEVERIA SER subscriberId
}

export interface PlaylistItem {
  client_id?: number;  // ❌ DEVERIA SER subscriber_id
}
```

**Problema:** Mapeamento inconsistente
```typescript
// Linha 82: Mapeia subscriber_id para client_id (confuso)
p.subscriber_id as client_id,
```

**Problema:** Validação de ownership não implementada
- Não verifica se o usuário tem permissão para acessar playlists de outros subscribers
- Não aplica isolamento de dados para usuários não-admin

#### 2. **Campaign Service (`campaignService.ts`)**

**Problema:** Não há suporte para `campaign_medias` (mídias diretas em campanhas)
- O modelo ER v2 permite campanhas terem mídias diretamente (sem playlist)
- Não existe tabela `campaign_medias` no schema
- Não há lógica para associar mídias diretamente a campanhas

**Status Atual:**
- ✅ Campanhas podem ter playlists via `campaign_playlists`
- ❌ Campanhas NÃO podem ter mídias diretamente (falta `campaign_medias`)

#### 3. **Validação de Relacionamentos**

**Problema:** Não valida se mídias pertencem ao mesmo subscriber da playlist
```typescript
// Quando adiciona mídia à playlist, não verifica:
// - Se media.subscriber_id === playlist.subscriber_id
// - Se usuário tem permissão para usar essa mídia
```

**Problema:** Não valida se playlists pertencem ao mesmo subscriber da campanha
```typescript
// Quando associa playlist à campanha, não verifica:
// - Se playlist.subscriber_id === campaign.subscriber_id
```

---

## 📊 **RESUMO DO ESTADO ATUAL:**

### ✅ **Funcionando Corretamente:**
1. ✅ Playlists pertencem a subscribers (`subscriber_id NOT NULL`)
2. ✅ Playlists são compostas por mídias via `playlist_items`
3. ✅ Mídias pertencem a subscribers (`subscriber_id`)
4. ✅ Campanhas pertencem a subscribers (`subscriber_id`)
5. ✅ Campanhas podem ter múltiplas playlists via `campaign_playlists`
6. ✅ Schema SQL está correto (v2)

### ❌ **Precisa Ser Corrigido:**

1. **Backend - Interfaces TypeScript:**
   - [ ] Renomear `clientId` → `subscriberId` em todas as interfaces
   - [ ] Atualizar mapeamentos para usar `subscriber_id` diretamente
   - [ ] Remover aliases confusos (`client_id`)

2. **Backend - Validações:**
   - [ ] Validar ownership: mídia deve pertencer ao mesmo subscriber da playlist
   - [ ] Validar ownership: playlist deve pertencer ao mesmo subscriber da campanha
   - [ ] Implementar isolamento de dados (usuários só veem suas playlists)
   - [ ] Validar permissões ao adicionar/remover mídias de playlists

3. **Backend - Campaign Service:**
   - [ ] Criar tabela `campaign_medias` (se necessário)
   - [ ] Implementar lógica para associar mídias diretamente a campanhas
   - [ ] Atualizar `CreateCampaignRequest` para aceitar `mediaIds` além de `playlistIds`

4. **Frontend:**
   - [ ] Atualizar interfaces para usar `subscriberId` em vez de `clientId`
   - [ ] Filtrar playlists por subscriber automaticamente
   - [ ] Validar que mídias selecionadas pertencem ao subscriber
   - [ ] Mostrar avisos quando tentar usar mídias de outro subscriber

---

## 🎯 **PRÓXIMOS PASSOS SUGERIDOS:**

### Fase 1: Corrigir Nomenclatura e Interfaces
1. Renomear `clientId` → `subscriberId` em todas as interfaces
2. Atualizar mapeamentos no backend
3. Atualizar frontend para usar `subscriberId`

### Fase 2: Implementar Validações
1. Validar ownership de mídias ao adicionar à playlist
2. Validar ownership de playlists ao associar à campanha
3. Implementar isolamento de dados (RBAC)

### Fase 3: Suporte a Mídias Diretas em Campanhas (Opcional)
1. Criar tabela `campaign_medias` se necessário
2. Implementar lógica de associação
3. Atualizar frontend para permitir adicionar mídias diretamente

---

## 📝 **NOTAS IMPORTANTES:**

1. **Schema SQL está correto** - A estrutura do banco está alinhada com o modelo ER v2
2. **Problemas são principalmente no código** - Interfaces, validações e lógica de negócio
3. **Compatibilidade** - Alguns campos ainda usam `clientId` por compatibilidade, mas devem ser migrados
4. **Isolamento de dados** - Precisa ser implementado para garantir que subscribers só vejam seus próprios dados

