import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
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
  FormControlLabel,
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
  publisherContractApi,
  PublisherContract,
  CreatePublisherContractRequest,
  UpdatePublisherContractRequest,
} from '../../services/api';

type ContractsInitialType = 'subscriber' | 'publisher';

interface ContractsProps {
  /**
   * Optional: force initial context when this page is used as a maintenance entrypoint.
   * If provided, the UI will start in that tab, but user can still switch in /contracts.
   */
  initialType?: ContractsInitialType;
  initialSubscriberId?: number;
  initialPublisherId?: number;
}

const Contracts: React.FC<ContractsProps> = ({ initialType, initialSubscriberId, initialPublisherId }) => {
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isSubscriberMaintenance = location.pathname.startsWith('/subscriber-contracts');
  const isPublisherMaintenance = location.pathname.startsWith('/publisher-contracts');
  const isMaintenance = isSubscriberMaintenance || isPublisherMaintenance;
  
  // Obter role do usuário para proteção de valores contratuais
  const getUserRole = (): string => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.role || '';
    } catch {
      return '';
    }
  };

  const userRole = getUserRole();
  // Roles que podem ver valores contratuais sensíveis
  const canViewSensitiveValues = ['admin', 'admin_sql', 'owner_system', 'operador_faturamento'].includes(userRole);
  
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [publisherContracts, setPublisherContracts] = useState<PublisherContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createPublisherContractDialogOpen, setCreatePublisherContractDialogOpen] = useState(false);
  const [editPublisherContractDialogOpen, setEditPublisherContractDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedPublisherContract, setSelectedPublisherContract] = useState<PublisherContract | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [contractTypeFilter, setContractTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [mainTab, setMainTab] = useState(0); // 0 = Subscriber Contracts, 1 = Publisher Contracts
  const [error, setError] = useState<string | null>(null);
  
  // Estados para abas no dialog
  const [createTab, setCreateTab] = useState(0);
  const [editTab, setEditTab] = useState(0);
  
  // Estados para formulário de criação/edição
  const [contractForm, setContractForm] = useState<CreateContractRequest>({
    subscriber_id: undefined,
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
    publisherIds: [],
    created_before_subscriber: false,
  });
  
  // Estados para dados relacionados
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [contractPublishers, setContractPublishers] = useState<any[]>([]);
  const [loadingPublishers, setLoadingPublishers] = useState(false);
  
  // Estados para seleção de publishers
  const [selectedPublisherIds, setSelectedPublisherIds] = useState<number[]>([]);

  // Estados para formulário de Publisher Contract
  const [publisherContractForm, setPublisherContractForm] = useState<CreatePublisherContractRequest>({
    publisher_id: undefined,
    contract_number: '',
    contract_type: 'revenue_share',
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    revenue_share_percentage: undefined,
    revenue_share_rules: undefined,
    minimum_payout_amount: undefined,
    subscription_amount: undefined,
    subscription_interval: 'month',
    currency: 'BRL',
    payment_terms: '',
    status: 'draft',
    created_before_publisher: false,
  });

  const effectiveType: ContractsInitialType | undefined = useMemo(() => {
    const typeFromRoute: ContractsInitialType | undefined = isSubscriberMaintenance
      ? 'subscriber'
      : isPublisherMaintenance
        ? 'publisher'
        : undefined;
    const typeFromQuery = searchParams.get('type');
    if (typeFromQuery === 'subscriber' || typeFromQuery === 'publisher') return typeFromQuery;
    return initialType || typeFromRoute;
  }, [initialType, isPublisherMaintenance, isSubscriberMaintenance, searchParams]);

  const effectiveSubscriberId = useMemo(() => {
    const fromQuery = searchParams.get('subscriberId');
    const parsed = fromQuery ? Number(fromQuery) : undefined;
    if (parsed && !Number.isNaN(parsed)) return parsed;
    return initialSubscriberId;
  }, [initialSubscriberId, searchParams]);

  const effectivePublisherId = useMemo(() => {
    const fromQuery = searchParams.get('publisherId');
    const parsed = fromQuery ? Number(fromQuery) : undefined;
    if (parsed && !Number.isNaN(parsed)) return parsed;
    return initialPublisherId;
  }, [initialPublisherId, searchParams]);

  // Apply initial tab/context
  useEffect(() => {
    if (effectiveType === 'publisher') setMainTab(1);
    if (effectiveType === 'subscriber') setMainTab(0);
  }, [effectiveType]);

  // Prefill create forms when coming from a contextual entrypoint (subscriber/publisher detail)
  useEffect(() => {
    if (effectiveSubscriberId) {
      setContractForm((prev) => ({
        ...prev,
        subscriber_id: effectiveSubscriberId,
        created_before_subscriber: false,
      }));
    }
  }, [effectiveSubscriberId]);

  useEffect(() => {
    if (effectivePublisherId) {
      setPublisherContractForm((prev) => ({
        ...prev,
        publisher_id: effectivePublisherId,
        created_before_publisher: false,
      }));
    }
  }, [effectivePublisherId]);

  // Open create dialog from contextual links (e.g., Subscriber/Publisher details)
  useEffect(() => {
    const openCreate = searchParams.get('openCreate');
    if (openCreate !== '1') return;

    if (effectiveType === 'publisher') {
      resetPublisherContractForm();
      setCreatePublisherContractDialogOpen(true);
    } else {
      resetForm();
      setCreateTab(0);
      setCreateDialogOpen(true);
    }

    // Remove param to prevent reopening on re-render/back
    const next = new URLSearchParams(searchParams);
    next.delete('openCreate');
    navigate(
      {
        pathname: location.pathname,
        search: next.toString() ? `?${next.toString()}` : '',
      },
      { replace: true }
    );
  }, [effectiveType, location.pathname, navigate, searchParams]);

  useEffect(() => {
    if (mainTab === 0) {
      loadContracts();
      loadSubscribers();
      loadPlans();
    } else {
      loadPublisherContracts();
      loadPublishers();
    }
  }, [contractTypeFilter, statusFilter, mainTab, searchTerm]);

  // Carregar publishers do contrato quando editar
  useEffect(() => {
    if (editDialogOpen && selectedContract) {
      loadPublishers();
      loadContractPublishers(selectedContract.contract_id);
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
        subscriberId: effectiveSubscriberId,
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
      const publishersData = (response as any)?.data;
      setPublishers(Array.isArray(publishersData) ? publishersData : []);
    } catch (error) {
      console.error('Erro ao carregar publishers:', error);
      setPublishers([]);
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

  const loadPublisherContracts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await publisherContractApi.getAll({
        search: searchTerm || undefined,
        contractType: contractTypeFilter !== 'all' ? contractTypeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        publisherId: effectivePublisherId,
      });
      setPublisherContracts(response.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar contratos de publishers:', error);
      setError('Erro ao carregar lista de contratos de publishers');
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = useMemo(() => {
    if (isSubscriberMaintenance) return '📄 Contratos do Anunciante';
    if (isPublisherMaintenance) return '📄 Contratos do Publicador';
    return '📄 Contratos';
  }, [isPublisherMaintenance, isSubscriberMaintenance]);

  const pageSubtitle = useMemo(() => {
    if (isSubscriberMaintenance) return 'Gerencie contratos do Anunciante (Assinante)';
    if (isPublisherMaintenance) return 'Gerencie contratos do Veículo de Mídia (Publicador)';
    return 'Gerencie contratos de Assinantes e Publicadores';
  }, [isPublisherMaintenance, isSubscriberMaintenance]);

  const createButtonLabel = useMemo(() => {
    if (mainTab === 1) return 'Adicionar Contrato do Publicador';
    return 'Adicionar Contrato do Anunciante';
  }, [mainTab]);

  const handleOpenCreate = () => {
    if (mainTab === 1) {
      resetPublisherContractForm();
      setCreatePublisherContractDialogOpen(true);
      return;
    }
    resetForm();
    setCreateDialogOpen(true);
    setCreateTab(0);
  };

  // Helper: open "maintenance" from contextual screens
  const goToMaintenance = (type: ContractsInitialType) => {
    const base = type === 'subscriber' ? '/subscriber-contracts' : '/publisher-contracts';
    navigate(base);
  };

  const loadContractPublishers = async (contractId: number) => {
    try {
      setLoadingPublishers(true);
      const publishersData = await contractApi.getPublishers(contractId);
      setContractPublishers(publishersData || []);
      if (publishersData && publishersData.length > 0) {
        setSelectedPublisherIds(publishersData.map((p: any) => p.publisher_id));
      } else {
        setSelectedPublisherIds([]);
      }
    } catch (error) {
      console.error('Erro ao carregar publishers do contrato:', error);
      setContractPublishers([]);
      setSelectedPublisherIds([]);
    } finally {
      setLoadingPublishers(false);
    }
  };

  const handleCreateContract = async () => {
    try {
      const hasSubscriber = !!contractForm.subscriber_id;
      const isPreContract = !!contractForm.created_before_subscriber;

      if ((!hasSubscriber && !isPreContract) || !contractForm.contract_number || !contractForm.title || !contractForm.start_date) {
        setError('Preencha todos os campos obrigatórios');
        setCreateTab(0);
        return;
      }

      const contractData: CreateContractRequest = {
        ...contractForm,
        start_date: formatDateForAPI(contractForm.start_date) || '',
        end_date: formatDateForAPI(contractForm.end_date),
        // Só permitir publisherIds quando existir subscriber_id (evita INSERT com subscriber_id NULL no backend)
        publisherIds: hasSubscriber ? selectedPublisherIds : [],
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
        start_date: formatDateForAPI(contractForm.start_date),
        end_date: formatDateForAPI(contractForm.end_date),
        total_amount: contractForm.total_amount,
        currency: contractForm.currency,
        payment_terms: contractForm.payment_terms,
        status: contractForm.status,
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

  // Função helper para converter data ISO para formato yyyy-MM-dd
  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Função helper para converter data yyyy-MM-dd para ISO
  const formatDateForAPI = (dateString: string | null | undefined): string | undefined => {
    if (!dateString) return undefined;
    try {
      const date = new Date(dateString + 'T00:00:00.000Z');
      if (isNaN(date.getTime())) return undefined;
      return date.toISOString();
    } catch {
      return undefined;
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
      start_date: formatDateForInput(contract.start_date),
      end_date: formatDateForInput(contract.end_date),
      total_amount: contract.total_amount,
      currency: contract.currency,
      payment_terms: contract.payment_terms || '',
      status: contract.status,
      publisherIds: [],
    });
    setEditDialogOpen(true);
    setEditTab(0);
    // Carregar publishers quando abrir dialog de edição
    loadPublishers();
    // Carregar publishers do contrato
    loadContractPublishers(contract.contract_id);
  };

  const resetForm = () => {
    setContractForm({
      subscriber_id: effectiveSubscriberId,
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
      publisherIds: [],
      created_before_subscriber: !effectiveSubscriberId,
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
      case 'revenue_share': return 'Revenue Share';
      case 'hybrid': return 'Híbrido';
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

  const handleStartEditPublisherContract = (contract: PublisherContract) => {
    setSelectedPublisherContract(contract);
    setPublisherContractForm({
      publisher_id: contract.publisher_id,
      contract_number: contract.contract_number,
      contract_type: contract.contract_type,
      title: contract.title,
      description: contract.description || '',
      start_date: formatDateForInput(contract.start_date),
      end_date: formatDateForInput(contract.end_date),
      revenue_share_percentage: contract.revenue_share_percentage,
      revenue_share_rules: contract.revenue_share_rules,
      minimum_payout_amount: contract.minimum_payout_amount,
      subscription_amount: contract.subscription_amount,
      subscription_interval: contract.subscription_interval || 'month',
      currency: contract.currency,
      payment_terms: contract.payment_terms || '',
      status: contract.status,
    });
    setEditPublisherContractDialogOpen(true);
  };

  const resetPublisherContractForm = () => {
    setPublisherContractForm({
      publisher_id: undefined,
      contract_number: '',
      contract_type: 'revenue_share',
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      revenue_share_percentage: undefined,
      revenue_share_rules: undefined,
      minimum_payout_amount: undefined,
      subscription_amount: undefined,
      subscription_interval: 'month',
      currency: 'BRL',
      payment_terms: '',
      status: 'draft',
      created_before_publisher: false,
    });
  };

  const handleCreatePublisherContract = async () => {
    try {
      const hasPublisher = !!publisherContractForm.publisher_id;
      const isPreContract = !!publisherContractForm.created_before_publisher;

      if ((!hasPublisher && !isPreContract) || !publisherContractForm.contract_number || !publisherContractForm.title || !publisherContractForm.start_date) {
        setError('Preencha todos os campos obrigatórios');
        return;
      }

      const createData = {
        ...publisherContractForm,
        start_date: formatDateForAPI(publisherContractForm.start_date) || '',
        end_date: formatDateForAPI(publisherContractForm.end_date),
      };
      await publisherContractApi.create(createData);
      setCreatePublisherContractDialogOpen(false);
      resetPublisherContractForm();
      loadPublisherContracts();
    } catch (error: any) {
      console.error('Erro ao criar contrato de publisher:', error);
      setError(error?.response?.data?.error || error?.message || 'Erro ao criar contrato de publisher');
    }
  };

  const handleEditPublisherContract = async () => {
    if (!selectedPublisherContract) return;

    try {
      const updateData: UpdatePublisherContractRequest = {
        contract_number: publisherContractForm.contract_number,
        contract_type: publisherContractForm.contract_type,
        title: publisherContractForm.title,
        description: publisherContractForm.description,
        start_date: formatDateForAPI(publisherContractForm.start_date) || '',
        end_date: formatDateForAPI(publisherContractForm.end_date),
        revenue_share_percentage: publisherContractForm.revenue_share_percentage,
        revenue_share_rules: publisherContractForm.revenue_share_rules,
        minimum_payout_amount: publisherContractForm.minimum_payout_amount,
        subscription_amount: publisherContractForm.subscription_amount,
        subscription_interval: publisherContractForm.subscription_interval,
        currency: publisherContractForm.currency,
        payment_terms: publisherContractForm.payment_terms,
        status: publisherContractForm.status,
      };

      await publisherContractApi.update(selectedPublisherContract.contract_id, updateData);
      setEditPublisherContractDialogOpen(false);
      resetPublisherContractForm();
      loadPublisherContracts();
    } catch (error: any) {
      console.error('Erro ao atualizar contrato de publisher:', error);
      setError(error?.response?.data?.error || error?.message || 'Erro ao atualizar contrato de publisher');
    }
  };

  const handleDeletePublisherContract = async (contractId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este contrato de publisher?')) {
      return;
    }

    try {
      await publisherContractApi.delete(contractId);
      loadPublisherContracts();
    } catch (error: any) {
      console.error('Erro ao excluir contrato de publisher:', error);
      setError(error?.response?.data?.error || error?.message || 'Erro ao excluir contrato de publisher');
    }
  };

  if (loading && contracts.length === 0 && publisherContracts.length === 0) {
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
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            {pageTitle}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            {pageSubtitle}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenCreate}
          sx={{
            backgroundColor: theme.palette.primary.main,
            '&:hover': { backgroundColor: theme.palette.primary.dark }
          }}
        >
          {createButtonLabel}
        </Button>
      </Box>

      {!isMaintenance && (
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={mainTab}
            onChange={(_, newValue) => {
              setMainTab(newValue);
              const next = new URLSearchParams(searchParams);
              next.set('type', newValue === 1 ? 'publisher' : 'subscriber');
              navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { replace: true });
            }}
          >
            <Tab label="Contratos do Anunciante" />
            <Tab label="Contratos do Publicador" />
          </Tabs>
        </Box>
      )}

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
                    if (mainTab === 1) loadPublisherContracts();
                    else loadContracts();
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
                  {mainTab === 1 ? (
                    <>
                      <MenuItem value="revenue_share">Revenue Share</MenuItem>
                      <MenuItem value="subscription">Assinatura</MenuItem>
                      <MenuItem value="partnership">Parceria</MenuItem>
                      <MenuItem value="hybrid">Híbrido</MenuItem>
                    </>
                  ) : (
                    <>
                      <MenuItem value="advertising">Publicidade</MenuItem>
                      <MenuItem value="subscription">Assinatura</MenuItem>
                      <MenuItem value="partnership">Parceria</MenuItem>
                    </>
                  )}
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
                onClick={() => (mainTab === 1 ? loadPublisherContracts() : loadContracts())}
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

      {/* Subscriber Contracts Grid */}
      {mainTab === 0 && (
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

                {contract.total_amount && canViewSensitiveValues && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <AttachMoney fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      {contract.currency} {contract.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                )}
                {contract.total_amount && !canViewSensitiveValues && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <AttachMoney fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>
                      Valor confidencial
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
      )}

      {/* Empty State - Subscriber Contracts */}
      {contracts.length === 0 && !loading && mainTab === 0 && (
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
                handleOpenCreate();
              }}
            >
              Adicionar Primeiro Contrato do Anunciante
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Publisher Contracts Grid */}
      {mainTab === 1 && (
        <Grid container spacing={3}>
          {publisherContracts.map((contract) => (
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
                      backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                      color: theme.palette.secondary.main,
                    }}
                  >
                    <Business />
                  </Avatar>

                  <Chip
                    label={getStatusLabel(contract.status)}
                    size="small"
                    color={getStatusColor(contract.status) as any}
                    sx={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                    }}
                  />
                </Box>

                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {contract.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {contract.contract_number}
                  </Typography>
                  <Chip
                    label={getContractTypeLabel(contract.contract_type)}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <Business sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                    Publicador #{contract.publisher_id}
                  </Typography>
                  {contract.revenue_share_percentage && (
                    <Typography variant="body2" color="text.secondary">
                      Revenue Share: {contract.revenue_share_percentage}%
                    </Typography>
                  )}
                  {contract.subscription_amount && (
                    <Typography variant="body2" color="text.secondary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: contract.currency }).format(contract.subscription_amount)} / {contract.subscription_interval}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    <CalendarToday sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
                    {formatDate(contract.start_date)} - {contract.end_date ? formatDate(contract.end_date) : 'Sem término'}
                  </Typography>
                </CardContent>

                <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => handleStartEditPublisherContract(contract)}
                    sx={{ color: theme.palette.primary.main }}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeletePublisherContract(contract.contract_id)}
                    sx={{ color: theme.palette.error.main }}
                  >
                    <Delete />
                  </IconButton>
                </Box>
              </Card>
            </Grid>
          ))}
          {publisherContracts.length === 0 && !loading && (
            <Grid item xs={12}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                  <Description sx={{ fontSize: 64, color: theme.palette.grey[300], mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Nenhum contrato de publicador encontrado
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Comece adicionando seus primeiros contratos de publicadores
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => {
                      handleOpenCreate();
                    }}
                  >
                    Adicionar Primeiro Contrato Publicador
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
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
            <Tab
              label="Publicadores"
              disabled={!contractForm.subscriber_id}
              icon={selectedPublisherIds.length > 0 ? <Chip label={selectedPublisherIds.length} size="small" color="primary" /> : undefined}
              iconPosition="end"
            />
          </Tabs>

          {/* Aba Informações */}
          {createTab === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Dados do Contrato</Typography>

              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Checkbox
                    checked={!!contractForm.created_before_subscriber}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setContractForm((prev) => ({
                        ...prev,
                        created_before_subscriber: checked,
                        subscriber_id: checked ? undefined : prev.subscriber_id,
                      }));
                      if (checked) {
                        // Pré-contrato não pode conceder acessos a publishers sem subscriber_id
                        setSelectedPublisherIds([]);
                      }
                    }}
                  />
                }
                label="Criar contrato antes do anunciante (pré-contrato)"
              />

              {contractForm.created_before_subscriber && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Este contrato será criado sem Assinante. Você poderá vinculá-lo depois (quando o Anunciante existir).
                  Enquanto isso, a seleção de Publicadores ficará desabilitada.
                </Alert>
              )}

              <FormControl fullWidth margin="normal" required={!contractForm.created_before_subscriber}>
                <InputLabel>{contractForm.created_before_subscriber ? 'Assinante (opcional)' : 'Assinante *'}</InputLabel>
                <Select
                  value={contractForm.subscriber_id || ''}
                  label={contractForm.created_before_subscriber ? 'Assinante (opcional)' : 'Assinante *'}
                  onChange={(e) => {
                    const nextId = e.target.value ? Number(e.target.value) : undefined;
                    setContractForm({ ...contractForm, subscriber_id: nextId, created_before_subscriber: !nextId });
                    if (!nextId) setSelectedPublisherIds([]);
                  }}
                  disabled={!!contractForm.created_before_subscriber || !!effectiveSubscriberId}
                >
                    <MenuItem value="">{contractForm.created_before_subscriber ? 'Nenhum (pré-contrato)' : 'Selecione...'}</MenuItem>
                    {subscribers.map((subscriber) => {
                      const subscriberId = subscriber.subscriber_id || (subscriber as any).subscriberId;
                      return (
                        <MenuItem key={subscriberId} value={subscriberId}>
                          {subscriber.name}
                        </MenuItem>
                      );
                    })}
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
                  <MenuItem value="revenue_share">Revenue Share</MenuItem>
                  <MenuItem value="hybrid">Híbrido</MenuItem>
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
                      {plans.map((plan) => {
                        const planId = plan.planId || plan.plan_id || 0;
                        return (
                          <MenuItem key={planId} value={planId}>
                            {plan.name}
                          </MenuItem>
                        );
                      })}
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
                  {canViewSensitiveValues && (
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
                  )}
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
                  {canViewSensitiveValues && (
                    <TextField
                      fullWidth
                      label="Condições de Pagamento"
                      value={contractForm.payment_terms}
                      onChange={(e) => setContractForm({ ...contractForm, payment_terms: e.target.value })}
                      margin="normal"
                      multiline
                      rows={2}
                    />
                  )}
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
            disabled={
              ((!contractForm.subscriber_id && !contractForm.created_before_subscriber) ||
                !contractForm.contract_number ||
                !contractForm.title ||
                !contractForm.start_date)
            }
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
                  <MenuItem value="revenue_share">Revenue Share</MenuItem>
                  <MenuItem value="hybrid">Híbrido</MenuItem>
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
                      {plans.map((plan) => {
                        const planId = plan.planId || plan.plan_id || 0;
                        return (
                          <MenuItem key={planId} value={planId}>
                            {plan.name}
                          </MenuItem>
                        );
                      })}
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
                  {canViewSensitiveValues && (
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
                  )}
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
                  {canViewSensitiveValues && (
                    <TextField
                      fullWidth
                      label="Condições de Pagamento"
                      value={contractForm.payment_terms}
                      onChange={(e) => setContractForm({ ...contractForm, payment_terms: e.target.value })}
                      margin="normal"
                      multiline
                      rows={2}
                    />
                  )}
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

      {/* Create Publisher Contract Dialog */}
      <Dialog
        open={createPublisherContractDialogOpen}
        onClose={() => {
          setCreatePublisherContractDialogOpen(false);
          resetPublisherContractForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Adicionar Contrato Publicador</DialogTitle>
        <DialogContent>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox
                checked={!!publisherContractForm.created_before_publisher}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setPublisherContractForm((prev) => ({
                    ...prev,
                    created_before_publisher: checked,
                    publisher_id: checked ? undefined : prev.publisher_id,
                  }));
                }}
              />
            }
            label="Criar contrato antes do publicador (pré-contrato)"
          />

          {publisherContractForm.created_before_publisher && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Este contrato será criado sem Publicador. Você poderá vinculá-lo depois (quando o Veículo existir).
            </Alert>
          )}

          <FormControl fullWidth margin="normal" required={!publisherContractForm.created_before_publisher}>
            <InputLabel>{publisherContractForm.created_before_publisher ? 'Publicador (opcional)' : 'Publicador *'}</InputLabel>
            <Select
              value={publisherContractForm.publisher_id || ''}
              label={publisherContractForm.created_before_publisher ? 'Publicador (opcional)' : 'Publicador *'}
              onChange={(e) => {
                const nextId = e.target.value ? Number(e.target.value) : undefined;
                setPublisherContractForm({ ...publisherContractForm, publisher_id: nextId, created_before_publisher: !nextId });
              }}
              disabled={!!publisherContractForm.created_before_publisher || !!effectivePublisherId}
            >
              <MenuItem value="">{publisherContractForm.created_before_publisher ? 'Nenhum (pré-contrato)' : 'Selecione...'}</MenuItem>
              {publishers.map((publisher) => (
                <MenuItem key={publisher.publisher_id} value={publisher.publisher_id}>
                  {publisher.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Número do Contrato *"
            value={publisherContractForm.contract_number}
            onChange={(e) => setPublisherContractForm({ ...publisherContractForm, contract_number: e.target.value })}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Título *"
            value={publisherContractForm.title}
            onChange={(e) => setPublisherContractForm({ ...publisherContractForm, title: e.target.value })}
            margin="normal"
            required
          />

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Tipo de Contrato *</InputLabel>
            <Select
              value={publisherContractForm.contract_type}
              label="Tipo de Contrato *"
              onChange={(e) => setPublisherContractForm({ ...publisherContractForm, contract_type: e.target.value as any })}
            >
              <MenuItem value="revenue_share">Revenue Share</MenuItem>
              <MenuItem value="subscription">Assinatura</MenuItem>
              <MenuItem value="partnership">Parceria</MenuItem>
              <MenuItem value="hybrid">Híbrido</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Descrição"
            value={publisherContractForm.description}
            onChange={(e) => setPublisherContractForm({ ...publisherContractForm, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Data de Início *"
                type="date"
                value={publisherContractForm.start_date}
                onChange={(e) => setPublisherContractForm({ ...publisherContractForm, start_date: e.target.value })}
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
                value={publisherContractForm.end_date || ''}
                onChange={(e) => setPublisherContractForm({ ...publisherContractForm, end_date: e.target.value })}
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          {publisherContractForm.contract_type === 'revenue_share' && (
            <>
              <TextField
                fullWidth
                label="Percentual de Revenue Share (%)"
                type="number"
                value={publisherContractForm.revenue_share_percentage || ''}
                onChange={(e) => setPublisherContractForm({ ...publisherContractForm, revenue_share_percentage: e.target.value ? Number(e.target.value) : undefined })}
                margin="normal"
                inputProps={{ min: 0, max: 100, step: 0.01 }}
              />
              <TextField
                fullWidth
                label="Valor Mínimo de Payout"
                type="number"
                value={publisherContractForm.minimum_payout_amount || ''}
                onChange={(e) => setPublisherContractForm({ ...publisherContractForm, minimum_payout_amount: e.target.value ? Number(e.target.value) : undefined })}
                margin="normal"
              />
            </>
          )}

          {publisherContractForm.contract_type === 'subscription' && (
            <>
              <TextField
                fullWidth
                label="Valor da Assinatura"
                type="number"
                value={publisherContractForm.subscription_amount || ''}
                onChange={(e) => setPublisherContractForm({ ...publisherContractForm, subscription_amount: e.target.value ? Number(e.target.value) : undefined })}
                margin="normal"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Intervalo</InputLabel>
                <Select
                  value={publisherContractForm.subscription_interval}
                  label="Intervalo"
                  onChange={(e) => setPublisherContractForm({ ...publisherContractForm, subscription_interval: e.target.value })}
                >
                  <MenuItem value="month">Mensal</MenuItem>
                  <MenuItem value="year">Anual</MenuItem>
                </Select>
              </FormControl>
            </>
          )}

          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={publisherContractForm.status}
              label="Status"
              onChange={(e) => setPublisherContractForm({ ...publisherContractForm, status: e.target.value as any })}
            >
              <MenuItem value="draft">Rascunho</MenuItem>
              <MenuItem value="active">Ativo</MenuItem>
              <MenuItem value="expired">Expirado</MenuItem>
              <MenuItem value="terminated">Terminado</MenuItem>
              <MenuItem value="cancelled">Cancelado</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreatePublisherContractDialogOpen(false);
            resetPublisherContractForm();
          }}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreatePublisherContract}
            disabled={
              ((!publisherContractForm.publisher_id && !publisherContractForm.created_before_publisher) ||
                !publisherContractForm.contract_number ||
                !publisherContractForm.title ||
                !publisherContractForm.start_date)
            }
          >
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Publisher Contract Dialog */}
      <Dialog
        open={editPublisherContractDialogOpen}
        onClose={() => {
          setEditPublisherContractDialogOpen(false);
          resetPublisherContractForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Editar Contrato Publicador - {selectedPublisherContract?.title || ''}</DialogTitle>
        <DialogContent>
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox
                checked={!!publisherContractForm.created_before_publisher}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setPublisherContractForm((prev) => ({
                    ...prev,
                    created_before_publisher: checked,
                    publisher_id: checked ? undefined : prev.publisher_id,
                  }));
                }}
              />
            }
            label="Contrato sem publicador (pré-contrato)"
          />

          <FormControl fullWidth margin="normal" required={!publisherContractForm.created_before_publisher}>
            <InputLabel>{publisherContractForm.created_before_publisher ? 'Publicador (opcional)' : 'Publicador *'}</InputLabel>
            <Select
              value={publisherContractForm.publisher_id || ''}
              label={publisherContractForm.created_before_publisher ? 'Publicador (opcional)' : 'Publicador *'}
              onChange={(e) => {
                const nextId = e.target.value ? Number(e.target.value) : undefined;
                setPublisherContractForm({ ...publisherContractForm, publisher_id: nextId, created_before_publisher: !nextId });
              }}
              disabled={!!publisherContractForm.created_before_publisher}
            >
              <MenuItem value="">{publisherContractForm.created_before_publisher ? 'Nenhum (pré-contrato)' : 'Selecione...'}</MenuItem>
              {publishers.map((publisher) => (
                <MenuItem key={publisher.publisher_id} value={publisher.publisher_id}>
                  {publisher.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Número do Contrato *"
            value={publisherContractForm.contract_number}
            onChange={(e) => setPublisherContractForm({ ...publisherContractForm, contract_number: e.target.value })}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Título *"
            value={publisherContractForm.title}
            onChange={(e) => setPublisherContractForm({ ...publisherContractForm, title: e.target.value })}
            margin="normal"
            required
          />

          <FormControl fullWidth margin="normal" required>
            <InputLabel>Tipo de Contrato *</InputLabel>
            <Select
              value={publisherContractForm.contract_type}
              label="Tipo de Contrato *"
              onChange={(e) => setPublisherContractForm({ ...publisherContractForm, contract_type: e.target.value as any })}
            >
              <MenuItem value="revenue_share">Revenue Share</MenuItem>
              <MenuItem value="subscription">Assinatura</MenuItem>
              <MenuItem value="partnership">Parceria</MenuItem>
              <MenuItem value="hybrid">Híbrido</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Descrição"
            value={publisherContractForm.description}
            onChange={(e) => setPublisherContractForm({ ...publisherContractForm, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Data de Início *"
                type="date"
                value={publisherContractForm.start_date}
                onChange={(e) => setPublisherContractForm({ ...publisherContractForm, start_date: e.target.value })}
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
                value={publisherContractForm.end_date || ''}
                onChange={(e) => setPublisherContractForm({ ...publisherContractForm, end_date: e.target.value })}
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          {publisherContractForm.contract_type === 'revenue_share' && (
            <>
              <TextField
                fullWidth
                label="Percentual de Revenue Share (%)"
                type="number"
                value={publisherContractForm.revenue_share_percentage || ''}
                onChange={(e) => setPublisherContractForm({ ...publisherContractForm, revenue_share_percentage: e.target.value ? Number(e.target.value) : undefined })}
                margin="normal"
                inputProps={{ min: 0, max: 100, step: 0.01 }}
              />
              <TextField
                fullWidth
                label="Valor Mínimo de Payout"
                type="number"
                value={publisherContractForm.minimum_payout_amount || ''}
                onChange={(e) => setPublisherContractForm({ ...publisherContractForm, minimum_payout_amount: e.target.value ? Number(e.target.value) : undefined })}
                margin="normal"
              />
            </>
          )}

          {publisherContractForm.contract_type === 'subscription' && (
            <>
              <TextField
                fullWidth
                label="Valor da Assinatura"
                type="number"
                value={publisherContractForm.subscription_amount || ''}
                onChange={(e) => setPublisherContractForm({ ...publisherContractForm, subscription_amount: e.target.value ? Number(e.target.value) : undefined })}
                margin="normal"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Intervalo</InputLabel>
                <Select
                  value={publisherContractForm.subscription_interval}
                  label="Intervalo"
                  onChange={(e) => setPublisherContractForm({ ...publisherContractForm, subscription_interval: e.target.value })}
                >
                  <MenuItem value="month">Mensal</MenuItem>
                  <MenuItem value="year">Anual</MenuItem>
                </Select>
              </FormControl>
            </>
          )}

          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={publisherContractForm.status}
              label="Status"
              onChange={(e) => setPublisherContractForm({ ...publisherContractForm, status: e.target.value as any })}
            >
              <MenuItem value="draft">Rascunho</MenuItem>
              <MenuItem value="active">Ativo</MenuItem>
              <MenuItem value="expired">Expirado</MenuItem>
              <MenuItem value="terminated">Terminado</MenuItem>
              <MenuItem value="cancelled">Cancelado</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditPublisherContractDialogOpen(false);
            resetPublisherContractForm();
          }}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleEditPublisherContract}
            disabled={
              ((!publisherContractForm.publisher_id && !publisherContractForm.created_before_publisher) ||
                !publisherContractForm.contract_number ||
                !publisherContractForm.title ||
                !publisherContractForm.start_date)
            }
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Contracts;
