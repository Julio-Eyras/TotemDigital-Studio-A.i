import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

/**
 * Retorna a URL base do WebSocket (host:port sem protocolo).
 * Usa REACT_APP_API_URL quando definido (conexão direta ao backend), senão mesmo host da página (proxy reverso).
 */
export function getWebSocketHost(): string {
  const apiUrl = process.env.REACT_APP_API_URL;
  if (apiUrl && (apiUrl.startsWith('http://') || apiUrl.startsWith('https://'))) {
    return apiUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
  return typeof window !== 'undefined' ? window.location.host : '';
}

/**
 * Monta a URL completa do WebSocket para /ws (com token em query).
 */
export function getWebSocketUrl(token: string): string {
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = getWebSocketHost();
  return `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;
}

// Configurar axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Se for FormData, remover Content-Type para axios adicionar boundary automaticamente
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Interceptor para tratar erros e rate limiting
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Tratamento de erros de conexão (servidor offline/reiniciando)
    // Fazer logout automático e redirecionar para login
    if (!error.response) {
      const isNetworkError = 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.message === 'Network Error' ||
        error.message?.includes('timeout') ||
        error.message?.includes('Failed to fetch');
      
      if (isNetworkError) {
        // Servidor reiniciou ou está offline - fazer logout e redirecionar
        console.warn('Erro de conexão (servidor reiniciando ou offline):', error.message);
        
        // Evitar logout em requisições de login
        const reqUrl: string = String(originalRequest?.url || '');
        const isAuthLoginRequest =
          reqUrl.includes('/auth/login') ||
          reqUrl.includes('/auth/subscriber-login') ||
          reqUrl.includes('/auth/refresh');

        if (!isAuthLoginRequest) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          // Forçar reload completo da página para limpar estado
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          } else {
            window.location.reload();
          }
        }
        return Promise.reject(error);
      }
    }

    // Tratamento de Rate Limiting (429)
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 
                        error.response.data?.error?.retryAfter || 
                        60;
      // Converter para número com segurança, tratando NaN e valores inválidos
      const retryAfterSeconds = (() => {
        if (typeof retryAfter === 'number') {
          return isNaN(retryAfter) ? 60 : Math.max(1, retryAfter);
        }
        const parsed = parseInt(String(retryAfter), 10);
        return isNaN(parsed) ? 60 : Math.max(1, parsed); // Fallback para 60s se inválido, mínimo 1s
      })();
      const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
      
      // Mensagem mais amigável
      const message = error.response.data?.error?.message || 
                     `Muitas requisições. Aguarde ${retryAfterMinutes} minuto(s) antes de tentar novamente.`;

      // Emitir evento customizado para notificação
      const rateLimitEvent = new CustomEvent('showNotification', {
        detail: {
          type: 'warning',
          title: 'Limite de requisições',
          message,
          details: { retryAfter: retryAfterSeconds },
          duration: Math.max(60000, retryAfterSeconds * 1000) // pelo menos 60s
        },
      });
      window.dispatchEvent(rateLimitEvent);

      // NÃO fazer retry automático para rate limit (evitar loops e mais requisições)
      return Promise.reject(error);
    }

    // Tratamento de 401 (Não autorizado)
    if (error.response?.status === 401) {
      // Evitar redirect/reload no fluxo de login (senão o usuário não vê a mensagem de credenciais inválidas)
      const reqUrl: string = String(originalRequest?.url || '');
      const isAuthLoginRequest =
        reqUrl.includes('/auth/login') ||
        reqUrl.includes('/auth/subscriber-login') ||
        reqUrl.includes('/auth/refresh');

      if (isAuthLoginRequest) {
        return Promise.reject(error);
      }

      // Fazer logout imediato e redirecionar para login
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      // Forçar reload completo da página para limpar estado
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      } else {
        window.location.reload();
      }
      return Promise.reject(error);
    }

    // Tratamento de 413 (Payload muito grande)
    if (error.response?.status === 413) {
      const payloadErrorEvent = new CustomEvent('showNotification', {
        detail: {
          type: 'error',
          title: 'Payload muito grande',
          message: 'Arquivo ou dados muito grandes. Reduza o tamanho e tente novamente.',
          details: error.response?.data,
          duration: 30000
        }
      });
      window.dispatchEvent(payloadErrorEvent);
    }

    // Tratamento de 400 (Bad Request) - Validação
    if (error.response?.status === 400) {
      const validationMessage = error.response.data?.message || error.response.data?.error || 'Erro de validação';
      const validationEvent = new CustomEvent('showNotification', {
        detail: {
          type: 'error',
          title: 'Dados inválidos',
          message: validationMessage,
          details: error.response.data?.details || error.response.data,
          duration: 30000
        }
      });
      window.dispatchEvent(validationEvent);
    }

    return Promise.reject(error);
  }
);

// =============================================
// DASHBOARD API
// =============================================

export interface DashboardStats {
  totalMedia: number;
  totalPlaylists: number;
  totalPlayers: number;
  totalUsers: number;
  activePlayers: number;
  offlinePlayers: number;
}

export interface RecentActivity {
  id: string;
  type: 'upload' | 'playlist' | 'player' | 'user' | 'client';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  getRecentActivity: async (limit: number = 10): Promise<RecentActivity[]> => {
    try {
      const response = await api.get(`/dashboard/activities?limit=${limit}`);
      const data = response.data.data || response.data;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Erro ao buscar atividades recentes:', error);
      return [];
    }
  },

  getUsageCharts: async () => {
    const response = await api.get('/dashboard/charts');
    return response.data;
  },
};

// =============================================
// USERS API
// =============================================

export interface UserFlags {
  flag_smart_0: boolean;
  flag_smart_1: boolean;
  flag_smart_2: boolean;
  flag_smart_3: boolean;
  flag_smart_4: boolean;
  flag_smart_5: boolean;
  flag_smart_6: boolean;
  flag_smart_7: boolean;
  flag_smart_8: boolean;
  flag_smart_9: boolean;
}

export interface User {
  user_id: number;
  username: string;
  email?: string;
  name: string;
  role: 'owner_system' | 'admin_sql' | 'admin' | 'operador_tecnico' | 'operador_faturamento' | 'operador_comercial' | 'gerente_marketing' | 'editoracao' | 'visualizador' | 'user' | 'publisher_user' | 'subscriber_user';
  publisher_id?: number;
  subscriber_id?: number;
  user_type?: 'system_user' | 'subscriber_user' | 'publisher_user';
  // Compat: backend/frontend em transição entre snake_case e camelCase
  is_tenant_user?: boolean;
  isTenantUser?: boolean;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
  flags?: UserFlags;
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  name: string;
  role: 'owner_system' | 'admin_sql' | 'admin' | 'operador_tecnico' | 'operador_faturamento' | 'operador_comercial' | 'gerente_marketing' | 'editoracao' | 'visualizador' | 'user' | 'publisher_user' | 'subscriber_user';
  publisherId?: number;
  subscriberId?: number;
  userType?: 'system_user' | 'subscriber_user' | 'publisher_user';
  isTenantUser?: boolean;
  flags?: Partial<UserFlags>; // NOVO
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  name?: string;
  role?: 'owner_system' | 'admin_sql' | 'admin' | 'operador_tecnico' | 'operador_faturamento' | 'operador_comercial' | 'gerente_marketing' | 'editoracao' | 'visualizador' | 'user' | 'client' | 'publisher_user' | 'subscriber_user';
  publisherId?: number;
  subscriberId?: number;
  userType?: 'system_user' | 'subscriber_user' | 'publisher_user';
  isTenantUser?: boolean;
  isActive?: boolean;
  flags?: Partial<UserFlags>; // NOVO
}

export interface UserListResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

export const userApi = {
  getAll: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    userType?: string;
    publisherId?: number;
    subscriberId?: number;
  } = {}): Promise<UserListResponse> => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getById: async (id: number): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: CreateUserRequest): Promise<User> => {
    const response = await api.post('/users', data);
    return response.data;
  },

  update: async (id: number, data: UpdateUserRequest): Promise<User> => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  // Flags management
  getFlags: async (id: number): Promise<UserFlags> => {
    const response = await api.get(`/users/${id}/flags`);
    return response.data.data;
  },

  updateFlags: async (id: number, flags: Partial<UserFlags>): Promise<UserFlags> => {
    const response = await api.put(`/users/${id}/flags`, { flags });
    return response.data.data;
  },

  setFlag: async (id: number, flagName: keyof UserFlags, value: boolean): Promise<void> => {
    if (value) {
      await api.post(`/users/${id}/flags/${flagName}`);
    } else {
      await api.delete(`/users/${id}/flags/${flagName}`);
    }
  },
};

// =============================================
// CLIENTS API
// =============================================

export interface Client {
  client_id: number; // DEPRECATED: usar Subscriber
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateClientRequest {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
}

export interface UpdateClientRequest {
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  isActive?: boolean;
}

export interface ClientListResponse {
  data: Client[];
  total: number;
  page: number;
  limit: number;
}

export const clientApi = {
  getAll: async (params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<ClientListResponse> => {
    const response = await api.get('/clients', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Client> => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },

  create: async (data: CreateClientRequest): Promise<Client> => {
    const response = await api.post('/clients', data);
    return response.data;
  },

  update: async (id: number, data: UpdateClientRequest): Promise<Client> => {
    const response = await api.put(`/clients/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/clients/${id}`);
  },
};

// =============================================
// ALERTS API
// =============================================

export interface SystemAlert {
  id: string;
  ruleId: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: string;
  acknowledged: boolean;
}

export const alertsApi = {
  getActive: async (limit: number = 20): Promise<SystemAlert[]> => {
    const response = await api.get('/alerts', { params: { limit } });
    const data = response.data?.data || response.data;
    return Array.isArray(data) ? data : [];
  },

  checkNow: async (): Promise<SystemAlert[]> => {
    const response = await api.post('/alerts/check');
    const data = response.data?.data || response.data;
    return Array.isArray(data) ? data : [];
  },
};

// =============================================
// PLAYERS API
// =============================================

export interface Player {
  totem_id: number;
  name?: string;
  identifier?: string;
  uin?: string;
  /** Nome do registro em `locals` (alocação atual); preferir a `location` legada quando presente. */
  local_name?: string;
  location?: string;
  subscriber_id?: number; // client_id deprecated
  is_active: boolean;
  last_heartbeat?: string;
  current_playlist_id?: number;
  status: 'online' | 'offline' | 'error' | 'pending_approval';
  created_at: string;
  updated_at: string;
  config?: any;
  // Campo adicionado: timestamp até o qual o totem foi forçado a ficar online (ISO string)
  forced_online_until?: string;
  // Flag auxiliar exposta pela API/serviço indicando estado forçado
  forced_online?: boolean;
  // Compatibilidade camelCase
  forcedOnlineUntil?: string;
}

// Alias para compatibilidade
export type Totem = Player;

export interface CreatePlayerRequest {
  name?: string;
  identifier?: string; // Opcional: backend aceita name OU identifier
  uin?: string;
  localId: number; // OBRIGATÓRIO
  contract_id?: number; // Opcional: contrato que gerou a criação (rastreabilidade)
  deviceId?: string;
  location?: string;
  description?: string;
  firmwareVersion?: string;
  subscriberId?: number; // clientId deprecated
}

export interface UpdatePlayerRequest {
  name?: string;
  identifier?: string;
  uin?: string;
  localId?: number;
  deviceId?: string;
  location?: string;
  description?: string;
  firmwareVersion?: string;
  clientId?: number; // DEPRECATED
  subscriberId?: number; // NOVO: Use subscriberId
  isActive?: boolean;
}

export interface PlayerListResponse {
  data: Player[];
  total: number;
  page: number;
  limit: number;
}

export const playerApi = {
  getAll: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    subscriberId?: number; // NOVO: Use subscriberId
    clientId?: number; // DEPRECATED: Mantido para compatibilidade
    status?: string;
  } = {}): Promise<PlayerListResponse> => {
    // Converter clientId para subscriberId se fornecido
    const apiParams: any = { ...params };
    if (apiParams.clientId && !apiParams.subscriberId) {
      apiParams.subscriberId = apiParams.clientId;
      delete apiParams.clientId;
    }
    const response = await api.get('/players', { params: apiParams });
    return response.data;
  },

  getById: async (id: number): Promise<Player> => {
    const response = await api.get(`/players/${id}`);
    return response.data;
  },

  create: async (data: CreatePlayerRequest): Promise<Player> => {
    const response = await api.post('/players', data);
    return response.data;
  },

  update: async (id: number, data: UpdatePlayerRequest): Promise<Player> => {
    const response = await api.put(`/players/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/players/${id}`);
  },

  assignPlaylist: async (playerId: number, playlistId: number): Promise<void> => {
    await api.post(`/players/${playerId}/playlist`, { playlistId });
  },

  getStatus: async (id: number) => {
    const response = await api.get(`/players/${id}/status`);
    return response.data;
  },
};

// =============================================
// PLAYLISTS API
// =============================================

export interface PlaylistItem {
  playlist_id: number;
  name: string;
  category_segment?: string;
  description?: string;
  subscriber_id: number; // NOVO: OBRIGATÓRIO
  subscriber_name?: string; // NOVO: Nome do subscriber
  client_id?: number; // DEPRECATED: Mantido para compatibilidade (alias de subscriber_id)
  is_active: boolean;
  created_at: string;
  updated_at: string;
  media_count?: number;
  total_duration?: number;
}

export interface CreatePlaylistRequest {
  name: string;
  categorySegment?: string;
  description?: string;
  subscriberId?: number; // NOVO: Use subscriberId
  clientId?: number; // DEPRECATED: Mantido para compatibilidade
}

export interface UpdatePlaylistRequest {
  name?: string;
  categorySegment?: string;
  description?: string;
  subscriberId?: number; // NOVO: Use subscriberId
  clientId?: number; // DEPRECATED: Mantido para compatibilidade
  isActive?: boolean;
}

export interface PlaylistListResponse {
  data: PlaylistItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PlaylistMediaItem {
  item_id: number;
  playlist_id: number;
  media_id: number;
  order_index: number;
  duration: number;
  media: any;
}

export interface PlaylistCampaignInfo {
  campaign_id: number;
  title: string;
  status: string;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  days_of_week?: string | null;
  timezone?: string | null;
  updated_at?: string | null;
}

export interface PlaylistExposureRow {
  campaign_id: number;
  campaign_title: string;
  campaign_status: string;
  campaign_is_active: boolean;
  campaign_start_date?: string | null;
  campaign_end_date?: string | null;
  campaign_start_time?: string | null;
  campaign_end_time?: string | null;
  campaign_days_of_week?: string | null;
  campaign_timezone?: string | null;

  publisher_id: number;
  publisher_name: string;

  local_id: number | null;
  local_name: string | null;

  totem_id: number | null;
  totem_identifier: string | null;
  totem_name: string | null;

  smart_tv_id: number | null;
  tv_identifier: string | null;
  tv_name: string | null;
}

export interface PlaylistItemScheduleSummary {
  start_time: string | null;
  end_time: string | null;
  days_of_week: string | null;
  count: number;
}

export interface PlaylistExposureResponse {
  rows: PlaylistExposureRow[];
  campaigns: PlaylistCampaignInfo[];
  publishers: Array<{ publisher_id: number; name: string }>;
  totems: Array<{ totem_id: number; identifier: string; name: string | null; local_id: number | null; local_name: string | null }>;
  smartTvs: Array<{ smart_tv_id: number; identifier: string; name: string | null; totem_id: number | null }>;
  playlistItemSchedules?: PlaylistItemScheduleSummary[];
}

export const playlistApi = {
  reorderItems: async (id: number, items: Array<{ itemId: number; orderIndex: number }>): Promise<void> => {
    await api.put(`/playlists/${id}/reorder`, { items });
  },
  getAll: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    subscriberId?: number; // NOVO: Use subscriberId
    clientId?: number; // DEPRECATED: Mantido para compatibilidade
  } = {}): Promise<PlaylistListResponse> => {
    const response = await api.get('/playlists', { params });
    const data = response.data?.data || response.data;
    // Garantir que data seja sempre um array
    if (data && typeof data === 'object' && 'data' in data) {
      return {
        ...data,
        data: Array.isArray(data.data) ? data.data : []
      };
    }
    return {
      data: Array.isArray(data) ? data : [],
      total: data?.total || 0,
      page: data?.page || 1,
      limit: data?.limit || 10
    };
  },

  getById: async (id: number): Promise<PlaylistItem> => {
    const response = await api.get(`/playlists/${id}`);
    return response.data;
  },

  create: async (data: CreatePlaylistRequest): Promise<PlaylistItem> => {
    // Remover campos undefined para evitar problemas de validação no backend
    const cleanData: any = {
      name: data.name,
    };
    if (data.description !== undefined && data.description !== null && data.description !== '') {
      cleanData.description = data.description;
    }
    if (data.subscriberId !== undefined && data.subscriberId !== null) {
      cleanData.subscriberId = data.subscriberId;
      // compatibilidade (backend aceita clientId também)
      cleanData.clientId = data.subscriberId;
    } else if (data.clientId !== undefined && data.clientId !== null) {
      cleanData.clientId = data.clientId;
      cleanData.subscriberId = data.clientId;
    }
    const response = await api.post('/playlists', cleanData);
    return response.data;
  },

  update: async (id: number, data: UpdatePlaylistRequest): Promise<PlaylistItem> => {
    const response = await api.put(`/playlists/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/playlists/${id}`);
  },

  getMedia: async (playlistId: number): Promise<PlaylistMediaItem[]> => {
    const response = await api.get(`/playlists/${playlistId}/media`);
    return response.data;
  },

  addMedia: async (playlistId: number, mediaId: number, orderIndex?: number, duration?: number): Promise<void> => {
    await api.post(`/playlists/${playlistId}/media`, { mediaId, orderIndex, duration });
  },

  removeMedia: async (playlistId: number, itemId: number): Promise<void> => {
    await api.delete(`/playlists/${playlistId}/media/${itemId}`);
  },

  updateItemDuration: async (playlistId: number, itemId: number, duration: number): Promise<void> => {
    await api.patch(`/playlists/${playlistId}/media/${itemId}`, { duration });
  },

  reorderMedia: async (playlistId: number, items: { itemId: number; orderIndex: number }[]): Promise<void> => {
    await api.put(`/playlists/${playlistId}/reorder`, { items });
  },

  getCampaigns: async (playlistId: number): Promise<PlaylistCampaignInfo[]> => {
    const response = await api.get(`/playlists/${playlistId}/campaigns`);
    return response.data?.data || [];
  },

  getExposure: async (playlistId: number): Promise<PlaylistExposureResponse> => {
    const response = await api.get(`/playlists/${playlistId}/exposure`);
    return response.data;
  },
};

// =============================================
// MEDIA API
// =============================================

export interface MediaItem {
  // IDs
  media_id: number;
  id?: number; // Alias para media_id
  subscriberId: number; // FK para subscribers
  
  // Dados do subscriber
  subscriberName?: string;
  subscriberEmail?: string;
  subscriberPhone?: string;
  subscriberAddress?: string;
  subscriberIsActive?: boolean;
  
  // Dados da mídia
  name: string;
  description?: string;
  tags?: string[]; // TEXT[] array
  
  // Arquivo
  file_path: string;
  fileName?: string; // Nome do arquivo original
  fileSizeBytes?: number; // BIGINT
  size_bytes?: number; // Alias para fileSizeBytes
  
  // Tipo e metadados
  media_type: string; // video, image, html, widget, iframe, audio, pdf
  mime_type?: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
  
  // URLs
  thumbnailUrl?: string;
  previewUrl?: string;
  downloadUrl?: string;
  
  // Status e aprovação
  status: string; // draft, pending_approval, approved, rejected, archived
  approvalStatus?: string; // pending, approved, rejected
  rejectionReason?: string;
  approvedBy?: number;
  approvedByName?: string;
  approvedAt?: string;
  
  // Metadados
  metadata?: any; // JSONB
  isActive?: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Compatibilidade (campos antigos)
  title?: string; // Deprecated - usar name
  clientId?: number; // Deprecated - usar subscriberId
  clientName?: string; // Deprecated - usar subscriberName
}

export interface CreateMediaRequest {
  name: string;
  description?: string;
  tags?: string[];
  subscriberId?: number; // FK para subscribers (obrigatório se não for admin)
  // Deprecated
  clientId?: number; // Alias para subscriberId (compatibilidade)
  title?: string; // Deprecated - usar name
}

export interface UpdateMediaRequest {
  name?: string;
  description?: string;
  tags?: string[];
  status?: string; // draft, pending_approval, approved, rejected, archived
  approvalStatus?: string; // pending, approved, rejected
  rejectionReason?: string;
  // Deprecated
  title?: string; // Deprecated - usar name
}

export interface MediaListResponse {
  data: MediaItem[];
  total: number;
  page: number;
  limit: number;
}

export const mediaApi = {
  getAll: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    mediaType?: string;
    subscriberId?: number;
    clientId?: number; // Deprecated - usar subscriberId
  } = {}): Promise<MediaListResponse> => {
    // Converter clientId para subscriberId se fornecido
    const apiParams: any = { ...params };
    if (apiParams.clientId && !apiParams.subscriberId) {
      apiParams.subscriberId = apiParams.clientId;
      delete apiParams.clientId;
    }
    
    const response = await api.get('/media', { params: apiParams });
    const backendData = response.data;
    
    // Backend retorna { media: [...], total, page, limit }
    // Frontend espera { data: [...], total, page, limit }
    let mediaArray: any[] = [];
    
    if (backendData && typeof backendData === 'object') {
      // Se tem 'media', usar 'media' como 'data'
      if ('media' in backendData && Array.isArray(backendData.media)) {
        mediaArray = backendData.media;
      }
      // Se tem 'data', usar 'data'
      else if ('data' in backendData && Array.isArray(backendData.data)) {
        mediaArray = backendData.data;
      }
      // Se é array direto
      else if (Array.isArray(backendData)) {
        mediaArray = backendData;
      }
    }
    
    // Mapear campos do backend para o formato esperado pelo frontend
    const mappedMedia = mediaArray.map((item: any) => {
      // Debug removido: evitar poluir console em produção/dev
      
      // Construir URL do arquivo se necessário
      let filePath = item.file_path || item.filePath || '';
      if (filePath && !filePath.startsWith('/assets/') && !filePath.startsWith('http')) {
        // Converter caminho absoluto para URL relativa
        filePath = filePath.replace('/opt/smart-signage/public/assets/', '/assets/');
      }
      
      const mediaId = item.media_id ?? item.id;
      const baseUrl = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) ? String(process.env.REACT_APP_API_URL).replace(/\/$/, '') : '';
      // Preferir sempre a API de thumbnail quando temos media_id (evita 404 em /assets/uploads quando Nginx não faz proxy)
      const apiThumbnailUrl = mediaId ? `${baseUrl}/api/media/${mediaId}/thumbnail` : null;
      
      let thumbnailUrl = apiThumbnailUrl || item.thumbnailUrl || item.thumbnail_url || item.thumbnailUrlComputed;
      if (!thumbnailUrl && filePath) {
        if (item.media_type === 'image' || item.mediaType === 'image') {
          thumbnailUrl = filePath;
        } else if (item.media_type === 'video' || item.mediaType === 'video') {
          thumbnailUrl = filePath;
        }
      }
      
      return {
        // IDs
        media_id: item.media_id || item.id,
        id: item.id || item.media_id,
        subscriberId: item.subscriberId || item.subscriber_id,
        
        // Dados do subscriber
        subscriberName: item.subscriberName || item.subscribername,
        subscriberEmail: item.subscriberEmail || item.subscriberemail,
        subscriberPhone: item.subscriberPhone || item.subscriberphone,
        subscriberAddress: item.subscriberAddress || item.subscriberaddress,
        subscriberIsActive: item.subscriberIsActive !== undefined ? item.subscriberIsActive : (item.subscriberisactive !== undefined ? item.subscriberisactive : true),
        
        // Dados da mídia
        name: item.name || '',
        description: item.description,
        tags: item.tags || [],
        
        // Arquivo
        file_path: filePath,
        fileName: item.fileName || item.filename,
        fileSizeBytes: item.fileSizeBytes || item.filesizebytes,
        size_bytes: item.size_bytes || item.sizeBytes || item.fileSizeBytes || (item.size || 0),
        
        // Tipo e metadados
        media_type: item.media_type || item.mediaType || 'video',
        mime_type: item.mime_type || item.mimeType || '',
        duration_seconds: item.duration_seconds || item.durationSeconds || null,
        width: item.width,
        height: item.height,
        
        // URLs
        thumbnailUrl: thumbnailUrl,
        previewUrl: item.previewUrl || item.preview_url || thumbnailUrl,
        downloadUrl: item.downloadUrl || item.download_url || filePath,
        
        // Status e aprovação
        status: item.status || 'draft',
        approvalStatus: item.approvalStatus || item.approvalstatus,
        rejectionReason: item.rejectionReason || item.rejectionreason,
        approvedBy: item.approvedBy || item.approvedby,
        approvedByName: item.approvedByName || item.approvedbyname,
        approvedAt: item.approvedAt || item.approvedat,
        
        // Metadados
        metadata: item.metadata,
        isActive: item.isActive !== undefined ? item.isActive : (item.isactive !== undefined ? item.isactive : true),
        
        // Timestamps
        created_at: item.created_at || item.createdAt || new Date().toISOString(),
        updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
        
        // Compatibilidade (campos antigos)
        title: item.title || item.name, // Deprecated
        clientId: item.subscriberId || item.subscriber_id, // Deprecated
        clientName: item.subscriberName || item.subscribername, // Deprecated
      } as MediaItem;
    });
    
    return {
      data: mappedMedia,
      total: backendData?.total || mappedMedia.length,
      page: backendData?.page || 1,
      limit: backendData?.limit || 10
    };
  },

  getById: async (id: number): Promise<MediaItem> => {
    const response = await api.get(`/media/${id}`);
    return response.data;
  },

  upload: async (file: File, data: CreateMediaRequest): Promise<MediaItem> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    if (data.tags) {
      // Se tags é array, converter para string separada por vírgulas
      const tagsStr = Array.isArray(data.tags) ? data.tags.join(',') : String(data.tags);
      formData.append('tags', tagsStr);
    }
    // Usar subscriberId (ou clientId como fallback para compatibilidade)
    const subscriberId = data.subscriberId || data.clientId;
    if (subscriberId) {
      formData.append('subscriberId', subscriberId.toString());
    }
    // Deprecated - manter para compatibilidade
    if (data.title) formData.append('name', data.title); // title não existe mais, usar name

    // Não definir Content-Type manualmente - axios detecta FormData e adiciona boundary automaticamente
    const response = await api.post('/media/upload', formData);
    // Backend retorna { success: true, data: media } ou apenas media diretamente
    return response.data.data || response.data;
  },

  update: async (id: number, data: UpdateMediaRequest): Promise<MediaItem> => {
    const response = await api.put(`/media/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/media/${id}`);
  },

  /**
   * Busca thumbnail como Blob usando Authorization header (necessário porque <img src> não envia Bearer token).
   */
  getThumbnailBlob: async (id: number): Promise<Blob> => {
    const response = await api.get(`/media/${id}/thumbnail`, { responseType: 'blob' });
    return response.data as Blob;
  },

  /** Arquivo original (com Authorization); para preview em <video> com Blob URL. */
  getFileBlob: async (id: number): Promise<Blob> => {
    const response = await api.get(`/media/${id}/download`, { responseType: 'blob' });
    return response.data as Blob;
  },
};

// =============================================
// AUTH API
// =============================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token?: string;
  refreshToken?: string;
  user?: User;
  requiresTwoFactor?: boolean;
  success?: boolean;
  error?: string;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  refreshToken: async (refreshToken: string): Promise<{ token: string; refreshToken: string }> => {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ success: boolean; message?: string }> => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (payload: { token: string; password: string }): Promise<{ success: boolean; message?: string }> => {
    const response = await api.post('/auth/reset-password', payload);
    return response.data;
  },

  updateProfile: async (token: string, profileData: { name?: string; email?: string }): Promise<{ data: User }> => {
    const response = await api.put('/auth/profile', profileData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response;
  },

  changePassword: async (token: string, passwordData: { currentPassword: string; newPassword: string }): Promise<{ data: { success: boolean; message?: string } }> => {
    const response = await api.post('/auth/change-password', passwordData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response;
  },
};

// =============================================
// CAMPAIGNS API
// =============================================

export interface Campaign {
  campaign_id: number;
  title: string;
  category_segment?: string;
  categorySegment?: string;
  description?: string;
  campaign_type: string;
  status: string;
  subscriber_id?: number; // client_id deprecated
  contract_id?: number; // ⭐ NOVO: Contrato vinculado
  contractId?: number; // espelho camelCase (API getById)
  priority?: number;
  commercial_tier?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  days_of_week?: string[];
  timezone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  playlist_count?: number;
  totem_count?: number;
  playlistIds?: number[];
  playlistNames?: string[];
  mediaIds?: number[];
  mediaNames?: string[];
  // Dados do contrato (quando disponível)
  contract_number?: string;
  contract_title?: string;
  plan_name?: string;
}

export interface CreateCampaignRequest {
  title: string;
  categorySegment?: string;
  category_segment?: string;
  description?: string;
  campaign_type?: string;
  status?: string;
  clientId?: number;
  subscriberId?: number;
  contractId?: number; // ⭐ NOVO: Contrato vinculado (opcional, mas recomendado)
  priority?: number;
  commercial_tier?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  days_of_week?: string[];
  timezone?: string;
  playlistIds?: number[];
  totemIds?: number[];
  publisherIds?: number[];
  mediaIds?: number[];
}

export interface UpdateCampaignRequest {
  title?: string;
  categorySegment?: string;
  category_segment?: string;
  description?: string;
  campaign_type?: string;
  status?: string;
  clientId?: number;
  subscriberId?: number;
  contractId?: number; // ⭐ NOVO: Contrato vinculado
  priority?: number;
  commercial_tier?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  days_of_week?: string[];
  timezone?: string;
  isActive?: boolean;
  playlistIds?: number[];
  publisherIds?: number[];
  mediaIds?: number[];
  totemIds?: number[];
}

export interface CampaignListResponse {
  data: Campaign[];
  total: number;
  page: number;
  limit: number;
}

export const campaignApi = {
  getAll: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    subscriberId?: number; // NOVO: Use subscriberId
    clientId?: number; // DEPRECATED: Mantido para compatibilidade
    status?: string;
    campaignType?: string;
    isActive?: boolean;
  } = {}): Promise<Campaign[]> => {
    // Converter clientId para subscriberId se fornecido
    const apiParams: any = { ...params };
    if (apiParams.clientId && !apiParams.subscriberId) {
      apiParams.subscriberId = apiParams.clientId;
      delete apiParams.clientId;
    }
    
    console.log('[CampaignAPI] getAll chamado com params:', apiParams);
    const response = await api.get('/campaigns', { params: apiParams });
    console.log('[CampaignAPI] Resposta completa da API:', {
      status: response.status,
      data: response.data,
      dataData: response.data?.data,
      isArray: Array.isArray(response.data?.data),
    });
    
    // Backend retorna { success: true, data: Campaign[], meta: {...} }
    // response.data.data é o array Campaign[]
    const campaignsArray = Array.isArray(response.data?.data) ? response.data.data : [];
    
    // NORMALIZAÇÃO DEFINITIVA: garantir que TODAS as campanhas têm campaign_id e contract_id
    const normalized = campaignsArray.map((c: any, idx: number) => {
      const campaignId = c.campaign_id || c.id;
      const contractId = c.contract_id || c.contractId;
      
      const normalizedCampaign: Campaign = {
        ...c,
        campaign_id: campaignId, // SEMPRE definir campaign_id
        contract_id: contractId, // SEMPRE definir contract_id
      };
      
      if (idx < 2) {
        console.log(`[CampaignAPI] Normalizando campanha ${idx}:`, {
          original: c,
          normalized: normalizedCampaign,
          campaignId,
          contractId,
          originalKeys: Object.keys(c),
        });
      }
      
      if (!normalizedCampaign.campaign_id) {
        console.error(`[CampaignAPI] ERRO: Campanha ${idx} sem ID após normalização!`, {
          original: c,
          normalized: normalizedCampaign,
          allKeys: Object.keys(c),
        });
      }
      
      return normalizedCampaign;
    }).filter((c: Campaign) => !!c.campaign_id); // FILTRAR campanhas sem ID
    
    console.log('[CampaignAPI] Campanhas normalizadas:', {
      totalRecebidas: campaignsArray.length,
      totalNormalizadas: normalized.length,
      sample: normalized[0] ? {
        campaign_id: normalized[0].campaign_id,
        contract_id: normalized[0].contract_id,
        title: normalized[0].title,
      } : null,
    });
    
    return normalized;
  },

  getById: async (id: number): Promise<Campaign> => {
    const response = await api.get(`/campaigns/${id}`);
    return response.data.data;
  },

  create: async (data: CreateCampaignRequest): Promise<Campaign> => {
    // REMOVER campos undefined do payload antes de enviar
    const cleanData: any = {};
    Object.keys(data).forEach(key => {
      if ((data as any)[key] !== undefined) {
        cleanData[key] = (data as any)[key];
      }
    });
    // PADRÃO DE COMPATIBILIDADE: garantir que enviamos ambos os formatos (snake_case + camelCase)
    if (cleanData.contractId !== undefined && cleanData.contract_id === undefined) {
      cleanData.contract_id = cleanData.contractId;
    }
    if (cleanData.contract_id !== undefined && cleanData.contractId === undefined) {
      cleanData.contractId = cleanData.contract_id;
    }
    
    console.log('[CampaignAPI] create RECEBIDO (payload original):', {
      data,
      contractId: data.contractId,
      contractIdType: typeof data.contractId,
      contractIdIsUndefined: data.contractId === undefined,
      contractIdIsNull: data.contractId === null,
      contractIdIsZero: data.contractId === 0,
      subscriberId: data.subscriberId,
      allKeys: Object.keys(data),
      undefinedFields: Object.keys(data).filter(k => (data as any)[k] === undefined),
    });
    
    console.log('[CampaignAPI] create PAYLOAD LIMPO (enviando ao backend):', {
      cleanData,
      contractId: cleanData.contractId,
      contractIdType: typeof cleanData.contractId,
      contractIdIsUndefined: cleanData.contractId === undefined,
      hasContractId: 'contractId' in cleanData,
      subscriberId: cleanData.subscriberId,
      allKeys: Object.keys(cleanData),
      payloadStringified: JSON.stringify(cleanData),
    });
    
    const response = await api.post('/campaigns', cleanData);
    
    console.log('[CampaignAPI] create RESPOSTA RAW:', {
      status: response.status,
      responseData: response.data,
      campaignData: response.data?.data,
      contractIdCamel: response.data?.data?.contractId,
      contractIdSnake: response.data?.data?.contract_id,
      allCampaignKeys: response.data?.data ? Object.keys(response.data.data) : [],
    });
    
    // Normalizar resposta: garantir que contract_id sempre existe
    const campaign = response.data.data;
    const normalizedCampaign: Campaign = {
      ...campaign,
      campaign_id: campaign.campaign_id || campaign.id,
      contract_id: campaign.contract_id || campaign.contractId,
    };
    // Garantir campos espelhados para compatibilidade (ambos sempre presentes)
    (normalizedCampaign as any).contractId = normalizedCampaign.contract_id;
    (normalizedCampaign as any).id = normalizedCampaign.campaign_id;
    
    console.log('[CampaignAPI] create RESPOSTA NORMALIZADA:', {
      normalizedCampaign,
      contract_id: normalizedCampaign.contract_id,
      contractId: (normalizedCampaign as any).contractId,
      campaign_id: normalizedCampaign.campaign_id,
      id: (normalizedCampaign as any).id,
    });
    
    return normalizedCampaign;
  },

  update: async (id: number, data: UpdateCampaignRequest): Promise<Campaign> => {
    // VALIDAÇÃO ABSOLUTA DEFINITIVA: nunca aceitar undefined/null/0/NaN
    console.log('[CampaignAPI] update RECEBIDO:', { 
      id, 
      idType: typeof id,
      isUndefined: id === undefined,
      isNull: id === null,
      isNaN: isNaN(id),
      isInteger: Number.isInteger(id),
      value: id,
      data,
    });
    
    // Verificar TODAS as condições possíveis
    if (id === undefined || id === null || isNaN(id) || !Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
      const errorMsg = `[CampaignAPI] ERRO CRÍTICO: Tentando UPDATE com ID inválido. ID recebido: ${id} (tipo: ${typeof id})`;
      console.error(errorMsg, { 
        id, 
        idType: typeof id,
        isUndefined: id === undefined,
        isNull: id === null,
        isNaN: isNaN(id),
        isFinite: Number.isFinite(id),
        isInteger: Number.isInteger(id),
        value: id,
        data,
      });
      throw new Error(errorMsg);
    }
    
    // Converter para número inteiro para garantir
    const finalId = Math.floor(Number(id));
    if (finalId <= 0 || !Number.isInteger(finalId)) {
      const errorMsg = `[CampaignAPI] ERRO CRÍTICO: ID convertido inválido. Original: ${id}, Convertido: ${finalId}`;
      console.error(errorMsg, { id, finalId, data });
      throw new Error(errorMsg);
    }
    
    console.log('[CampaignAPI] update APROVADO - chamando API:', { 
      originalId: id, 
      finalId,
      url: `/campaigns/${finalId}`,
      data,
    });
    // Garantir compatibilidade de nomes de campo antes de enviar (enviar ambos)
    const dataToSend = { ...data } as any;
    if (dataToSend.contractId !== undefined && dataToSend.contract_id === undefined) {
      dataToSend.contract_id = dataToSend.contractId;
    }
    if (dataToSend.contract_id !== undefined && dataToSend.contractId === undefined) {
      dataToSend.contractId = dataToSend.contract_id;
    }
    if (dataToSend.campaign_type !== undefined && dataToSend.campaignType === undefined) {
      dataToSend.campaignType = dataToSend.campaign_type;
    }
    if (dataToSend.campaignType !== undefined && dataToSend.campaign_type === undefined) {
      dataToSend.campaign_type = dataToSend.campaignType;
    }
    // Não enviar null para contractId/contract_id (omitir para o backend aceitar "sem contrato")
    if (dataToSend.contractId === null || dataToSend.contract_id === null) {
      delete dataToSend.contractId;
      delete dataToSend.contract_id;
    }
    
    const response = await api.put(`/campaigns/${finalId}`, dataToSend);
    
    // Normalizar resposta
    const campaign = response.data.data;
    return {
      ...campaign,
      campaign_id: campaign.campaign_id || campaign.id,
      contract_id: campaign.contract_id || campaign.contractId,
    };
  },

  delete: async (id: number): Promise<void> => {
    // VALIDAÇÃO ABSOLUTA DEFINITIVA: nunca aceitar undefined/null/0/NaN
    console.log('[CampaignAPI] delete RECEBIDO:', { 
      id, 
      idType: typeof id, 
      isUndefined: id === undefined,
      isNull: id === null,
      isNaN: isNaN(id),
      isInteger: Number.isInteger(id),
      value: id,
    });
    
    // Verificar TODAS as condições possíveis
    if (id === undefined || id === null || isNaN(id) || !Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
      const errorMsg = `[CampaignAPI] ERRO CRÍTICO: Tentando DELETE com ID inválido. ID recebido: ${id} (tipo: ${typeof id})`;
      console.error(errorMsg, { 
        id, 
        idType: typeof id,
        isUndefined: id === undefined,
        isNull: id === null,
        isNaN: isNaN(id),
        isFinite: Number.isFinite(id),
        isInteger: Number.isInteger(id),
        value: id,
      });
      throw new Error(errorMsg);
    }
    
    // Converter para número inteiro para garantir
    const finalId = Math.floor(Number(id));
    if (finalId <= 0 || !Number.isInteger(finalId)) {
      const errorMsg = `[CampaignAPI] ERRO CRÍTICO: ID convertido inválido. Original: ${id}, Convertido: ${finalId}`;
      console.error(errorMsg, { id, finalId });
      throw new Error(errorMsg);
    }
    
    console.log('[CampaignAPI] delete APROVADO - chamando API:', { 
      originalId: id, 
      finalId,
      url: `/campaigns/${finalId}`,
    });
    
    await api.delete(`/campaigns/${finalId}`);
  },

  getStats: async () => {
    const response = await api.get('/campaigns/stats');
    return response.data.data;
  },

  reorderMedias: async (id: number, mediaIds: number[]): Promise<void> => {
    await api.put(`/campaigns/${id}/medias/reorder`, { mediaIds });
  },

  reorderPlaylists: async (id: number, playlistIds: number[]): Promise<void> => {
    await api.put(`/campaigns/${id}/playlists/reorder`, { playlistIds });
  },
};

// =============================================
// REPORTS API
// =============================================

export interface ReportRequest {
  type: string;
  format?: 'pdf' | 'xlsx' | 'csv';
  filters?: any;
  startDate?: string;
  endDate?: string;
}

export interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: string[];
}

export const reportApi = {
  generate: async (data: ReportRequest) => {
    // Backend usa POST /reports, não /reports/generate
    const response = await api.post('/reports', data);
    return response.data;
  },

  getTypes: async (): Promise<ReportType[]> => {
    const response = await api.get('/reports/types');
    return response.data.data;
  },

  getFormats: async () => {
    const response = await api.get('/reports/formats');
    return response.data.data;
  },
};

// =============================================
// ANALYTICS API
// =============================================

export interface AnalyticsData {
  totalViews: number;
  totalDuration: number;
  averageViewDuration: number;
  uniqueViewers: number;
  viewsByDate: Array<{ date: string; views: number }>;
  viewsByMedia: Array<{ mediaId: number; mediaName: string; views: number }>;
}

export const analyticsApi = {
  getOverview: async (params?: {
    startDate?: string;
    endDate?: string;
    clientId?: number;
  }): Promise<AnalyticsData> => {
    const response = await api.get('/analytics/overview', { params });
    const payload = response.data.data;

    return {
      totalViews: payload.totalViews || 0,
      totalDuration: payload.totalDuration || 0,
      averageViewDuration: payload.averageViewDuration || 0,
      uniqueViewers: payload.uniqueViewers || 0,
      viewsByDate: Array.isArray(payload.viewingTrends)
        ? payload.viewingTrends.map((trend: any) => ({
            date: trend.date,
            views: trend.views,
          }))
        : [],
      viewsByMedia: Array.isArray(payload.mostViewedContent)
        ? payload.mostViewedContent.map((item: any) => ({
            mediaId: item.mediaId,
            mediaName: item.title,
            views: item.views,
          }))
        : [],
    };
  },

  getMediaAnalytics: async (mediaId: number) => {
    const response = await api.get(`/analytics/media/${mediaId}`);
    return response.data.data;
  },

  getCampaignAnalytics: async (campaignId: number) => {
    const response = await api.get(`/analytics/campaign/${campaignId}`);
    return response.data.data;
  },
};

// =============================================
// SETTINGS API
// =============================================

export interface SystemSetting {
  key: string;
  value: any;
  type: string;
  description?: string;
  validation?: string;
  defaultValue?: string;
  options?: any;
  isPublic?: boolean;
  isEditable?: boolean;
}

export const settingsApi = {
  getAll: async (): Promise<SystemSetting[]> => {
    const response = await api.get('/settings');
    const data = response.data.data || response.data;
    
    // Se retornar objeto com categories, extrair todas as settings
    if (data && typeof data === 'object' && 'categories' in data) {
      const categories = data.categories || [];
      return categories.flatMap((cat: any) => cat.settings || []);
    }
    
    // Se já for array, retornar diretamente
    return Array.isArray(data) ? data : [];
  },

  getPublic: async (): Promise<SystemSetting[]> => {
    const response = await api.get('/settings/public');
    return response.data.data;
  },

  update: async (key: string, value: any): Promise<SystemSetting> => {
    const response = await api.put(`/settings/${key}`, { value });
    return response.data.data;
  },

  updateMultiple: async (settings: { [key: string]: any } | Array<{ key: string; value: any }>) => {
    // Se for objeto, usar diretamente; se for array, converter
    let settingsObj: { [key: string]: any };
    if (Array.isArray(settings)) {
      settingsObj = {};
      settings.forEach(s => {
        settingsObj[s.key] = s.value;
      });
    } else {
      settingsObj = settings;
    }
    const response = await api.put('/settings', settingsObj);
    return response.data.data;
  },
};

// =============================================
// AI API
// =============================================

export interface AIModel {
  provider: string;
  models: string[];
}

export interface AIGenerateRequest {
  prompt: string;
  model?: string;
  provider?: 'ollama' | 'openai' | 'anthropic';
  temperature?: number;
  maxTokens?: number;
}

export const aiApi = {
  generate: async (data: AIGenerateRequest) => {
    const response = await api.post('/ai/generate', data);
    return response.data.data;
  },

  getModels: async (): Promise<AIModel[]> => {
    const response = await api.get('/ai/models');
    return response.data.data;
  },

  testConnection: async (provider: string) => {
    const response = await api.post('/ai/test', { provider });
    return response.data.data;
  },
};

// =============================================
// SMART PLAYLIST API
// =============================================

export interface SmartPlaylistRequest {
  name: string;
  description?: string;
  rules: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  clientId?: number;
}

export interface SmartPlaylist {
  smart_playlist_id: number;
  name: string;
  description?: string;
  rules: any;
  subscriber_id?: number; // client_id deprecated
  created_at: string;
  updated_at: string;
}

export const smartPlaylistApi = {
  create: async (data: SmartPlaylistRequest): Promise<SmartPlaylist> => {
    const response = await api.post('/smart-playlist', data);
    return response.data.data;
  },

  generate: async (data: SmartPlaylistRequest): Promise<PlaylistItem> => {
    const response = await api.post('/smart-playlist/generate', data);
    return response.data.data;
  },

  getAll: async (): Promise<SmartPlaylist[]> => {
    try {
      const response = await api.get('/smart-playlist');
      const result = response.data?.data || response.data;
      // Backend retorna { playlists: SmartPlaylist[], total, page, limit }
      if (result && typeof result === 'object' && 'playlists' in result) {
        return Array.isArray(result.playlists) ? result.playlists : [];
      }
      // Se for array direto, retornar
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Erro ao buscar smart playlists:', error);
      return [];
    }
  },

  getById: async (id: number): Promise<SmartPlaylist> => {
    const response = await api.get(`/smart-playlist/${id}`);
    return response.data.data;
  },

  update: async (id: number, data: Partial<SmartPlaylistRequest>): Promise<SmartPlaylist> => {
    const response = await api.put(`/smart-playlist/${id}`, data);
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/smart-playlist/${id}`);
  },
};

// =============================================
// TOTEMS API (alias for Players)
// =============================================

export const totemApi = {
  getAll: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    clientId?: number;
    status?: string;
  } = {}): Promise<PlayerListResponse> => {
    const response = await api.get('/totems', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Player> => {
    const response = await api.get(`/totems/${id}`);
    return response.data;
  },

  create: async (data: CreatePlayerRequest): Promise<Player> => {
    const response = await api.post('/totems', data);
    return response.data;
  },

  update: async (id: number, data: UpdatePlayerRequest): Promise<Player> => {
    const response = await api.put(`/totems/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/totems/${id}`);
  },

  approve: async (id: number, generateEncryptedConfig: boolean = false): Promise<{ success: boolean; message: string; totem: Player; encryptedConfigPath?: string }> => {
    const response = await api.put(`/totems/${id}/approve`, { generateEncryptedConfig });
    return response.data;
  },

  /**
   * Registrar heartbeat manual (útil para debug/admin)
   * body: { status: 'online'|'offline'|'error', ...optionalTelemetry }
   */
  heartbeat: async (id: number, status: 'online' | 'offline' | 'error' = 'online', payload?: Record<string, any>): Promise<any> => {
    const body = { status, ...(payload || {}) };
    const response = await api.post(`/totems/${id}/heartbeat`, body);
    return response.data;
  },

  getPending: async (params: {
    page?: number;
    limit?: number;
  } = {}): Promise<PlayerListResponse> => {
    const response = await api.get('/totems/pending', { params });
    return response.data;
  },
  
  forceOnline: async (id: number, minutes: number = 30): Promise<{ success: boolean; message: string }> => {
    const response = await api.put(`/totems/${id}/force-online`, { minutes });
    return response.data;
  },
  
  // Remote Control
  restart: async (id: number): Promise<{ success: boolean; message: string; command: any }> => {
    const response = await api.post(`/totems/${id}/restart`);
    return response.data;
  },
  
  screenshot: async (id: number): Promise<{ success: boolean; message: string; command: any }> => {
    const response = await api.post(`/totems/${id}/screenshot`);
    return response.data;
  },
  
  getCommands: async (id: number, limit?: number): Promise<{ success: boolean; data: any[] }> => {
    const response = await api.get(`/totems/${id}/commands`, { params: { limit } });
    return response.data;
  },
  
  getScreenshots: async (id: number, limit?: number): Promise<{ success: boolean; data: any[] }> => {
    const response = await api.get(`/totems/${id}/screenshots`, { params: { limit } });
    return response.data;
  },
  
  downloadScreenshot: async (id: number, screenshotId: number): Promise<Blob> => {
    const response = await api.get(`/totems/${id}/screenshots/${screenshotId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },
  
  // Logs
  getLogs: async (id: number, filters?: {
    level?: 'info' | 'warn' | 'error' | 'debug';
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
  }): Promise<{ success: boolean; data: any[]; count: number }> => {
    const response = await api.get(`/totems/${id}/logs`, { params: filters });
    return response.data;
  },
  
  downloadLogs: async (id: number, filters?: {
    level?: 'info' | 'warn' | 'error' | 'debug';
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<Blob> => {
    const response = await api.get(`/totems/${id}/logs/download`, {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  },
};

// =============================================
// TOTEM PLAYLIST API (Playlists Geradas por Totem)
// =============================================

export interface TotemPlaylistItem {
  item_id?: number;
  media_id: number;
  campaign_id?: number;
  subscriber_id: number;
  publisher_id: number;
  order_index: number;
  priority: number;
  display_seconds?: number;
  transition_type?: string;
  transition_duration_ms?: number;
  commercial_tier?: 'premium' | 'standard' | 'remnant';
  time_share_percent?: number;
  revenue_share_percent?: number;
  start_time?: string;
  end_time?: string;
  days_of_week?: string;
  is_active: boolean;
}

export interface TotemPlaylist {
  totem_playlist_id?: number;
  totem_id: number;
  smart_tv_id?: number;
  publisher_id: number;
  playlist_hash?: string;
  version: number;
  total_items: number;
  total_duration_seconds: number;
  status: 'active' | 'paused' | 'invalidated';
  is_active: boolean;
  generated_at?: Date;
  last_updated_at?: Date;
  expires_at?: Date;
  metadata?: any;
  generation_log?: any;
  items: TotemPlaylistItem[];
  totem_name?: string;
  publisher_name?: string;
}

export interface TotemPlaylistListItem {
  totem_playlist_id: number;
  totem_id: number;
  totem_name?: string;
  publisher_id: number;
  publisher_name?: string;
  version: number;
  total_items: number;
  total_duration_seconds: number;
  status: string;
  generated_at: Date;
  last_updated_at: Date;
}

export interface TotemPlaylistListResponse {
  data: TotemPlaylistListItem[];
  total: number;
  page: number;
  limit: number;
}

export const totemPlaylistApi = {
  getAll: async (params?: {
    publisherId?: number;
    totemId?: number;
    page?: number;
    limit?: number;
  }): Promise<TotemPlaylistListResponse> => {
    const response = await api.get('/playlist-engine/totem-playlists', { params });
    return {
      data: response.data.data || [],
      total: response.data.total || 0,
      page: response.data.page || 1,
      limit: response.data.limit || 50
    };
  },

  getByTotemId: async (totemId: number, smartTvId?: number): Promise<TotemPlaylist> => {
    const params = smartTvId ? { smartTvId } : undefined;
    const response = await api.get(`/playlist-engine/totem/${totemId}`, { params });
    return response.data.data;
  },

  regenerate: async (totemId: number, smartTvId?: number, force?: boolean): Promise<any> => {
    const response = await api.post(`/playlist-engine/totem/${totemId}/regenerate`, {
      smartTvId,
      force
    });
    return response.data;
  },
};

// =============================================
// OTA UPDATES API
// =============================================

export interface OTAUpdate {
  id: number;
  version: string;
  platform: 'webos' | 'tizen' | 'android' | 'linux' | 'windows' | 'all';
  filePath: string;
  fileSize: number;
  checksum: string;
  description?: string;
  changelog?: string;
  isMandatory: boolean;
  minVersion?: string;
  maxVersion?: string;
  rolloutPercentage: number;
  status: 'draft' | 'testing' | 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: string;
  releasedAt?: string;
}

export const otaApi = {
  getAll: async (filters?: {
    platform?: string;
    status?: string;
    limit?: number;
  }): Promise<{ success: boolean; data: OTAUpdate[] }> => {
    const response = await api.get('/ota-updates', { params: filters });
    return response.data;
  },

  create: async (formData: FormData): Promise<{ success: boolean; message: string; data: OTAUpdate }> => {
    const response = await api.post('/ota-updates', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  activate: async (id: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/ota-updates/${id}/activate`);
    return response.data;
  },

  pause: async (id: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/ota-updates/${id}/pause`);
    return response.data;
  },

  getStats: async (): Promise<{ success: boolean; data: any }> => {
    const response = await api.get('/ota-updates/stats');
    return response.data;
  },

  download: async (id: number): Promise<Blob> => {
    const response = await api.get(`/ota-updates/${id}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },
};

// =============================================
// TAGS API
// =============================================

export interface Tag {
  id: number;
  tagId: string;
  tagType: 'rfid' | 'nfc' | 'qr_code' | 'barcode';
  name?: string;
  description?: string;
  contentId?: number;
  isActive: boolean;
}

export const tagApi = {
  getContent: async (tagId: string): Promise<{ success: boolean; data: { contentId: number | null; tag: Tag | null } }> => {
    const response = await api.get(`/tags/${tagId}/content`);
    return response.data;
  },

  getAll: async (filters?: {
    tagType?: string;
    isActive?: boolean;
    limit?: number;
  }): Promise<{ success: boolean; data: Tag[] }> => {
    const response = await api.get('/tags', { params: filters });
    return response.data;
  },

  create: async (data: {
    tagId: string;
    tagType: 'rfid' | 'nfc' | 'qr_code' | 'barcode';
    name?: string;
    description?: string;
    contentId?: number;
  }): Promise<{ success: boolean; message: string; data: Tag }> => {
    const response = await api.post('/tags', data);
    return response.data;
  },

  deactivate: async (tagId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/tags/${tagId}`);
    return response.data;
  },
};

// =============================================
// FACIAL RECOGNITION API
// =============================================

export interface RecognizedPerson {
  id: number;
  personId: string;
  name?: string;
  features?: any;
  contentId?: number;
  isActive: boolean;
}

export interface FacialMatchResponse {
  personId?: string;
  contentId?: number;
  confidence?: number;
  name?: string;
}

export const facialRecognitionApi = {
  match: async (features: any, totemId?: number): Promise<{ success: boolean; data: FacialMatchResponse | null }> => {
    const response = await api.post('/facial-recognition/match', { features, totemId });
    return response.data;
  },

  getAllPersons: async (filters?: {
    isActive?: boolean;
    limit?: number;
  }): Promise<{ success: boolean; data: RecognizedPerson[] }> => {
    const response = await api.get('/facial-recognition/persons', { params: filters });
    return response.data;
  },

  createPerson: async (data: {
    personId: string;
    name?: string;
    features?: any;
    contentId?: number;
  }): Promise<{ success: boolean; message: string; data: RecognizedPerson }> => {
    const response = await api.post('/facial-recognition/persons', data);
    return response.data;
  },
};

// =============================================
// NETWORK API
// =============================================

export const networkApi = {
  getRelatedContent: async (interaction: any, totemId: number): Promise<{ success: boolean; data: { contentId: number | null } }> => {
    const response = await api.post('/network/related-content', { interaction, totemId });
    return response.data;
  },

  getNearbyTotems: async (totemId: number, radius?: number): Promise<{ success: boolean; data: any[] }> => {
    const response = await api.get(`/network/nearby-totems/${totemId}`, { params: { radius } });
    return response.data;
  },

  logInteraction: async (data: {
    totemId: number;
    interactionType: 'facial_recognition' | 'tag_id' | 'touch' | 'gesture';
    interactionData?: any;
    contentId?: number;
    personId?: string;
    tagId?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/network/interactions', data);
    return response.data;
  },
};

// =============================================
// PLANS API
// =============================================

export interface Plan {
  plan_id?: number;
  planId: number; // Backend retorna como planId
  name: string;
  slug: string;
  description?: string;
  price_monthly: number;
  priceMonthly: number; // Backend retorna como priceMonthly
  price_yearly?: number;
  priceYearly?: number; // Backend retorna como priceYearly
  currency: string;
  billing_interval: 'month' | 'year';
  billingInterval: string; // Backend retorna como billingInterval
  stripe_price_id_monthly?: string;
  stripePriceIdMonthly?: string; // Backend retorna como stripePriceIdMonthly
  stripe_price_id_yearly?: string;
  stripePriceIdYearly?: string; // Backend retorna como stripePriceIdYearly
  stripe_product_id?: string;
  stripeProductId?: string; // Backend retorna como stripeProductId
  features: any; // JSONB - objeto ou array
  limits: any; // JSONB - objeto com limites
  is_active: boolean;
  isActive: boolean; // Backend retorna como isActive
  is_popular: boolean;
  isPopular: boolean; // Backend retorna como isPopular
  is_default?: boolean;
  isDefault?: boolean; // Backend retorna como isDefault (plano padrão)
  sort_order: number;
  sortOrder: number; // Backend retorna como sortOrder
  created_at: string;
  createdAt: string; // Backend retorna como createdAt
  updated_at: string;
  updatedAt: string; // Backend retorna como updatedAt
}

export interface CreatePlanRequest {
  name: string;
  slug: string;
  description?: string;
  priceMonthly: number;
  priceYearly?: number;
  currency?: string;
  billingInterval?: string;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  stripeProductId?: string;
  features?: any;
  limits?: any;
  isActive?: boolean;
  isPopular?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface UpdatePlanRequest {
  name?: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  features?: any;
  limits?: any;
  isActive?: boolean;
  isPopular?: boolean;
  sortOrder?: number;
}

export const planApi = {
  getAll: async (includeInactive: boolean = false): Promise<Plan[]> => {
    const endpoint = includeInactive ? '/plans/all' : '/plans';
    const response = await api.get(endpoint);
    return response.data.data || [];
  },

  getById: async (id: number): Promise<Plan> => {
    const response = await api.get(`/plans/${id}`);
    return response.data.data;
  },

  getBySlug: async (slug: string): Promise<Plan> => {
    const response = await api.get(`/plans/slug/${slug}`);
    return response.data.data;
  },

  getDefault: async (): Promise<Plan | null> => {
    try {
      const response = await api.get('/plans/default');
      return response.data?.data ?? null;
    } catch {
      return null;
    }
  },

  create: async (data: CreatePlanRequest): Promise<Plan> => {
    const response = await api.post('/plans', data);
    return response.data.data;
  },

  update: async (id: number, data: UpdatePlanRequest): Promise<Plan> => {
    const response = await api.put(`/plans/${id}`, data);
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/plans/${id}`);
  },
};

// =============================================
// SUBSCRIPTIONS API
// =============================================

export interface Subscription {
  subscription_id: number;
  client_id: number;
  plan_id: number;
  stripe_subscription_id?: string;
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid' | 'trialing';
  start_date: string;
  end_date?: string;
  current_period_start: string;
  current_period_end: string;
  trial_start?: string;
  trial_end?: string;
  billing_interval: 'month' | 'year';
  amount: number;
  currency: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  plan?: Plan;
}

export interface CreateSubscriptionRequest {
  planId: number;
  clientId?: number;
  trialDays?: number;
}

export interface UpdateSubscriptionRequest {
  planId?: number;
  status?: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export const subscriptionApi = {
  getAll: async (params?: {
    clientId?: number;
    planId?: number;
    status?: string;
  }): Promise<Subscription[]> => {
    const response = await api.get('/subscriptions', { params });
    return response.data.data || [];
  },

  getById: async (id: number): Promise<Subscription> => {
    const response = await api.get(`/subscriptions/${id}`);
    return response.data.data;
  },

  getByClient: async (clientId: number): Promise<Subscription[]> => {
    const response = await api.get('/subscriptions', { params: { clientId } });
    return response.data.data || [];
  },

  create: async (data: CreateSubscriptionRequest): Promise<CheckoutSessionResponse> => {
    const response = await api.post('/subscriptions', data);
    return response.data.data;
  },

  update: async (id: number, data: UpdateSubscriptionRequest): Promise<Subscription> => {
    const response = await api.put(`/subscriptions/${id}`, data);
    return response.data.data;
  },

  cancel: async (id: number): Promise<Subscription> => {
    const response = await api.post(`/subscriptions/${id}/cancel`);
    return response.data.data;
  },

  resume: async (id: number): Promise<Subscription> => {
    const response = await api.post(`/subscriptions/${id}/resume`);
    return response.data.data;
  },

  handleWebhook: async (payload: any, signature: string): Promise<any> => {
    const response = await api.post('/subscriptions/webhook', payload, {
      headers: {
        'stripe-signature': signature,
      },
    });
    return response.data;
  },
};

// =============================================
// BILLING API
// =============================================

export interface BillingItem {
  billing_id: number;
  billing_type: string;
  amount: number;
  status: string;
  subscriber_id?: number; // client_id deprecated
  due_date?: string;
  paid_at?: string;
  created_at: string;
}

export interface CreateBillingRequest {
  billing_type: string;
  amount: number;
  clientId?: number;
  due_date?: string;
}

export const billingApi = {
  getAll: async (params?: {
    clientId?: number;
    status?: string;
  }): Promise<BillingItem[]> => {
    try {
      const response = await api.get('/billing', { params });
      // Backend retorna { success: true, data: result }
      // onde result tem { billings: BillingItem[], total, page, limit }
      const result = response.data?.data || response.data;
      if (result && typeof result === 'object' && 'billings' in result) {
        return Array.isArray(result.billings) ? result.billings : [];
      }
      // Se for array direto, retornar
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Erro ao buscar faturas:', error);
      return [];
    }
  },

  create: async (data: CreateBillingRequest): Promise<BillingItem> => {
    const response = await api.post('/billing', data);
    return response.data.data;
  },

  markAsPaid: async (id: number): Promise<BillingItem> => {
    const response = await api.put(`/billing/${id}/pay`);
    return response.data.data;
  },
};

// =============================================
// QR CODES API
// =============================================

export interface QRCode {
  qr_code_id: number;
  name: string;
  url: string;
  qr_code_data: string;
  created_at: string;
}

export interface CreateQRCodeRequest {
  name: string;
  url: string;
}

export const qrCodeApi = {
  getAll: async (): Promise<QRCode[]> => {
    const response = await api.get('/qr-codes');
    const data = response.data?.data || response.data;
    // Garantir que sempre retorne um array
    return Array.isArray(data) ? data : [];
  },

  create: async (data: CreateQRCodeRequest): Promise<QRCode> => {
    const response = await api.post('/qr-codes', data);
    return response.data.data;
  },

  getById: async (id: number): Promise<QRCode> => {
    const response = await api.get(`/qr-codes/${id}`);
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/qr-codes/${id}`);
  },
};

// =============================================
// DEBUG API
// =============================================

export interface PlayerRegistrationLog {
  id: number;
  identifier: string;
  uin: string;
  status: string;
  createdAt: string;
  ipAddress: string;
  hardware: any;
}

export interface PlayerRegistrationLogsResponse {
  success: boolean;
  totems: PlayerRegistrationLog[];
  systemLogs: string[];
  count: number;
}

export interface TotemDebugInfo {
  success: boolean;
  totem: any;
}

export interface SystemInfo {
  success: boolean;
  system: {
    nodeVersion: string;
    platform: string;
    uptime: number;
    memory: any;
    env: string;
  };
  totems: {
    stats: any;
    recentRegistrations: any[];
  };
}

export const debugApi = {
  getPlayerRegistrationLogs: async (params?: {
    limit?: number;
    since?: string;
  }): Promise<PlayerRegistrationLogsResponse> => {
    const response = await api.get('/debug/player-registration-logs', { params });
    return response.data;
  },

  getTotemInfo: async (id: string | number): Promise<TotemDebugInfo> => {
    const response = await api.get(`/debug/totem/${id}`);
    return response.data;
  },

  getSystemInfo: async (): Promise<SystemInfo> => {
    const response = await api.get('/debug/system-info');
    return response.data;
  },
};

// Admin API
export const adminApi = {
  reconcilePlanPublisherAccess: async (planId?: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/subscriber-access/reconcile', planId ? { planId } : {});
    return response.data;
  }
};

// =============================================
// LOGS API
// =============================================

export interface LogRotationConfig {
  maxSize: number;
  maxSizeFormatted: string;
  maxDays: number;
  minFreeSpace: number;
  minFreeSpaceFormatted: string;
  enabled: boolean;
  compress: boolean;
  alertsEnabled: boolean;
  logDirectory: string;
}

export interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  created: string;
  modified: string;
  age: number;
}

export interface DiskSpaceInfo {
  total: number;
  totalFormatted: string;
  free: number;
  freeFormatted: string;
  used: number;
  usedFormatted: string;
  percentUsed: number;
  percentFree: string;
}

export interface RotationStatus {
  needsRotation: boolean;
  reason: string;
  details: any;
}

export interface RotationResult {
  success: boolean;
  filesRotated: number;
  filesDeleted: number;
  details: any;
}

// =============================================
// CRONSQL API
// =============================================

export type ExportProvider = 'PostgreSQL' | 'Redis' | 'Grafana' | 'Prometheus';

export interface ExportConfig {
  outputDirectory: string;
  fileName: string;
  format: 'xlsx' | 'pdf' | 'csv';
  sheetName?: string;
  applyFormatting?: boolean;
  timestampSuffix?: boolean;
}

export interface ExportQueryRecord {
  query_id: number;
  name: string;
  description: string | null;
  provider: ExportProvider;
  sql_query: string;
  database_config: Record<string, any>;
  export_config: ExportConfig;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExportScheduleRecord {
  schedule_id: number;
  name: string;
  description: string | null;
  query_id: number;
  cron_expression: string;
  enabled: boolean;
  last_execution: string | null;
  next_execution: string | null;
  execution_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExportExecutionRecord {
  execution_id: number;
  schedule_id: number | null;
  schedule_name?: string | null;
  query_id: number;
  query_name?: string | null;
  job_id: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string | null;
  completed_at: string | null;
  records_exported: number;
  file_path: string | null;
  file_size: number | null;
  error_message: string | null;
  execution_log: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

export const cronSqlApi = {
  getQueries: async (
    params: {
      provider?: ExportProvider | '';
      enabled?: 'true' | 'false';
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResponse<ExportQueryRecord>> => {
    const response = await api.get('/export-queries', { params });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
  },

  createQuery: async (payload: {
    name: string;
    description?: string;
    provider: ExportProvider;
    sqlQuery: string;
    exportConfig: ExportConfig;
    enabled?: boolean;
  }): Promise<ExportQueryRecord> => {
    const response = await api.post('/export-queries', payload);
    return response.data.data;
  },

  updateQuery: async (id: number, payload: Partial<{
    name: string;
    description?: string | null;
    provider: ExportProvider;
    sqlQuery: string;
    exportConfig: ExportConfig;
    enabled: boolean;
  }>): Promise<ExportQueryRecord> => {
    const response = await api.put(`/export-queries/${id}`, payload);
    return response.data.data;
  },

  deleteQuery: async (id: number): Promise<void> => {
    await api.delete(`/export-queries/${id}`);
  },

  validateSql: async (payload: { sql: string; provider: ExportProvider }) => {
    const response = await api.post('/export-queries/validate-sql', payload);
    return response.data.data;
  },

  testConnection: async (id: number, provider?: ExportProvider) => {
    const response = await api.post(`/export-queries/${id}/test-connection`, { provider });
    return response.data;
  },

  getSchedules: async (
    params: {
      queryId?: number;
      enabled?: 'true' | 'false';
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResponse<ExportScheduleRecord>> => {
    const response = await api.get('/export-schedules', { params });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
  },

  createSchedule: async (payload: {
    name: string;
    description?: string;
    queryId: number;
    cronExpression: string;
    enabled?: boolean;
  }): Promise<ExportScheduleRecord> => {
    const response = await api.post('/export-schedules', payload);
    return response.data.data;
  },

  updateSchedule: async (id: number, payload: Partial<{
    name: string;
    description?: string | null;
    queryId: number;
    cronExpression: string;
    enabled: boolean;
  }>): Promise<ExportScheduleRecord> => {
    const response = await api.put(`/export-schedules/${id}`, payload);
    return response.data.data;
  },

  deleteSchedule: async (id: number): Promise<void> => {
    await api.delete(`/export-schedules/${id}`);
  },

  validateCron: async (cronExpression: string) => {
    const response = await api.post('/export-schedules/validate-cron', { cronExpression });
    return response.data.data;
  },

  executeScheduleNow: async (id: number) => {
    const response = await api.post(`/export-schedules/${id}/execute-now`);
    return response.data;
  },

  getExecutions: async (
    params: {
      scheduleId?: number;
      queryId?: number;
      status?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResponse<ExportExecutionRecord>> => {
    const response = await api.get('/export-executions', { params });
    return {
      data: response.data.data || [],
      pagination: response.data.pagination
    };
  },

  downloadExecution: async (executionId: number): Promise<Blob> => {
    const response = await api.get(`/export-executions/${executionId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export const logsApi = {
  getConfig: async (): Promise<LogRotationConfig> => {
    const response = await api.get('/logs/config');
    return response.data.data;
  },

  getFiles: async (): Promise<LogFileInfo[]> => {
    const response = await api.get('/logs/files');
    return response.data.data || [];
  },

  getDiskSpace: async (): Promise<DiskSpaceInfo> => {
    const response = await api.get('/logs/disk-space');
    return response.data.data;
  },

  getRotationStatus: async (): Promise<RotationStatus> => {
    const response = await api.get('/logs/rotation-status');
    return response.data.data;
  },

  rotate: async (): Promise<RotationResult> => {
    const response = await api.post('/logs/rotate');
    return response.data;
  },

  reload: async (): Promise<void> => {
    await api.post('/logs/reload');
  },
};

// =============================================
// SMARTDISPLAYFX API
// =============================================

export interface SmartDisplayFxLog {
  id: number;
  event_type: string;
  entity_type: 'smartdisplayfx_rule' | 'smartdisplayfx_effect';
  media_id?: number;
  metadata: {
    siteId?: string;
    fromTotemId?: string;
    toTotemId?: string;
    effectId?: string;
    durationMs?: number;
    rule?: string;
    interactionType?: string;
    tagId?: string;
    segment?: string;
    attentionMs?: number;
    mood?: string;
    params?: Record<string, any>;
    [key: string]: any;
  };
  created_at: string;
}

export interface SmartDisplayFxLogsParams {
  siteId?: string;
  type?: 'rule' | 'effect';
  limit?: number;
}

export interface FxAnalyticsOverview {
  totalExecutions: number;
  successful: number;
  failed: number;
  successRate: number;
  avgFps: number;
  avgDuration: number;
  topEffects: Array<{
    effect_id: string;
    executions: number;
    avg_fps: number;
    avg_duration: number;
    success_rate: number;
  }>;
  topTotems: Array<{
    totem_id: number;
    name: string;
    executions: number;
    avg_fps: number;
    success_rate: number;
  }>;
  trends: Array<{
    date: string;
    executions: number;
    avg_fps: number;
    success_rate: number;
  }>;
}

export interface FxPerformanceMetrics {
  fpsDistribution: Array<{
    fps_range: string;
    count: number;
    percentage: number;
  }>;
  durationDistribution: Array<{
    duration_range: string;
    count: number;
    percentage: number;
  }>;
  performanceByHour: Array<{
    hour: number;
    executions: number;
    avg_fps: number;
    avg_duration: number;
  }>;
  performanceByDay: Array<{
    day_of_week: number;
    day_name: string;
    executions: number;
    avg_fps: number;
  }>;
}

export interface FxTelemetry {
  id: number;
  totem_id: number;
  effect_id: string;
  event_id?: string;
  content_id?: number;
  planned_start_ts?: string;
  actual_start_ts?: string;
  ended_at?: string;
  duration_ms?: number;
  avg_fps?: number;
  status: string;
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface FxTelemetryListResponse {
  data: FxTelemetry[];
  total: number;
  page: number;
  limit: number;
}

export const smartDisplayFxApi = {
  getLogs: async (params: SmartDisplayFxLogsParams = {}): Promise<SmartDisplayFxLog[]> => {
    const response = await api.get('/smartdisplayfx/logs', { params });
    return response.data.data || [];
  },

  triggerEffect: async (payload: {
    siteId: string;
    fromTotemId: string;
    toTotemId: string;
    effectId?: string;
    contentId?: number;
    durationMs?: number;
    params?: Record<string, any>;
  }) => {
    const response = await api.post('/smartdisplayfx/debug/trigger-effect', payload);
    return response.data;
  },

  // Analytics
  getAnalyticsOverview: async (params?: {
    site_id?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<FxAnalyticsOverview> => {
    const response = await api.get('/smartdisplayfx/analytics/overview', { params });
    return response.data;
  },

  getPerformanceMetrics: async (params?: {
    site_id?: string;
    effect_id?: string;
    totem_id?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<FxPerformanceMetrics> => {
    const response = await api.get('/smartdisplayfx/analytics/performance', { params });
    return response.data;
  },

  getSiteAnalytics: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<Array<{
    site_id: string;
    site_name: string;
    totem_count: number;
    total_executions: number;
    avg_fps: number;
    avg_duration: number;
    successful: number;
    failed: number;
    success_rate: number;
  }>> => {
    const response = await api.get('/smartdisplayfx/analytics/sites', { params });
    return response.data.data || [];
  },

  // Telemetry
  getTelemetry: async (params?: {
    page?: number;
    limit?: number;
    totem_id?: number;
    effect_id?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<FxTelemetryListResponse> => {
    const response = await api.get('/smartdisplayfx/telemetry', { params });
    return response.data;
  },

  getTelemetryStats: async (params?: {
    totem_id?: number;
    effect_id?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await api.get('/smartdisplayfx/telemetry/stats', { params });
    return response.data.data;
  },
};

// =============================================
// PUBLISHERS API
// =============================================

export interface Publisher {
  publisher_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  category_segment?: string;
  description?: string;
  is_subscriber?: boolean;
  is_publisher?: boolean;
  client_type?: 'subscriber' | 'publisher' | 'both';
  /** Status ativo: backend retorna is_active (snake_case), normalizamos para active no getAll */
  active?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePublisherRequest {
  name: string;
  contract_id?: number; // Opcional - contrato que gerou a criação do publisher (para rastreabilidade)
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  category_segment?: string;
  description?: string;
  is_subscriber?: boolean;
  is_publisher?: boolean;
  client_type?: 'subscriber' | 'publisher' | 'both';
}

export interface UpdatePublisherRequest {
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  category_segment?: string;
  description?: string;
  is_subscriber?: boolean;
  is_publisher?: boolean;
  client_type?: 'subscriber' | 'publisher' | 'both';
  /** @deprecated Use is_active - backend usa coluna is_active */
  active?: boolean;
  is_active?: boolean;
}

export interface PublisherListResponse {
  data: Publisher[];
  total: number;
  page?: number;
  limit?: number;
}

export interface PublisherStats {
  localsCount: number;
  totemsCount: number;
  smartTvsCount: number;
  activeCampaignsCount: number;
  onlineTotems?: number;
  playingTvs?: number;
}

export const publisherApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    client_type?: 'subscriber' | 'publisher' | 'both';
    active_only?: boolean;
  }): Promise<PublisherListResponse> => {
    const response = await api.get('/publishers', { params });
    const raw = response.data;
    const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
    const normalized = list.map((p: any) => ({
      ...p,
      active: p.active !== undefined ? p.active : (p.is_active !== undefined ? p.is_active : true),
    }));
    if (Array.isArray(raw)) {
      return { data: normalized, total: normalized.length } as PublisherListResponse;
    }
    return { ...raw, data: normalized } as PublisherListResponse;
  },

  getById: async (id: number): Promise<Publisher> => {
    const response = await api.get(`/publishers/${id}`);
    const p = response.data.data || response.data;
    return {
      ...p,
      active: p.active !== undefined ? p.active : (p.is_active !== undefined ? p.is_active : true),
    } as Publisher;
  },

  create: async (data: CreatePublisherRequest): Promise<Publisher> => {
    const response = await api.post('/publishers', data);
    // Backend retorna diretamente o publisher ou { data: publisher }
    return response.data.data || response.data;
  },

  update: async (id: number, data: UpdatePublisherRequest): Promise<Publisher> => {
    const response = await api.put(`/publishers/${id}`, data);
    return response.data.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/publishers/${id}`);
  },

  getLocals: async (publisherId: number): Promise<any[]> => {
    const response = await api.get(`/publishers/${publisherId}/locals`);
    return response.data.data || [];
  },

  getTotems: async (publisherId: number): Promise<any[]> => {
    const response = await api.get(`/publishers/${publisherId}/totems`);
    return response.data.data || [];
  },

  getSmartTvs: async (publisherId: number): Promise<any[]> => {
    const response = await api.get(`/publishers/${publisherId}/smart-tvs`);
    return response.data.data || [];
  },

  getStats: async (publisherId: number): Promise<any> => {
    const response = await api.get(`/publishers/${publisherId}/stats`);
    return response.data.data || response.data;
  },
};

// =============================================
// SUBSCRIBERS API
// =============================================

export interface Subscriber {
  subscriber_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  category_segment?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  contracts?: Contract[]; // Contratos do subscriber
}

export interface CreateSubscriberRequest {
  name: string;
  /** Vincular a contratos existentes. Obrigatório contract_ids OU plan_ids (pelo menos um). */
  contract_ids?: number[];
  /** Criar novos contratos com estes planos. Obrigatório contract_ids OU plan_ids (pelo menos um). */
  plan_ids?: number[];
  // Mantido para compatibilidade com versões antigas
  contract_id?: number;
  plan_id?: number;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  category_segment?: string;
  description?: string;
}

export interface UpdateSubscriberRequest {
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  category_segment?: string;
  description?: string;
  isActive?: boolean;
}

/** Payload para criar subscriber e contratos numa única chamada (procedure). contract_number gerado no banco como SUB-{id}.{seq} */
export interface CreateSubscriberWithContractsRequest {
  subscriber: CreateSubscriberRequest;
  contracts: Array<{
    title: string;
    plan_id?: number;
    contract_type?: string;
    start_date?: string;
    end_date?: string;
    total_amount?: number;
    currency?: string;
    payment_terms?: string;
    description?: string;
    [key: string]: unknown;
  }>;
}

export interface SubscriberListResponse {
  data: Subscriber[];
  total: number;
  page: number;
  limit: number;
}

export const subscriberApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    active_only?: boolean;
  }): Promise<SubscriberListResponse> => {
    const response = await api.get('/subscribers', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Subscriber> => {
    const response = await api.get(`/subscribers/${id}`);
    return response.data;
  },

  create: async (data: CreateSubscriberRequest | CreateSubscriberWithContractsRequest): Promise<Subscriber> => {
    const response = await api.post('/subscribers', data);
    return response.data;
  },

  update: async (id: number, data: UpdateSubscriberRequest): Promise<Subscriber> => {
    const response = await api.put(`/subscribers/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/subscribers/${id}`);
  },

  getLocals: async (subscriberId: number): Promise<any[]> => {
    const response = await api.get(`/subscribers/${subscriberId}/locals`);
    return response.data.data || [];
  },

  getTotems: async (subscriberId: number, opts?: { contractId?: number }): Promise<any[]> => {
    const params =
      opts?.contractId !== undefined && opts.contractId !== null
        ? { contractId: opts.contractId }
        : undefined;
    const response = await api.get(`/subscribers/${subscriberId}/totems`, { params });
    return response.data.data || [];
  },

  getSmartTvs: async (subscriberId: number): Promise<any[]> => {
    const response = await api.get(`/subscribers/${subscriberId}/smart-tvs`);
    return response.data.data || [];
  },

  getStats: async (subscriberId: number): Promise<any> => {
    const response = await api.get(`/subscribers/${subscriberId}/stats`);
    return response.data.data || {};
  },

  getContracts: async (subscriberId: number, params?: { activeOnly?: boolean }): Promise<Contract[]> => {
    const response = await api.get(`/subscribers/${subscriberId}/contracts`, {
      params: params?.activeOnly === false ? { activeOnly: 'false' } : undefined,
    });
    return response.data.data || [];
  },

  addContract: async (subscriberId: number, planId: number): Promise<Contract> => {
    const response = await api.post(`/subscribers/${subscriberId}/contracts`, { plan_id: planId });
    return response.data.data ?? response.data;
  },

  // Validações prévias
  validatePlanLimits: async (subscriberId: number, resourceType: 'media' | 'playlist' | 'campaign'): Promise<{
    valid: boolean;
    current: number;
    limit: number | null;
    remaining: number | null;
    message: string;
  }> => {
    const response = await api.get(`/subscribers/${subscriberId}/validate/plan-limits`, {
      params: { resourceType }
    });
    return response.data;
  },

  validateStorage: async (subscriberId: number, fileSizeBytes: number): Promise<{
    valid: boolean;
    currentBytes: number;
    currentGB: number;
    limitBytes: number | null;
    limitGB: number | null;
    fileSizeBytes: number;
    fileSizeGB: number;
    totalAfterUploadBytes: number;
    totalAfterUploadGB: number;
    remainingBytes: number | null;
    remainingGB: number | null;
    message: string;
  }> => {
    const response = await api.get(`/subscribers/${subscriberId}/validate/storage`, {
      params: { fileSizeBytes }
    });
    return response.data;
  },

  validateTotemAccess: async (subscriberId: number, totemId: number): Promise<{
    valid: boolean;
    message: string;
  }> => {
    const response = await api.get(`/subscribers/${subscriberId}/validate/totem-access`, {
      params: { totemId }
    });
    return response.data;
  },
};

// =============================================
// CONTRACTS API
// =============================================

export interface Contract {
  contract_id: number;
  subscriber_id?: number; // Opcional - pode ser NULL se created_before_subscriber = true
  publisher_id?: number; // Opcional - para publisher_contracts
  plan_id?: number;
  contract_number: string;
  contract_type: 'advertising' | 'subscription' | 'partnership' | 'revenue_share' | 'hybrid';
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  total_amount?: number;
  currency: string;
  payment_terms?: string;
  document_path?: string;
  document_filename?: string;
  document_mime_type?: string;
  document_size_bytes?: number;
  status: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
  signed_by_subscriber_at?: string;
  signed_by_publisher_at?: string; // Para publisher contracts
  signed_by_tenant_at?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  created_before_subscriber?: boolean; // Indica se foi criado antes do subscriber
  created_before_publisher?: boolean; // Indica se foi criado antes do publisher
  subscriber_name?: string;
  publisher_name?: string;
  plan_name?: string;
  // Publisher contract specific fields
  revenue_share_percentage?: number;
  revenue_share_rules?: any;
  minimum_payout_amount?: number;
  subscription_amount?: number;
  subscription_interval?: string;
}

export interface CreateContractRequest {
  subscriber_id?: number; // Opcional - pode ser NULL se created_before_subscriber = true
  publisher_id?: number; // Opcional - para publisher_contracts
  plan_id?: number;
  contract_number: string;
  contract_type: 'advertising' | 'subscription' | 'partnership' | 'revenue_share' | 'hybrid';
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  total_amount?: number;
  currency?: string;
  payment_terms?: string;
  document_path?: string;
  document_filename?: string;
  document_mime_type?: string;
  document_size_bytes?: number;
  status?: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
  signed_by_subscriber_at?: string;
  signed_by_publisher_at?: string;
  signed_by_tenant_at?: string;
  metadata?: any;
  publisherIds?: number[];
  created_before_subscriber?: boolean; // Indica se contrato é criado antes do subscriber
  created_before_publisher?: boolean; // Indica se contrato é criado antes do publisher
  // Publisher contract specific fields
  revenue_share_percentage?: number;
  revenue_share_rules?: any;
  minimum_payout_amount?: number;
  subscription_amount?: number;
  subscription_interval?: string;
}

export interface UpdateContractRequest {
  plan_id?: number;
  contract_number?: string;
  contract_type?: 'advertising' | 'subscription' | 'partnership' | 'revenue_share' | 'hybrid';
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  total_amount?: number;
  currency?: string;
  payment_terms?: string;
  document_path?: string;
  document_filename?: string;
  document_mime_type?: string;
  document_size_bytes?: number;
  status?: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
  signed_by_subscriber_at?: string;
  signed_by_tenant_at?: string;
  metadata?: any;
  publisherIds?: number[];
}

export interface ContractListResponse {
  data: Contract[];
  total: number;
  page: number;
  limit: number;
}

export const contractApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    subscriberId?: number;
    planId?: number;
    status?: string;
    contractType?: string;
    activeOnly?: boolean;
  }): Promise<ContractListResponse> => {
    const response = await api.get('/contracts', { params });
    return response.data.data || response.data;
  },

  getById: async (id: number): Promise<Contract> => {
    const response = await api.get(`/contracts/${id}`);
    return response.data.data || response.data;
  },

  create: async (data: CreateContractRequest): Promise<Contract> => {
    const response = await api.post('/contracts', data);
    return response.data.data || response.data;
  },

  update: async (id: number, data: UpdateContractRequest): Promise<Contract> => {
    const response = await api.put(`/contracts/${id}`, data);
    return response.data.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/contracts/${id}`);
  },

  getPublishers: async (contractId: number): Promise<any[]> => {
    const response = await api.get(`/contracts/${contractId}/publishers`);
    return response.data.data || [];
  },
};

// =============================================
// PUBLISHER CONTRACTS API
// =============================================

export interface PublisherContract {
  contract_id: number;
  publisher_id?: number;
  contract_number: string;
  contract_type: 'revenue_share' | 'subscription' | 'partnership' | 'hybrid';
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  revenue_share_percentage?: number;
  revenue_share_rules?: any;
  minimum_payout_amount?: number;
  subscription_amount?: number;
  subscription_interval?: string;
  currency: string;
  payment_terms?: string;
  status: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
  signed_by_publisher_at?: string;
  signed_by_tenant_at?: string;
  created_at: string;
  updated_at: string;
  publisher_name?: string;
}

export interface CreatePublisherContractRequest {
  publisher_id?: number;
  contract_number: string;
  contract_type: 'revenue_share' | 'subscription' | 'partnership' | 'hybrid';
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  revenue_share_percentage?: number;
  revenue_share_rules?: any;
  minimum_payout_amount?: number;
  subscription_amount?: number;
  subscription_interval?: string;
  currency?: string;
  payment_terms?: string;
  status?: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
  created_before_publisher?: boolean;
}

export interface UpdatePublisherContractRequest {
  contract_number?: string;
  contract_type?: 'revenue_share' | 'subscription' | 'partnership' | 'hybrid';
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  revenue_share_percentage?: number;
  revenue_share_rules?: any;
  minimum_payout_amount?: number;
  subscription_amount?: number;
  subscription_interval?: string;
  currency?: string;
  payment_terms?: string;
  status?: 'draft' | 'active' | 'expired' | 'terminated' | 'cancelled';
}

export interface PublisherContractListResponse {
  data: PublisherContract[];
  total: number;
  page: number;
  limit: number;
}

export const publisherContractApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    publisherId?: number;
    status?: string;
    contractType?: string;
    activeOnly?: boolean;
  }): Promise<PublisherContractListResponse> => {
    const response = await api.get('/contracts/publisher-contracts', { params });
    return response.data.data || response.data;
  },

  getById: async (id: number): Promise<PublisherContract> => {
    const response = await api.get(`/contracts/publisher-contracts/${id}`);
    return response.data.data || response.data;
  },

  create: async (data: CreatePublisherContractRequest): Promise<PublisherContract> => {
    const response = await api.post('/contracts/publisher-contracts', data);
    return response.data.data || response.data;
  },

  update: async (id: number, data: UpdatePublisherContractRequest): Promise<PublisherContract> => {
    const response = await api.put(`/contracts/publisher-contracts/${id}`, data);
    return response.data.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/contracts/publisher-contracts/${id}`);
  },

  getByPublisher: async (publisherId: number): Promise<PublisherContract[]> => {
    const response = await api.get(`/contracts/publishers/${publisherId}/contracts`);
    return response.data.data || response.data || [];
  },
};

// =============================================
// LOCALS API
// =============================================

export interface Local {
  local_id: number;
  publisher_id: number; // Obrigatório: locais pertencem apenas a publishers
  name: string;
  category_segment?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  publisher_name?: string;
  totem_count?: number;
  smart_tv_count?: number;
}

export interface CreateLocalRequest {
  publisher_id?: number; // Opcional no modo compacto (resolvido pelo owner no backend)
  contract_id?: number; // Opcional: contrato que gerou a criação (rastreabilidade)
  name: string;
  category_segment?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  description?: string;
}

export interface UpdateLocalRequest {
  name?: string;
  category_segment?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  description?: string;
  is_active?: boolean;
}

export interface LocalListResponse {
  data: Local[];
  total: number;
  page: number;
  limit: number;
}

export const localApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    publisherId?: number;
    active_only?: boolean;
  }): Promise<LocalListResponse> => {
    const response = await api.get('/locals', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Local> => {
    const response = await api.get(`/locals/${id}`);
    return response.data.data || response.data;
  },

  create: async (data: CreateLocalRequest): Promise<Local> => {
    const response = await api.post('/locals', data);
    return response.data.data || response.data;
  },

  update: async (id: number, data: UpdateLocalRequest): Promise<Local> => {
    const response = await api.put(`/locals/${id}`, data);
    return response.data.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/locals/${id}`);
  },

  getTotems: async (localId: number): Promise<any[]> => {
    const response = await api.get(`/locals/${localId}/totems`);
    return response.data.data || response.data || [];
  },

  getStats: async (localIds: number[]): Promise<Record<number, { totens: number; smartTvs: number }>> => {
    if (localIds.length === 0) return {};
    const response = await api.get('/locals/stats', { params: { localIds: localIds.join(',') } });
    return response.data || {};
  },
};

// =============================================
// SMART TVS API
// =============================================

export interface SmartTv {
  smart_tv_id: number;
  totem_id: number;
  identifier: string;
  device_id?: string;
  name?: string;
  brand?: string;
  model?: string;
  platform?: string;
  firmware_version?: string;
  resolution_width?: number;
  resolution_height?: number;
  orientation?: 'landscape' | 'portrait';
  status?: string;
  last_heartbeat?: string;
  capabilities?: any;
  settings?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  totem_name?: string;
  local_name?: string;
  publisher_name?: string;
  publisher_id?: number;
}

export interface CreateSmartTvRequest {
  totem_id: number;
  contract_id?: number; // Opcional: contrato que gerou a criação (rastreabilidade)
  identifier: string;
  device_id?: string;
  name?: string;
  brand?: string;
  model?: string;
  platform?: string;
  firmware_version?: string;
  resolution_width?: number;
  resolution_height?: number;
  orientation?: 'landscape' | 'portrait';
  capabilities?: any;
  settings?: any;
}

export interface UpdateSmartTvRequest {
  identifier?: string;
  device_id?: string;
  name?: string;
  brand?: string;
  model?: string;
  platform?: string;
  firmware_version?: string;
  resolution_width?: number;
  resolution_height?: number;
  orientation?: 'landscape' | 'portrait';
  status?: string;
  capabilities?: any;
  settings?: any;
  is_active?: boolean;
}

export interface SmartTvListResponse {
  data: SmartTv[];
  total: number;
  page: number;
  limit: number;
}

export const smartTvApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    totemId?: number;
    publisherId?: number;
    active_only?: boolean;
  }): Promise<SmartTvListResponse> => {
    const response = await api.get('/smart-tvs', { params });
    // Normalizar formato de retorno (backend pode retornar { success, data, total, page, limit })
    const raw = response.data;
    const data = (raw?.data && Array.isArray(raw.data)) ? raw.data : [];
    return {
      data,
      total: raw?.total ?? data.length,
      page: raw?.page ?? 1,
      limit: raw?.limit ?? (params?.limit ?? 10),
    };
  },

  getById: async (id: number): Promise<SmartTv> => {
    const response = await api.get(`/smart-tvs/${id}`);
    return response.data.data || response.data;
  },

  create: async (data: CreateSmartTvRequest): Promise<SmartTv> => {
    const response = await api.post('/smart-tvs', data);
    return response.data.data || response.data;
  },

  update: async (id: number, data: UpdateSmartTvRequest): Promise<SmartTv> => {
    const response = await api.put(`/smart-tvs/${id}`, data);
    return response.data.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/smart-tvs/${id}`);
  },

  getByTotem: async (totemId: number): Promise<SmartTv[]> => {
    const response = await api.get(`/smart-tvs/totem/${totemId}`);
    return response.data.data || response.data || [];
  },
};

// =============================================
// SUBSCRIBER ACCESS API
// =============================================

export interface SubscriberPublisherAccess {
  accessId: number;
  subscriberId: number;
  publisherId: number;
  contractId?: number;
  planId?: number;
  accessType: 'plan' | 'contract' | 'override';
  grantedAt: string;
  expiresAt?: string;
  isActive: boolean;
  publisherName?: string;
  publisherEmail?: string;
  planName?: string;
  contractNumber?: string;
}

export interface AccessiblePublisher {
  publisher_id: number;
  publisher_name: string;
  publisher_email?: string;
  contract_id?: number;
  plan_id?: number;
  plan_name?: string;
  access_type: string;
  expires_at?: string;
}

export interface PlanPublisherAccess {
  plan_id: number;
  plan_name: string;
  plan_slug: string;
  publisher_id: number;
  publisher_name: string;
  publisher_email?: string;
  is_allowed: boolean;
  restrictions?: any;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SubscriberPublisherAccessDetail {
  accessId: number;
  subscriberId: number;
  subscriberName: string;
  publisherId: number;
  publisherName: string;
  contractId?: number;
  contractNumber?: string;
  planId?: number;
  planName?: string;
  accessType: 'plan' | 'contract' | 'override';
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  isActive: boolean;
  grantedBy?: number;
  grantedByName?: string;
  notes?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export const subscriberAccessApi = {
  // Listar todos os acessos (admin only)
  getAllAccess: async (params?: {
    subscriberId?: number;
    publisherId?: number;
    contractId?: number;
    planId?: number;
    isActive?: boolean;
  }): Promise<SubscriberPublisherAccessDetail[]> => {
    const response = await api.get('/subscriber-access', { params });
    return response.data.data || [];
  },

  // Obter publishers acessíveis por um subscriber
  getAccessiblePublishers: async (subscriberId: number): Promise<AccessiblePublisher[]> => {
    const response = await api.get(`/subscriber-access/${subscriberId}/publishers`);
    return response.data.data || [];
  },

  // Validar acesso
  hasAccess: async (subscriberId: number, publisherId: number): Promise<boolean> => {
    const response = await api.get(`/subscriber-access/${subscriberId}/publishers/${publisherId}/check`);
    return response.data.hasAccess === true;
  },

  // Conceder acesso (admin only)
  grantAccess: async (data: {
    subscriberId: number;
    publisherId: number;
    contractId: number;
    expiresAt?: string;
    notes?: string;
  }): Promise<SubscriberPublisherAccess> => {
    const response = await api.post('/subscriber-access/grant', data);
    return response.data.data;
  },

  // Revogar acesso (admin only)
  revokeAccess: async (subscriberId: number, publisherId: number, reason?: string): Promise<void> => {
    await api.post(`/subscriber-access/${subscriberId}/publishers/${publisherId}/revoke`, { reason });
  },

  // ===== PLAN PUBLISHER ACCESS (Admin only) =====
  
  // Listar configurações de plan_publisher_access
  getPlanPublisherAccess: async (params?: {
    planId?: number;
    publisherId?: number;
  }): Promise<PlanPublisherAccess[]> => {
    const response = await api.get('/subscriber-access/plan-publisher', { params });
    return response.data.data || [];
  },

  reconcilePlanPublisher: async (): Promise<{ success: boolean; results?: any[] }> => {
    const response = await api.post('/subscriber-access/plan-publisher/reconcile');
    return response.data;
  },

  // Configurar acesso de plano a publisher
  setPlanPublisherAccess: async (data: {
    planId: number;
    publisherId: number;
    isAllowed: boolean;
    restrictions?: any;
    notes?: string;
  }): Promise<void> => {
    await api.post('/subscriber-access/plan-publisher', data);
  },

  // Remover acesso de plano a publisher
  removePlanPublisherAccess: async (planId: number, publisherId: number): Promise<void> => {
    await api.delete(`/subscriber-access/plan-publisher/${planId}/${publisherId}`);
  },

  // Obter acessos expirando (admin only)
  getExpiringAccess: async (days?: number): Promise<{
    data: AccessiblePublisher[];
    summary: {
      total: number;
      expiringIn7Days: number;
      expiringIn15Days: number;
      expiringIn30Days: number;
    };
  }> => {
    const response = await api.get('/subscriber-access/expiring', { params: { days } });
    return response.data;
  },
};

// =============================================
// SUBSCRIBER BILLING API
// =============================================

export interface SubscriberBillingItem {
  billing_id: number;
  subscriber_id: number;
  subscriber_name?: string;
  campaign_id?: number;
  campaign_title?: string;
  billing_type: 'advertisement' | 'campaign' | 'media_upload' | 'exhibition_lot' | 'totem_quantity' | 'time_based' | 'custom';
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
  description?: string;
  metadata?: any;
}

export interface SubscriberBillingListResponse {
  billings: SubscriberBillingItem[];
  total: number;
  page: number;
  limit: number;
}

export const subscriberBillingApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    subscriberId?: number;
    campaignId?: number;
    billingType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<SubscriberBillingListResponse> => {
    const response = await api.get('/subscriber-billing', { params });
    const data = response.data?.data || response.data;
    if (data && typeof data === 'object' && 'billings' in data) {
      return data;
    }
    return {
      billings: Array.isArray(data) ? data : [],
      total: data?.total || 0,
      page: data?.page || 1,
      limit: data?.limit || 20,
    };
  },

  getStats: async (subscriberId?: number): Promise<any> => {
    const response = await api.get('/subscriber-billing/stats', { params: { subscriberId } });
    return response.data.data || response.data;
  },

  getById: async (id: number): Promise<SubscriberBillingItem> => {
    const response = await api.get(`/subscriber-billing/${id}`);
    return response.data.data;
  },
};

// =============================================
// PUBLISHER BILLING API
// =============================================

export interface PublisherBillingItem {
  billing_id: number;
  publisher_id: number;
  publisher_name?: string;
  campaign_id?: number;
  campaign_title?: string;
  totem_id?: number;
  billing_type: 'revenue_share' | 'payout' | 'subscription' | 'platform_fee';
  direction: 'incoming' | 'outgoing';
  amount: number;
  currency: string;
  payment_status: 'pending' | 'pending_payout' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  due_date?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
  description?: string;
  metadata?: any;
}

export interface PublisherBillingListResponse {
  billings: PublisherBillingItem[];
  total: number;
  page: number;
  limit: number;
}

export const publisherBillingApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    publisherId?: number;
    campaignId?: number;
    totemId?: number;
    billingType?: string;
    direction?: 'incoming' | 'outgoing';
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<PublisherBillingListResponse> => {
    const response = await api.get('/publisher-billing', { params });
    const data = response.data?.data || response.data;
    if (data && typeof data === 'object' && 'billings' in data) {
      return data;
    }
    return {
      billings: Array.isArray(data) ? data : [],
      total: data?.total || 0,
      page: data?.page || 1,
      limit: data?.limit || 20,
    };
  },

  getStats: async (publisherId?: number): Promise<any> => {
    const response = await api.get('/publisher-billing/stats', { params: { publisherId } });
    return response.data.data || response.data;
  },

  getById: async (id: number): Promise<PublisherBillingItem> => {
    const response = await api.get(`/publisher-billing/${id}`);
    return response.data.data;
  },
};

// =============================================
// PLAYLIST MIX API
// =============================================

export * from './playlistMixApi';

// =============================================
// DISPATCHER-TOTEM API
// =============================================

export interface DispatchPlan {
  totemId: number;
  timestamp: string;
  playlistId: number;
  playlistName: string;
  mediaItems: Array<{
    mediaId: number;
    order: number;
    duration: number;
    url: string;
    mediaType: string;
    metadata?: any;
  }>;
  totalDuration: number;
  priority: number;
  source: 'direct' | 'group' | 'campaign' | 'mix';
  sourceId: number;
  sourceName?: string;
  validityStart: string;
  validityEnd: string;
  metadata?: any;
}

export interface DispatchLogEntry {
  logId: number;
  totemId: number;
  timestamp: string;
  // Identidade comercial
  subscriberId?: number;
  subscriberName?: string;
  publisherId?: number;
  publisherName?: string;
  selectedCampaignId?: number;
  selectedPlaylistId: number;
  selectedSource: 'direct' | 'group' | 'campaign' | 'mix';
  selectedSourceId: number;
  priority: number;
  candidatesCount: number;
  candidates: any[];
  temporalValidation: boolean;
  technicalValidation: boolean;
  integrityValidation: boolean;
  validationDetails?: any;
  fromCache: boolean;
  cacheKey?: string;
  dispatchPlan?: DispatchPlan;
  executionTimeMs: number;
  createdAt: string;
}

export interface DispatchResponse {
  success: boolean;
  data?: DispatchPlan;
  candidates?: any[];
  fromCache?: boolean;
  executionTimeMs: number;
  error?: string;
}

export const dispatcherTotemApi = {
  dispatch: async (totemId: number, params?: {
    timestamp?: string;
    timezone?: string;
    skipCache?: boolean;
    includeCandidates?: boolean;
  }): Promise<DispatchResponse> => {
    const response = await api.get(`/dispatcher-totem/${totemId}/dispatch`, { params });
    return response.data;
  },

  getHistory: async (totemId: number, startDate: string, endDate: string): Promise<{
    success: boolean;
    data: DispatchLogEntry[];
    count: number;
  }> => {
    const response = await api.get(`/dispatcher-totem/${totemId}/history`, {
      params: { startDate, endDate }
    });
    return response.data;
  },

  getCandidates: async (totemId: number, params?: {
    timestamp?: string;
    timezone?: string;
  }): Promise<{
    success: boolean;
    candidates: any[];
    selectedPlan?: DispatchPlan;
    count: number;
  }> => {
    const response = await api.get(`/dispatcher-totem/${totemId}/candidates`, { params });
    return response.data;
  },

  getCacheConfig: async (): Promise<{
    success: boolean;
    data: {
      enabled: boolean;
      ttlSeconds: number;
      maxSize?: number;
    };
  }> => {
    const response = await api.get('/dispatcher-totem/cache/config');
    return response.data;
  },

  setCacheConfig: async (config: {
    enabled?: boolean;
    ttlSeconds?: number;
    maxSize?: number;
  }): Promise<{
    success: boolean;
    data: any;
    message: string;
  }> => {
    const response = await api.post('/dispatcher-totem/cache/config', config);
    return response.data;
  },
};

// =============================================
// DISPATCHER DEBUG API
// =============================================

export interface RedisStatus {
  enabled: boolean;
  connected: boolean;
  error?: string;
  config: {
    host: string;
    port: number;
    db: number;
    url?: string;
  };
  cacheServiceAvailable: boolean;
  lastCheck: string;
}

export interface QueryLog {
  id: string;
  timestamp: string;
  query: string;
  params?: any[];
  duration?: number;
  rowCount?: number;
  error?: string;
  source?: string;
}

export interface DispatcherMessage {
  id: string;
  timestamp: string;
  direction: 'incoming' | 'outgoing';
  totemId?: number;
  uin?: string;
  endpoint?: string;
  method?: string;
  request?: any;
  response?: any;
  duration?: number;
  fromCache?: boolean;
  error?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DebugLog {
  id: string;
  timestamp: string;
  type: 'redis' | 'query' | 'message' | 'cache';
  data: any;
}

export interface DebugStats {
  totalQueries: number;
  totalMessages: number;
  totalDebugLogs: number;
  queriesWithError: number;
  messagesWithError: number;
  avgQueryDuration: number;
  avgMessageDuration: number;
  redis: RedisStatus;
}

// =============================================
// NETWORK TOPOLOGY API
// =============================================

import type { SmartSignageNetwork } from '@shared/holograph-adapter';

export interface NetworkTopologyPublisher {
  id: number;
  name: string;
  locals: NetworkTopologyLocal[];
}

export interface NetworkTopologyLocal {
  id: number;
  name: string;
  totems: NetworkTopologyTotem[];
}

export interface NetworkTopologyTotem {
  id: number;
  identifier: string;
  name: string;
  status: string;
  lastHeartbeat?: string;
  mediaCount: number;
  smartTvs: NetworkTopologySmartTv[];
}

export interface NetworkTopologySmartTv {
  id: number;
  identifier: string;
  name: string;
  status: string;
  lastHeartbeat?: string;
  mediaCount?: number;
}

export const networkTopologyApi = {
  getTopology: async (): Promise<{
    success: boolean;
    data: NetworkTopologyPublisher[];
    meta?: { totalPublishers?: number };
  }> => {
    const response = await api.get('/network/topology');
    return response.data;
  },

  /** Rede no formato SmartSignageNetwork para HoloGraph (publishers, subscribers, scheduleAssignments). */
  getGraph: async (params?: { dayOfWeek?: number; time?: string }): Promise<{ success: boolean; data: SmartSignageNetwork }> => {
    const response = await api.get('/network/graph', { params });
    const body = response.data as { success?: boolean; data?: SmartSignageNetwork };
    return body?.data != null ? { success: true, data: body.data } : { success: true, data: body as unknown as SmartSignageNetwork };
  },
};

// =============================================
// DISPATCHER DEBUG API
// =============================================

export const dispatcherDebugApi = {
  getRedisStatus: async (): Promise<{ success: boolean; data: RedisStatus }> => {
    const response = await api.get('/dispatcher-debug/redis-status');
    return response.data;
  },

  getQueries: async (params?: {
    limit?: number;
    since?: string;
  }): Promise<{ success: boolean; data: QueryLog[]; count: number }> => {
    const response = await api.get('/dispatcher-debug/queries', { params });
    return response.data;
  },

  getMessages: async (params?: {
    limit?: number;
    since?: string;
    totemId?: number;
    uin?: string;
  }): Promise<{ success: boolean; data: DispatcherMessage[]; count: number }> => {
    const response = await api.get('/dispatcher-debug/messages', { params });
    return response.data;
  },

  getMessageLogs: async (
    limit: number = 100,
    since?: string,
    totemId?: number,
    uin?: string
  ): Promise<DispatcherMessage[]> => {
    const params: any = { limit };
    if (since) params.since = since;
    if (totemId) params.totemId = totemId;
    if (uin) params.uin = uin;
    const response = await api.get('/dispatcher-debug/messages', { params });
    return response.data?.data || [];
  },

  getLogs: async (params?: {
    limit?: number;
    since?: string;
    type?: 'redis' | 'query' | 'message' | 'cache';
  }): Promise<{ success: boolean; data: DebugLog[]; count: number }> => {
    const response = await api.get('/dispatcher-debug/logs', { params });
    return response.data;
  },

  getStats: async (): Promise<{ success: boolean; data: DebugStats }> => {
    const response = await api.get('/dispatcher-debug/stats');
    return response.data;
  },

  clearLogs: async (olderThan?: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/dispatcher-debug/clear', null, {
      params: olderThan ? { olderThan } : undefined,
    });
    return response.data;
  },
};

export default api;