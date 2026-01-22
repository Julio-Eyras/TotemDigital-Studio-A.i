/**
 * useSubscribers Hook
 * Hook para gerenciar lógica de subscribers
 */

import { useState, useEffect, useCallback } from 'react';
import { subscriberApi, Subscriber, CreateSubscriberRequest, UpdateSubscriberRequest } from '../../../services/api';
import { useNotification } from '../../../hooks/useNotification';

export interface UseSubscribersReturn {
  subscribers: Subscriber[];
  loading: boolean;
  error: string | null;
  overallStats: {
    total: number;
    active: number;
    inactive: number;
    totalMedias: number;
    totalPlaylists: number;
    totalCampaigns: number;
  } | null;
  loadSubscribers: () => Promise<void>;
  createSubscriber: (data: CreateSubscriberRequest) => Promise<Subscriber | null>;
  updateSubscriber: (id: number, data: UpdateSubscriberRequest) => Promise<boolean>;
  deleteSubscriber: (id: number) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useSubscribers(): UseSubscribersReturn {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overallStats, setOverallStats] = useState<{
    total: number;
    active: number;
    inactive: number;
    totalMedias: number;
    totalPlaylists: number;
    totalCampaigns: number;
  } | null>(null);

  const { showSuccess, showError } = useNotification();

  const loadSubscribers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriberApi.getAll();
      setSubscribers(response.data || []);
      
      // Calcular estatísticas
      const stats = {
        total: response.data?.length || 0,
        active: response.data?.filter((s) => s.is_active).length || 0,
        inactive: response.data?.filter((s) => !s.is_active).length || 0,
        totalMedias: 0, // Será calculado se necessário
        totalPlaylists: 0, // Será calculado se necessário
        totalCampaigns: 0, // Será calculado se necessário
      };
      setOverallStats(stats);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar subscribers');
      showError('Erro ao carregar subscribers: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const createSubscriber = useCallback(async (data: CreateSubscriberRequest): Promise<Subscriber | null> => {
    try {
      setError(null);
      const response = await subscriberApi.create(data);
      await loadSubscribers();
      showSuccess('Subscriber criado com sucesso');
      return response || null;
    } catch (err: any) {
      setError(err.message || 'Erro ao criar subscriber');
      showError('Erro ao criar subscriber: ' + (err.message || 'Erro desconhecido'));
      return null;
    }
  }, [loadSubscribers, showSuccess, showError]);

  const updateSubscriber = useCallback(async (id: number, data: UpdateSubscriberRequest): Promise<boolean> => {
    try {
      setError(null);
      await subscriberApi.update(id, data);
      await loadSubscribers();
      showSuccess('Subscriber atualizado com sucesso');
      return true;
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar subscriber');
      showError('Erro ao atualizar subscriber: ' + (err.message || 'Erro desconhecido'));
      return false;
    }
  }, [loadSubscribers, showSuccess, showError]);

  const deleteSubscriber = useCallback(async (id: number): Promise<boolean> => {
    try {
      setError(null);
      await subscriberApi.delete(id);
      await loadSubscribers();
      showSuccess('Subscriber deletado com sucesso');
      return true;
    } catch (err: any) {
      setError(err.message || 'Erro ao deletar subscriber');
      showError('Erro ao deletar subscriber: ' + (err.message || 'Erro desconhecido'));
      return false;
    }
  }, [loadSubscribers, showSuccess, showError]);

  const refresh = useCallback(async () => {
    await loadSubscribers();
  }, [loadSubscribers]);

  useEffect(() => {
    loadSubscribers();
  }, [loadSubscribers]);

  return {
    subscribers,
    loading,
    error,
    overallStats,
    loadSubscribers,
    createSubscriber,
    updateSubscriber,
    deleteSubscriber,
    refresh,
  };
}
