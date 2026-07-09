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
  Paper,
} from '@mui/material';
import { DragIndicator, Delete, PowerSettingsNew } from '@mui/icons-material';

interface SortableItemProps {
  id: string | number;
  label: string;
  secondary?: string;
  thumbnailSrc?: string;
  active?: boolean;
  onDelete?: (id: string | number) => void;
  onToggleActive?: (id: string | number) => void;
}

function SortableItem({ id, label, secondary, thumbnailSrc, active = true, onDelete, onToggleActive }: SortableItemProps) {
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
      component={Paper}
      elevation={isDragging ? 4 : 1}
      sx={{ mb: 1, borderRadius: 1, opacity: active ? 1 : 0.55 }}
      secondaryAction={
        (onDelete || onToggleActive) && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {onToggleActive && (
              <IconButton
                edge="end"
                size="small"
                color={active ? 'warning' : 'success'}
                onClick={() => onToggleActive(id)}
                title={active ? 'Desabilitar' : 'Habilitar'}
              >
                <PowerSettingsNew fontSize="small" />
              </IconButton>
            )}
            {onDelete && (
              <IconButton
                edge="end"
                onClick={() => onDelete(id)}
                color="error"
                size="small"
              >
                <Delete />
              </IconButton>
            )}
          </Box>
        )
      }
    >
      <ListItemButton sx={{ alignItems: 'center', py: 1 }}>
        <IconButton
          {...attributes}
          {...listeners}
          sx={{ cursor: isDragging ? 'grabbing' : 'grab', mr: 1, color: 'text.secondary' }}
          size="small"
        >
          <DragIndicator />
        </IconButton>
        {thumbnailSrc ? (
          <Box
            sx={{
              width: 44,
              aspectRatio: '9 / 16',
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: '#000',
              flexShrink: 0,
              mr: 1.5,
            }}
          >
            <Box
              component="img"
              src={thumbnailSrc}
              alt=""
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </Box>
        ) : null}
        <ListItemText primary={label} secondary={secondary} />
      </ListItemButton>
    </ListItem>
  );
}

interface SortableListProps {
  items: Array<{ id: string | number; label: string; secondary?: string; thumbnailSrc?: string; active?: boolean }>;
  onReorder: (newOrder: Array<string | number>) => void;
  onDelete?: (id: string | number) => void;
  onToggleActive?: (id: string | number) => void;
  emptyMessage?: string;
}

export function SortableList({ 
  items, 
  onReorder, 
  onDelete,
  onToggleActive,
  emptyMessage = 'Nenhum item para exibir'
}: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requer movimento de 8px antes de iniciar drag
      },
    }),
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

  if (items.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        {emptyMessage}
      </Box>
    );
  }

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
        <List sx={{ p: 0 }}>
          {items.map((item) => (
            <SortableItem
              key={item.id}
              id={item.id}
              label={item.label}
              secondary={item.secondary}
              thumbnailSrc={item.thumbnailSrc}
              active={item.active !== false}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
            />
          ))}
        </List>
      </SortableContext>
    </DndContext>
  );
}
