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
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  LocationOn,
  Refresh,
  CheckCircle,
  Warning,
  Store,
  Map as MapIcon,
  Visibility,
  Business,
  Computer,
  Tv,
  Assignment,
} from '@mui/icons-material';
import { 
  localApi, 
  Local, 
  CreateLocalRequest, 
  UpdateLocalRequest, 
  publisherApi, 
  Publisher,
  totemApi,
  smartTvApi,
  publisherContractApi,
  PublisherContract,
} from '../../services/api';
import { useAppSelector } from '../../store';

const Locals: React.FC = () => {
  const theme = useTheme();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = Boolean(
    (user?.isTenantUser ?? user?.is_tenant_user) ||
    ['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial'].includes(user?.role || '')
  );
  const userPublisherId = user?.publisherId;

  const [locals, setLocals] = useState<Local[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLocal, setSelectedLocal] = useState<Local | null>(null);
  const [selectedPublisher, setSelectedPublisher] = useState<Publisher | null>(null);
  const [selectedTotems, setSelectedTotems] = useState<any[]>([]);
  const [selectedSmartTvs, setSelectedSmartTvs] = useState<any[]>([]);
  const [selectedContracts, setSelectedContracts] = useState<PublisherContract[]>([]);
  const [detailsTab, setDetailsTab] = useState(0);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [publisherFilter, setPublisherFilter] = useState<number | undefined>(undefined);
  const [activeOnlyFilter, setActiveOnlyFilter] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [localStats, setLocalStats] = useState<Record<number, { totens: number; smartTvs: number }>>({});
  const [newLocal, setNewLocal] = useState<CreateLocalRequest>({
    publisher_id: userPublisherId || 0,
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'BR',
    latitude: undefined,
    longitude: undefined,
    timezone: 'America/Sao_Paulo',
    description: '',
  });

  useEffect(() => {
    loadLocals();
    if (isAdmin) {
      loadPublishers();
    }
  }, [publisherFilter, activeOnlyFilter]);

  const loadPublishers = async () => {
    try {
      const response = await publisherApi.getAll({ active_only: true });
      setPublishers(response.data);
    } catch (error) {
      console.error('Erro ao carregar publishers:', error);
    }
  };

  const loadLocals = async () => {
    try {
      setLoading(true);
      setError(null);
      // Buscar todos os locais (sem paginação para agrupamento)
      const response = await localApi.getAll({
        search: searchTerm || undefined,
        publisherId: publisherFilter || (isAdmin ? undefined : userPublisherId),
        active_only: activeOnlyFilter,
        limit: 10000, // Buscar todos
      });
      
      // Ordenar por publisher_name e depois por name
      const sortedLocals = [...response.data].sort((a, b) => {
        const publisherCompare = (a.publisher_name || '').localeCompare(b.publisher_name || '');
        if (publisherCompare !== 0) return publisherCompare;
        return (a.name || '').localeCompare(b.name || '');
      });
      
      setLocals(sortedLocals);
      
      // Carregar estatísticas (totens e Smart TVs) para cada local
      await loadLocalStats(sortedLocals);
    } catch (error: any) {
      console.error('Erro ao carregar locals:', error);
      setError(error.response?.data?.error || 'Erro ao carregar lista de locais');
    } finally {
      setLoading(false);
    }
  };

  const loadLocalStats = async (localsList: Local[]) => {
    const statsRecord: Record<number, { totens: number; smartTvs: number }> = {};
    
    try {
      // PERFORMANCE: buscar totens e Smart TVs UMA vez e agregar por local_id (evita N chamadas por local)
      const [totemsResponse, smartTvsResponse] = await Promise.all([
        totemApi.getAll({ limit: 10000 }).catch(() => ({ data: [] })),
        smartTvApi.getAll({ limit: 10000 }).catch(() => ({ data: [] })),
      ]);

      const totems = Array.isArray(totemsResponse.data) ? totemsResponse.data : [];
      const smartTvs = Array.isArray(smartTvsResponse.data) ? smartTvsResponse.data : [];

      // Mapear totem_id -> local_id
      const totemLocalMap = new Map<number, number>();
      for (const t of totems) {
        const totemId = Number((t as any).totem_id ?? (t as any).id);
        const localId = Number((t as any).localId ?? (t as any).local_id);
        if (!Number.isNaN(totemId) && !Number.isNaN(localId)) {
          totemLocalMap.set(totemId, localId);
        }
      }

      // Inicializar stats para todos os locais
      for (const local of localsList) {
        statsRecord[local.local_id] = { totens: 0, smartTvs: 0 };
      }

      // Contar totens por local
      for (const t of totems) {
        const localId = Number((t as any).localId ?? (t as any).local_id);
        if (!Number.isNaN(localId) && statsRecord[localId]) {
          statsRecord[localId].totens += 1;
        }
      }

      // Contar Smart TVs por local (via local_id direto OU via totem_id)
      for (const tv of smartTvs) {
        const directLocalId = Number((tv as any).localId ?? (tv as any).local_id);
        if (!Number.isNaN(directLocalId) && statsRecord[directLocalId]) {
          statsRecord[directLocalId].smartTvs += 1;
          continue;
        }

        const totemId = Number((tv as any).totem_id ?? (tv as any).totemId);
        const inferredLocalId = totemLocalMap.get(totemId);
        if (inferredLocalId && statsRecord[inferredLocalId]) {
          statsRecord[inferredLocalId].smartTvs += 1;
        }
      }
      
      setLocalStats(statsRecord);
    } catch (error) {
      console.error('Erro ao carregar estatísticas dos locais:', error);
    }
  };

  const handleCreateLocal = async () => {
    try {
      if (!newLocal.publisher_id) {
        setError('Selecione um publisher');
        return;
      }
      await localApi.create(newLocal);
      setCreateDialogOpen(false);
      setNewLocal({
        publisher_id: userPublisherId || 0,
        name: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        country: 'BR',
        latitude: undefined,
        longitude: undefined,
        timezone: 'America/Sao_Paulo',
        description: '',
      });
      loadLocals();
    } catch (error: any) {
      console.error('Erro ao criar local:', error);
      setError(error.response?.data?.error || 'Erro ao criar local');
    }
  };

  const handleEditLocal = async () => {
    if (!selectedLocal) return;
    
    try {
      const updateData: UpdateLocalRequest = {
        name: selectedLocal.name,
        address: selectedLocal.address,
        city: selectedLocal.city,
        state: selectedLocal.state,
        zip_code: selectedLocal.zip_code,
        country: selectedLocal.country,
        latitude: selectedLocal.latitude,
        longitude: selectedLocal.longitude,
        timezone: selectedLocal.timezone,
        description: selectedLocal.description,
        is_active: selectedLocal.is_active,
      };
      await localApi.update(selectedLocal.local_id, updateData);
      setEditDialogOpen(false);
      setSelectedLocal(null);
      loadLocals();
    } catch (error: any) {
      console.error('Erro ao atualizar local:', error);
      setError(error.response?.data?.error || 'Erro ao atualizar local');
    }
  };

  const handleDeleteLocal = async (localId: number) => {
    if (!window.confirm('Tem certeza que deseja deletar este local?')) {
      return;
    }
    
    try {
      await localApi.delete(localId);
      loadLocals();
    } catch (error: any) {
      console.error('Erro ao deletar local:', error);
      setError(error.response?.data?.error || 'Erro ao deletar local');
    }
  };

  const handleOpenEditDialog = (local: Local) => {
    setSelectedLocal(local);
    setEditDialogOpen(true);
  };

  const handleOpenDetailsDialog = async (local: Local) => {
    setSelectedLocal(local);
    setDetailsDialogOpen(true);
    setDetailsTab(0);
    setLoadingDetails(true);
    
    try {
      // Carregar dados do Publisher
      if (local.publisher_id) {
        try {
          const publisher = await publisherApi.getById(local.publisher_id);
          setSelectedPublisher(publisher);
        } catch (err) {
          console.error('Erro ao carregar publisher:', err);
        }
      }
      
      // Carregar Totens do local primeiro
      let localTotems: any[] = [];
      try {
        const totemsResponse = await totemApi.getAll({ limit: 1000 });
        const totems = Array.isArray(totemsResponse.data) ? totemsResponse.data : [];
        localTotems = totems.filter((t: any) => t.localId === local.local_id || t.local_id === local.local_id);
        setSelectedTotems(localTotems);
      } catch (err) {
        console.error('Erro ao carregar totens:', err);
        setSelectedTotems([]);
      }
      
      // Carregar Smart TVs do local (via totens)
      try {
        const smartTvsResponse = await smartTvApi.getAll({ limit: 1000 });
        const smartTvs = Array.isArray(smartTvsResponse.data) ? smartTvsResponse.data : [];
        const totemIds = localTotems.map((t: any) => t.totem_id || t.id);
        const localSmartTvs = smartTvs.filter((tv: any) => 
          totemIds.includes(tv.totem_id) || tv.local_id === local.local_id
        );
        setSelectedSmartTvs(localSmartTvs);
      } catch (err) {
        console.error('Erro ao carregar Smart TVs:', err);
        setSelectedSmartTvs([]);
      }
      
      // Carregar Contratos do Publisher
      if (local.publisher_id) {
        try {
          const contracts = await publisherContractApi.getByPublisher(local.publisher_id);
          setSelectedContracts(Array.isArray(contracts) ? contracts : []);
        } catch (err) {
          console.error('Erro ao carregar contratos:', err);
          setSelectedContracts([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Agrupar locais por Publisher
  const groupedLocals = locals.reduce((acc, local) => {
    const publisherName = local.publisher_name || 'Sem Publisher';
    if (!acc[publisherName]) {
      acc[publisherName] = [];
    }
    acc[publisherName].push(local);
    return acc;
  }, {} as Record<string, Local[]>);

  if (loading && locals.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            📍 Locais
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie locais vinculados aos Veículos de Mídia (Publicadores)
          </Typography>
        </Box>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{
              backgroundColor: theme.palette.primary.main,
              '&:hover': { backgroundColor: theme.palette.primary.dark },
            }}
          >
            Novo Local
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar locais..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    loadLocals();
                  }
                }}
                InputProps={{
                  startAdornment: <LocationOn sx={{ mr: 1, color: theme.palette.text.secondary }} />,
                }}
              />
            </Grid>
            {isAdmin && (
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Publisher</InputLabel>
                  <Select
                    value={publisherFilter || ''}
                    label="Publisher"
                    onChange={(e) => setPublisherFilter(e.target.value ? Number(e.target.value) : undefined)}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    {publishers.map((publisher) => (
                      <MenuItem key={publisher.publisher_id} value={publisher.publisher_id}>
                        {publisher.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} md={isAdmin ? 1.5 : 3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={activeOnlyFilter ? 'active' : 'all'}
                  label="Status"
                  onChange={(e) => setActiveOnlyFilter(e.target.value === 'active')}
                >
                  <MenuItem value="active">Ativos</MenuItem>
                  <MenuItem value="all">Todos</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={isAdmin ? 1.5 : 3}>
              <Button fullWidth variant="outlined" startIcon={<Refresh />} onClick={loadLocals}>
                Atualizar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Listagem (Card Grid) agrupada por Publisher */}
      {Object.entries(groupedLocals).map(([publisherName, publisherLocals]) => (
        <Box key={publisherName} sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Business color="primary" />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
              {publisherName}
            </Typography>
            <Chip label={`${publisherLocals.length} local(is)`} size="small" color="primary" variant="outlined" />
          </Box>

          <Grid container spacing={3}>
            {publisherLocals.map((local) => {
              const stats = localStats[local.local_id] || { totens: 0, smartTvs: 0 };
              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={local.local_id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: theme.shadows[8],
                      },
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }} noWrap>
                            {local.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                            {local.address || 'Sem endereço'}
                            {local.city ? `, ${local.city}` : ''}
                            {local.state ? ` - ${local.state}` : ''}
                          </Typography>
                        </Box>
                        <Chip
                          label={local.is_active ? 'Ativo' : 'Inativo'}
                          color={local.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </Box>

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
                        <Chip
                          label={`${stats.totens} Totens`}
                          size="small"
                          color="info"
                          variant="outlined"
                          icon={<Computer fontSize="small" />}
                        />
                        <Chip
                          label={`${stats.smartTvs} Smart TVs`}
                          size="small"
                          color="secondary"
                          variant="outlined"
                          icon={<Tv fontSize="small" />}
                        />
                      </Box>

                      <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tooltip title="Ver Detalhes">
                          <IconButton size="small" onClick={() => handleOpenDetailsDialog(local)}>
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        {isAdmin && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => handleOpenEditDialog(local)}>
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Deletar">
                              <IconButton size="small" color="error" onClick={() => handleDeleteLocal(local.local_id)}>
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      ))}

      {locals.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Store sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Nenhum local encontrado
          </Typography>
        </Box>
      )}

      {/* Dialog de Criação */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Criar Novo Local</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            {isAdmin && (
              <FormControl fullWidth>
                <InputLabel>Publisher *</InputLabel>
                <Select
                  value={newLocal.publisher_id || ''}
                  label="Publisher *"
                  onChange={(e) => setNewLocal({ ...newLocal, publisher_id: Number(e.target.value) })}
                >
                  {publishers.map((publisher) => (
                    <MenuItem key={publisher.publisher_id} value={publisher.publisher_id}>
                      {publisher.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <TextField
              label="Nome *"
              value={newLocal.name}
              onChange={(e) => setNewLocal({ ...newLocal, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Endereço"
              value={newLocal.address}
              onChange={(e) => setNewLocal({ ...newLocal, address: e.target.value })}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Cidade"
                value={newLocal.city}
                onChange={(e) => setNewLocal({ ...newLocal, city: e.target.value })}
                fullWidth
              />
              <TextField
                label="Estado"
                value={newLocal.state}
                onChange={(e) => setNewLocal({ ...newLocal, state: e.target.value })}
                fullWidth
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="CEP"
                value={newLocal.zip_code}
                onChange={(e) => setNewLocal({ ...newLocal, zip_code: e.target.value })}
                fullWidth
              />
              <TextField
                label="País"
                value={newLocal.country}
                onChange={(e) => setNewLocal({ ...newLocal, country: e.target.value })}
                fullWidth
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Latitude"
                type="number"
                value={newLocal.latitude || ''}
                onChange={(e) => setNewLocal({ ...newLocal, latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                fullWidth
              />
              <TextField
                label="Longitude"
                type="number"
                value={newLocal.longitude || ''}
                onChange={(e) => setNewLocal({ ...newLocal, longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                fullWidth
              />
            </Box>
            <TextField
              label="Timezone"
              value={newLocal.timezone}
              onChange={(e) => setNewLocal({ ...newLocal, timezone: e.target.value })}
              fullWidth
            />
            <TextField
              label="Descrição"
              value={newLocal.description}
              onChange={(e) => setNewLocal({ ...newLocal, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreateLocal} variant="contained">
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de Detalhes */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Detalhes do Local - {selectedLocal?.name}
        </DialogTitle>
        <DialogContent>
          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Tabs value={detailsTab} onChange={(_, newValue) => setDetailsTab(newValue)} sx={{ mb: 2 }}>
                <Tab label="Publisher" icon={<Business />} iconPosition="start" />
                <Tab label="Local" icon={<Store />} iconPosition="start" />
                <Tab label="Totens" icon={selectedTotems.length > 0 ? <Chip label={selectedTotems.length} size="small" color="primary" /> : <Computer />} iconPosition="end" />
                <Tab label="Smart TVs" icon={selectedSmartTvs.length > 0 ? <Chip label={selectedSmartTvs.length} size="small" color="primary" /> : <Tv />} iconPosition="end" />
                <Tab label="Contratos" icon={selectedContracts.length > 0 ? <Chip label={selectedContracts.length} size="small" color="primary" /> : <Assignment />} iconPosition="end" />
              </Tabs>

              {/* Aba Publisher */}
              {detailsTab === 0 && selectedPublisher && (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Nome da Empresa</TableCell>
                        <TableCell>{selectedPublisher.name}</TableCell>
                      </TableRow>
                      {selectedPublisher.email && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                          <TableCell>{selectedPublisher.email}</TableCell>
                        </TableRow>
                      )}
                      {selectedPublisher.phone && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Telefone</TableCell>
                          <TableCell>{selectedPublisher.phone}</TableCell>
                        </TableRow>
                      )}
                      {selectedPublisher.description && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Descrição</TableCell>
                          <TableCell>{selectedPublisher.description}</TableCell>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell>
                          <Chip
                            label={selectedPublisher.active ? 'Ativo' : 'Inativo'}
                            size="small"
                            color={selectedPublisher.active ? 'success' : 'error'}
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Aba Local */}
              {detailsTab === 1 && selectedLocal && (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Nome</TableCell>
                        <TableCell>{selectedLocal.name}</TableCell>
                      </TableRow>
                      {selectedLocal.address && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Endereço</TableCell>
                          <TableCell>{selectedLocal.address}</TableCell>
                        </TableRow>
                      )}
                      {selectedLocal.city && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Cidade</TableCell>
                          <TableCell>{selectedLocal.city}</TableCell>
                        </TableRow>
                      )}
                      {selectedLocal.state && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                          <TableCell>{selectedLocal.state}</TableCell>
                        </TableRow>
                      )}
                      {selectedLocal.zip_code && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>CEP</TableCell>
                          <TableCell>{selectedLocal.zip_code}</TableCell>
                        </TableRow>
                      )}
                      {selectedLocal.country && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>País</TableCell>
                          <TableCell>{selectedLocal.country}</TableCell>
                        </TableRow>
                      )}
                      {selectedLocal.latitude && selectedLocal.longitude && (
                        <>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Latitude</TableCell>
                            <TableCell>{selectedLocal.latitude}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Longitude</TableCell>
                            <TableCell>{selectedLocal.longitude}</TableCell>
                          </TableRow>
                        </>
                      )}
                      {selectedLocal.timezone && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Timezone</TableCell>
                          <TableCell>{selectedLocal.timezone}</TableCell>
                        </TableRow>
                      )}
                      {selectedLocal.description && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Descrição</TableCell>
                          <TableCell>{selectedLocal.description}</TableCell>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell>
                          <Chip
                            label={selectedLocal.is_active ? 'Ativo' : 'Inativo'}
                            size="small"
                            color={selectedLocal.is_active ? 'success' : 'error'}
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Aba Totens */}
              {detailsTab === 2 && (
                <Box>
                  {selectedTotems.length === 0 ? (
                    <Alert severity="info">Nenhum totem encontrado para este local</Alert>
                  ) : (
                    <List>
                      {selectedTotems.map((totem) => (
                        <ListItem key={totem.totem_id || totem.id} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                          <ListItemIcon>
                            <Computer />
                          </ListItemIcon>
                          <ListItemText
                            primary={totem.name || totem.identifier}
                            secondary={`Status: ${totem.status || 'N/A'} | Identifier: ${totem.identifier || 'N/A'}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              )}

              {/* Aba Smart TVs */}
              {detailsTab === 3 && (
                <Box>
                  {selectedSmartTvs.length === 0 ? (
                    <Alert severity="info">Nenhuma Smart TV encontrada para este local</Alert>
                  ) : (
                    <List>
                      {selectedSmartTvs.map((tv) => (
                        <ListItem key={tv.tv_id || tv.smart_tv_id || tv.id} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                          <ListItemIcon>
                            <Tv />
                          </ListItemIcon>
                          <ListItemText
                            primary={tv.name || tv.identifier}
                            secondary={`Status: ${tv.status || 'N/A'} | Identifier: ${tv.identifier || 'N/A'}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              )}

              {/* Aba Contratos */}
              {detailsTab === 4 && (
                <Box>
                  {selectedContracts.length === 0 ? (
                    <Alert severity="info">Nenhum contrato encontrado para este publisher</Alert>
                  ) : (
                    <List>
                      {selectedContracts.map((contract) => (
                        <ListItem key={contract.contract_id} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1, flexDirection: 'column', alignItems: 'stretch' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', width: '100%', mb: 1 }}>
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                {contract.contract_number} - {contract.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {contract.description || 'Sem descrição'}
                              </Typography>
                            </Box>
                            <Chip
                              label={contract.status || 'draft'}
                              color={
                                contract.status === 'active'
                                  ? 'success'
                                  : contract.status === 'expired' || contract.status === 'terminated' || contract.status === 'cancelled'
                                  ? 'error'
                                  : 'default'
                              }
                              size="small"
                            />
                          </Box>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                            {contract.contract_type && (
                              <Typography variant="caption" color="text.secondary">
                                Tipo: {contract.contract_type}
                              </Typography>
                            )}
                            {contract.start_date && (
                              <Typography variant="caption" color="text.secondary">
                                Início: {new Date(contract.start_date).toLocaleDateString('pt-BR')}
                              </Typography>
                            )}
                            {contract.end_date && (
                              <Typography variant="caption" color="text.secondary">
                                Fim: {new Date(contract.end_date).toLocaleDateString('pt-BR')}
                              </Typography>
                            )}
                          </Box>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDetailsDialogOpen(false);
            setSelectedLocal(null);
            setSelectedPublisher(null);
            setSelectedTotems([]);
            setSelectedSmartTvs([]);
            setSelectedContracts([]);
            setDetailsTab(0);
          }}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Editar Local</DialogTitle>
        <DialogContent>
          {selectedLocal && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              <TextField
                label="Nome *"
                value={selectedLocal.name}
                onChange={(e) => setSelectedLocal({ ...selectedLocal, name: e.target.value })}
                fullWidth
              />
              <TextField
                label="Endereço"
                value={selectedLocal.address || ''}
                onChange={(e) => setSelectedLocal({ ...selectedLocal, address: e.target.value })}
                fullWidth
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Cidade"
                  value={selectedLocal.city || ''}
                  onChange={(e) => setSelectedLocal({ ...selectedLocal, city: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Estado"
                  value={selectedLocal.state || ''}
                  onChange={(e) => setSelectedLocal({ ...selectedLocal, state: e.target.value })}
                  fullWidth
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="CEP"
                  value={selectedLocal.zip_code || ''}
                  onChange={(e) => setSelectedLocal({ ...selectedLocal, zip_code: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="País"
                  value={selectedLocal.country || ''}
                  onChange={(e) => setSelectedLocal({ ...selectedLocal, country: e.target.value })}
                  fullWidth
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Latitude"
                  type="number"
                  value={selectedLocal.latitude || ''}
                  onChange={(e) => setSelectedLocal({ ...selectedLocal, latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                  fullWidth
                />
                <TextField
                  label="Longitude"
                  type="number"
                  value={selectedLocal.longitude || ''}
                  onChange={(e) => setSelectedLocal({ ...selectedLocal, longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                  fullWidth
                />
              </Box>
              <TextField
                label="Timezone"
                value={selectedLocal.timezone || ''}
                onChange={(e) => setSelectedLocal({ ...selectedLocal, timezone: e.target.value })}
                fullWidth
              />
              <TextField
                label="Descrição"
                value={selectedLocal.description || ''}
                onChange={(e) => setSelectedLocal({ ...selectedLocal, description: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleEditLocal} variant="contained">
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Locals;

