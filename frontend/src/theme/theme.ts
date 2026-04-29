/**
 * Theme Configuration - SmartSignage Pro v2.1
 * Configuração centralizada do tema Material-UI
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { designTokens } from './designTokens';

type DarkTone = 'carvao' | 'grafite' | 'suave';

export const createAppTheme = (mode: 'light' | 'dark' = 'light', darkTone: DarkTone = 'carvao') => {
  const darkTokens = {
    carvao: {
      backgroundDefault: '#121212',
      backgroundPaper: '#1a1a1a',
      textPrimary: '#ffffff',
      textSecondary: '#b0b0b0',
      divider: '#424242',
      cardShadow: '0 2px 8px rgba(0,0,0,0.7)',
      cardShadowHover: '0 4px 16px rgba(0,0,0,0.9)',
    },
    grafite: {
      backgroundDefault: '#0F172A',
      backgroundPaper: '#0B1220',
      textPrimary: '#ffffff',
      textSecondary: '#A7B0C0',
      divider: '#334155',
      cardShadow: '0 2px 8px rgba(0,0,0,0.55)',
      cardShadowHover: '0 6px 18px rgba(2,6,23,0.85)',
    },
    suave: {
      backgroundDefault: '#171717',
      backgroundPaper: '#1f1f1f',
      textPrimary: '#ffffff',
      textSecondary: '#c0c0c0',
      divider: '#3a3a3a',
      cardShadow: '0 2px 8px rgba(0,0,0,0.6)',
      cardShadowHover: '0 5px 16px rgba(0,0,0,0.85)',
    },
  } as const;

  const t = mode === 'dark' ? darkTokens[darkTone] : null;

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
        default: mode === 'dark' && t ? t.backgroundDefault : designTokens.neutral.background,
        paper: mode === 'dark' && t ? t.backgroundPaper : designTokens.neutral.surface,
      },
      text: {
        primary: mode === 'dark' && t ? t.textPrimary : designTokens.neutral.textPrimary,
        secondary: mode === 'dark' && t ? t.textSecondary : designTokens.neutral.textSecondary,
      },
      divider: mode === 'dark' && t ? t.divider : designTokens.neutral.divider,
      grey:
        mode === 'dark' && t
          ? {
              50: t.backgroundDefault,
              100: t.backgroundPaper,
              200: '#2a2a2a',
              300: '#3a3a3a',
              400: '#525252',
              500: '#6b7280',
              600: '#8b949e',
              700: '#a1a1aa',
              800: '#c5c5d2',
              900: '#e4e4ef',
            }
          : undefined,
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
              ? (t?.cardShadow || '0 2px 8px rgba(0,0,0,0.7)') 
              : designTokens.shadows.md,
            transition: designTokens.transitions.short,
            '&:hover': {
              boxShadow: mode === 'dark'
                ? (t?.cardShadowHover || '0 4px 16px rgba(0,0,0,0.9)')
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
