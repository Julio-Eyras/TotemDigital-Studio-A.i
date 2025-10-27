import React from 'react';
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
  Avatar,
} from '@mui/material';
import {
  People,
  Business,
  Devices,
  VideoLibrary,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Error,
  Warning,
} from '@mui/icons-material';

export const Dashboard: React.FC = () => {
  // Mock data - em produção, isso viria da API
  const stats = [
    {
      title: 'Total de Usuários',
      value: '24',
      change: '+12%',
      trend: 'up',
      icon: <People />,
      color: '#1976d2',
    },
    {
      title: 'Clientes Ativos',
      value: '8',
      change: '+5%',
      trend: 'up',
      icon: <Business />,
      color: '#388e3c',
    },
    {
      title: 'Totems Online',
      value: '15',
      change: '-2%',
      trend: 'down',
      icon: <Devices />,
      color: '#f57c00',
    },
    {
      title: 'Arquivos de Mídia',
      value: '1,247',
      change: '+23%',
      trend: 'up',
      icon: <VideoLibrary />,
      color: '#7b1fa2',
    },
  ];

  const recentActivities = [
    {
      id: 1,
      type: 'success',
      message: 'Novo usuário criado: João Silva',
      time: '2 minutos atrás',
    },
    {
      id: 2,
      type: 'info',
      message: 'Campanha "Black Friday" ativada',
      time: '15 minutos atrás',
    },
    {
      id: 3,
      type: 'warning',
      message: 'Totem #003 está offline há 2 horas',
      time: '1 hora atrás',
    },
    {
      id: 4,
      type: 'success',
      message: 'Upload de 5 arquivos de mídia concluído',
      time: '2 horas atrás',
    },
    {
      id: 5,
      type: 'error',
      message: 'Falha na sincronização do Totem #007',
      time: '3 horas atrás',
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      default:
        return <TrendingUp color="info" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${stat.color}15 0%, ${stat.color}05 100%)`,
                border: `1px solid ${stat.color}30`,
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar
                    sx={{
                      backgroundColor: stat.color,
                      mr: 2,
                    }}
                  >
                    {stat.icon}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h4" component="div" sx={{ fontWeight: 600 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {stat.trend === 'up' ? (
                    <TrendingUp color="success" sx={{ mr: 1 }} />
                  ) : (
                    <TrendingDown color="error" sx={{ mr: 1 }} />
                  )}
                  <Typography
                    variant="body2"
                    color={stat.trend === 'up' ? 'success.main' : 'error.main'}
                    sx={{ fontWeight: 500 }}
                  >
                    {stat.change}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Activities */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Atividades Recentes
            </Typography>
            <List>
              {recentActivities.map((activity) => (
                <ListItem key={activity.id} sx={{ px: 0 }}>
                  <ListItemIcon>
                    {getActivityIcon(activity.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={activity.message}
                    secondary={activity.time}
                  />
                  <Chip
                    label={activity.type}
                    size="small"
                    color={getActivityColor(activity.type) as any}
                    variant="outlined"
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* System Status */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Status do Sistema
            </Typography>
            <List>
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="API Backend"
                  secondary="Online"
                />
                <Chip label="OK" color="success" size="small" />
              </ListItem>
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Banco de Dados"
                  secondary="Conectado"
                />
                <Chip label="OK" color="success" size="small" />
              </ListItem>
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Serviços de IA"
                  secondary="Ativo"
                />
                <Chip label="OK" color="success" size="small" />
              </ListItem>
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon>
                  <Warning color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary="Armazenamento"
                  secondary="85% usado"
                />
                <Chip label="ALERTA" color="warning" size="small" />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
