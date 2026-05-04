/**
 * Dispatcher Manager - Gerenciar
 * 
 * Planejamento e visualização do que será exibido:
 * - Campanhas elegíveis para um totem
 * - Playlists disponíveis e suas mídias
 * - Timeline de exibição (o que será exibido em cada horário)
 * - Simulação de planos de exibição
 * 
 * DIFERENÇA DOS OUTROS:
 * - Gerenciar: Planejamento (o que será exibido) ← VOCÊ ESTÁ AQUI
 * - Monitor: Histórico (o que foi exibido)
 * - Debug Online: Diagnóstico técnico (por que não funciona)
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme,
  useMediaQuery,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  Refresh,
  Visibility,
  CheckCircle,
  Campaign,
  VideoLibrary,
  QueueMusic,
  Timeline as TimelineIcon,
  BarChart,
} from '@mui/icons-material';
import { dispatcherTotemApi, totemApi, DispatchPlan } from '../../services/api';
import { getTotemIdFromRow } from '../../utils/totemRowIds';
import ResponsiveSectionNav from '../../components/navigation/ResponsiveSectionNav';
import { format } from 'date-fns';

/** Índices alinhados a `tabValue` (0..4). Uma única fonte para abas desktop e drawer mobile. */
const DISPATCHER_SECTIONS = [
  { label: 'Campanhas Elegíveis', icon: Campaign },
  { label: 'Playlists Elegíveis', icon: QueueMusic },
  { label: 'Mídia Elegível', icon: VideoLibrary },
  { label: 'Timeline', icon: TimelineIcon },
  { label: 'Estatísticas', icon: BarChart },
] as const;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  const panelLabel = DISPATCHER_SECTIONS[index]?.label ?? `Seção ${index + 1}`;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dispatcher-manager-tabpanel-${index}`}
      aria-label={panelLabel}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: { xs: 1.5, sm: 2, md: 3 }, px: { xs: 0.5, sm: 1, md: 2 }, pb: { xs: 1, md: 2 } }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface EligibleCampaign {
  campaignId: number;
  title: string;
  priority: number;
  commercialTier: string;
  timeSharePercent: number;
  playlistId: number;
  playlistName: string;
   mediaId?: number;
   mediaName?: string;
  status: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  daysOfWeek: string[];
}

interface EligiblePlaylist {
  playlistId: number;
  name: string;
  campaignId: number;
  campaignTitle: string;
  mediaCount: number;
  totalDuration: number;
  status: string;
}

interface EligibleMedia {
  mediaId: number;
  name: string;
  playlistId: number;
  playlistName: string;
  campaignId: number;
  campaignTitle: string;
  mediaType: string;
  duration: number;
  status: string;
}

interface TimelineSlot {
  hour: number;
  minute: number;
  campaignId: number;
  campaignTitle: string;
  playlistId: number;
  mediaId: number;
  mediaName: string;
  duration: number;
}

const DispatcherManager: React.FC = () => {
  const theme = useTheme();
  /** Abaixo do breakpoint `md`: drawer + conteúdo em largura total (Pro e Compact). */
  const isMobileNav = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const dialogFullScreen = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [selectedTotemId, setSelectedTotemId] = useState<number | undefined>(undefined);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string>(
    format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  
  // Dados
  const [totems, setTotems] = useState<any[]>([]);
  const [eligibleCampaigns, setEligibleCampaigns] = useState<EligibleCampaign[]>([]);
  const [eligiblePlaylists, setEligiblePlaylists] = useState<EligiblePlaylist[]>([]);
  const [eligibleMedia, setEligibleMedia] = useState<EligibleMedia[]>([]);
  const [timeline, setTimeline] = useState<TimelineSlot[]>([]);
  const [dispatchPlan, setDispatchPlan] = useState<DispatchPlan | null>(null);
  const [dispatchFromCache, setDispatchFromCache] = useState<boolean | undefined>(undefined);
  const [dispatchExecutionMs, setDispatchExecutionMs] = useState<number | undefined>(undefined);
  
  // Dialogs
  const [campaignDetailOpen, setCampaignDetailOpen] = useState(false);
  const [playlistDetailOpen, setPlaylistDetailOpen] = useState(false);
  const [mediaDetailOpen, setMediaDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Carregar totens
  useEffect(() => {
    loadTotems();
  }, []);

  // Carregar dados quando totem ou timestamp mudar
  useEffect(() => {
    if (selectedTotemId) {
      loadEligibleData();
      loadTimeline();
      loadDispatchPlan();
    }
  }, [selectedTotemId, selectedTimestamp]);

  const loadTotems = async () => {
    try {
      setLoading(true);
      // O endpoint /api/totems pagina por padrão (limit=10). Para popular o combo, buscamos um lote grande.
      // Backend limita paginação; manter compatível para evitar 400/429
      const response = await totemApi.getAll({ page: 1, limit: 100 });
      setTotems(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar totens');
    } finally {
      setLoading(false);
    }
  };

  const loadEligibleData = async () => {
    if (!selectedTotemId) return;
    
    try {
      setLoading(true);
      const timestamp = new Date(selectedTimestamp);
      if (isNaN(timestamp.getTime())) {
        setError('Data/hora inválida. Ajuste o campo "Timestamp" e tente novamente.');
        return;
      }
      
      // Buscar candidatos do dispatcher
      const candidatesResponse = await dispatcherTotemApi.getCandidates(
        selectedTotemId,
        {
          timestamp: timestamp.toISOString()
        }
      );
      
      if (candidatesResponse.success && candidatesResponse.candidates) {
        // Processar campanhas elegíveis (deduplicando por campanha+playlist)
        const rawCampaigns: EligibleCampaign[] = candidatesResponse.candidates.map((c: any) => ({
          campaignId: c.campaignId,
          title: c.campaignTitle,
          priority: c.priority,
          commercialTier: c.commercialTier || 'standard',
          timeSharePercent: c.timeSharePercent || 0,
          playlistId: c.playlistId,
          playlistName: c.playlistName,
          mediaId: c.mediaId,
          mediaName: c.mediaName,
          status: c.temporalValid ? 'eligible' : 'invalid',
          startDate: '',
          endDate: '',
          startTime: '',
          endTime: '',
          daysOfWeek: [],
        }));

        const uniqueCampaignsMap = new Map<string, EligibleCampaign>();
        rawCampaigns.forEach((campaign) => {
          const key = `${campaign.campaignId}-${campaign.playlistId}`;
          if (!uniqueCampaignsMap.has(key)) {
            uniqueCampaignsMap.set(key, campaign);
          }
        });

        const campaigns = Array.from(uniqueCampaignsMap.values());
        setEligibleCampaigns(campaigns);
        
        // Processar playlists elegíveis
        const playlistsMap = new Map<number, EligiblePlaylist>();
        campaigns.forEach(campaign => {
          if (!playlistsMap.has(campaign.playlistId)) {
            playlistsMap.set(campaign.playlistId, {
              playlistId: campaign.playlistId,
              name: campaign.playlistName,
              campaignId: campaign.campaignId,
              campaignTitle: campaign.title,
              mediaCount: 0,
              totalDuration: 0,
              status: campaign.status,
            });
          }
        });
        setEligiblePlaylists(Array.from(playlistsMap.values()));
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados elegíveis');
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async () => {
    if (!selectedTotemId) return;
    
    try {
      // Gerar timeline de 24 horas
      const slots: TimelineSlot[] = [];
      const hours = Array.from({ length: 24 }, (_, i) => i);
      
      hours.forEach(hour => {
        [0, 10, 20, 30, 40, 50].forEach(minute => {
          slots.push({
            hour,
            minute,
            campaignId: 0,
            campaignTitle: '',
            playlistId: 0,
            mediaId: 0,
            mediaName: '',
            duration: 10,
          });
        });
      });
      
      setTimeline(slots);
    } catch (err: any) {
      console.error('Erro ao gerar timeline:', err);
    }
  };

  const loadDispatchPlan = async () => {
    if (!selectedTotemId) return;
    
    try {
      const timestamp = new Date(selectedTimestamp);
      if (isNaN(timestamp.getTime())) {
        setError('Data/hora inválida. Ajuste o campo "Timestamp" e tente novamente.');
        return;
      }
      const response = await dispatcherTotemApi.dispatch(
        selectedTotemId,
        {
          timestamp: timestamp.toISOString(),
          includeCandidates: true
        }
      );
      
      if (response.success && response.data) {
        setDispatchPlan(response.data);
        setDispatchFromCache(response.fromCache);
        setDispatchExecutionMs(response.executionTimeMs);
      }
    } catch (err: any) {
      console.error('Erro ao carregar plano:', err);
    }
  };

  const handleRefresh = () => {
    loadEligibleData();
    loadTimeline();
    loadDispatchPlan();
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium': return 'success';
      case 'standard': return 'info';
      case 'remnant': return 'default';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'eligible': return 'success';
      case 'invalid': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Box
        sx={{
          mb: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem', md: undefined } }}>
          Gerenciador Dispatcher-Totem
        </Typography>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={loading}
          sx={{ alignSelf: { xs: 'stretch', sm: 'auto' } }}
        >
          Atualizar
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filtros */}
      <Card sx={{ mb: { xs: 2, md: 3 } }}>
        <CardContent sx={{ p: { xs: 2, sm: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Totem</InputLabel>
                <Select
                  value={selectedTotemId || ''}
                  onChange={(e) => setSelectedTotemId(e.target.value as number)}
                  label="Totem"
                >
                  <MenuItem value="">Selecione um totem</MenuItem>
                  {totems
                    .map((totem) => {
                      const tid = getTotemIdFromRow(totem as Record<string, unknown>);
                      if (tid === undefined) return null;
                      return (
                        <MenuItem key={tid} value={tid}>
                          {totem.name || totem.identifier} ({tid})
                        </MenuItem>
                      );
                    })
                    .filter(Boolean)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Data/Hora"
                type="datetime-local"
                value={selectedTimestamp}
                onChange={(e) => setSelectedTimestamp(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              {dispatchPlan && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Chip
                    icon={<CheckCircle />}
                    label={`Plano: ${dispatchPlan.playlistName || 'N/A'} (${dispatchPlan.mediaItems.length} mídias)`}
                    color="success"
                    variant="outlined"
                    sx={{
                      height: 'auto',
                      minHeight: 32,
                      maxWidth: '100%',
                      '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: undefined } }}>
                    Origem: {dispatchPlan.source} #{dispatchPlan.sourceId} · Campanha: {dispatchPlan.metadata?.campaignTitle || dispatchPlan.metadata?.campaignId || '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: undefined } }}>
                    Cache: {dispatchFromCache ? 'SIM (cache ativo)' : 'NÃO (recalculado)'} · Execução: {dispatchExecutionMs ?? 0} ms
                  </Typography>
                </Box>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Tabs desktop / barra híbrida mobile — mesmo `tabValue` e TabPanels abaixo */}
      <Card sx={{ overflow: 'hidden' }}>
        <ResponsiveSectionNav
          sections={DISPATCHER_SECTIONS}
          value={tabValue}
          onChange={(nextValue) => setTabValue(nextValue)}
          isMobileNav={isMobileNav}
          idPrefix="dispatcher-manager"
        />

        {/* Tab 1: Campanhas Elegíveis */}
        <TabPanel value={tabValue} index={0}>
          <TableContainer component={Paper} sx={{ maxWidth: '100%' }}>
            <Table size={isMobileNav ? 'small' : 'medium'}>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Título</TableCell>
                  <TableCell>Prioridade</TableCell>
                  <TableCell>Tier</TableCell>
                  <TableCell>Time Share</TableCell>
                  <TableCell>Playlist</TableCell>
                  <TableCell>Mídia ID</TableCell>
                  <TableCell>Mídia</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {eligibleCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      {selectedTotemId ? 'Nenhuma campanha elegível encontrada' : 'Selecione um totem'}
                    </TableCell>
                  </TableRow>
                ) : (
                  eligibleCampaigns.map((campaign) => (
                    <TableRow key={`${campaign.campaignId}-${campaign.playlistId}`}>
                      <TableCell>{campaign.campaignId}</TableCell>
                      <TableCell>{campaign.title}</TableCell>
                      <TableCell>
                        <Chip label={campaign.priority} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={campaign.commercialTier}
                          color={getTierColor(campaign.commercialTier) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {campaign.timeSharePercent > 0 ? (
                          <Chip label={`${campaign.timeSharePercent}%`} size="small" color="info" />
                        ) : (
                          <Chip label="0%" size="small" />
                        )}
                      </TableCell>
                      <TableCell>{campaign.playlistName}</TableCell>
                      <TableCell>{campaign.mediaId ?? '-'}</TableCell>
                      <TableCell>{campaign.mediaName ?? '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={campaign.status === 'eligible' ? 'Elegível' : 'Inválida'}
                          color={getStatusColor(campaign.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedItem(campaign);
                            setCampaignDetailOpen(true);
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Tab 2: Playlists Elegíveis */}
        <TabPanel value={tabValue} index={1}>
          <TableContainer component={Paper} sx={{ maxWidth: '100%' }}>
            <Table size={isMobileNav ? 'small' : 'medium'}>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Nome</TableCell>
                  <TableCell>Campanha</TableCell>
                  <TableCell>Mídias</TableCell>
                  <TableCell>Duração Total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {eligiblePlaylists.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      {selectedTotemId ? 'Nenhuma playlist elegível encontrada' : 'Selecione um totem'}
                    </TableCell>
                  </TableRow>
                ) : (
                  eligiblePlaylists.map((playlist) => (
                    <TableRow key={playlist.playlistId}>
                      <TableCell>{playlist.playlistId}</TableCell>
                      <TableCell>{playlist.name}</TableCell>
                      <TableCell>{playlist.campaignTitle}</TableCell>
                      <TableCell>{playlist.mediaCount}</TableCell>
                      <TableCell>{playlist.totalDuration}s</TableCell>
                      <TableCell>
                        <Chip
                          label={playlist.status === 'eligible' ? 'Elegível' : 'Inválida'}
                          color={getStatusColor(playlist.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedItem(playlist);
                            setPlaylistDetailOpen(true);
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Tab 3: Mídia Elegível */}
        <TabPanel value={tabValue} index={2}>
          <TableContainer component={Paper} sx={{ maxWidth: '100%' }}>
            <Table size={isMobileNav ? 'small' : 'medium'}>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Nome</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Duração</TableCell>
                  <TableCell>Playlist</TableCell>
                  <TableCell>Campanha</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {eligibleMedia.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      {selectedTotemId ? 'Nenhuma mídia elegível encontrada' : 'Selecione um totem'}
                    </TableCell>
                  </TableRow>
                ) : (
                  eligibleMedia.map((media) => (
                    <TableRow key={media.mediaId}>
                      <TableCell>{media.mediaId}</TableCell>
                      <TableCell>{media.name}</TableCell>
                      <TableCell>
                        <Chip label={media.mediaType} size="small" />
                      </TableCell>
                      <TableCell>{media.duration}s</TableCell>
                      <TableCell>{media.playlistName}</TableCell>
                      <TableCell>{media.campaignTitle}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedItem(media);
                            setMediaDetailOpen(true);
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Tab 4: Timeline */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ maxHeight: { xs: 'min(55vh, 480px)', md: '600px' }, overflow: 'auto' }}>
            <Timeline>
              {timeline.slice(0, 48).map((slot, index) => (
                <TimelineItem key={index}>
                  <TimelineOppositeContent sx={{ flex: 0.2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {String(slot.hour).padStart(2, '0')}:{String(slot.minute).padStart(2, '0')}
                    </Typography>
                  </TimelineOppositeContent>
                  <TimelineSeparator>
                    <TimelineDot color={slot.campaignId > 0 ? 'primary' : 'grey'} />
                    {index < timeline.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent>
                    {slot.campaignId > 0 ? (
                      <Card variant="outlined" sx={{ p: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {slot.campaignTitle}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {slot.mediaName} ({slot.duration}s)
                        </Typography>
                      </Card>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Sem conteúdo agendado
                      </Typography>
                    )}
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </Box>
        </TabPanel>

        {/* Tab 5: Estatísticas */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ py: { xs: 1.5, md: 2 } }}>
                  <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '0.95rem', md: undefined } }}>
                    Campanhas Elegíveis
                  </Typography>
                  <Typography variant="h3" color="primary" sx={{ fontSize: { xs: '1.75rem', md: undefined } }}>
                    {eligibleCampaigns.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', md: undefined } }}>
                    Total de campanhas elegíveis para o totem selecionado
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ py: { xs: 1.5, md: 2 } }}>
                  <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '0.95rem', md: undefined } }}>
                    Playlists Elegíveis
                  </Typography>
                  <Typography variant="h3" color="primary" sx={{ fontSize: { xs: '1.75rem', md: undefined } }}>
                    {eligiblePlaylists.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', md: undefined } }}>
                    Total de playlists elegíveis
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ py: { xs: 1.5, md: 2 } }}>
                  <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '0.95rem', md: undefined } }}>
                    Mídia Elegível
                  </Typography>
                  <Typography variant="h3" color="primary" sx={{ fontSize: { xs: '1.75rem', md: undefined } }}>
                    {eligibleMedia.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', md: undefined } }}>
                    Total de mídias elegíveis
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {dispatchPlan && (
              <Grid item xs={12}>
                <Card>
                  <CardContent sx={{ py: { xs: 1.5, md: 2 } }}>
                    <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '0.95rem', md: undefined } }}>
                      Plano Atual
                    </Typography>
                    <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', md: undefined }, wordBreak: 'break-word' }}>
                      <strong>Playlist:</strong> {dispatchPlan.playlistName}
                    </Typography>
                    <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', md: undefined } }}>
                      <strong>Prioridade:</strong> {dispatchPlan.priority}
                    </Typography>
                    <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', md: undefined } }}>
                      <strong>Fonte:</strong> {dispatchPlan.source}
                    </Typography>
                    <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', md: undefined } }}>
                      <strong>Duração Total:</strong> {dispatchPlan.totalDuration}s
                    </Typography>
                    <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', md: undefined } }}>
                      <strong>Itens:</strong> {dispatchPlan.mediaItems?.length || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </TabPanel>
      </Card>

      {/* Dialogs de Detalhes */}
      <Dialog
        open={campaignDetailOpen}
        onClose={() => setCampaignDetailOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={dialogFullScreen}
        scroll="paper"
      >
        <DialogTitle>Detalhes da Campanha</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box>
              <Typography><strong>ID:</strong> {selectedItem.campaignId}</Typography>
              <Typography><strong>Título:</strong> {selectedItem.title}</Typography>
              <Typography><strong>Prioridade:</strong> {selectedItem.priority}</Typography>
              <Typography><strong>Tier:</strong> {selectedItem.commercialTier}</Typography>
              <Typography><strong>Time Share:</strong> {selectedItem.timeSharePercent}%</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCampaignDetailOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={playlistDetailOpen}
        onClose={() => setPlaylistDetailOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={dialogFullScreen}
        scroll="paper"
      >
        <DialogTitle>Detalhes da Playlist</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box>
              <Typography><strong>ID:</strong> {selectedItem.playlistId}</Typography>
              <Typography><strong>Nome:</strong> {selectedItem.name}</Typography>
              <Typography><strong>Campanha:</strong> {selectedItem.campaignTitle}</Typography>
              <Typography><strong>Mídias:</strong> {selectedItem.mediaCount}</Typography>
              <Typography><strong>Duração Total:</strong> {selectedItem.totalDuration}s</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlaylistDetailOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={mediaDetailOpen}
        onClose={() => setMediaDetailOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={dialogFullScreen}
        scroll="paper"
      >
        <DialogTitle>Detalhes da Mídia</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box>
              <Typography><strong>ID:</strong> {selectedItem.mediaId}</Typography>
              <Typography><strong>Nome:</strong> {selectedItem.name}</Typography>
              <Typography><strong>Tipo:</strong> {selectedItem.mediaType}</Typography>
              <Typography><strong>Duração:</strong> {selectedItem.duration}s</Typography>
              <Typography><strong>Playlist:</strong> {selectedItem.playlistName}</Typography>
              <Typography><strong>Campanha:</strong> {selectedItem.campaignTitle}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMediaDetailOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DispatcherManager;
