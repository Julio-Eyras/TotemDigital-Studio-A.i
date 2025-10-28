import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  IconButton,
  Button,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Upload,
  People,
  Devices,
  TrendingUp,
  Schedule,
  Warning,
  CheckCircle,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

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
  type: 'upload' | 'playlist' | 'player' | 'user';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

export const Dashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [stats, setStats] = useState<DashboardStats>({
    totalMedia: 0,
    totalPlaylists: 0,
    totalPlayers: 0,
    totalUsers: 0,
    activePlayers: 0,
    offlinePlayers: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Simular carregamento de dados (substituir por chamadas reais da API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStats({
        totalMedia: 24,
        totalPlaylists: 8,
        totalPlayers: 12,
        totalUsers: 5,
        activePlayers: 10,
        offlinePlayers: 2,
      });

      setRecentActivity([
        {
          id: '1',
          type: 'upload',
          message: 'Novo vídeo "Promoção Verão" enviado',
          timestamp: '2 minutos atrás',
          status: 'success',
        },
        {
          id: '2',
          type: 'player',
          message: 'Player "Loja Centro" ficou offline',
          timestamp: '15 minutos atrás',
          status: 'warning',
        },
        {
          id: '3',
          type: 'playlist',
          message: 'Playlist "Horário Comercial" atualizada',
          timestamp: '1 hora atrás',
          status: 'success',
        },
        {
          id: '4',
          type: 'user',
          message: 'Novo usuário "João Silva" cadastrado',
          timestamp: '2 horas atrás',
          status: 'success',
        },
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'upload': return <Upload />;
      case 'playlist': return <Schedule />;
      case 'player': return <Devices />;
      case 'user': return <People />;
      default: return <CheckCircle />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Carregando Dashboard...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard - Smart Signage Pro
      </Typography>
      
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        Bem-vindo, {user?.name || 'Usuário'}!
      </Typography>

      {/* Estatísticas */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Upload color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Mídia</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {stats.totalMedia}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Arquivos cadastrados
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Schedule color="secondary" sx={{ mr: 1 }} />
                <Typography variant="h6">Playlists</Typography>
              </Box>
              <Typography variant="h4" color="secondary">
                {stats.totalPlaylists}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Listas de reprodução
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Devices color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Players</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {stats.activePlayers}/{stats.totalPlayers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Online/Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <People color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">Usuários</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {stats.totalUsers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Usuários cadastrados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Status dos Players */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Status dos Players
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Chip
                icon={<CheckCircle />}
                label={`${stats.activePlayers} Online`}
                color="success"
                variant="outlined"
              />
              <Chip
                icon={<Warning />}
                label={`${stats.offlinePlayers} Offline`}
                color="warning"
                variant="outlined"
              />
            </Box>
            <Button variant="outlined" size="small">
              Ver Detalhes
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Ações Rápidas
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" startIcon={<Upload />} size="small">
                Upload Mídia
              </Button>
              <Button variant="outlined" startIcon={<Schedule />} size="small">
                Nova Playlist
              </Button>
              <Button variant="outlined" startIcon={<Devices />} size="small">
                Gerenciar Players
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Atividades Recentes */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Atividades Recentes
        </Typography>
        <List>
          {recentActivity.map((activity) => (
            <ListItem key={activity.id} divider>
              <ListItemIcon>
                {getActivityIcon(activity.type)}
              </ListItemIcon>
              <ListItemText
                primary={activity.message}
                secondary={activity.timestamp}
              />
              <Chip
                label={activity.status}
                color={getStatusColor(activity.status) as any}
                size="small"
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
};