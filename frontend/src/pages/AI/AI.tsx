import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const AI: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Inteligência Artificial
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Configurações de IA
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Esta página está em desenvolvimento. Aqui você poderá configurar e gerenciar as funcionalidades de IA.
        </Typography>
      </Paper>
    </Box>
  );
};
