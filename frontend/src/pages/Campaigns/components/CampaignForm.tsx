/**
 * CampaignForm Component
 * Formulário reutilizável para criar/editar campanhas
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
  Grid,
  Autocomplete,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  alpha,
  useTheme,
} from '@mui/material';
import {
  CreateCampaignRequest,
  UpdateCampaignRequest,
  Campaign,
  Client,
  PlaylistItem,
  MediaItem,
  Player,
  Publisher,
  AccessiblePublisher,
  dashboardApi,
  DashboardUiContext,
} from '../../../services/api';
import { DISABLE_DIRECT_CAMPAIGN_TOTEM } from '../../../config/featureFlags';
import { DIRECT_CAMPAIGN_TOTEM_DISABLED_HINT_PT } from '../../../constants/campaignUiMessages';
import { getTotemIdFromRow } from '../../../utils/totemRowIds';
import { getProductTerminology } from '../../../config/productTerminology';

export interface CampaignFormProps {
  mode: 'create' | 'edit';
  campaign?: Campaign;
  data: CreateCampaignRequest | UpdateCampaignRequest;
  onChange: (data: CreateCampaignRequest | UpdateCampaignRequest) => void;
  errors?: { [key: string]: string };
  // Dados auxiliares
  clients?: Client[];
  playlists?: PlaylistItem[];
  mediaItems?: MediaItem[];
  players?: Player[];
  publishers?: Publisher[];
  accessiblePublishers?: AccessiblePublisher[];
  isAdmin?: boolean;
  onSubscriberChange?: (subscriberId?: number) => Promise<void>;
}

interface PublisherOption {
  publisher_id: number;
  name: string;
  email?: string;
}

const CampaignForm: React.FC<CampaignFormProps> = ({
  mode,
  campaign,
  data,
  onChange,
  errors = {},
  clients = [],
  playlists = [],
  mediaItems = [],
  players = [],
  publishers = [],
  accessiblePublishers = [],
  isAdmin = false,
  onSubscriberChange,
}) => {
  const orgTerms = getProductTerminology();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [serverUi, setServerUi] = useState<DashboardUiContext | null>(null);

  useEffect(() => {
    void dashboardApi.getUiContext().then(setServerUi).catch(() => setServerUi(null));
  }, []);

  const directTotemDisabled =
    serverUi?.disableDirectCampaignTotem ?? DISABLE_DIRECT_CAMPAIGN_TOTEM;
  const directTotemHint =
    serverUi?.directCampaignTotemHint || DIRECT_CAMPAIGN_TOTEM_DISABLED_HINT_PT;

  const getPublisherOptions = (): PublisherOption[] => {
    if (isAdmin) {
      return publishers.map(p => ({
        publisher_id: p.publisher_id,
        name: p.name,
        email: p.email
      }));
    }
    if (!Array.isArray(accessiblePublishers)) {
      return [];
    }
    return accessiblePublishers.map(ap => ({
      publisher_id: ap.publisher_id,
      name: ap.publisher_name || '',
      email: ap.publisher_email
    }));
  };

  const handleFieldChange = (field: string, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const getFieldValue = (field: string): any => {
    return (data as any)[field] || '';
  };

  const hasError = (field: string): boolean => {
    return !!errors[field];
  };

  const getHelperText = (field: string, defaultText?: string): string => {
    if (errors[field]) return errors[field];
    return defaultText || '';
  };

  const toDateInputValue = (date?: string | Date): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  const subscriberId = (data as any).subscriberId || (data as any).clientId || campaign?.subscriber_id;

  return (
    <Box>
      {directTotemDisabled && (
        <Alert severity="warning" sx={{ mb: 2 }} variant="outlined">
          <Typography variant="body2">{directTotemHint}</Typography>
        </Alert>
      )}
      {mode === 'edit' && (
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 2 }}
        >
          <Tab label="Principal" />
          <Tab label="Organizações" />
          <Tab label="Playlists" />
          <Tab label="Mídias" />
          <Tab label="Totens" />
          <Tab label="Agendamento" />
        </Tabs>
      )}

      {(activeTab === 0 || mode === 'create') && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {mode === 'create' ? 'Dados da Campanha' : 'Informações Principais'}
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Título"
                value={getFieldValue('title')}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                margin="normal"
                required
                error={hasError('title')}
                helperText={getHelperText('title')}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Categoria/Segmento"
                value={getFieldValue('categorySegment') || getFieldValue('category_segment') || ''}
                onChange={(e) => handleFieldChange('categorySegment', e.target.value)}
                margin="normal"
                helperText={getHelperText('categorySegment', 'Ex.: Black Friday, Saúde, Promoções...')}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Tipo de Campanha</InputLabel>
                <Select
                  value={getFieldValue('campaign_type') || 'general'}
                  onChange={(e) => handleFieldChange('campaign_type', e.target.value)}
                  label="Tipo de Campanha"
                >
                  <MenuItem value="general">Geral</MenuItem>
                  <MenuItem value="scheduled">Agendada</MenuItem>
                  <MenuItem value="interactive">Interativa</MenuItem>
                  <MenuItem value="recurring">Recorrente</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descrição"
                value={getFieldValue('description') || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                margin="normal"
                multiline
                rows={3}
                error={hasError('description')}
                helperText={getHelperText('description')}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Status</InputLabel>
                <Select
                  value={getFieldValue('status') || 'draft'}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  label="Status"
                  error={hasError('status')}
                >
                  <MenuItem value="draft">Rascunho</MenuItem>
                  <MenuItem value="active">Ativa</MenuItem>
                  <MenuItem value="finished">Concluída</MenuItem>
                  {mode === 'edit' && <MenuItem value="cancelled">Cancelada</MenuItem>}
                </Select>
              </FormControl>
            </Grid>

            {mode === 'edit' && (
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={(campaign as any)?.is_active ?? false}
                      onChange={(e) => {
                        if (mode === 'edit') {
                          onChange({
                            ...data,
                            isActive: e.target.checked,
                          } as UpdateCampaignRequest);
                        }
                      }}
                    />
                  }
                  label="Campanha Ativa"
                />
              </Grid>
            )}

            {mode === 'create' && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Anunciante</InputLabel>
                  <Select
                    value={subscriberId || ''}
                    onChange={async (e) => {
                      const value = e.target.value;
                      const newSubscriberId = value && value !== '' ? parseInt(String(value), 10) : undefined;
                      handleFieldChange('subscriberId', newSubscriberId);
                      handleFieldChange('publisherIds', []); // Limpar organizações ao mudar anunciante
                      
                      if (onSubscriberChange) {
                        await onSubscriberChange(newSubscriberId);
                      }
                    }}
                    label="Anunciante"
                  >
                    <MenuItem value="">Nenhum</MenuItem>
                    {clients.map((client) => {
                      const clientSubscriberId = client.client_id;
                      return (
                        <MenuItem key={client.client_id} value={clientSubscriberId}>
                          {client.name}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Data de Início"
                type="date"
                value={toDateInputValue(getFieldValue('start_date'))}
                onChange={(e) => handleFieldChange('start_date', e.target.value)}
                margin="normal"
                InputLabelProps={{ shrink: true }}
                helperText="Período de validade da campanha (início)"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Data de Término"
                type="date"
                value={toDateInputValue(getFieldValue('end_date'))}
                onChange={(e) => handleFieldChange('end_date', e.target.value)}
                margin="normal"
                InputLabelProps={{ shrink: true }}
                helperText="Período de validade da campanha (fim)"
              />
            </Grid>
          </Grid>

          {/* Campos Comerciais */}
          <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: theme.palette.primary.main }}>
              Configurações Comerciais
            </Typography>
            <FormControl fullWidth margin="normal">
              <InputLabel>Nível Comercial (Tier)</InputLabel>
              <Select
                value={(data as any).commercial_tier || 'standard'}
                onChange={(e) => handleFieldChange('commercial_tier', e.target.value)}
                label="Nível Comercial (Tier)"
              >
                <MenuItem value="premium">Premium</MenuItem>
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="remnant">Remnant</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Share de Tempo Padrão (%)"
              type="number"
              inputProps={{ min: 0, max: 100, step: 0.1 }}
              value={(data as any).default_time_share_percent || 0}
              onChange={(e) => handleFieldChange('default_time_share_percent', parseFloat(e.target.value) || 0)}
              margin="normal"
              helperText="Percentual de tempo padrão que esta campanha deve ocupar no mix (0-100%)"
            />
            <TextField
              fullWidth
              label="Máximo de Slots Consecutivos"
              type="number"
              inputProps={{ min: 1, max: 10 }}
              value={(data as any).max_consecutive_slots || 2}
              onChange={(e) => handleFieldChange('max_consecutive_slots', parseInt(e.target.value) || 2)}
              margin="normal"
              helperText="Número máximo de itens desta campanha que podem aparecer consecutivamente"
            />
          </Box>
        </>
      )}

      {/* Aba Organizações */}
      {activeTab === 1 && mode === 'edit' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Organizações
          </Typography>
          <FormControl fullWidth margin="normal">
            <InputLabel>Organizações (onde a campanha será exibida)</InputLabel>
            <Autocomplete<PublisherOption, true>
              multiple
              options={getPublisherOptions()}
              getOptionLabel={(option) => option.name || `Organização #${option.publisher_id}`}
              value={getPublisherOptions().filter(p => (data as any).publisherIds?.includes(p.publisher_id))}
              onChange={(_, newValue) => {
                handleFieldChange('publisherIds', newValue.map(p => p.publisher_id));
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label="Organizações" 
                  margin="normal"
                  helperText={
                    isAdmin
                      ? `Selecione as ${orgTerms.organizationPlural.toLowerCase()} onde a campanha será exibida`
                      : !Array.isArray(accessiblePublishers) || accessiblePublishers.length === 0
                      ? `Nenhuma ${orgTerms.organization.toLowerCase()} acessível encontrada. Verifique o contrato e o plano do anunciante.`
                      : `Selecione as ${orgTerms.organizationPlural.toLowerCase()} acessíveis onde a campanha será exibida`
                  }
                />
              )}
              disabled={!subscriberId || (!isAdmin && (!Array.isArray(accessiblePublishers) || accessiblePublishers.length === 0))}
            />
          </FormControl>
        </Box>
      )}

      {/* Seleção de organizações no modo create */}
      {mode === 'create' && subscriberId && (
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Organizações (onde a campanha será exibida)</InputLabel>
            <Autocomplete<PublisherOption, true>
              multiple
              options={getPublisherOptions()}
              getOptionLabel={(option) => option.name || `Organização #${option.publisher_id}`}
              value={getPublisherOptions().filter(p => (data as any).publisherIds?.includes(p.publisher_id))}
              onChange={(_, newValue) => {
                handleFieldChange('publisherIds', newValue.map(p => p.publisher_id));
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label="Organizações" 
                  margin="normal"
                  helperText={
                    isAdmin
                      ? `Selecione as ${orgTerms.organizationPlural.toLowerCase()} onde a campanha será exibida`
                      : !Array.isArray(accessiblePublishers) || accessiblePublishers.length === 0
                      ? `Nenhuma ${orgTerms.organization.toLowerCase()} acessível encontrada. Verifique o contrato e o plano do anunciante.`
                      : `Selecione as ${orgTerms.organizationPlural.toLowerCase()} acessíveis onde a campanha será exibida`
                  }
                />
              )}
              disabled={!subscriberId || (!isAdmin && (!Array.isArray(accessiblePublishers) || accessiblePublishers.length === 0))}
            />
          </FormControl>
        </Box>
      )}

      {/* Aba Playlists */}
      {activeTab === 2 && mode === 'edit' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Playlists
          </Typography>
          <Autocomplete
            multiple
            options={playlists.filter(p => {
              const campaignSubscriberId = subscriberId;
              return !campaignSubscriberId || (p.subscriber_id ?? p.client_id) === campaignSubscriberId;
            })}
            getOptionLabel={(option) => option.name}
            value={playlists.filter(p => ((data as any).playlistIds || []).includes(p.playlist_id))}
            onChange={(_, newValue) => {
              handleFieldChange('playlistIds', newValue.map(p => p.playlist_id));
            }}
            noOptionsText="Nenhuma playlist cadastrada. Crie em Anunciantes > Playlists, adicione mídias e depois selecione aqui."
            renderInput={(params) => (
              <TextField {...params} label="Playlists" margin="normal" helperText="Selecione playlists para associar à campanha" />
            )}
          />
        </Box>
      )}

      {/* Seleção de Playlists no modo create */}
      {mode === 'create' && (
        <Box sx={{ mt: 2 }}>
          <Autocomplete
            multiple
            options={playlists.filter(p => {
              const campaignSubscriberId = subscriberId;
              return !campaignSubscriberId || (p.subscriber_id ?? p.client_id) === campaignSubscriberId;
            })}
            getOptionLabel={(option) => option.name}
            value={playlists.filter(p => ((data as any).playlistIds || []).includes(p.playlist_id))}
            onChange={(_, newValue) => {
              handleFieldChange('playlistIds', newValue.map(p => p.playlist_id));
            }}
            noOptionsText="Nenhuma playlist cadastrada. Crie em Anunciantes > Playlists, adicione mídias e depois selecione aqui."
            renderInput={(params) => (
              <TextField {...params} label="Playlists" margin="normal" />
            )}
          />
        </Box>
      )}

      {/* Aba Mídias */}
      {activeTab === 3 && mode === 'edit' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Mídias Diretas (sem playlist)
          </Typography>
          <Autocomplete
            multiple
            options={mediaItems.filter(m => {
              const campaignSubscriberId = subscriberId;
              const mediaSubscriberId = m.subscriberId || (m as any).clientId;
              return !campaignSubscriberId || mediaSubscriberId === campaignSubscriberId;
            })}
            getOptionLabel={(option) => option.name}
            value={mediaItems.filter(m => ((data as any).mediaIds || []).includes(m.media_id))}
            onChange={(_, newValue) => {
              handleFieldChange('mediaIds', newValue.map(m => m.media_id));
            }}
            renderInput={(params) => (
              <TextField {...params} label="Mídias Diretas (sem playlist)" margin="normal" helperText="Selecione mídias para associar diretamente à campanha, sem usar playlist" />
            )}
          />
        </Box>
      )}

      {/* Seleção de Mídias no modo create */}
      {mode === 'create' && (
        <Box sx={{ mt: 2 }}>
          <Autocomplete
            multiple
            options={mediaItems.filter(m => {
              const campaignSubscriberId = subscriberId;
              const mediaSubscriberId = m.subscriberId || (m as any).clientId;
              return !campaignSubscriberId || mediaSubscriberId === campaignSubscriberId;
            })}
            getOptionLabel={(option) => option.name}
            value={mediaItems.filter(m => ((data as any).mediaIds || []).includes(m.media_id))}
            onChange={(_, newValue) => {
              handleFieldChange('mediaIds', newValue.map(m => m.media_id));
            }}
            renderInput={(params) => (
              <TextField {...params} label="Mídias Diretas (sem playlist)" margin="normal" helperText="Selecione mídias para associar diretamente à campanha, sem usar playlist" />
            )}
          />
        </Box>
      )}

      {/* Aba Totens */}
      {activeTab === 4 && mode === 'edit' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Totens
          </Typography>
          <Autocomplete
            multiple
            options={players}
            getOptionLabel={(option) => {
              const id = getTotemIdFromRow(option);
              return option.name || option.identifier || option.uin || `Totem ${id ?? '?'}`;
            }}
            value={players.filter((p) => {
              const id = getTotemIdFromRow(p);
              return id !== undefined && ((data as any).totemIds || []).includes(id);
            })}
            onChange={(_, newValue) => {
              const ids = newValue
                .map((p) => getTotemIdFromRow(p))
                .filter((n): n is number => n !== undefined);
              handleFieldChange('totemIds', ids);
            }}
            renderInput={(params) => (
              <TextField {...params} label="SmartvPlayers → Totem" margin="normal" />
            )}
          />
        </Box>
      )}

      {/* Seleção de Totens no modo create */}
      {mode === 'create' && (
        <Box sx={{ mt: 2 }}>
          <Autocomplete
            multiple
            options={players}
            getOptionLabel={(option) => {
              const id = getTotemIdFromRow(option);
              return option.name || option.identifier || option.uin || `Totem ${id ?? '?'}`;
            }}
            value={players.filter((p) => {
              const id = getTotemIdFromRow(p);
              return id !== undefined && ((data as any).totemIds || []).includes(id);
            })}
            onChange={(_, newValue) => {
              const ids = newValue
                .map((p) => getTotemIdFromRow(p))
                .filter((n): n is number => n !== undefined);
              handleFieldChange('totemIds', ids);
            }}
            renderInput={(params) => (
              <TextField {...params} label="SmartvPlayers → Totem" margin="normal" />
            )}
          />
        </Box>
      )}

      {/* Aba Agendamento */}
      {activeTab === 6 && mode === 'edit' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Validade / Execução
          </Typography>
          <Alert severity="info">
            A campanha pode manter associações históricas. A execução (dispatcher/mix) filtra apenas o que estiver válido no momento atual.
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default CampaignForm;
