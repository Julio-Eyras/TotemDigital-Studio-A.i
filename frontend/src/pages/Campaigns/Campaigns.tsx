import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Campaign as CampaignIcon, Refresh, ExpandMore } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { campaignApi, Campaign } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { CampaignCard, CampaignDetails } from './components';
import { compareByDisplayName, normalizeCampaign } from './campaignHelpers';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const Campaigns: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumbs();
  const location = useLocation() as { state?: { highlightId?: number } };
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const user = useAppSelector((state) => state.auth.user);
  /** Abre o anunciante no contexto de campanhas (inclui operador comercial em consulta). */
  const canNavigateSubscriberForCampaign =
    user?.role === 'admin' ||
    user?.role === 'admin_sql' ||
    user?.role === 'owner_system' ||
    user?.role === 'gerente_marketing' ||
    user?.role === 'operador_comercial';
  /** Abre também o editor completo ao chegar (não aplica a operador comercial). */
  const canDeepLinkCampaignEditorFromGlobal =
    user?.role === 'admin' ||
    user?.role === 'admin_sql' ||
    user?.role === 'owner_system' ||
    user?.role === 'gerente_marketing';

  useEffect(() => {
    if (location.state?.highlightId) {
      setHighlightId(location.state.highlightId);
    }
  }, [location.state]);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, campaigns]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await campaignApi.getAll({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      const campaignsArray = Array.isArray(response) ? response : [];
      const normalizedCampaigns = campaignsArray.map(normalizeCampaign);
      normalizedCampaigns.sort((a, b) => compareByDisplayName(a.title || a.name, b.title || b.name));
      setCampaigns(normalizedCampaigns);
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao carregar lista de campanhas'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const goManageInSubscriber = (campaign: Campaign) => {
    const sid = campaign.subscriber_id ?? (campaign as any).subscriberId ?? (campaign as any).clientId;
    const cid = campaign.campaign_id;
    if (!sid) {
      setError('Esta campanha não está associada a um anunciante. Abra os detalhes ou contacte o suporte.');
      return;
    }
    navigate('/subscribers', {
      state: {
        openEditForSubscriberId: Number(sid),
        focusCampaignTab: true,
        ...(canDeepLinkCampaignEditorFromGlobal ? { highlightCampaignId: cid } : {}),
      },
    });
  };

  if (loading && campaigns.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando campanhas...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      <PageHeader
        title="Campanhas"
        subtitle="Visão global (somente leitura). Para criar ou alterar campanhas, use Anunciantes → editar anunciante → aba Campanhas."
        breadcrumbs={breadcrumbs}
        actions={[]}
        onRefresh={loadCampaigns}
        loading={loading}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar campanhas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadCampaigns();
                }}
                InputProps={{
                  startAdornment: <CampaignIcon sx={{ mr: 1, color: theme.palette.text.secondary }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="active">Ativa</MenuItem>
                  <MenuItem value="draft">Rascunho</MenuItem>
                  <MenuItem value="finished">Concluída</MenuItem>
                  <MenuItem value="cancelled">Cancelada</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button fullWidth variant="outlined" startIcon={<Refresh />} onClick={loadCampaigns}>
                Atualizar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {campaigns.map((campaign) => {
          const isHighlighted = highlightId === campaign.campaign_id;
          return (
            <Box key={campaign.campaign_id} ref={isHighlighted ? highlightRef : undefined}>
            <Accordion
              defaultExpanded={isHighlighted}
              disableGutters
              sx={{ borderRadius: 1, overflow: 'hidden', '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography sx={{ fontWeight: 600, flex: 1 }}>{campaign.title || 'Sem título'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
                  {(campaign.status || '—').toString()}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, bgcolor: 'background.paper' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6} lg={4}>
                    <Box>
                      <CampaignCard
                        campaign={campaign}
                        highlighted={isHighlighted}
                        readOnly
                        onView={(c) => {
                          setSelectedCampaign(c);
                          setDetailsDialogOpen(true);
                        }}
                        onManageInSubscriber={
                          canNavigateSubscriberForCampaign ? () => goManageInSubscriber(campaign) : undefined
                        }
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6} lg={8}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Resumo
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {campaign.description?.trim() ? campaign.description : 'Sem descrição.'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      ID #{campaign.campaign_id}
                      {campaign.subscriber_id != null && ` · Anunciante #${campaign.subscriber_id}`}
                    </Typography>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
            </Box>
          );
        })}
      </Box>

      {campaigns.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <CampaignIcon sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhuma campanha encontrada
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
              Ajuste os filtros ou crie campanhas a partir do menu Anunciantes.
            </Typography>
          </CardContent>
        </Card>
      )}

      <CampaignDetails
        open={detailsDialogOpen}
        campaign={selectedCampaign}
        onClose={() => {
          setDetailsDialogOpen(false);
          setSelectedCampaign(null);
        }}
        onManageInSubscriber={
          canNavigateSubscriberForCampaign && selectedCampaign
            ? () => {
                setDetailsDialogOpen(false);
                goManageInSubscriber(selectedCampaign);
              }
            : undefined
        }
      />
    </Box>
  );
};

export default Campaigns;
