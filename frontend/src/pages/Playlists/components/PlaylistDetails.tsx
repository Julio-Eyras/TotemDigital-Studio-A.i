/**
 * PlaylistDetails Component
 * Componente para exibir detalhes completos de uma playlist
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
  Avatar,
  IconButton,
  Paper,
  TableHead,
} from '@mui/material';
import {
  QueueMusic,
  VideoLibrary,
  Image,
  AudioFile,
  CheckCircle,
  Stop,
  AccessTime,
  Campaign as CampaignIcon,
  Delete,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PlaylistItem, playlistApi, PlaylistMediaItem, PlaylistCampaignInfo, MediaItem } from '../../../services/api';

export interface PlaylistDetailsProps {
  open: boolean;
  playlist: PlaylistItem | null;
  onClose: () => void;
  onEdit?: (playlist: PlaylistItem) => void;
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

const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds === 0) return 'N/A';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

const formatDurationMs = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  return formatDuration(seconds);
};

const getMediaIcon = (mediaType?: string) => {
  switch (mediaType?.toLowerCase()) {
    case 'video':
      return <VideoLibrary />;
    case 'image':
      return <Image />;
    case 'audio':
      return <AudioFile />;
    default:
      return <VideoLibrary />;
  }
};

const PlaylistDetails: React.FC<PlaylistDetailsProps> = ({
  open,
  playlist,
  onClose,
  onEdit,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [playlistMedia, setPlaylistMedia] = useState<PlaylistMediaItem[]>([]);
  const [playlistCampaigns, setPlaylistCampaigns] = useState<PlaylistCampaignInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && playlist) {
      loadDetails();
    }
  }, [open, playlist]);

  const loadDetails = async () => {
    if (!playlist) return;

    try {
      setLoading(true);
      
      // Carregar mídias da playlist
      const mediaResponse = await playlistApi.getMedia(playlist.playlist_id);
      setPlaylistMedia(Array.isArray(mediaResponse) ? mediaResponse : []);

      // Carregar campanhas que usam esta playlist
      try {
        const campaignsResponse = await playlistApi.getCampaigns(playlist.playlist_id);
        setPlaylistCampaigns(Array.isArray(campaignsResponse) ? campaignsResponse : []);
      } catch (error) {
        setPlaylistCampaigns([]);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  if (!playlist) return null;

  const totalDuration = playlistMedia.reduce((acc, item) => acc + (item.duration || 0), 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QueueMusic />
          <Typography variant="h6">{playlist.name}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 2 }}
        >
          <Tab label="Informações" />
          <Tab 
            label="Mídias"
            icon={
              playlistMedia.length > 0 ? (
                <Chip label={playlistMedia.length} size="small" color="primary" />
              ) : undefined
            }
            iconPosition="end"
          />
          <Tab 
            label="Campanhas"
            icon={
              playlistCampaigns.length > 0 ? (
                <Chip label={playlistCampaigns.length} size="small" color="primary" />
              ) : undefined
            }
            iconPosition="end"
          />
        </Tabs>

        {/* Aba Informações */}
        {activeTab === 0 && (
          <TableContainer>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Nome</TableCell>
                  <TableCell>{playlist.name}</TableCell>
                </TableRow>
                {playlist.category_segment && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Categoria/Segmento</TableCell>
                    <TableCell>{playlist.category_segment}</TableCell>
                  </TableRow>
                )}
                {playlist.description && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Descrição</TableCell>
                    <TableCell>{playlist.description}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell>
                    <Chip
                      label={playlist.is_active ? 'Ativa' : 'Inativa'}
                      size="small"
                      color={playlist.is_active ? 'success' : 'warning'}
                      icon={playlist.is_active ? <CheckCircle /> : <Stop />}
                      sx={!playlist.is_active ? { fontWeight: 700 } : undefined}
                    />
                  </TableCell>
                </TableRow>
                {playlist.subscriber_id && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Anunciante ID</TableCell>
                    <TableCell>
                      {(playlist.subscriber_name ?? (playlist as any).subscribername) ? (
                        `${playlist.subscriber_name ?? (playlist as any).subscribername} (ID: ${playlist.subscriber_id})`
                      ) : (
                        playlist.subscriber_id
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {playlist.media_count !== undefined && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Quantidade de Mídias</TableCell>
                    <TableCell>{playlist.media_count}</TableCell>
                  </TableRow>
                )}
                {playlist.total_duration && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Duração Total</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTime fontSize="small" />
                        {formatDuration(playlist.total_duration)}
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Criado em</TableCell>
                  <TableCell>
                    {playlist.created_at ? formatDateTime(playlist.created_at) : 'N/A'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Atualizado em</TableCell>
                  <TableCell>
                    {playlist.updated_at ? formatDateTime(playlist.updated_at) : 'N/A'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Aba Mídias */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Mídias ({playlistMedia.length})
              </Typography>
              {totalDuration > 0 && (
                <Chip
                  icon={<AccessTime />}
                  label={`Duração total: ${formatDurationMs(totalDuration)}`}
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
            {playlistMedia.length === 0 ? (
              <Alert severity="info">Nenhuma mídia adicionada a esta playlist</Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Ordem</TableCell>
                      <TableCell>Mídia</TableCell>
                      <TableCell>Tipo</TableCell>
                      <TableCell>Duração</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {playlistMedia
                      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                      .map((item) => (
                        <TableRow key={item.item_id}>
                          <TableCell>{item.order_index || 'N/A'}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
                                {getMediaIcon(item.media?.media_type || (item.media as any)?.mediaType)}
                              </Avatar>
                              <Typography variant="body2">
                                {item.media?.name || `Mídia ${item.media_id}`}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={item.media?.media_type || (item.media as any)?.mediaType || 'N/A'} 
                              size="small" 
                            />
                          </TableCell>
                          <TableCell>{formatDurationMs(item.duration || 0)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Aba Campanhas */}
        {activeTab === 2 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Campanhas ({playlistCampaigns.length})
            </Typography>
            {playlistCampaigns.length === 0 ? (
              <Alert severity="info">Nenhuma campanha usando esta playlist</Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Título</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Ativa</TableCell>
                      <TableCell>Início</TableCell>
                      <TableCell>Fim</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {playlistCampaigns.map((campaign) => (
                      <TableRow key={campaign.campaign_id}>
                        <TableCell>{campaign.campaign_id}</TableCell>
                        <TableCell>{campaign.title}</TableCell>
                        <TableCell>
                          <Chip label={campaign.status} size="small" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={campaign.is_active ? 'Sim' : 'Não'}
                            size="small"
                            color={campaign.is_active ? 'success' : 'warning'}
                            sx={!campaign.is_active ? { fontWeight: 700 } : undefined}
                          />
                        </TableCell>
                        <TableCell>
                          {campaign.start_date ? formatDate(campaign.start_date) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {campaign.end_date ? formatDate(campaign.end_date) : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {onEdit && (
          <Button onClick={() => onEdit(playlist)} variant="contained">
            Editar
          </Button>
        )}
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlaylistDetails;
