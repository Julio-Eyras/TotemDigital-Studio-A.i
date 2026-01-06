import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, Avatar, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Switch, Alert, Tab, Tabs, Badge, Tooltip, IconButton, LinearProgress, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Tv, Add, Refresh, LocationOn, CheckCircle, Pending, Warning, Settings } from '@mui/icons-material';
import { totemApi, Player, CreatePlayerRequest, localApi, Local } from '../../services/api';
import TotemRemoteControl from '../../components/TotemRemoteControl/TotemRemoteControl';
import { useAppSelector } from '../../store';

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

const Totems: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'admin';
  const userPublisherId = user?.publisherId;

  const [totems, setTotems] = useState<Player[]>([]);
  const [pendingTotems, setPendingTotems] = useState<Player[]>([]);
  const [locals, setLocals] = useState<Local[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [selectedTotem, setSelectedTotem] = useState<Player | null>(null);
  const [generateConfig, setGenerateConfig] = useState(true);
  const [approving, setApproving] = useState(false);
  const [newTotem, setNewTotem] = useState<CreatePlayerRequest>({ 
    identifier: '', 
    localId: 0,
    uin: '',
    deviceId: '',
    name: '',
    description: '',
    firmwareVersion: '',
  });
  const [tabValue, setTabValue] = useState(0);
  const [remoteControlOpen, setRemoteControlOpen] = useState(false);
  const [selectedTotemForControl, setSelectedTotemForControl] = useState<Player | null>(null);

  useEffect(() => {
    loadAll();
    loadLocals();
  }, []);

  const loadLocals = async () => {
    try {
      const response = await localApi.getAll({
        publisherId: isAdmin ? undefined : userPublisherId,
        active_only: true,
      });
      setLocals(response.data);
    } catch (error) {
      console.error('Erro ao carregar locals:', error);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const [resp, pendingResp] = await Promise.all([
        totemApi.getAll(),
        totemApi.getPending()
      ]);
      setTotems(resp.data || []);
      setPendingTotems(pendingResp.data || []);
    } catch (e: any) {
      setError('Erro ao carregar totems: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!newTotem.identifier) {
        setError('Identifier é obrigatório');
        return;
      }
      if (!newTotem.localId) {
        setError('Local é obrigatório');
        return;
      }
      await totemApi.create(newTotem);
      setCreateOpen(false);
      setNewTotem({ 
        identifier: '', 
        localId: 0,
        uin: '',
        deviceId: '',
        name: '',
        description: '',
        firmwareVersion: '',
      });
      setSuccess('Totem criado com sucesso');
      loadAll();
    } catch (e: any) {
      setError('Erro ao criar totem: ' + (e.response?.data?.error || e.message || 'Erro desconhecido'));
    }
  };

  const handleApprove = async () => {
    if (!selectedTotem) return;
    
    try {
      setApproving(true);
      const result = await totemApi.approve(selectedTotem.totem_id, generateConfig);
      setApproveOpen(false);
      setSelectedTotem(null);
      setSuccess(result.message || 'Totem aprovado com sucesso');
      if (result.encryptedConfigPath) {
        setSuccess((prev) => (prev || '') + ' Configuração encriptada gerada: ' + result.encryptedConfigPath);
      }
      loadAll();
    } catch (e: any) {
      setError('Erro ao aprovar totem: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setApproving(false);
    }
  };

  const openApproveDialog = (totem: Player) => {
    setSelectedTotem(totem);
    setApproveOpen(true);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'offline':
        return 'default';
      case 'error':
        return 'error';
      case 'pending_approval':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle fontSize="small" />;
      case 'pending_approval':
        return <Pending fontSize="small" />;
      case 'error':
        return <Warning fontSize="small" />;
      default:
        return <Tv fontSize="small" />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Gerenciamento de Totems
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        {isAdmin && (
          <Button startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>Adicionar Totem</Button>
        )}
        <Button startIcon={<Refresh />} variant="outlined" onClick={loadAll} disabled={loading}>Atualizar</Button>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Todos os Totems" />
          <Tab 
            label={
              <Badge badgeContent={pendingTotems.length} color="warning">
                Pendentes de Aprovação
              </Badge>
            } 
          />
        </Tabs>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {totems.length === 0 && !loading ? (
            <Grid item xs={12}>
              <Alert severity="info">Nenhum totem encontrado</Alert>
            </Grid>
          ) : (
            totems.map((t) => (
              <Grid item xs={12} sm={6} md={4} key={t.totem_id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: getStatusColor(t.status) === 'success' ? 'success.main' : 
                                          getStatusColor(t.status) === 'warning' ? 'warning.main' : 
                                          getStatusColor(t.status) === 'error' ? 'error.main' : 'default' }}>
                        {getStatusIcon(t.status)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {t.name || t.identifier || `Totem ${t.totem_id}`}
                        </Typography>
                        {t.uin && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            UIN: {t.uin}
                          </Typography>
                        )}
                        {t.location && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <LocationOn fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">{t.location}</Typography>
                          </Box>
                        )}
                      </Box>
                      <Chip 
                        size="small" 
                        label={t.status?.toUpperCase() || 'N/A'} 
                        color={getStatusColor(t.status) as any}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {pendingTotems.length === 0 && !loading ? (
            <Grid item xs={12}>
              <Alert severity="info">Nenhum totem pendente de aprovação</Alert>
            </Grid>
          ) : (
            pendingTotems.map((t) => (
              <Grid item xs={12} sm={6} md={4} key={t.totem_id}>
                <Card sx={{ border: '2px solid', borderColor: 'warning.main' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: 'warning.main' }}>
                        <Pending />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {t.name || t.identifier || `Totem ${t.totem_id}`}
                        </Typography>
                        {t.uin && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            UIN: {t.uin}
                          </Typography>
                        )}
                        {t.location && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <LocationOn fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">{t.location}</Typography>
                          </Box>
                        )}
                        {t.config?.hardware && (
                          <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Hardware: {t.config.hardware.mac || t.config.hardware.hostname || 'N/A'}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                    {isAdmin && (
                      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          startIcon={<CheckCircle />}
                          onClick={() => openApproveDialog(t)}
                          fullWidth
                        >
                          Aprovar
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </TabPanel>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Novo Totem</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Local *</InputLabel>
            <Select
              value={newTotem.localId || ''}
              label="Local *"
              onChange={(e) => setNewTotem({ ...newTotem, localId: Number(e.target.value) })}
            >
              {locals.map((local) => (
                <MenuItem key={local.local_id} value={local.local_id}>
                  {local.name} {local.publisher_name && `(${local.publisher_name})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField 
            fullWidth 
            label="Identifier *" 
            margin="normal" 
            value={newTotem.identifier} 
            onChange={(e) => setNewTotem({ ...newTotem, identifier: e.target.value })} 
            required
          />
          <TextField 
            fullWidth 
            label="UIN (Unique Identifier Number)" 
            margin="normal" 
            value={newTotem.uin || ''} 
            onChange={(e) => setNewTotem({ ...newTotem, uin: e.target.value })} 
            helperText="Número único de identificação do totem"
          />
          <TextField 
            fullWidth 
            label="Device ID" 
            margin="normal" 
            value={newTotem.deviceId || ''} 
            onChange={(e) => setNewTotem({ ...newTotem, deviceId: e.target.value })} 
          />
          <TextField 
            fullWidth 
            label="Nome" 
            margin="normal" 
            value={newTotem.name || ''} 
            onChange={(e) => setNewTotem({ ...newTotem, name: e.target.value })} 
          />
          <TextField 
            fullWidth 
            label="Descrição" 
            margin="normal" 
            value={newTotem.description || ''} 
            onChange={(e) => setNewTotem({ ...newTotem, description: e.target.value })} 
            multiline
            rows={2}
          />
          <TextField 
            fullWidth 
            label="Versão do Firmware" 
            margin="normal" 
            value={newTotem.firmwareVersion || ''} 
            onChange={(e) => setNewTotem({ ...newTotem, firmwareVersion: e.target.value })} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newTotem.identifier || !newTotem.localId}>Criar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Aprovar Totem</DialogTitle>
        <DialogContent>
          {selectedTotem && (
            <Box>
              <Typography variant="body1" gutterBottom>
                <strong>Nome:</strong> {selectedTotem.name || selectedTotem.identifier || `Totem ${selectedTotem.totem_id}`}
              </Typography>
              {selectedTotem.uin && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>UIN:</strong> {selectedTotem.uin}
                </Typography>
              )}
              {selectedTotem.location && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Localização:</strong> {selectedTotem.location}
                </Typography>
              )}
              {selectedTotem.config?.hardware && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>Informações de Hardware:</Typography>
                  {selectedTotem.config.hardware.mac && (
                    <Typography variant="body2">MAC: {selectedTotem.config.hardware.mac}</Typography>
                  )}
                  {selectedTotem.config.hardware.hostname && (
                    <Typography variant="body2">Hostname: {selectedTotem.config.hardware.hostname}</Typography>
                  )}
                  {selectedTotem.config.hardware.platform && (
                    <Typography variant="body2">Plataforma: {selectedTotem.config.hardware.platform}</Typography>
                  )}
                </Box>
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={generateConfig}
                    onChange={(e) => setGenerateConfig(e.target.checked)}
                  />
                }
                label="Gerar arquivo de configuração encriptado"
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveOpen(false)} disabled={approving}>Cancelar</Button>
          <Button 
            variant="contained" 
            color="success"
            onClick={handleApprove} 
            disabled={approving || !selectedTotem}
            startIcon={<CheckCircle />}
          >
            {approving ? 'Aprovando...' : 'Aprovar Totem'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Totems;
