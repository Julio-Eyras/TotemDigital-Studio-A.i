import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const Reports: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Relatórios
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Geração de Relatórios
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Esta página está em desenvolvimento. Aqui você poderá gerar relatórios do sistema.
        </Typography>
      </Paper>
    </Box>
  );
};
