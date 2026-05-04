import React, { useEffect, useMemo, useState } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Tv,
  Refresh,
  CheckCircle,
  Warning,
  Computer,
  Settings,
} from '@mui/icons-material';
import { smartTvApi, SmartTv, CreateSmartTvRequest, UpdateSmartTvRequest, totemApi, Totem } from '../../services/api';
import { useAppSelector } from '../../store';
import { getForeignTotemIdFromRow, getTotemIdFromRow } from '../../utils/totemRowIds';

const SmartTvs: React.FC = () => {
  const theme = useTheme();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = Boolean(
    (user?.isTenantUser ?? (user as any)?.is_tenant_user) ||
      ['admin', 'admin_sql', 'owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial'].includes(user?.role || '')
  );
  const userPublisherId = user?.publisherId;

  const [smartTvs, setSmartTvs] = useState<SmartTv[]>([]);
  const [totems, setTotems] = useState<Totem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSmartTv, setSelectedSmartTv] = useState<SmartTv | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [totemFilter, setTotemFilter] = useState<number | undefined>(undefined);
  const [publisherFilter, setPublisherFilter] = useState<number | undefined>(undefined);
  const [activeOnlyFilter, setActiveOnlyFilter] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [createTab, setCreateTab] = useState(0);
  const [editTab, setEditTab] = useState(0);
  const [capabilitiesText, setCapabilitiesText] = useState('');
  const [settingsText, setSettingsText] = useState('');
  const [editCapabilitiesText, setEditCapabilitiesText] = useState('');
  const [editSettingsText, setEditSettingsText] = useState('');
  const [newSmartTv, setNewSmartTv] = useState<CreateSmartTvRequest>({
    totem_id: 0,
    identifier: '',
    device_id: '',
    name: '',
    brand: '',
    model: '',
    platform: '',
    firmware_version: '',
    resolution_width: undefined,
    resolution_height: undefined,
    orientation: 'landscape',
    capabilities: undefined,
    settings: undefined,
  });

  useEffect(() => {
    loadSmartTvs();
    loadTotems();
  }, [totemFilter, publisherFilter, activeOnlyFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSmartTvs();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadTotems = async () => {
    try {
      // Backend limita paginação; manter compatível para evitar 400/429
      const response = await totemApi.getAll({ limit: 100 });
      // Filtrar totens por publisher se não for admin
      let filteredTotems = response.data || [];
      if (!isAdmin && userPublisherId) {
        // Filtrar totens do publisher do usuário
        // Nota: A API de totens precisa retornar publisher_id ou precisamos filtrar no frontend
        // Por enquanto, vamos carregar todos e filtrar depois se necessário
      }
      setTotems(filteredTotems);
    } catch (error) {
      console.error('Erro ao carregar totens:', error);
    }
  };

  const loadSmartTvs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await smartTvApi.getAll({
        search: searchTerm || undefined,
        totemId: totemFilter,
        publisherId: publisherFilter || (isAdmin ? undefined : userPublisherId),
        active_only: activeOnlyFilter,
      });
      setSmartTvs(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error('Erro ao carregar Smart TVs:', error);
      setError(error.response?.data?.error || 'Erro ao carregar lista de Smart TVs');
    } finally {
      setLoading(false);
    }
  };

  const tryParseJson = (text: string): any | undefined => {
    const trimmed = (text || '').trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error('JSON inválido');
    }
  };

  const handleCreateSmartTv = async () => {
    try {
      if (!newSmartTv.totem_id) {
        setError('Selecione um totem');
        return;
      }
      if (!newSmartTv.identifier) {
        setError('Identifier é obrigatório');
        return;
      }

      const parsedCapabilities = tryParseJson(capabilitiesText);
      const parsedSettings = tryParseJson(settingsText);

      await smartTvApi.create({
        ...newSmartTv,
        capabilities: parsedCapabilities,
        settings: parsedSettings,
      });
      setCreateDialogOpen(false);
      setCreateTab(0);
      setCapabilitiesText('');
      setSettingsText('');
      setNewSmartTv({
        totem_id: 0,
        identifier: '',
        device_id: '',
        name: '',
        brand: '',
        model: '',
        platform: '',
        firmware_version: '',
        resolution_width: undefined,
        resolution_height: undefined,
        orientation: 'landscape',
        capabilities: undefined,
        settings: undefined,
      });
      loadSmartTvs();
    } catch (error: any) {
      console.error('Erro ao criar Smart TV:', error);
      setError(error.response?.data?.error || error.message || 'Erro ao criar Smart TV');
    }
  };

  const handleEditSmartTv = async () => {
    if (!selectedSmartTv) return;
    
    try {
      const updateData: UpdateSmartTvRequest = {
        identifier: selectedSmartTv.identifier,
        device_id: selectedSmartTv.device_id,
        name: selectedSmartTv.name,
        brand: selectedSmartTv.brand,
        model: selectedSmartTv.model,
        platform: selectedSmartTv.platform,
        firmware_version: selectedSmartTv.firmware_version,
        resolution_width: selectedSmartTv.resolution_width,
        resolution_height: selectedSmartTv.resolution_height,
        orientation: selectedSmartTv.orientation,
        status: selectedSmartTv.status,
        capabilities: tryParseJson(editCapabilitiesText),
        settings: tryParseJson(editSettingsText),
        is_active: selectedSmartTv.is_active,
      };
      await smartTvApi.update(selectedSmartTv.smart_tv_id, updateData);
      setEditDialogOpen(false);
      setSelectedSmartTv(null);
      setEditTab(0);
      loadSmartTvs();
    } catch (error: any) {
      console.error('Erro ao atualizar Smart TV:', error);
      setError(error.response?.data?.error || error.message || 'Erro ao atualizar Smart TV');
    }
  };

  const handleDeleteSmartTv = async (tvId: number) => {
    if (!window.confirm('Tem certeza que deseja deletar esta Smart TV?')) {
      return;
    }
    
    try {
      await smartTvApi.delete(tvId);
      loadSmartTvs();
    } catch (error: any) {
      console.error('Erro ao deletar Smart TV:', error);
      setError(error.response?.data?.error || 'Erro ao deletar Smart TV');
    }
  };

  const handleOpenEditDialog = (smartTv: SmartTv) => {
    setSelectedSmartTv(smartTv);
    setEditTab(0);
    setEditCapabilitiesText(smartTv.capabilities ? JSON.stringify(smartTv.capabilities, null, 2) : '');
    setEditSettingsText(smartTv.settings ? JSON.stringify(smartTv.settings, null, 2) : '');
    setEditDialogOpen(true);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'playing':
        return 'success';
      case 'online':
        return 'info';
      case 'offline':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const smartTvsByTotem = useMemo(() => {
    const map = new Map<number, number>();
    for (const tv of smartTvs) {
      const tid = getForeignTotemIdFromRow(tv as Record<string, unknown>);
      if (tid !== undefined) {
        map.set(tid, (map.get(tid) || 0) + 1);
      }
    }
    return map;
  }, [smartTvs]);

  if (loading && smartTvs.length === 0) {
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
            📺 Smart TVs
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie Smart TVs vinculadas a Totens
          </Typography>
        </Box>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setCreateTab(0);
              setCapabilitiesText('');
              setSettingsText('');
              setCreateDialogOpen(true);
            }}
            sx={{
              backgroundColor: theme.palette.primary.main,
              '&:hover': { backgroundColor: theme.palette.primary.dark },
            }}
          >
            Nova Smart TV
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
                id="smart-tvs-search"
                name="search"
                fullWidth
                placeholder="Buscar Smart TVs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="smart-tvs-filter-totem-label">Totem</InputLabel>
                <Select
                  id="smart-tvs-filter-totem"
                  labelId="smart-tvs-filter-totem-label"
                  value={totemFilter || ''}
                  label="Totem"
                  onChange={(e) => setTotemFilter(e.target.value ? Number(e.target.value) : undefined)}
                  inputProps={{ name: 'totemFilter' }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {totems.map((totem, idx) => {
                    const totemId = getTotemIdFromRow(totem as Record<string, unknown>);
                    if (totemId === undefined) return null;
                    return (
                      <MenuItem key={`totem-${totemId}-${idx}`} value={totemId}>
                        {totem.name || totem.identifier || `Totem ${totemId}`} ({smartTvsByTotem.get(totemId) || 0})
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel id="smart-tvs-filter-status-label">Status</InputLabel>
                <Select
                  id="smart-tvs-filter-status"
                  labelId="smart-tvs-filter-status-label"
                  value={activeOnlyFilter ? 'active' : 'all'}
                  label="Status"
                  onChange={(e) => setActiveOnlyFilter(e.target.value === 'active')}
                  inputProps={{ name: 'activeOnlyFilter' }}
                >
                  <MenuItem value="active">Ativos</MenuItem>
                  <MenuItem value="all">Todos</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={1}>
              <Button fullWidth variant="outlined" startIcon={<Refresh />} onClick={loadSmartTvs}>
                Atualizar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {smartTvs.map((smartTv) => (
          <Grid item xs={12} sm={6} md={4} key={smartTv.smart_tv_id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[8] },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" component="h2">
                      {smartTv.name || smartTv.identifier}
                    </Typography>
                    {smartTv.totem_name && (
                      <Typography variant="caption" color="text.secondary">
                        Totem: {smartTv.totem_name}
                      </Typography>
                    )}
                    {smartTv.local_name && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Local: {smartTv.local_name}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={smartTv.status || 'offline'}
                    color={getStatusColor(smartTv.status) as any}
                    size="small"
                  />
                </Box>

                {smartTv.brand && smartTv.model && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {smartTv.brand} {smartTv.model}
                    </Typography>
                  </Box>
                )}

                {smartTv.platform && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Plataforma: {smartTv.platform}
                    </Typography>
                  </Box>
                )}

                {smartTv.resolution_width && smartTv.resolution_height && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Resolução: {smartTv.resolution_width}x{smartTv.resolution_height}
                    </Typography>
                  </Box>
                )}

                {smartTv.orientation && (
                  <Chip
                    label={smartTv.orientation === 'landscape' ? 'Paisagem' : 'Retrato'}
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                  />
                )}

                <Chip
                  label={smartTv.is_active ? 'Ativo' : 'Inativo'}
                  color={smartTv.is_active ? 'success' : 'default'}
                  size="small"
                  sx={{ mb: 1 }}
                />

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', mt: 2 }}>
                  <Tooltip title="Configurações (em breve)">
                    <span>
                      <IconButton size="small" disabled>
                        <Settings />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {isAdmin && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleOpenEditDialog(smartTv)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Deletar">
                        <IconButton size="small" color="error" onClick={() => handleDeleteSmartTv(smartTv.smart_tv_id)}>
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {smartTvs.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Tv sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Nenhuma Smart TV encontrada
          </Typography>
        </Box>
      )}

      {/* Dialog de Criação */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Criar Nova Smart TV</DialogTitle>
        <DialogContent>
          <Tabs
            value={createTab}
            onChange={(_, v) => setCreateTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ mb: 2 }}
          >
            <Tab label="Dados" />
            <Tab label="Config (JSON)" />
          </Tabs>

          {createTab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="smart-tv-create-totem-label">Totem *</InputLabel>
              <Select
                id="smart-tv-create-totem"
                labelId="smart-tv-create-totem-label"
                value={newSmartTv.totem_id || ''}
                label="Totem *"
                onChange={(e) => setNewSmartTv({ ...newSmartTv, totem_id: Number(e.target.value) })}
                inputProps={{ name: 'totem_id' }}
              >
                {totems.map((totem, idx) => {
                  const totemId = getTotemIdFromRow(totem as Record<string, unknown>);
                  if (totemId === undefined) return null;
                  return (
                    <MenuItem key={`totem-create-${totemId}-${idx}`} value={totemId}>
                      {totem.name || totem.identifier || `Totem ${totemId}`}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            <TextField
              id="smart-tv-create-identifier"
              name="identifier"
              label="Identifier *"
              value={newSmartTv.identifier}
              onChange={(e) => setNewSmartTv({ ...newSmartTv, identifier: e.target.value })}
              fullWidth
              required
            />
            <TextField
              id="smart-tv-create-device-id"
              name="device_id"
              label="Device ID"
              value={newSmartTv.device_id}
              onChange={(e) => setNewSmartTv({ ...newSmartTv, device_id: e.target.value })}
              fullWidth
            />
            <TextField
              id="smart-tv-create-name"
              name="name"
              label="Nome"
              value={newSmartTv.name}
              onChange={(e) => setNewSmartTv({ ...newSmartTv, name: e.target.value })}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                id="smart-tv-create-brand"
                name="brand"
                label="Marca"
                value={newSmartTv.brand}
                onChange={(e) => setNewSmartTv({ ...newSmartTv, brand: e.target.value })}
                fullWidth
              />
              <TextField
                id="smart-tv-create-model"
                name="model"
                label="Modelo"
                value={newSmartTv.model}
                onChange={(e) => setNewSmartTv({ ...newSmartTv, model: e.target.value })}
                fullWidth
              />
            </Box>
            <TextField
              id="smart-tv-create-platform"
              name="platform"
              label="Plataforma"
              value={newSmartTv.platform}
              onChange={(e) => setNewSmartTv({ ...newSmartTv, platform: e.target.value })}
              fullWidth
            />
            <TextField
              id="smart-tv-create-firmware-version"
              name="firmware_version"
              label="Versão do Firmware"
              value={newSmartTv.firmware_version}
              onChange={(e) => setNewSmartTv({ ...newSmartTv, firmware_version: e.target.value })}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                id="smart-tv-create-resolution-width"
                name="resolution_width"
                label="Largura (px)"
                type="number"
                value={newSmartTv.resolution_width || ''}
                onChange={(e) => setNewSmartTv({ ...newSmartTv, resolution_width: e.target.value ? parseInt(e.target.value) : undefined })}
                fullWidth
              />
              <TextField
                id="smart-tv-create-resolution-height"
                name="resolution_height"
                label="Altura (px)"
                type="number"
                value={newSmartTv.resolution_height || ''}
                onChange={(e) => setNewSmartTv({ ...newSmartTv, resolution_height: e.target.value ? parseInt(e.target.value) : undefined })}
                fullWidth
              />
            </Box>
            <FormControl fullWidth>
              <InputLabel id="smart-tv-create-orientation-label">Orientação</InputLabel>
              <Select
                id="smart-tv-create-orientation"
                labelId="smart-tv-create-orientation-label"
                value={newSmartTv.orientation}
                label="Orientação"
                onChange={(e) => setNewSmartTv({ ...newSmartTv, orientation: e.target.value as 'landscape' | 'portrait' })}
                inputProps={{ name: 'orientation' }}
              >
                <MenuItem value="landscape">Paisagem</MenuItem>
                <MenuItem value="portrait">Retrato</MenuItem>
              </Select>
            </FormControl>
            </Box>
          )}

          {createTab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              <TextField
                id="smart-tv-create-capabilities"
                name="capabilities"
                label="Capabilities (JSON)"
                value={capabilitiesText}
                onChange={(e) => setCapabilitiesText(e.target.value)}
                fullWidth
                multiline
                minRows={6}
                placeholder="{}"
              />
              <TextField
                id="smart-tv-create-settings"
                name="settings"
                label="Settings (JSON)"
                value={settingsText}
                onChange={(e) => setSettingsText(e.target.value)}
                fullWidth
                multiline
                minRows={6}
                placeholder="{}"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreateSmartTv} variant="contained">
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Editar Smart TV</DialogTitle>
        <DialogContent>
          {selectedSmartTv && (
            <>
              <Tabs
                value={editTab}
                onChange={(_, v) => setEditTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{ mb: 2 }}
              >
                <Tab label="Dados" />
                <Tab label="Config (JSON)" />
              </Tabs>

              {editTab === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              <TextField
                id="smart-tv-edit-identifier"
                name="identifier"
                label="Identifier *"
                value={selectedSmartTv.identifier}
                onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, identifier: e.target.value })}
                fullWidth
                required
              />
              <TextField
                id="smart-tv-edit-device-id"
                name="device_id"
                label="Device ID"
                value={selectedSmartTv.device_id || ''}
                onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, device_id: e.target.value })}
                fullWidth
              />
              <TextField
                id="smart-tv-edit-name"
                name="name"
                label="Nome"
                value={selectedSmartTv.name || ''}
                onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, name: e.target.value })}
                fullWidth
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  id="smart-tv-edit-brand"
                  name="brand"
                  label="Marca"
                  value={selectedSmartTv.brand || ''}
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, brand: e.target.value })}
                  fullWidth
                />
                <TextField
                  id="smart-tv-edit-model"
                  name="model"
                  label="Modelo"
                  value={selectedSmartTv.model || ''}
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, model: e.target.value })}
                  fullWidth
                />
              </Box>
              <TextField
                id="smart-tv-edit-platform"
                name="platform"
                label="Plataforma"
                value={selectedSmartTv.platform || ''}
                onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, platform: e.target.value })}
                fullWidth
              />
              <TextField
                id="smart-tv-edit-firmware-version"
                name="firmware_version"
                label="Versão do Firmware"
                value={selectedSmartTv.firmware_version || ''}
                onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, firmware_version: e.target.value })}
                fullWidth
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  id="smart-tv-edit-resolution-width"
                  name="resolution_width"
                  label="Largura (px)"
                  type="number"
                  value={selectedSmartTv.resolution_width || ''}
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, resolution_width: e.target.value ? parseInt(e.target.value) : undefined })}
                  fullWidth
                />
                <TextField
                  id="smart-tv-edit-resolution-height"
                  name="resolution_height"
                  label="Altura (px)"
                  type="number"
                  value={selectedSmartTv.resolution_height || ''}
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, resolution_height: e.target.value ? parseInt(e.target.value) : undefined })}
                  fullWidth
                />
              </Box>
              <FormControl fullWidth>
                <InputLabel id="smart-tv-edit-orientation-label">Orientação</InputLabel>
                <Select
                  id="smart-tv-edit-orientation"
                  labelId="smart-tv-edit-orientation-label"
                  value={selectedSmartTv.orientation || 'landscape'}
                  label="Orientação"
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, orientation: e.target.value as 'landscape' | 'portrait' })}
                  inputProps={{ name: 'orientation' }}
                >
                  <MenuItem value="landscape">Paisagem</MenuItem>
                  <MenuItem value="portrait">Retrato</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="smart-tv-edit-status-label">Status</InputLabel>
                <Select
                  id="smart-tv-edit-status"
                  labelId="smart-tv-edit-status-label"
                  value={selectedSmartTv.status || 'offline'}
                  label="Status"
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, status: e.target.value })}
                  inputProps={{ name: 'status' }}
                >
                  <MenuItem value="offline">Offline</MenuItem>
                  <MenuItem value="online">Online</MenuItem>
                  <MenuItem value="playing">Playing</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                </Select>
              </FormControl>
                </Box>
              )}

              {editTab === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                  <TextField
                    id="smart-tv-edit-capabilities"
                    name="capabilities"
                    label="Capabilities (JSON)"
                    value={editCapabilitiesText}
                    onChange={(e) => setEditCapabilitiesText(e.target.value)}
                    fullWidth
                    multiline
                    minRows={6}
                    placeholder="{}"
                  />
                  <TextField
                    id="smart-tv-edit-settings"
                    name="settings"
                    label="Settings (JSON)"
                    value={editSettingsText}
                    onChange={(e) => setEditSettingsText(e.target.value)}
                    fullWidth
                    multiline
                    minRows={6}
                    placeholder="{}"
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleEditSmartTv} variant="contained">
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SmartTvs;

