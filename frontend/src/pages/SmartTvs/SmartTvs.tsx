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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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

const SmartTvs: React.FC = () => {
  const theme = useTheme();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'admin';
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

  const loadTotems = async () => {
    try {
      const response = await totemApi.getAll();
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
      setSmartTvs(response.data);
    } catch (error: any) {
      console.error('Erro ao carregar Smart TVs:', error);
      setError(error.response?.data?.error || 'Erro ao carregar lista de Smart TVs');
    } finally {
      setLoading(false);
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
      await smartTvApi.create(newSmartTv);
      setCreateDialogOpen(false);
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
      setError(error.response?.data?.error || 'Erro ao criar Smart TV');
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
        capabilities: selectedSmartTv.capabilities,
        settings: selectedSmartTv.settings,
        is_active: selectedSmartTv.is_active,
      };
      await smartTvApi.update(selectedSmartTv.tv_id, updateData);
      setEditDialogOpen(false);
      setSelectedSmartTv(null);
      loadSmartTvs();
    } catch (error: any) {
      console.error('Erro ao atualizar Smart TV:', error);
      setError(error.response?.data?.error || 'Erro ao atualizar Smart TV');
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

  if (loading && smartTvs.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Smart TVs
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
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

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <TextField
          label="Buscar"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              loadSmartTvs();
            }
          }}
          sx={{ flexGrow: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Totem</InputLabel>
          <Select
            value={totemFilter || ''}
            label="Totem"
            onChange={(e) => setTotemFilter(e.target.value ? Number(e.target.value) : undefined)}
          >
            <MenuItem value="">Todos</MenuItem>
            {totems.map((totem) => (
              <MenuItem key={totem.totem_id} value={totem.totem_id}>
                {totem.name || totem.identifier}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadSmartTvs}
        >
          Atualizar
        </Button>
      </Box>

      <Grid container spacing={3}>
        {smartTvs.map((smartTv) => (
          <Grid item xs={12} sm={6} md={4} key={smartTv.tv_id}>
            <Card>
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

                {isAdmin && (
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => handleOpenEditDialog(smartTv)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Deletar">
                      <IconButton size="small" color="error" onClick={() => handleDeleteSmartTv(smartTv.tv_id)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Totem *</InputLabel>
              <Select
                value={newSmartTv.totem_id || ''}
                label="Totem *"
                onChange={(e) => setNewSmartTv({ ...newSmartTv, totem_id: Number(e.target.value) })}
              >
                {totems.map((totem) => (
                  <MenuItem key={totem.totem_id} value={totem.totem_id}>
                    {totem.name || totem.identifier}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Identifier *"
              value={newSmartTv.identifier}
              onChange={(e) => setNewSmartTv({ ...newSmartTv, identifier: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Device ID"
              value={newSmartTv.device_id}
              onChange={(e) => setNewSmartTv({ ...newSmartTv, device_id: e.target.value })}
              fullWidth
            />
            <TextField
              label="Nome"
              value={newSmartTv.name}
              onChange={(e) => setNewSmartTv({ ...newSmartTv, name: e.target.value })}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Marca"
                value={newSmartTv.brand}
                onChange={(e) => setNewSmartTv({ ...newSmartTv, brand: e.target.value })}
                fullWidth
              />
              <TextField
                label="Modelo"
                value={newSmartTv.model}
                onChange={(e) => setNewSmartTv({ ...newSmartTv, model: e.target.value })}
                fullWidth
              />
            </Box>
            <TextField
              label="Plataforma"
              value={newSmartTv.platform}
              onChange={(e) => setNewSmartTv({ ...newSmartTv, platform: e.target.value })}
              fullWidth
            />
            <TextField
              label="Versão do Firmware"
              value={newSmartTv.firmware_version}
              onChange={(e) => setNewSmartTv({ ...newSmartTv, firmware_version: e.target.value })}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Largura (px)"
                type="number"
                value={newSmartTv.resolution_width || ''}
                onChange={(e) => setNewSmartTv({ ...newSmartTv, resolution_width: e.target.value ? parseInt(e.target.value) : undefined })}
                fullWidth
              />
              <TextField
                label="Altura (px)"
                type="number"
                value={newSmartTv.resolution_height || ''}
                onChange={(e) => setNewSmartTv({ ...newSmartTv, resolution_height: e.target.value ? parseInt(e.target.value) : undefined })}
                fullWidth
              />
            </Box>
            <FormControl fullWidth>
              <InputLabel>Orientação</InputLabel>
              <Select
                value={newSmartTv.orientation}
                label="Orientaçã"
                onChange={(e) => setNewSmartTv({ ...newSmartTv, orientation: e.target.value as 'landscape' | 'portrait' })}
              >
                <MenuItem value="landscape">Paisagem</MenuItem>
                <MenuItem value="portrait">Retrato</MenuItem>
              </Select>
            </FormControl>
          </Box>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              <TextField
                label="Identifier *"
                value={selectedSmartTv.identifier}
                onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, identifier: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Device ID"
                value={selectedSmartTv.device_id || ''}
                onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, device_id: e.target.value })}
                fullWidth
              />
              <TextField
                label="Nome"
                value={selectedSmartTv.name || ''}
                onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, name: e.target.value })}
                fullWidth
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Marca"
                  value={selectedSmartTv.brand || ''}
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, brand: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Modelo"
                  value={selectedSmartTv.model || ''}
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, model: e.target.value })}
                  fullWidth
                />
              </Box>
              <TextField
                label="Plataforma"
                value={selectedSmartTv.platform || ''}
                onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, platform: e.target.value })}
                fullWidth
              />
              <TextField
                label="Versão do Firmware"
                value={selectedSmartTv.firmware_version || ''}
                onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, firmware_version: e.target.value })}
                fullWidth
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Largura (px)"
                  type="number"
                  value={selectedSmartTv.resolution_width || ''}
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, resolution_width: e.target.value ? parseInt(e.target.value) : undefined })}
                  fullWidth
                />
                <TextField
                  label="Altura (px)"
                  type="number"
                  value={selectedSmartTv.resolution_height || ''}
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, resolution_height: e.target.value ? parseInt(e.target.value) : undefined })}
                  fullWidth
                />
              </Box>
              <FormControl fullWidth>
                <InputLabel>Orientação</InputLabel>
                <Select
                  value={selectedSmartTv.orientation || 'landscape'}
                  label="Orientaçã"
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, orientation: e.target.value as 'landscape' | 'portrait' })}
                >
                  <MenuItem value="landscape">Paisagem</MenuItem>
                  <MenuItem value="portrait">Retrato</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedSmartTv.status || 'offline'}
                  label="Status"
                  onChange={(e) => setSelectedSmartTv({ ...selectedSmartTv, status: e.target.value })}
                >
                  <MenuItem value="offline">Offline</MenuItem>
                  <MenuItem value="online">Online</MenuItem>
                  <MenuItem value="playing">Playing</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                </Select>
              </FormControl>
            </Box>
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

