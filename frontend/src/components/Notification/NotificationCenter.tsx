/**
 * NotificationCenter Component - SmartSignage Pro v2.1
 * Centro de notificações com histórico e categorização
 */

import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Badge,
  Chip,
  Tabs,
  Tab,
  Button,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Notifications,
  Close,
  CheckCircle,
  Error,
  Warning,
  Info,
  Delete,
  MarkEmailRead,
} from '@mui/icons-material';
// Removido imports não utilizados - usando localStorage diretamente

interface NotificationItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const NotificationCenter: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Carregar notificações do localStorage
  useEffect(() => {
    const loadNotifications = () => {
      const stored = localStorage.getItem('notifications');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setNotifications(
            parsed.map((n: any) => ({
              ...n,
              timestamp: new Date(n.timestamp),
            }))
          );
        } catch (e) {
          console.error('Erro ao carregar notificações:', e);
        }
      }
    };

    loadNotifications();

    // Ouvir eventos de novas notificações
    const handleNotificationAdded = () => {
      loadNotifications();
    };

    window.addEventListener('notificationAdded', handleNotificationAdded);
    return () => {
      window.removeEventListener('notificationAdded', handleNotificationAdded);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'info':
        return <Info color="info" />;
      default:
        return <Info />;
    }
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    saveNotifications();
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    saveNotifications();
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    saveNotifications();
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem('notifications');
  };

  const saveNotifications = () => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  };

  const filteredNotifications = () => {
    switch (activeTab) {
      case 0: // Todas
        return notifications;
      case 1: // Não lidas
        return notifications.filter((n) => !n.read);
      case 2: // Sistema
        return notifications.filter((n) => n.type === 'info' || n.type === 'warning');
      case 3: // Alertas
        return notifications.filter((n) => n.type === 'error' || n.type === 'warning');
      default:
        return notifications;
    }
  };

  return (
    <>
      {/* Botão de Notificações */}
      <Tooltip title="Notificações">
        <IconButton
          color="inherit"
          onClick={() => setOpen(true)}
          sx={{ position: 'relative' }}
        >
          <Badge badgeContent={unreadCount} color="error">
            <Notifications />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Drawer de Notificações */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            width: 400,
            maxWidth: '90vw',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box
            sx={{
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6">
              Notificações {unreadCount > 0 && `(${unreadCount})`}
            </Typography>
            <Box>
              {unreadCount > 0 && (
                <Tooltip title="Marcar todas como lidas">
                  <IconButton size="small" onClick={markAllAsRead}>
                    <MarkEmailRead />
                  </IconButton>
                </Tooltip>
              )}
              <IconButton size="small" onClick={() => setOpen(false)}>
                <Close />
              </IconButton>
            </Box>
          </Box>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Todas" />
            <Tab
              label={
                <Badge badgeContent={unreadCount} color="error">
                  Não Lidas
                </Badge>
              }
            />
            <Tab label="Sistema" />
            <Tab label="Alertas" />
          </Tabs>

          {/* Lista de Notificações */}
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
            {filteredNotifications().length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  Nenhuma notificação
                </Typography>
              </Box>
            ) : (
              <List>
                {filteredNotifications().map((notification, index) => (
                  <React.Fragment key={notification.id}>
                    <ListItem
                      sx={{
                        bgcolor: notification.read ? 'transparent' : 'action.hover',
                        '&:hover': {
                          bgcolor: 'action.selected',
                        },
                      }}
                    >
                      <ListItemIcon>{getIcon(notification.type)}</ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2">
                              {notification.title}
                            </Typography>
                            {!notification.read && (
                              <Chip
                                label="Nova"
                                size="small"
                                color="error"
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {notification.message}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {notification.timestamp.toLocaleString('pt-BR')}
                            </Typography>
                          </Box>
                        }
                      />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {!notification.read && (
                          <Tooltip title="Marcar como lida">
                            <IconButton
                              size="small"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <MarkEmailRead fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Remover">
                          <IconButton
                            size="small"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </ListItem>
                    {notification.action && (
                      <Box sx={{ px: 2, pb: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          fullWidth
                          onClick={() => {
                            notification.action?.onClick();
                            markAsRead(notification.id);
                          }}
                        >
                          {notification.action.label}
                        </Button>
                      </Box>
                    )}
                    {index < filteredNotifications().length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>

          {/* Footer */}
          {notifications.length > 0 && (
            <Box
              sx={{
                p: 2,
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <Button size="small" onClick={clearAll} color="error">
                Limpar Todas
              </Button>
              <Typography variant="caption" color="text.secondary">
                {notifications.length} notificação(ões)
              </Typography>
            </Box>
          )}
        </Box>
      </Drawer>
    </>
  );
};

export default NotificationCenter;
