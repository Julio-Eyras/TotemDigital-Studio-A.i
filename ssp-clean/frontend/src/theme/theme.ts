/**
 * Theme Configuration - SmartSignage Pro v2.1
 * Configuração centralizada do tema Material-UI
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { designTokens } from './designTokens';

export const createAppTheme = (mode: 'light' | 'dark' = 'light') => {
  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: designTokens.primary.main,
        dark: designTokens.primary.dark,
        light: designTokens.primary.light,
      },
      secondary: {
        main: designTokens.secondary.main,
        dark: designTokens.secondary.dark,
        light: designTokens.secondary.light,
      },
      success: {
        main: designTokens.status.success,
      },
      warning: {
        main: designTokens.status.warning,
      },
      error: {
        main: designTokens.status.error,
      },
      info: {
        main: designTokens.status.info,
      },
      background: {
        default: mode === 'dark' ? '#121212' : designTokens.neutral.background,
        paper: mode === 'dark' ? '#1e1e1e' : designTokens.neutral.surface,
      },
      text: {
        primary: mode === 'dark' ? '#ffffff' : designTokens.neutral.textPrimary,
        secondary: mode === 'dark' ? '#b0b0b0' : designTokens.neutral.textSecondary,
      },
      divider: mode === 'dark' ? '#424242' : designTokens.neutral.divider,
    },
    typography: {
      fontFamily: designTokens.typography.fontFamily,
      h1: {
        ...designTokens.typography.h1,
        fontWeight: 700,
      },
      h2: {
        ...designTokens.typography.h2,
        fontWeight: 600,
      },
      h3: {
        ...designTokens.typography.h3,
        fontWeight: 600,
      },
      h4: {
        ...designTokens.typography.h4,
        fontWeight: 500,
      },
      h5: {
        fontSize: '16px',
        fontWeight: 500,
      },
      h6: {
        fontSize: '14px',
        fontWeight: 600,
      },
      body1: {
        ...designTokens.typography.bodyLarge,
      },
      body2: {
        ...designTokens.typography.bodyMedium,
      },
      caption: {
        ...designTokens.typography.caption,
      },
    },
    shape: {
      borderRadius: designTokens.borderRadius.md,
    },
    spacing: 4, // Base spacing unit (4px)
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: designTokens.borderRadius.md,
            padding: `${designTokens.spacing.sm}px ${designTokens.spacing.md}px`,
            transition: designTokens.transitions.short,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.md,
            boxShadow: mode === 'dark' 
              ? '0 2px 8px rgba(0,0,0,0.7)' 
              : designTokens.shadows.md,
            transition: designTokens.transitions.short,
            '&:hover': {
              boxShadow: mode === 'dark'
                ? '0 4px 16px rgba(0,0,0,0.9)'
                : designTokens.shadows.lg,
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: designTokens.borderRadius.md,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: designTokens.borderRadius.sm,
            fontWeight: 500,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: designTokens.borderRadius.lg,
          },
        },
      },
      MuiTable: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontWeight: 600,
            },
          },
        },
      },
    },
  };

  return createTheme(themeOptions);
};
