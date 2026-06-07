/**
 * Dashboard Page - Smart Signage v2.1
 * Página principal com visão geral do sistema
 * Refatorado para usar PageHeader e componentes do Design System
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Tooltip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  useTheme,
  alpha,
  Stack,
} from '@mui/material';
import {
  Add,
  AutoAwesome,
  Business,
  Campaign,
  PlayCircleOutline,
  People,
  VideoLibrary,
  QueueMusic,
  Computer,
  Refresh,
  Storefront,
  Tv,
  CheckCircle,
  Warning,
  StayCurrentPortrait,
  StayCurrentLandscape,
  Payment,
} from '@mui/icons-material';
import { dashboardApi, otaApi, publishTemplatesApi } from '../../services/api';
import type { QuickPublishPreset } from '../../services/api';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { isStudioMode } from '../../config/studioMode';
import {DASHBOARD_COMMERCIAL_FOCUS} from '../../config/featureFlags';
import {
  FEATURED_TEMPLATES,
  FEATURED_SEGMENT_CHIPS,
  defaultSegmentForPreset,
  findPublishPreset,
} from '../../config/publishTemplates';
import { TemplatePreviewStrip } from '../../components/Publish/TemplatePreviewStrip';
import { StudioOnboardingChecklist } from '../../components/Publish/StudioOnboardingChecklist';

interface AdvertiserOverviewStats {
  totalSubscribers: number;
  activeSubscribers: number;
  inactiveSubscribers: number;
  totalMedias: number;
  totalPlaylists: number;
  totalCampaigns: number;
}

interface CommercialOverviewStats {
  totalScreens: number;
  onlineScreens: number;
  offlineScreens: number;
  activeCampaigns: number;
  recentPublications: number;
  pendingActivations: number;
}

interface DashboardStats {
  totalMedia: number;
  totalPlaylists: number;
  totalPlayers: number;
  totalUsers: number;
  activePlayers: number;
  offlinePlayers: number;
  commercialOverview?: CommercialOverviewStats;
  advertiserOverview?: AdvertiserOverviewStats;
}

interface RecentActivity {
  id: string;
  type: 'upload' | 'playlist' | 'player' | 'user' | 'client';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

const EMPTY_COMMERCIAL_OVERVIEW: CommercialOverviewStats = {
  totalScreens: 0,
  onlineScreens: 0,
  offlineScreens: 0,
  activeCampaigns: 0,
  recentPublications: 0,
  pendingActivations: 0,
};

const FEATURED_ICON_MAP = {
  storefront: <Storefront />,
  campaign: <Campaign />,
  tv: <Tv />,
  auto_awesome: <AutoAwesome />,
  business: <Business />,
} as const;

function getCommercialOverview(stats: DashboardStats | null): CommercialOverviewStats {
  if (stats?.commercialOverview) {
    return stats.commercialOverview;
  }

  return {
    ...EMPTY_COMMERCIAL_OVERVIEW,
    totalScreens: stats?.totalPlayers || 0,
    onlineScreens: stats?.activePlayers || 0,
    offlineScreens: stats?.offlinePlayers || 0,
  };
}

function getOnlinePercentage(overview: CommercialOverviewStats): number {
  if (overview.totalScreens <= 0) {
    return 0;
  }

  return Math.round((overview.onlineScreens / overview.totalScreens) * 100);
}

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumbs();
  /** Compacto sempre comercial; Pro pode ativar REACT_APP_DASHBOARD_COMMERCIAL_FOCUS. */
  const dashboardCommercialFocus = isStudioMode() || DASHBOARD_COMMERCIAL_FOCUS;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataAsOf, setDataAsOf] = useState('');
  const [featuredTemplates, setFeaturedTemplates] = useState(FEATURED_TEMPLATES);
  const [otaPendingCount, setOtaPendingCount] = useState(0);
  const commercialOverview = getCommercialOverview(stats);
  const onlinePercentage = getOnlinePercentage(commercialOverview);
  const activeClients = stats?.advertiserOverview?.activeSubscribers || 0;
  const hasCommercialAlerts = commercialOverview.offlineScreens > 0 || commercialOverview.pendingActivations > 0;
  const commercialCards = [
    {
      label: 'Telas online',
      value: commercialOverview.onlineScreens,
      helper: `de ${commercialOverview.totalScreens} tela(s) cadastrada(s)`,
      icon: <Computer />,
      color: theme.palette.success.main,
    },
    {
      label: 'Telas offline',
      value: commercialOverview.offlineScreens,
      helper: commercialOverview.offlineScreens > 0 ? 'precisam de atenção' : 'operação estável',
      icon: <Warning />,
      color: commercialOverview.offlineScreens > 0 ? theme.palette.warning.main : theme.palette.success.main,
    },
    {
      label: 'Publicações recentes',
      value: commercialOverview.recentPublications,
      helper: 'campanhas atualizadas nos últimos 7 dias',
      icon: <PlayCircleOutline />,
      color: theme.palette.primary.main,
    },
    {
      label: 'Campanhas ativas',
      value: commercialOverview.activeCampaigns,
      helper: 'conteúdo em veiculação',
      icon: <Campaign />,
      color: theme.palette.info.main,
    },
    {
      label: 'Clientes ativos',
      value: activeClients,
      helper: stats?.advertiserOverview ? 'anunciantes ativos' : 'escopo atual',
      icon: <People />,
      color: theme.palette.secondary.main,
    },
    {
      label: 'Ativações pendentes',
      value: commercialOverview.pendingActivations,
      helper: commercialOverview.pendingActivations > 0 ? 'telas aguardando ativação' : 'nenhuma pendência',
      icon: <Tv />,
      color: commercialOverview.pendingActivations > 0 ? theme.palette.warning.main : theme.palette.success.main,
    },
  ];
  const openQuickPublish = (
    presetValue?: QuickPublishPreset,
    segmentValue?: string,
    orientation?: 'portrait' | 'landscape'
  ) => {
    const params = new URLSearchParams();
    if (presetValue) params.set('preset', presetValue);
    if (segmentValue) params.set('segment', segmentValue);
    if (orientation) params.set('orientation', orientation);
    const queryString = params.toString();
    navigate(queryString ? `/quick-publish?${queryString}` : '/quick-publish');
  };
  const openPublishBoard = (
    presetValue: QuickPublishPreset,
    segmentValue?: string,
    orientation?: 'portrait' | 'landscape'
  ) => {
    const params = new URLSearchParams({
      preset: presetValue,
      segment: segmentValue || defaultSegmentForPreset(presetValue),
    });
    if (orientation) params.set('orientation', orientation);
    params.set('mode', 'create');
    navigate(`/quick-publish?${params.toString()}`);
  };
  const openTotems = (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const queryString = params.toString();
    navigate(queryString ? `/totems?${queryString}` : '/totems');
  };

  useEffect(() => {
    loadDashboardData();
    publishTemplatesApi.getFeatured().then((res) => {
      const rows = res.data || [];
      if (rows.length > 0) {
        setFeaturedTemplates(
          rows.map((row) => ({
            value: row.preset,
            segment: row.segment || 'retail',
            title: row.title,
            description: row.description || '',
            iconKey: (row.iconKey as keyof typeof FEATURED_ICON_MAP) || 'campaign',
          }))
        );
      }
    }).catch(() => undefined);
    otaApi.getStats().then((res) => {
      const pending =
        (res.data?.totems?.updateAvailable || 0) +
        (res.data?.totems?.downloading || 0) +
        (res.data?.totems?.installing || 0);
      setOtaPendingCount(pending);
    }).catch(() => undefined);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, activitiesData] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getRecentActivity()
      ]);
      
      setStats(statsData);
      setActivities(Array.isArray(activitiesData) ? activitiesData : []);
      setDataAsOf(new Date().toLocaleString('pt-BR'));
    } catch (error) {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'upload': return <VideoLibrary />;
      case 'playlist': return <QueueMusic />;
      case 'player': return <Computer />;
      case 'user': return <People />;
      case 'client': return <People />;
      default: return <CheckCircle />;
    }
  };

  const getActivityColor = (status: string) => {
    switch (status) {
      case 'success': return theme.palette.success.main;
      case 'warning': return theme.palette.warning.main;
      case 'error': return theme.palette.error.main;
      default: return theme.palette.primary.main;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Dashboard Comercial"
        subtitle={
          dashboardCommercialFocus
            ? 'Telas, publicações e próximos passos — sem termos técnicos na primeira vista.'
            : 'Acompanhe telas, publicações e próximos passos sem abrir módulos técnicos.'
        }
        breadcrumbs={breadcrumbs}
        onRefresh={loadDashboardData}
        loading={loading}
        actions={[
          {
            label: 'Nova publicação',
            icon: <Add />,
            onClick: () => openQuickPublish(),
            variant: 'contained',
          },
          {
            label: 'Atualizar',
            icon: <Refresh />,
            onClick: loadDashboardData,
            variant: 'outlined',
          },
        ]}
      />

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {dashboardCommercialFocus && <StudioOnboardingChecklist stats={stats} />}

      <Card
        sx={{
          mb: 3,
          overflow: 'hidden',
          color: 'common.white',
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.secondary.main} 100%)`,
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={7}>
              <Chip
                label="V3x - publicação rápida"
                size="small"
                sx={{
                  mb: 2,
                  bgcolor: alpha(theme.palette.common.white, 0.18),
                  color: 'common.white',
                }}
              />
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                Publique conteúdo em uma tela em poucos passos.
              </Typography>
              <Typography variant="body1" sx={{ color: alpha(theme.palette.common.white, 0.86), mb: 3 }}>
                Escolha cliente, tela e mídia. O sistema cria os vínculos técnicos por trás para entregar a publicação ao player.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Add />}
                  onClick={() => openQuickPublish()}
                >
                  Nova publicação
                </Button>
                <Button
                  variant="outlined"
                  sx={{ color: 'common.white', borderColor: alpha(theme.palette.common.white, 0.6) }}
                  onClick={() => openTotems()}
                >
                  Ver telas
                </Button>
                {dashboardCommercialFocus && (
                  <Button
                    variant="outlined"
                    startIcon={<Payment />}
                    sx={{ color: 'common.white', borderColor: alpha(theme.palette.common.white, 0.6) }}
                    onClick={() =>
                      navigate('/billing?type=subscriber&view=invoices&dueFilter=overdue')
                    }
                  >
                    Faturas vencidas
                  </Button>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={5}>
              <Card sx={{ bgcolor: alpha(theme.palette.common.white, 0.14), color: 'common.white', boxShadow: 'none' }}>
                <CardContent>
                  <Typography variant="overline" sx={{ color: alpha(theme.palette.common.white, 0.76) }}>
                    Saúde da operação
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>
                    {onlinePercentage}%
                  </Typography>
                  <Typography variant="body2" sx={{ color: alpha(theme.palette.common.white, 0.82), mb: 2 }}>
                    das telas ativas estão online agora
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={onlinePercentage}
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      bgcolor: alpha(theme.palette.common.white, 0.2),
                      '& .MuiLinearProgress-bar': {
                        bgcolor: theme.palette.common.white,
                      },
                    }}
                  />
                  <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: alpha(theme.palette.common.white, 0.78) }}>
                    {commercialOverview.onlineScreens} online / {commercialOverview.offlineScreens} offline
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {commercialCards.map((card) => (
          <Grid item xs={12} sm={6} md={4} key={card.label}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Box>
                    <Typography color="text.secondary" gutterBottom variant="body2">
                      {card.label}
                    </Typography>
                    <Typography variant="h4">{card.value}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {card.helper}
                    </Typography>
                  </Box>
                  <Avatar
                    sx={{
                      bgcolor: alpha(card.color, 0.12),
                      color: card.color,
                    }}
                  >
                    {card.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Templates em destaque
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Comece por um formato comercial e publique na tela pelo fluxo rápido.
                  </Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={() => openQuickPublish()}>
                  Abrir publicação
                </Button>
              </Box>
              <Grid container spacing={2}>
                {featuredTemplates.map((template) => {
                  const presetConfig = findPublishPreset(template.value);
                  return (
                  <Grid item xs={12} sm={6} key={template.title}>
                    <Card
                      variant="outlined"
                      onClick={() =>
                        openPublishBoard(template.value, template.segment, presetConfig.preferredOrientation)
                      }
                      sx={{
                        height: '100%',
                        cursor: 'pointer',
                        transition: 'border-color 160ms ease, transform 160ms ease',
                        '&:hover': {
                          borderColor: theme.palette.primary.main,
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      <CardContent>
                        <TemplatePreviewStrip preset={presetConfig} />
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                        <Avatar
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                            width: 36,
                            height: 36,
                          }}
                        >
                          {FEATURED_ICON_MAP[template.iconKey]}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {template.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {template.description}
                          </Typography>
                          <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.75, fontWeight: 600 }}>
                            Abrir no estúdio visual
                          </Typography>
                          <Button
                            size="small"
                            variant="text"
                            sx={{ mt: 0.5, p: 0, minWidth: 0, textTransform: 'none' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openQuickPublish(template.value, template.segment, presetConfig.preferredOrientation);
                            }}
                          >
                            Publicar direto
                          </Button>
                        </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  );
                })}
              </Grid>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }} alignItems="stretch">
                <Button
                  fullWidth
                  variant="text"
                  size="small"
                  startIcon={<StayCurrentPortrait />}
                  onClick={() => openQuickPublish('menu', 'restaurant', 'portrait')}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  Formato vertical 9:16 (ex.: cardápio em totem)
                </Button>
                <Button
                  fullWidth
                  variant="text"
                  size="small"
                  startIcon={<StayCurrentLandscape />}
                  onClick={() => openQuickPublish('ad', 'retail', 'landscape')}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  Formato horizontal 16:9 (ex.: anúncio em TV)
                </Button>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Segmentos sugeridos (abre publicação rápida com o contexto certo)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {FEATURED_SEGMENT_CHIPS.map((s) => (
                  <Chip
                    key={s.segment}
                    label={s.label}
                    variant="outlined"
                    size="small"
                    onClick={() => openPublishBoard(s.preset, s.segment)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={3} sx={{ height: '100%' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.info.main, 0.12),
                    color: theme.palette.info.main,
                  }}
                >
                  <Campaign />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    No ar agora
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Campanhas e publicações recentes
                  </Typography>
                </Box>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Campanhas ativas
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {commercialOverview.activeCampaigns}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Publicações (7 dias)
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {commercialOverview.recentPublications}
                  </Typography>
                </Grid>
              </Grid>
              <Button
                size="small"
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={() => navigate('/campaigns')}
              >
                Ver campanhas
              </Button>
            </CardContent>
          </Card>
          <Card
            sx={{
              flex: 1,
              border: `1px solid ${alpha(hasCommercialAlerts ? theme.palette.warning.main : theme.palette.success.main, 0.35)}`,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Avatar
                  sx={{
                    bgcolor: alpha(hasCommercialAlerts ? theme.palette.warning.main : theme.palette.success.main, 0.12),
                    color: hasCommercialAlerts ? theme.palette.warning.main : theme.palette.success.main,
                  }}
                >
                  {hasCommercialAlerts ? <Warning /> : <CheckCircle />}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Alertas simples
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Próximas ações operacionais
                  </Typography>
                </Box>
              </Box>
              <List dense disablePadding>
                <ListItem disableGutters>
                  <ListItemText
                    primary={commercialOverview.offlineScreens > 0 ? 'Há telas offline' : 'Telas sem alerta crítico'}
                    secondary={
                      commercialOverview.offlineScreens > 0
                        ? `${commercialOverview.offlineScreens} tela(s) fora da janela de heartbeat`
                        : 'Nenhuma tela offline no momento'
                    }
                  />
                </ListItem>
                <Divider component="li" />
                <ListItem disableGutters>
                  <ListItemText
                    primary={
                      commercialOverview.pendingActivations > 0
                        ? 'Ativações aguardando conclusão'
                        : 'Ativações em dia'
                    }
                    secondary={`${commercialOverview.pendingActivations} tela(s) pendente(s)`}
                  />
                </ListItem>
                {otaPendingCount > 0 && (
                  <>
                    <Divider component="li" />
                    <ListItem disableGutters>
                      <ListItemText
                        primary="Atualização OTA Android pendente"
                        secondary={`${otaPendingCount} totem(ns) com pacote disponível ou em progresso`}
                      />
                      <Button size="small" onClick={() => navigate('/ota-updates')}>
                        Ver OTA
                      </Button>
                    </ListItem>
                  </>
                )}
              </List>
            </CardContent>
          </Card>
          </Stack>
        </Grid>
      </Grid>

      {!dashboardCommercialFocus && (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Resumo operacional
        </Typography>
        <Grid container spacing={2}>
          {[
            { label: 'Mídias', value: stats?.totalMedia || 0, icon: <VideoLibrary />, color: theme.palette.primary.main },
            { label: 'Playlists', value: stats?.totalPlaylists || 0, icon: <QueueMusic />, color: theme.palette.secondary.main },
            { label: 'Players ativos', value: stats?.activePlayers || 0, icon: <Computer />, color: theme.palette.success.main },
            { label: 'Usuários', value: stats?.totalUsers || 0, icon: <People />, color: theme.palette.info.main },
          ].map((item) => (
            <Grid item xs={6} md={3} key={item.label}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {item.label}
                      </Typography>
                      <Typography variant="h6">{item.value}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: alpha(item.color, 0.1), color: item.color, width: 34, height: 34 }}>
                      {item.icon}
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
      )}

      {stats?.advertiserOverview && !dashboardCommercialFocus && (
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              mb: 2,
            }}
          >
            <Tooltip
              title="Resumo operacional de anunciantes. Para contratos, planos e conteúdos por conta, use o botão Gerir anunciantes. Os tetos (limites) por anunciante aplicam-se no backend: primeiro o plano ligado ao contrato ativo (JSON limits); onde o plano não define, entram os defaults do sistema (limits.defaults.*). Valor 0 = sem teto nessa métrica."
              arrow
              enterTouchDelay={0}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, cursor: 'help', borderBottom: '1px dotted', borderColor: 'divider' }}>
                Anunciantes
              </Typography>
            </Tooltip>
            <Button variant="outlined" size="small" onClick={() => navigate('/subscribers')}>
              Gerir anunciantes
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Totais globais na base (não são tetos). Os tetos por anunciante vêm do <strong>contrato ativo</strong> e do <strong>plano</strong> (campo limits); se o plano omitir um limite, usa-se o default em <strong>limits.defaults.*</strong> no sistema — <strong>0</strong> nesses valores significa <strong>sem teto</strong> nessa métrica.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={4} md={2}>
              <Tooltip title="Total de anunciantes cadastrados (todos)." arrow enterTouchDelay={0}>
                <Card variant="outlined" sx={{ cursor: 'help' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">
                      Anunciantes
                    </Typography>
                    <Typography variant="h6">{stats.advertiserOverview.totalSubscribers}</Typography>
                  </CardContent>
                </Card>
              </Tooltip>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Tooltip title="Anunciantes com conta ativa (is_active)." arrow enterTouchDelay={0}>
                <Card variant="outlined" sx={{ cursor: 'help' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">
                      Ativos
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {stats.advertiserOverview.activeSubscribers}
                    </Typography>
                  </CardContent>
                </Card>
              </Tooltip>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Tooltip title="Anunciantes inativos (is_active falso)." arrow enterTouchDelay={0}>
                <Card variant="outlined" sx={{ cursor: 'help' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">
                      Inativos
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                      {stats.advertiserOverview.inactiveSubscribers}
                    </Typography>
                  </CardContent>
                </Card>
              </Tooltip>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Tooltip title="Total de mídias ativas em todo o sistema (soma de todas as contas). Não confundir com o teto de armazenamento por anunciante." arrow enterTouchDelay={0}>
                <Card variant="outlined" sx={{ cursor: 'help' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">
                      Mídias (globais)
                    </Typography>
                    <Typography variant="h6">{stats.advertiserOverview.totalMedias}</Typography>
                  </CardContent>
                </Card>
              </Tooltip>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Tooltip title="Total de playlists ativas em todo o sistema." arrow enterTouchDelay={0}>
                <Card variant="outlined" sx={{ cursor: 'help' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">
                      Playlists (globais)
                    </Typography>
                    <Typography variant="h6">{stats.advertiserOverview.totalPlaylists}</Typography>
                  </CardContent>
                </Card>
              </Tooltip>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Tooltip title="Total de campanhas em todo o sistema (todas as contas)." arrow enterTouchDelay={0}>
                <Card variant="outlined" sx={{ cursor: 'help' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">
                      Campanhas (globais)
                    </Typography>
                    <Typography variant="h6">{stats.advertiserOverview.totalCampaigns}</Typography>
                  </CardContent>
                </Card>
              </Tooltip>
            </Grid>
          </Grid>
        </Box>
      )}

      {stats?.advertiserOverview && dashboardCommercialFocus && (
        <Box sx={{ mb: 3 }}>
          <Card variant="outlined">
            <CardContent
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Clientes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.advertiserOverview.activeSubscribers} ativos de{' '}
                  {stats.advertiserOverview.totalSubscribers} cadastrados
                </Typography>
              </Box>
              <Button variant="contained" size="medium" onClick={() => navigate('/subscribers')}>
                Gerir clientes
              </Button>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Recent Activities */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Atividades Recentes
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {activities.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  Nenhuma atividade recente
                </Typography>
              ) : (
                <List>
                  {activities.slice(0, 5).map((activity, index, visibleActivities) => (
                    <React.Fragment key={activity.id}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar
                            sx={{
                              bgcolor: alpha(getActivityColor(activity.status), 0.1),
                              color: getActivityColor(activity.status),
                            }}
                          >
                            {getActivityIcon(activity.type)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={activity.message}
                          secondary={new Date(activity.timestamp).toLocaleString('pt-BR')}
                        />
                        <Chip
                          label={activity.status}
                          size="small"
                          color={
                            activity.status === 'success'
                              ? 'success'
                              : activity.status === 'error'
                              ? 'error'
                              : 'warning'
                          }
                        />
                      </ListItem>
                      {index < visibleActivities.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {dashboardCommercialFocus ? 'Estado rápido' : 'Status do Sistema'}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <List>
                {dataAsOf && dashboardCommercialFocus && (
                  <>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.15), color: theme.palette.info.main }}>
                          <Refresh />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary="Dados do painel"
                        secondary={`Atualizados em ${dataAsOf}`}
                      />
                    </ListItem>
                    <Divider variant="inset" component="li" />
                  </>
                )}
                {!dashboardCommercialFocus && (
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: theme.palette.success.main }}>
                        <CheckCircle />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="Sistema Operacional"
                      secondary="Todos os serviços funcionando normalmente"
                    />
                  </ListItem>
                )}
                {!dashboardCommercialFocus && <Divider variant="inset" component="li" />}
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: commercialOverview.offlineScreens > 0 ? theme.palette.warning.main : theme.palette.success.main }}>
                      {commercialOverview.offlineScreens > 0 ? <Warning /> : <CheckCircle />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Telas"
                    secondary={
                      commercialOverview.offlineScreens > 0
                        ? `${commercialOverview.offlineScreens} tela(s) offline`
                        : 'Todas as telas online'
                    }
                  />
                </ListItem>
              </List>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                <Button size="small" variant="outlined" onClick={() => openTotems('offline')}>
                  Ver telas offline
                </Button>
                <Button size="small" variant="contained" onClick={() => openTotems('activation_pending')}>
                  Ver ativações
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
