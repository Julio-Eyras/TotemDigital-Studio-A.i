/**
 * SubscriberStats Component
 * Componente para exibir estatísticas do subscriber
 */

import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Store,
  Computer,
  Tv,
  CheckCircle,
  VideoLibrary,
  QueueMusic,
  Campaign as CampaignIcon,
  Error as ErrorIcon,
  Warning,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

export interface SubscriberStatsData {
  locals: any[];
  totems: any[];
  smartTvs: any[];
  stats?: {
    onlineTotems?: number;
    media_count?: number;
    playlist_count?: number;
    campaign_count?: number;
    storage_used_gb?: number;
    storage_limit_gb?: number;
    plan_limits?: {
      medias?: number;
      playlists?: number;
      campaigns?: number;
    };
  };
}

export interface SubscriberStatsProps {
  data: SubscriberStatsData;
  contracts?: Array<{
    contract_id: number;
    title: string;
    contract_number: string;
    contract_type: string;
    end_date?: string;
    subscriber_id: number;
  }>;
  subscriberId?: number;
}

const SubscriberStats: React.FC<SubscriberStatsProps> = ({
  data,
  contracts = [],
  subscriberId,
}) => {
  const theme = useTheme();

  const activeContracts = contracts.filter(
    (c) => c.subscriber_id === subscriberId
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <Grid container spacing={3}>
      {/* Cards de Contadores */}
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ textAlign: 'center', py: 2 }}>
          <CardContent>
            <Store sx={{ fontSize: 40, color: theme.palette.primary.main, mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {data.locals.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Locais
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ textAlign: 'center', py: 2 }}>
          <CardContent>
            <Computer sx={{ fontSize: 40, color: theme.palette.success.main, mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {data.totems.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Totens
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card sx={{ textAlign: 'center', py: 2 }}>
          <CardContent>
            <Tv sx={{ fontSize: 40, color: theme.palette.warning.main, mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {data.smartTvs.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Smart TVs
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {data.stats && (
        <>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <CheckCircle sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {data.stats.onlineTotems || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Totens Online
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <VideoLibrary sx={{ fontSize: 40, color: theme.palette.primary.main, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {data.stats.media_count || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Mídias
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <QueueMusic sx={{ fontSize: 40, color: theme.palette.secondary.main, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {data.stats.playlist_count || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Playlists
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <CampaignIcon sx={{ fontSize: 40, color: theme.palette.warning.main, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {data.stats.campaign_count || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Campanhas
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Storage */}
          {data.stats.storage_used_gb !== undefined && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Armazenamento
                  </Typography>
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        {data.stats.storage_used_gb?.toFixed(2) || 0} GB utilizados
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {data.stats.storage_limit_gb
                          ? `${data.stats.storage_limit_gb} GB limite`
                          : 'Sem limite'}
                      </Typography>
                    </Box>
                    {data.stats.storage_limit_gb && (
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(
                          ((data.stats.storage_used_gb || 0) / data.stats.storage_limit_gb) * 100,
                          100
                        )}
                        sx={{ height: 8, borderRadius: 4 }}
                        color={
                          ((data.stats.storage_used_gb || 0) / data.stats.storage_limit_gb) * 100 > 90
                            ? 'error'
                            : ((data.stats.storage_used_gb || 0) / data.stats.storage_limit_gb) * 100 > 75
                            ? 'warning'
                            : 'primary'
                        }
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Plan Limits */}
          {data.stats.plan_limits && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Limites do Plano
                  </Typography>
                  <Grid container spacing={2}>
                    {data.stats.plan_limits.medias !== undefined && (
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Mídias
                        </Typography>
                        <Typography variant="h6">
                          {data.stats.media_count || 0} /{' '}
                          {data.stats.plan_limits.medias === -1
                            ? '∞'
                            : data.stats.plan_limits.medias}
                        </Typography>
                      </Grid>
                    )}
                    {data.stats.plan_limits.playlists !== undefined && (
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Playlists
                        </Typography>
                        <Typography variant="h6">
                          {data.stats.playlist_count || 0} /{' '}
                          {data.stats.plan_limits.playlists === -1
                            ? '∞'
                            : data.stats.plan_limits.playlists}
                        </Typography>
                      </Grid>
                    )}
                    {data.stats.plan_limits.campaigns !== undefined && (
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Campanhas
                        </Typography>
                        <Typography variant="h6">
                          {data.stats.campaign_count || 0} /{' '}
                          {data.stats.plan_limits.campaigns === -1
                            ? '∞'
                            : data.stats.plan_limits.campaigns}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Contracts */}
          {subscriberId && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Contratos e Planos
                  </Typography>
                  {activeContracts.length === 0 ? (
                    <Alert severity="warning">
                      Nenhum contrato ativo encontrado para este assinante.
                    </Alert>
                  ) : (
                    <List>
                      {activeContracts.map((contract) => {
                        const isExpired =
                          contract.end_date &&
                          new Date(contract.end_date) < new Date();
                        const isExpiringSoon =
                          contract.end_date &&
                          new Date(contract.end_date) > new Date() &&
                          new Date(contract.end_date) <=
                            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                        return (
                          <ListItem key={contract.contract_id}>
                            <ListItemIcon>
                              {isExpired ? (
                                <ErrorIcon color="error" />
                              ) : isExpiringSoon ? (
                                <Warning color="warning" />
                              ) : (
                                <CheckCircle color="success" />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={contract.title}
                              secondary={
                                <>
                                  {contract.contract_number} •{' '}
                                  {contract.contract_type} •
                                  {contract.end_date ? (
                                    isExpired ? (
                                      <span style={{ color: 'red' }}>
                                        {' '}
                                        Expirado em {formatDate(contract.end_date)}
                                      </span>
                                    ) : isExpiringSoon ? (
                                      <span style={{ color: 'orange' }}>
                                        {' '}
                                        Expira em {formatDate(contract.end_date)}
                                      </span>
                                    ) : (
                                      ` Válido até ${formatDate(contract.end_date)}`
                                    )
                                  ) : (
                                    ' Sem data de término'
                                  )}
                                </>
                              }
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
        </>
      )}
    </Grid>
  );
};

export default SubscriberStats;
