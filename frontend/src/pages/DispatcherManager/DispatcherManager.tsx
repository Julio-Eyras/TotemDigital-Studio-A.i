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
  Tooltip,
  useTheme,
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
  Autocomplete,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
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
  ExpandMore,
  CheckCircle,
  Error,
  Warning,
  Schedule,
  PlaylistPlay,
  Campaign,
  Computer,
  Cached,
  Timer,
  FilterList,
  VideoLibrary,
  QueueMusic,
  Timeline as TimelineIcon,
  Settings,
  BarChart,
  Info,
} from '@mui/icons-material';
import { dispatcherTotemApi, totemApi, DispatchPlan } from '../../services/api';
import { format } from 'date-fns';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
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
        // Processar campanhas elegíveis
        const campaigns: EligibleCampaign[] = candidatesResponse.candidates.map((c: any) => ({
          campaignId: c.campaignId,
          title: c.campaignTitle,
          priority: c.priority,
          commercialTier: c.commercialTier || 'standard',
          timeSharePercent: c.timeSharePercent || 0,
          playlistId: c.playlistId,
          playlistName: c.playlistName,
          status: c.temporalValid ? 'eligible' : 'invalid',
          startDate: '',
          endDate: '',
          startTime: '',
          endTime: '',
          daysOfWeek: [],
        }));
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
      }
    } catch (err: any) {
      console.error('Erro ao carregar plano:', err);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Gerenciador Dispatcher-Totem
        </Typography>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={loading}
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
      <Card sx={{ mb: 3 }}>
        <CardContent>
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
                  {totems.map((totem) => (
                    <MenuItem key={totem.totem_id} value={totem.totem_id}>
                      {totem.name || totem.identifier} ({totem.totem_id})
                    </MenuItem>
                  ))}
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
                <Chip
                  icon={<CheckCircle />}
                  label={`Plano: ${dispatchPlan.playlistName || 'N/A'}`}
                  color="success"
                  variant="outlined"
                />
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab icon={<Campaign />} label="Campanhas Elegíveis" iconPosition="start" />
            <Tab icon={<QueueMusic />} label="Playlists Elegíveis" iconPosition="start" />
            <Tab icon={<VideoLibrary />} label="Mídia Elegível" iconPosition="start" />
            <Tab icon={<TimelineIcon />} label="Timeline" iconPosition="start" />
            <Tab icon={<BarChart />} label="Estatísticas" iconPosition="start" />
          </Tabs>
        </Box>

        {/* Tab 1: Campanhas Elegíveis */}
        <TabPanel value={tabValue} index={0}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Título</TableCell>
                  <TableCell>Prioridade</TableCell>
                  <TableCell>Tier</TableCell>
                  <TableCell>Time Share</TableCell>
                  <TableCell>Playlist</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {eligibleCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      {selectedTotemId ? 'Nenhuma campanha elegível encontrada' : 'Selecione um totem'}
                    </TableCell>
                  </TableRow>
                ) : (
                  eligibleCampaigns.map((campaign) => (
                    <TableRow key={campaign.campaignId}>
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
          <TableContainer component={Paper}>
            <Table>
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
          <TableContainer component={Paper}>
            <Table>
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
          <Box sx={{ maxHeight: '600px', overflow: 'auto' }}>
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
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Campanhas Elegíveis
                  </Typography>
                  <Typography variant="h3" color="primary">
                    {eligibleCampaigns.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total de campanhas elegíveis para o totem selecionado
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Playlists Elegíveis
                  </Typography>
                  <Typography variant="h3" color="primary">
                    {eligiblePlaylists.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total de playlists elegíveis
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Mídia Elegível
                  </Typography>
                  <Typography variant="h3" color="primary">
                    {eligibleMedia.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total de mídias elegíveis
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {dispatchPlan && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Plano Atual
                    </Typography>
                    <Typography variant="body1">
                      <strong>Playlist:</strong> {dispatchPlan.playlistName}
                    </Typography>
                    <Typography variant="body1">
                      <strong>Prioridade:</strong> {dispatchPlan.priority}
                    </Typography>
                    <Typography variant="body1">
                      <strong>Fonte:</strong> {dispatchPlan.source}
                    </Typography>
                    <Typography variant="body1">
                      <strong>Duração Total:</strong> {dispatchPlan.totalDuration}s
                    </Typography>
                    <Typography variant="body1">
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
