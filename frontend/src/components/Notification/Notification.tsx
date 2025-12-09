/**
 * Notification Component - Smart Signage v2.1
 * Componente para exibir notificações ao usuário
 */

import React, { useEffect, useState } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { removeNotification } from '../../store/slices/notificationSlice';

const Notification: React.FC = () => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.notification.notifications);
  const [currentNotification, setCurrentNotification] = useState<typeof notifications[0] | null>(null);

  useEffect(() => {
    if (notifications.length > 0) {
      setCurrentNotification(notifications[0]);
    } else {
      setCurrentNotification(null);
    }
  }, [notifications]);

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
      autoHideDuration={currentNotification.duration || 6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Alert
        onClose={handleClose}
        severity={(currentNotification.type || 'info') as AlertColor}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {currentNotification.title && (
          <strong>{currentNotification.title}: </strong>
        )}
        {currentNotification.message}
      </Alert>
    </Snackbar>
  );
};

export default Notification;

