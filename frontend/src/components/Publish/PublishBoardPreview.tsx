import React from 'react';
import { Box, Typography } from '@mui/material';
import type { QuickPublishPreset } from '../../services/api';
import { findPublishPreset } from '../../config/publishTemplates';
import type { PublishBoardLayoutDto } from '../../services/api';

interface PublishBoardPreviewProps {
  preset: QuickPublishPreset;
  layout: PublishBoardLayoutDto;
  productLines?: { name: string; price: number | null; description?: string | null }[];
  height?: number;
}

export const PublishBoardPreview: React.FC<PublishBoardPreviewProps> = ({
  preset,
  layout,
  productLines = [],
  height,
}) => {
  const presetCfg = findPublishPreset(preset);
  const portrait = layout.preferredOrientation === 'portrait';
  const boxHeight = height ?? (portrait ? 420 : 280);
  const maxWidth = portrait ? 280 : 420;

  const renderBody = () => {
    if (preset === 'menu') {
      return productLines.slice(0, 14).map((p) => (
        <Box key={`${p.name}-${p.price}`} sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
            {p.name}
            {layout.showPrices && p.price != null ? ` — R$ ${Number(p.price).toFixed(2)}` : ''}
          </Typography>
        </Box>
      ));
    }
    const order = layout.blockOrder.length ? layout.blockOrder : Object.keys(layout.content);
    return order.map((key) => {
      const val = String(layout.content[key] || '').trim();
      if (!val) return null;
      const isPrice = key === 'price';
      return (
        <Typography
          key={key}
          variant={isPrice ? 'h6' : 'body2'}
          sx={{
            color: isPrice ? '#ffe082' : '#fff',
            fontWeight: isPrice ? 800 : key === 'headline' ? 700 : 400,
            mb: 0.75,
            lineHeight: 1.25,
          }}
        >
          {val}
        </Typography>
      );
    });
  };

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth,
        height: boxHeight,
        borderRadius: 2,
        overflow: 'hidden',
        background: layout.accentColor
          ? `linear-gradient(135deg, #0d1117 0%, ${layout.accentColor} 100%)`
          : presetCfg.background,
        display: 'flex',
        flexDirection: 'column',
        mx: 'auto',
        boxShadow: 3,
      }}
    >
      <Box sx={{ bgcolor: 'rgba(0,0,0,0.35)', px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 800 }}>
          {layout.boardTitle}
        </Typography>
        <Typography variant="caption" sx={{ color: '#e0e0e0' }}>
          {presetCfg.label} · {portrait ? '9:16' : '16:9'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5 }}>{renderBody()}</Box>
    </Box>
  );
};
