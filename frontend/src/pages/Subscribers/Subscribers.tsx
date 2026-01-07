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
} from '@mui/icons-material';
import { 
  subscriberApi, 
  Subscriber, 
  CreateSubscriberRequest, 
  UpdateSubscriberRequest,
  localApi,
  Local,
  CreateLocalRequest,
  totemApi,
  CreatePlayerRequest,
  smartTvApi,
  CreateSmartTvRequest,
  SmartTv
} from '../../services/api';

const Subscribers: React.FC = () => {
  const theme = useTheme();
  const [Subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [SubscriberStats, setSubscriberStats] = useState<{
    locals: any[];
    totems: any[];
    smartTvs: any[];
    stats: any;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // clientTypeFilter removido - subscribers não têm tipos
  const [activeOnlyFilter, setActiveOnlyFilter] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState(0);
  const [createTab, setCreateTab] = useState(0); // NOVO: Aba do dialog de criação
  const [editTab, setEditTab] = useState(0); // NOVO: Aba do dialog de edição
  const [newSubscriber, setNewSubscriber] = useState<CreateSubscriberRequest>({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    description: '',
  });
  // NOVO: Estados para gerenciar locais, totens, smart TVs e subscribers durante a criação
  const [tempLocals, setTempLocals] = useState<CreateLocalRequest[]>([]);
  const [tempTotems, setTempTotems] = useState<(CreatePlayerRequest & { tempId: string })[]>([]);
  const [tempSmartTvs, setTempSmartTvs] = useState<(CreateSmartTvRequest & { tempId: string })[]>([]);
  const [editingLocalIndex, setEditingLocalIndex] = useState<number | null>(null);
  const [editingTotemIndex, setEditingTotemIndex] = useState<number | null>(null);
  const [editingSmartTvIndex, setEditingSmartTvIndex] = useState<number | null>(null);
  
  // Estados para edição de Assinante (carregar dados existentes)
  const [editLocals, setEditLocals] = useState<Local[]>([]);
  const [editTotems, setEditTotems] = useState<any[]>([]);
  const [editSmartTvs, setEditSmartTvs] = useState<any[]>([]);
  const [editingEditLocalIndex, setEditingEditLocalIndex] = useState<number | null>(null);
  const [editingEditTotemIndex, setEditingEditTotemIndex] = useState<number | null>(null);
  const [editingEditSmartTvIndex, setEditingEditSmartTvIndex] = useState<number | null>(null);
  const [editLocalForm, setEditLocalForm] = useState<CreateLocalRequest>({
    subscriber_id: 0,
    name: '',
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
    subscriber_id: 0, // Será preenchido após criar o Subscriber
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    description: '',
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
  });

  useEffect(() => {
    loadSubscribers();
  }, [activeOnlyFilter]);

  // Carregar dados quando dialog de edição abre
  useEffect(() => {
    if (editDialogOpen && selectedSubscriber) {
      loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    }
  }, [editDialogOpen, selectedSubscriber?.subscriber_id]);

  const loadSubscribers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriberApi.getAll({
        search: searchTerm || undefined,
        
        active_only: activeOnlyFilter,
      });
      setSubscribers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar Subscribers:', error);
      setError('Erro ao carregar lista de Subscribers');
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriberStats = async (subscriberId: number) => {
    try {
      const [localsResponse, totemsResponse, smartTvsResponse, statsResponse] = await Promise.all([
        subscriberApi.getLocals(subscriberId),
        subscriberApi.getTotems(subscriberId),
        subscriberApi.getSmartTvs(subscriberId),
        subscriberApi.getStats(subscriberId),
      ]);

      setSubscriberStats({
        locals: Array.isArray(localsResponse) ? localsResponse : [],
        totems: Array.isArray(totemsResponse) ? totemsResponse : [],
        smartTvs: Array.isArray(smartTvsResponse) ? smartTvsResponse : [],
        stats: statsResponse || {},
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas do Subscriber:', error);
    }
  };

  // Carregar dados para edição
  const loadSubscriberDataForEdit = async (subscriberId: number) => {
    try {
      const [localsResponse, totemsResponse, smartTvsResponse] = await Promise.all([
        subscriberApi.getLocals(subscriberId),
        subscriberApi.getTotems(subscriberId),
        subscriberApi.getSmartTvs(subscriberId),
      ]);

      setEditLocals(Array.isArray(localsResponse) ? localsResponse : []);
      setEditTotems(Array.isArray(totemsResponse) ? totemsResponse : []);
      setEditSmartTvs(Array.isArray(smartTvsResponse) ? smartTvsResponse : []);
    } catch (error) {
      console.error('Erro ao carregar dados do Subscriber para edição:', error);
      setError('Erro ao carregar dados do Assinante');
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
      subscriber_id: 0,
      name: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      country: '',
      description: '',
    });
  };

  const handleEditLocal = (index: number) => {
    setLocalForm({ ...tempLocals[index], subscriber_id: 0 });
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
  // FUNÇÕES DE CRUD PARA EDIÇÃO DE Assinante
  // ============================================================================

  // Funções para gerenciar locais na edição
  const handleAddEditLocal = async () => {
    if (!selectedSubscriber || !editLocalForm.name) {
      setError('Nome do local é obrigatório');
      return;
    }

    try {
      if (editingEditLocalIndex !== null) {
        // Atualizar local existente
        const localToUpdate = editLocals[editingEditLocalIndex];
        await localApi.update(localToUpdate.local_id, editLocalForm);
        // Recarregar dados
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
        setEditingEditLocalIndex(null);
      } else {
        // Criar novo local
        await localApi.create({
          ...editLocalForm,
          subscriber_id: selectedSubscriber.subscriber_id,
        });
        // Recarregar dados
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
      }
      setEditLocalForm({
        subscriber_id: selectedSubscriber.subscriber_id,
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
      subscriber_id: local.subscriber_id || 0,
      publisher_id: local.publisher_id || 0,
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
    if (!selectedSubscriber || !window.confirm('Tem certeza que deseja excluir este local?')) return;
    
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
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      console.error('Erro ao excluir local:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir local');
    }
  };

  // Funções para gerenciar totens na edição
  const handleAddEditTotem = async () => {
    if (!selectedSubscriber || !editTotemForm.identifier) {
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
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
        setEditingEditTotemIndex(null);
      } else {
        // Criar novo totem
        await totemApi.create(totemData);
        // Recarregar dados
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
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
    if (!selectedSubscriber || !window.confirm('Tem certeza que deseja excluir este totem?')) return;
    
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
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      console.error('Erro ao excluir totem:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir totem');
    }
  };

  // Funções para gerenciar Smart TVs na edição
  const handleAddEditSmartTv = async () => {
    if (!selectedSubscriber || !editSmartTvForm.identifier) {
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
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
        setEditingEditSmartTvIndex(null);
      } else {
        // Criar nova Smart TV
        await smartTvApi.create(smartTvData);
        // Recarregar dados
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
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
    if (!selectedSubscriber || !window.confirm('Tem certeza que deseja excluir esta Smart TV?')) return;
    
    try {
      const smartTv = editSmartTvs[index];
      await smartTvApi.delete(smartTv.smart_tv_id || smartTv.tv_id);
      // Recarregar dados
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      console.error('Erro ao excluir Smart TV:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir Smart TV');
    }
  };

  // NOVO: handleCreateSubscriber modificado para criar Subscriber, locais e totens
  const handleCreateSubscriber = async () => {
    try {
      // Validação: nome do Subscriber é obrigatório
      if (!newSubscriber.name || newSubscriber.name.trim() === '') {
        setError('Nome do Assinante é obrigatório');
        setCreateTab(0); // Ir para aba de Informações
        return;
      }

      // Validação: ao menos 1 local obrigatório
      if (tempLocals.length === 0) {
        setError('É obrigatório cadastrar ao menos 1 local antes de criar o Assinante');
        setCreateTab(1); // Ir para aba de Locais
        return;
      }

      // Validação: ao menos 1 totem obrigatório
      if (tempTotems.length === 0) {
        setError('É obrigatório cadastrar ao menos 1 totem (player) antes de criar o Assinante');
        setCreateTab(2); // Ir para aba de Totens
        return;
      }

      // 1. Criar o Subscriber
      console.log('Dados sendo enviados para criar Subscriber:', newSubscriber);
      const createdSubscriber = await subscriberApi.create(newSubscriber);
      console.log('Subscriber criado com sucesso:', createdSubscriber);
      const subscriberId = createdSubscriber.subscriber_id;
      
      if (!subscriberId) {
        const errorMessage = 'Erro: Assinante criado mas não retornou ID válido';
        console.error(errorMessage);
        setError(errorMessage);
        return;
      }

      // 2. Criar os locais
      const createdLocals: Local[] = [];
      for (const local of tempLocals) {
        const createdLocal = await localApi.create({
          ...local,
          subscriber_id: subscriberId,
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
          
          console.log(`Criando totem ${totem.identifier || totem.name} com localId:`, localId);
          console.log('Dados do totem antes de preparar:', totem);
          
          // Preparar dados do totem (identifier é obrigatório na interface, mas backend aceita name OU identifier)
          const totemData: any = {
            localId: Number(localId), // Garantir que é número
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
          
          console.log('Dados do totem sendo enviados:', totemData);
          
          try {
            const createdTotem = await totemApi.create(totemData);
            console.log('Totem criado com sucesso:', createdTotem);
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
          await smartTvApi.create({
            totem_id: createdTotems[totemIndex].totem_id,
            identifier: smartTv.identifier,
            device_id: smartTv.device_id,
            name: smartTv.name,
            brand: smartTv.brand,
            model: smartTv.model,
            platform: smartTv.platform,
            firmware_version: smartTv.firmware_version,
            resolution_width: smartTv.resolution_width,
            resolution_height: smartTv.resolution_height,
            orientation: smartTv.orientation,
          });
        }
      }

      // Subscribers não são criados aqui - são gerenciados separadamente

      // Limpar estados
      setCreateDialogOpen(false);
      setCreateTab(0);
      setNewSubscriber({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        whatsapp: '',
        address: '',
        description: '',
      });
      setTempLocals([]);
      setTempTotems([]);
      setTempSmartTvs([]);
      setLocalForm({
        subscriber_id: 0,
        name: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        country: '',
        description: '',
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
      });
      
      loadSubscribers();
    } catch (error: any) {
      console.error('Erro ao criar Subscriber:', error);
      
      // Melhorar tratamento de erro para mostrar detalhes completos
      let errorMessage = 'Erro ao criar Subscriber';
      
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

  const handleEditSubscriber = async () => {
    if (!selectedSubscriber) return;
    
    try {
      const updateData: UpdateSubscriberRequest = {
        name: selectedSubscriber.name,
        contact_name: selectedSubscriber.contact_name,
        email: selectedSubscriber.email,
        phone: selectedSubscriber.phone,
        whatsapp: selectedSubscriber.whatsapp,
        description: selectedSubscriber.description,
        
        
        
        active: selectedSubscriber.active,
      };
      await subscriberApi.update(selectedSubscriber.subscriber_id, updateData);
      setEditDialogOpen(false);
      setEditTab(0);
      setEditLocals([]);
      setEditTotems([]);
      setEditSmartTvs([]);
      setEditingEditLocalIndex(null);
      setEditingEditTotemIndex(null);
      setEditingEditSmartTvIndex(null);
      setSelectedSubscriber(null);
      loadSubscribers();
    } catch (error: any) {
      console.error('Erro ao atualizar Subscriber:', error);
      setError(error?.response?.data?.error || error?.message || 'Erro ao atualizar Assinante');
    }
  };

  const handleDeleteSubscriber = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este Assinante?')) {
      try {
        await subscriberApi.delete(id);
        loadSubscribers();
      } catch (error: any) {
        console.error('Erro ao excluir Subscriber:', error);
        setError(error?.response?.data?.error || error?.message || 'Erro ao excluir Subscriber');
      }
    }
  };

  const handleViewDetails = async (Subscriber: Subscriber) => {
    setSelectedSubscriber(Subscriber);
    await loadSubscriberStats(Subscriber.subscriber_id);
    setDetailsDialogOpen(true);
    setDetailsTab(0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getClientTypeLabel = (clientType?: string) => {
    switch (clientType) {
      case 'subscriber': return 'Assinante';
      case 'Subscriber': return 'Assinante';
      case 'both': return 'Ambos';
      default: return 'N/A';
    }
  };

  const getClientTypeColor = (clientType?: string) => {
    switch (clientType) {
      case 'subscriber': return 'primary';
      case 'Subscriber': return 'success';
      case 'both': return 'warning';
      default: return 'default';
    }
  };

  if (loading && Subscribers.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando Assinantees...
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
            📢 Assinante
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie Assinantees e suas informações
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
          Adicionar Assinante
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Buscar Assinantees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    loadSubscribers();
                  }
                }}
                InputProps={{
                  startAdornment: <Business sx={{ mr: 1, color: theme.palette.text.secondary }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={clientTypeFilter}
                  label="Tipo"
                  onChange={(e) => setClientTypeFilter(e.target.value)}
                >
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="subscriber">Assinante</MenuItem>
                  <MenuItem value="Subscriber">Assinante</MenuItem>
                  <MenuItem value="both">Ambos</MenuItem>
                </Select>
              </FormControl>
            </Grid>
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
                onClick={loadSubscribers}
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

      {/* Subscribers Grid */}
      <Grid container spacing={3}>
        {Subscribers.map((Subscriber) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={Subscriber.subscriber_id}>
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
                  label={Subscriber.active ? 'Ativo' : 'Inativo'}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: alpha(Subscriber.active ? theme.palette.success.main : theme.palette.error.main, 0.1),
                    color: Subscriber.active ? theme.palette.success.main : theme.palette.error.main,
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
                    Criado em {Subscriber.created_at ? formatDate(Subscriber.created_at) : 'N/A'}
                  </Typography>
                </Box>
              </Box>

              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
                  {Subscriber.name}
                </Typography>
                
                <Chip
                  label={'Assinante'}
                  size="small"
                  color={'primary' as any}
                  sx={{ mb: 1 }}
                />
                
                {Subscriber.contact_name && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <People fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      Contato: {Subscriber.contact_name}
                    </Typography>
                  </Box>
                )}

                {Subscriber.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Email fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {Subscriber.email}
                    </Typography>
                  </Box>
                )}

                {Subscriber.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {Subscriber.phone}
                    </Typography>
                  </Box>
                )}

                {Subscriber.whatsapp && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      WhatsApp: {Subscriber.whatsapp}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleViewDetails(Subscriber)}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Detalhes
                  </Button>
                  
                  <Box>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => {
                        setSelectedSubscriber(Subscriber);
                        setEditDialogOpen(true);
                      }}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDeleteSubscriber(Subscriber.subscriber_id)}>
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
      {Subscribers.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <Business sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhum Assinante encontrado
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece adicionando seus primeiros Assinantees
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Adicionar Primeiro Assinante
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
        <DialogTitle>Adicionar Assinante</DialogTitle>
        <DialogContent>
          <Tabs value={createTab} onChange={(_, newValue) => setCreateTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Informações" />
            <Tab label="Locais" icon={tempLocals.length > 0 ? <Chip label={tempLocals.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Totens" icon={tempTotems.length > 0 ? <Chip label={tempTotems.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Smart TVs" icon={tempSmartTvs.length > 0 ? <Chip label={tempSmartTvs.length} size="small" color="primary" /> : undefined} iconPosition="end" />
          </Tabs>

          {/* Aba Informações */}
          {createTab === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Dados do Assinante</Typography>
              <TextField
                fullWidth
                label="Nome da Empresa / Razão Social"
                value={newSubscriber.name}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, name: e.target.value })}
                margin="normal"
                required
                helperText="Nome completo da empresa ou razão social"
              />
              <TextField
                fullWidth
                label="Nome do Contato"
                value={newSubscriber.contact_name}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, contact_name: e.target.value })}
                margin="normal"
                helperText="Nome da pessoa responsável pelo contato"
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newSubscriber.email}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, email: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Telefone"
                value={newSubscriber.phone}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, phone: e.target.value })}
                margin="normal"
                helperText="Telefone comercial (formato: +55 11 1234-5678)"
              />
              <TextField
                fullWidth
                label="WhatsApp"
                value={newSubscriber.whatsapp}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, whatsapp: e.target.value })}
                margin="normal"
                helperText="Número do WhatsApp (formato: +55 11 98765-4321)"
              />
              <TextField
                fullWidth
                label="Descrição"
                value={newSubscriber.description}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, description: e.target.value })}
                margin="normal"
                multiline
                rows={3}
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Tipo de Cliente</InputLabel>
                <Select
                  value={'subscriber'}
                  label="Tipo de Cliente"
                  onChange={(e) => {
                    const value = e.target.value as 'subscriber' | 'Subscriber' | 'both';
                    setNewSubscriber({
                      ...newSubscriber,
                      
                      
                      
                    });
                  }}
                >
                  <MenuItem value="Subscriber">Apenas Assinante</MenuItem>
                  <MenuItem value="subscriber">Apenas Assinante</MenuItem>
                  <MenuItem value="both">Ambos (Assinante e Assinante)</MenuItem>
                </Select>
              </FormControl>

            </Box>
          )}

          {/* Aba Locais */}
          {createTab === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Locais {tempLocals.length > 0 && `(${tempLocals.length})`}
              </Typography>
              <Alert severity="warning" sx={{ mb: 2 }}>
                É obrigatório cadastrar ao menos 1 local antes de criar o Assinante.
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
                            subscriber_id: 0,
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setCreateTab(0);
          setTempLocals([]);
          setTempTotems([]);
          setTempSmartTvs([]);
        }}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateSubscriber}
            disabled={tempLocals.length === 0 || tempTotems.length === 0}
          >
            Criar Assinante
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
        <DialogTitle>Editar Assinante</DialogTitle>
        <DialogContent>
          <Tabs value={editTab} onChange={(_, newValue) => setEditTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Informações" />
            <Tab label="Locais" />
            <Tab label="Totens" />
            <Tab label="Smart TVs" />
          </Tabs>

          {/* Aba Informações */}
          {editTab === 0 && selectedSubscriber && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Dados do Assinante</Typography>
              <TextField
                fullWidth
                label="Nome da Empresa / Razão Social"
                value={selectedSubscriber.name || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, name: e.target.value })}
                margin="normal"
                required
                helperText="Nome completo da empresa ou razão social"
              />
              <TextField
                fullWidth
                label="Nome do Contato"
                value={selectedSubscriber.contact_name || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, contact_name: e.target.value })}
                margin="normal"
                helperText="Nome da pessoa responsável pelo contato"
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={selectedSubscriber.email || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, email: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Telefone"
                value={selectedSubscriber.phone || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, phone: e.target.value })}
                margin="normal"
                helperText="Telefone comercial (formato: +55 11 1234-5678)"
              />
              <TextField
                fullWidth
                label="WhatsApp"
                value={selectedSubscriber.whatsapp || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, whatsapp: e.target.value })}
                margin="normal"
                helperText="Número do WhatsApp (formato: +55 11 98765-4321)"
              />
              <TextField
                fullWidth
                label="Descrição"
                value={selectedSubscriber.description || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, description: e.target.value })}
                margin="normal"
                multiline
                rows={3}
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Tipo de Cliente</InputLabel>
                <Select
                  value={'subscriber'}
                  label="Tipo de Cliente"
                  onChange={(e) => {
                    const value = e.target.value as 'subscriber' | 'Subscriber' | 'both';
                    setSelectedSubscriber({
                      ...selectedSubscriber,
                      
                      
                      
                    });
                  }}
                >
                  <MenuItem value="Subscriber">Apenas Assinante</MenuItem>
                  <MenuItem value="subscriber">Apenas Assinante</MenuItem>
                  <MenuItem value="both">Ambos (Assinante e Assinante)</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth margin="normal">
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedSubscriber.active ? 'active' : 'inactive'}
                  label="Status"
                  onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, active: e.target.value === 'active' })}
                >
                  <MenuItem value="active">Ativo</MenuItem>
                  <MenuItem value="inactive">Inativo</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}

          {/* Aba Locais */}
          {editTab === 1 && selectedSubscriber && (
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
                            subscriber_id: selectedSubscriber.subscriber_id,
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
          {editTab === 2 && selectedSubscriber && (
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
          {editTab === 3 && selectedSubscriber && (
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
          <Button variant="contained" onClick={handleEditSubscriber}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Detalhes do Assinante - {selectedSubscriber?.name}
        </DialogTitle>
        <DialogContent>
          <Tabs value={detailsTab} onChange={(_, newValue) => setDetailsTab(newValue)} sx={{ mb: 2 }}>
            <Tab label="Informações" />
            <Tab label="Locais" />
            <Tab label="Totens" />
            <Tab label="Smart TVs" />
            <Tab label="Estatísticas" />
          </Tabs>

          {detailsTab === 0 && selectedSubscriber && (
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Nome da Empresa</TableCell>
                    <TableCell>{selectedSubscriber.name}</TableCell>
                  </TableRow>
                  {selectedSubscriber.contact_name && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Nome do Contato</TableCell>
                      <TableCell>{selectedSubscriber.contact_name}</TableCell>
                    </TableRow>
                  )}
                  {selectedSubscriber.email && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                      <TableCell>{selectedSubscriber.email}</TableCell>
                    </TableRow>
                  )}
                  {selectedSubscriber.phone && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Telefone</TableCell>
                      <TableCell>{selectedSubscriber.phone}</TableCell>
                    </TableRow>
                  )}
                  {selectedSubscriber.whatsapp && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>WhatsApp</TableCell>
                      <TableCell>{selectedSubscriber.whatsapp}</TableCell>
                    </TableRow>
                  )}
                  {selectedSubscriber.description && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Descrição</TableCell>
                      <TableCell>{selectedSubscriber.description}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Tipo de Cliente</TableCell>
                    <TableCell>
                      <Chip
                        label="Assinante"
                        size="small"
                        color="primary"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell>
                      <Chip
                        label={selectedSubscriber.active ? 'Ativo' : 'Inativo'}
                        size="small"
                        color={selectedSubscriber.active ? 'success' : 'error'}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Criado em</TableCell>
                    <TableCell>{selectedSubscriber.created_at ? formatDate(selectedSubscriber.created_at) : 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Atualizado em</TableCell>
                    <TableCell>{selectedSubscriber.updated_at ? formatDate(selectedSubscriber.updated_at) : 'N/A'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {detailsTab === 1 && SubscriberStats && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Locais ({SubscriberStats.locals.length})
              </Typography>
              {SubscriberStats.locals.length === 0 ? (
                <Alert severity="info">Nenhum local cadastrado</Alert>
              ) : (
                <List>
                  {SubscriberStats.locals.map((local: any) => (
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

          {detailsTab === 2 && SubscriberStats && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Totens ({SubscriberStats.totems.length})
              </Typography>
              {SubscriberStats.totems.length === 0 ? (
                <Alert severity="info">Nenhum totem cadastrado</Alert>
              ) : (
                <List>
                  {SubscriberStats.totems.map((totem: any) => (
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

          {detailsTab === 3 && SubscriberStats && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Smart TVs ({SubscriberStats.smartTvs.length})
              </Typography>
              {SubscriberStats.smartTvs.length === 0 ? (
                <Alert severity="info">Nenhuma Smart TV cadastrada</Alert>
              ) : (
                <List>
                  {SubscriberStats.smartTvs.map((tv: any, index: number) => (
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

          {detailsTab === 4 && SubscriberStats && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <Store sx={{ fontSize: 40, color: theme.palette.primary.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {SubscriberStats.locals.length}
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
                      {SubscriberStats.totems.length}
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
                      {SubscriberStats.smartTvs.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Smart TVs
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              {SubscriberStats.stats && (
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ textAlign: 'center', py: 2 }}>
                    <CardContent>
                      <CheckCircle sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {SubscriberStats.stats.onlineTotems || 0}
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

export default Subscribers;




