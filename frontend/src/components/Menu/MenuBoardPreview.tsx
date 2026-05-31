import React from 'react';
import { Box, Typography } from '@mui/material';

export interface MenuBoardPreviewItem {
  productId: number;
  name: string;
  price: number | null;
  description?: string | null;
}

interface MenuBoardPreviewProps {
  boardTitle: string;
  accentColor?: string;
  showPrices?: boolean;
  items: MenuBoardPreviewItem[];
  height?: number;
}

/** Preview 9:16 do quadro de cardápio (espelha o render server-side). */
export const MenuBoardPreview: React.FC<MenuBoardPreviewProps> = ({
  boardTitle,
  accentColor = '#ff9800',
  showPrices = true,
  items,
  height = 420,
}) => (
  <Box
    sx={{
      width: '100%',
      maxWidth: 280,
      height,
      borderRadius: 2,
      overflow: 'hidden',
      background: `linear-gradient(135deg, #1a0f00 0%, ${accentColor} 100%)`,
      display: 'flex',
      flexDirection: 'column',
      mx: 'auto',
      boxShadow: 3,
    }}
  >
    <Box sx={{ bgcolor: 'rgba(0,0,0,0.35)', px: 2, py: 1.5 }}>
      <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 800 }}>
        {boardTitle}
      </Typography>
    </Box>
    <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5 }}>
      {items.slice(0, 18).map((item) => (
        <Box key={item.productId} sx={{ mb: 1.25 }}>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.25 }}>
            {item.name}
            {showPrices && item.price != null ? ` — R$ ${Number(item.price).toFixed(2)}` : ''}
          </Typography>
          {item.description && (
            <Typography variant="caption" sx={{ color: '#f0e6d8', display: 'block' }}>
              {item.description}
            </Typography>
          )}
        </Box>
      ))}
      {items.length === 0 && (
        <Typography variant="caption" sx={{ color: '#f0e6d8' }}>
          Adicione produtos para ver o preview.
        </Typography>
      )}
    </Box>
  </Box>
);
