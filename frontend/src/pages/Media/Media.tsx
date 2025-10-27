import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const Media: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Gerenciamento de Mídia
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Biblioteca de Mídia
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Esta página está em desenvolvimento. Aqui você poderá gerenciar todos os arquivos de mídia do sistema.
        </Typography>
      </Paper>
    </Box>
  );
};
