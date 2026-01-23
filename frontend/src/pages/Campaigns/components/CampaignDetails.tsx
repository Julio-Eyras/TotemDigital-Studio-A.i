/**
 * CampaignDetails Component
 * Componente para exibir detalhes completos de uma campanha
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Chip,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Campaign as CampaignIcon,
  QueueMusic,
  VideoLibrary,
  Business,
  Computer,
  CalendarToday,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  PlayArrow,
  Stop,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Campaign, campaignApi, PlaylistItem, MediaItem, Publisher, Player, playlistApi, mediaApi } from '../../../services/api';

export interface CampaignDetailsProps {
  open: boolean;
  campaign: Campaign | null;
  onClose: () => void;
  onEdit?: (campaign: Campaign) => void;
}

const formatDate = (date: string | Date): string => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatDateTime = (date: string | Date): string => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'success';
    case 'completed':
      return 'default';
    case 'cancelled':
      return 'error';
    case 'draft':
      return 'warning';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    active: 'Ativa',
    completed: 'Concluída',
    cancelled: 'Cancelada',
    draft: 'Rascunho',
  };
  return statusMap[status?.toLowerCase()] || status || 'N/A';
};

const getCampaignTypeLabel = (type: string): string => {
  const typeMap: { [key: string]: string } = {
    general: 'Geral',
    scheduled: 'Agendada',
    interactive: 'Interativa',
    recurring: 'Recorrente',
  };
  return typeMap[type?.toLowerCase()] || type || 'N/A';
};

const CampaignDetails: React.FC<CampaignDetailsProps> = ({
  open,
  campaign,
  onClose,
  onEdit,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && campaign) {
      loadDetails();
    }
  }, [open, campaign]);

  const loadDetails = async () => {
    if (!campaign) return;

    try {
      setLoading(true);
      
      // Carregar dados relacionados
      const promises: Promise<any>[] = [];
      
      // Playlists
      if (campaign.playlistIds && campaign.playlistIds.length > 0) {
        promises.push(
          Promise.all(
            campaign.playlistIds.map(id => 
              playlistApi.getById(id).catch(() => null)
            )
          ).then(results => results.filter(Boolean))
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      // Mídias
      if (campaign.mediaIds && campaign.mediaIds.length > 0) {
        promises.push(
          Promise.all(
            campaign.mediaIds.map(id =>
              mediaApi.getById(id).catch(() => null)
            )
          ).then(results => results.filter(Boolean))
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      // Publishers (se disponível via API)
      if ((campaign as any).publisherIds && (campaign as any).publisherIds.length > 0) {
        promises.push(Promise.resolve([])); // Placeholder - implementar quando API estiver disponível
      } else {
        promises.push(Promise.resolve([]));
      }

      // Players/Totens (se disponível via API)
      if ((campaign as any).totemIds && (campaign as any).totemIds.length > 0) {
        promises.push(Promise.resolve([])); // Placeholder - implementar quando API estiver disponível
      } else {
        promises.push(Promise.resolve([]));
      }

      const [playlistsData, mediaData, publishersData, playersData] = await Promise.all(promises);
      
      setPlaylists(Array.isArray(playlistsData) ? playlistsData : []);
      setMediaItems(Array.isArray(mediaData) ? mediaData : []);
      setPublishers(Array.isArray(publishersData) ? publishersData : []);
      setPlayers(Array.isArray(playersData) ? playersData : []);
    } catch (error) {
      console.error('Erro ao carregar detalhes da campanha:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CampaignIcon />
          <Typography variant="h6">{campaign.title}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
          <Tab label="Informações" />
          <Tab 
            label="Playlists"
            icon={
              campaign.playlistIds && campaign.playlistIds.length > 0 ? (
                <Chip label={campaign.playlistIds.length} size="small" color="primary" />
              ) : undefined
            }
            iconPosition="end"
          />
          <Tab 
            label="Mídias"
            icon={
              campaign.mediaIds && campaign.mediaIds.length > 0 ? (
                <Chip label={campaign.mediaIds.length} size="small" color="primary" />
              ) : undefined
            }
            iconPosition="end"
          />
          <Tab label="Publishers" />
          <Tab label="Totens" />
        </Tabs>

        {/* Aba Informações */}
        {activeTab === 0 && (
          <TableContainer>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Título</TableCell>
                  <TableCell>{campaign.title}</TableCell>
                </TableRow>
                {(campaign.category_segment || (campaign as any).categorySegment) && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Categoria/Segmento</TableCell>
                    <TableCell>{campaign.category_segment || (campaign as any).categorySegment}</TableCell>
                  </TableRow>
                )}
                {campaign.description && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Descrição</TableCell>
                    <TableCell>{campaign.description}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                  <TableCell>
                    <Chip 
                      label={getCampaignTypeLabel(campaign.campaign_type)} 
                      size="small" 
                      color="primary" 
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(campaign.status)}
                      size="small"
                      color={getStatusColor(campaign.status)}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Ativa</TableCell>
                  <TableCell>
                    <Chip
                      label={campaign.is_active ? 'Sim' : 'Não'}
                      size="small"
                      color={campaign.is_active ? 'success' : 'default'}
                      icon={campaign.is_active ? <CheckCircle /> : <Stop />}
                    />
                  </TableCell>
                </TableRow>
                {campaign.start_date && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Data de Início</TableCell>
                    <TableCell>{formatDate(campaign.start_date)}</TableCell>
                  </TableRow>
                )}
                {campaign.end_date && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Data de Término</TableCell>
                    <TableCell>{formatDate(campaign.end_date)}</TableCell>
                  </TableRow>
                )}
                {campaign.commercial_tier && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Nível Comercial (Tier)</TableCell>
                    <TableCell>
                      <Chip label={campaign.commercial_tier} size="small" />
                    </TableCell>
                  </TableRow>
                )}
                {campaign.priority !== undefined && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Prioridade</TableCell>
                    <TableCell>{campaign.priority}</TableCell>
                  </TableRow>
                )}
                {campaign.subscriber_id && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Subscriber ID</TableCell>
                    <TableCell>{campaign.subscriber_id}</TableCell>
                  </TableRow>
                )}
                {campaign.contract_id && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Contrato ID</TableCell>
                    <TableCell>{campaign.contract_id}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Criado em</TableCell>
                  <TableCell>
                    {campaign.created_at ? formatDateTime(campaign.created_at) : 'N/A'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Atualizado em</TableCell>
                  <TableCell>
                    {campaign.updated_at ? formatDateTime(campaign.updated_at) : 'N/A'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Aba Playlists */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Playlists ({campaign.playlistIds?.length || 0})
            </Typography>
            {!campaign.playlistIds || campaign.playlistIds.length === 0 ? (
              <Alert severity="info">Nenhuma playlist associada a esta campanha</Alert>
            ) : playlists.length > 0 ? (
              <List>
                {playlists.map((playlist: any) => (
                  <ListItem key={playlist.playlist_id}>
                    <ListItemIcon>
                      <QueueMusic />
                    </ListItemIcon>
                    <ListItemText
                      primary={playlist.name}
                      secondary={`${playlist.media_count || 0} mídias • Duração: ${playlist.total_duration ? Math.floor(playlist.total_duration / 60) + ':' + String(Math.floor(playlist.total_duration % 60)).padStart(2, '0') : 'N/A'}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Alert severity="warning">
                Playlists associadas: {campaign.playlistIds.join(', ')} (detalhes não disponíveis)
              </Alert>
            )}
          </Box>
        )}

        {/* Aba Mídias */}
        {activeTab === 2 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Mídias Diretas ({campaign.mediaIds?.length || 0})
            </Typography>
            {!campaign.mediaIds || campaign.mediaIds.length === 0 ? (
              <Alert severity="info">Nenhuma mídia direta associada a esta campanha</Alert>
            ) : mediaItems.length > 0 ? (
              <List>
                {mediaItems.map((media: any) => (
                  <ListItem key={media.media_id}>
                    <ListItemIcon>
                      <VideoLibrary />
                    </ListItemIcon>
                    <ListItemText
                      primary={media.name}
                      secondary={`${media.fileName || ''} • Tipo: ${media.media_type || (media as any).mediaType || 'N/A'}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Alert severity="warning">
                Mídias associadas: {campaign.mediaIds.join(', ')} (detalhes não disponíveis)
              </Alert>
            )}
          </Box>
        )}

        {/* Aba Publishers */}
        {activeTab === 3 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Publishers ({(campaign as any).publisherIds?.length || 0})
            </Typography>
            {!(campaign as any).publisherIds || (campaign as any).publisherIds.length === 0 ? (
              <Alert severity="info">Nenhum publisher associado a esta campanha</Alert>
            ) : (
              <Alert severity="info">
                Publishers associados: {(campaign as any).publisherIds.join(', ')}
              </Alert>
            )}
          </Box>
        )}

        {/* Aba Totens */}
        {activeTab === 4 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Totens ({(campaign as any).totemIds?.length || 0})
            </Typography>
            {!(campaign as any).totemIds || (campaign as any).totemIds.length === 0 ? (
              <Alert severity="info">Nenhum totem associado a esta campanha</Alert>
            ) : (
              <Alert severity="info">
                Totens associados: {(campaign as any).totemIds.join(', ')}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {onEdit && (
          <Button onClick={() => onEdit(campaign)} variant="contained">
            Editar
          </Button>
        )}
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CampaignDetails;
