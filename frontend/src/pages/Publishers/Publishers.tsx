import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Business,
  Email,
  Phone,
  LocationOn,
  Refresh,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  People,
  Computer,
  Tv,
  Store,
  CalendarToday,
  Assignment,
  AttachMoney,
  Link as LinkIcon,
  OpenInNew,
} from '@mui/icons-material';
import { 
  publisherApi, 
  Publisher, 
  CreatePublisherRequest, 
  UpdatePublisherRequest,
  localApi,
  Local,
  CreateLocalRequest,
  totemApi,
  CreatePlayerRequest,
  subscriberApi,
  CreateSubscriberRequest,
  Subscriber,
  smartTvApi,
  CreateSmartTvRequest,
  SmartTv,
  publisherContractApi,
  PublisherContract,
  CreatePublisherContractRequest,
  UpdatePublisherContractRequest,
} from '../../services/api';

const Publishers: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedPublisher, setSelectedPublisher] = useState<Publisher | null>(null);
  const [publisherStats, setPublisherStats] = useState<{
    locals: any[];
    totems: any[];
    smartTvs: any[];
    contracts?: any[];
    stats: any;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeOnlyFilter, setActiveOnlyFilter] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState(0);
  const [createTab, setCreateTab] = useState(0); // NOVO: Aba do dialog de criação
  const [editTab, setEditTab] = useState(0); // NOVO: Aba do dialog de edição
  const [newPublisher, setNewPublisher] = useState<CreatePublisherRequest>({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    category_segment: '',
    description: '',
    is_subscriber: false,
    is_publisher: true,
    client_type: 'publisher',
    contract_id: undefined,
  });
  // NOVO: Estados para gerenciar locais, totens, smart TVs e subscribers durante a criação
  const [tempLocals, setTempLocals] = useState<CreateLocalRequest[]>([]);
  const [tempTotems, setTempTotems] = useState<(CreatePlayerRequest & { tempId: string })[]>([]);
  const [tempSmartTvs, setTempSmartTvs] = useState<(CreateSmartTvRequest & { tempId: string })[]>([]);
  const [tempPublisherContracts, setTempPublisherContracts] = useState<(Partial<CreatePublisherContractRequest> & { tempId: string })[]>([]);
  const [editingLocalIndex, setEditingLocalIndex] = useState<number | null>(null);
  const [editingTotemIndex, setEditingTotemIndex] = useState<number | null>(null);
  const [editingSmartTvIndex, setEditingSmartTvIndex] = useState<number | null>(null);
  const [editingPublisherContractIndexCreate, setEditingPublisherContractIndexCreate] = useState<number | null>(null);
  
  // Estados para edição de publicador (carregar dados existentes)
  const [editLocals, setEditLocals] = useState<Local[]>([]);
  const [editTotems, setEditTotems] = useState<any[]>([]);
  const [editSmartTvs, setEditSmartTvs] = useState<any[]>([]);
  const [editPublisherContracts, setEditPublisherContracts] = useState<PublisherContract[]>([]);
  const [loadingEditContracts, setLoadingEditContracts] = useState(false);
  const [editingPublisherContractIndex, setEditingPublisherContractIndex] = useState<number | null>(null);
  const [publisherContractForm, setPublisherContractForm] = useState<Partial<CreatePublisherContractRequest>>({
    contract_number: '',
    contract_type: 'revenue_share',
    title: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: undefined,
    currency: 'BRL',
    status: 'draft',
  });
  const [editingEditLocalIndex, setEditingEditLocalIndex] = useState<number | null>(null);
  const [editingEditTotemIndex, setEditingEditTotemIndex] = useState<number | null>(null);
  const [editingEditSmartTvIndex, setEditingEditSmartTvIndex] = useState<number | null>(null);
  const [editLocalForm, setEditLocalForm] = useState<CreateLocalRequest>({
    publisher_id: 0,
    name: '',
    category_segment: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    description: '',
  });
  const [editTotemForm, setEditTotemForm] = useState<any>({
    localId: 0,
    identifier: '',
    name: '',
    uin: '',
    deviceId: '',
    description: '',
    firmwareVersion: '',
  });
  const [editSmartTvForm, setEditSmartTvForm] = useState<any>({
    totem_id: 0,
    identifier: '',
    name: '',
    device_id: '',
    brand: '',
    model: '',
    platform: '',
    firmware_version: '',
    resolution_width: undefined,
    resolution_height: undefined,
    orientation: 'landscape',
  });
  const [localForm, setLocalForm] = useState<CreateLocalRequest>({
    publisher_id: 0, // Será preenchido após criar o publisher
    name: '',
    category_segment: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    description: '',
    contract_id: undefined,
  });
  const [totemForm, setTotemForm] = useState<CreatePlayerRequest & { tempId: string }>({
    tempId: '',
    identifier: '',
    localId: 0,
    uin: '',
    deviceId: '',
    name: '',
    description: '',
    firmwareVersion: '',
    contract_id: undefined,
  });
  const [smartTvForm, setSmartTvForm] = useState<CreateSmartTvRequest & { tempId: string }>({
    tempId: '',
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
    contract_id: undefined,
  });

  useEffect(() => {
    loadPublishers();
  }, [activeOnlyFilter]);

  // Carregar dados quando dialog de edição abre
  useEffect(() => {
    if (editDialogOpen && selectedPublisher) {
      loadPublisherDataForEdit(selectedPublisher.publisher_id);
    }
  }, [editDialogOpen, selectedPublisher?.publisher_id]);



  const loadPublishers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await publisherApi.getAll({
        search: searchTerm || undefined,
        active_only: activeOnlyFilter,
      });
      setPublishers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar publishers:', error);
      setError('Erro ao carregar lista de publishers');
    } finally {
      setLoading(false);
    }
  };

  const loadPublisherStats = async (publisherId: number) => {
    try {
      const [localsResponse, totemsResponse, smartTvsResponse, statsResponse] = await Promise.all([
        publisherApi.getLocals(publisherId),
        publisherApi.getTotems(publisherId),
        publisherApi.getSmartTvs(publisherId),
        publisherApi.getStats(publisherId),
      ]);

      // Carregar contratos do publisher
      let publisherContracts: any[] = [];
      try {
        publisherContracts = await publisherContractApi.getByPublisher(publisherId);
        publisherContracts = Array.isArray(publisherContracts) ? publisherContracts : [];
        // Normalizar valores numéricos (usar undefined em vez de null para compatibilidade com tipo)
        publisherContracts = publisherContracts.map(contract => ({
          ...contract,
          revenue_share_percentage: contract.revenue_share_percentage !== null && contract.revenue_share_percentage !== undefined 
            ? Number(contract.revenue_share_percentage) 
            : undefined,
          subscription_amount: contract.subscription_amount !== null && contract.subscription_amount !== undefined 
            ? Number(contract.subscription_amount) 
            : undefined,
          minimum_payout_amount: contract.minimum_payout_amount !== null && contract.minimum_payout_amount !== undefined 
            ? Number(contract.minimum_payout_amount) 
            : undefined,
        }));
      } catch (err) {
        console.error('Erro ao carregar publisher contracts:', err);
      }

      setPublisherStats({
        locals: Array.isArray(localsResponse) ? localsResponse : [],
        totems: Array.isArray(totemsResponse) ? totemsResponse : [],
        smartTvs: Array.isArray(smartTvsResponse) ? smartTvsResponse : [],
        contracts: publisherContracts,
        stats: statsResponse || {},
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas do publisher:', error);
    }
  };

  // Carregar dados para edição
  const loadPublisherDataForEdit = async (publisherId: number) => {
    try {
      const [localsResponse, totemsResponse, smartTvsResponse] = await Promise.all([
        publisherApi.getLocals(publisherId),
        publisherApi.getTotems(publisherId),
        publisherApi.getSmartTvs(publisherId),
      ]);

      setEditLocals(Array.isArray(localsResponse) ? localsResponse : []);
      setEditTotems(Array.isArray(totemsResponse) ? totemsResponse : []);
      setEditSmartTvs(Array.isArray(smartTvsResponse) ? smartTvsResponse : []);
      
      // Carregar contratos do publisher
      await loadPublisherContracts(publisherId);
    } catch (error) {
      console.error('Erro ao carregar dados do publisher para edição:', error);
      setError('Erro ao carregar dados do publicador');
    }
  };

  // Carregar contratos do publisher
  const loadPublisherContracts = async (publisherId: number) => {
    try {
      setLoadingEditContracts(true);
      // Carregar apenas publisher contracts
      const publisherContracts = await publisherContractApi.getByPublisher(publisherId);
      const contracts = Array.isArray(publisherContracts) ? publisherContracts : [];
      // Normalizar valores numéricos (usar undefined em vez de null para compatibilidade com tipo)
      const normalizedContracts = contracts.map(contract => ({
        ...contract,
        revenue_share_percentage: contract.revenue_share_percentage !== null && contract.revenue_share_percentage !== undefined 
          ? Number(contract.revenue_share_percentage) 
          : undefined,
        subscription_amount: contract.subscription_amount !== null && contract.subscription_amount !== undefined 
          ? Number(contract.subscription_amount) 
          : undefined,
        minimum_payout_amount: contract.minimum_payout_amount !== null && contract.minimum_payout_amount !== undefined 
          ? Number(contract.minimum_payout_amount) 
          : undefined,
      }));
      setEditPublisherContracts(normalizedContracts);
    } catch (err) {
      console.error('Erro ao carregar publisher contracts:', err);
      setEditPublisherContracts([]);
    } finally {
      setLoadingEditContracts(false);
    }
  };

  // Funções CRUD para Publisher Contracts
  const handleAddPublisherContract = async () => {
    if (!selectedPublisher || !publisherContractForm.contract_number || !publisherContractForm.title) {
      setError('Número do contrato e título são obrigatórios');
      return;
    }

    try {
      if (editingPublisherContractIndex !== null) {
        const contract = editPublisherContracts[editingPublisherContractIndex];
        await publisherContractApi.update(contract.contract_id, publisherContractForm as UpdatePublisherContractRequest);
        await loadPublisherContracts(selectedPublisher.publisher_id);
        setEditingPublisherContractIndex(null);
      } else {
        await publisherContractApi.create({
          ...publisherContractForm,
          publisher_id: selectedPublisher.publisher_id,
        } as CreatePublisherContractRequest);
        await loadPublisherContracts(selectedPublisher.publisher_id);
      }
      setPublisherContractForm({
        contract_number: '',
        contract_type: 'revenue_share',
        title: '',
        description: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: undefined,
        currency: 'BRL',
        status: 'draft',
      });
    } catch (error: any) {
      console.error('Erro ao salvar publisher contract:', error);
      setError(error?.response?.data?.error || 'Erro ao salvar contrato');
    }
  };

  const handleStartEditPublisherContract = (index: number) => {
    const contract = editPublisherContracts[index];
    setPublisherContractForm({
      contract_number: contract.contract_number,
      contract_type: contract.contract_type,
      title: contract.title,
      description: contract.description,
      start_date: contract.start_date,
      end_date: contract.end_date,
      revenue_share_percentage: contract.revenue_share_percentage,
      minimum_payout_amount: contract.minimum_payout_amount,
      subscription_amount: contract.subscription_amount,
      subscription_interval: contract.subscription_interval,
      currency: contract.currency,
      payment_terms: contract.payment_terms,
      status: contract.status,
    });
    setEditingPublisherContractIndex(index);
  };

  const handleDeletePublisherContract = async (index: number) => {
    if (!selectedPublisher || !window.confirm('Tem certeza que deseja excluir este contrato?')) return;
    
    try {
      const contract = editPublisherContracts[index];
      await publisherContractApi.delete(contract.contract_id);
      await loadPublisherContracts(selectedPublisher.publisher_id);
    } catch (error: any) {
      console.error('Erro ao excluir publisher contract:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir contrato');
    }
  };

  // NOVO: Funções para gerenciar locais temporários
  const handleAddLocal = () => {
    if (!localForm.name) {
      setError('Nome do local é obrigatório');
      return;
    }
    if (editingLocalIndex !== null) {
      const updated = [...tempLocals];
      updated[editingLocalIndex] = { ...localForm };
      setTempLocals(updated);
      setEditingLocalIndex(null);
    } else {
      setTempLocals([...tempLocals, { ...localForm }]);
    }
    // CORRIGIDO: Resetar o formulário corretamente
    setLocalForm({
      publisher_id: 0,
      name: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      country: '',
      description: '',
      contract_id: undefined,
    });
  };

  const handleEditLocal = (index: number) => {
    setLocalForm({ ...tempLocals[index], publisher_id: 0 });
    setEditingLocalIndex(index);
  };

  const handleDeleteLocal = (index: number) => {
    setTempLocals(tempLocals.filter((_, i) => i !== index));
  };

  // NOVO: Funções para gerenciar totens temporários
  const handleAddTotem = () => {
    if (!totemForm.identifier) {
      setError('Identifier do totem é obrigatório');
      return;
    }
    // CORRIGIDO: Validar se localId está dentro do range válido (0 é um índice válido!)
    if (tempLocals.length === 0) {
      setError('É necessário cadastrar ao menos 1 local antes de adicionar totens');
      return;
    }
    if (totemForm.localId < 0 || totemForm.localId >= tempLocals.length) {
      setError('Local é obrigatório para o totem. Selecione um local válido.');
      return;
    }
    if (editingTotemIndex !== null) {
      const updated = [...tempTotems];
      // Preservar tempId ao editar
      updated[editingTotemIndex] = { ...totemForm, tempId: tempTotems[editingTotemIndex].tempId };
      setTempTotems(updated);
      setEditingTotemIndex(null);
    } else {
      setTempTotems([...tempTotems, { ...totemForm, tempId: `temp-${Date.now()}` }]);
    }
    setTotemForm({
      tempId: '',
      identifier: '',
      localId: 0,
      uin: '',
      deviceId: '',
      name: '',
      description: '',
      firmwareVersion: '',
      contract_id: undefined,
    });
  };

  const handleEditTotem = (index: number) => {
    setTotemForm({ ...tempTotems[index] });
    setEditingTotemIndex(index);
  };

  const handleDeleteTotem = (index: number) => {
    setTempTotems(tempTotems.filter((_, i) => i !== index));
  };

  // NOVO: Funções para gerenciar Smart TVs temporárias
  const handleAddSmartTv = () => {
    if (!smartTvForm.identifier) {
      setError('Identifier da Smart TV é obrigatório');
      return;
    }
    // CORRIGIDO: Validar se totem_id está dentro do range válido (0 é um índice válido!)
    if (tempTotems.length === 0) {
      setError('É necessário cadastrar ao menos 1 totem antes de adicionar Smart TVs');
      return;
    }
    if (smartTvForm.totem_id < 0 || smartTvForm.totem_id >= tempTotems.length) {
      setError('Totem é obrigatório para a Smart TV. Selecione um totem válido.');
      return;
    }
    if (editingSmartTvIndex !== null) {
      const updated = [...tempSmartTvs];
      // Preservar tempId ao editar
      updated[editingSmartTvIndex] = { ...smartTvForm, tempId: tempSmartTvs[editingSmartTvIndex].tempId };
      setTempSmartTvs(updated);
      setEditingSmartTvIndex(null);
    } else {
      setTempSmartTvs([...tempSmartTvs, { ...smartTvForm, tempId: `tv-${Date.now()}` }]);
    }
    setSmartTvForm({
      tempId: '',
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
      contract_id: undefined,
    });
  };

  const handleEditSmartTv = (index: number) => {
    // Preservar tempId ao editar
    setSmartTvForm({ ...tempSmartTvs[index], tempId: tempSmartTvs[index].tempId });
    setEditingSmartTvIndex(index);
  };

  const handleDeleteSmartTv = (index: number) => {
    setTempSmartTvs(tempSmartTvs.filter((_, i) => i !== index));
  };

  // ============================================================================
  // FUNÇÕES DE CRUD PARA EDIÇÃO DE PUBLICADOR
  // ============================================================================

  // Funções para gerenciar locais na edição
  const handleAddEditLocal = async () => {
    if (!selectedPublisher || !editLocalForm.name) {
      setError('Nome do local é obrigatório');
      return;
    }

    try {
      if (editingEditLocalIndex !== null) {
        // Atualizar local existente
        const localToUpdate = editLocals[editingEditLocalIndex];
        await localApi.update(localToUpdate.local_id, editLocalForm);
        // Recarregar dados
        await loadPublisherDataForEdit(selectedPublisher.publisher_id);
        setEditingEditLocalIndex(null);
      } else {
        // Criar novo local
        await localApi.create({
          ...editLocalForm,
          publisher_id: selectedPublisher.publisher_id,
        });
        // Recarregar dados
        await loadPublisherDataForEdit(selectedPublisher.publisher_id);
      }
      setEditLocalForm({
        publisher_id: selectedPublisher.publisher_id,
        name: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        country: '',
        description: '',
      });
    } catch (error: any) {
      console.error('Erro ao salvar local:', error);
      setError(error?.response?.data?.error || 'Erro ao salvar local');
    }
  };

  const handleEditEditLocal = (index: number) => {
    const local = editLocals[index];
    setEditLocalForm({
      publisher_id: local.publisher_id,
      name: local.name || '',
      address: local.address || '',
      city: local.city || '',
      state: local.state || '',
      zip_code: local.zip_code || '',
      country: local.country || '',
      description: local.description || '',
    });
    setEditingEditLocalIndex(index);
  };

  const handleDeleteEditLocal = async (index: number) => {
    if (!selectedPublisher || !window.confirm('Tem certeza que deseja excluir este local?')) return;
    
    try {
      const local = editLocals[index];
      // Remover totens e smart TVs associados a este local primeiro
      const totemsToRemove = editTotems.filter(t => t.local_id === local.local_id);
      for (const totem of totemsToRemove) {
        try {
          const smartTvsToRemove = editSmartTvs.filter(tv => tv.totem_id === totem.totem_id);
          for (const tv of smartTvsToRemove) {
            await smartTvApi.delete(tv.smart_tv_id || tv.tv_id);
          }
          await totemApi.delete(totem.totem_id);
        } catch (err) {
          console.error('Erro ao excluir totem/smart TVs:', err);
        }
      }
      await localApi.delete(local.local_id);
      // Recarregar dados
      await loadPublisherDataForEdit(selectedPublisher.publisher_id);
    } catch (error: any) {
      console.error('Erro ao excluir local:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir local');
    }
  };

  // Funções para gerenciar totens na edição
  const handleAddEditTotem = async () => {
    if (!selectedPublisher || !editTotemForm.identifier) {
      setError('Identifier do totem é obrigatório');
      return;
    }
    if (editLocals.length === 0) {
      setError('É necessário ter ao menos 1 local antes de adicionar totens');
      return;
    }
    if (editTotemForm.localId < 0 || editTotemForm.localId >= editLocals.length) {
      setError('Local é obrigatório para o totem');
      return;
    }

    try {
      const selectedLocal = editLocals[editTotemForm.localId];
      const totemData = {
        localId: selectedLocal.local_id,
        identifier: editTotemForm.identifier,
        name: editTotemForm.name || undefined,
        uin: editTotemForm.uin || undefined,
        deviceId: editTotemForm.deviceId || undefined,
        description: editTotemForm.description || undefined,
        firmwareVersion: editTotemForm.firmwareVersion || undefined,
      };

      if (editingEditTotemIndex !== null) {
        // Atualizar totem existente
        const totemToUpdate = editTotems[editingEditTotemIndex];
        await totemApi.update(totemToUpdate.totem_id, totemData);
        // Recarregar dados
        await loadPublisherDataForEdit(selectedPublisher.publisher_id);
        setEditingEditTotemIndex(null);
      } else {
        // Criar novo totem
        await totemApi.create(totemData);
        // Recarregar dados
        await loadPublisherDataForEdit(selectedPublisher.publisher_id);
      }
      setEditTotemForm({
        localId: 0,
        identifier: '',
        name: '',
        uin: '',
        deviceId: '',
        description: '',
        firmwareVersion: '',
      });
    } catch (error: any) {
      console.error('Erro ao salvar totem:', error);
      setError(error?.response?.data?.error || 'Erro ao salvar totem');
    }
  };

  const handleEditEditTotem = (index: number) => {
    const totem = editTotems[index];
    // Encontrar índice do local no array editLocals
    const localIndex = editLocals.findIndex(l => l.local_id === totem.local_id);
    setEditTotemForm({
      localId: localIndex >= 0 ? localIndex : 0,
      identifier: totem.identifier || '',
      name: totem.name || '',
      uin: totem.uin || '',
      deviceId: totem.device_id || totem.deviceId || '',
      description: totem.description || '',
      firmwareVersion: totem.firmware_version || totem.firmwareVersion || '',
    });
    setEditingEditTotemIndex(index);
  };

  const handleDeleteEditTotem = async (index: number) => {
    if (!selectedPublisher || !window.confirm('Tem certeza que deseja excluir este totem?')) return;
    
    try {
      const totem = editTotems[index];
      // Remover smart TVs associadas a este totem primeiro
      const smartTvsToRemove = editSmartTvs.filter(tv => tv.totem_id === totem.totem_id);
      for (const tv of smartTvsToRemove) {
        try {
          await smartTvApi.delete(tv.smart_tv_id || tv.tv_id);
        } catch (err) {
          console.error('Erro ao excluir Smart TV:', err);
        }
      }
      await totemApi.delete(totem.totem_id);
      // Recarregar dados
      await loadPublisherDataForEdit(selectedPublisher.publisher_id);
    } catch (error: any) {
      console.error('Erro ao excluir totem:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir totem');
    }
  };

  // Funções para gerenciar Smart TVs na edição
  const handleAddEditSmartTv = async () => {
    if (!selectedPublisher || !editSmartTvForm.identifier) {
      setError('Identifier da Smart TV é obrigatório');
      return;
    }
    if (editTotems.length === 0) {
      setError('É necessário ter ao menos 1 totem antes de adicionar Smart TVs');
      return;
    }
    if (editSmartTvForm.totem_id < 0 || editSmartTvForm.totem_id >= editTotems.length) {
      setError('Totem é obrigatório para a Smart TV');
      return;
    }

    try {
      const selectedTotem = editTotems[editSmartTvForm.totem_id];
      const smartTvData = {
        totem_id: selectedTotem.totem_id,
        identifier: editSmartTvForm.identifier,
        name: editSmartTvForm.name || undefined,
        device_id: editSmartTvForm.device_id || undefined,
        brand: editSmartTvForm.brand || undefined,
        model: editSmartTvForm.model || undefined,
        platform: editSmartTvForm.platform || undefined,
        firmware_version: editSmartTvForm.firmware_version || undefined,
        resolution_width: editSmartTvForm.resolution_width,
        resolution_height: editSmartTvForm.resolution_height,
        orientation: editSmartTvForm.orientation || 'landscape',
      };

      if (editingEditSmartTvIndex !== null) {
        // Atualizar Smart TV existente
        const tvToUpdate = editSmartTvs[editingEditSmartTvIndex];
        await smartTvApi.update(tvToUpdate.smart_tv_id || tvToUpdate.tv_id, smartTvData);
        // Recarregar dados
        await loadPublisherDataForEdit(selectedPublisher.publisher_id);
        setEditingEditSmartTvIndex(null);
      } else {
        // Criar nova Smart TV
        await smartTvApi.create(smartTvData);
        // Recarregar dados
        await loadPublisherDataForEdit(selectedPublisher.publisher_id);
      }
      setEditSmartTvForm({
        totem_id: 0,
        identifier: '',
        name: '',
        device_id: '',
        brand: '',
        model: '',
        platform: '',
        firmware_version: '',
        resolution_width: undefined,
        resolution_height: undefined,
        orientation: 'landscape',
      });
    } catch (error: any) {
      console.error('Erro ao salvar Smart TV:', error);
      setError(error?.response?.data?.error || 'Erro ao salvar Smart TV');
    }
  };

  const handleEditEditSmartTv = (index: number) => {
    const smartTv = editSmartTvs[index];
    // Encontrar índice do totem no array editTotems
    const totemIndex = editTotems.findIndex(t => t.totem_id === smartTv.totem_id);
    setEditSmartTvForm({
      totem_id: totemIndex >= 0 ? totemIndex : 0,
      identifier: smartTv.identifier || '',
      name: smartTv.name || '',
      device_id: smartTv.device_id || '',
      brand: smartTv.brand || '',
      model: smartTv.model || '',
      platform: smartTv.platform || '',
      firmware_version: smartTv.firmware_version || '',
      resolution_width: smartTv.resolution_width,
      resolution_height: smartTv.resolution_height,
      orientation: smartTv.orientation || 'landscape',
    });
    setEditingEditSmartTvIndex(index);
  };

  const handleDeleteEditSmartTv = async (index: number) => {
    if (!selectedPublisher || !window.confirm('Tem certeza que deseja excluir esta Smart TV?')) return;
    
    try {
      const smartTv = editSmartTvs[index];
      await smartTvApi.delete(smartTv.smart_tv_id || smartTv.tv_id);
      // Recarregar dados
      await loadPublisherDataForEdit(selectedPublisher.publisher_id);
    } catch (error: any) {
      console.error('Erro ao excluir Smart TV:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir Smart TV');
    }
  };

  // Função auxiliar para validar email
  const validateEmail = (email: string): boolean => {
    if (!email || email.trim() === '') return true; // Email é opcional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // Função auxiliar para validar telefone
  const validatePhone = (phone: string): boolean => {
    if (!phone || phone.trim() === '') return true; // Telefone é opcional
    const phoneRegex = /^[\d\s\+\-\(\)]+$/;
    return phoneRegex.test(phone.trim());
  };


  // NOVO: handleCreatePublisher modificado para criar publisher, locais e totens
  const handleCreatePublisher = async () => {
    try {
      // Limpar erros anteriores
      setError(null);

      // Validação: nome do publisher é obrigatório
      if (!newPublisher.name || newPublisher.name.trim() === '') {
        setError('Nome do Publicador é obrigatório. Por favor, preencha o campo "Nome da Empresa / Razão Social".');
        setCreateTab(0); // Ir para aba de Informações
        return;
      }

      // Validação: nome deve ter pelo menos 3 caracteres
      if (newPublisher.name.trim().length < 3) {
        setError('O nome do Publicador deve ter pelo menos 3 caracteres.');
        setCreateTab(0);
        return;
      }

      // Validação: email (se fornecido)
      if (newPublisher.email && newPublisher.email.trim() !== '' && !validateEmail(newPublisher.email)) {
        setError('Email inválido. Por favor, insira um endereço de email válido (exemplo: nome@empresa.com).');
        setCreateTab(0);
        return;
      }

      // Validação: telefone (se fornecido)
      if (newPublisher.phone && newPublisher.phone.trim() !== '' && !validatePhone(newPublisher.phone)) {
        setError('Telefone inválido. Use apenas números, espaços, +, -, e parênteses.');
        setCreateTab(0);
        return;
      }

      // Validação: WhatsApp (se fornecido)
      if (newPublisher.whatsapp && newPublisher.whatsapp.trim() !== '' && !validatePhone(newPublisher.whatsapp)) {
        setError('WhatsApp inválido. Use apenas números, espaços, +, -, e parênteses.');
        setCreateTab(0);
        return;
      }

      // Validação: ao menos 1 local obrigatório
      if (tempLocals.length === 0) {
        setError('É obrigatório cadastrar ao menos 1 local antes de criar o Publicador. Vá para a aba "Locais" e adicione pelo menos um local.');
        setCreateTab(1); // Ir para aba de Locais
        return;
      }

      // Validação: ao menos 1 totem obrigatório
      if (tempTotems.length === 0) {
        setError('É obrigatório cadastrar ao menos 1 totem (player) antes de criar o Publicador. Vá para a aba "Totens" e adicione pelo menos um totem.');
        setCreateTab(2); // Ir para aba de Totens
        return;
      }

      // 1. Criar o publisher
      // Remover contract_id se for undefined para não enviar no payload
      const publisherData: CreatePublisherRequest = {
        ...newPublisher,
      };
      const createdPublisher = await publisherApi.create(publisherData);
      const publisherId = createdPublisher.publisher_id;
      
      if (!publisherId) {
        const errorMessage = 'Erro: Publicador criado mas não retornou ID válido';
        console.error(errorMessage);
        setError(errorMessage);
        return;
      }

      // 2. Criar os locais
      const createdLocals: Local[] = [];
      for (const local of tempLocals) {
        const createdLocal = await localApi.create({
          ...local,
          publisher_id: publisherId,
          contract_id: local.contract_id || undefined
        });
        createdLocals.push(createdLocal);
      }

      // 3. Criar os totens (usando os IDs dos locais criados)
      // O localId no totem é o índice do local na lista tempTotems
      const createdTotems: any[] = [];
      for (const totem of tempTotems) {
        const localIndex = totem.localId; // localId já é o índice
        if (localIndex >= 0 && localIndex < createdLocals.length && createdLocals[localIndex]) {
          const localId = createdLocals[localIndex].local_id;
          
          // Validar que temos name ou identifier (requisito do backend)
          if (!totem.name && !totem.identifier) {
            const errorMessage = `Totem na posição ${localIndex + 1}: Nome ou identificador é obrigatório`;
            console.error(errorMessage);
            setError(errorMessage);
            return;
          }
          
          // Validar que localId é um número válido
          if (!localId || isNaN(Number(localId))) {
            const errorMessage = `Totem na posição ${localIndex + 1}: Local ID inválido`;
            console.error(errorMessage, { localId, createdLocals });
            setError(errorMessage);
            return;
          }
          
          // Preparar dados do totem (identifier é obrigatório na interface, mas backend aceita name OU identifier)
          const totemData: any = {
            localId: Number(localId), // Garantir que é número
            contract_id: totem.contract_id || undefined
          };
          
          // Adicionar identifier OU name (backend requer pelo menos um)
          // Backend valida: identifier deve ter entre 2 e 100 caracteres se fornecido
          if (totem.identifier && totem.identifier.trim().length >= 2) {
            totemData.identifier = totem.identifier.trim();
          }
          if (totem.name && totem.name.trim().length >= 2) {
            totemData.name = totem.name.trim();
          }
          
          // Validar que temos pelo menos um (name ou identifier)
          if (!totemData.identifier && !totemData.name) {
            const errorMessage = `Totem na posição ${localIndex + 1}: Nome ou identificador é obrigatório e deve ter pelo menos 2 caracteres`;
            console.error(errorMessage, { identifier: totem.identifier, name: totem.name });
            setError(errorMessage);
            return;
          }
          
          // Adicionar campos opcionais apenas se tiverem valor
          if (totem.uin && totem.uin.trim()) {
            totemData.uin = totem.uin.trim();
          }
          if (totem.deviceId && totem.deviceId.trim()) {
            totemData.deviceId = totem.deviceId.trim();
          }
          if (totem.description && totem.description.trim()) {
            totemData.description = totem.description.trim();
          }
          if (totem.firmwareVersion && totem.firmwareVersion.trim()) {
            totemData.firmwareVersion = totem.firmwareVersion.trim();
          }
          
          try {
            const createdTotem = await totemApi.create(totemData);
            createdTotems.push(createdTotem);
          } catch (totemError: any) {
            console.error('Erro ao criar totem:', totemError);
            console.error('Response completa:', totemError?.response);
            console.error('Dados enviados:', totemData);
            
            let errorMessage = `Erro ao criar totem "${totem.identifier || totem.name}": `;
            
            if (totemError?.response?.data) {
              if (totemError.response.data.details && Array.isArray(totemError.response.data.details)) {
                const validationErrors = totemError.response.data.details
                  .map((detail: any) => detail.msg || detail.message || JSON.stringify(detail))
                  .join(', ');
                errorMessage += validationErrors;
              } else if (totemError.response.data.error) {
                errorMessage += totemError.response.data.error;
              } else if (totemError.response.data.message) {
                errorMessage += totemError.response.data.message;
              }
            } else if (totemError?.message) {
              errorMessage += totemError.message;
            } else {
              errorMessage += 'Erro desconhecido';
            }
            
            setError(errorMessage);
            return;
          }
        } else {
          const errorMessage = `Totem na posição ${localIndex + 1}: Local inválido ou não encontrado`;
          console.error(errorMessage, { localIndex, createdLocals });
          setError(errorMessage);
          return;
        }
      }

      // 4. Criar as Smart TVs (usando os IDs dos totens criados)
      // O totem_id na Smart TV é o índice do totem na lista tempTotems
      for (const smartTv of tempSmartTvs) {
        const totemIndex = smartTv.totem_id; // totem_id já é o índice
        if (totemIndex >= 0 && totemIndex < createdTotems.length && createdTotems[totemIndex]) {
          const totem = createdTotems[totemIndex];
          // Obter o ID do totem (pode ser totem_id ou id)
          const totemId = totem.totem_id || totem.id;
          
          // Validar que temos identifier (obrigatório)
          if (!smartTv.identifier || !smartTv.identifier.trim()) {
            console.warn(`Smart TV ignorada: identifier é obrigatório`, smartTv);
            continue;
          }
          
          // Validar que temos totemId válido
          if (!totemId || totemId <= 0) {
            console.warn(`Smart TV ignorada: totemId inválido`, { totem, totemId });
            continue;
          }
          
          try {
            // Preparar dados da Smart TV (remover campos undefined/null)
            const smartTvData: any = {
              totem_id: totemId,
              identifier: smartTv.identifier.trim(),
              contract_id: smartTv.contract_id || undefined
            };
            
            // Adicionar campos opcionais apenas se tiverem valor
            if (smartTv.device_id && smartTv.device_id.trim()) {
              smartTvData.device_id = smartTv.device_id.trim();
            }
            if (smartTv.name && smartTv.name.trim()) {
              smartTvData.name = smartTv.name.trim();
            }
            if (smartTv.brand && smartTv.brand.trim()) {
              smartTvData.brand = smartTv.brand.trim();
            }
            if (smartTv.model && smartTv.model.trim()) {
              smartTvData.model = smartTv.model.trim();
            }
            if (smartTv.platform && smartTv.platform.trim()) {
              smartTvData.platform = smartTv.platform.trim();
            }
            if (smartTv.firmware_version && smartTv.firmware_version.trim()) {
              smartTvData.firmware_version = smartTv.firmware_version.trim();
            }
            if (smartTv.resolution_width && smartTv.resolution_width > 0) {
              smartTvData.resolution_width = smartTv.resolution_width;
            }
            if (smartTv.resolution_height && smartTv.resolution_height > 0) {
              smartTvData.resolution_height = smartTv.resolution_height;
            }
            if (smartTv.orientation && (smartTv.orientation === 'landscape' || smartTv.orientation === 'portrait')) {
              smartTvData.orientation = smartTv.orientation;
            }
            
            await smartTvApi.create(smartTvData);
          } catch (smartTvError: any) {
            console.error(`Erro ao criar Smart TV ${smartTv.identifier}:`, smartTvError);
            console.error('Response:', smartTvError?.response?.data);
            // Continuar com as próximas Smart TVs mesmo se uma falhar
            const errorMessage = smartTvError?.response?.data?.error || smartTvError?.message || 'Erro desconhecido';
            setError(`Erro ao criar Smart TV "${smartTv.identifier}": ${errorMessage}`);
          }
        } else {
          console.warn(`Smart TV ignorada: totemIndex inválido ou totem não encontrado`, { 
            totemIndex, 
            createdTotemsLength: createdTotems.length,
            smartTv 
          });
        }
      }

      // Subscribers não são criados aqui - são gerenciados separadamente

      // 5. Criar os contratos de publisher (se houver)
      for (const contract of tempPublisherContracts) {
        try {
          await publisherContractApi.create({
            ...contract,
            publisher_id: publisherId,
          } as CreatePublisherContractRequest);
        } catch (contractError: any) {
          console.error('Erro ao criar contrato de publisher:', contractError);
          // Continuar com os outros contratos mesmo se um falhar
        }
      }

      // Recarregar lista de publishers
      await loadPublishers();

      // Limpar estados
      setCreateDialogOpen(false);
      setCreateTab(0);
      setNewPublisher({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        whatsapp: '',
        description: '',
        is_subscriber: false,
        is_publisher: true,
        client_type: 'publisher',
        contract_id: undefined,
      });
      setTempLocals([]);
      setTempTotems([]);
      setTempSmartTvs([]);
      setTempPublisherContracts([]);
      setLocalForm({
        publisher_id: 0,
        name: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        country: '',
        description: '',
        contract_id: undefined,
      });
      setTotemForm({
        tempId: '',
        identifier: '',
        localId: 0,
        uin: '',
        deviceId: '',
        name: '',
        description: '',
        firmwareVersion: '',
        contract_id: undefined,
      });
      setSmartTvForm({
        tempId: '',
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
        contract_id: undefined,
      });
      
      loadPublishers();
    } catch (error: any) {
      console.error('Erro ao criar publisher:', error);
      
      // Melhorar tratamento de erro para mostrar detalhes completos
      let errorMessage = 'Erro ao criar publisher';
      
      if (error?.response?.data) {
        // Erro de validação do backend
        if (error.response.data.details && Array.isArray(error.response.data.details)) {
          const validationErrors = error.response.data.details
            .map((detail: any) => detail.msg || detail.message || JSON.stringify(detail))
            .join(', ');
          errorMessage = `Dados inválidos: ${validationErrors}`;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
      // Se for erro de validação, voltar para aba de Informações
      if (error?.response?.status === 400) {
        setCreateTab(0);
      }
    }
  };

  const handleEditPublisher = async () => {
    if (!selectedPublisher) return;
    
    try {
      const updateData: UpdatePublisherRequest = {
        name: selectedPublisher.name,
        contact_name: selectedPublisher.contact_name,
        email: selectedPublisher.email,
        phone: selectedPublisher.phone,
        whatsapp: selectedPublisher.whatsapp,
        description: selectedPublisher.description,
        is_subscriber: selectedPublisher.is_subscriber,
        is_publisher: selectedPublisher.is_publisher,
        client_type: selectedPublisher.client_type,
        active: selectedPublisher.active,
      };
      await publisherApi.update(selectedPublisher.publisher_id, updateData);
      setEditDialogOpen(false);
      setEditTab(0);
      setEditLocals([]);
      setEditTotems([]);
      setEditSmartTvs([]);
      setEditingEditLocalIndex(null);
      setEditingEditTotemIndex(null);
      setEditingEditSmartTvIndex(null);
      setSelectedPublisher(null);
      loadPublishers();
    } catch (error: any) {
      console.error('Erro ao atualizar publisher:', error);
      setError(error?.response?.data?.error || error?.message || 'Erro ao atualizar publicador');
    }
  };

  const handleDeletePublisher = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este publicador?')) {
      try {
        await publisherApi.delete(id);
        loadPublishers();
      } catch (error: any) {
        console.error('Erro ao excluir publisher:', error);
        setError(error?.response?.data?.error || error?.message || 'Erro ao excluir publisher');
      }
    }
  };

  const handleViewDetails = async (publisher: Publisher) => {
    setSelectedPublisher(publisher);
    await loadPublisherStats(publisher.publisher_id);
    setDetailsDialogOpen(true);
    setDetailsTab(0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getClientTypeLabel = (clientType?: string) => {
    switch (clientType) {
      case 'subscriber': return 'Assinante';
      case 'publisher': return 'Publicador';
      case 'both': return 'Ambos';
      default: return 'N/A';
    }
  };

  const getClientTypeColor = (clientType?: string) => {
    switch (clientType) {
      case 'subscriber': return 'primary';
      case 'publisher': return 'success';
      case 'both': return 'warning';
      default: return 'default';
    }
  };

  if (loading && publishers.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando publicadores...
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
            📢 Manter Publicadores
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie publicadores e suas informações
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ 
            backgroundColor: theme.palette.primary.main,
            '&:hover': { backgroundColor: theme.palette.primary.dark }
          }}
        >
          Adicionar Publicador
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Buscar publicadores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    loadPublishers();
                  }
                }}
                InputProps={{
                  startAdornment: <Business sx={{ mr: 1, color: theme.palette.text.secondary }} />,
                }}
              />
            </Grid>
            {/* (Regra do sistema) Publisher NUNCA é Subscriber/ambos, então removemos filtro de tipo */}
            <Grid item xs={12} md={2}>
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
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadPublishers}
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

      {/* Publishers Grid */}
      <Grid container spacing={3}>
        {publishers.map((publisher) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={publisher.publisher_id}>
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
                  <Business />
                </Avatar>
                
                <Chip
                  label={publisher.active ? 'Ativo' : 'Inativo'}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: alpha(publisher.active ? theme.palette.success.main : theme.palette.error.main, 0.1),
                    color: publisher.active ? theme.palette.success.main : theme.palette.error.main,
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
                    Criado em {publisher.created_at ? formatDate(publisher.created_at) : 'N/A'}
                  </Typography>
                </Box>
              </Box>

              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
                  {publisher.name}
                </Typography>
                
                <Chip
                  label={getClientTypeLabel(publisher.client_type)}
                  size="small"
                  color={getClientTypeColor(publisher.client_type) as any}
                  sx={{ mb: 1 }}
                />
                
                {publisher.contact_name && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <People fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      Contato: {publisher.contact_name}
                    </Typography>
                  </Box>
                )}

                {publisher.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Email fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {publisher.email}
                    </Typography>
                  </Box>
                )}

                {publisher.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {publisher.phone}
                    </Typography>
                  </Box>
                )}

                {publisher.whatsapp && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      WhatsApp: {publisher.whatsapp}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleViewDetails(publisher)}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Detalhes
                  </Button>
                  
                  <Box>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => {
                        setSelectedPublisher(publisher);
                        setEditDialogOpen(true);
                      }}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDeletePublisher(publisher.publisher_id)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {publishers.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <Business sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhum publicador encontrado
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece adicionando seus primeiros publicadores
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Adicionar Primeiro Publicador
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog com Abas */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => {
          setCreateDialogOpen(false);
          setCreateTab(0);
          setTempLocals([]);
          setTempTotems([]);
          setTempSmartTvs([]);
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>Adicionar Publicador</DialogTitle>
        <DialogContent>
          <Tabs value={createTab} onChange={(_, newValue) => setCreateTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Informações" />
            <Tab label="Locais" icon={tempLocals.length > 0 ? <Chip label={tempLocals.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Totens" icon={tempTotems.length > 0 ? <Chip label={tempTotems.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Smart TVs" icon={tempSmartTvs.length > 0 ? <Chip label={tempSmartTvs.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Contratos" icon={tempPublisherContracts && tempPublisherContracts.length > 0 ? <Chip label={tempPublisherContracts.length} size="small" color="primary" /> : undefined} iconPosition="end" />
          </Tabs>

          {/* Aba Informações */}
          {createTab === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Dados do Publicador</Typography>
              
              <TextField
                fullWidth
                label="Nome da Empresa / Razão Social"
                value={newPublisher.name}
                onChange={(e) => setNewPublisher({ ...newPublisher, name: e.target.value })}
                margin="normal"
                required
                helperText="Nome completo da empresa ou razão social"
              />
              <TextField
                fullWidth
                label="Nome do Contato"
                value={newPublisher.contact_name}
                onChange={(e) => setNewPublisher({ ...newPublisher, contact_name: e.target.value })}
                margin="normal"
                helperText="Nome da pessoa responsável pelo contato"
              />
              <TextField
                fullWidth
                id="publisher-create-category-segment"
                name="category_segment"
                label="Categoria/Segmento"
                value={newPublisher.category_segment || ''}
                onChange={(e) => setNewPublisher({ ...newPublisher, category_segment: e.target.value })}
                margin="normal"
                helperText="Ex.: Farmácia, Cinema, Shopping, OOH..."
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newPublisher.email}
                onChange={(e) => setNewPublisher({ ...newPublisher, email: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Telefone"
                value={newPublisher.phone}
                onChange={(e) => setNewPublisher({ ...newPublisher, phone: e.target.value })}
                margin="normal"
                helperText="Telefone comercial (formato: +55 11 1234-5678)"
              />
              <TextField
                fullWidth
                label="WhatsApp"
                value={newPublisher.whatsapp}
                onChange={(e) => setNewPublisher({ ...newPublisher, whatsapp: e.target.value })}
                margin="normal"
                helperText="Número do WhatsApp (formato: +55 11 98765-4321)"
              />
              <TextField
                fullWidth
                label="Descrição"
                value={newPublisher.description}
                onChange={(e) => setNewPublisher({ ...newPublisher, description: e.target.value })}
                margin="normal"
                multiline
                rows={3}
              />
              {/* (Regra do sistema) Publisher é sempre Publicador. Não permitir marcar como subscriber/ambos. */}

            </Box>
          )}

          {/* Aba Locais */}
          {createTab === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Locais {tempLocals.length > 0 && `(${tempLocals.length})`}
              </Typography>
              <Alert severity="warning" sx={{ mb: 2 }}>
                É obrigatório cadastrar ao menos 1 local antes de criar o publicador.
              </Alert>
              
              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Adicionar Local</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nome do Local *"
                      value={localForm.name}
                      onChange={(e) => setLocalForm({ ...localForm, name: e.target.value })}
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      id="publisher-local-create-category-segment"
                      name="category_segment"
                      label="Categoria/Segmento"
                      value={localForm.category_segment || ''}
                      onChange={(e) => setLocalForm({ ...localForm, category_segment: e.target.value })}
                      size="small"
                      helperText="Ex.: Farmácia, Cinema, Shopping..."
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Endereço"
                      value={localForm.address || ''}
                      onChange={(e) => setLocalForm({ ...localForm, address: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Cidade"
                      value={localForm.city || ''}
                      onChange={(e) => setLocalForm({ ...localForm, city: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Estado"
                      value={localForm.state || ''}
                      onChange={(e) => setLocalForm({ ...localForm, state: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="CEP"
                      value={localForm.zip_code || ''}
                      onChange={(e) => setLocalForm({ ...localForm, zip_code: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={localForm.description || ''}
                      onChange={(e) => setLocalForm({ ...localForm, description: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddLocal}
                      disabled={!localForm.name}
                    >
                      {editingLocalIndex !== null ? 'Atualizar Local' : 'Adicionar Local'}
                    </Button>
                    {editingLocalIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingLocalIndex(null);
                          setLocalForm({
                            publisher_id: 0,
                            name: '',
                            address: '',
                            city: '',
                            state: '',
                            zip_code: '',
                            country: '',
                            description: '',
                          });
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {tempLocals.length > 0 ? (
                <List>
                  {tempLocals.map((local, index) => (
                    <ListItem key={index} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                      <ListItemIcon><Store /></ListItemIcon>
                      <ListItemText
                        primary={local.name}
                        secondary={`${local.address || ''} ${local.city || ''} ${local.state || ''}`.trim() || 'Sem endereço'}
                      />
                      <IconButton size="small" onClick={() => handleEditLocal(index)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteLocal(index)}>
                        <Delete />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">Nenhum local cadastrado ainda. Adicione ao menos 1 local.</Alert>
              )}
            </Box>
          )}

          {/* Aba Totens */}
          {createTab === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Totens {tempTotems.length > 0 && `(${tempTotems.length})`}
              </Typography>
              {tempLocals.length === 0 ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Você precisa cadastrar ao menos 1 local na aba "Locais" antes de adicionar totens.
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Os totens (players) devem estar atrelados a um local. Selecione um local no campo abaixo.
                  <strong> Nota:</strong> Os totens são players com player embutido.
                </Alert>
              )}

              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Adicionar Totem</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Local *</InputLabel>
                      <Select
                        value={totemForm.localId}
                        label="Local *"
                        onChange={(e) => setTotemForm({ ...totemForm, localId: Number(e.target.value) })}
                      >
                        {tempLocals.map((local, index) => (
                          <MenuItem key={index} value={index}>
                            {local.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Identifier *"
                      value={totemForm.identifier}
                      onChange={(e) => setTotemForm({ ...totemForm, identifier: e.target.value })}
                      size="small"
                      required
                      helperText="Identificador único do totem"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nome"
                      value={totemForm.name || ''}
                      onChange={(e) => setTotemForm({ ...totemForm, name: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Device ID"
                      value={totemForm.deviceId || ''}
                      onChange={(e) => setTotemForm({ ...totemForm, deviceId: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="UIN"
                      value={totemForm.uin || ''}
                      onChange={(e) => setTotemForm({ ...totemForm, uin: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Firmware Version"
                      value={totemForm.firmwareVersion || ''}
                      onChange={(e) => setTotemForm({ ...totemForm, firmwareVersion: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={totemForm.description || ''}
                      onChange={(e) => setTotemForm({ ...totemForm, description: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddTotem}
                      disabled={!totemForm.identifier || tempLocals.length === 0 || totemForm.localId < 0 || totemForm.localId >= tempLocals.length}
                    >
                      {editingTotemIndex !== null ? 'Atualizar Totem' : 'Adicionar Totem'}
                    </Button>
                    {editingTotemIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingTotemIndex(null);
                          setTotemForm({
                            tempId: '',
                            identifier: '',
                            localId: 0,
                            uin: '',
                            deviceId: '',
                            name: '',
                            description: '',
                            firmwareVersion: '',
                          });
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {tempTotems.length > 0 ? (
                <List>
                  {tempTotems.map((totem, index) => {
                    const localName = tempLocals[totem.localId]?.name || 'Local não encontrado';
                    return (
                      <ListItem key={totem.tempId || index} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                        <ListItemIcon><Computer /></ListItemIcon>
                        <ListItemText
                          primary={totem.name || totem.identifier}
                          secondary={`Local: ${localName} | Identifier: ${totem.identifier}`}
                        />
                        <IconButton size="small" onClick={() => handleEditTotem(index)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteTotem(index)}>
                          <Delete />
                        </IconButton>
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Alert severity="info">
                  {tempLocals.length === 0 
                    ? 'Cadastre locais na aba "Locais" para poder adicionar totens (players).'
                    : 'Nenhum totem cadastrado ainda. Os totens são players com player embutido.'}
                </Alert>
              )}
            </Box>
          )}

          {/* Aba Smart TVs */}
          {createTab === 3 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Smart TVs {tempSmartTvs.length > 0 && `(${tempSmartTvs.length})`}
              </Typography>
              {tempTotems.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Para adicionar Smart TVs, você precisa cadastrar ao menos 1 totem na aba "Totens". 
                  <strong> Nota:</strong> As Smart TVs são opcionais - o próprio totem já possui um player embutido.
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  As Smart TVs são opcionais e devem estar atreladas a um totem. 
                  <strong> Nota:</strong> O totem já possui um player embutido, então as Smart TVs são apenas para conectividade adicional.
                </Alert>
              )}

              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Adicionar Smart TV</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Totem *</InputLabel>
                      <Select
                        value={smartTvForm.totem_id}
                        label="Totem *"
                        onChange={(e) => setSmartTvForm({ ...smartTvForm, totem_id: Number(e.target.value) })}
                      >
                        {tempTotems.map((totem, index) => (
                          <MenuItem key={totem.tempId || index} value={index}>
                            {totem.name || totem.identifier} {tempLocals[totem.localId] && `(${tempLocals[totem.localId].name})`}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Identifier *"
                      value={smartTvForm.identifier}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, identifier: e.target.value })}
                      size="small"
                      required
                      helperText="Identificador único da Smart TV"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nome"
                      value={smartTvForm.name || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, name: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Device ID"
                      value={smartTvForm.device_id || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, device_id: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Marca"
                      value={smartTvForm.brand || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, brand: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Modelo"
                      value={smartTvForm.model || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, model: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Plataforma"
                      value={smartTvForm.platform || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, platform: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Versão do Firmware"
                      value={smartTvForm.firmware_version || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, firmware_version: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Largura (px)"
                      type="number"
                      value={smartTvForm.resolution_width || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, resolution_width: e.target.value ? Number(e.target.value) : undefined })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Altura (px)"
                      type="number"
                      value={smartTvForm.resolution_height || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, resolution_height: e.target.value ? Number(e.target.value) : undefined })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Orientação</InputLabel>
                      <Select
                        value={smartTvForm.orientation || 'landscape'}
                        label="Orientações"
                        onChange={(e) => setSmartTvForm({ ...smartTvForm, orientation: e.target.value as 'landscape' | 'portrait' })}
                      >
                        <MenuItem value="landscape">Paisagem</MenuItem>
                        <MenuItem value="portrait">Retrato</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddSmartTv}
                      disabled={!smartTvForm.identifier || tempTotems.length === 0 || smartTvForm.totem_id < 0 || smartTvForm.totem_id >= tempTotems.length}
                    >
                      {editingSmartTvIndex !== null ? 'Atualizar Smart TV' : 'Adicionar Smart TV'}
                    </Button>
                    {editingSmartTvIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingSmartTvIndex(null);
                          setSmartTvForm({
                            tempId: '',
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
                          });
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {tempSmartTvs.length > 0 ? (
                <List>
                  {tempSmartTvs.map((smartTv, index) => {
                    const totemName = tempTotems[smartTv.totem_id]?.name || tempTotems[smartTv.totem_id]?.identifier || 'Totem não encontrado';
                    return (
                      <ListItem key={smartTv.tempId || index} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                        <ListItemIcon><Tv /></ListItemIcon>
                        <ListItemText
                          primary={smartTv.name || smartTv.identifier}
                          secondary={`Totem: ${totemName} | Identifier: ${smartTv.identifier}${smartTv.brand ? ` | ${smartTv.brand} ${smartTv.model || ''}` : ''}`}
                        />
                        <IconButton size="small" onClick={() => handleEditSmartTv(index)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteSmartTv(index)}>
                          <Delete />
                        </IconButton>
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Alert severity="info">
                  {tempTotems.length === 0 
                    ? 'Cadastre totens na aba "Totens" para poder adicionar Smart TVs. Lembre-se: o totem já possui um player embutido, então as Smart TVs são opcionais.'
                    : 'Nenhuma Smart TV cadastrada ainda. As Smart TVs são opcionais - o totem já possui um player embutido.'}
                </Alert>
              )}
            </Box>
          )}

          {/* Aba Contratos */}
          {createTab === 4 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Contratos do Publicador</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Os contratos são opcionais. Você pode adicionar contratos após criar o publicador ou durante a criação.
              </Alert>
              
              {/* Formulário para criar/editar Publisher Contract */}
              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, bgcolor: editingPublisherContractIndexCreate !== null ? alpha(theme.palette.primary.main, 0.05) : 'transparent' }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  {editingPublisherContractIndexCreate !== null ? 'Editar Contrato de Publisher' : 'Adicionar Contrato de Publisher'}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Número do Contrato *"
                      value={publisherContractForm.contract_number || ''}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, contract_number: e.target.value })}
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Tipo de Contrato *</InputLabel>
                      <Select
                        value={publisherContractForm.contract_type || 'revenue_share'}
                        label="Tipo de Contrato *"
                        onChange={(e) => setPublisherContractForm({ ...publisherContractForm, contract_type: e.target.value as any })}
                      >
                        <MenuItem value="revenue_share">Revenue Share</MenuItem>
                        <MenuItem value="subscription">Subscription</MenuItem>
                        <MenuItem value="partnership">Partnership</MenuItem>
                        <MenuItem value="hybrid">Hybrid</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Título *"
                      value={publisherContractForm.title || ''}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, title: e.target.value })}
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={publisherContractForm.description || ''}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, description: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Data de Início *"
                      type="date"
                      value={publisherContractForm.start_date || ''}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, start_date: e.target.value })}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Data de Término"
                      type="date"
                      value={publisherContractForm.end_date || ''}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, end_date: e.target.value || undefined })}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Moeda"
                      value={publisherContractForm.currency || 'BRL'}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, currency: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={publisherContractForm.status || 'draft'}
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
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => {
                        if (!publisherContractForm.contract_number || !publisherContractForm.title) {
                          setError('Número do contrato e título são obrigatórios');
                          return;
                        }
                        if (editingPublisherContractIndexCreate !== null) {
                          const updated = [...tempPublisherContracts];
                          updated[editingPublisherContractIndexCreate] = { ...publisherContractForm as CreatePublisherContractRequest, tempId: tempPublisherContracts[editingPublisherContractIndexCreate].tempId };
                          setTempPublisherContracts(updated);
                          setEditingPublisherContractIndexCreate(null);
                        } else {
                          setTempPublisherContracts([...tempPublisherContracts, { ...publisherContractForm as CreatePublisherContractRequest, tempId: `temp-${Date.now()}` }]);
                        }
                        setPublisherContractForm({
                          contract_number: '',
                          contract_type: 'revenue_share',
                          title: '',
                          description: '',
                          start_date: new Date().toISOString().split('T')[0],
                          end_date: undefined,
                          currency: 'BRL',
                          status: 'draft',
                        });
                      }}
                      disabled={!publisherContractForm.contract_number || !publisherContractForm.title}
                    >
                      {editingPublisherContractIndexCreate !== null ? 'Atualizar Contrato' : 'Adicionar Contrato'}
                    </Button>
                    {editingPublisherContractIndexCreate !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingPublisherContractIndexCreate(null);
                          setPublisherContractForm({
                            contract_number: '',
                            contract_type: 'revenue_share',
                            title: '',
                            description: '',
                            start_date: new Date().toISOString().split('T')[0],
                            end_date: undefined,
                            currency: 'BRL',
                            status: 'draft',
                          });
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {/* Lista de Publisher Contracts temporários */}
              {tempPublisherContracts.length > 0 ? (
                <List>
                  {tempPublisherContracts.map((contract, index) => (
                    <ListItem
                      key={contract.tempId}
                      sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        mb: 1,
                        flexDirection: 'column',
                        alignItems: 'stretch',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {contract.contract_number} - {contract.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {contract.description || 'Sem descrição'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip
                            label={contract.status || 'draft'}
                            size="small"
                            color={contract.status === 'active' ? 'success' : 'default'}
                          />
                          <IconButton
                            size="small"
                            onClick={() => {
                              setPublisherContractForm({ ...contract });
                              setEditingPublisherContractIndexCreate(index);
                            }}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setTempPublisherContracts(tempPublisherContracts.filter((_, i) => i !== index));
                              if (editingPublisherContractIndexCreate === index) {
                                setEditingPublisherContractIndexCreate(null);
                                setPublisherContractForm({
                                  contract_number: '',
                                  contract_type: 'revenue_share',
                                  title: '',
                                  description: '',
                                  start_date: new Date().toISOString().split('T')[0],
                                  end_date: undefined,
                                  currency: 'BRL',
                                  status: 'draft',
                                });
                              }
                            }}
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">
                  Nenhum contrato de publisher adicionado ainda. Os contratos são opcionais.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setCreateTab(0);
          setTempLocals([]);
          setTempTotems([]);
          setTempSmartTvs([]);
          setTempPublisherContracts([]);
        }}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreatePublisher}
            disabled={tempLocals.length === 0 || tempTotems.length === 0}
          >
            Criar Publicador
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog com Abas */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => {
          setEditDialogOpen(false);
          setEditTab(0);
          setEditLocals([]);
          setEditTotems([]);
          setEditSmartTvs([]);
          setEditingEditLocalIndex(null);
          setEditingEditTotemIndex(null);
          setEditingEditSmartTvIndex(null);
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>Editar Publicador</DialogTitle>
        <DialogContent>
          <Tabs value={editTab} onChange={(_, newValue) => setEditTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Informações" />
            <Tab label="Locais" icon={editLocals.length > 0 ? <Chip label={editLocals.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Totens" icon={editTotems.length > 0 ? <Chip label={editTotems.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Smart TVs" icon={editSmartTvs.length > 0 ? <Chip label={editSmartTvs.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Contratos" icon={editPublisherContracts.length > 0 ? <Chip label={editPublisherContracts.length} size="small" color="primary" /> : undefined} iconPosition="end" />
          </Tabs>

          {/* Aba Informações */}
          {editTab === 0 && selectedPublisher && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Dados do Publicador</Typography>
              <TextField
                fullWidth
                label="Nome da Empresa / Razão Social"
                value={selectedPublisher.name || ''}
                onChange={(e) => setSelectedPublisher({ ...selectedPublisher, name: e.target.value })}
                margin="normal"
                required
                helperText="Nome completo da empresa ou razão social"
              />
              <TextField
                fullWidth
                label="Nome do Contato"
                value={selectedPublisher.contact_name || ''}
                onChange={(e) => setSelectedPublisher({ ...selectedPublisher, contact_name: e.target.value })}
                margin="normal"
                helperText="Nome da pessoa responsável pelo contato"
              />
              <TextField
                fullWidth
                id="publisher-edit-category-segment"
                name="category_segment"
                label="Categoria/Segmento"
                value={selectedPublisher.category_segment || ''}
                onChange={(e) => setSelectedPublisher({ ...selectedPublisher, category_segment: e.target.value })}
                margin="normal"
                helperText="Ex.: Farmácia, Cinema, Shopping, OOH..."
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={selectedPublisher.email || ''}
                onChange={(e) => setSelectedPublisher({ ...selectedPublisher, email: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Telefone"
                value={selectedPublisher.phone || ''}
                onChange={(e) => setSelectedPublisher({ ...selectedPublisher, phone: e.target.value })}
                margin="normal"
                helperText="Telefone comercial (formato: +55 11 1234-5678)"
              />
              <TextField
                fullWidth
                label="WhatsApp"
                value={selectedPublisher.whatsapp || ''}
                onChange={(e) => setSelectedPublisher({ ...selectedPublisher, whatsapp: e.target.value })}
                margin="normal"
                helperText="Número do WhatsApp (formato: +55 11 98765-4321)"
              />
              <TextField
                fullWidth
                label="Descrição"
                value={selectedPublisher.description || ''}
                onChange={(e) => setSelectedPublisher({ ...selectedPublisher, description: e.target.value })}
                margin="normal"
                multiline
                rows={3}
              />
              {/* (Regra do sistema) Publisher é sempre Publicador. Não permitir marcar como subscriber/ambos. */}
              <FormControl fullWidth margin="normal">
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedPublisher.active ? 'active' : 'inactive'}
                  label="Status"
                  onChange={(e) => setSelectedPublisher({ ...selectedPublisher, active: e.target.value === 'active' })}
                >
                  <MenuItem value="active">Ativo</MenuItem>
                  <MenuItem value="inactive">Inativo</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}

          {/* Aba Locais */}
          {editTab === 1 && selectedPublisher && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Locais {editLocals.length > 0 && `(${editLocals.length})`}
              </Typography>
              
              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Adicionar Local</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nome do Local *"
                      value={editLocalForm.name}
                      onChange={(e) => setEditLocalForm({ ...editLocalForm, name: e.target.value })}
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      id="publisher-local-edit-category-segment"
                      name="category_segment"
                      label="Categoria/Segmento"
                      value={editLocalForm.category_segment || ''}
                      onChange={(e) => setEditLocalForm({ ...editLocalForm, category_segment: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Endereço"
                      value={editLocalForm.address || ''}
                      onChange={(e) => setEditLocalForm({ ...editLocalForm, address: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Cidade"
                      value={editLocalForm.city || ''}
                      onChange={(e) => setEditLocalForm({ ...editLocalForm, city: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Estado"
                      value={editLocalForm.state || ''}
                      onChange={(e) => setEditLocalForm({ ...editLocalForm, state: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="CEP"
                      value={editLocalForm.zip_code || ''}
                      onChange={(e) => setEditLocalForm({ ...editLocalForm, zip_code: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={editLocalForm.description || ''}
                      onChange={(e) => setEditLocalForm({ ...editLocalForm, description: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddEditLocal}
                      disabled={!editLocalForm.name}
                    >
                      {editingEditLocalIndex !== null ? 'Atualizar Local' : 'Adicionar Local'}
                    </Button>
                    {editingEditLocalIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingEditLocalIndex(null);
                          setEditLocalForm({
                            publisher_id: selectedPublisher.publisher_id,
                            name: '',
                            address: '',
                            city: '',
                            state: '',
                            zip_code: '',
                            country: '',
                            description: '',
                          });
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {editLocals.length > 0 ? (
                <List>
                  {editLocals.map((local, index) => (
                    <ListItem key={local.local_id} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                      <ListItemIcon><Store /></ListItemIcon>
                      <ListItemText
                        primary={local.name}
                        secondary={`${local.address || ''} ${local.city || ''} ${local.state || ''}`.trim() || 'Sem endereço'}
                      />
                      <IconButton size="small" onClick={() => handleEditEditLocal(index)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteEditLocal(index)}>
                        <Delete />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">Nenhum local cadastrado ainda. Adicione ao menos 1 local.</Alert>
              )}
            </Box>
          )}

          {/* Aba Totens */}
          {editTab === 2 && selectedPublisher && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Totens {editTotems.length > 0 && `(${editTotems.length})`}
              </Typography>
              {editLocals.length === 0 ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Você precisa cadastrar ao menos 1 local na aba "Locais" antes de adicionar totens.
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Os totens (players) devem estar atrelados a um local. Selecione um local no campo abaixo.
                  <strong> Nota:</strong> Os totens são players com player embutido.
                </Alert>
              )}

              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Adicionar Totem</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Local *</InputLabel>
                      <Select
                        value={editTotemForm.localId}
                        label="Local *"
                        onChange={(e) => setEditTotemForm({ ...editTotemForm, localId: Number(e.target.value) })}
                      >
                        {editLocals.map((local, index) => (
                          <MenuItem key={local.local_id} value={index}>
                            {local.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Identifier *"
                      value={editTotemForm.identifier}
                      onChange={(e) => setEditTotemForm({ ...editTotemForm, identifier: e.target.value })}
                      size="small"
                      required
                      helperText="Identificador único do totem"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nome"
                      value={editTotemForm.name || ''}
                      onChange={(e) => setEditTotemForm({ ...editTotemForm, name: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Device ID"
                      value={editTotemForm.deviceId || ''}
                      onChange={(e) => setEditTotemForm({ ...editTotemForm, deviceId: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="UIN"
                      value={editTotemForm.uin || ''}
                      onChange={(e) => setEditTotemForm({ ...editTotemForm, uin: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Firmware Version"
                      value={editTotemForm.firmwareVersion || ''}
                      onChange={(e) => setEditTotemForm({ ...editTotemForm, firmwareVersion: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={editTotemForm.description || ''}
                      onChange={(e) => setEditTotemForm({ ...editTotemForm, description: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddEditTotem}
                      disabled={!editTotemForm.identifier || editLocals.length === 0 || editTotemForm.localId < 0 || editTotemForm.localId >= editLocals.length}
                    >
                      {editingEditTotemIndex !== null ? 'Atualizar Totem' : 'Adicionar Totem'}
                    </Button>
                    {editingEditTotemIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingEditTotemIndex(null);
                          setEditTotemForm({
                            localId: 0,
                            identifier: '',
                            name: '',
                            uin: '',
                            deviceId: '',
                            description: '',
                            firmwareVersion: '',
                          });
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {editTotems.length > 0 ? (
                <List>
                  {editTotems.map((totem, index) => {
                    const local = editLocals.find(l => l.local_id === totem.local_id);
                    const localName = local?.name || 'Local não encontrado';
                    return (
                      <ListItem key={totem.totem_id} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                        <ListItemIcon><Computer /></ListItemIcon>
                        <ListItemText
                          primary={totem.name || totem.identifier}
                          secondary={`Local: ${localName} | Identifier: ${totem.identifier}`}
                        />
                        <IconButton size="small" onClick={() => handleEditEditTotem(index)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteEditTotem(index)}>
                          <Delete />
                        </IconButton>
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Alert severity="info">
                  {editLocals.length === 0 
                    ? 'Cadastre locais na aba "Locais" para poder adicionar totens (players).'
                    : 'Nenhum totem cadastrado ainda. Os totens são players com player embutido.'}
                </Alert>
              )}
            </Box>
          )}

          {/* Aba Smart TVs */}
          {editTab === 3 && selectedPublisher && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Smart TVs {editSmartTvs.length > 0 && `(${editSmartTvs.length})`}
              </Typography>
              {editTotems.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Para adicionar Smart TVs, você precisa cadastrar ao menos 1 totem na aba "Totens". 
                  <strong> Nota:</strong> As Smart TVs são opcionais - o próprio totem já possui um player embutido.
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  As Smart TVs são opcionais e devem estar atreladas a um totem. 
                  <strong> Nota:</strong> O totem já possui um player embutido, então as Smart TVs são apenas para conectividade adicional.
                </Alert>
              )}

              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Adicionar Smart TV</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Totem *</InputLabel>
                      <Select
                        value={editSmartTvForm.totem_id}
                        label="Totem *"
                        onChange={(e) => setEditSmartTvForm({ ...editSmartTvForm, totem_id: Number(e.target.value) })}
                      >
                        {editTotems.map((totem, index) => {
                          const local = editLocals.find(l => l.local_id === totem.local_id);
                          return (
                            <MenuItem key={totem.totem_id} value={index}>
                              {totem.name || totem.identifier} {local && `(${local.name})`}
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Identifier *"
                      value={editSmartTvForm.identifier}
                      onChange={(e) => setEditSmartTvForm({ ...editSmartTvForm, identifier: e.target.value })}
                      size="small"
                      required
                      helperText="Identificador único da Smart TV"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nome"
                      value={editSmartTvForm.name || ''}
                      onChange={(e) => setEditSmartTvForm({ ...editSmartTvForm, name: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Device ID"
                      value={editSmartTvForm.device_id || ''}
                      onChange={(e) => setEditSmartTvForm({ ...editSmartTvForm, device_id: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Marca"
                      value={editSmartTvForm.brand || ''}
                      onChange={(e) => setEditSmartTvForm({ ...editSmartTvForm, brand: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Modelo"
                      value={editSmartTvForm.model || ''}
                      onChange={(e) => setEditSmartTvForm({ ...editSmartTvForm, model: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Plataforma"
                      value={editSmartTvForm.platform || ''}
                      onChange={(e) => setEditSmartTvForm({ ...editSmartTvForm, platform: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Versão do Firmware"
                      value={editSmartTvForm.firmware_version || ''}
                      onChange={(e) => setEditSmartTvForm({ ...editSmartTvForm, firmware_version: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Largura (px)"
                      type="number"
                      value={editSmartTvForm.resolution_width || ''}
                      onChange={(e) => setEditSmartTvForm({ ...editSmartTvForm, resolution_width: e.target.value ? Number(e.target.value) : undefined })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Altura (px)"
                      type="number"
                      value={editSmartTvForm.resolution_height || ''}
                      onChange={(e) => setEditSmartTvForm({ ...editSmartTvForm, resolution_height: e.target.value ? Number(e.target.value) : undefined })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Orientação</InputLabel>
                      <Select
                        value={editSmartTvForm.orientation || 'landscape'}
                        label="Orientações"
                        onChange={(e) => setEditSmartTvForm({ ...editSmartTvForm, orientation: e.target.value as 'landscape' | 'portrait' })}
                      >
                        <MenuItem value="landscape">Paisagem</MenuItem>
                        <MenuItem value="portrait">Retrato</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddEditSmartTv}
                      disabled={!editSmartTvForm.identifier || editTotems.length === 0 || editSmartTvForm.totem_id < 0 || editSmartTvForm.totem_id >= editTotems.length}
                    >
                      {editingEditSmartTvIndex !== null ? 'Atualizar Smart TV' : 'Adicionar Smart TV'}
                    </Button>
                    {editingEditSmartTvIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingEditSmartTvIndex(null);
                          setEditSmartTvForm({
                            totem_id: 0,
                            identifier: '',
                            name: '',
                            device_id: '',
                            brand: '',
                            model: '',
                            platform: '',
                            firmware_version: '',
                            resolution_width: undefined,
                            resolution_height: undefined,
                            orientation: 'landscape',
                          });
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {editSmartTvs.length > 0 ? (
                <List>
                  {editSmartTvs.map((smartTv, index) => {
                    const totem = editTotems.find(t => t.totem_id === smartTv.totem_id);
                    const totemName = totem?.name || totem?.identifier || 'Totem não encontrado';
                    return (
                      <ListItem key={smartTv.smart_tv_id || smartTv.tv_id || index} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                        <ListItemIcon><Tv /></ListItemIcon>
                        <ListItemText
                          primary={smartTv.name || smartTv.identifier}
                          secondary={`Totem: ${totemName} | Identifier: ${smartTv.identifier}${smartTv.brand ? ` | ${smartTv.brand} ${smartTv.model || ''}` : ''}`}
                        />
                        <IconButton size="small" onClick={() => handleEditEditSmartTv(index)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteEditSmartTv(index)}>
                          <Delete />
                        </IconButton>
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Alert severity="info">
                  {editTotems.length === 0 
                    ? 'Cadastre totens na aba "Totens" para poder adicionar Smart TVs. Lembre-se: o totem já possui um player embutido, então as Smart TVs são opcionais.'
                    : 'Nenhuma Smart TV cadastrada ainda. As Smart TVs são opcionais - o totem já possui um player embutido.'}
                </Alert>
              )}
            </Box>
          )}

          {/* Aba Contratos */}
          {editTab === 4 && selectedPublisher && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Contratos do Publicador</Typography>
              
              {/* Formulário para criar/editar Publisher Contract */}
              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, bgcolor: editingPublisherContractIndex !== null ? alpha(theme.palette.primary.main, 0.05) : 'transparent' }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  {editingPublisherContractIndex !== null ? 'Editar Contrato de Publisher' : 'Adicionar Contrato de Publisher'}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Número do Contrato *"
                      value={publisherContractForm.contract_number || ''}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, contract_number: e.target.value })}
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Tipo de Contrato *</InputLabel>
                      <Select
                        value={publisherContractForm.contract_type || 'revenue_share'}
                        label="Tipo de Contrato *"
                        onChange={(e) => setPublisherContractForm({ ...publisherContractForm, contract_type: e.target.value as any })}
                      >
                        <MenuItem value="revenue_share">Revenue Share</MenuItem>
                        <MenuItem value="subscription">Subscription</MenuItem>
                        <MenuItem value="partnership">Partnership</MenuItem>
                        <MenuItem value="hybrid">Hybrid</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Título *"
                      value={publisherContractForm.title || ''}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, title: e.target.value })}
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={publisherContractForm.description || ''}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, description: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Data de Início *"
                      type="date"
                      value={publisherContractForm.start_date || ''}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, start_date: e.target.value })}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Data de Término"
                      type="date"
                      value={publisherContractForm.end_date || ''}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, end_date: e.target.value || undefined })}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  {publisherContractForm.contract_type === 'revenue_share' && (
                    <>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Percentual de Revenue Share (%)"
                          type="number"
                          value={publisherContractForm.revenue_share_percentage || ''}
                          onChange={(e) => setPublisherContractForm({ ...publisherContractForm, revenue_share_percentage: e.target.value ? parseFloat(e.target.value) : undefined })}
                          size="small"
                          inputProps={{ min: 0, max: 100, step: 0.01 }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Valor Mínimo de Payout"
                          type="number"
                          value={publisherContractForm.minimum_payout_amount || ''}
                          onChange={(e) => setPublisherContractForm({ ...publisherContractForm, minimum_payout_amount: e.target.value ? parseFloat(e.target.value) : undefined })}
                          size="small"
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </Grid>
                    </>
                  )}
                  {publisherContractForm.contract_type === 'subscription' && (
                    <>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Valor da Assinatura"
                          type="number"
                          value={publisherContractForm.subscription_amount || ''}
                          onChange={(e) => setPublisherContractForm({ ...publisherContractForm, subscription_amount: e.target.value ? parseFloat(e.target.value) : undefined })}
                          size="small"
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Intervalo</InputLabel>
                          <Select
                            value={publisherContractForm.subscription_interval || 'month'}
                            label="Intervalo"
                            onChange={(e) => setPublisherContractForm({ ...publisherContractForm, subscription_interval: e.target.value })}
                          >
                            <MenuItem value="month">Mensal</MenuItem>
                            <MenuItem value="year">Anual</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </>
                  )}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Moeda"
                      value={publisherContractForm.currency || 'BRL'}
                      onChange={(e) => setPublisherContractForm({ ...publisherContractForm, currency: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={publisherContractForm.status || 'draft'}
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
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddPublisherContract}
                      disabled={!publisherContractForm.contract_number || !publisherContractForm.title}
                    >
                      {editingPublisherContractIndex !== null ? 'Atualizar Contrato' : 'Adicionar Contrato'}
                    </Button>
                    {editingPublisherContractIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingPublisherContractIndex(null);
                          setPublisherContractForm({
                            contract_number: '',
                            contract_type: 'revenue_share',
                            title: '',
                            description: '',
                            start_date: new Date().toISOString().split('T')[0],
                            end_date: undefined,
                            currency: 'BRL',
                            status: 'draft',
                          });
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {/* Lista de Publisher Contracts */}
              <Typography variant="subtitle1" sx={{ mb: 2, mt: 3 }}>Contratos de Publisher ({editPublisherContracts.length})</Typography>
              {loadingEditContracts ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : editPublisherContracts.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Nenhum contrato de publisher encontrado. Crie um contrato usando o formulário acima.
                </Alert>
              ) : (
                <List sx={{ mb: 3 }}>
                  {editPublisherContracts.map((contract, index) => (
                    <ListItem
                      key={contract.contract_id}
                      sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        mb: 2,
                        flexDirection: 'column',
                        alignItems: 'stretch',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', mb: 1 }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {contract.contract_number} - {contract.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {contract.description || 'Sem descrição'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
                          <IconButton size="small" onClick={() => handleStartEditPublisherContract(index)}>
                            <Edit />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeletePublisherContract(index)}>
                            <Delete />
                          </IconButton>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarToday fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary">
                            Início: {contract.start_date ? new Date(contract.start_date).toLocaleDateString('pt-BR') : 'N/A'}
                          </Typography>
                        </Box>
                        {contract.end_date && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarToday fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">
                              Fim: {new Date(contract.end_date).toLocaleDateString('pt-BR')}
                            </Typography>
                          </Box>
                        )}
                        {contract.contract_type && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Assignment fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">
                              Tipo: {contract.contract_type}
                            </Typography>
                          </Box>
                        )}
                        {contract.revenue_share_percentage !== undefined && 
                         contract.revenue_share_percentage !== null && 
                         typeof contract.revenue_share_percentage === 'number' && 
                         !isNaN(Number(contract.revenue_share_percentage)) && 
                         Number(contract.revenue_share_percentage) >= 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AttachMoney fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">
                              Revenue Share: {Number(contract.revenue_share_percentage || 0)}%
                            </Typography>
                          </Box>
                        )}
                        {contract.subscription_amount !== undefined && 
                         contract.subscription_amount !== null && 
                         typeof contract.subscription_amount === 'number' && 
                         !isNaN(Number(contract.subscription_amount)) && 
                         Number(contract.subscription_amount) >= 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AttachMoney fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">
                              Assinatura: {contract.currency || 'BRL'} {Number(contract.subscription_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {contract.subscription_interval || 'month'}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            setEditTab(0);
            setEditLocals([]);
            setEditTotems([]);
            setEditSmartTvs([]);
            setEditingEditLocalIndex(null);
            setEditingEditTotemIndex(null);
            setEditingEditSmartTvIndex(null);
          }}>Cancelar</Button>
          <Button variant="contained" onClick={handleEditPublisher}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Detalhes do Publicador - {selectedPublisher?.name}
        </DialogTitle>
        <DialogContent>
          <Tabs value={detailsTab} onChange={(_, newValue) => setDetailsTab(newValue)} sx={{ mb: 2 }}>
            <Tab label="Informações" />
            <Tab label="Locais" icon={publisherStats && publisherStats.locals.length > 0 ? <Chip label={publisherStats.locals.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Totens" icon={publisherStats && publisherStats.totems.length > 0 ? <Chip label={publisherStats.totems.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Smart TVs" icon={publisherStats && publisherStats.smartTvs.length > 0 ? <Chip label={publisherStats.smartTvs.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Contratos" icon={publisherStats && publisherStats.contracts && publisherStats.contracts.length > 0 ? <Chip label={publisherStats.contracts.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Estatísticas" />
          </Tabs>

          {detailsTab === 0 && selectedPublisher && (
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Nome da Empresa</TableCell>
                    <TableCell>{selectedPublisher.name}</TableCell>
                  </TableRow>
                  {selectedPublisher.contact_name && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Nome do Contato</TableCell>
                      <TableCell>{selectedPublisher.contact_name}</TableCell>
                    </TableRow>
                  )}
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
                  {selectedPublisher.whatsapp && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>WhatsApp</TableCell>
                      <TableCell>{selectedPublisher.whatsapp}</TableCell>
                    </TableRow>
                  )}
                  {selectedPublisher.description && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Descrição</TableCell>
                      <TableCell>{selectedPublisher.description}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Tipo de Cliente</TableCell>
                    <TableCell>
                      <Chip
                        label={getClientTypeLabel(selectedPublisher.client_type)}
                        size="small"
                        color={getClientTypeColor(selectedPublisher.client_type) as any}
                      />
                    </TableCell>
                  </TableRow>
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
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Criado em</TableCell>
                    <TableCell>{selectedPublisher.created_at ? formatDate(selectedPublisher.created_at) : 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Atualizado em</TableCell>
                    <TableCell>{selectedPublisher.updated_at ? formatDate(selectedPublisher.updated_at) : 'N/A'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {detailsTab === 1 && publisherStats && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Locais ({publisherStats.locals.length})
              </Typography>
              {publisherStats.locals.length === 0 ? (
                <Alert severity="info">Nenhum local cadastrado</Alert>
              ) : (
                <List>
                  {publisherStats.locals.map((local: any) => (
                    <ListItem key={local.local_id}>
                      <ListItemIcon>
                        <Store />
                      </ListItemIcon>
                      <ListItemText
                        primary={local.name}
                        secondary={local.address || 'Sem endereço'}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {detailsTab === 2 && publisherStats && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Totens ({publisherStats.totems.length})
              </Typography>
              {publisherStats.totems.length === 0 ? (
                <Alert severity="info">Nenhum totem cadastrado</Alert>
              ) : (
                <List>
                  {publisherStats.totems.map((totem: any) => (
                    <ListItem key={totem.totem_id}>
                      <ListItemIcon>
                        <Computer />
                      </ListItemIcon>
                      <ListItemText
                        primary={totem.name || totem.identifier}
                        secondary={`Status: ${totem.status || 'N/A'}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {detailsTab === 3 && publisherStats && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Smart TVs ({publisherStats.smartTvs.length})
              </Typography>
              {publisherStats.smartTvs.length === 0 ? (
                <Alert severity="info">Nenhuma Smart TV cadastrada</Alert>
              ) : (
                <List>
                  {publisherStats.smartTvs.map((tv: any, index: number) => (
                    <ListItem key={tv.tv_id || tv.smart_tv_id || `tv-${index}`}>
                      <ListItemIcon>
                        <Tv />
                      </ListItemIcon>
                      <ListItemText
                        primary={tv.name || tv.identifier}
                        secondary={`${tv.brand || ''} ${tv.model || ''} - Status: ${tv.status || 'N/A'}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {detailsTab === 4 && publisherStats && publisherStats.contracts && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">
                  Contratos ({publisherStats.contracts.length})
                </Typography>
                {selectedPublisher && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={() => {
                        const pid = (selectedPublisher as any).publisher_id || (selectedPublisher as any).publisherId;
                        navigate(`/publisher-contracts?publisherId=${pid}&openCreate=1`);
                      }}
                    >
                      Criar Contrato
                    </Button>
                    <Button
                      variant="text"
                      endIcon={<OpenInNew />}
                      onClick={() => {
                        const pid = (selectedPublisher as any).publisher_id || (selectedPublisher as any).publisherId;
                        navigate(`/publisher-contracts?publisherId=${pid}`);
                      }}
                    >
                      Abrir Manutenção
                    </Button>
                  </Box>
                )}
              </Box>
              {publisherStats.contracts.length === 0 ? (
                <Alert severity="info">Nenhum contrato encontrado</Alert>
              ) : (
                <List>
                  {publisherStats.contracts.map((contract: any, index: number) => (
                    <ListItem
                      key={contract.contract_id || `contract-${index}`}
                      sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        mb: 2,
                        flexDirection: 'column',
                        alignItems: 'stretch',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', mb: 1 }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {contract.contract_number || 'N/A'} - {contract.title || 'Sem título'}
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
                          sx={{ ml: 2 }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarToday fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary">
                            Início: {contract.start_date ? new Date(contract.start_date).toLocaleDateString('pt-BR') : 'N/A'}
                          </Typography>
                        </Box>
                        {contract.end_date && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarToday fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">
                              Fim: {new Date(contract.end_date).toLocaleDateString('pt-BR')}
                            </Typography>
                          </Box>
                        )}
                        {contract.contract_type && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Assignment fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">
                              Tipo: {contract.contract_type}
                            </Typography>
                          </Box>
                        )}
                        {contract.revenue_share_percentage !== undefined && 
                         contract.revenue_share_percentage !== null && 
                         typeof contract.revenue_share_percentage === 'number' && 
                         !isNaN(Number(contract.revenue_share_percentage)) && 
                         Number(contract.revenue_share_percentage) >= 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AttachMoney fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">
                              Revenue Share: {Number(contract.revenue_share_percentage || 0)}%
                            </Typography>
                          </Box>
                        )}
                        {contract.subscription_amount !== undefined && 
                         contract.subscription_amount !== null && 
                         typeof contract.subscription_amount === 'number' && 
                         !isNaN(Number(contract.subscription_amount)) && 
                         Number(contract.subscription_amount) >= 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AttachMoney fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">
                              Assinatura: {contract.currency || 'BRL'} {Number(contract.subscription_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {contract.subscription_interval || 'month'}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {detailsTab === 5 && publisherStats && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <Store sx={{ fontSize: 40, color: theme.palette.primary.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {publisherStats.locals.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Locais
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <Computer sx={{ fontSize: 40, color: theme.palette.success.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {publisherStats.totems.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Totens
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <Tv sx={{ fontSize: 40, color: theme.palette.warning.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {publisherStats.smartTvs.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Smart TVs
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              {publisherStats.stats && (
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ textAlign: 'center', py: 2 }}>
                    <CardContent>
                      <CheckCircle sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {publisherStats.stats.onlineTotems || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Totens Online
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Publishers;
