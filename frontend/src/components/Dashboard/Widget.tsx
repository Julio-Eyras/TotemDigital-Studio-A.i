/**
 * Widget Component - Smart Signage Pro v3.1
 * Componente base para widgets do dashboard customizável
 */

import React from 'react';
import { Box, Paper, Typography, IconButton } from '@mui/material';
import { DragIndicator, MoreVert } from '@mui/icons-material';

export interface WidgetProps {
  id: string;
  title: string;
  type: 'chart' | 'table' | 'kpi' | 'list' | 'custom';
  data?: any;
  config?: Record<string, any>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onResize?: (id: string, size: { width: number; height: number }) => void;
  isDragging?: boolean;
}

export const Widget: React.FC<WidgetProps> = ({
  id,
  title,
  type,
  data,
  config,
  onEdit,
  onDelete,
  onResize,
  isDragging = false
}) => {
  const renderContent = () => {
    switch (type) {
      case 'kpi':
        return (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h3" color="primary">
              {data?.value || '0'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data?.label || title}
            </Typography>
          </Box>
        );
      case 'chart':
        return (
          <Box sx={{ p: 2, height: '100%' }}>
            <Typography variant="body2" color="text.secondary">
              Gráfico: {title}
            </Typography>
            {/* Placeholder para gráfico - será implementado com recharts */}
          </Box>
        );
      case 'table':
        return (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Tabela: {title}
            </Typography>
            {/* Placeholder para tabela */}
          </Box>
        );
      case 'list':
        return (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Lista: {title}
            </Typography>
            {/* Placeholder para lista */}
          </Box>
        );
      default:
        return (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2">{title}</Typography>
          </Box>
        );
    }
  };

  return (
    <Paper
      sx={{
        p: 2,
        height: '100%',
        position: 'relative',
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      elevation={2}
    >
      {/* Header do Widget */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DragIndicator sx={{ color: 'text.secondary', cursor: 'grab' }} />
          <Typography variant="h6">{title}</Typography>
        </Box>
        <IconButton size="small" onClick={() => onEdit?.(id)}>
          <MoreVert />
        </IconButton>
      </Box>

      {/* Conteúdo do Widget */}
      {renderContent()}
    </Paper>
  );
};

export default Widget;

