import React from 'react';
import { Box, Typography } from '@mui/material';
import type { PublishPresetConfig } from '../../config/publishTemplates';

interface TemplatePreviewStripProps {
  preset: PublishPresetConfig;
  height?: number;
}

/** Mini preview visual do template (gradiente + headline) para cards do dashboard. */
export const TemplatePreviewStrip: React.FC<TemplatePreviewStripProps> = ({ preset, height = 56 }) => (
  <Box
    sx={{
      height,
      borderRadius: 1,
      background: preset.background,
      display: 'flex',
      alignItems: 'flex-end',
      px: 1.25,
      py: 0.75,
      mb: 1,
    }}
  >
    <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
      {preset.headline}
    </Typography>
  </Box>
);
