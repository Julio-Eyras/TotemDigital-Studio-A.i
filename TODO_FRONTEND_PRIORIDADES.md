# TODO Frontend - Prioridades para Playlists e Campanhas

## 🚨 **PRIORIDADE CRÍTICA (Fazer Agora)**

### 1. **Atualizar Interfaces TypeScript** ⚡
**Arquivo:** `frontend/src/services/api/index.ts`

- [ ] `PlaylistItem`: Adicionar `subscriber_id`, `subscriber_name` (manter `client_id` para compatibilidade)
- [ ] `CreatePlaylistRequest`: Adicionar `subscriberId` (manter `clientId` para compatibilidade)
- [ ] `UpdatePlaylistRequest`: Adicionar `subscriberId` (manter `clientId` para compatibilidade)
- [ ] `Campaign`: Adicionar `mediaIds?: number[]`, `mediaNames?: string[]`, `playlistIds?: number[]`, `playlistNames?: string[]`
- [ ] `CreateCampaignRequest`: Adicionar `mediaIds?: number[]`
- [ ] `UpdateCampaignRequest`: Adicionar `mediaIds?: number[]`

### 2. **Playlists.tsx - Isolamento de Dados** ⚡
**Arquivo:** `frontend/src/pages/Playlists/Playlists.tsx`

- [ ] Importar `useAppSelector` para obter `userSubscriberId` e `isAdmin`
- [ ] Filtrar playlists automaticamente por `subscriberId` (não-admin)
- [ ] Adicionar seletor de subscriber para admins (similar ao Media.tsx)
- [ ] Exibir `subscriber_name` nas cards de playlist
- [ ] Usar `subscriberId` em vez de `clientId` nas requisições
- [ ] Filtrar mídias disponíveis por subscriber ao adicionar à playlist
- [ ] Validar ownership antes de adicionar mídia (mostrar erro se pertence a outro subscriber)

### 3. **Campaigns.tsx - Suporte a Mídias Diretas** ⚡
**Arquivo:** `frontend/src/pages/Campaigns/Campaigns.tsx`

- [ ] Adicionar `mediaIds` ao estado `newCampaign`
- [ ] Adicionar campo `Autocomplete` para selecionar mídias diretamente (similar a playlists)
- [ ] Filtrar mídias por subscriber ao selecionar
- [ ] Exibir mídias diretas na listagem de campanhas (além de playlists)
- [ ] Validar ownership ao associar mídias diretamente
- [ ] Incluir `mediaIds` ao criar/atualizar campanha

---

## 📋 **CHECKLIST DE IMPLEMENTAÇÃO:**

### **Fase 1: Interfaces (15 min)**
```typescript
// frontend/src/services/api/index.ts

// 1. Atualizar PlaylistItem
export interface PlaylistItem {
  playlist_id: number;
  name: string;
  description?: string;
  subscriber_id: number; // NOVO
  subscriber_name?: string; // NOVO
  client_id?: number; // DEPRECATED (compatibilidade)
  is_active: boolean;
  // ...
}

// 2. Atualizar CreatePlaylistRequest
export interface CreatePlaylistRequest {
  name: string;
  description?: string;
  subscriberId?: number; // NOVO
  clientId?: number; // DEPRECATED
}

// 3. Atualizar Campaign
export interface Campaign {
  // ... campos existentes
  playlistIds?: number[]; // NOVO
  playlistNames?: string[]; // NOVO
  mediaIds?: number[]; // NOVO
  mediaNames?: string[]; // NOVO
}

// 4. Atualizar CreateCampaignRequest
export interface CreateCampaignRequest {
  // ... campos existentes
  mediaIds?: number[]; // NOVO
}
```

### **Fase 2: Playlists.tsx (1h)**
```typescript
// Adicionar imports
import { useAppSelector } from '../../store/hooks';
import { clientApi } from '../../services/api';

// Adicionar state
const user = useAppSelector((state) => state.auth.user);
const isAdmin = user?.role === 'admin' || user?.role === 'admin_sql';
const userSubscriberId = user?.subscriberId || user?.clientId;
const [selectedSubscriberId, setSelectedSubscriberId] = useState<number | undefined>();
const [subscribers, setSubscribers] = useState<any[]>([]);

// Modificar loadPlaylists
const loadPlaylists = async () => {
  const subscriberId = isAdmin ? selectedSubscriberId : userSubscriberId;
  const response = await playlistApi.getAll({
    search: searchTerm || undefined,
    subscriberId: subscriberId, // NOVO
    clientId: subscriberId, // DEPRECATED (compatibilidade)
  });
  // ...
};

// Filtrar mídias por subscriber ao adicionar
const loadMediaItems = async () => {
  const subscriberId = isAdmin ? selectedSubscriberId : userSubscriberId;
  const response = await mediaApi.getAll({
    subscriberId: subscriberId, // Filtrar por subscriber
  });
  // ...
};

// Validar ownership ao adicionar mídia
const handleAddMediaToPlaylist = async (mediaId: number) => {
  if (!selectedPlaylist) return;
  
  // Verificar se mídia pertence ao mesmo subscriber da playlist
  const media = mediaItems.find(m => m.media_id === mediaId);
  if (media && media.subscriberId !== selectedPlaylist.subscriber_id) {
    setError(`Esta mídia pertence a outro subscriber (${media.subscriberName}). Você só pode adicionar mídias do mesmo subscriber da playlist.`);
    return;
  }
  
  // ... resto do código
};
```

### **Fase 3: Campaigns.tsx (1h)**
```typescript
// Adicionar mediaIds ao estado
const [newCampaign, setNewCampaign] = useState<CreateCampaignRequest>({
  // ... campos existentes
  mediaIds: [], // NOVO
});

// Adicionar campo para selecionar mídias diretamente
<Autocomplete
  multiple
  options={mediaItems.filter(m => {
    // Filtrar mídias por subscriber
    const subscriberId = newCampaign.clientId;
    return !subscriberId || m.subscriberId === subscriberId;
  })}
  getOptionLabel={(option) => option.name}
  value={mediaItems.filter(m => newCampaign.mediaIds?.includes(m.media_id))}
  onChange={(_, newValue) => {
    setNewCampaign({ ...newCampaign, mediaIds: newValue.map(m => m.media_id) });
  }}
  renderInput={(params) => (
    <TextField {...params} label="Mídias Diretas (sem playlist)" margin="normal" />
  )}
/>

// Exibir mídias diretas na listagem
{campaign.mediaIds && campaign.mediaIds.length > 0 && (
  <Chip label={`${campaign.mediaIds.length} mídias diretas`} />
)}
```

---

## ⚠️ **PROBLEMAS IDENTIFICADOS:**

### **Playlists.tsx:**
1. ❌ Não filtra por subscriber (mostra todas as playlists)
2. ❌ Não valida ownership ao adicionar mídias
3. ❌ Usa `clientId` em vez de `subscriberId`
4. ❌ Não mostra subscriber name

### **Campaigns.tsx:**
1. ❌ Não suporta `mediaIds` (mídias diretas)
2. ❌ Não valida ownership de playlists
3. ❌ Não filtra playlists por subscriber

### **API Client:**
1. ❌ Interfaces desatualizadas
2. ❌ Falta `mediaIds` em Campaign
3. ❌ Falta `subscriberId` em PlaylistItem

---

## 🎯 **ORDEM DE IMPLEMENTAÇÃO RECOMENDADA:**

1. **Atualizar Interfaces** (15 min) - Base para tudo
2. **Playlists.tsx - Isolamento** (30 min) - Crítico para segurança
3. **Playlists.tsx - Validações** (30 min) - Previne erros
4. **Campaigns.tsx - Mídias Diretas** (1h) - Nova funcionalidade
5. **Campaigns.tsx - Validações** (30 min) - Previne erros

**Total: ~3 horas**

