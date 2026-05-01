import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Tab,
  Tabs,
  Badge,
  Tooltip,
  IconButton,
  LinearProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
} from '@mui/material';
import { Tv, Add, Refresh, LocationOn, CheckCircle, Pending, Warning, Settings, Edit } from '@mui/icons-material';
import { totemApi, Player, CreatePlayerRequest, UpdatePlayerRequest, localApi, Local } from '../../services/api';
import TotemRemoteControl from '../../components/TotemRemoteControl/TotemRemoteControl';
import { useAppSelector } from '../../store';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { TOTEMDIGITAL_COMPACT } from '../../config/featureFlags';

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

const compareByDisplayName = (a?: string, b?: string) =>
  String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base', numeric: true });

const Totems: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const theme = useTheme();
  const breadcrumbs = useBreadcrumbs();
  const [searchParams, setSearchParams] = useSearchParams();
  const normalizedRole = useMemo(
    () => String(user?.role || '').trim().toLowerCase(),
    [user?.role]
  );
  const canAdministerTotems = useMemo(() => {
    if (['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial', 'publisher_user'].includes(normalizedRole)) {
      return true;
    }
    return false;
  }, [normalizedRole]);
  const canCreateTotem = useMemo(() => {
    if (TOTEMDIGITAL_COMPACT) {
      return ['owner_system', 'admin', 'admin_sql'].includes(normalizedRole);
    }
    if (['admin', 'admin_sql', 'owner_system', 'operador_faturamento', 'operador_comercial', 'publisher_user'].includes(normalizedRole)) {
      return true;
    }
    return false;
  }, [normalizedRole]);
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
  const [editOpen, setEditOpen] = useState(false);
  const [editingTotem, setEditingTotem] = useState<Player | null>(null);
  const [editTotem, setEditTotem] = useState<UpdatePlayerRequest>({
    identifier: '',
    localId: 0,
    uin: '',
    deviceId: '',
    name: '',
    description: '',
    firmwareVersion: '',
    isActive: true,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [localFilter, setLocalFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    loadAll();
    loadLocals();
  }, []);

  useEffect(() => {
    if (TOTEMDIGITAL_COMPACT && tabValue !== 0) {
      setTabValue(0);
    }
  }, [tabValue]);

  const openCreateTotemDialog = useCallback(() => {
    setCreateOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
    if (!canCreateTotem) return;
    openCreateTotemDialog();
  }, [searchParams, setSearchParams, canCreateTotem, openCreateTotemDialog]);

  const loadLocals = async () => {
    try {
      const response = await localApi.getAll({
        publisherId: canAdministerTotems ? undefined : userPublisherId,
        active_only: true,
      });
      const localsData = Array.isArray(response.data) ? [...response.data] : [];
      localsData.sort((a: any, b: any) => compareByDisplayName(a?.name, b?.name));
      setLocals(localsData);
    } catch (error) {
      console.error('Erro ao carregar locals:', error);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const [resp, pendingResp] = await Promise.all([
        totemApi.getAll(),
        TOTEMDIGITAL_COMPACT ? Promise.resolve({ data: [] as Player[] } as any) : totemApi.getPending()
      ]);
      const totemsData = Array.isArray(resp.data) ? [...resp.data] : [];
      totemsData.sort((a: any, b: any) => compareByDisplayName(a?.name || a?.identifier, b?.name || b?.identifier));
      const pendingData = Array.isArray(pendingResp.data) ? [...pendingResp.data] : [];
      pendingData.sort((a: any, b: any) => compareByDisplayName(a?.name || a?.identifier, b?.name || b?.identifier));
      setTotems(totemsData);
      setPendingTotems(pendingData);
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
    const totemId = (selectedTotem as any).totem_id;
    if (!totemId) return;
    
    try {
      setApproving(true);
      const result = await totemApi.approve(totemId, generateConfig);
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

  const resolveLocalIdFromTotem = (totem: any): number => {
    const directLocalId = Number(
      (totem as any).localId ??
      (totem as any).local_id ??
      (totem as any).local?.local_id ??
      (totem as any).local?.id ??
      0
    );
    if (directLocalId > 0) return directLocalId;

    // Fallback por nome exibido do local no card/lista.
    const locationName = String((totem as any).location ?? (totem as any).localName ?? '').trim().toLowerCase();
    if (!locationName) return 0;
    const matchedLocal = locals.find((l) => String(l.name || '').trim().toLowerCase() === locationName);
    return matchedLocal?.local_id || 0;
  };

  const openEditTotemDialog = (totem: Player) => {
    const resolvedLocalId = resolveLocalIdFromTotem(totem);

    setEditingTotem(totem);
    setEditTotem({
      identifier: totem.identifier || '',
      localId: resolvedLocalId,
      uin: totem.uin || '',
      deviceId: (totem as any).deviceId || '',
      name: totem.name || '',
      description: (totem as any).description || '',
      firmwareVersion: (totem as any).firmwareVersion || '',
      isActive: (totem as any).is_active !== false,
    });

    // Garante que o local atual do totem apareça no Select mesmo se não vier na lista carregada.
    if (resolvedLocalId > 0 && !locals.some((l) => l.local_id === resolvedLocalId)) {
      localApi.getById(resolvedLocalId)
        .then((local) => {
          if (!local?.local_id) return;
          setLocals((prev) => (prev.some((l) => l.local_id === local.local_id) ? prev : [...prev, local]));
        })
        .catch(() => {
          // Silencioso: mantém diálogo aberto mesmo se o local não puder ser carregado.
        });
    }

    // Em alguns cenários o endpoint de listagem não traz localId de forma consistente.
    // Fazemos fallback no endpoint de detalhe para pré-selecionar corretamente.
    if (resolvedLocalId <= 0) {
      const totemId = Number((totem as any).totem_id ?? (totem as any).id ?? 0);
      if (totemId > 0) {
        totemApi.getById(totemId)
          .then((fullTotem) => {
            const fallbackLocalId = resolveLocalIdFromTotem(fullTotem as any);
            if (fallbackLocalId <= 0) return;

            setEditTotem((prev) => ({ ...prev, localId: fallbackLocalId }));

            if (!locals.some((l) => l.local_id === fallbackLocalId)) {
              localApi.getById(fallbackLocalId)
                .then((local) => {
                  if (!local?.local_id) return;
                  setLocals((prev) => (prev.some((l) => l.local_id === local.local_id) ? prev : [...prev, local]));
                })
                .catch(() => {
                  // Silencioso: não bloqueia edição.
                });
            }
          })
          .catch(() => {
            // Silencioso: mantém fluxo de edição com dados já disponíveis.
          });
      }
    }

    setEditOpen(true);
  };

  const handleEdit = async () => {
    const totemId = Number((editingTotem as any)?.totem_id);
    if (!totemId) {
      setError('Totem inválido para edição');
      return;
    }
    if (!editTotem.identifier || !editTotem.localId) {
      setError('Identifier e local são obrigatórios para edição');
      return;
    }

    try {
      const normalizedIdentifier = String(editTotem.identifier || '').trim();
      const normalizedLocalId = Number(editTotem.localId || 0);
      const normalizedPayload: UpdatePlayerRequest = {
        identifier: normalizedIdentifier,
        localId: normalizedLocalId,
        isActive: Boolean(editTotem.isActive),
      };

      const optionalFields: Array<keyof UpdatePlayerRequest> = ['uin', 'deviceId', 'name', 'description', 'firmwareVersion'];
      optionalFields.forEach((field) => {
        const raw = (editTotem as any)[field];
        const value = typeof raw === 'string' ? raw.trim() : raw;
        if (typeof value === 'string' && value.length > 0) {
          (normalizedPayload as any)[field] = value;
        }
      });

      await totemApi.update(totemId, normalizedPayload);
      setSuccess('Totem atualizado com sucesso');
      setEditOpen(false);
      setEditingTotem(null);
      await loadAll();
    } catch (e: any) {
      setError('Erro ao editar totem: ' + (e?.response?.data?.error || e?.message || 'Erro desconhecido'));
    }
  };

  const openApproveDialog = (totem: Player) => {
    setSelectedTotem(totem);
    setApproveOpen(true);
  };

  const openRemoteControl = (totem: Player) => {
    setSelectedTotemForControl(totem);
    setRemoteControlOpen(true);
  };

  const filteredTotems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (totems || []).filter((t: any) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;

      if (localFilter !== 'all') {
        const totemLocalId = Number(t.localId ?? t.local_id);
        if (!Number.isNaN(totemLocalId) && totemLocalId !== localFilter) return false;

        // Fallback: comparar por nome do local no campo location
        const localName = locals.find((l) => l.local_id === localFilter)?.name;
        if (localName && typeof t.location === 'string') {
          if (!t.location.toLowerCase().includes(localName.toLowerCase())) return false;
        } else if (Number.isNaN(totemLocalId)) {
          // Sem como inferir o local
          return false;
        }
      }

      if (!q) return true;
      const name = (t.name || t.identifier || '').toLowerCase();
      const uin = (t.uin || '').toLowerCase();
      const location = (t.location || '').toLowerCase();
      return name.includes(q) || uin.includes(q) || location.includes(q);
    });
  }, [locals, localFilter, searchTerm, statusFilter, totems]);

  const filteredPendingTotems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (pendingTotems || []).filter((t: any) => {
      // Pendentes já têm status próprio, mas respeitamos filtro se usuário quiser
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;

      if (localFilter !== 'all') {
        const totemLocalId = Number(t.localId ?? t.local_id);
        if (!Number.isNaN(totemLocalId) && totemLocalId !== localFilter) return false;
        const localName = locals.find((l) => l.local_id === localFilter)?.name;
        if (localName && typeof t.location === 'string') {
          if (!t.location.toLowerCase().includes(localName.toLowerCase())) return false;
        } else if (Number.isNaN(totemLocalId)) {
          return false;
        }
      }

      if (!q) return true;
      const name = (t.name || t.identifier || '').toLowerCase();
      const uin = (t.uin || '').toLowerCase();
      const location = (t.location || '').toLowerCase();
      return name.includes(q) || uin.includes(q) || location.includes(q);
    });
  }, [locals, localFilter, pendingTotems, searchTerm, statusFilter]);

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
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      <PageHeader
        title="Totens"
        subtitle={
          TOTEMDIGITAL_COMPACT
            ? 'Gerencie totens da instalação'
            : 'Gerencie totens, aprovações e controle remoto'
        }
        breadcrumbs={breadcrumbs}
        actions={[
          ...(canCreateTotem ? [{
            label: 'Criar Totem',
            icon: <Add />,
            onClick: () => openCreateTotemDialog(),
            variant: 'contained' as const,
          }] : []),
        ]}
        onRefresh={loadAll}
        loading={loading}
      />

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

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar totems..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Local</InputLabel>
                <Select
                  value={localFilter}
                  label="Local"
                  onChange={(e) => setLocalFilter((e.target.value as any) || 'all')}
                >
                  <MenuItem value="all">Todos</MenuItem>
                  {locals.map((l) => (
                    <MenuItem key={l.local_id} value={l.local_id}>
                      {l.name} {l.publisher_name ? `(${l.publisher_name})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="online">Online</MenuItem>
                  <MenuItem value="offline">Offline</MenuItem>
                  <MenuItem value="error">Erro</MenuItem>
                  {!TOTEMDIGITAL_COMPACT && <MenuItem value="pending_approval">Pendente</MenuItem>}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Todos os Totems" />
          {!TOTEMDIGITAL_COMPACT && (
            <Tab 
              label={
                <Badge badgeContent={pendingTotems.length} color="warning">
                  Pendentes de Aprovação
                </Badge>
              } 
            />
          )}
        </Tabs>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {filteredTotems.length === 0 && !loading ? (
            <Grid item xs={12}>
              <Alert severity="info">Nenhum totem encontrado</Alert>
            </Grid>
          ) : (
            filteredTotems.map((t, idx) => {
              const totemKey = String((t as any).totem_id ?? (t as any).identifier ?? idx);
              const totemId = Number((t as any).totem_id ?? (t as any).id ?? 0) || null;
              return (
              <Grid item xs={12} sm={6} md={4} key={totemKey}>
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
                        {/* Indicar se foi forçado online */}
                        {(t.forced_online_until || (t as any).forced_online_until || (t as any).forcedOnlineUntil) && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            Forçado online até: {new Date((t.forced_online_until || (t as any).forcedOnlineUntil)).toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                      <Chip 
                        size="small" 
                        label={t.status?.toUpperCase() || 'N/A'} 
                        color={getStatusColor(t.status) as any}
                      />
                    </Box>
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        {canAdministerTotems && totemId && (
                          <Tooltip title="Editar totem">
                            <IconButton
                              size="small"
                              onClick={() => openEditTotemDialog(t)}
                            >
                              <Edit />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Controle remoto">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => openRemoteControl(t)}
                              disabled={!totemId}
                            >
                              <Settings />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {canAdministerTotems && totemId && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Refresh />}
                            onClick={async () => {
                              try {
                                await totemApi.heartbeat(totemId, 'online', { note: 'manual_refresh_from_ui' });
                                setSuccess('Heartbeat forçado com sucesso');
                                await loadAll();
                              } catch (err: any) {
                                console.error('Erro ao forçar heartbeat:', err);
                                setError('Erro ao forçar heartbeat: ' + (err?.response?.data?.error || err?.message || 'Erro desconhecido'));
                              }
                            }}
                          >
                            Forçar heartbeat
                          </Button>
                        )}
                      {canAdministerTotems && totemId && (t.status === 'offline' || t.status === 'error') && (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={async () => {
                            try {
                              await totemApi.forceOnline(totemId, 30);
                              setSuccess('Totem forçado online por 30 minutos');
                              await loadAll();
                            } catch (err: any) {
                              console.error('Erro ao forçar online:', err);
                              setError('Erro ao forçar online: ' + (err?.response?.data?.error || err?.message || 'Erro desconhecido'));
                            }
                          }}
                        >
                          Forçar online (30m)
                        </Button>
                      )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
            })
          )}
        </Grid>
      </TabPanel>

      {!TOTEMDIGITAL_COMPACT && (
        <TabPanel value={tabValue} index={1}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Totens <strong>pré-cadastrados</strong> pelo publisher que já <strong>vincularam hardware</strong> (conectaram pela primeira vez) e aguardam sua aprovação para ficarem ativos. Após aprovar, o totem poderá receber playlists.
          </Alert>
          <Grid container spacing={3}>
            {filteredPendingTotems.length === 0 && !loading ? (
              <Grid item xs={12}>
                <Alert severity="info">Nenhum totem pendente de aprovação. Totens aparecem aqui quando são pré-cadastrados e o hardware se conecta pela primeira vez.</Alert>
              </Grid>
            ) : (
              filteredPendingTotems.map((t, idx) => {
                const totemKey = String((t as any).totem_id ?? (t as any).identifier ?? `pending-${idx}`);
                return (
                <Grid item xs={12} sm={6} md={4} key={totemKey}>
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
                              <Typography variant="caption" color="text.secondary" component="div">
                                <strong>Hardware vinculado:</strong> {t.config.hardware.mac || t.config.hardware.hostname || 'N/A'}
                                {t.config.hardware.platform && ` • ${t.config.hardware.platform}`}
                              </Typography>
                              {t.config.hardware.linkedAt && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  Vinculado em: {new Date(t.config.hardware.linkedAt).toLocaleString()}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Box>
                      {canAdministerTotems && (
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
              );
              })
            )}
          </Grid>
        </TabPanel>
      )}

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

      <Dialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditingTotem(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Editar Totem</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Local *</InputLabel>
            <Select
              value={editTotem.localId || ''}
              label="Local *"
              onChange={(e) => setEditTotem({ ...editTotem, localId: Number(e.target.value) })}
            >
              {locals.map((local) => (
                <MenuItem key={local.local_id} value={local.local_id}>
                  {local.name} {local.publisher_name && `(${local.publisher_name})`}
                </MenuItem>
              ))}
            </Select>
            {!editTotem.localId && (
              <FormHelperText error>
                Nao foi possivel identificar automaticamente o local deste totem no escopo atual. Selecione o local manualmente.
              </FormHelperText>
            )}
          </FormControl>
          <TextField
            fullWidth
            label="Identifier *"
            margin="normal"
            value={editTotem.identifier || ''}
            onChange={(e) => setEditTotem({ ...editTotem, identifier: e.target.value })}
            required
          />
          <TextField
            fullWidth
            label="UIN (Unique Identifier Number)"
            margin="normal"
            value={editTotem.uin || ''}
            onChange={(e) => setEditTotem({ ...editTotem, uin: e.target.value })}
          />
          <TextField
            fullWidth
            label="Device ID"
            margin="normal"
            value={editTotem.deviceId || ''}
            onChange={(e) => setEditTotem({ ...editTotem, deviceId: e.target.value })}
          />
          <TextField
            fullWidth
            label="Nome"
            margin="normal"
            value={editTotem.name || ''}
            onChange={(e) => setEditTotem({ ...editTotem, name: e.target.value })}
          />
          <TextField
            fullWidth
            label="Descrição"
            margin="normal"
            value={editTotem.description || ''}
            onChange={(e) => setEditTotem({ ...editTotem, description: e.target.value })}
            multiline
            rows={2}
          />
          <TextField
            fullWidth
            label="Versão do Firmware"
            margin="normal"
            value={editTotem.firmwareVersion || ''}
            onChange={(e) => setEditTotem({ ...editTotem, firmwareVersion: e.target.value })}
          />
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                checked={editTotem.isActive !== false}
                onChange={(e) => setEditTotem({ ...editTotem, isActive: e.target.checked })}
              />
            }
            label="Totem ativo"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditOpen(false);
              setEditingTotem(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleEdit}
            disabled={!editTotem.identifier || !editTotem.localId}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={remoteControlOpen}
        onClose={() => {
          setRemoteControlOpen(false);
          setSelectedTotemForControl(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Controle remoto — {selectedTotemForControl?.name || selectedTotemForControl?.identifier || `Totem ${selectedTotemForControl?.totem_id || ''}`}
        </DialogTitle>
        <DialogContent>
          {selectedTotemForControl?.totem_id ? (
            <TotemRemoteControl
              totemId={selectedTotemForControl.totem_id}
              totemName={selectedTotemForControl.name || selectedTotemForControl.identifier}
              onClose={() => {
                setRemoteControlOpen(false);
                setSelectedTotemForControl(null);
              }}
            />
          ) : (
            <Alert severity="warning">Selecione um totem válido para abrir o controle remoto.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRemoteControlOpen(false);
              setSelectedTotemForControl(null);
            }}
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Aprovar Totem (pré-cadastrado, hardware vinculado)</DialogTitle>
        <DialogContent>
          {selectedTotem && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Totem pré-cadastrado pelo publisher que vinculou hardware. Aprovar para ativar e permitir recebimento de playlists.
              </Typography>
                <Typography variant="body1" gutterBottom sx={{ mt: 2 }}>
                <strong>Nome:</strong> {selectedTotem.name || selectedTotem.identifier || `Totem ${(selectedTotem as any).totem_id}`}
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
                  <Typography variant="subtitle2" gutterBottom>Informações de Hardware vinculado:</Typography>
                  {selectedTotem.config.hardware.mac && (
                    <Typography variant="body2">MAC: {selectedTotem.config.hardware.mac}</Typography>
                  )}
                  {selectedTotem.config.hardware.hostname && (
                    <Typography variant="body2">Hostname: {selectedTotem.config.hardware.hostname}</Typography>
                  )}
                  {selectedTotem.config.hardware.platform && (
                    <Typography variant="body2">Plataforma: {selectedTotem.config.hardware.platform}</Typography>
                  )}
                  {selectedTotem.config.hardware.arch && (
                    <Typography variant="body2">Arquitetura: {selectedTotem.config.hardware.arch}</Typography>
                  )}
                  {selectedTotem.config.hardware.linkedAt && (
                    <Typography variant="body2" color="text.secondary">
                      Vinculado em: {new Date(selectedTotem.config.hardware.linkedAt).toLocaleString()}
                    </Typography>
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
