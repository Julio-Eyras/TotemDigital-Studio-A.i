/**
 * SubscriberCard Component
 * Card reutilizável para exibir informações de um subscriber
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Stack,
  LinearProgress,
  Popover,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
} from '@mui/material';
import {
  Business,
  Email,
  Phone,
  Edit,
  Delete,
  Visibility,
  LocationOn,
  Article,
  VideoLibrary,
  QueueMusic,
  Campaign as CampaignIcon,
  Storage,
  Add,
  AutoAwesome,
  Storefront,
  ContactMail,
  Schedule,
  WarningAmber,
} from '@mui/icons-material';
import { Subscriber } from '../../../services/api';
import { ContractHealthLevel, subscriberAlertCardSx } from '../subscriberContractHealth';
import {
  SUBSCRIBER_KPI_LEGEND,
  formatCoverageLabel,
  formatPlanQuota,
  getPublishReadiness,
  getSubscriberContractListChip,
  getSubscriberFinancialListChip,
  resolveLastActivityLabel,
} from '../subscriberCardMetrics';
import { getDisabledContainerSx, getDisabledTextColor } from '../../../utils/disabledVisualIdentity';

export interface SubscriberCardProps {
  subscriber: Subscriber;
  onEdit?: (subscriber: Subscriber) => void;
  onDelete?: (subscriber: Subscriber) => void;
  onView?: (subscriber: Subscriber) => void;
  onPublish?: (subscriber: Subscriber) => void;
  onMenuCatalog?: (subscriber: Subscriber) => void;
  onStudio?: (subscriber: Subscriber) => void;
}

function worstCardHealth(
  contract: ContractHealthLevel,
  financial: ContractHealthLevel | 'neutral' | null,
  publishColor: 'success' | 'warning' | 'error' | 'default',
): ContractHealthLevel {
  const rank = (h: string) =>
    h === 'error' ? 3 : h === 'warning' ? 2 : h === 'success' ? 1 : 0;
  let best: ContractHealthLevel = contract;
  if (financial && rank(financial) > rank(best)) best = financial as ContractHealthLevel;
  if (publishColor === 'error' && rank('error') > rank(best)) best = 'error';
  if (publishColor === 'warning' && rank('warning') > rank(best)) best = 'warning';
  return best;
}

const SubscriberCard: React.FC<SubscriberCardProps> = ({
  subscriber,
  onEdit,
  onDelete,
  onView,
  onPublish,
  onMenuCatalog,
  onStudio,
}) => {
  const theme = useTheme();
  const [contactAnchor, setContactAnchor] = useState<HTMLElement | null>(null);
  const isInactive = subscriber.is_active === false;

  const activeContracts = subscriber.active_contracts_count || 0;
  const mediaCount = subscriber.media_count || 0;
  const playlistCount = subscriber.playlist_count || 0;
  const campaignCount = subscriber.campaign_count || 0;
  const campaignPlaylistCount = subscriber.campaign_playlist_count || 0;
  const campaignTotalMedia =
    subscriber.campaign_total_media_count ??
    (subscriber.campaign_direct_media_count || 0) + (subscriber.campaign_playlist_media_count || 0);
  const playlistMediaCount = subscriber.playlist_media_count || 0;
  const orphanMedia = subscriber.orphan_media_count ?? Math.max(0, mediaCount - campaignTotalMedia);

  const storageUsedGB = subscriber.storage_used_gb || 0;
  const storageLimitGB = subscriber.storage_limit_gb || 0;
  const storagePercent =
    storageLimitGB > 0 ? Math.min((storageUsedGB / storageLimitGB) * 100, 100) : 0;
  const storageLabel =
    storageLimitGB > 0
      ? `${storageUsedGB.toFixed(2)} / ${storageLimitGB} GB`
      : `${storageUsedGB.toFixed(2)} GB usados`;

  const contractChip = getSubscriberContractListChip(subscriber);
  const financialChip = getSubscriberFinancialListChip(subscriber);
  const publishReady = getPublishReadiness(subscriber);
  const lastActivity = resolveLastActivityLabel(subscriber);
  const coverageLabel = formatCoverageLabel(subscriber);

  const cardHealth = worstCardHealth(
    contractChip.health,
    financialChip?.health ?? null,
    publishReady.color,
  );

  const kpiItems = [
    {
      key: 'media',
      icon: <VideoLibrary fontSize="small" color="action" />,
      label: 'Bibliotecas Mídias',
      display: String(mediaCount),
      sub: formatPlanQuota(mediaCount, subscriber.plan_limit_medias),
      tooltip: `Total activas · cota ${formatPlanQuota(mediaCount, subscriber.plan_limit_medias)}`,
    },
    {
      key: 'playlists',
      icon: <QueueMusic fontSize="small" color="action" />,
      label: 'Playlists',
      display: `${playlistCount}:${playlistMediaCount}`,
      sub: `PT:MT · ${formatPlanQuota(playlistCount, subscriber.plan_limit_playlists)}`,
      tooltip: 'PT:MT — playlists activas : mídias activas nessas playlists',
    },
    {
      key: 'campaigns',
      icon: <CampaignIcon fontSize="small" color="action" />,
      label: 'Campanhas',
      display: `${campaignCount},${campaignTotalMedia},${campaignPlaylistCount}`,
      sub: `Ct,mt,pt · ${formatPlanQuota(campaignCount, subscriber.plan_limit_campaigns)}`,
      tooltip:
        'Ct, mt, pt — campanhas activas · mídias (directas ou em playlists) · playlists assignadas',
    },
  ];

  const hasContact = Boolean(subscriber.email || subscriber.phone || subscriber.whatsapp);

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        ...subscriberAlertCardSx(cardHealth),
        ...getDisabledContainerSx(theme, isInactive ? 'disabled-global' : 'default'),
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5, gap: 1 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 52, height: 52, flexShrink: 0 }}>
            <Business />
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              component="div"
              noWrap
              sx={isInactive ? { fontWeight: 700 } : undefined}
            >
              {subscriber.name}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              <Chip
                label={subscriber.is_active ? 'Ativo' : 'Inactivo'}
                size="small"
                color={subscriber.is_active ? 'success' : 'warning'}
                sx={!subscriber.is_active ? { fontWeight: 700 } : undefined}
              />
              <Tooltip title={contractChip.tooltip}>
                <Chip
                  label={contractChip.label}
                  size="small"
                  color={
                    contractChip.health === 'error'
                      ? 'error'
                      : contractChip.health === 'warning'
                        ? 'warning'
                        : 'success'
                  }
                  variant={contractChip.health === 'success' ? 'outlined' : 'filled'}
                />
              </Tooltip>
              {financialChip && (
                <Tooltip title={financialChip.tooltip}>
                  <Chip
                    label={financialChip.label}
                    size="small"
                    color={
                      financialChip.health === 'error'
                        ? 'error'
                        : financialChip.health === 'warning'
                          ? 'warning'
                          : 'success'
                    }
                    variant="outlined"
                  />
                </Tooltip>
              )}
              <Tooltip title={publishReady.tooltip}>
                <Chip
                  label={publishReady.label}
                  size="small"
                  color={publishReady.color}
                  variant={publishReady.level === 'ready' ? 'filled' : 'outlined'}
                />
              </Tooltip>
            </Box>
          </Box>
          {hasContact && (
            <>
              <Tooltip title="Contacto">
                <IconButton size="small" onClick={(e) => setContactAnchor(e.currentTarget)}>
                  <ContactMail fontSize="small" />
                </IconButton>
              </Tooltip>
              <Popover
                open={Boolean(contactAnchor)}
                anchorEl={contactAnchor}
                onClose={() => setContactAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <List dense sx={{ minWidth: 240, py: 0.5 }}>
                  {subscriber.email && (
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Email fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={subscriber.email} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                  )}
                  {subscriber.phone && (
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Phone fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={subscriber.phone} primaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                  )}
                  {subscriber.whatsapp && subscriber.whatsapp !== subscriber.phone && (
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Phone fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={subscriber.whatsapp}
                        secondary="WhatsApp"
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  )}
                </List>
              </Popover>
            </>
          )}
        </Box>

        <Stack spacing={0.75} sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <LocationOn fontSize="small" color="action" />
            <Tooltip title={coverageLabel}>
              <Typography
                variant="caption"
                color={getDisabledTextColor(theme, isInactive ? 'disabled-global' : 'default')}
                noWrap
              >
                {coverageLabel}
              </Typography>
            </Tooltip>
          </Box>
          {lastActivity && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Schedule fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary" noWrap>
                {lastActivity}
              </Typography>
            </Box>
          )}
          {subscriber.category_segment && (
            <Chip label={subscriber.category_segment} size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }} />
          )}
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, lineHeight: 1.3 }}>
          {SUBSCRIBER_KPI_LEGEND}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 0.75,
            mb: 0.75,
          }}
        >
          {kpiItems.map((item) => (
            <Tooltip key={item.key} title={item.tooltip}>
              <Box
                sx={{
                  textAlign: 'center',
                  px: 0.25,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  minWidth: 0,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.25 }}>{item.icon}</Box>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.65rem' }}>
                  {item.label}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, fontSize: '1.05rem' }}>
                  {item.display}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem' }} noWrap>
                  {item.sub}
                </Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, flexWrap: 'wrap' }}>
          <Article fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary">
            Contratos activos
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {activeContracts}
          </Typography>
          {orphanMedia > 0 && (
            <Tooltip title="Mídias activas na biblioteca sem campanha activa">
              <Chip
                icon={<WarningAmber sx={{ fontSize: 14 }} />}
                label={`${orphanMedia} sem campanha`}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ ml: 'auto', height: 22, '& .MuiChip-label': { px: 0.75, fontSize: '0.68rem' } }}
              />
            </Tooltip>
          )}
        </Box>

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Storage fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary" noWrap>
              Espaço da cota
            </Typography>
            <Typography variant="caption" sx={{ ml: 'auto', fontWeight: 600 }}>
              {storageLabel}
            </Typography>
          </Box>
          {storageLimitGB > 0 && (
            <LinearProgress
              variant="determinate"
              value={storagePercent}
              color={storagePercent > 90 ? 'error' : storagePercent > 75 ? 'warning' : 'primary'}
              sx={{ height: 6, borderRadius: 3 }}
            />
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', px: 2, pb: 2, gap: 0.5 }}>
        {onPublish && (
          <Tooltip title="Publicar em tela">
            <IconButton size="small" color="primary" onClick={() => onPublish(subscriber)}>
              <Add />
            </IconButton>
          </Tooltip>
        )}
        {onStudio && (
          <Tooltip title="Criar conteúdo">
            <IconButton size="small" onClick={() => onStudio(subscriber)}>
              <AutoAwesome />
            </IconButton>
          </Tooltip>
        )}
        {onMenuCatalog && (
          <Tooltip title="Cardápio">
            <IconButton size="small" onClick={() => onMenuCatalog(subscriber)}>
              <Storefront />
            </IconButton>
          </Tooltip>
        )}
        {onView && (
          <Tooltip title="Ver Detalhes">
            <IconButton size="small" onClick={() => onView(subscriber)}>
              <Visibility />
            </IconButton>
          </Tooltip>
        )}
        {onEdit && (
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEdit(subscriber)}>
              <Edit />
            </IconButton>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip title="Deletar">
            <IconButton size="small" color="error" onClick={() => onDelete(subscriber)}>
              <Delete />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
};

export default SubscriberCard;
