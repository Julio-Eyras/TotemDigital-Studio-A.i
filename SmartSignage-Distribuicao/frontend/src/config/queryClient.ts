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
      retry: 2,
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

