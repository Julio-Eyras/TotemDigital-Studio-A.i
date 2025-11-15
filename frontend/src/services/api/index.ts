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
  return config;
});

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
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

export interface User {
  user_id: number;
  username: string;
  email?: string;
  name: string;
  role: 'admin' | 'user' | 'client';
  client_id?: number;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  name: string;
  role: 'admin' | 'user' | 'client';
  clientId?: number;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  name?: string;
  role?: 'admin' | 'user' | 'client';
  clientId?: number;
  isActive?: boolean;
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
    clientId?: number;
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
};

// =============================================
// CLIENTS API
// =============================================

export interface Client {
  client_id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateClientRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateClientRequest {
  name?: string;
  email?: string;
  phone?: string;
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

export interface CreatePlayerRequest {
  name: string;
  location?: string;
  clientId?: number;
}

export interface UpdatePlayerRequest {
  name?: string;
  location?: string;
  clientId?: number;
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
    clientId?: number;
    status?: string;
  } = {}): Promise<PlayerListResponse> => {
    const response = await api.get('/players', { params });
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
  client_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  media_count?: number;
  total_duration?: number;
}

export interface CreatePlaylistRequest {
  name: string;
  description?: string;
  clientId?: number;
}

export interface UpdatePlaylistRequest {
  name?: string;
  description?: string;
  clientId?: number;
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
    clientId?: number;
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
    const response = await api.post('/playlists', data);
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
  media_id: number;
  name: string;
  title?: string;
  description?: string;
  media_type: string;
  file_path: string;
  mime_type: string;
  duration_seconds?: number;
  size_bytes: number;
  width?: number;
  height?: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMediaRequest {
  name: string;
  title?: string;
  description?: string;
  tags?: string[];
  clientId?: number;
}

export interface UpdateMediaRequest {
  name?: string;
  title?: string;
  description?: string;
  tags?: string[];
  status?: string;
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
    clientId?: number;
  } = {}): Promise<MediaListResponse> => {
    const response = await api.get('/media', { params });
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

  getById: async (id: number): Promise<MediaItem> => {
    const response = await api.get(`/media/${id}`);
    return response.data;
  },

  upload: async (file: File, data: CreateMediaRequest): Promise<MediaItem> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', data.name);
    if (data.title) formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    if (data.tags) formData.append('tags', JSON.stringify(data.tags));
    if (data.clientId) formData.append('clientId', data.clientId.toString());

    const response = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
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
  token: string;
  user: User;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
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
    clientId?: number;
    status?: string;
    campaignType?: string;
    isActive?: boolean;
  } = {}): Promise<CampaignListResponse> => {
    const response = await api.get('/campaigns', { params });
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
    const response = await api.post('/reports/generate', data);
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

  updateMultiple: async (settings: Array<{ key: string; value: any }>) => {
    const response = await api.put('/settings', { settings });
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
    const response = await api.get('/smart-playlist');
    return response.data.data;
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
    return response.data.data || [];
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

export default api;