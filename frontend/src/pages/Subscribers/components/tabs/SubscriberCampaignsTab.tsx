/**
 * SubscriberCampaignsTab Component
 * Tab para gerenciar campanhas do subscriber
 */

import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
  Alert,
  Typography,
} from '@mui/material';
import {
  Campaign as CampaignIcon,
  Edit,
  Delete,
} from '@mui/icons-material';
import { Campaign } from '../../../../services/api';

export interface SubscriberCampaignsTabProps {
  campaigns: Campaign[];
  onEdit?: (campaign: Campaign, index: number) => void;
  onDelete?: (index: number) => void;
  editingIndex?: number | null;
}

const SubscriberCampaignsTab: React.FC<SubscriberCampaignsTabProps> = ({
  campaigns,
  onEdit,
  onDelete,
  editingIndex,
}) => {
  return (
    <Box>
      {campaigns.length === 0 ? (
        <Alert severity="info">
          Nenhuma campanha cadastrada ainda. Crie uma campanha para organizar suas mídias e playlists.
        </Alert>
      ) : (
        <List>
          {campaigns.map((campaign, index) => (
            <ListItem
              key={campaign.campaign_id || index}
              sx={{
                border: `1px solid`,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
              }}
            >
              <ListItemIcon>
                <CampaignIcon />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box>
                    <Typography variant="body1" fontWeight="bold">
                      {campaign.title}
                    </Typography>
                    {campaign.description && (
                      <Typography variant="caption" color="text.secondary">
                        {campaign.description}
                      </Typography>
                    )}
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2">
                      Tipo: {campaign.campaign_type} | Prioridade: {campaign.priority} | Status: {campaign.status}
                    </Typography>
                    {campaign.contract_id ? (
                      <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                        ✓ Vinculada ao contrato: {campaign.contract_number || campaign.contract_title || `#${campaign.contract_id}`}
                        {campaign.plan_name && ` (Plano: ${campaign.plan_name})`}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                        ⚠ Sem contrato vinculado - não pode ser executada nos totens
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {campaign.mediaIds && campaign.mediaIds.length > 0 && `${campaign.mediaIds.length} mídia(s)`}
                      {campaign.mediaIds && campaign.mediaIds.length > 0 && campaign.playlistIds && campaign.playlistIds.length > 0 && ' • '}
                      {campaign.playlistIds && campaign.playlistIds.length > 0 && `${campaign.playlistIds.length} playlist(s)`}
                      {(!campaign.mediaIds || campaign.mediaIds.length === 0) && (!campaign.playlistIds || campaign.playlistIds.length === 0) && 'Sem conteúdo'}
                    </Typography>
                  </Box>
                }
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={campaign.is_active !== undefined ? (campaign.is_active ? 'Ativa' : 'Inativa') : 'N/A'}
                  size="small"
                  color={campaign.is_active ? 'success' : 'default'}
                />
                <Chip
                  label={campaign.status || 'draft'}
                  size="small"
                  color={campaign.status === 'active' ? 'success' : campaign.status === 'approved' ? 'info' : 'default'}
                />
                {onEdit && (
                  <IconButton
                    size="small"
                    onClick={() => onEdit(campaign, index)}
                    disabled={editingIndex === index}
                  >
                    <Edit />
                  </IconButton>
                )}
                {onDelete && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => onDelete(index)}
                  >
                    <Delete />
                  </IconButton>
                )}
              </Box>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default SubscriberCampaignsTab;
