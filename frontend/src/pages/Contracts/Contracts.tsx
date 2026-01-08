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
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  useTheme,
  alpha,
  LinearProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Description,
  Refresh,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Business,
  People,
  Assignment,
  CalendarToday,
  AttachMoney,
  Link as LinkIcon,
} from '@mui/icons-material';
import {
  contractApi,
  Contract,
  CreateContractRequest,
  UpdateContractRequest,
  subscriberApi,
  Subscriber,
  publisherApi,
  Publisher,
  planApi,
  Plan,
} from '../../services/api';

const Contracts: React.FC = () => {
  const theme = useTheme();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [contractTypeFilter, setContractTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  
  // Estados para abas no dialog
  const [createTab, setCreateTab] = useState(0);
  const [editTab, setEditTab] = useState(0);
  
  // Estados para formulário de criação/edição
  const [contractForm, setContractForm] = useState<CreateContractRequest>({
    subscriber_id: 0,
    plan_id: undefined,
    contract_number: '',
    contract_type: 'advertising',
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    total_amount: undefined,
    currency: 'BRL',
    payment_terms: '',
    status: 'draft',
    is_active: false,
    publisherIds: [],
  });
  
  // Estados para dados relacionados
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [contractPublishers, setContractPublishers] = useState<any[]>([]);
  const [loadingPublishers, setLoadingPublishers] = useState(false);
  
  // Estados para seleção de publishers
  const [selectedPublisherIds, setSelectedPublisherIds] = useState<number[]>([]);

  useEffect(() => {
    loadContracts();
    loadSubscribers();
    loadPublishers();
    loadPlans();
  }, [contractTypeFilter, statusFilter]);

  // Carregar publishers do contrato quando editar
  useEffect(() => {
    if (editDialogOpen && selectedContract) {
      loadContractPublishers(selectedContract.contract_id);
      setSelectedPublisherIds(contractPublishers.map((p: any) => p.publisher_id));
    }
  }, [editDialogOpen, selectedContract?.contract_id]);

  const loadContracts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await contractApi.getAll({
        search: searchTerm || undefined,
        contractType: contractTypeFilter !== 'all' ? contractTypeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        activeOnly: false,
      });
      setContracts(response.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar contratos:', error);
      setError('Erro ao carregar lista de contratos');
    } finally {
      setLoading(false);
    }
  };

  const loadSubscribers = async () => {
    try {
      const response = await subscriberApi.getAll({ active_only: false });
      setSubscribers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar subscribers:', error);
    }
  };

  const loadPublishers = async () => {
    try {
      const response = await publisherApi.getAll({ active_only: false });
      setPublishers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar publishers:', error);
    }
  };

  const loadPlans = async () => {
    try {
      const plansData = await planApi.getAll(true);
      setPlans(plansData || []);
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
    }
  };

  const loadContractPublishers = async (contractId: number) => {
    try {
      setLoadingPublishers(true);
      const publishersData = await contractApi.getPublishers(contractId);
      setContractPublishers(publishersData || []);
      setSelectedPublisherIds(publishersData.map((p: any) => p.publisher_id));
    } catch (error) {
      console.error('Erro ao carregar publishers do contrato:', error);
    } finally {
      setLoadingPublishers(false);
    }
  };

  const handleCreateContract = async () => {
    try {
      if (!contractForm.subscriber_id || !contractForm.contract_number || !contractForm.title || !contractForm.start_date) {
        setError('Preencha todos os campos obrigatórios');
        setCreateTab(0);
        return;
      }

      const contractData: CreateContractRequest = {
        ...contractForm,
        publisherIds: selectedPublisherIds,
      };

      await contractApi.create(contractData);
      setCreateDialogOpen(false);
      resetForm();
      loadContracts();
    } catch (error: any) {
      console.error('Erro ao criar contrato:', error);
      setError(error?.response?.data?.error || error?.message || 'Erro ao criar contrato');
    }
  };

  const handleEditContract = async () => {
    if (!selectedContract) return;

    try {
      const updateData: UpdateContractRequest = {
        plan_id: contractForm.plan_id,
        contract_number: contractForm.contract_number,
        contract_type: contractForm.contract_type,
        title: contractForm.title,
        description: contractForm.description,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date,
        total_amount: contractForm.total_amount,
        currency: contractForm.currency,
        payment_terms: contractForm.payment_terms,
        status: contractForm.status,
        is_active: contractForm.is_active,
        publisherIds: selectedPublisherIds,
      };

      await contractApi.update(selectedContract.contract_id, updateData);
      setEditDialogOpen(false);
      resetForm();
      loadContracts();
    } catch (error: any) {
      console.error('Erro ao atualizar contrato:', error);
      setError(error?.response?.data?.error || error?.message || 'Erro ao atualizar contrato');
    }
  };

  const handleDeleteContract = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este contrato?')) return;

    try {
      await contractApi.delete(id);
      loadContracts();
    } catch (error: any) {
      console.error('Erro ao excluir contrato:', error);
      setError(error?.response?.data?.error || error?.message || 'Erro ao excluir contrato');
    }
  };

  const handleStartEdit = (contract: Contract) => {
    setSelectedContract(contract);
    setContractForm({
      subscriber_id: contract.subscriber_id,
      plan_id: contract.plan_id,
      contract_number: contract.contract_number,
      contract_type: contract.contract_type,
      title: contract.title,
      description: contract.description || '',
      start_date: contract.start_date,
      end_date: contract.end_date || '',
      total_amount: contract.total_amount,
      currency: contract.currency,
      payment_terms: contract.payment_terms || '',
      status: contract.status,
      is_active: contract.is_active,
      publisherIds: [],
    });
    setEditDialogOpen(true);
    setEditTab(0);
  };

  const resetForm = () => {
    setContractForm({
      subscriber_id: 0,
      plan_id: undefined,
      contract_number: '',
      contract_type: 'advertising',
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      total_amount: undefined,
      currency: 'BRL',
      payment_terms: '',
      status: 'draft',
      is_active: false,
      publisherIds: [],
    });
    setSelectedPublisherIds([]);
    setContractPublishers([]);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'draft': return 'default';
      case 'expired': return 'warning';
      case 'terminated': return 'error';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'draft': return 'Rascunho';
      case 'expired': return 'Expirado';
      case 'terminated': return 'Terminado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const getContractTypeLabel = (type: string) => {
    switch (type) {
      case 'advertising': return 'Publicidade';
      case 'subscription': return 'Assinatura';
      case 'partnership': return 'Parceria';
      default: return type;
    }
  };

  const handleTogglePublisher = (publisherId: number) => {
    setSelectedPublisherIds((prev) => {
      if (prev.includes(publisherId)) {
        return prev.filter((id) => id !== publisherId);
      } else {
        return [...prev, publisherId];
      }
    });
  };

  if (loading && contracts.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando contratos...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            📄 Contratos
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie contratos de Assinantes e Publicadores
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            resetForm();
            setCreateDialogOpen(true);
            setCreateTab(0);
          }}
          sx={{
            backgroundColor: theme.palette.primary.main,
            '&:hover': { backgroundColor: theme.palette.primary.dark }
          }}
        >
          Adicionar Contrato
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Buscar contratos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    loadContracts();
                  }
                }}
                InputProps={{
                  startAdornment: <Description sx={{ mr: 1, color: theme.palette.text.secondary }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={contractTypeFilter}
                  label="Tipo"
                  onChange={(e) => setContractTypeFilter(e.target.value)}
                >
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="advertising">Publicidade</MenuItem>
                  <MenuItem value="subscription">Assinatura</MenuItem>
                  <MenuItem value="partnership">Parceria</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="draft">Rascunho</MenuItem>
                  <MenuItem value="active">Ativo</MenuItem>
                  <MenuItem value="expired">Expirado</MenuItem>
                  <MenuItem value="terminated">Terminado</MenuItem>
                  <MenuItem value="cancelled">Cancelado</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadContracts}
              >
                Atualizar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Contracts Grid */}
      <Grid container spacing={3}>
        {contracts.map((contract) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={contract.contract_id}>
            <Card sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[8],
              }
            }}>
              <Box sx={{ position: 'relative', height: 120, backgroundColor: theme.palette.grey[100] }}>
                <Avatar
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                  }}
                >
                  <Description />
                </Avatar>

                <Chip
                  label={getStatusLabel(contract.status)}
                  size="small"
                  color={getStatusColor(contract.status) as any}
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    fontWeight: 'bold',
                  }}
                />

                <Box sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: 16,
                  right: 16,
                }}>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    {formatDate(contract.created_at)}
                  </Typography>
                </Box>
              </Box>

              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
                  {contract.title}
                </Typography>

                <Chip
                  label={getContractTypeLabel(contract.contract_type)}
                  size="small"
                  color="primary"
                  sx={{ mb: 1 }}
                />

                {contract.subscriber_name && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <People fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {contract.subscriber_name}
                    </Typography>
                  </Box>
                )}

                {contract.contract_number && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Assignment fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {contract.contract_number}
                    </Typography>
                  </Box>
                )}

                {contract.start_date && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <CalendarToday fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      {formatDate(contract.start_date)} {contract.end_date && `- ${formatDate(contract.end_date)}`}
                    </Typography>
                  </Box>
                )}

                {contract.total_amount && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <AttachMoney fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      {contract.currency} {contract.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => handleStartEdit(contract)}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir">
                    <IconButton size="small" onClick={() => handleDeleteContract(contract.contract_id)}>
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {contracts.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <Description sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhum contrato encontrado
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece adicionando seus primeiros contratos
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                resetForm();
                setCreateDialogOpen(true);
              }}
            >
              Adicionar Primeiro Contrato
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog com Abas */}
      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          resetForm();
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Adicionar Contrato</DialogTitle>
        <DialogContent>
          <Tabs value={createTab} onChange={(_, newValue) => setCreateTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Informações" />
            <Tab label="Publicadores" icon={selectedPublisherIds.length > 0 ? <Chip label={selectedPublisherIds.length} size="small" color="primary" /> : undefined} iconPosition="end" />
          </Tabs>

          {/* Aba Informações */}
          {createTab === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Dados do Contrato</Typography>

              <FormControl fullWidth margin="normal" required>
                <InputLabel>Assinante *</InputLabel>
                <Select
                  value={contractForm.subscriber_id || ''}
                  label="Assinante *"
                  onChange={(e) => setContractForm({ ...contractForm, subscriber_id: Number(e.target.value) })}
                >
                  {subscribers.map((subscriber) => (
                    <MenuItem key={subscriber.subscriber_id} value={subscriber.subscriber_id}>
                      {subscriber.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Número do Contrato *"
                value={contractForm.contract_number}
                onChange={(e) => setContractForm({ ...contractForm, contract_number: e.target.value })}
                margin="normal"
                required
                helperText="Número único identificador do contrato"
              />

              <TextField
                fullWidth
                label="Título *"
                value={contractForm.title}
                onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                margin="normal"
                required
              />

              <FormControl fullWidth margin="normal" required>
                <InputLabel>Tipo de Contrato *</InputLabel>
                <Select
                  value={contractForm.contract_type}
                  label="Tipo de Contrato *"
                  onChange={(e) => setContractForm({ ...contractForm, contract_type: e.target.value as any })}
                >
                  <MenuItem value="advertising">Publicidade</MenuItem>
                  <MenuItem value="subscription">Assinatura</MenuItem>
                  <MenuItem value="partnership">Parceria</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Descrição"
                value={contractForm.description}
                onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
                margin="normal"
                multiline
                rows={3}
              />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Plano</InputLabel>
                    <Select
                      value={contractForm.plan_id || ''}
                      label="Plano"
                      onChange={(e) => setContractForm({ ...contractForm, plan_id: e.target.value ? Number(e.target.value) : undefined })}
                    >
                      <MenuItem value="">Nenhum</MenuItem>
                      {plans.map((plan) => (
                        <MenuItem key={plan.plan_id} value={plan.plan_id}>
                          {plan.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Data de Início *"
                    type="date"
                    value={contractForm.start_date}
                    onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                    margin="normal"
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Data de Término"
                    type="date"
                    value={contractForm.end_date}
                    onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value || undefined })}
                    margin="normal"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Valor Total"
                    type="number"
                    value={contractForm.total_amount || ''}
                    onChange={(e) => setContractForm({ ...contractForm, total_amount: e.target.value ? Number(e.target.value) : undefined })}
                    margin="normal"
                    InputProps={{
                      startAdornment: <Typography sx={{ mr: 1 }}>{contractForm.currency}</Typography>,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={contractForm.status}
                      label="Status"
                      onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as any })}
                    >
                      <MenuItem value="draft">Rascunho</MenuItem>
                      <MenuItem value="active">Ativo</MenuItem>
                      <MenuItem value="expired">Expirado</MenuItem>
                      <MenuItem value="terminated">Terminado</MenuItem>
                      <MenuItem value="cancelled">Cancelado</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Moeda</InputLabel>
                    <Select
                      value={contractForm.currency}
                      label="Moeda"
                      onChange={(e) => setContractForm({ ...contractForm, currency: e.target.value })}
                    >
                      <MenuItem value="BRL">BRL (Real)</MenuItem>
                      <MenuItem value="USD">USD (Dólar)</MenuItem>
                      <MenuItem value="EUR">EUR (Euro)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Condições de Pagamento"
                    value={contractForm.payment_terms}
                    onChange={(e) => setContractForm({ ...contractForm, payment_terms: e.target.value })}
                    margin="normal"
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Aba Publicadores */}
          {createTab === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Publicadores Associados {selectedPublisherIds.length > 0 && `(${selectedPublisherIds.length})`}
              </Typography>

              <Alert severity="info" sx={{ mb: 2 }}>
                Selecione os publicadores que este contrato dará acesso ao assinante. Os publicadores selecionados serão associados ao contrato através de acessos.
              </Alert>

              {publishers.length === 0 ? (
                <Alert severity="warning">
                  Nenhum publicador encontrado. Cadastre publicadores primeiro.
                </Alert>
              ) : (
                <List>
                  {publishers.map((publisher) => (
                    <ListItem
                      key={publisher.publisher_id}
                      sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        mb: 1,
                        backgroundColor: selectedPublisherIds.includes(publisher.publisher_id)
                          ? alpha(theme.palette.primary.main, 0.1)
                          : 'transparent',
                      }}
                    >
                      <Checkbox
                        checked={selectedPublisherIds.includes(publisher.publisher_id)}
                        onChange={() => handleTogglePublisher(publisher.publisher_id)}
                      />
                      <ListItemIcon>
                        <Business />
                      </ListItemIcon>
                      <ListItemText
                        primary={publisher.name}
                        secondary={
                          <>
                            {publisher.email && (
                              <Box component="span" sx={{ display: 'block' }}>
                                {publisher.email}
                              </Box>
                            )}
                            <Chip
                              label={publisher.active ? 'Ativo' : 'Inativo'}
                              size="small"
                              color={publisher.active ? 'success' : 'default'}
                              sx={{ mt: 0.5 }}
                            />
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            resetForm();
          }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateContract}
            disabled={!contractForm.subscriber_id || !contractForm.contract_number || !contractForm.title || !contractForm.start_date}
          >
            Criar Contrato
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog com Abas */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          resetForm();
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Editar Contrato - {selectedContract?.title || ''}</DialogTitle>
        <DialogContent>
          <Tabs value={editTab} onChange={(_, newValue) => setEditTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Informações" />
            <Tab label="Publicadores" icon={selectedPublisherIds.length > 0 ? <Chip label={selectedPublisherIds.length} size="small" color="primary" /> : undefined} iconPosition="end" />
          </Tabs>

          {/* Aba Informações */}
          {editTab === 0 && selectedContract && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Dados do Contrato</Typography>

              <Alert severity="info" sx={{ mb: 2 }}>
                Assinante: {selectedContract.subscriber_name || 'N/A'}
              </Alert>

              <TextField
                fullWidth
                label="Número do Contrato *"
                value={contractForm.contract_number}
                onChange={(e) => setContractForm({ ...contractForm, contract_number: e.target.value })}
                margin="normal"
                required
              />

              <TextField
                fullWidth
                label="Título *"
                value={contractForm.title}
                onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                margin="normal"
                required
              />

              <FormControl fullWidth margin="normal" required>
                <InputLabel>Tipo de Contrato *</InputLabel>
                <Select
                  value={contractForm.contract_type}
                  label="Tipo de Contrato *"
                  onChange={(e) => setContractForm({ ...contractForm, contract_type: e.target.value as any })}
                >
                  <MenuItem value="advertising">Publicidade</MenuItem>
                  <MenuItem value="subscription">Assinatura</MenuItem>
                  <MenuItem value="partnership">Parceria</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Descrição"
                value={contractForm.description}
                onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
                margin="normal"
                multiline
                rows={3}
              />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Plano</InputLabel>
                    <Select
                      value={contractForm.plan_id || ''}
                      label="Plano"
                      onChange={(e) => setContractForm({ ...contractForm, plan_id: e.target.value ? Number(e.target.value) : undefined })}
                    >
                      <MenuItem value="">Nenhum</MenuItem>
                      {plans.map((plan) => (
                        <MenuItem key={plan.plan_id} value={plan.plan_id}>
                          {plan.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Data de Início *"
                    type="date"
                    value={contractForm.start_date}
                    onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                    margin="normal"
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Data de Término"
                    type="date"
                    value={contractForm.end_date}
                    onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value || undefined })}
                    margin="normal"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Valor Total"
                    type="number"
                    value={contractForm.total_amount || ''}
                    onChange={(e) => setContractForm({ ...contractForm, total_amount: e.target.value ? Number(e.target.value) : undefined })}
                    margin="normal"
                    InputProps={{
                      startAdornment: <Typography sx={{ mr: 1 }}>{contractForm.currency}</Typography>,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={contractForm.status}
                      label="Status"
                      onChange={(e) => setContractForm({ ...contractForm, status: e.target.value as any })}
                    >
                      <MenuItem value="draft">Rascunho</MenuItem>
                      <MenuItem value="active">Ativo</MenuItem>
                      <MenuItem value="expired">Expirado</MenuItem>
                      <MenuItem value="terminated">Terminado</MenuItem>
                      <MenuItem value="cancelled">Cancelado</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Moeda</InputLabel>
                    <Select
                      value={contractForm.currency}
                      label="Moeda"
                      onChange={(e) => setContractForm({ ...contractForm, currency: e.target.value })}
                    >
                      <MenuItem value="BRL">BRL (Real)</MenuItem>
                      <MenuItem value="USD">USD (Dólar)</MenuItem>
                      <MenuItem value="EUR">EUR (Euro)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Condições de Pagamento"
                    value={contractForm.payment_terms}
                    onChange={(e) => setContractForm({ ...contractForm, payment_terms: e.target.value })}
                    margin="normal"
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Aba Publicadores */}
          {editTab === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Publicadores Associados {selectedPublisherIds.length > 0 && `(${selectedPublisherIds.length})`}
              </Typography>

              {loadingPublishers ? (
                <LinearProgress />
              ) : (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Selecione os publicadores que este contrato dará acesso ao assinante. Os publicadores selecionados serão associados ao contrato através de acessos.
                  </Alert>

                  {publishers.length === 0 ? (
                    <Alert severity="warning">
                      Nenhum publicador encontrado. Cadastre publicadores primeiro.
                    </Alert>
                  ) : (
                    <List>
                      {publishers.map((publisher) => (
                        <ListItem
                          key={publisher.publisher_id}
                          sx={{
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 1,
                            mb: 1,
                            backgroundColor: selectedPublisherIds.includes(publisher.publisher_id)
                              ? alpha(theme.palette.primary.main, 0.1)
                              : 'transparent',
                          }}
                        >
                          <Checkbox
                            checked={selectedPublisherIds.includes(publisher.publisher_id)}
                            onChange={() => handleTogglePublisher(publisher.publisher_id)}
                          />
                          <ListItemIcon>
                            <Business />
                          </ListItemIcon>
                          <ListItemText
                            primary={publisher.name}
                            secondary={
                              <>
                                {publisher.email && (
                                  <Box component="span" sx={{ display: 'block' }}>
                                    {publisher.email}
                                  </Box>
                                )}
                                <Chip
                                  label={publisher.active ? 'Ativo' : 'Inativo'}
                                  size="small"
                                  color={publisher.active ? 'success' : 'default'}
                                  sx={{ mt: 0.5 }}
                                />
                              </>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            resetForm();
          }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleEditContract}
            disabled={!contractForm.contract_number || !contractForm.title || !contractForm.start_date}
          >
            Salvar Alterações
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Contracts;
