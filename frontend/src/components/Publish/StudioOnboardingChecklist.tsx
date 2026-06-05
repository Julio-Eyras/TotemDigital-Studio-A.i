import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  People,
  Description,
  Tv,
  PlayCircleOutline,
} from '@mui/icons-material';
interface OnboardingStats {
  totalPlayers?: number;
  advertiserOverview?: {
    totalSubscribers?: number;
    activeSubscribers?: number;
  };
  commercialOverview?: {
    totalScreens?: number;
    recentPublications?: number;
    activeCampaigns?: number;
  };
}

interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  complete: boolean;
  path: string;
  icon: React.ReactElement;
}

export interface StudioOnboardingChecklistProps {
  stats: OnboardingStats | null;
}

export const StudioOnboardingChecklist: React.FC<StudioOnboardingChecklistProps> = ({ stats }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const advertiser = stats?.advertiserOverview;
  const commercial = stats?.commercialOverview;

  const steps: OnboardingStep[] = useMemo(
    () => [
      {
        key: 'anunciante',
        label: 'Cadastrar anunciante',
        description: 'Crie pelo menos um cliente para publicar conteúdo.',
        complete: (advertiser?.totalSubscribers ?? 0) > 0,
        path: '/subscribers',
        icon: <People />,
      },
      {
        key: 'contrato',
        label: 'Ativar contrato',
        description: 'Vincule um plano ativo ao anunciante.',
        complete: (advertiser?.activeSubscribers ?? 0) > 0,
        path: '/subscriber-contracts',
        icon: <Description />,
      },
      {
        key: 'tela',
        label: 'Configurar tela',
        description: 'Cadastre totens ou TVs para exibir o conteúdo.',
        complete: (commercial?.totalScreens ?? stats?.totalPlayers ?? 0) > 0,
        path: '/totems',
        icon: <Tv />,
      },
      {
        key: 'publicacao',
        label: 'Primeira publicação',
        description: 'Publique uma campanha ou conteúdo em tela.',
        complete:
          (commercial?.recentPublications ?? 0) > 0 || (commercial?.activeCampaigns ?? 0) > 0,
        path: '/quick-publish',
        icon: <PlayCircleOutline />,
      },
    ],
    [advertiser, commercial, stats?.totalPlayers]
  );

  const completedCount = steps.filter((s) => s.complete).length;
  const allComplete = completedCount === steps.length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const nextStep = steps.find((s) => !s.complete);

  if (allComplete || !stats) {
    return null;
  }

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
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Primeiros passos no Estúdio
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {completedCount} de {steps.length} etapas concluídas — siga a ordem sugerida para publicar na tela.
            </Typography>
          </Box>
          {nextStep && (
            <Button variant="contained" size="small" onClick={() => navigate(nextStep.path)}>
              Continuar: {nextStep.label}
            </Button>
          )}
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 6, borderRadius: 999, mb: 2 }}
        />
        <Stack spacing={1.5}>
          {steps.map((step) => (
            <Box
              key={step.key}
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
                <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {step.icon}
                  {step.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
              </Box>
              {!step.complete && (
                <Button size="small" variant="outlined" onClick={() => navigate(step.path)}>
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

export default StudioOnboardingChecklist;
