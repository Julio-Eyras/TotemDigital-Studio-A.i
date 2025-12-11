import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Carregando...' 
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
      }}
    >
      <CircularProgress
        size={60}
        thickness={4}
        sx={{
          color: 'white',
          marginBottom: 3,
        }}
      />
      <Typography
        variant="h6"
        sx={{
          fontWeight: 500,
          textAlign: 'center',
          maxWidth: 300,
        }}
      >
        {message}
      </Typography>
    </Box>
  );
};

export default LoadingScreen;
