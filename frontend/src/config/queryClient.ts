/**
 * React Query Configuration - Smart Signage v2.1
 * Configuração do React Query para cache e sincronização
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache por 5 minutos por padrão
      staleTime: 5 * 60 * 1000, // 5 minutos
      // Manter dados em cache por 10 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (anteriormente cacheTime)
      // Retry automático em caso de erro
      retry: (failureCount, error: any) => {
        const status = error?.response?.status ?? error?.status;
        // Evitar martelar o backend em erros de rate limit / 4xx
        if (status === 429) return false;
        if (typeof status === 'number' && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      // Refetch quando a janela ganha foco
      refetchOnWindowFocus: true,
      // Refetch quando reconecta à rede
      refetchOnReconnect: true,
      // Não refetch automaticamente em background
      refetchOnMount: true,
    },
    mutations: {
      // Retry em mutações apenas uma vez
      retry: 1,
    },
  },
});

