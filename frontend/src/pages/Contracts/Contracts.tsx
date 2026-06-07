import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  useMediaQuery,
  alpha,
  LinearProgress,
  Alert,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
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
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import {
  BILLING_INTERVAL_OPTIONS,
  billingIntervalLabel,
  buildContractEndDate,
  clampContractEndDate,
  contractEndDateHelperText,
  normalizeBillingInterval,
} from '../../utils/billingIntervals';
import { ContractCard, ContractForm, ContractDetails } from './components';
import ResponsiveSectionNav from '../../components/Navigation/ResponsiveSectionNav';
import { getProductTerminology } from '../../config/productTerminology';
import {
  getContractTypeLabel,
  PUBLISHER_CONTRACT_TYPE_OPTIONS,
  REVENUE_SHARE_PERCENT_LABEL,
  formatRevenueSharePercent,
} from '../../utils/contractTypeLabels';
import { selectLabelShrinkProps } from '../../utils/muiSelectLabel';

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
  const orgTerms = getProductTerminology();
  const theme = useTheme();
  const isMobileNav = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Datas padrão para contratos: início = hoje, vencimento = 31/12 do ano corrente
  const getDefaultContractStartDate = (): string => new Date().toISOString().split('T')[0];
  const getDefaultContractEndDate = (): string => `${new Date().getFullYear()}-12-31`;

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
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
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
    start_date: getDefaultContractStartDate(),
    end_date: buildContractEndDate(),
    total_amount: undefined,
    currency: 'BRL',
    payment_terms: '',
    status: 'draft',
    publisherIds: [],
  });
  
  // Estados para dados relacionados
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [contractPublishers, setContractPublishers] = useState<any[]>([]);
  const [loadingPublishers, setLoadingPublishers] = useState(false);
  
  // Estados para seleção de organizações (publisherIds)
  const [selectedPublisherIds, setSelectedPublisherIds] = useState<number[]>([]);

  // Estados para formulário de contrato da organização
  const [publisherContractForm, setPublisherContractForm] = useState<CreatePublisherContractRequest>({
    publisher_id: undefined,
    contract_number: '',
    contract_type: 'revenue_share',
    title: '',
    description: '',
    start_date: getDefaultContractStartDate(),
    end_date: buildContractEndDate(),
    revenue_share_percentage: undefined,
    revenue_share_rules: undefined,
    minimum_payout_amount: undefined,
    subscription_amount: undefined,
    billing_interval: 'month',
    currency: 'BRL',
    payment_terms: '',
    status: 'draft',
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

  // Extrai o sequencial (número após o último ponto) de um contract_number. Ex: PUB-3.000004 -> 4
  const parseContractSequence = useCallback((contractNumber: string): number => {
    if (!contractNumber || typeof contractNumber !== 'string') return 0;
    const parts = contractNumber.trim().split('.');
    const last = parts[parts.length - 1];
    const num = parseInt(last, 10);
    return Number.isNaN(num) ? 0 : num;
  }, []);

  // Gera número de contrato padrão da organização: PUB-<publisherId>.<NNNNNN>
  const generatePublisherContractNumber = useCallback(
    (publisherId: number): string => {
      const list = publisherContracts.filter((c) => c.publisher_id === publisherId);
      const maxSeq = list.length === 0 ? 0 : Math.max(0, ...list.map((c) => parseContractSequence(c.contract_number)));
      const seq = String(maxSeq + 1).padStart(6, '0');
      return `PUB-${publisherId}.${seq}`;
    },
    [publisherContracts, parseContractSequence]
  );

  // Gera número de contrato padrão para subscriber: SUB-<subscriberId>.<NNNNNN> (próximo = último sequencial + 1)
  const generateSubscriberContractNumber = useCallback(
    (subscriberId: number): string => {
      const list = contracts.filter((c) => c.subscriber_id === subscriberId);
      const maxSeq = list.length === 0 ? 0 : Math.max(0, ...list.map((c) => parseContractSequence(c.contract_number)));
      const seq = String(maxSeq + 1).padStart(6, '0');
      return `SUB-${subscriberId}.${seq}`;
    },
    [contracts, parseContractSequence]
  );

  // Apply initial tab/context
  useEffect(() => {
    if (effectiveType === 'publisher') setMainTab(1);
    if (effectiveType === 'subscriber') setMainTab(0);
  }, [effectiveType]);

  // Pré-preencher formulários a partir de anunciante/organização (detalhe contextual)
  useEffect(() => {
    if (effectiveSubscriberId) {
      setContractForm((prev) => {
        const next = { ...prev, subscriber_id: effectiveSubscriberId };
        if (!next.contract_number) {
          next.contract_number = generateSubscriberContractNumber(effectiveSubscriberId);
        }
        return next;
      });
    }
  }, [effectiveSubscriberId, generateSubscriberContractNumber]);

  useEffect(() => {
    if (effectivePublisherId) {
      setPublisherContractForm((prev) => {
        const next: CreatePublisherContractRequest = {
          ...prev,
          publisher_id: effectivePublisherId,
        };
        // Só sugerir número se ainda não houver nada preenchido
        if (!next.contract_number) {
          next.contract_number = generatePublisherContractNumber(effectivePublisherId);
        }
        return next;
      });
    }
  }, [effectivePublisherId, generatePublisherContractNumber]);

  // Abrir diálogo de criação a partir de links contextuais (anunciante/organização)
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

  // Carregar organizações do contrato ao editar
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
      setError(pickApiErrorMessage(error, 'Erro ao carregar lista de contratos'));
    } finally {
      setLoading(false);
    }
  };

  const loadSubscribers = async () => {
    try {
      const response = await subscriberApi.getAll({ active_only: false });
      setSubscribers(response.data || []);
    } catch (error) {
    }
  };

  const loadPublishers = async () => {
    try {
      const response = await publisherApi.getAll({ active_only: false });
      const publishersData = (response as any)?.data;
      setPublishers(Array.isArray(publishersData) ? publishersData : []);
    } catch (error) {
      setPublishers([]);
    }
  };

  const loadPlans = async () => {
    try {
      const plansData = await planApi.getAll(true);
      setPlans(plansData || []);
    } catch (error) {
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
      setError(pickApiErrorMessage(error, 'Erro ao carregar lista de contratos de publishers'));
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = useMemo(() => {
    if (isSubscriberMaintenance) return 'Contratos de anunciantes';
    if (isPublisherMaintenance) return orgTerms.organizationContracts;
    return '📄 Contratos';
  }, [isPublisherMaintenance, isSubscriberMaintenance, orgTerms.organizationContracts]);

  const pageSubtitle = useMemo(() => {
    if (isSubscriberMaintenance) return 'Gerencie contratos de anunciantes';
    if (isPublisherMaintenance) return `Gerencie contratos da ${orgTerms.organization.toLowerCase()}`;
    return `Gerencie contratos de Anunciantes e ${orgTerms.organizationPlural}`;
  }, [isPublisherMaintenance, isSubscriberMaintenance, orgTerms.organization, orgTerms.organizationPlural]);

  const createButtonLabel = useMemo(() => {
    if (mainTab === 1) return `Adicionar contrato da ${orgTerms.organization.toLowerCase()}`;
    return 'Adicionar Contrato do Anunciante';
  }, [mainTab, orgTerms.organization]);
  const contractSections = [
    { label: 'Contratos do Anunciante', icon: Assignment },
    { label: orgTerms.organizationContracts, icon: Business },
  ] as const;

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
      setContractPublishers([]);
      setSelectedPublisherIds([]);
    } finally {
      setLoadingPublishers(false);
    }
  };

  const handleCreateContract = async () => {
    try {
      const hasSubscriber = !!contractForm.subscriber_id;
      if ((!hasSubscriber && !effectiveSubscriberId) || !contractForm.contract_number || !contractForm.title || !contractForm.start_date) {
        setError('Preencha todos os campos obrigatórios');
        setCreateTab(0);
        return;
      }

      const contractData: CreateContractRequest = {
        ...contractForm,
        start_date: formatDateForAPI(contractForm.start_date) || '',
        end_date: formatDateForAPI(contractForm.end_date || buildContractEndDate(getDefaultContractStartDate())),
        // Só permitir publisherIds quando existir subscriber_id (evita INSERT com subscriber_id NULL no backend)
        publisherIds: hasSubscriber ? selectedPublisherIds : [],
        status: contractForm.status == null ? undefined : contractForm.status,
      };

      await contractApi.create(contractData);
      setCreateDialogOpen(false);
      resetForm();
      loadContracts();
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao criar contrato'));
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
        end_date: formatDateForAPI(contractForm.end_date || buildContractEndDate(getDefaultContractStartDate())),
        total_amount: contractForm.total_amount,
        currency: contractForm.currency,
        payment_terms: contractForm.payment_terms,
        status: contractForm.status == null ? undefined : contractForm.status,
        publisherIds: selectedPublisherIds,
      };

      await contractApi.update(selectedContract.contract_id, updateData);
      setEditDialogOpen(false);
      resetForm();
      loadContracts();
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao atualizar contrato'));
    }
  };

  const handleDeleteContract = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este contrato?')) return;

    try {
      await contractApi.delete(id);
      loadContracts();
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao excluir contrato'));
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
    if (!dateString || dateString.trim() === '') return undefined;
    try {
      // Se já está no formato ISO completo (com T), usar diretamente
      if (dateString.includes('T')) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return undefined;
        return date.toISOString();
      }
      // Se está no formato yyyy-MM-dd, adicionar hora para criar ISO válido
      const date = new Date(dateString + 'T00:00:00.000Z');
      if (isNaN(date.getTime())) return undefined;
      return date.toISOString();
    } catch {
      return undefined;
    }
  };

  const handleStartEdit = (contract: Contract) => {
    setSelectedContract(contract);
    // Garantir que subscriber_id seja definido (pode vir como undefined/null do backend)
    const subscriberId = contract.subscriber_id ?? (contract as any).subscriberId ?? undefined;
    setContractForm({
      subscriber_id: subscriberId,
      plan_id: contract.plan_id,
      contract_number: contract.contract_number,
      contract_type: contract.contract_type,
      title: contract.title,
      description: contract.description || '',
      start_date: formatDateForInput(contract.start_date) || getDefaultContractStartDate(),
      end_date: formatDateForInput(contract.end_date) || buildContractEndDate(getDefaultContractStartDate()),
      total_amount: contract.total_amount,
      currency: contract.currency || 'BRL',
      payment_terms: contract.payment_terms || '',
      status: contract.status || 'draft',
      publisherIds: [],
    });
    setEditDialogOpen(true);
    setEditTab(0);
    // Carregar organizações ao abrir diálogo de edição
    loadPublishers();
    // Carregar organizações do contrato
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
      start_date: getDefaultContractStartDate(),
      end_date: buildContractEndDate(),
      total_amount: undefined,
      currency: 'BRL',
      payment_terms: '',
      status: 'draft',
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
      start_date: formatDateForInput(contract.start_date) || getDefaultContractStartDate(),
      end_date: formatDateForInput(contract.end_date) || buildContractEndDate(getDefaultContractStartDate()),
      revenue_share_percentage: contract.revenue_share_percentage,
      revenue_share_rules: contract.revenue_share_rules,
      minimum_payout_amount: contract.minimum_payout_amount,
      subscription_amount: contract.subscription_amount,
      billing_interval: contract.billing_interval || contract.subscription_interval || 'month',
      currency: contract.currency,
      payment_terms: contract.payment_terms || '',
      status: contract.status || 'draft',
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
      start_date: getDefaultContractStartDate(),
      end_date: buildContractEndDate(),
      revenue_share_percentage: undefined,
      revenue_share_rules: undefined,
      minimum_payout_amount: undefined,
      subscription_amount: undefined,
      billing_interval: 'month',
      currency: 'BRL',
      payment_terms: '',
      status: 'draft',
    });
  };

  const handleCreatePublisherContract = async () => {
    try {
      const hasPublisher = !!publisherContractForm.publisher_id;
      
      if ((!hasPublisher && !effectivePublisherId) || !publisherContractForm.contract_number || !publisherContractForm.title || !publisherContractForm.start_date) {
        setError('Preencha todos os campos obrigatórios');
        return;
      }

      const createData = {
        ...publisherContractForm,
        start_date: formatDateForAPI(publisherContractForm.start_date) || '',
        end_date: formatDateForAPI(
          publisherContractForm.end_date ||
            buildContractEndDate(
              formatDateForInput(publisherContractForm.start_date) || getDefaultContractStartDate(),
              publisherContractForm.billing_interval
            )
        ),
        status:
          publisherContractForm.status == null ? undefined : publisherContractForm.status,
      };
      await publisherContractApi.create(createData);
      setCreatePublisherContractDialogOpen(false);
      resetPublisherContractForm();
      loadPublisherContracts();
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao criar contrato de publisher'));
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
        end_date: formatDateForAPI(
          publisherContractForm.end_date ||
            buildContractEndDate(
              formatDateForInput(publisherContractForm.start_date) || getDefaultContractStartDate(),
              publisherContractForm.billing_interval
            )
        ),
        revenue_share_percentage: publisherContractForm.revenue_share_percentage,
        revenue_share_rules: publisherContractForm.revenue_share_rules,
        minimum_payout_amount: publisherContractForm.minimum_payout_amount,
        subscription_amount: publisherContractForm.subscription_amount,
        billing_interval: publisherContractForm.billing_interval,
        currency: publisherContractForm.currency,
        payment_terms: publisherContractForm.payment_terms,
        status: publisherContractForm.status == null ? undefined : publisherContractForm.status,
      };

      await publisherContractApi.update(selectedPublisherContract.contract_id, updateData);
      setEditPublisherContractDialogOpen(false);
      resetPublisherContractForm();
      loadPublisherContracts();
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao atualizar contrato de publisher'));
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
      setError(pickApiErrorMessage(error, 'Erro ao excluir contrato de publisher'));
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
          <ResponsiveSectionNav
            sections={contractSections}
            value={mainTab}
            onChange={(newValue) => {
              setMainTab(newValue);
              const next = new URLSearchParams(searchParams);
              next.set('type', newValue === 1 ? 'publisher' : 'subscriber');
              navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { replace: true });
            }}
            isMobileNav={isMobileNav}
            idPrefix="contracts-main"
          />
        </Box>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                id="contracts-search"
                name="search"
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
                <InputLabel id="contracts-filter-type-label">Tipo</InputLabel>
                <Select
                  id="contracts-filter-type"
                  labelId="contracts-filter-type-label"
                  value={contractTypeFilter}
                  label="Tipo"
                  onChange={(e) => setContractTypeFilter(e.target.value)}
                  inputProps={{ name: 'contractTypeFilter' }}
                >
                  <MenuItem value="all">Todos</MenuItem>
                  {mainTab === 1
                    ? PUBLISHER_CONTRACT_TYPE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))
                    : (['advertising', 'subscription', 'partnership'] as const).map((value) => (
                        <MenuItem key={value} value={value}>
                          {getContractTypeLabel(value)}
                        </MenuItem>
                      ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="contracts-filter-status-label">Status</InputLabel>
                <Select
                  id="contracts-filter-status"
                  labelId="contracts-filter-status-label"
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                  inputProps={{ name: 'statusFilter' }}
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
        <>
          {effectiveSubscriberId && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Criar Contrato para Assinante #{effectiveSubscriberId}
                </Typography>
                <ContractForm
                  mode="create"
                  data={contractForm}
                  onChange={(data) => setContractForm(data as CreateContractRequest)}
                  subscribers={subscribers}
                  plans={plans}
                  publishers={publishers}
                  selectedPublisherIds={selectedPublisherIds}
                  onTogglePublisher={handleTogglePublisher}
                  canViewSensitiveValues={canViewSensitiveValues}
                  effectiveSubscriberId={effectiveSubscriberId}
                  activeTab={createTab}
                  onTabChange={setCreateTab}
                  showCreateBeforeSubscriberCheckbox={false}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleCreateContract}
                    disabled={
                      ((!contractForm.subscriber_id && !effectiveSubscriberId) ||
                        !contractForm.contract_number ||
                        !contractForm.title ||
                        !contractForm.start_date)
                    }
                  >
                    Criar Contrato
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
          <Grid container spacing={3}>
          {contracts.map((contract) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={contract.contract_id}>
              <ContractCard
                contract={contract}
                canViewSensitiveValues={canViewSensitiveValues}
                onView={(contract) => {
                  setSelectedContract(contract);
                  setDetailsDialogOpen(true);
                }}
                onEdit={() => handleStartEdit(contract)}
                onDelete={() => handleDeleteContract(contract.contract_id)}
              />
            </Grid>
          ))}
        </Grid>
          </>
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

      {/* Grade de contratos da organização */}
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
                    {orgTerms.organization} #{contract.publisher_id}
                  </Typography>
                  {contract.revenue_share_percentage && (
                    <Typography variant="body2" color="text.secondary">
                      {formatRevenueSharePercent(contract.revenue_share_percentage)}
                    </Typography>
                  )}
                  {contract.subscription_amount && (
                    <Typography variant="body2" color="text.secondary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: contract.currency }).format(contract.subscription_amount)} / {billingIntervalLabel((contract.billing_interval || contract.subscription_interval))}
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
                    Nenhum contrato da {orgTerms.organization.toLowerCase()} encontrado
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Comece adicionando os primeiros contratos das {orgTerms.organizationPlural.toLowerCase()}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => {
                      handleOpenCreate();
                    }}
                  >
                    {`Adicionar primeiro contrato da ${orgTerms.organization.toLowerCase()}`}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Create Dialog */}
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
          <ContractForm
            mode="create"
            data={contractForm}
            onChange={(data) => setContractForm(data as CreateContractRequest)}
            subscribers={subscribers}
            plans={plans}
            publishers={publishers}
            selectedPublisherIds={selectedPublisherIds}
            onTogglePublisher={handleTogglePublisher}
            canViewSensitiveValues={canViewSensitiveValues}
            effectiveSubscriberId={effectiveSubscriberId}
            activeTab={createTab}
            onTabChange={setCreateTab}
          />
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
              ((!contractForm.subscriber_id && !effectiveSubscriberId) ||
                !contractForm.contract_number ||
                !contractForm.title ||
                !contractForm.start_date)
            }
          >
            Criar Contrato
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
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
          <ContractForm
            mode="edit"
            contract={selectedContract || undefined}
            data={contractForm}
            onChange={(data) => setContractForm(data as CreateContractRequest)}
            subscribers={subscribers}
            plans={plans}
            publishers={publishers}
            selectedPublisherIds={selectedPublisherIds}
            onTogglePublisher={handleTogglePublisher}
            canViewSensitiveValues={canViewSensitiveValues}
            effectiveSubscriberId={effectiveSubscriberId}
            activeTab={editTab}
            onTabChange={setEditTab}
          />
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

      {/* Details Dialog */}
      <ContractDetails
        open={detailsDialogOpen}
        contract={selectedContract}
        onClose={() => {
          setDetailsDialogOpen(false);
          setSelectedContract(null);
        }}
        onEdit={(contract) => {
          setDetailsDialogOpen(false);
          handleStartEdit(contract);
        }}
        canViewSensitiveValues={canViewSensitiveValues}
      />

      {/* Diálogo: criar contrato da organização */}
      <Dialog
        open={createPublisherContractDialogOpen}
        onClose={() => {
          setCreatePublisherContractDialogOpen(false);
          resetPublisherContractForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{`Adicionar contrato da ${orgTerms.organization.toLowerCase()}`}</DialogTitle>
        <DialogContent>
          {/* Pré-contrato removido da UI */}
          <FormControl fullWidth margin="normal" required={!effectivePublisherId} disabled={!!effectivePublisherId}>
            <InputLabel {...selectLabelShrinkProps}>{effectivePublisherId ? `${orgTerms.organization} (fixo)` : `${orgTerms.organization} *`}</InputLabel>
            <Select
              value={publisherContractForm.publisher_id || ''}
              label={effectivePublisherId ? `${orgTerms.organization} (fixo)` : `${orgTerms.organization} *`}
              onChange={(e) => {
                const nextId = e.target.value ? Number(e.target.value) : undefined;
                setPublisherContractForm((prev) => {
                  const updated: CreatePublisherContractRequest = {
                    ...prev,
                    publisher_id: nextId,
                  };
                  if (nextId && !updated.contract_number) {
                    updated.contract_number = generatePublisherContractNumber(nextId);
                  }
                  return updated;
                });
              }}
              disabled={!!effectivePublisherId}
            >
              <MenuItem value="">{effectivePublisherId ? 'Nenhum' : 'Selecione...'}</MenuItem>
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
              {PUBLISHER_CONTRACT_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
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
                value={formatDateForInput(publisherContractForm.start_date) || ''}
                onChange={(e) => {
                  const start = e.target.value;
                  setPublisherContractForm({
                    ...publisherContractForm,
                    start_date: start,
                    end_date: buildContractEndDate(start, publisherContractForm.billing_interval),
                  });
                }}
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
                value={
                  formatDateForInput(publisherContractForm.end_date) ||
                  buildContractEndDate(
                    formatDateForInput(publisherContractForm.start_date) || getDefaultContractStartDate(),
                    publisherContractForm.billing_interval
                  )
                }
                onChange={(e) => {
                  const start =
                    formatDateForInput(publisherContractForm.start_date) || getDefaultContractStartDate();
                  const iv = publisherContractForm.billing_interval;
                  const end = e.target.value;
                  setPublisherContractForm({
                    ...publisherContractForm,
                    end_date: end
                      ? clampContractEndDate(start, end, iv ?? 'month')
                      : buildContractEndDate(start, iv),
                  });
                }}
                helperText={contractEndDateHelperText(
                  formatDateForInput(publisherContractForm.start_date) || getDefaultContractStartDate(),
                  publisherContractForm.billing_interval || 'month'
                )}
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          {publisherContractForm.contract_type === 'revenue_share' && (
            <>
              <TextField
                fullWidth
                label={REVENUE_SHARE_PERCENT_LABEL}
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
                  value={publisherContractForm.billing_interval}
                  label="Intervalo"
                  onChange={(e) => {
                    const iv = e.target.value;
                    const start =
                      formatDateForInput(publisherContractForm.start_date) || getDefaultContractStartDate();
                    setPublisherContractForm({
                      ...publisherContractForm,
                      billing_interval: iv,
                      end_date: buildContractEndDate(start, iv),
                    });
                  }}
                >
                  {BILLING_INTERVAL_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}

          <FormControl fullWidth margin="normal">
            <InputLabel>Status (opcional)</InputLabel>
            <Select
              value={publisherContractForm.status ?? 'draft'}
              label="Status (opcional)"
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
              ((!publisherContractForm.publisher_id && !effectivePublisherId) ||
                !publisherContractForm.contract_number ||
                !publisherContractForm.title ||
                !publisherContractForm.start_date)
            }
          >
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: editar contrato da organização */}
      <Dialog
        open={editPublisherContractDialogOpen}
        onClose={() => {
          setEditPublisherContractDialogOpen(false);
          resetPublisherContractForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{`Editar contrato da ${orgTerms.organization.toLowerCase()} — ${selectedPublisherContract?.title || ''}`}</DialogTitle>
        <DialogContent>
          {/* Pré-contrato removido da UI */}
          <FormControl fullWidth margin="normal" required={!effectivePublisherId} disabled={!!effectivePublisherId}>
            <InputLabel {...selectLabelShrinkProps}>{effectivePublisherId ? `${orgTerms.organization} (fixo)` : `${orgTerms.organization} *`}</InputLabel>
            <Select
              value={publisherContractForm.publisher_id || ''}
              label={effectivePublisherId ? `${orgTerms.organization} (fixo)` : `${orgTerms.organization} *`}
              onChange={(e) => {
                const nextId = e.target.value ? Number(e.target.value) : undefined;
                setPublisherContractForm({ ...publisherContractForm, publisher_id: nextId });
              }}
              disabled={!!effectivePublisherId}
            >
              <MenuItem value="">{effectivePublisherId ? 'Nenhum' : 'Selecione...'}</MenuItem>
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
              {PUBLISHER_CONTRACT_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
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
                value={formatDateForInput(publisherContractForm.start_date) || ''}
                onChange={(e) => {
                  const start = e.target.value;
                  setPublisherContractForm({
                    ...publisherContractForm,
                    start_date: start,
                    end_date: buildContractEndDate(start, publisherContractForm.billing_interval),
                  });
                }}
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
                value={
                  formatDateForInput(publisherContractForm.end_date) ||
                  buildContractEndDate(
                    formatDateForInput(publisherContractForm.start_date) || getDefaultContractStartDate(),
                    publisherContractForm.billing_interval
                  )
                }
                onChange={(e) => {
                  const start =
                    formatDateForInput(publisherContractForm.start_date) || getDefaultContractStartDate();
                  const iv = publisherContractForm.billing_interval;
                  const end = e.target.value;
                  setPublisherContractForm({
                    ...publisherContractForm,
                    end_date: end
                      ? clampContractEndDate(start, end, iv ?? 'month')
                      : buildContractEndDate(start, iv),
                  });
                }}
                helperText={contractEndDateHelperText(
                  formatDateForInput(publisherContractForm.start_date) || getDefaultContractStartDate(),
                  publisherContractForm.billing_interval || 'month'
                )}
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          {publisherContractForm.contract_type === 'revenue_share' && (
            <>
              <TextField
                fullWidth
                label={REVENUE_SHARE_PERCENT_LABEL}
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
                  value={publisherContractForm.billing_interval}
                  label="Intervalo"
                  onChange={(e) => {
                    const iv = e.target.value;
                    const start =
                      formatDateForInput(publisherContractForm.start_date) || getDefaultContractStartDate();
                    setPublisherContractForm({
                      ...publisherContractForm,
                      billing_interval: iv,
                      end_date: buildContractEndDate(start, iv),
                    });
                  }}
                >
                  {BILLING_INTERVAL_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}

          <FormControl fullWidth margin="normal">
            <InputLabel>Status (opcional)</InputLabel>
            <Select
              value={publisherContractForm.status ?? 'draft'}
              label="Status (opcional)"
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
              ((!publisherContractForm.publisher_id && !effectivePublisherId) ||
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
