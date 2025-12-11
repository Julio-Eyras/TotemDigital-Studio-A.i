/**
 * useNotification Hook - Smart Signage v2.1
 * Hook para exibir notificações
 */

import { useCallback } from 'react';
import { useAppDispatch } from '../store/hooks';
import { addNotification } from '../store/slices/notificationSlice';

export const useNotification = () => {
  const dispatch = useAppDispatch();

  const showNotification = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration?: number) => {
      dispatch(addNotification({ type, title, message, duration }));
    },
    [dispatch]
  );

  const showSuccess = useCallback(
    (message: string, title: string = 'Sucesso') => {
      showNotification('success', title, message);
    },
    [showNotification]
  );

  const showError = useCallback(
    (message: string, title: string = 'Erro') => {
      showNotification('error', title, message);
    },
    [showNotification]
  );

  const showWarning = useCallback(
    (message: string, title: string = 'Aviso') => {
      showNotification('warning', title, message);
    },
    [showNotification]
  );

  const showInfo = useCallback(
    (message: string, title: string = 'Informação') => {
      showNotification('info', title, message);
    },
    [showNotification]
  );

  return {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};

