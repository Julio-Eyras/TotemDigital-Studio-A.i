import { alpha, Theme } from '@mui/material/styles';

export type DisabledVisualState = 'default' | 'disabled-local' | 'disabled-global';

export function getDisabledContainerSx(theme: Theme, state: DisabledVisualState) {
  if (state === 'disabled-global') {
    return {
      borderLeft: `5px solid ${theme.palette.warning.main}`,
      backgroundColor: alpha(theme.palette.warning.main, 0.2),
      boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.warning.main, 0.18)}`,
    };
  }

  if (state === 'disabled-local') {
    return {
      borderLeft: `5px solid ${alpha(theme.palette.warning.main, 0.65)}`,
      backgroundColor: alpha(theme.palette.warning.light, 0.18),
      boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.warning.main, 0.1)}`,
    };
  }

  return {
    borderLeft: '5px solid transparent',
  };
}

export function getDisabledTextColor(theme: Theme, state: DisabledVisualState) {
  if (state === 'disabled-global') return theme.palette.warning.dark;
  if (state === 'disabled-local') return theme.palette.warning.main;
  return theme.palette.text.secondary;
}
