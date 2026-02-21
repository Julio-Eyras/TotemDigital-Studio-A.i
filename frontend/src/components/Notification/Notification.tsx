/**
 * Notification Component - Smart Signage v2.1
 * Componente para exibir notificações ao usuário
 */

import React, { useEffect, useState } from 'react';
import { Snackbar, Alert, AlertColor, Box, Typography } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { removeNotification, addNotification } from '../../store/slices/notificationSlice';

const Notification: React.FC = () => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.notification.notifications);
  const [currentNotification, setCurrentNotification] = useState<typeof notifications[0] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (notifications.length > 0) {
      setCurrentNotification(notifications[0]);
    } else {
      setCurrentNotification(null);
    }
  }, [notifications]);

  // Listen for global showNotification events dispatched from API layer
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = (e as CustomEvent).detail;
      if (!custom) return;
      const payload = {
        type: custom.type || 'info',
        title: custom.title || '',
        message: custom.message || '',
        duration: custom.duration,
        details: custom.details,
      };
      dispatch(addNotification(payload));
    };

    window.addEventListener('showNotification', handler as EventListener);
    return () => {
      window.removeEventListener('showNotification', handler as EventListener);
    };
  }, [dispatch]);

  const handleClose = () => {
    if (currentNotification) {
      dispatch(removeNotification(currentNotification.id));
    }
  };

  if (!currentNotification) {
    return null;
  }

  return (
    <Snackbar
      open={!!currentNotification}
      autoHideDuration={currentNotification?.duration ?? 30000} // default 30s for easier reading
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      disableWindowBlurListener
    >
      <Alert
        onClose={handleClose}
        severity={(currentNotification?.type || 'info') as AlertColor}
        variant="filled"
        sx={{ width: '100%', maxWidth: 600, whiteSpace: 'pre-wrap' }}
      >
        {currentNotification?.title && (
          <Typography component="div" variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {currentNotification.title}
          </Typography>
        )}
        <Box sx={{ mt: 1 }}>
          <Typography component="div" variant="body2">
            {currentNotification?.message}
          </Typography>
        </Box>

        {currentNotification?.details && (
          <Box sx={{ mt: 1 }}>
            <Typography component="div" variant="caption" sx={{ fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Ocultar detalhes' : 'Mostrar detalhes'}
            </Typography>
            {expanded && (
              <Box component="pre" sx={{ mt: 1, maxHeight: 240, overflow: 'auto', bgcolor: 'rgba(0,0,0,0.06)', p: 1, borderRadius: 1 }}>
                {typeof currentNotification.details === 'string'
                  ? currentNotification.details
                  : JSON.stringify(currentNotification.details, null, 2)}
              </Box>
            )}
          </Box>
        )}
      </Alert>
    </Snackbar>
  );
};

export default Notification;

