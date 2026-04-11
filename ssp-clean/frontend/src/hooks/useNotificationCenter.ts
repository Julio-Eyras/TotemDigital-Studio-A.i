/**
 * useNotificationCenter Hook
 * Hook para adicionar notificações ao centro de notificações
 */

import { useCallback } from 'react';

export interface NotificationOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
}

export function useNotificationCenter() {
  const addNotification = useCallback((options: NotificationOptions) => {
    const notification = {
      id: `notification-${Date.now()}-${Math.random()}`,
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      timestamp: new Date(),
      read: false,
      action: options.action,
    };

    // Carregar notificações existentes
    const stored = localStorage.getItem('notifications');
    const notifications = stored ? JSON.parse(stored) : [];

    // Adicionar nova notificação
    notifications.unshift(notification);

    // Limitar a 100 notificações
    if (notifications.length > 100) {
      notifications.splice(100);
    }

    // Salvar
    localStorage.setItem('notifications', JSON.stringify(notifications));

    // Disparar evento customizado para atualizar o componente
    window.dispatchEvent(new CustomEvent('notificationAdded', { detail: notification }));
  }, []);

  return { addNotification };
}
