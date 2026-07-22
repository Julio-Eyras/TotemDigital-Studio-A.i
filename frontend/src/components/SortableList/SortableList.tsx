import React, { memo, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
  ListItemText,
  IconButton,
  Box,
  Paper,
} from '@mui/material';
import { DragIndicator, Delete, PowerSettingsNew, Visibility } from '@mui/icons-material';
import { MediaPortraitThumb } from '../Media/MediaPortraitThumb';

export type SortableListPreview = {
  mediaId: number;
  thumbSrc?: string;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
};

interface SortableItemProps {
  id: string | number;
  label: string;
  secondary?: React.ReactNode;
  thumbSrc?: string;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  active?: boolean;
  onDelete?: (id: string | number) => void;
  onToggleActive?: (id: string | number) => void;
  onPreview?: (id: string | number) => void;
}

const SortableItem = memo(function SortableItem({
  id,
  label,
  secondary,
  thumbSrc,
  mediaWidth,
  mediaHeight,
  active = true,
  onDelete,
  onToggleActive,
  onPreview,
}: SortableItemProps) {
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

  const hasActions = Boolean(onDelete || onToggleActive || onPreview);

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      component={Paper}
      elevation={isDragging ? 4 : 1}
      sx={{
        mb: 1,
        borderRadius: 1,
        opacity: active ? 1 : 0.55,
        overflow: 'hidden',
        alignItems: 'center',
        py: 0.5,
      }}
      secondaryAction={
        hasActions ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {onPreview && (
              <IconButton
                edge="end"
                size="small"
                onClick={() => onPreview(id)}
                title="Visualizar mídia"
                aria-label="Visualizar mídia"
              >
                <Visibility fontSize="small" />
              </IconButton>
            )}
            {onToggleActive && (
              <IconButton
                edge="end"
                size="small"
                color={active ? 'success' : 'warning'}
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
                title="Remover"
              >
                <Delete />
              </IconButton>
            )}
          </Box>
        ) : null
      }
    >
      <IconButton
        {...attributes}
        {...listeners}
        aria-label="Arrastar para reordenar"
        sx={{
          cursor: isDragging ? 'grabbing' : 'grab',
          mr: 1,
          color: 'text.secondary',
          flexShrink: 0,
          alignSelf: 'center',
          touchAction: 'none',
        }}
        size="small"
      >
        <DragIndicator />
      </IconButton>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
          py: 1,
          pr: hasActions ? 12 : 1,
          overflow: 'hidden',
        }}
      >
        <MediaPortraitThumb
          src={thumbSrc}
          mediaWidth={mediaWidth}
          mediaHeight={mediaHeight}
        />
        <ListItemText
          primary={label}
          secondary={secondary}
          sx={{ minWidth: 0, overflow: 'hidden', ml: 1 }}
          primaryTypographyProps={{ noWrap: true }}
          secondaryTypographyProps={
            typeof secondary === 'string'
              ? { noWrap: true }
              : { component: 'div', sx: { mt: 0.25 } }
          }
        />
      </Box>
    </ListItem>
  );
});

interface SortableListProps {
  items: Array<{
    id: string | number;
    label: string;
    secondary?: React.ReactNode;
    preview?: SortableListPreview;
    thumbnailSrc?: string;
    active?: boolean;
  }>;
  onReorder: (newOrder: Array<string | number>) => void;
  onDelete?: (id: string | number) => void;
  onToggleActive?: (id: string | number) => void;
  onPreview?: (id: string | number) => void;
  emptyMessage?: string;
}

export function SortableList({
  items,
  onReorder,
  onDelete,
  onToggleActive,
  onPreview,
  emptyMessage = 'Nenhum item para exibir',
}: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

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
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <List sx={{ p: 0 }}>
          {items.map((item) => (
            <SortableItem
              key={item.id}
              id={item.id}
              label={item.label}
              secondary={item.secondary}
              thumbSrc={item.preview?.thumbSrc ?? item.thumbnailSrc}
              mediaWidth={item.preview?.mediaWidth}
              mediaHeight={item.preview?.mediaHeight}
              active={item.active !== false}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              onPreview={onPreview}
            />
          ))}
        </List>
      </SortableContext>
    </DndContext>
  );
}
