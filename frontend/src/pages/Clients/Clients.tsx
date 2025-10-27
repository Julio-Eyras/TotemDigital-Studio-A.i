import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const Clients: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Gerenciamento de Clientes
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Lista de Clientes
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Esta página está em desenvolvimento. Aqui você poderá gerenciar todos os clientes do sistema.
        </Typography>
      </Paper>
    </Box>
  );
};
