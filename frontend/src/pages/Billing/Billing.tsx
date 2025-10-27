import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const Billing: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Faturamento e Cobrança
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Gestão Financeira
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Esta página está em desenvolvimento. Aqui você poderá gerenciar faturamento e cobrança do sistema.
        </Typography>
      </Paper>
    </Box>
  );
};
