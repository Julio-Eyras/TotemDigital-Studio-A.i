import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const Campaigns: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Gerenciamento de Campanhas
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Lista de Campanhas
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Esta página está em desenvolvimento. Aqui você poderá gerenciar todas as campanhas do sistema.
        </Typography>
      </Paper>
    </Box>
  );
};
