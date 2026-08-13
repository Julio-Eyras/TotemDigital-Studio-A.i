/**
 * Copyright (c) 2026 Julio Cesar Eyras (J.C.E.)
 * Eyras Sistemas e Soluções — Todos os direitos reservados.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Business,
  CheckCircle,
  Close,
  LocationOn,
  PhotoLibrary,
  RadioButtonUnchecked,
  Tv,
} from '@mui/icons-material';
import {
  DIRECT_FIRST_PUBLISH_DISMISS_KEY,
  DirectFirstPublishSnapshot,
  DirectFirstPublishStep,
  buildDirectFirstPublishSteps,
  directFirstPublishProgress,
} from '../../utils/directFirstPublishChecklist';

const STEP_ICONS: Record<DirectFirstPublishStep['id'], React.ReactElement> = {
  org: <Business fontSize="small" />,
  local: <LocationOn fontSize="small" />,
  totem: <Tv fontSize="small" />,
  media: <PhotoLibrary fontSize="small" />,
  publish: <Tv fontSize="small" />,
};

export interface DirectFirstPublishChecklistProps {
  snapshot: DirectFirstPublishSnapshot;
  onCreateTotem?: () => void;
}

export const DirectFirstPublishChecklist: React.FC<DirectFirstPublishChecklistProps> = ({
  snapshot,
  onCreateTotem,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DIRECT_FIRST_PUBLISH_DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const steps = useMemo(() => buildDirectFirstPublishSteps(snapshot), [snapshot]);
  const progress = useMemo(() => directFirstPublishProgress(steps), [steps]);

  if (dismissed || progress.allComplete) {
    return null;
  }

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DIRECT_FIRST_PUBLISH_DISMISS_KEY, '1');
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true);
  };

  const handleGo = (step: DirectFirstPublishStep) => {
    if (step.id === 'totem' && onCreateTotem) {
      onCreateTotem();
      return;
    }
    if (step.path === '/publish-totem') {
      return;
    }
    navigate(step.path);
  };

  return (
    <Card
      sx={{
        mb: 3,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
        bgcolor: alpha(theme.palette.primary.main, 0.04),
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Primeira publicação
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {progress.completedCount} de {progress.total} etapas — Direct Totem, em minutos.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {progress.nextStep && (
              <Button variant="contained" size="small" onClick={() => handleGo(progress.nextStep!)}>
                Continuar: {progress.nextStep.label}
              </Button>
            )}
            <IconButton size="small" aria-label="Dispensar checklist" onClick={handleDismiss}>
              <Close fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress.percent}
          sx={{ height: 6, borderRadius: 999, mb: 2 }}
        />
        <Stack spacing={1.5}>
          {steps.map((step) => (
            <Box
              key={step.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1.25,
                borderRadius: 1,
                bgcolor: step.complete
                  ? alpha(theme.palette.success.main, 0.08)
                  : alpha(theme.palette.warning.main, 0.06),
              }}
            >
              <Box
                sx={{
                  color: step.complete ? theme.palette.success.main : theme.palette.text.secondary,
                  mt: 0.25,
                }}
              >
                {step.complete ? <CheckCircle fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.75 }}
                >
                  {STEP_ICONS[step.id]}
                  {step.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
              </Box>
              {!step.complete && (
                <Button size="small" variant="outlined" onClick={() => handleGo(step)}>
                  Ir
                </Button>
              )}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default DirectFirstPublishChecklist;
