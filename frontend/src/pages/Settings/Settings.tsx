import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const Settings: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Configurações do Sistema
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Configurações Gerais
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Esta página está em desenvolvimento. Aqui você poderá configurar o sistema.
        </Typography>
      </Paper>
    </Box>
  );
};
