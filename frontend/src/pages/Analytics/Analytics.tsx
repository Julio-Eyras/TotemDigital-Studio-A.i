import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const Analytics: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Analytics e Relatórios
      </Typography>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Dashboard de Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Esta página está em desenvolvimento. Aqui você poderá visualizar analytics e relatórios do sistema.
        </Typography>
      </Paper>
    </Box>
  );
};
