/**
 * Dashboard Page - Smart Signage v2.1
 * Página principal com visão geral do sistema
 * Refatorado para usar PageHeader e componentes do Design System
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  PlayCircleOutline,
  People,
  VideoLibrary,
  QueueMusic,
  Computer,
  Refresh,
  MoreVert,
  CheckCircle,
  Warning,
  Error,
} from '@mui/icons-material';
import { dashboardApi } from '../../services/api';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';

interface DashboardStats {
  totalMedia: number;
  totalPlaylists: number;
  totalPlayers: number;
  totalUsers: number;
  activePlayers: number;
  offlinePlayers: number;
}

interface RecentActivity {
  id: string;
  type: 'upload' | 'playlist' | 'player' | 'user' | 'client';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const breadcrumbs = useBreadcrumbs();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
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
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
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
        title="Dashboard"
        subtitle="Visão geral do sistema"
        breadcrumbs={breadcrumbs}
        onRefresh={loadDashboardData}
        loading={loading}
        actions={[
          {
            label: 'Atualizar',
            icon: <Refresh />,
            onClick: loadDashboardData,
            variant: 'outlined',
          },
        ]}
      />

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Total de Mídias
                  </Typography>
                  <Typography variant="h4">
                    {stats?.totalMedia || 0}
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                  }}
                >
                  <VideoLibrary />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Total de Playlists
                  </Typography>
                  <Typography variant="h4">
                    {stats?.totalPlaylists || 0}
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    color: theme.palette.secondary.main,
                  }}
                >
                  <QueueMusic />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Players Ativos
                  </Typography>
                  <Typography variant="h4">
                    {stats?.activePlayers || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    de {stats?.totalPlayers || 0} total
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    color: theme.palette.success.main,
                  }}
                >
                  <Computer />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Total de Usuários
                  </Typography>
                  <Typography variant="h4">
                    {stats?.totalUsers || 0}
                  </Typography>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    color: theme.palette.info.main,
                  }}
                >
                  <People />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
                  {activities.slice(0, 5).map((activity, index) => (
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
                      {index < activities.length - 1 && <Divider variant="inset" component="li" />}
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
                Status do Sistema
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <List>
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
                <Divider variant="inset" component="li" />
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: stats?.offlinePlayers && stats.offlinePlayers > 0 ? theme.palette.warning.main : theme.palette.success.main }}>
                      {stats?.offlinePlayers && stats.offlinePlayers > 0 ? <Warning /> : <CheckCircle />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Players"
                    secondary={
                      stats?.offlinePlayers && stats.offlinePlayers > 0
                        ? `${stats.offlinePlayers} player(s) offline`
                        : 'Todos os players online'
                    }
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
