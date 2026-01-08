# 🎯 Implementar Drag and Drop para Campanhas

**Data:** 2026-01-08  
**Status Backend:** ✅ Completo  
**Status Frontend:** ⏳ Pendente

---

## 📋 Resumo

O backend já está implementado com endpoints para reordenar mídias e playlists em campanhas. Agora é necessário implementar a interface de drag and drop no frontend.

---

## ✅ Backend Implementado

### Endpoints Criados:
1. **PUT `/api/campaigns/:id/medias/reorder`**
   - Body: `{ mediaIds: number[] }`
   - Reordena mídias na campanha

2. **PUT `/api/campaigns/:id/playlists/reorder`**
   - Body: `{ playlistIds: number[] }`
   - Reordena playlists na campanha

### Métodos na API do Frontend:
```typescript
campaignApi.reorderMedias(id: number, mediaIds: number[]): Promise<void>
campaignApi.reorderPlaylists(id: number, playlistIds: number[]): Promise<void>
```

---

## 🎨 Implementação Frontend

### 1. Instalar Dependências

```bash
cd frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 2. Criar Componente de Lista Ordenável

Criar `frontend/src/components/SortableList/SortableList.tsx`:

```typescript
import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Box,
} from '@mui/material';
import { DragIndicator } from '@mui/icons-material';

interface SortableItemProps {
  id: number;
  label: string;
  secondary?: string;
  onDelete?: (id: number) => void;
}

function SortableItem({ id, label, secondary, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      secondaryAction={
        onDelete && (
          <IconButton edge="end" onClick={() => onDelete(id)}>
            <Delete />
          </IconButton>
        )
      }
    >
      <ListItemButton>
        <IconButton
          {...attributes}
          {...listeners}
          sx={{ cursor: 'grab', mr: 1 }}
        >
          <DragIndicator />
        </IconButton>
        <ListItemText primary={label} secondary={secondary} />
      </ListItemButton>
    </ListItem>
  );
}

interface SortableListProps {
  items: Array<{ id: number; label: string; secondary?: string }>;
  onReorder: (newOrder: number[]) => void;
  onDelete?: (id: number) => void;
}

export function SortableList({ items, onReorder, onDelete }: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newOrder = arrayMove(items, oldIndex, newIndex);
      onReorder(newOrder.map((item) => item.id));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <List>
          {items.map((item) => (
            <SortableItem
              key={item.id}
              id={item.id}
              label={item.label}
              secondary={item.secondary}
              onDelete={onDelete}
            />
          ))}
        </List>
      </SortableContext>
    </DndContext>
  );
}
```

### 3. Atualizar `Campaigns.tsx`

Adicionar estados para manter a ordem:

```typescript
const [orderedMediaIds, setOrderedMediaIds] = useState<number[]>([]);
const [orderedPlaylistIds, setOrderedPlaylistIds] = useState<number[]>([]);
```

No `useEffect` quando carregar campanha:

```typescript
useEffect(() => {
  if (selectedCampaign) {
    // Manter ordem das mídias e playlists
    setOrderedMediaIds(selectedCampaign.mediaIds || []);
    setOrderedPlaylistIds(selectedCampaign.playlistIds || []);
  }
}, [selectedCampaign]);
```

Adicionar funções para reordenar:

```typescript
const handleReorderMedias = async (newOrder: number[]) => {
  if (!selectedCampaign) return;
  
  try {
    await campaignApi.reorderMedias(selectedCampaign.campaign_id, newOrder);
    setOrderedMediaIds(newOrder);
    // Recarregar campanha para atualizar UI
    const updated = await campaignApi.getById(selectedCampaign.campaign_id);
    setSelectedCampaign(updated);
  } catch (error: any) {
    console.error('Erro ao reordenar mídias:', error);
    alert('Erro ao reordenar mídias: ' + (error.message || 'Erro desconhecido'));
  }
};

const handleReorderPlaylists = async (newOrder: number[]) => {
  if (!selectedCampaign) return;
  
  try {
    await campaignApi.reorderPlaylists(selectedCampaign.campaign_id, newOrder);
    setOrderedPlaylistIds(newOrder);
    // Recarregar campanha para atualizar UI
    const updated = await campaignApi.getById(selectedCampaign.campaign_id);
    setSelectedCampaign(updated);
  } catch (error: any) {
    console.error('Erro ao reordenar playlists:', error);
    alert('Erro ao reordenar playlists: ' + (error.message || 'Erro desconhecido'));
  }
};
```

Substituir os Autocomplete por listas ordenáveis:

```typescript
// Para Mídias
{orderedMediaIds.length > 0 && (
  <Box sx={{ mt: 2 }}>
    <Typography variant="subtitle2" sx={{ mb: 1 }}>
      Mídias (arraste para reordenar)
    </Typography>
    <SortableList
      items={orderedMediaIds.map(id => {
        const media = mediaItems.find(m => m.media_id === id);
        return {
          id,
          label: media?.name || `Mídia ${id}`,
          secondary: media?.fileName || media?.mediaType
        };
      })}
      onReorder={handleReorderMedias}
      onDelete={(id) => {
        const newOrder = orderedMediaIds.filter(mediaId => mediaId !== id);
        handleReorderMedias(newOrder);
      }}
    />
  </Box>
)}

// Para Playlists
{orderedPlaylistIds.length > 0 && (
  <Box sx={{ mt: 2 }}>
    <Typography variant="subtitle2" sx={{ mb: 1 }}>
      Playlists (arraste para reordenar)
    </Typography>
    <SortableList
      items={orderedPlaylistIds.map(id => {
        const playlist = playlists.find(p => p.playlist_id === id);
        return {
          id,
          label: playlist?.name || `Playlist ${id}`,
          secondary: `${playlist?.media_count || 0} mídias`
        };
      })}
      onReorder={handleReorderPlaylists}
      onDelete={(id) => {
        const newOrder = orderedPlaylistIds.filter(playlistId => playlistId !== id);
        handleReorderPlaylists(newOrder);
      }}
    />
  </Box>
)}
```

---

## 📝 Notas de Implementação

1. **@dnd-kit** é mais moderno e acessível que `react-beautiful-dnd`
2. A ordem é salva automaticamente quando o usuário arrasta
3. A lista é atualizada após reordenação bem-sucedida
4. Erros são tratados e exibidos ao usuário

---

## ✅ Checklist

- [ ] Instalar dependências `@dnd-kit`
- [ ] Criar componente `SortableList`
- [ ] Adicionar estados para ordem em `Campaigns.tsx`
- [ ] Implementar funções de reordenação
- [ ] Substituir Autocomplete por listas ordenáveis
- [ ] Testar drag and drop
- [ ] Testar persistência da ordem
- [ ] Adicionar feedback visual durante drag

---

**Status:** ⏳ Aguardando implementação frontend  
**Prioridade:** MÉDIA
