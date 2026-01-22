/**
 * Design System Tokens - SmartSignage Pro v2.1
 * Tokens de design centralizados para consistência visual
 */

export const designTokens = {
  // Cores de Status
  status: {
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#2196f3',
    default: '#9e9e9e',
  },

  // Cores Primárias
  primary: {
    main: '#1976d2',
    dark: '#1565c0',
    light: '#42a5f5',
  },

  // Cores Secundárias
  secondary: {
    main: '#dc004e',
    dark: '#c51162',
    light: '#ff5983',
  },

  // Cores Neutras
  neutral: {
    background: '#f5f5f5',
    surface: '#ffffff',
    textPrimary: '#212121',
    textSecondary: '#757575',
    divider: '#e0e0e0',
    border: '#e0e0e0',
  },

  // Espaçamento (base: 4px)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // Tipografia
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '32px',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '24px',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '18px',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    bodyLarge: {
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    bodyMedium: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    bodySmall: {
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '10px',
      fontWeight: 400,
      lineHeight: 1.4,
    },
  },

  // Sombras
  shadows: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 2px 8px rgba(0,0,0,0.1)',
    lg: '0 4px 16px rgba(0,0,0,0.15)',
    xl: '0 8px 24px rgba(0,0,0,0.2)',
  },

  // Border Radius
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: '50%',
  },

  // Transições
  transitions: {
    short: '150ms ease-in-out',
    medium: '250ms ease-in-out',
    long: '350ms ease-in-out',
  },

  // Z-Index Layers
  zIndex: {
    drawer: 1200,
    modal: 1300,
    snackbar: 1400,
    tooltip: 1500,
  },
} as const;

export type DesignTokens = typeof designTokens;
