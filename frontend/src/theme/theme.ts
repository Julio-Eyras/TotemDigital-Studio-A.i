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
      ...(mode === 'dark' && t
        ? {
            grey: {
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
            },
          }
        : {}),
    },
    typography: {
      fontFamily: designTokens.typography.fontFamily,
      fontSize: 13,
      h1: {
        fontSize: '1.75rem',
        lineHeight: 1.2,
        fontWeight: 700,
      },
      h2: {
        fontSize: '1.375rem',
        lineHeight: 1.25,
        fontWeight: 600,
      },
      h3: {
        fontSize: '1.125rem',
        lineHeight: 1.3,
        fontWeight: 600,
      },
      h4: {
        fontSize: '1rem',
        lineHeight: 1.35,
        fontWeight: 500,
      },
      h5: {
        fontSize: '0.9375rem',
        lineHeight: 1.35,
        fontWeight: 500,
      },
      h6: {
        fontSize: '0.875rem',
        lineHeight: 1.35,
        fontWeight: 600,
      },
      subtitle1: {
        fontSize: '0.875rem',
        lineHeight: 1.4,
        fontWeight: 500,
      },
      subtitle2: {
        fontSize: '0.75rem',
        lineHeight: 1.4,
        fontWeight: 600,
      },
      body1: {
        fontSize: '0.8125rem',
        lineHeight: 1.45,
        fontWeight: 400,
      },
      body2: {
        fontSize: '0.75rem',
        lineHeight: 1.45,
        fontWeight: 400,
      },
      button: {
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'none',
      },
      caption: {
        fontSize: '0.6875rem',
        lineHeight: 1.35,
        fontWeight: 400,
      },
    },
    shape: {
      borderRadius: designTokens.borderRadius.md,
    },
    spacing: 4, // Base spacing unit (4px)
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontSize: '0.8125rem',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: designTokens.borderRadius.md,
            padding: '5px 12px',
            transition: designTokens.transitions.short,
          },
          sizeSmall: {
            padding: '3px 8px',
            fontSize: '0.6875rem',
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: 48,
            '@media (min-width: 0px)': {
              minHeight: 48,
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 40,
            padding: '6px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
          },
        },
      },
      MuiListItemButton: {
        defaultProps: {
          dense: true,
        },
        styleOverrides: {
          root: {
            paddingTop: 5,
            paddingBottom: 5,
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 34,
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
        defaultProps: {
          size: 'small',
        },
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontWeight: 600,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: '6px 8px',
            fontSize: '0.75rem',
            lineHeight: 1.3,
          },
          head: {
            padding: '7px 8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            fontSize: '0.8125rem',
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: '0.8125rem',
          },
        },
      },
    },
  };

  return createTheme(themeOptions);
};
