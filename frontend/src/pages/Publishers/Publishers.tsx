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
  SmartTv
} from '../../services/api';

const Publishers: React.FC = () => {
  const theme = useTheme();
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
    stats: any;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('all');
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
    description: '',
    is_subscriber: false,
    is_publisher: true,
    client_type: 'publisher',
  });
  // NOVO: Estados para gerenciar locais, totens, smart TVs e subscribers durante a criação
  const [tempLocals, setTempLocals] = useState<CreateLocalRequest[]>([]);
  const [tempTotems, setTempTotems] = useState<(CreatePlayerRequest & { tempId: string })[]>([]);
  const [tempSmartTvs, setTempSmartTvs] = useState<(CreateSmartTvRequest & { tempId: string })[]>([]);
  const [editingLocalIndex, setEditingLocalIndex] = useState<number | null>(null);
  const [editingTotemIndex, setEditingTotemIndex] = useState<number | null>(null);
  const [editingSmartTvIndex, setEditingSmartTvIndex] = useState<number | null>(null);
  const [localForm, setLocalForm] = useState<CreateLocalRequest>({
    publisher_id: 0, // Será preenchido após criar o publisher
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
    loadPublishers();
  }, [clientTypeFilter, activeOnlyFilter]);

  const loadPublishers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await publisherApi.getAll({
        search: searchTerm || undefined,
        client_type: clientTypeFilter !== 'all' ? clientTypeFilter as any : undefined,
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

      setPublisherStats({
        locals: Array.isArray(localsResponse) ? localsResponse : [],
        totems: Array.isArray(totemsResponse) ? totemsResponse : [],
        smartTvs: Array.isArray(smartTvsResponse) ? smartTvsResponse : [],
        stats: statsResponse || {},
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas do publisher:', error);
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


  // NOVO: handleCreatePublisher modificado para criar publisher, locais e totens
  const handleCreatePublisher = async () => {
    try {
      // Validação: nome do publisher é obrigatório
      if (!newPublisher.name || newPublisher.name.trim() === '') {
        setError('Nome do publicador é obrigatório');
        setCreateTab(0); // Ir para aba de Informações
        return;
      }

      // Validação: ao menos 1 local obrigatório
      if (tempLocals.length === 0) {
        setError('É obrigatório cadastrar ao menos 1 local antes de criar o publicador');
        setCreateTab(1); // Ir para aba de Locais
        return;
      }

      // Validação: ao menos 1 totem obrigatório
      if (tempTotems.length === 0) {
        setError('É obrigatório cadastrar ao menos 1 totem (player) antes de criar o publicador');
        setCreateTab(2); // Ir para aba de Totens
        return;
      }

      // 1. Criar o publisher
      console.log('Dados sendo enviados para criar publisher:', newPublisher);
      const createdPublisher = await publisherApi.create(newPublisher);
      console.log('Publisher criado com sucesso:', createdPublisher);
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
      });
      setTempLocals([]);
      setTempTotems([]);
      setTempSmartTvs([]);
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
            📢 Publicador
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
                  <MenuItem value="publisher">Publicador</MenuItem>
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
              <FormControl fullWidth margin="normal">
                <InputLabel>Tipo de Cliente</InputLabel>
                <Select
                  value={newPublisher.client_type}
                  label="Tipo de Cliente"
                  onChange={(e) => {
                    const value = e.target.value as 'subscriber' | 'publisher' | 'both';
                    setNewPublisher({
                      ...newPublisher,
                      client_type: value,
                      is_subscriber: value === 'subscriber' || value === 'both',
                      is_publisher: value === 'publisher' || value === 'both',
                    });
                  }}
                >
                  <MenuItem value="publisher">Apenas Publicador</MenuItem>
                  <MenuItem value="subscriber">Apenas Assinante</MenuItem>
                  <MenuItem value="both">Ambos (Publicador e Assinante)</MenuItem>
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
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>Editar Publicador</DialogTitle>
        <DialogContent>
          <Tabs value={editTab} onChange={(_, newValue) => setEditTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Informações" />
            <Tab label="Locais" />
            <Tab label="Totens" />
            <Tab label="Smart TVs" />
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
              <FormControl fullWidth margin="normal">
                <InputLabel>Tipo de Cliente</InputLabel>
                <Select
                  value={selectedPublisher.client_type || 'publisher'}
                  label="Tipo de Cliente"
                  onChange={(e) => {
                    const value = e.target.value as 'subscriber' | 'publisher' | 'both';
                    setSelectedPublisher({
                      ...selectedPublisher,
                      client_type: value,
                      is_subscriber: value === 'subscriber' || value === 'both',
                      is_publisher: value === 'publisher' || value === 'both',
                    });
                  }}
                >
                  <MenuItem value="publisher">Apenas Publicador</MenuItem>
                  <MenuItem value="subscriber">Apenas Assinante</MenuItem>
                  <MenuItem value="both">Ambos (Publicador e Assinante)</MenuItem>
                </Select>
              </FormControl>
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
              <Typography variant="h6" sx={{ mb: 2 }}>Locais</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Para editar locais, use a aba "Detalhes" e clique em "Editar" em cada local.
              </Alert>
            </Box>
          )}

          {/* Aba Totens */}
          {editTab === 2 && selectedPublisher && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Totens</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Para editar totens, use a aba "Detalhes" e clique em "Editar" em cada totem.
              </Alert>
            </Box>
          )}

          {/* Aba Smart TVs */}
          {editTab === 3 && selectedPublisher && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Smart TVs</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Para editar Smart TVs, use a aba "Detalhes" e clique em "Editar" em cada Smart TV.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            setEditTab(0);
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
            <Tab label="Locais" />
            <Tab label="Totens" />
            <Tab label="Smart TVs" />
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

          {detailsTab === 4 && publisherStats && (
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
