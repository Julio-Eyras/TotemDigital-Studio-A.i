/**
 * React Query Hooks - Smart Signage v2.1
 * Hooks do React Query para cache e sincronização automática
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, userApi, clientApi, playerApi, playlistApi, mediaApi, campaignApi, analyticsApi, settingsApi, billingApi, qrCodeApi, planApi, subscriptionApi, alertsApi, SystemAlert } from './index';

// =============================================
// DASHBOARD QUERIES
// =============================================

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
};

export const useRecentActivity = (limit: number = 10) => {
  return useQuery({
    queryKey: ['dashboard', 'activities', limit],
    queryFn: () => dashboardApi.getRecentActivity(limit),
    staleTime: 1 * 60 * 1000, // 1 minuto
  });
};

// =============================================
// USERS QUERIES
// =============================================

export const useUsers = (params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  clientId?: number;
} = {}) => {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => userApi.getAll(params),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};

export const useUser = (id: number) => {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => userApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => userApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', variables.id] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// =============================================
// CLIENTS QUERIES
// =============================================

export const useClients = (params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}) => {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: () => clientApi.getAll(params),
    staleTime: 5 * 60 * 1000,
  });
};

export const useClient = (id: number) => {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientApi.getById(id),
    enabled: !!id,
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => clientApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', variables.id] });
    },
  });
};

export const useDeleteClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
};

// =============================================
// PLAYERS QUERIES
// =============================================

export const usePlayers = (params: {
  page?: number;
  limit?: number;
  search?: string;
  clientId?: number;
  status?: string;
} = {}) => {
  return useQuery({
    queryKey: ['players', params],
    queryFn: () => playerApi.getAll(params),
    staleTime: 30 * 1000, // 30 segundos (dados mais dinâmicos)
    refetchInterval: 60 * 1000, // Refetch a cada minuto
  });
};

export const usePlayer = (id: number) => {
  return useQuery({
    queryKey: ['players', id],
    queryFn: () => playerApi.getById(id),
    enabled: !!id,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000, // Refetch a cada 30 segundos
  });
};

// =============================================
// MEDIA QUERIES
// =============================================

export const useMedia = (params: {
  page?: number;
  limit?: number;
  search?: string;
  mediaType?: string;
  clientId?: number;
} = {}) => {
  return useQuery({
    queryKey: ['media', params],
    queryFn: () => mediaApi.getAll(params),
    staleTime: 5 * 60 * 1000,
  });
};

export const useMediaItem = (id: number) => {
  return useQuery({
    queryKey: ['media', id],
    queryFn: () => mediaApi.getById(id),
    enabled: !!id,
  });
};

export const useUploadMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, data }: { file: File; data: any }) => mediaApi.upload(file, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });
};

// =============================================
// PLAYLISTS QUERIES
// =============================================

export const usePlaylists = (params: {
  page?: number;
  limit?: number;
  search?: string;
  clientId?: number;
} = {}) => {
  return useQuery({
    queryKey: ['playlists', params],
    queryFn: () => playlistApi.getAll(params),
    staleTime: 5 * 60 * 1000,
  });
};

export const usePlaylist = (id: number) => {
  return useQuery({
    queryKey: ['playlists', id],
    queryFn: () => playlistApi.getById(id),
    enabled: !!id,
  });
};

// =============================================
// CAMPAIGNS QUERIES
// =============================================

export const useCampaigns = (params: {
  page?: number;
  limit?: number;
  search?: string;
  clientId?: number;
  status?: string;
  campaignType?: string;
  isActive?: boolean;
} = {}) => {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: () => campaignApi.getAll(params),
    staleTime: 2 * 60 * 1000,
  });
};

// =============================================
// ANALYTICS QUERIES
// =============================================

export const useAnalytics = (params?: {
  startDate?: string;
  endDate?: string;
  clientId?: number;
}) => {
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: () => analyticsApi.getOverview(params),
    staleTime: 2 * 60 * 1000,
  });
};

// =============================================
// SETTINGS QUERIES
// =============================================

export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll(),
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
};

// =============================================
// BILLING QUERIES
// =============================================

export const useBillings = (params?: {
  clientId?: number;
  status?: string;
}) => {
  return useQuery({
    queryKey: ['billing', params],
    queryFn: () => billingApi.getAll(params),
    staleTime: 2 * 60 * 1000,
  });
};

// =============================================
// QR CODES QUERIES
// =============================================

export const useQRCodes = () => {
  return useQuery({
    queryKey: ['qrcodes'],
    queryFn: () => qrCodeApi.getAll(),
    staleTime: 5 * 60 * 1000,
  });
};

// =============================================
// PLANS QUERIES
// =============================================

export const usePlans = (includeInactive: boolean = false) => {
  return useQuery({
    queryKey: ['plans', includeInactive],
    queryFn: () => planApi.getAll(includeInactive),
    staleTime: 10 * 60 * 1000, // 10 minutos (planos mudam pouco)
  });
};

export const usePlan = (id: number) => {
  return useQuery({
    queryKey: ['plans', id],
    queryFn: () => planApi.getById(id),
    enabled: !!id,
  });
};

export const usePlanBySlug = (slug: string) => {
  return useQuery({
    queryKey: ['plans', 'slug', slug],
    queryFn: () => planApi.getBySlug(slug),
    enabled: !!slug,
  });
};

export const useCreatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: planApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
};

export const useUpdatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => planApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans', variables.id] });
    },
  });
};

export const useDeletePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: planApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
};

// =============================================
// SUBSCRIPTIONS QUERIES
// =============================================

export const useSubscriptions = (params?: {
  clientId?: number;
  planId?: number;
  status?: string;
}) => {
  return useQuery({
    queryKey: ['subscriptions', params],
    queryFn: () => subscriptionApi.getAll(params),
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
};

export const useSubscription = (id: number) => {
  return useQuery({
    queryKey: ['subscriptions', id],
    queryFn: () => subscriptionApi.getById(id),
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minuto
  });
};

export const useSubscriptionsByClient = (clientId: number) => {
  return useQuery({
    queryKey: ['subscriptions', 'client', clientId],
    queryFn: () => subscriptionApi.getByClient(clientId),
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000,
  });
};

export const useCreateSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subscriptionApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
};

export const useUpdateSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => subscriptionApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions', variables.id] });
    },
  });
};

export const useCancelSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subscriptionApi.cancel,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions', id] });
    },
  });
};

export const useResumeSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subscriptionApi.resume,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions', id] });
    },
  });
};

// =============================================
// ALERTS QUERIES
// =============================================

export const useSystemAlerts = (limit: number = 20) => {
  return useQuery<SystemAlert[]>({
    queryKey: ['alerts', 'active', limit],
    queryFn: () => alertsApi.getActive(limit),
    // Evitar spam/429 em ambiente local (rate limit) + evitar retry automático
    retry: false,
    refetchInterval: 60 * 1000, // 60 segundos
    staleTime: 60 * 1000,
  });
};

