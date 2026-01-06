import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  useTheme,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  VideoLibrary,
  PlaylistPlay,
  Campaign,
  TrendingUp,
  Add,
  Business,
  CheckCircle,
  Warning,
  Schedule,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { mediaApi, subscriberAccessApi, AccessiblePublisher, campaignApi, playlistApi } from '../../services/api';

const SubscriberDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const subscriberId = user?.subscriberId || user?.clientId;
  
  const [stats, setStats] = useState({
    totalMedia: 0,
    totalPlaylists: 0,
    totalCampaigns: 0,
  });
  const [accessiblePublishers, setAccessiblePublishers] = useState<AccessiblePublisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subscriberId) {
      loadStats();
      loadAccessiblePublishers();
    }
  }, [subscriberId]);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Carregar estatísticas de mídia
      const mediaResponse = await mediaApi.getAll({ limit: 1 });
      
      // Carregar estatísticas de campanhas
      const campaignsResponse = await campaignApi.getAll({ subscriberId });
      
      // Carregar estatísticas de playlists
      const playlistsResponse = await playlistApi.getAll({ subscriberId });
      
      setStats({
        totalMedia: mediaResponse.total || 0,
        totalCampaigns: campaignsResponse.total || 0,
        totalPlaylists: playlistsResponse.total || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      setError('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const loadAccessiblePublishers = async () => {
    if (!subscriberId) return;
    
    try {
      const publishers = await subscriberAccessApi.getAccessiblePublishers(subscriberId);
      setAccessiblePublishers(publishers);
    } catch (error) {
      console.error('Erro ao carregar publishers acessíveis:', error);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30; // Expira em 30 dias ou menos
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
          Área do Anunciante
        </Typography>
        <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
          Bem-vindo, {user?.subscriberName || user?.name || 'Anunciante'}
        </Typography>
        {user?.subscriberId && (
          <Chip
            label={`Subscriber ID: ${user.subscriberId}`}
            size="small"
            color="primary"
            sx={{ mt: 1 }}
          />
        )}
        {accessiblePublishers.length > 0 && (
          <Chip
            icon={<Business />}
            label={`${accessiblePublishers.length} Publisher(s) Acessível(is)`}
            size="small"
            color="success"
            sx={{ mt: 1, ml: 1 }}
          />
        )}
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats.totalMedia}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Mídias
                  </Typography>
                </Box>
                <VideoLibrary sx={{ fontSize: 48, color: theme.palette.primary.main, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats.totalPlaylists}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Playlists
                  </Typography>
                </Box>
                <PlaylistPlay sx={{ fontSize: 48, color: theme.palette.secondary.main, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats.totalCampaigns}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Campanhas
                  </Typography>
                </Box>
                <Campaign sx={{ fontSize: 48, color: theme.palette.success.main, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Ações Rápidas
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/subscriber/media')}
                sx={{ py: 1.5 }}
              >
                Adicionar Mídia
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<VideoLibrary />}
                onClick={() => navigate('/subscriber/media')}
                sx={{ py: 1.5 }}
              >
                Ver Mídias
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PlaylistPlay />}
                onClick={() => navigate('/playlists')}
                sx={{ py: 1.5 }}
              >
                Ver Playlists
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<TrendingUp />}
                onClick={() => navigate('/analytics')}
                sx={{ py: 1.5 }}
              >
                Ver Analytics
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Alertas de Acessos Expirando */}
      {accessiblePublishers.some(p => isExpiringSoon(p.expires_at) || isExpired(p.expires_at)) && (
        <Card sx={{ mb: 3, border: `2px solid ${theme.palette.warning.main}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Warning sx={{ color: theme.palette.warning.main, mr: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.warning.main }}>
                Alertas de Acesso
              </Typography>
            </Box>
            {accessiblePublishers
              .filter(p => isExpiringSoon(p.expires_at) || isExpired(p.expires_at))
              .map((publisher) => (
                <Alert
                  key={publisher.publisher_id}
                  severity={isExpired(publisher.expires_at) ? 'error' : 'warning'}
                  sx={{ mb: 1 }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {publisher.publisher_name}
                  </Typography>
                  <Typography variant="caption">
                    {isExpired(publisher.expires_at)
                      ? `Acesso expirado em ${formatDate(publisher.expires_at)}`
                      : `Acesso expira em ${formatDate(publisher.expires_at)} (${Math.ceil(
                          (new Date(publisher.expires_at!).getTime() - new Date().getTime()) /
                            (1000 * 60 * 60 * 24)
                        )} dias)`}
                  </Typography>
                </Alert>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Publishers Acessíveis */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Publishers Acessíveis
          </Typography>
          {loading ? (
            <LinearProgress />
          ) : accessiblePublishers.length === 0 ? (
            <Alert severity="info">
              Nenhum publisher acessível encontrado. Verifique seu contrato e plano.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Publisher</strong></TableCell>
                    <TableCell><strong>Tipo de Acesso</strong></TableCell>
                    <TableCell><strong>Plano</strong></TableCell>
                    <TableCell><strong>Contrato</strong></TableCell>
                    <TableCell><strong>Expira em</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accessiblePublishers.map((publisher) => (
                    <TableRow key={publisher.publisher_id}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {publisher.publisher_name}
                          </Typography>
                          {publisher.publisher_email && (
                            <Typography variant="caption" color="text.secondary">
                              {publisher.publisher_email}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={publisher.access_type}
                          size="small"
                          color={publisher.access_type === 'override' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{publisher.plan_name || '-'}</TableCell>
                      <TableCell>{publisher.contract_id ? `#${publisher.contract_id}` : '-'}</TableCell>
                      <TableCell>
                        {publisher.expires_at ? (
                          <Chip
                            label={formatDate(publisher.expires_at)}
                            size="small"
                            color={
                              isExpired(publisher.expires_at) 
                                ? 'error' 
                                : isExpiringSoon(publisher.expires_at)
                                ? 'warning'
                                : 'default'
                            }
                            icon={
                              isExpired(publisher.expires_at) 
                                ? <Warning /> 
                                : isExpiringSoon(publisher.expires_at)
                                ? <Schedule />
                                : <CheckCircle />
                            }
                          />
                        ) : (
                          <Chip label="Sem expiração" size="small" color="success" icon={<CheckCircle />} />
                        )}
                      </TableCell>
                      <TableCell>
                        {isExpired(publisher.expires_at) ? (
                          <Chip label="Expirado" size="small" color="error" />
                        ) : isExpiringSoon(publisher.expires_at) ? (
                          <Tooltip title="Expira em breve">
                            <Chip label="Expirando" size="small" color="warning" />
                          </Tooltip>
                        ) : (
                          <Chip label="Ativo" size="small" color="success" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Informações do Subscriber
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                Nome do Subscriber
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {user?.subscriberName || user?.name || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                ID do Subscriber
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {user?.subscriberId || user?.clientId || 'N/A'}
              </Typography>
            </Grid>
            {user?.publisherId && (
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  ID do Publisher
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {user.publisherId}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mt: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default SubscriberDashboard;

