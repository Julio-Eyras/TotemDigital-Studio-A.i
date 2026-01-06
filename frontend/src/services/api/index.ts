import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

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
      const rateLimitEvent = new CustomEvent('rateLimitExceeded', {
        detail: {
          retryAfter: retryAfterSeconds,
          message: message,
        },
      });
      window.dispatchEvent(rateLimitEvent);

      // NÃO fazer retry automático para rate limit (evitar loops e mais requisições)
      return Promise.reject(error);
    }

    // Tratamento de 401 (Não autorizado)
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Tratamento de 413 (Payload muito grande)
    if (error.response?.status === 413) {
      const payloadErrorEvent = new CustomEvent('payloadTooLarge', {
        detail: {
          message: 'Arquivo ou dados muito grandes. Reduza o tamanho e tente novamente.',
        },
      });
      window.dispatchEvent(payloadErrorEvent);
    }

    // Tratamento de 400 (Bad Request) - Validação
    if (error.response?.status === 400) {
      const validationError = error.response.data?.message || error.response.data?.error || 'Erro de validação';
      const validationEvent = new CustomEvent('validationError', {
        detail: {
          message: validationError,
        },
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
  role: 'owner_system' | 'admin_sql' | 'admin' | 'operador_tecnico' | 'operador_faturamento' | 'operador_comercial' | 'gerente_marketing' | 'editoracao' | 'visualizador' | 'user' | 'publisher_user' | 'subscriber_user' | 'publisher_subscriber';
  publisher_id?: number;
  subscriber_id?: number;
  user_type?: 'system_user' | 'subscriber_user' | 'publisher_user' | 'publisher_subscriber';
  is_tenant_user?: boolean;
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
  role: 'owner_system' | 'admin_sql' | 'admin' | 'operador_tecnico' | 'operador_faturamento' | 'operador_comercial' | 'gerente_marketing' | 'editoracao' | 'visualizador' | 'user' | 'publisher_user' | 'subscriber_user' | 'publisher_subscriber';
  publisherId?: number;
  subscriberId?: number;
  userType?: 'system_user' | 'subscriber_user' | 'publisher_user' | 'publisher_subscriber';
  isTenantUser?: boolean;
  flags?: Partial<UserFlags>; // NOVO
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  name?: string;
  role?: 'owner_system' | 'admin_sql' | 'admin' | 'operador_tecnico' | 'operador_faturamento' | 'operador_comercial' | 'gerente_marketing' | 'editoracao' | 'visualizador' | 'user' | 'client' | 'publisher_user' | 'subscriber_user' | 'publisher_subscriber';
  publisherId?: number;
  subscriberId?: number;
  userType?: 'system_user' | 'subscriber_user' | 'publisher_user' | 'publisher_subscriber';
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
  client_id: number;
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
  location?: string;
  client_id?: number;
  is_active: boolean;
  last_heartbeat?: string;
  current_playlist_id?: number;
  status: 'online' | 'offline' | 'error' | 'pending_approval';
  created_at: string;
  updated_at: string;
  config?: any;
}

// Alias para compatibilidade
export type Totem = Player;

export interface CreatePlayerRequest {
  name?: string;
  identifier?: string; // Opcional: backend aceita name OU identifier
  uin?: string;
  localId: number; // OBRIGATÓRIO
  deviceId?: string;
  location?: string;
  description?: string;
  firmwareVersion?: string;
  clientId?: number; // DEPRECATED - usar subscriber_id
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
  description?: string;
  subscriberId?: number; // NOVO: Use subscriberId
  clientId?: number; // DEPRECATED: Mantido para compatibilidade
}

export interface UpdatePlaylistRequest {
  name?: string;
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

export const playlistApi = {
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
    if (data.clientId !== undefined && data.clientId !== null) {
      cleanData.clientId = data.clientId;
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

  reorderMedia: async (playlistId: number, items: { itemId: number; orderIndex: number }[]): Promise<void> => {
    await api.put(`/playlists/${playlistId}/media/reorder`, { items });
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
      // Debug: log primeiro item para verificar estrutura
      if (mediaArray.indexOf(item) === 0) {
        console.log('🔍 [Media API] Primeiro item do backend:', JSON.stringify(item, null, 2));
      }
      
      // Construir URL do arquivo se necessário
      let filePath = item.file_path || item.filePath || '';
      if (filePath && !filePath.startsWith('/assets/') && !filePath.startsWith('http')) {
        // Converter caminho absoluto para URL relativa
        filePath = filePath.replace('/opt/smart-signage/public/assets/', '/assets/');
      }
      
      // Construir thumbnailUrl se não existir
      let thumbnailUrl = item.thumbnailUrl || item.thumbnail_url || item.thumbnailUrlComputed;
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
    const response = await api.put('/auth/change-password', passwordData, {
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
  description?: string;
  campaign_type: string;
  status: string;
  client_id?: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  playlist_count?: number;
  totem_count?: number;
  playlistIds?: number[]; // NOVO: IDs das playlists associadas
  playlistNames?: string[]; // NOVO: Nomes das playlists associadas
  mediaIds?: number[]; // NOVO: IDs das mídias diretamente associadas (sem playlist)
  mediaNames?: string[]; // NOVO: Nomes das mídias diretamente associadas
}

export interface CreateCampaignRequest {
  title: string;
  description?: string;
  campaign_type: string;
  status?: string;
  clientId?: number;
  start_date?: string;
  end_date?: string;
  playlistIds?: number[];
  totemIds?: number[];
  publisherIds?: number[]; // IDs dos publishers onde a campanha será exibida
  mediaIds?: number[]; // NOVO: IDs das mídias diretamente associadas (sem playlist)
}

export interface UpdateCampaignRequest {
  title?: string;
  description?: string;
  campaign_type?: string;
  status?: string;
  clientId?: number;
  start_date?: string;
  end_date?: string;
  isActive?: boolean;
  playlistIds?: number[]; // NOVO: IDs das playlists associadas
  publisherIds?: number[]; // IDs dos publishers onde a campanha será exibida
  mediaIds?: number[]; // NOVO: IDs das mídias diretamente associadas (sem playlist)
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
  } = {}): Promise<CampaignListResponse> => {
    // Converter clientId para subscriberId se fornecido
    const apiParams: any = { ...params };
    if (apiParams.clientId && !apiParams.subscriberId) {
      apiParams.subscriberId = apiParams.clientId;
      delete apiParams.clientId;
    }
    const response = await api.get('/campaigns', { params: apiParams });
    return response.data.data;
  },

  getById: async (id: number): Promise<Campaign> => {
    const response = await api.get(`/campaigns/${id}`);
    return response.data.data;
  },

  create: async (data: CreateCampaignRequest): Promise<Campaign> => {
    const response = await api.post('/campaigns', data);
    return response.data.data;
  },

  update: async (id: number, data: UpdateCampaignRequest): Promise<Campaign> => {
    const response = await api.put(`/campaigns/${id}`, data);
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/campaigns/${id}`);
  },

  getStats: async () => {
    const response = await api.get('/campaigns/stats');
    return response.data.data;
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
  client_id?: number;
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

  getPending: async (params: {
    page?: number;
    limit?: number;
  } = {}): Promise<PlayerListResponse> => {
    const response = await api.get('/totems/pending', { params });
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
  plan_id: number;
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  features: string[];
  billing_interval: 'month' | 'year';
  is_active: boolean;
  stripe_product_id?: string;
  stripe_price_id?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanRequest {
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency?: string;
  features: string[];
  billing_interval?: 'month' | 'year';
  is_active?: boolean;
  stripe_product_id?: string;
  stripe_price_id?: string;
}

export interface UpdatePlanRequest {
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  currency?: string;
  features?: string[];
  billing_interval?: 'month' | 'year';
  is_active?: boolean;
  stripe_product_id?: string;
  stripe_price_id?: string;
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
  client_id?: number;
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
  description?: string;
  is_subscriber?: boolean;
  is_publisher?: boolean;
  client_type?: 'subscriber' | 'publisher' | 'both';
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePublisherRequest {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
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
  description?: string;
  is_subscriber?: boolean;
  is_publisher?: boolean;
  client_type?: 'subscriber' | 'publisher' | 'both';
  active?: boolean;
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
    return response.data;
  },

  getById: async (id: number): Promise<Publisher> => {
    const response = await api.get(`/publishers/${id}`);
    return response.data.data;
  },

  create: async (data: CreatePublisherRequest): Promise<Publisher> => {
    const response = await api.post('/publishers', data);
    // Backend retorna diretamente o publisher ou { data: publisher }
    return response.data.data || response.data;
  },

  update: async (id: number, data: UpdatePublisherRequest): Promise<Publisher> => {
    const response = await api.put(`/publishers/${id}`, data);
    return response.data.data;
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
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateSubscriberRequest {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  description?: string;
}

export interface UpdateSubscriberRequest {
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  description?: string;
  isActive?: boolean;
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

  create: async (data: CreateSubscriberRequest): Promise<Subscriber> => {
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

  getTotems: async (subscriberId: number): Promise<any[]> => {
    const response = await api.get(`/subscribers/${subscriberId}/totems`);
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
};

// =============================================
// LOCALS API
// =============================================

export interface Local {
  local_id: number;
  publisher_id: number;
  name: string;
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
}

export interface CreateLocalRequest {
  publisher_id?: number; // Opcional: para publishers
  subscriber_id?: number; // Opcional: para subscribers
  name: string;
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
};

// =============================================
// SMART TVS API
// =============================================

export interface SmartTv {
  tv_id: number;
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
  last_seen?: string;
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
    return response.data;
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
// PLAYLIST MIX API
// =============================================

export * from './playlistMixApi';

export default api;