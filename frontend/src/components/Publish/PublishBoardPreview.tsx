import React from 'react';
import { Box, Typography } from '@mui/material';
import type { QuickPublishPreset } from '../../services/api';
import { findPublishPreset } from '../../config/publishTemplates';
import type { PublishBoardLayoutDto } from '../../services/api';
import {
  PUBLISH_BOARD_LAYOUT,
  boardAspectRatio,
} from '../../config/publishBoardLayoutMetrics';

interface PublishBoardPreviewProps {
  preset: QuickPublishPreset;
  layout: PublishBoardLayoutDto;
  productLines?: { name: string; price: number | null; description?: string | null }[];
  /** Preview ocupa 100% da largura do container (proporção 9:16 ou 16:9). */
  fullScreen?: boolean;
}

export const PublishBoardPreview: React.FC<PublishBoardPreviewProps> = ({
  preset,
  layout,
  productLines = [],
  fullScreen = true,
}) => {
  const presetCfg = findPublishPreset(preset);
  const portrait = layout.preferredOrientation === 'portrait';
  const headerPct = `${PUBLISH_BOARD_LAYOUT.headerHeightRatio * 100}%`;

  const renderBody = () => {
    if (preset === 'menu') {
      const items = productLines.slice(0, 20);
      if (!items.length) {
        return (
          <Typography variant="body2" sx={{ color: '#e0e0e0', textAlign: 'center', mt: 4 }}>
            Cadastre produtos no cardápio
          </Typography>
        );
      }
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            justifyContent: 'flex-start',
            gap: 0.5,
            py: 0.5,
          }}
        >
          {items.map((p) => (
            <Box key={`${p.name}-${p.price}`} sx={{ flex: '0 0 auto' }}>
              <Typography
                variant="body2"
                sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2, fontSize: 'clamp(0.65rem, 1.8vw, 0.95rem)' }}
              >
                {p.name}
                {layout.showPrices && p.price != null ? ` — R$ ${Number(p.price).toFixed(2)}` : ''}
              </Typography>
              {p.description && (
                <Typography variant="caption" sx={{ color: '#f0e6d8', display: 'block', lineHeight: 1.2 }}>
                  {p.description}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      );
    }

    const order = layout.blockOrder.length ? layout.blockOrder : Object.keys(layout.content);
    const blocks = order
      .map((key) => ({ key, val: String(layout.content[key] || '').trim() }))
      .filter((b) => b.val);

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'space-evenly',
          py: 1,
        }}
      >
        {blocks.map(({ key, val }) => {
          const isPrice = key === 'price';
          const isHeadline = key === 'headline';
          return (
            <Typography
              key={key}
              sx={{
                color: isPrice ? '#ffe082' : key === 'logoUrl' ? '#bbdefb' : '#fff',
                fontWeight: isPrice ? 800 : isHeadline ? 800 : 400,
                lineHeight: 1.2,
                fontSize: isPrice
                  ? 'clamp(1.4rem, 5vw, 2.4rem)'
                  : isHeadline
                    ? 'clamp(1rem, 3.5vw, 1.75rem)'
                    : 'clamp(0.75rem, 2.2vw, 1.1rem)',
              }}
            >
              {val}
            </Typography>
          );
        })}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        width: fullScreen ? '100%' : portrait ? 280 : 420,
        maxWidth: '100%',
        aspectRatio: boardAspectRatio(layout.preferredOrientation),
        maxHeight: fullScreen ? (portrait ? 'min(78vh, 900px)' : 'min(50vh, 520px)') : undefined,
        borderRadius: fullScreen ? 1 : 2,
        overflow: 'hidden',
        background: layout.accentColor
          ? `linear-gradient(135deg, #0d1117 0%, ${layout.accentColor} 100%)`
          : presetCfg.background,
        display: 'flex',
        flexDirection: 'column',
        mx: fullScreen ? 0 : 'auto',
        boxShadow: fullScreen ? 4 : 3,
        border: fullScreen ? '2px solid' : 'none',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          flex: `0 0 ${headerPct}`,
          minHeight: headerPct,
          bgcolor: 'rgba(0,0,0,0.38)',
          px: '5%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography
          sx={{
            color: '#fff',
            fontWeight: 800,
            lineHeight: 1.1,
            fontSize: 'clamp(0.85rem, 2.8vw, 1.35rem)',
          }}
        >
          {layout.boardTitle}
        </Typography>
        <Typography variant="caption" sx={{ color: '#e0e0e0', mt: 0.25 }}>
          {presetCfg.label} · {portrait ? '9:16 tela cheia' : '16:9 tela cheia'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflow: 'hidden', px: '5%', py: '3%', minHeight: 0 }}>{renderBody()}</Box>
    </Box>
  );
};
