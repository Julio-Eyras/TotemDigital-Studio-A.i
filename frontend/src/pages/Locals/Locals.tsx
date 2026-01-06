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
  Autocomplete,
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
  Map,
} from '@mui/icons-material';
import { localApi, Local, CreateLocalRequest, UpdateLocalRequest, publisherApi, Publisher } from '../../services/api';
import { useAppSelector } from '../../store';

const Locals: React.FC = () => {
  const theme = useTheme();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'admin';
  const userPublisherId = user?.publisherId;

  const [locals, setLocals] = useState<Local[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedLocal, setSelectedLocal] = useState<Local | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [publisherFilter, setPublisherFilter] = useState<number | undefined>(undefined);
  const [activeOnlyFilter, setActiveOnlyFilter] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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
      const response = await localApi.getAll({
        search: searchTerm || undefined,
        publisherId: publisherFilter || (isAdmin ? undefined : userPublisherId),
        active_only: activeOnlyFilter,
      });
      setLocals(response.data);
    } catch (error: any) {
      console.error('Erro ao carregar locals:', error);
      setError(error.response?.data?.error || 'Erro ao carregar lista de locais');
    } finally {
      setLoading(false);
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

  if (loading && locals.length === 0) {
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
          Locais
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
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

      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <TextField
          label="Buscar"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              loadLocals();
            }
          }}
          sx={{ flexGrow: 1 }}
        />
        {isAdmin && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
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
        )}
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadLocals}
        >
          Atualizar
        </Button>
      </Box>

      <Grid container spacing={3}>
        {locals.map((local) => (
          <Grid item xs={12} sm={6} md={4} key={local.local_id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" component="h2">
                      {local.name}
                    </Typography>
                    {local.publisher_name && (
                      <Typography variant="caption" color="text.secondary">
                        {local.publisher_name}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={local.is_active ? 'Ativo' : 'Inativo'}
                    color={local.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                {local.address && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <LocationOn fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {local.address}
                      {local.city && `, ${local.city}`}
                      {local.state && ` - ${local.state}`}
                    </Typography>
                  </Box>
                )}

                {local.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {local.description}
                  </Typography>
                )}

                {isAdmin && (
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
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
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

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

