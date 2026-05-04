import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Chip,
  Tooltip,
  LinearProgress,
  useTheme,
} from '@mui/material';
import { Store, Place, Tv } from '@mui/icons-material';
import { getMixOverview, MixGroupOverview } from '../../services/api/playlistMixApi';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const PlaylistMixGroup: React.FC = () => {
  const theme = useTheme();
  const [data, setData] = useState<MixGroupOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getMixOverview();
      setData(result);
    } catch (err: any) {
      console.error('Erro ao carregar overview de mixagem:', err);
      setError(pickApiErrorMessage(err, 'Erro ao carregar overview de mixagem'));
    } finally {
      setLoading(false);
    }
  };

  const totalGroups = data.length;
  const totalTotems = useMemo(
    () => data.reduce((sum, g) => sum + (g.total_totems || 0), 0),
    [data]
  );
  const totalTVs = useMemo(
    () => data.reduce((sum, g) => sum + (g.total_tvs || 0), [0] as any) as number,
    [data]
  );

  const getCampaignColor = (campaignId: number) => {
    const palette = [
      theme.palette.primary.main,
      theme.palette.success.main,
      theme.palette.info.main,
      theme.palette.warning.main,
      theme.palette.error.main,
      theme.palette.secondary.main,
    ];
    const index = campaignId % palette.length;
    return palette[index];
  };

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            Playlist Mix por Grupos (Publisher / Locais)
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Visão agregada de como o tempo de exibição está distribuído entre campanhas em cada publisher/local.
          </Typography>
        </Box>
        <Box>
          <Chip
            icon={<Store fontSize="small" />}
            label={`${totalGroups} grupos • ${totalTotems} totems • ${totalTVs} TVs`}
            color="primary"
          />
        </Box>
      </Box>

      {loading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Carregando overview de mixagem...
          </Typography>
        </Box>
      )}

      {error && (
        <Box sx={{ mb: 2 }}>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </Box>
      )}

      <Grid container spacing={3}>
        {data.map((group) => {
          const groupKey = `${group.publisher_id}-${group.local_id || 'all'}`;
          const totalDuration = group.campaigns.reduce(
            (sum, c) => sum + (c.total_duration || 0),
            0
          );
          const base = totalDuration || 1;

          return (
            <Grid item xs={12} md={6} key={groupKey}>
              <Card>
                <CardHeader
                  avatar={<Store color="primary" />}
                  title={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h6">
                        {group.publisher_name}
                        {group.local_name ? ` • ${group.local_name}` : ''}
                      </Typography>
                    </Box>
                  }
                  subheader={
                    <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                      <Chip
                        size="small"
                        icon={<Tv fontSize="small" />}
                        label={`${group.total_totems} totems`}
                      />
                      <Chip
                        size="small"
                        icon={<Place fontSize="small" />}
                        label={`${group.total_tvs} TVs`}
                      />
                    </Box>
                  }
                />
                <CardContent>
                  {group.campaigns.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma mixagem ativa encontrada para este grupo.
                    </Typography>
                  )}

                  {group.campaigns.length > 0 && (
                    <>
                      {/* Barra agregada de share por campanha */}
                      <Box
                        sx={{
                          display: 'flex',
                          borderRadius: 1,
                          overflow: 'hidden',
                          border: `1px solid ${theme.palette.divider}`,
                          height: 32,
                          mb: 2,
                        }}
                      >
                        {group.campaigns.map((c) => {
                          const share = c.share_percent ?? ((c.total_duration || 0) / base) * 100;
                          if (!share || share <= 0) return null;
                          const color = getCampaignColor(c.campaign_id);
                          return (
                            <Tooltip
                              key={c.campaign_id}
                              title={`Campanha ${c.campaign_id} • ${share.toFixed(1)}% do tempo (~${Math.round(
                                (c.total_duration || 0) / 60
                              )} min)`}
                            >
                              <Box
                                sx={{
                                  width: `${share}%`,
                                  bgcolor: color,
                                  opacity: 0.85,
                                  '&:hover': {
                                    opacity: 1,
                                  },
                                }}
                              />
                            </Tooltip>
                          );
                        })}
                      </Box>

                      {/* Lista de campanhas com detalhes */}
                      <Box display="flex" flexDirection="column" gap={1}>
                        {group.campaigns.map((c) => {
                          const share = c.share_percent ?? ((c.total_duration || 0) / base) * 100;
                          const color = getCampaignColor(c.campaign_id);
                          return (
                            <Box
                              key={c.campaign_id}
                              display="flex"
                              alignItems="center"
                              justifyContent="space-between"
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                border: `1px solid ${theme.palette.divider}`,
                              }}
                            >
                              <Box display="flex" alignItems="center" gap={1}>
                                <Box
                                  sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    bgcolor: color,
                                  }}
                                />
                                <Typography variant="body2">
                                  Campanha <strong>#{c.campaign_id}</strong>
                                </Typography>
                              </Box>
                              <Box display="flex" gap={1} alignItems="center">
                                <Chip
                                  size="small"
                                  label={`${share.toFixed(1)}% do tempo`}
                                  sx={{ bgcolor: color, color: '#fff' }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {c.total_items} itens • {(c.total_duration / 60).toFixed(1)} min
                                </Typography>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default PlaylistMixGroup;


